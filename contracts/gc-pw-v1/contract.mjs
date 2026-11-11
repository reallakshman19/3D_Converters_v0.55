// GC-PW/1.0 candidate conformance layer. No browser UI, XML or transport imports.
// See docs/architecture/gc-pw-v1.md and 3D_Converters issue #999.
export const SCHEMA_VERSION = 'gc-pw/1.0';
const HEX256 = /^[a-f0-9]{64}$/i;
const AUTHORITY = new Set(['source', 'exact-master', 'derived', 'proposed', 'manual', 'unresolved', 'conflict']);
const STAGES = new Set(['preview', 'RigidMatch1', 'Rigidmatch2']);
const ACTIONS = new Set(['accept-proposal', 'enter-manual', 'reject', 'defer', 'final-override', 'set-zero-mass']);
const EVENTS = new Set(['progress', 'completed', 'failed', 'cancelled']);
export class ContractError extends Error {
  constructor(code, path) {
    super(code + ' at ' + path);
    this.name = 'ContractError';
    this.code = code;
    this.path = path;
  }
}
const reject = (code, path) => { throw new ContractError(code, path); };
const record = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    reject('OBJECT_REQUIRED', path);
  }
  return value;
};
const str = (v, path) => {
  if (typeof v !== 'string' || !v.trim()) reject('STRING_REQUIRED', path);
};
const sha = (v, path) => {
  if (typeof v !== 'string' || !HEX256.test(v)) reject('SHA256_REQUIRED', path);
};
const integer = (v, path) => {
  if (!Number.isSafeInteger(v) || v < 0) reject('NONNEGATIVE_INTEGER_REQUIRED', path);
};
const arr = (v, path) => { if (!Array.isArray(v)) reject('ARRAY_REQUIRED', path); };
const checkVersion = (v) => {
  record(v, '$');
  if (v.schemaVersion !== SCHEMA_VERSION) reject('UNSUPPORTED_SCHEMA_VERSION', '$.schemaVersion');
};
export function canonicalJson(value) {
  const seen = new Set();
  function visit(v, path) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) reject('NONFINITE_NUMBER', path);
      return v;
    }
    if (Array.isArray(v)) {
      if (seen.has(v)) reject('CYCLIC_INPUT', path);
      seen.add(v);
      const out = Array.from({ length: v.length }, (_, i) => {
        if (!(i in v)) reject('SPARSE_ARRAY', path + '[' + i + ']');
        return visit(v[i], path + '[' + i + ']');
      });
      seen.delete(v);
      return out;
    }
    record(v, path);
    if (seen.has(v)) reject('CYCLIC_INPUT', path);
    seen.add(v);
    const out = {};
    for (const key of Object.keys(v).sort()) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') reject('UNSAFE_KEY', path + '.' + key);
      out[key] = visit(v[key], path + '.' + key);
    }
    seen.delete(v);
    return out;
  }
  return JSON.stringify(visit(value, '$'));
}
export async function digestUtf8(content) {
  if (typeof content !== 'string') reject('TEXT_CONTENT_REQUIRED', '$.content');
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') reject('CRYPTO_UNAVAILABLE', '$');
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function digestCanonical(value) {
  return digestUtf8(canonicalJson(value));
}
export async function assertContentDigest(content, expectedSha256) {
  sha(expectedSha256, '$.expectedSha256');
  if (await digestUtf8(content) !== expectedSha256) reject('CONTENT_DIGEST_MISMATCH', '$.expectedSha256');
  return expectedSha256;
}
export async function makeBasisRef(input) {
  record(input, '$');
  if (input.schemaVersion !== undefined && input.schemaVersion !== SCHEMA_VERSION) {
    reject('UNSUPPORTED_SCHEMA_VERSION', '$.schemaVersion');
  }
  const value = { ...input, schemaVersion: SCHEMA_VERSION };
  delete value.basisId;
  const basisId = await digestCanonical(value);
  const result = { ...value, basisId };
  validateBasisRef(result);
  return result;
}
export function validateBasisRef(value) {
  checkVersion(value);
  str(value.domainId, '$.domainId'); sha(value.basisId, '$.basisId');
  arr(value.sourceRefs, '$.sourceRefs');
  if (!value.sourceRefs.length) reject('EMPTY_SOURCE_SET', '$.sourceRefs');
  const sources = new Set();
  value.sourceRefs.forEach((entry, i) => {
    const p = '$.sourceRefs[' + i + ']'; record(entry, p);
    str(entry.sourceId, p + '.sourceId'); sha(entry.sha256, p + '.sha256'); str(entry.mediaType, p + '.mediaType');
    if (sources.has(entry.sourceId)) reject('DUPLICATE_SOURCE', p + '.sourceId');
    sources.add(entry.sourceId);
  });
  sha(value.selectionSha256, '$.selectionSha256');
  if (value.stagedSourceSha256 !== null) sha(value.stagedSourceSha256, '$.stagedSourceSha256');
  record(value.masters, '$.masters');
  for (const [name, entry] of Object.entries(value.masters)) {
    str(name, '$.masters key');
    const p = '$.masters.' + name; record(entry, p);
    str(entry.datasetId, p + '.datasetId');
    if (!(typeof entry.revision === 'string' && entry.revision.trim()) &&
        !(Number.isSafeInteger(entry.revision) && entry.revision >= 0)) reject('INVALID_REVISION', p + '.revision');
    sha(entry.sha256, p + '.sha256'); sha(entry.mappingSha256, p + '.mappingSha256');
    integer(entry.rowCount, p + '.rowCount');
  }
  sha(value.configSha256, '$.configSha256'); sha(value.overridesSha256, '$.overridesSha256');
  arr(value.scope, '$.scope');
  if (!value.scope.length) reject('EMPTY_SELECTION_SCOPE', '$.scope');
  const unique = new Set();
  value.scope.forEach((entry, i) => {
    const p = '$.scope[' + i + ']'; record(entry, p);
    str(entry.sourceId, p + '.sourceId'); str(entry.selectionRef, p + '.selectionRef');
    if (!sources.has(entry.sourceId)) reject('UNKNOWN_SOURCE', p + '.sourceId');
    const key = JSON.stringify([entry.sourceId, entry.selectionRef]);
    if (unique.has(key)) reject('DUPLICATE_SCOPE', p);
    unique.add(key);
  });
  canonicalJson(value);
  return value;
}
export async function assertBasisDigest(basis) {
  validateBasisRef(basis);
  const { basisId, ...body } = basis;
  if (await digestCanonical(body) !== basisId) reject('STALE_BASIS', '$.basisId');
  return basis;
}
export function validateFactRecord(value, basisId) {
  checkVersion(value);
  str(value.domainId, '$.domainId'); sha(value.basisId, '$.basisId');
  if (basisId && value.basisId !== basisId) reject('CROSS_BASIS_FACT', '$.basisId');
  for (const field of ['subjectType','sourceId','occurrenceId','fieldId']) str(value[field], '$.' + field);
  if (!AUTHORITY.has(value.authority)) reject('INVALID_AUTHORITY', '$.authority');
  if (value.unit !== undefined && value.unit !== null) str(value.unit, '$.unit');
  arr(value.provenance, '$.provenance'); arr(value.diagnostics, '$.diagnostics');
  value.provenance.forEach((entry, i) => {
    const p = '$.provenance[' + i + ']'; record(entry, p); str(entry.sourceRef, p + '.sourceRef');
  });
  value.diagnostics.forEach((v, i) => str(v, '$.diagnostics[' + i + ']'));
  if ((value.authority === 'unresolved' || value.authority === 'conflict') && value.value !== null) {
    reject('UNRESOLVED_MUST_BE_NULL', '$.value');
  }
  if (value.extensions !== undefined) record(value.extensions, '$.extensions');
  canonicalJson(value);
  return value;
}
export function validateProposal(value, basisId) {
  record(value, '$');
  for (const field of ['basisId','occurrenceId','proposalId','domainId','method','scoringRevision']) str(value[field], '$.' + field);
  sha(value.basisId, '$.basisId');
  if (basisId && value.basisId !== basisId) reject('CROSS_BASIS_PROPOSAL', '$.basisId');
  if (!Number.isFinite(value.value) || value.value <= 0) reject('INVALID_PROPOSAL_VALUE', '$.value');
  str(value.unit, '$.unit'); integer(value.ranking, '$.ranking');
  if (typeof value.qualified !== 'boolean') reject('INVALID_QUALIFICATION', '$.qualified');
  arr(value.eligibilityReasons, '$.eligibilityReasons'); arr(value.evidenceRefs, '$.evidenceRefs');
  value.eligibilityReasons.forEach((v, i) => str(v, '$.eligibilityReasons[' + i + ']'));
  value.evidenceRefs.forEach((v, i) => str(v, '$.evidenceRefs[' + i + ']'));
  canonicalJson(value);
  return value;
}
export function validateDecisionCommand(value) {
  record(value, '$');
  for (const field of ['commandId','basisId','scopeId','occurrenceId']) str(value[field], '$.' + field);
  sha(value.basisId, '$.basisId');
  if (value.expectedDecisionRevision !== null) str(value.expectedDecisionRevision, '$.expectedDecisionRevision');
  if (!ACTIONS.has(value.action)) reject('INVALID_ACTION', '$.action');
  if (value.action === 'accept-proposal') str(value.proposalId, '$.proposalId');
  if (value.action === 'enter-manual' || value.action === 'final-override') {
    if (!Number.isFinite(value.value) || value.value <= 0) reject('INVALID_MANUAL_VALUE', '$.value');
    str(value.unit, '$.unit');
  }
  if (value.action === 'set-zero-mass') {
    if (value.value !== 0 || value.unit !== 'kg' ||
        value.zeroMassConfirmed !== true ||
        typeof value.reason !== 'string' ||
        !value.reason.startsWith('Owner-confirmed explicit zero kg: '))
      reject('ZERO_WEIGHT_CONFIRMATION_REQUIRED', '$.value');
  }
  canonicalJson(value);
  return value;
}
export function validateDecisionBatch(commands, basisId, scopeId) {
  arr(commands, '$.commands');
  if (!commands.length) reject('EMPTY_DECISION_BATCH', '$.commands');
  const commandIds = new Set(), occurrences = new Set();
  for (const [i, cmd] of commands.entries()) {
    validateDecisionCommand(cmd);
    if (cmd.basisId !== basisId) reject('CROSS_BASIS_DECISION', '$.commands[' + i + ']');
    if (cmd.scopeId !== scopeId) reject('CROSS_SCOPE_DECISION', '$.commands[' + i + ']');
    if (commandIds.has(cmd.commandId)) reject('DUPLICATE_COMMAND', '$.commands[' + i + ']');
    if (occurrences.has(cmd.occurrenceId)) reject('DUPLICATE_OCCURRENCE_DECISION', '$.commands[' + i + ']');
    commandIds.add(cmd.commandId); occurrences.add(cmd.occurrenceId);
  }
  return commands;
}
export function validatePage(value, basisId) {
  checkVersion(value);
  sha(value.basisId, '$.basisId');
  if (basisId && value.basisId !== basisId) reject('CROSS_BASIS_PAGE', '$.basisId');
  arr(value.items, '$.items'); integer(value.totalCount, '$.totalCount');
  if (value.items.length > value.totalCount) reject('PAGE_OVERFLOW', '$.items');
  if (value.nextCursor !== null) str(value.nextCursor, '$.nextCursor');
  if (typeof value.complete !== 'boolean') reject('INVALID_COMPLETENESS', '$.complete');
  canonicalJson(value);
  return value;
}
// A renderer's last visible page is NOT evidence of a complete selected source population.
export function assertCompletePopulation(pages, basisId, identity, expectedTotalCount) {
  arr(pages, '$.pages');
  integer(expectedTotalCount, '$.expectedTotalCount');
  if (typeof identity !== 'function') reject('IDENTITY_FN_REQUIRED', '$.identity');
  if (!pages.length) reject('NO_PAGES', '$.pages');
  let total = null, read = 0;
  const cursors = new Set(), ids = new Set();
  for (const [i, page] of pages.entries()) {
    validatePage(page, basisId);
    if (!page.complete) reject('INCOMPLETE_BASIS', '$.pages[' + i + ']');
    if (total === null) total = page.totalCount;
    if (total !== page.totalCount) reject('CHANGED_TOTAL', '$.pages[' + i + ']');
    if (i < pages.length - 1 && page.nextCursor === null) reject('EARLY_TERMINAL_PAGE', '$.pages[' + i + ']');
    if (i === pages.length - 1 && page.nextCursor !== null) reject('TRUNCATED_POPULATION', '$.pages[' + i + ']');
    if (page.nextCursor !== null && cursors.has(page.nextCursor)) reject('REUSED_CURSOR', '$.pages[' + i + ']');
    if (page.nextCursor !== null) cursors.add(page.nextCursor);
    for (const item of page.items) {
      const key = identity(item);
      str(key, '$.identity');
      if (ids.has(key)) reject('DUPLICATE_RESULT_IDENTITY', '$.pages[' + i + ']');
      ids.add(key);
    }
    read += page.items.length;
  }
  if (read !== total) reject('INCOMPLETE_POPULATION', '$.pages');
  if (total !== expectedTotalCount) reject('SOURCE_POPULATION_MISMATCH', '$.expectedTotalCount');
  return { basisId, totalCount: total, verifiedCount: read };
}
export function validateJobEvent(value, basisId) {
  record(value, '$');
  str(value.requestId, '$.requestId'); sha(value.basisId, '$.basisId'); str(value.stage, '$.stage');
  if (basisId && basisId !== value.basisId) reject('STALE_JOB', '$.basisId');
  if (!EVENTS.has(value.event)) reject('INVALID_EVENT', '$.event');
  integer(value.completed, '$.completed');
  if (value.total !== null) {
    integer(value.total, '$.total');
    if (value.completed > value.total) reject('PROGRESS_OVERFLOW', '$.completed');
  }
  if (value.event === 'completed' && (value.total === null || value.completed !== value.total)) reject('FALSE_JOB_COMPLETION', '$.completed');
  if (value.event === 'failed') {
    record(value.error, '$.error'); str(value.error.code, '$.error.code');
    str(value.error.message, '$.error.message'); str(value.error.stage, '$.error.stage');
    if (typeof value.error.retryable !== 'boolean') reject('INVALID_RETRYABILITY', '$.error.retryable');
  }
  canonicalJson(value);
  return value;
}
export function validateSnapshotRef(value, basisId) {
  record(value, '$');
  str(value.snapshotId, '$.snapshotId'); sha(value.basisId, '$.basisId');
  if (basisId && value.basisId !== basisId) reject('CROSS_BASIS_SNAPSHOT', '$.basisId');
  if (!STAGES.has(value.stage)) reject('INVALID_FREEZE_STAGE', '$.stage');
  sha(value.contentSha256, '$.contentSha256'); str(value.revision, '$.revision');
  canonicalJson(value);
  return value;
}
