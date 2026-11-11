// GC-PW/1.0 A3-U1: lossless, domain-neutral source-occurrence -> consumer facts seam.
// This adapter DOES NOT implement a Preview producer, Weight scorer or review commit.
import {
  SCHEMA_VERSION, ContractError, canonicalJson, digestCanonical,
  assertBasisDigest, assertContentDigest, validateBasisRef,
  validateFactRecord, assertCompletePopulation,
} from './contract.mjs';

export class OccurrenceBridgeError extends Error {
  constructor(code, detail) {
    super(code + ': ' + detail);
    this.name = 'OccurrenceBridgeError';
    this.code = code;
  }
}
function reject(code, detail) { throw new OccurrenceBridgeError(code, detail); }
function required(ok, code, detail) { if (!ok) reject(code, detail); }
function nonempty(v, path) {
  required(typeof v === 'string' && v.trim() !== '', 'REQUIRED_STRING', path);
  return v;
}
function ordinal(v, path) {
  required(Number.isSafeInteger(v) && v >= 0, 'INVALID_SOURCE_ORDINAL', path);
  return v;
}
function sourceIndex(basis) {
  validateBasisRef(basis);
  return new Map(basis.sourceRefs.map(x => [x.sourceId, x]));
}
function record(v, path) {
  required(v !== null && typeof v === 'object' && !Array.isArray(v), 'REQUIRED_RECORD', path);
  return v;
}
function cloneAndFreeze(v) {
  const c = JSON.parse(canonicalJson(v));
  function freeze(x) {
    if (x && typeof x === 'object') {
      for (const child of Object.values(x)) freeze(child);
      Object.freeze(x);
    }
    return x;
  }
  return freeze(c);
}

// Exactly the stable public format exported by Agent-P PreviewBasis@a028b357.
// A physical occurrence MUST have both original source ordinals and its own
// explicit component signature. No branch-name/NodeNumber or row-index alias.
export function physicalOccurrenceId({ sourceId, branchOccurrenceIndex, nodeOrdinal, componentSignature }) {
  nonempty(sourceId, 'sourceId');
  ordinal(branchOccurrenceIndex, 'branchOccurrenceIndex');
  ordinal(nodeOrdinal, 'nodeOrdinal');
  nonempty(componentSignature, 'componentSignature');
  return JSON.stringify([sourceId, branchOccurrenceIndex, nodeOrdinal, componentSignature]);
}

export function decodePhysicalOccurrenceId(value) {
  nonempty(value, 'occurrenceId');
  let data;
  try { data = JSON.parse(value); } catch { reject('NONCANONICAL_OCCURRENCE', value); }
  required(Array.isArray(data) && data.length === 4, 'NONCANONICAL_OCCURRENCE', value);
  const [sourceId, branchOccurrenceIndex, nodeOrdinal, componentSignature] = data;
  const encoded = physicalOccurrenceId({ sourceId, branchOccurrenceIndex, nodeOrdinal, componentSignature });
  required(encoded === value, 'NONCANONICAL_OCCURRENCE', value);
  return cloneAndFreeze({ sourceId, branchOccurrenceIndex, nodeOrdinal, componentSignature, occurrenceId: encoded });
}

// Full byte/content attestation is separate from the public BasisRef shape.
// All mandatory live inputs are checked, including same-count changed masters.
export async function attestLiveBasis({ basis, sources, masters, selection, stagedSource, config, overrides }) {
  await assertBasisDigest(basis);
  record(sources, 'sources');
  record(masters, 'masters');
  required(Array.isArray(selection), 'MISSING_SELECTION', 'selection');
  required(Object.keys(sources).length === basis.sourceRefs.length, 'SOURCE_SET_DRIFT', 'sources');
  required(Object.keys(masters).length === Object.keys(basis.masters).length, 'MASTER_SET_DRIFT', 'masters');
  for (const ref of basis.sourceRefs) {
    required(Object.hasOwn(sources, ref.sourceId), 'MISSING_SOURCE', ref.sourceId);
    await assertContentDigest(sources[ref.sourceId], ref.sha256);
  }
  for (const [key, ref] of Object.entries(basis.masters)) {
    const actual = record(masters[key], 'masters.' + key);
    required(actual.datasetId === ref.datasetId && actual.revision === ref.revision,
      'MASTER_REVISION_DRIFT', key);
    required(Array.isArray(actual.rows) && actual.rows.length === ref.rowCount,
      'MASTER_CARDINALITY_DRIFT', key);
    required(await digestCanonical(actual.rows) === ref.sha256, 'MASTER_CONTENT_DRIFT', key);
    required(await digestCanonical(actual.mapping ?? null) === ref.mappingSha256,
      'MASTER_MAPPING_DRIFT', key);
  }
  required(canonicalJson(selection) === canonicalJson(basis.scope), 'SELECTION_DRIFT', 'scope');
  required(await digestCanonical(selection) === basis.selectionSha256, 'SELECTION_DIGEST_DRIFT', 'scope');
  required(stagedSource === null || typeof stagedSource === 'string', 'INVALID_STAGED_SOURCE', 'stagedSource');
  if (basis.stagedSourceSha256 === null) {
    required(stagedSource === null, 'STAGED_SOURCE_DRIFT', 'unexpected staged source');
  } else {
    required(typeof stagedSource === 'string', 'STAGED_SOURCE_DRIFT', 'missing staged source');
    await assertContentDigest(stagedSource, basis.stagedSourceSha256);
  }
  required(await digestCanonical(config ?? null) === basis.configSha256, 'CONFIG_DRIFT', 'config');
  required(await digestCanonical(overrides ?? null) === basis.overridesSha256, 'OVERRIDE_DRIFT', 'overrides');
  return basis.basisId;
}
function originalKey(row) {
  nonempty(row.sourceId, 'sourceId');
  return JSON.stringify([row.sourceId, ordinal(row.branchOccurrenceIndex, 'branchOccurrenceIndex'),
    ordinal(row.nodeOrdinal, 'nodeOrdinal')]);
}

// Expected original population and physical selections are independently
// enumerated *before* reading derived FactRecord pages. Never calculate the
// expected count or membership from rendered rows or final CII output.
export async function verifyPhysicalFactPages({
  basis, live, originalOccurrences, expectedOriginalCount,
  physicalOccurrences, requiredFieldIds, expectedSubjectType, pages,
}) {
  // Fail-closed: cannot project facts unless actual live bytes match this basis.
  // The immutable BasisRef is caller-independent; reject a shadow basis payload.
  const supplied = record(live, 'live');
  required(!Object.hasOwn(supplied, 'basis'), 'LIVE_BASIS_INJECTION', 'live.basis');
  await attestLiveBasis({ ...supplied, basis });
  nonempty(expectedSubjectType, 'expectedSubjectType');
  const sources = sourceIndex(basis);
  ordinal(expectedOriginalCount, 'expectedOriginalCount');
  required(Array.isArray(originalOccurrences) && originalOccurrences.length === expectedOriginalCount,
    'ORIGINAL_POPULATION_MISMATCH', 'expected independently enumerated original source nodes');
  required(Array.isArray(physicalOccurrences), 'MISSING_PHYSICAL_POPULATION', 'physicalOccurrences');
  required(Array.isArray(requiredFieldIds) && requiredFieldIds.length > 0,
    'MISSING_REQUIRED_FIELDS', 'requiredFieldIds');
  const fields = new Set(requiredFieldIds.map(x => nonempty(x, 'requiredFieldId')));
  required(fields.size === requiredFieldIds.length, 'DUPLICATE_REQUIRED_FIELD', 'requiredFieldIds');
  const original = new Set();
  for (const row of originalOccurrences) {
    record(row, 'originalOccurrences[]');
    required(sources.has(row.sourceId), 'UNKNOWN_ORIGINAL_SOURCE', row.sourceId);
    const key = originalKey(row);
    required(!original.has(key), 'DUPLICATE_ORIGINAL_OCCURRENCE', key);
    original.add(key);
  }
  const physical = new Map();
  for (const row of physicalOccurrences) {
    record(row, 'physicalOccurrences[]');
    required(sources.has(row.sourceId), 'UNKNOWN_PHYSICAL_SOURCE', row.sourceId);
    required(original.has(originalKey(row)), 'PHYSICAL_ORIGINAL_NOT_FOUND', canonicalJson(row));
    // Prevent a weak legacy alias such as sourceId/branch:1/physical:7:
    const occurrenceId = physicalOccurrenceId(row);
    required(!row.occurrenceId || row.occurrenceId === occurrenceId,
      'PHYSICAL_ID_DRIFT', occurrenceId);
    required(!physical.has(occurrenceId), 'DUPLICATE_PHYSICAL_OCCURRENCE', occurrenceId);
    physical.set(occurrenceId, row.sourceId);
  }
  const expectedFacts = physical.size * fields.size;
  required(expectedFacts > 0, 'EMPTY_FACT_EXPECTATION', 'physicalOccurrences');
  assertCompletePopulation(
    pages, basis.basisId,
    item => canonicalJson([item?.sourceId, item?.occurrenceId, item?.subjectType, item?.fieldId]),
    expectedFacts,
  );
  const observed = new Set();
  const records = [];
  for (const page of pages) {
    for (const item of page.items) {
      validateFactRecord(item, basis.basisId);
      required(item.domainId === basis.domainId, 'CROSS_DOMAIN_FACT', item.fieldId);
      required(item.subjectType === expectedSubjectType, 'WRONG_FACT_SUBJECT', item.subjectType);
      const decoded = decodePhysicalOccurrenceId(item.occurrenceId);
      required(decoded.sourceId === item.sourceId &&
        physical.get(item.occurrenceId) === item.sourceId, 'UNKNOWN_FACT_OCCURRENCE', item.occurrenceId);
      required(fields.has(item.fieldId), 'UNEXPECTED_FACT_FIELD', item.fieldId);
      required(item.provenance.some(x => x.sourceRef === item.sourceId),
        'MISSING_SOURCE_PROVENANCE', item.occurrenceId);
      const id = canonicalJson([item.sourceId, item.occurrenceId, item.fieldId]);
      required(!observed.has(id), 'DUPLICATE_FACT', id);
      observed.add(id);
      records.push(item);
    }
  }
  for (const id of physical.keys()) {
    for (const field of fields) {
      const key = canonicalJson([physical.get(id), id, field]);
      required(observed.has(key), 'MISSING_REQUIRED_FACT', key);
    }
  }
  return cloneAndFreeze({
    schemaVersion: SCHEMA_VERSION, basisId: basis.basisId, domainId: basis.domainId,
    verifiedOriginalCount: original.size, verifiedPhysicalCount: physical.size,
    verifiedFactCount: records.length, factRecords: records,
  });
}

// Read-only consumer view; never creates DecisionCommand or accepted mass.
export function toWeightFacts(projection) {
  record(projection, 'projection');
  required(projection.schemaVersion === SCHEMA_VERSION && Array.isArray(projection.factRecords),
    'INVALID_PROJECTION', 'projection');
  for (const fact of projection.factRecords) validateFactRecord(fact, projection.basisId);
  return cloneAndFreeze(projection.factRecords);
}
