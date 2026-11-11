// Fail-closed production-bound GC-PW Weight consumer. No XML, DOM, storage or transport.
import { createWeightReviewService } from './weight-facts-review-service.js';

function custodyError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  throw error;
}
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
function exactKeys(actual, required, label) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    custodyError('CUSTODY_MISSING', label + ' requires explicit source-bound records');
  }
  if (Object.keys(actual).length !== required.length ||
      required.some(key => !Object.hasOwn(actual, key))) {
    custodyError('CUSTODY_SCOPE_MISMATCH', label + ' differs from selected InputBasis');
  }
}
async function assertHash(content, expected, digestUtf8, label) {
  if (typeof content !== 'string' || !sha(expected)) {
    custodyError('CUSTODY_MISSING', label + ' content and SHA-256 are required');
  }
  const actual = await digestUtf8(content);
  if (!sha(actual) || actual.toLowerCase() !== expected.toLowerCase()) {
    custodyError('INPUT_DIGEST_MISMATCH', label + ' changed after InputBasis was frozen');
  }
}
function checkPhysicalPopulation(basis, facts, expected) {
  const sourceIds = basis.sourceRefs.map(ref => ref.sourceId);
  exactKeys(expected, sourceIds, 'Selected physical occurrences');
  const found = new Map(sourceIds.map(sourceId => [sourceId, new Set()]));
  for (const fact of facts) {
    if (fact.extensions?.adapter === 'legacy-read-only' ||
        fact.diagnostics?.some(d => /legacy-row-order identity/i.test(d))) {
      custodyError('LEGACY_ONLY_FACT', 'Untrusted row-index/legacy facts cannot become accepted reviews');
    }
    if (fact.subjectType !== 'physical-component') continue;
    if (!found.has(fact.sourceId) || !fact.occurrenceId) {
      custodyError('CUSTODY_SCOPE_MISMATCH', 'Physical component claims an unknown source');
    }
    found.get(fact.sourceId).add(fact.occurrenceId);
  }
  for (const sourceId of sourceIds) {
    const expectedIds = expected[sourceId];
    if (!Array.isArray(expectedIds) || expectedIds.some(id => typeof id !== 'string' || !id)) {
      custodyError('CUSTODY_MISSING', 'Authoritative original occurrence IDs are required for ' + sourceId);
    }
    const allow = new Set(expectedIds);
    if (allow.size !== expectedIds.length || allow.size !== found.get(sourceId).size ||
        [...found.get(sourceId)].some(id => !allow.has(id))) {
      custodyError('POPULATION_MISMATCH', 'Missing/extra/duplicate selected physical component: ' + sourceId);
    }
  }
}
export async function assertWeightInputCustody(basis, facts, custody, digests) {
  const { digestUtf8, digestCanonical } = digests || {};
  if (typeof digestUtf8 !== 'function' || typeof digestCanonical !== 'function') {
    custodyError('CRYPTO_UNAVAILABLE', 'Inject GC-PW SHA256 and canonical JSON digest functions');
  }
  if (!basis || typeof basis !== 'object' || !sha(basis.basisId) || !Array.isArray(facts)) {
    custodyError('CUSTODY_MISSING', 'Immutable InputBasis and FactRecords are required');
  }
  const { basisId, ...body } = basis;
  const computed = await digestCanonical(body);
  if (!sha(computed) || computed.toLowerCase() !== basisId.toLowerCase()) {
    custodyError('BASIS_DIGEST_MISMATCH', 'InputBasis id is not canonical SHA256 of its entire body');
  }
  const sourceIds = basis.sourceRefs.map(ref => ref.sourceId);
  exactKeys(custody?.sourceTexts, sourceIds, 'Source content');
  const masters = Object.keys(basis.masters || {});
  exactKeys(custody?.masters, masters, 'Master content');
  for (const ref of basis.sourceRefs) {
    await assertHash(custody.sourceTexts[ref.sourceId], ref.sha256, digestUtf8,
      'source:' + ref.sourceId);
  }
  await assertHash(custody?.selectionText, basis.selectionSha256, digestUtf8, 'selection');
  if (basis.stagedSourceSha256 === null) {
    if (custody?.stagedSourceText !== null) {
      custodyError('CUSTODY_MISSING', 'Absent staged source must be explicitly null');
    }
  } else {
    await assertHash(custody?.stagedSourceText, basis.stagedSourceSha256, digestUtf8, 'staged');
  }
  await assertHash(custody?.configText, basis.configSha256, digestUtf8, 'config');
  await assertHash(custody?.overridesText, basis.overridesSha256, digestUtf8, 'overrides');
  for (const [name, ref] of Object.entries(basis.masters || {})) {
    await assertHash(custody.masters[name]?.datasetText, ref.sha256, digestUtf8, 'master:' + name);
    await assertHash(custody.masters[name]?.mappingText, ref.mappingSha256, digestUtf8, 'mapping:' + name);
  }
  checkPhysicalPopulation(basis, facts, custody?.occurrenceIdsBySource);
  return { basisId, sourceCount: sourceIds.length, masterCount: masters.length,
    physicalCount: Object.values(custody.occurrenceIdsBySource).reduce((sum, ids) => sum + ids.length, 0) };
}
// This wrapper withholds the mock-only openBasis/openBasisJob bypasses.
// The #999 integrator supplies authoritative bytes/store leases and occurrence custody.
export function createAttestedWeightReviewService({ score, digestReview, digestUtf8, digestCanonical } = {}) {
  const core = createWeightReviewService({ score, digestReview });
  const { openBasis: _unsafe, openBasisJob: _unsafeJob,
    subscribeJob: _unsafeSubscribe, awaitJob: _unsafeAwait,
    cancelJob: _unsafeCancel, ...safe } = core;
  const jobs = new Map(), latestByBasis = new Map();
  const eventFor = job => {
    const { requestId, basisId, stage, completed, total, event, error } = job;
    return { requestId, basisId, stage, completed, total, event,
      ...(error ? { error: { ...error } } : {}) };
  };
  const isStale = job => job.cancelled || latestByBasis.get(job.basisId) !== job.requestId;
  const cancelled = job => { job.cancelled = true; job.event = 'cancelled'; return eventFor(job); };
  const api = {
    ...safe,
    async openBasis(basis, { facts, custody } = {}) {
      const attestation = await assertWeightInputCustody(basis, facts, custody,
        { digestUtf8, digestCanonical });
      const result = core.openBasis(basis, { facts });
      return { ...result, attestation };
    },
    openBasisJob(basis, { requestId, loadFacts } = {}) {
      if (typeof requestId !== 'string' || !requestId || typeof loadFacts !== 'function') {
        custodyError('INVALID_JOB', 'Unique requestId and fact/custody loader required');
      }
      if (jobs.has(requestId)) custodyError('JOB_COLLISION', 'Cannot reuse an attested requestId');
      const job = { requestId, basisId: basis?.basisId, stage: 'facts',
        completed: 0, total: null, event: 'progress', cancelled: false };
      if (!sha(job.basisId)) custodyError('INVALID_JOB', 'Job InputBasis must identify a SHA-256 revision');
      const previous = latestByBasis.get(job.basisId);
      if (previous && jobs.has(previous) && jobs.get(previous).event === 'progress') {
        cancelled(jobs.get(previous)); // superseded worker result is never authoritative
      }
      latestByBasis.set(job.basisId, requestId);
      jobs.set(requestId, job);
      const report = (completed, total) => {
        if (isStale(job) || job.event !== 'progress') return;
        if (Number.isSafeInteger(completed) && completed >= job.completed) job.completed = completed;
        if (Number.isSafeInteger(total) && total >= job.completed) job.total = total;
      };
      job.completion = Promise.resolve().then(async () => {
        if (isStale(job)) return eventFor(job);
        const output = await loadFacts({
          basis, requestId, report, isCancelled: () => isStale(job),
        });
        if (isStale(job)) return cancelled(job);
        const attestation = await assertWeightInputCustody(basis, output?.facts,
          output?.custody, { digestUtf8, digestCanonical });
        if (isStale(job)) return cancelled(job);
        core.openBasis(basis, { facts: output.facts });
        job.completed = attestation.physicalCount;
        job.total = attestation.physicalCount;
        job.event = 'completed';
        return eventFor(job);
      }).catch(error => {
        if (isStale(job)) return cancelled(job);
        job.event = 'failed';
        job.error = { code: error?.code || 'FACT_LOAD_FAILED',
          message: String(error?.message || error), retryable: false, stage: 'facts' };
        return eventFor(job);
      });
      return { requestId, basisId: job.basisId };
    },
    subscribeJob(requestId) {
      const job = jobs.get(requestId);
      if (!job) custodyError('UNKNOWN_JOB', 'Unknown attested Weight job');
      return eventFor(job);
    },
    async awaitJob(requestId) {
      const job = jobs.get(requestId);
      if (!job) custodyError('UNKNOWN_JOB', 'Unknown attested Weight job');
      await job.completion;
      return eventFor(job);
    },
    cancelJob(requestId) {
      const job = jobs.get(requestId);
      if (!job) custodyError('UNKNOWN_JOB', 'Unknown attested Weight job');
      if (job.event === 'progress') cancelled(job);
      return eventFor(job);
    },
  };
  return Object.freeze(api);
}
