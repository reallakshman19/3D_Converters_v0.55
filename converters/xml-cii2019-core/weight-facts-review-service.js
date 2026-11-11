// GC-PW/1.0 transport-neutral Weight decision ledger. No DOM, globals or XML imports.
export const WEIGHT_SCHEMA = 'gc-pw/1.0';
const AUTHORITIES = new Set(['source', 'exact-master', 'derived', 'proposed', 'manual', 'unresolved', 'conflict']);
const STAGES = new Set(['preview', 'RigidMatch1', 'Rigidmatch2']);
const DECISIONS = new Set(['accept-proposal', 'enter-manual', 'reject', 'defer', 'final-override', 'set-zero-mass']);
const sha = (x) => typeof x === 'string' && /^[a-f\d]{64}$/i.test(x);
function plainJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  if (Array.isArray(value)) {
    seen.add(value);
    const good = value.every((item, index) => Object.hasOwn(value, index) && plainJson(item, seen))
      && Object.keys(value).length === value.length;
    seen.delete(value);
    return good;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const good = Object.keys(value).every((key) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && plainJson(value[key], seen));
  seen.delete(value);
  return good;
}
const copy = (x) => {
  required(plainJson(x), 'INVALID_JSON', 'Envelope must be lossless plain JSON');
  return JSON.parse(JSON.stringify(x));
};
const finitePositive = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;
const keyOf = (x) => x.sourceId + '\u0000' + x.occurrenceId;
function fault(code, message) { const e = new Error(message); e.code = code; e.retryable = false; return e; }
function required(ok, code, why) { if (!ok) throw fault(code, why); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function validateBasis(b) {
  required(b?.schemaVersion === WEIGHT_SCHEMA && b.domainId && sha(b.basisId), 'INVALID_BASIS', 'Version, domain and SHA-256 basisId required');
  required(Array.isArray(b.sourceRefs) && b.sourceRefs.length && Array.isArray(b.scope) && b.scope.length, 'INVALID_BASIS', 'Nonempty source and scope required');
  required(sha(b.selectionSha256) && (b.stagedSourceSha256 === null || sha(b.stagedSourceSha256)), 'INVALID_BASIS', 'Selection/staged digest required');
  required(sha(b.configSha256) && sha(b.overridesSha256), 'INVALID_BASIS', 'Config/override digest required');
  required(plainJson(b), 'INVALID_BASIS', 'Basis must use JSON-safe serializable fields');
  const sources = new Set(), selections = new Set();
  for (const ref of b.sourceRefs) {
    required(ref.sourceId && sha(ref.sha256) && ref.mediaType && !sources.has(ref.sourceId), 'SOURCE_CONFLICT', 'Duplicate or invalid source digest');
    sources.add(ref.sourceId);
  }
  for (const ref of b.scope) {
    required(sources.has(ref.sourceId) && ref.selectionRef, 'SCOPE_CONFLICT', 'Unresolved selection/source');
    const scopeKey = ref.sourceId + '\\u0000' + ref.selectionRef;
    required(!selections.has(scopeKey), 'SCOPE_CONFLICT', 'Duplicate selection source scope');
    selections.add(scopeKey);
  }
  for (const m of Object.values(b.masters || {})) {
    required(m.datasetId && ((typeof m.revision === 'string' && m.revision.trim()) || (Number.isSafeInteger(m.revision) && m.revision >= 0)) && sha(m.sha256) && sha(m.mappingSha256) && Number.isSafeInteger(m.rowCount) && m.rowCount >= 0, 'INVALID_MASTER', 'Master digest and revision required');
  }
  return sources;
}
function validateFacts(b, facts, sources) {
  required(Array.isArray(facts), 'INVALID_FACTS', 'FactRecord array required');
  const seen = new Set(), identities = new Map(), byOccurrence = new Map();
  for (const f of facts) {
    required(f.schemaVersion === WEIGHT_SCHEMA && f.domainId === b.domainId && f.basisId === b.basisId, 'STALE_FACT', 'Fact basis mismatch');
    required(sources.has(f.sourceId) && f.occurrenceId && f.subjectType && f.fieldId && AUTHORITIES.has(f.authority), 'INVALID_FACT', 'Fact identity/authority invalid');
    required(Array.isArray(f.provenance) && Array.isArray(f.diagnostics), 'INVALID_FACT', 'Fact provenance required');
    required(f.value === null || (typeof f.value !== 'number' || Number.isFinite(f.value)), 'INVALID_NUMBER', 'Nonfinite fact value');
    required(plainJson(f) && ((f.authority !== 'unresolved' && f.authority !== 'conflict') || f.value === null), 'INVALID_FACT', 'Invalid JSON or non-null unresolved/conflict fact');
    const composite = keyOf(f), identity = identities.get(f.occurrenceId);
    required(!identity || identity === f.sourceId, 'IDENTITY_CONFLICT', 'Occurrence aliases two sources');
    identities.set(f.occurrenceId, f.sourceId);
    const id = composite + '\u0000' + f.subjectType + '\u0000' + f.fieldId;
    required(!seen.has(id), 'DUPLICATE_FACT', 'Conflicting FactRecord field: ' + id);
    seen.add(id);
    if (!byOccurrence.has(composite)) byOccurrence.set(composite, []);
    byOccurrence.get(composite).push(copy(f));
  }
  return { byOccurrence, identities };
}
function paginate(items, basisId, cursor, limit = 100) {
  required(Number.isSafeInteger(limit) && limit > 0 && limit <= 500, 'INVALID_PAGE', 'Page size must be 1..500');
  const parts = cursor ? cursor.split(':') : null;
  required(!parts || (parts.length === 2 && parts[0] === basisId && /^\d+$/.test(parts[1])), 'STALE_CURSOR', 'Cursor belongs to another basis');
  const offset = parts ? Number(parts[1]) : 0;
  required(Number.isSafeInteger(offset) && offset <= items.length, 'INVALID_PAGE', 'Invalid cursor offset');
  const end = Math.min(offset + limit, items.length);
  return { schemaVersion: WEIGHT_SCHEMA, basisId, items: copy(items.slice(offset, end)), totalCount: items.length, nextCursor: end < items.length ? basisId + ':' + end : null, complete: true };
}
export function createWeightReviewService({ score, digestReview = null } = {}) {
  required(typeof score === 'function', 'INVALID_SCORER', 'Inject a pure fact-based scorer');
  const bases = new Map(), ledger = new Map(), snapshots = new Map(), jobs = new Map();
  const current = (id) => { const v = bases.get(id); required(v, 'UNKNOWN_BASIS', 'Open basis before requests'); return v; };
  const stageName = (s) => { required(STAGES.has(s), 'INVALID_STAGE', 'Unknown review stage'); return s; };
  const slot = (id, scopeId, stage) => JSON.stringify([id, scopeId, stage]);
  const state = (id, scopeId, stage) => ledger.get(slot(id, scopeId, stage)) || { revision: null, decisions: {}, commands: {} };
  const makeProposals = (opened, occurrenceId) => {
    const source = opened.identities.get(occurrenceId);
    required(source, 'UNKNOWN_OCCURRENCE', 'Unknown occurrence');
    const record = opened.byOccurrence.get(keyOf({ sourceId: source, occurrenceId }));
    const proposals = score(copy(record), copy(opened.basis)) || [];
    required(Array.isArray(proposals), 'INVALID_PROPOSAL', 'Scorer must return an array');
    const ids = new Set();
    for (const p of proposals) {
      required(p.basisId === opened.basis.basisId && p.domainId === opened.basis.domainId && p.occurrenceId === occurrenceId && p.unit === 'kg', 'STALE_PROPOSAL', 'Proposal identity/unit mismatch');
      required(finitePositive(p.value) && p.proposalId && !ids.has(p.proposalId) && Number.isInteger(p.ranking) && p.ranking > 0 && typeof p.qualified === 'boolean', 'INVALID_PROPOSAL', 'Invalid candidate mass, id or ranking');
      required(typeof p.method === 'string' && p.method.trim() && p.scoringRevision && Array.isArray(p.eligibilityReasons) && Array.isArray(p.evidenceRefs) && plainJson(p), 'INVALID_PROPOSAL', 'Missing method/scoring provenance or invalid JSON');
      ids.add(p.proposalId);
    }
    return proposals;
  };
  return Object.freeze({
    openBasis(basis, { facts } = {}) {
      const sources = validateBasis(basis), checked = validateFacts(basis, facts, sources);
      const prior = bases.get(basis.basisId);
      required(!prior || prior.signature === canonical({ basis, facts }), 'BASIS_COLLISION', 'Immutable basisId reused for different facts');
      const opened = { basis: copy(basis), sources, ...checked, signature: canonical({ basis, facts }) };
      bases.set(basis.basisId, opened);
      return { requestId: basis.basisId, basisId: basis.basisId, stage: 'facts', completed: checked.identities.size, total: checked.identities.size, event: 'completed' };
    },
    openBasisJob(basis, { loadFacts, requestId } = {}) {
      validateBasis(basis);
      required(typeof loadFacts === 'function' && requestId, 'INVALID_JOB', 'Async fact loader and requestId required');
      required(!jobs.has(requestId), 'JOB_COLLISION', 'A requestId cannot be reused');
      const job = { requestId, basisId: basis.basisId, stage: 'facts', completed: 0, total: null, event: 'progress', cancelled: false };
      jobs.set(requestId, job);
      const report = (completed, total) => {
        if (job.cancelled) return;
        if (Number.isSafeInteger(completed) && completed >= 0) job.completed = completed;
        if (Number.isSafeInteger(total) && total >= 0) job.total = total;
      };
      const completion = Promise.resolve().then(() => loadFacts({ basis: copy(basis), requestId, report, isCancelled: () => job.cancelled }))
        .then((facts) => {
          if (job.cancelled) return this.subscribeJob(requestId);
          const result = this.openBasis(basis, { facts });
          if (job.cancelled) return this.subscribeJob(requestId);
          Object.assign(job, { completed: result.completed, total: result.total, event: 'completed' });
          return this.subscribeJob(requestId);
        }).catch((error) => {
          if (job.cancelled) return this.subscribeJob(requestId);
          job.event = 'failed';
          job.error = { code: error.code || 'FACT_LOAD_FAILED', message: String(error.message || error), retryable: false, stage: 'facts' };
          return this.subscribeJob(requestId);
        });
      job.completion = completion;
      return { requestId, basisId: basis.basisId };
    },
    subscribeJob(requestId) {
      const job = jobs.get(requestId);
      required(job, 'UNKNOWN_JOB', 'Unknown requestId');
      const { completion, cancelled, ...publicEvent } = job;
      return copy(publicEvent);
    },
    async awaitJob(requestId) {
      const job = jobs.get(requestId);
      required(job, 'UNKNOWN_JOB', 'Unknown requestId');
      await job.completion;
      return this.subscribeJob(requestId);
    },
    cancelJob(requestId) {
      const job = jobs.get(requestId);
      required(job, 'UNKNOWN_JOB', 'Unknown requestId');
      if (job.event === 'progress') { job.cancelled = true; job.event = 'cancelled'; }
      return this.subscribeJob(requestId);
    },
    getDecisionState({ basisId, scopeId, stage = 'RigidMatch1' }) {
      const opened = current(basisId); stageName(stage);
      required(stage !== 'preview' && opened.sources.has(scopeId),
        'SCOPE_CONFLICT', 'Review state is strictly scoped to an authorized source');
      const entry = state(basisId, scopeId, stage);
      return { basisId, scopeId, stage, decisionRevision: entry.revision, decisions: copy(entry.decisions) };
    },
    getFacts({ basisId, subjectType, sourceId, cursor, limit }) {
      const opened = current(basisId);
      const rows = [...opened.byOccurrence.values()].flat().filter((f) => (!subjectType || f.subjectType === subjectType) && (!sourceId || f.sourceId === sourceId));
      rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || a.fieldId.localeCompare(b.fieldId));
      return paginate(rows, basisId, cursor, limit);
    },
    getProposals({ basisId, occurrenceIds, cursor, limit } = {}) {
      const opened = current(basisId);
      const ids = occurrenceIds || [...opened.identities.keys()].sort();
      required(new Set(ids).size === ids.length, 'DUPLICATE_OCCURRENCE', 'Duplicate requested occurrence');
      const rows = ids.flatMap((id) => makeProposals(opened, id));
      return paginate(rows, basisId, cursor, limit);
    },
    getCandidateAudit({ basisId, occurrenceId }) {
      const opened = current(basisId), source = opened.identities.get(occurrenceId);
      required(source, 'UNKNOWN_OCCURRENCE', 'Unknown physical occurrence');
      required(typeof score.audit === 'function', 'AUDIT_UNAVAILABLE', 'Scorer must implement candidate audit');
      return copy(score.audit(copy(opened.byOccurrence.get(keyOf({ sourceId: source, occurrenceId }))), copy(opened.basis)));
    },
    applyDecisions({ basisId, scopeId, expectedDecisionRevision = null, commands, stage = 'RigidMatch1' }) {
      const opened = current(basisId); stageName(stage);
      required(stage !== 'preview', 'INVALID_STAGE', 'Preview has no Weight decisions');
      required(opened.sources.has(scopeId), 'SCOPE_CONFLICT', 'Scope must be an authoritative sourceId');
      required(Array.isArray(commands) && commands.length, 'INVALID_COMMAND', 'Nonempty decision commands required');
      const before = state(basisId, scopeId, stage);
      const next = copy(before), touched = new Set(), commandIds = new Set(), results = [];
      // Verify every command before publishing a single mutation (transaction is atomic).
      for (const cmd of commands) {
        required(cmd.commandId && cmd.basisId === basisId && cmd.scopeId === scopeId && DECISIONS.has(cmd.action) && plainJson(cmd), 'INVALID_COMMAND', 'Malformed or stale command');
        required(!commandIds.has(cmd.commandId), 'DUPLICATE_COMMAND', 'Duplicate command in one transaction');
        commandIds.add(cmd.commandId);
        required(cmd.expectedDecisionRevision === expectedDecisionRevision, 'STALE_DECISION', 'Command revision mismatch');
        const source = opened.identities.get(cmd.occurrenceId);
        required(source === scopeId && !touched.has(cmd.occurrenceId), 'IDENTITY_CONFLICT', 'Duplicate/cross-source occurrence');
        touched.add(cmd.occurrenceId);
        const previous = next.commands[cmd.commandId];
        if (previous) {
          required(previous.payload === canonical(cmd), 'COMMAND_COLLISION', 'Reused commandId with different payload');
          results.push(copy(previous.result));
          continue;
        }
        required(before.revision === expectedDecisionRevision, 'STALE_DECISION', 'Optimistic revision conflict');
        const zero = cmd.action === 'set-zero-mass';
        const final = cmd.action === 'final-override' || zero;
        required(stage === (final ? 'Rigidmatch2' : 'RigidMatch1') || (stage === 'Rigidmatch2' && ['reject','defer'].includes(cmd.action)), 'STAGE_CONFLICT', 'Wrong stage/action');
        let value = null, evidence = [];
        if (cmd.action === 'accept-proposal') {
          const proposal = makeProposals(opened, cmd.occurrenceId).find((p) => p.proposalId === cmd.proposalId);
          required(proposal, 'STALE_PROPOSAL', 'Proposal missing from exact basis');
          required(proposal.qualified || (typeof cmd.reason === 'string' && cmd.reason.trim()),
            'UNQUALIFIED_PROPOSAL', 'Inferred or fallback proposal requires an explicit engineering review reason');
          value = proposal.value;
          evidence = proposal.evidenceRefs;
        } else if (zero) {
          required(cmd.unit === 'kg' && cmd.value === 0 &&
            cmd.zeroMassConfirmed === true &&
            typeof cmd.reason === 'string' &&
            cmd.reason.startsWith('Owner-confirmed explicit zero kg: '),
            'ZERO_WEIGHT_CONFIRMATION_REQUIRED',
            'Zero Final needs explicit owner confirmation; never use a Skip draft');
          value = 0;
          evidence = ['owner-confirmed-zero:' + cmd.commandId];
        } else if (cmd.action === 'enter-manual' || final) {
          required(cmd.unit === 'kg' && finitePositive(cmd.value), 'INVALID_WEIGHT', 'Explicit positive kg required');
          value = cmd.value;
          evidence = ['manual:' + cmd.commandId];
        }
        const existing = next.decisions[cmd.occurrenceId];
        required(!existing || existing.value === value || cmd.reason?.trim(), 'OVERWRITE_REQUIRES_REASON', 'Changing an accepted value requires an explicit reason');
        const status = ['reject'].includes(cmd.action) ? 'rejected' : (cmd.action === 'defer' ? 'deferred' : 'accepted');
        next.decisions[cmd.occurrenceId] = { state: status, value, unit: value === null ? null : 'kg', action: cmd.action, proposalId: cmd.proposalId || null, evidenceRefs: evidence, reason: cmd.reason || null };
        results.push({ commandId: cmd.commandId, basisId, scopeId, decisionRevision: '', state: status, provenance: evidence });
      }
      if (results.every((result) => before.commands[result.commandId])) return results;
      next.revision = (stage === 'Rigidmatch2' ? 'f' : 'm') + String(Number((before.revision || '').slice(1) || 0) + 1);
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i], result = results[i];
        if (before.commands[cmd.commandId]) continue;
        result.decisionRevision = next.revision;
        next.commands[cmd.commandId] = { payload: canonical(cmd), result: copy(result) };
      }
      ledger.set(slot(basisId, scopeId, stage), next);
      return copy(results);
    },
    freezeSnapshot({ basisId, scopeId, stage, expectedDecisionRevision }) {
      current(basisId); stageName(stage);
      const entry = state(basisId, scopeId, stage);
      required(stage !== 'preview' && expectedDecisionRevision === entry.revision, 'STALE_DECISION', 'Freeze current accepted review revision only');
      const snapshotRef = JSON.stringify([basisId, scopeId, stage, entry.revision || 'empty']);
      const snapshot = { snapshotRef, basisId, scopeId, stage, revision: entry.revision, decisions: copy(entry.decisions) };
      snapshots.set(snapshotRef, copy(snapshot));
      return copy(snapshot);
    },
    getSnapshot({ basisId, stage, revision, scopeId }) {
      current(basisId); stageName(stage);
      const found = [...snapshots.values()].filter((s) => s.basisId === basisId && s.stage === stage && (!scopeId || s.scopeId === scopeId) && (!revision || s.revision === revision));
      return copy(found);
    },
    async exportReviewState({ basisId }) {
      const opened = current(basisId);
      required(typeof digestReview === 'function', 'PERSISTENCE_UNAVAILABLE', 'Inject canonical SHA-256 digest adapter');
      const reviewStates = [];
      for (const scopeId of [...opened.sources].sort()) {
        for (const stage of ['RigidMatch1', 'Rigidmatch2']) {
          const entry = ledger.get(slot(basisId, scopeId, stage));
          if (entry) reviewStates.push({ scopeId, stage, ...copy(entry) });
        }
      }
      const frozenSnapshots = [...snapshots.values()].filter((s) => s.basisId === basisId)
        .sort((a, b) => a.snapshotRef.localeCompare(b.snapshotRef)).map(copy);
      const payload = { schemaVersion: WEIGHT_SCHEMA, basisId, reviewStates, frozenSnapshots };
      const contentSha256 = await digestReview(copy(payload));
      required(sha(contentSha256), 'INVALID_PERSISTENCE_HASH', 'Persisted reviews require canonical SHA-256');
      return { ...payload, contentSha256 };
    },
    async restoreReviewState({ basisId, payload }) {
      const opened = current(basisId);
      required(typeof digestReview === 'function', 'PERSISTENCE_UNAVAILABLE', 'Inject canonical SHA-256 digest adapter');
      required(plainJson(payload) && payload?.schemaVersion === WEIGHT_SCHEMA && payload.basisId === basisId
        && sha(payload.contentSha256) && Array.isArray(payload.reviewStates) && Array.isArray(payload.frozenSnapshots),
        'STALE_REVIEW', 'Invalid or cross-basis persisted review');
      const { contentSha256, ...envelope } = payload;
      const calculated = await digestReview(copy(envelope));
      required(sha(calculated) && contentSha256 === calculated, 'REVIEW_DIGEST_MISMATCH', 'Persisted reviews changed or are corrupted');
      const incomingLedger = new Map(), incomingSnapshots = new Map();
      for (const entry of payload.reviewStates) {
        const { scopeId, stage, revision, decisions, commands } = entry;
        required(opened.sources.has(scopeId) && stage !== 'preview' && STAGES.has(stage) && typeof decisions === 'object'
          && decisions !== null && !Array.isArray(decisions) && typeof commands === 'object' && commands !== null
          && !Array.isArray(commands) && (revision === null || (typeof revision === 'string' && revision.length)),
          'INVALID_REVIEW_STATE', 'Invalid source, stage, revision or persisted decision set');
        const id = slot(basisId, scopeId, stage);
        required(!incomingLedger.has(id), 'DUPLICATE_REVIEW_STATE', 'Duplicate source/stage review');
        required(revision !== null || (!Object.keys(decisions).length && !Object.keys(commands).length),
          'INVALID_REVIEW_STATE', 'Accepted commands require a decision revision');
        for (const [occurrenceId, decision] of Object.entries(decisions)) {
          required(opened.identities.get(occurrenceId) === scopeId && decision && ['accepted', 'rejected', 'deferred'].includes(decision.state)
            && (decision.value == null || finitePositive(decision.value) ||
              (decision.value === 0 && decision.action === 'set-zero-mass')) && Array.isArray(decision.evidenceRefs),
            'STALE_REVIEW_IDENTITY', 'Persisted decision does not match physical source occurrence');
          if (decision.state === 'accepted') {
            required((finitePositive(decision.value) ||
                (decision.action === 'set-zero-mass' && decision.value === 0 &&
                 typeof decision.reason === 'string' &&
                 decision.reason.startsWith('Owner-confirmed explicit zero kg: '))) &&
                decision.unit === 'kg', 'INVALID_REVIEW_WEIGHT', 'Accepted persisted mass must be positive kg or explicitly confirmed zero');
            if (decision.action === 'accept-proposal') {
              const currentProposal = makeProposals(opened, occurrenceId).find((p) => p.proposalId === decision.proposalId);
              required(currentProposal && currentProposal.value === decision.value, 'STALE_PROPOSAL', 'Persisted proposal no longer ranks on the pinned basis');
            }
          }
        }
        for (const [commandId, event] of Object.entries(commands)) {
          required(event && typeof event.payload === 'string' && event.result?.commandId === commandId, 'INVALID_REVIEW_COMMAND', 'Persisted command provenance malformed');
          let cmd;
          try { cmd = JSON.parse(event.payload); } catch { throw fault('INVALID_REVIEW_COMMAND', 'Malformed command payload'); }
          required(cmd.commandId === commandId && cmd.basisId === basisId && cmd.scopeId === scopeId
            && opened.identities.get(cmd.occurrenceId) === scopeId && event.payload === canonical(cmd),
            'INVALID_REVIEW_COMMAND', 'Replayed command does not match source or basis');
        }
        const currentState = ledger.get(id);
        required(!currentState || canonical(currentState) === canonical({ revision, decisions, commands }),
          'RESTORE_COLLISION', 'Restore cannot overwrite a live accepted decision');
        incomingLedger.set(id, copy({ revision, decisions, commands }));
      }
      for (const frozen of payload.frozenSnapshots) {
        required(frozen?.basisId === basisId && opened.sources.has(frozen.scopeId)
          && frozen.stage !== 'preview' && STAGES.has(frozen.stage)
          && frozen.snapshotRef === JSON.stringify([basisId, frozen.scopeId, frozen.stage, frozen.revision || 'empty'])
          && frozen.decisions && typeof frozen.decisions === 'object' && !Array.isArray(frozen.decisions),
          'INVALID_FROZEN_REVIEW', 'Invalid or cross-basis review freeze');
        required(!incomingSnapshots.has(frozen.snapshotRef), 'DUPLICATE_FROZEN_REVIEW', 'Repeated immutable snapshot');
        const importedState = incomingLedger.get(slot(basisId, frozen.scopeId, frozen.stage))
          || ledger.get(slot(basisId, frozen.scopeId, frozen.stage));
        required(importedState || (frozen.revision === null && !Object.keys(frozen.decisions).length),
          'SNAPSHOT_LEDGER_MISMATCH', 'Frozen review has no matching decision ledger');
        if (importedState?.revision === frozen.revision) {
          required(canonical(importedState.decisions) === canonical(frozen.decisions),
            'SNAPSHOT_LEDGER_MISMATCH', 'Frozen review disagrees with its accepted decision revision');
        }
        required(frozen.revision !== null || !Object.keys(frozen.decisions).length,
          'SNAPSHOT_LEDGER_MISMATCH', 'Empty revision cannot contain accepted decisions');
        const currentFrozen = snapshots.get(frozen.snapshotRef);
        required(!currentFrozen || canonical(currentFrozen) === canonical(frozen),
          'RESTORE_COLLISION', 'Cannot overwrite frozen accepted review');
        incomingSnapshots.set(frozen.snapshotRef, copy(frozen));
      }
      for (const [id, entry] of incomingLedger) ledger.set(id, entry);
      for (const [id, frozen] of incomingSnapshots) snapshots.set(id, frozen);
      return { basisId, restoredStages: incomingLedger.size, restoredSnapshots: incomingSnapshots.size };
    },
    verifyRun({ basisId, reviewedSnapshotIds, outputBasis }) {
      const opened = current(basisId);
      required(Array.isArray(reviewedSnapshotIds) && Array.isArray(outputBasis?.components), 'INVALID_RUN', 'Reviewed snapshots and output components required');
      const review = new Map();
      for (const id of reviewedSnapshotIds) {
        const frozen = snapshots.get(id);
        required(frozen && frozen.basisId === basisId, 'STALE_SNAPSHOT', 'Unknown frozen review');
        const currentDecision = state(basisId, frozen.scopeId, frozen.stage);
        required(currentDecision.revision === frozen.revision, 'STALE_SNAPSHOT', 'Review changed after freeze');
        required(canonical(currentDecision.decisions) === canonical(frozen.decisions),
          'SNAPSHOT_LEDGER_MISMATCH', 'Frozen decisions do not match accepted revision');
        review.set(frozen.scopeId + '|' + frozen.stage, frozen);
      }
      for (const sourceId of opened.sources) {
        for (const stage of ['RigidMatch1', 'Rigidmatch2']) {
          if (state(basisId, sourceId, stage).revision !== null) {
            required(review.has(sourceId + '|' + stage), 'MISSING_SNAPSHOT', 'Frozen review missing for ' + sourceId + ':' + stage);
          }
        }
      }
      const seen = new Set();
      for (const c of outputBasis.components) {
        required(!seen.has(keyOf(c)) && opened.identities.get(c.occurrenceId) === c.sourceId, 'IDENTITY_CONFLICT', 'Missing/duplicate source occurrence');
        seen.add(keyOf(c));
        const facts = opened.byOccurrence.get(keyOf(c)) || [];
        const source = facts.find((f) => f.fieldId === 'mass.kg' && f.authority === 'source' && finitePositive(f.value));
        const final = review.get(c.sourceId + '|Rigidmatch2')?.decisions[c.occurrenceId];
        const match1 = review.get(c.sourceId + '|RigidMatch1')?.decisions[c.occurrenceId];
        const accepted = final?.state === 'accepted' ? final.value : (match1?.state === 'accepted' ? match1.value : source?.value);
        required(finitePositive(accepted) ||
          (final?.state === 'accepted' && final.action === 'set-zero-mass' && accepted === 0),
          'UNRESOLVED_WEIGHT', 'No accepted engineering weight for ' + c.occurrenceId);
        required(Array.isArray(c.children) && c.children.length, 'INVALID_RUN', 'Physical component children required');
        const children = new Set();
        let total = 0;
        for (const child of c.children) {
          required(child.childId && !children.has(child.childId) && Number.isFinite(child.kg) && child.kg >= 0, 'INVALID_RUN', 'Duplicate/invalid split child');
          children.add(child.childId); total += child.kg;
        }
        required(Math.abs(total - accepted) <= Math.max(1e-6, accepted * 1e-9), 'MASS_NOT_CONSERVED', 'Split children do not conserve accepted kg');
        if (c.output) {
          required(finitePositive(c.output.scale) && c.output.unit && Number.isFinite(c.output.value), 'INVALID_CONVERSION', 'Explicit run-boundary transform required');
          required(Math.abs(c.output.value - total * c.output.scale) <= Math.max(1e-6, Math.abs(c.output.value) * 1e-9), 'DOUBLE_CONVERSION', 'Run-boundary conversion is not single-scale');
        }
      }
      for (const [identity, facts] of opened.byOccurrence) {
        if (facts.some((f) => f.subjectType === 'physical-component' || f.fieldId === 'mass.kg')) {
          required(seen.has(identity), 'INCOMPLETE_RUN', 'Required physical occurrence omitted from run');
        }
      }
      return { basisId, verified: true, componentCount: seen.size };
    },
  });
}
