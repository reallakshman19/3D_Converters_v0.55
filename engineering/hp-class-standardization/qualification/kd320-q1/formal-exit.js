export const KD320_Q1_EXIT_ATTESTATION_SCHEMA = 'kd320-q1-exit-attestation/v1';
export const KD320_Q1_EXIT_RECORD_ID = 'VR-B313-CH9-KD320-NATIVE-001-Q1';
export const KD320_Q1_EXIT_STATUS = 'Q1_COMPLETE_Q2_ORACLE_POPULATION_ALLOWED';
export const KD320_Q1_EXIT_EVIDENCE_REFS = Object.freeze([
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08',
]);
export const KD320_Q1_EXIT_GATE_REFS = Object.freeze(['G0', 'G1']);

const RECEIPT_IDS = Object.freeze(['Q1-SRC-B313-2024', 'Q1-SRC-VIII3-2025']);
const SEMANTIC_IDS = Object.freeze(Array.from({ length: 14 }, (_, index) =>
  `KD320-SEM-${String(index + 1).padStart(3, '0')}`));
const EXPECTED_SOURCE = Object.freeze(Object.fromEntries(
  SEMANTIC_IDS.map((id, index) => [
    id, index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
  ]),
));
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
  productionKernelAllowed: false,
  automaticPromotionAllowed: false,
});

function text(value) { return String(value ?? '').trim(); }
function identity(value) { return text(value).toLowerCase(); }
function validTimestamp(value) { return ISO.test(text(value)); }
function distinct(a, b) { return Boolean(text(a) && text(b) && identity(a) !== identity(b)); }

function mapBy(items, key) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = text(item?.[key]);
    if (!id || map.has(id)) return null;
    map.set(id, item);
  }
  return map;
}

function exactSet(values, expected, prefix, blockers) {
  const supplied = Array.isArray(values) ? values.map(text).filter(Boolean) : [];
  if (new Set(supplied).size !== supplied.length) blockers.push(`${prefix}_DUPLICATE`);
  const missing = expected.filter((id) => !supplied.includes(id));
  const unknown = supplied.filter((id) => !expected.includes(id));
  if (missing.length) blockers.push(`${prefix}_MISSING:${missing.join(',')}`);
  if (unknown.length) blockers.push(`${prefix}_UNKNOWN:${unknown.join(',')}`);
  return supplied.length === expected.length && !missing.length && !unknown.length
    && new Set(supplied).size === supplied.length;
}

function authorityReady(authority, blockers) {
  const invalid = Object.entries(AUTHORITY_FALSE)
    .some(([key, expected]) => authority?.[key] !== expected);
  if (invalid) blockers.push('Q1_EXIT_AUTHORITY_MUST_REMAIN_FALSE');
  return !invalid;
}

function receiptBindingsReady(attestation, sourceReceipts, blockers) {
  const candidate = mapBy(sourceReceipts, 'receiptId');
  const bound = mapBy(attestation?.sourceReceipts, 'receiptId');
  if (!candidate || !bound) {
    blockers.push('Q1_EXIT_RECEIPT_BINDINGS_DUPLICATE_OR_INVALID');
    return false;
  }
  let ready = exactSet([...bound.keys()], RECEIPT_IDS, 'Q1_EXIT_RECEIPT_BINDINGS', blockers);
  for (const id of RECEIPT_IDS) {
    const expected = candidate.get(id);
    const actual = bound.get(id);
    if (!expected || !actual || !SHA256.test(text(actual.documentSha256))
      || text(actual.documentSha256) !== text(expected.documentSha256)) {
      blockers.push(`Q1_EXIT_RECEIPT_HASH_MISMATCH:${id}`);
      ready = false;
    }
  }
  return ready;
}

function semanticBindingsReady(attestation, semanticItems, blockers) {
  const candidate = mapBy(semanticItems, 'semanticId');
  const bound = mapBy(attestation?.semanticBindings, 'semanticId');
  if (!candidate || !bound) {
    blockers.push('Q1_EXIT_SEMANTIC_BINDINGS_DUPLICATE_OR_INVALID');
    return false;
  }
  let ready = exactSet([...bound.keys()], SEMANTIC_IDS, 'Q1_EXIT_SEMANTIC_BINDINGS', blockers);
  for (const id of SEMANTIC_IDS) {
    const expected = candidate.get(id);
    const actual = bound.get(id);
    const source = EXPECTED_SOURCE[id];
    const same = expected && actual
      && text(expected.controlledSourceRef) === source
      && text(actual.controlledSourceRef) === source
      && text(actual.exactSourceLocator) === text(expected.exactSourceLocator)
      && text(actual.controlledSemanticRef) === text(expected.controlledSemanticRef)
      && text(actual.exactSourceLocator)
      && text(actual.controlledSemanticRef);
    if (!same) {
      blockers.push(`Q1_EXIT_SEMANTIC_BINDING_MISMATCH:${id}`);
      ready = false;
    }
  }
  return ready;
}

function markStructuralFailure(blockers) {
  const fixed = new Set([
    'Q1_EXIT_SCHEMA_INVALID',
    'Q1_EXIT_RECORD_ID_INVALID',
    'Q1_EXIT_AUTHORITY_MUST_REMAIN_FALSE',
  ]);
  const structural = blockers.some((code) => fixed.has(code)
    || code.endsWith('_DUPLICATE') || code.includes('DUPLICATE_OR_INVALID'));
  if (structural) blockers.push('Q1_EXIT_STRUCTURE_DUPLICATE_OR_INVALID');
}

export function evaluateKd320Q1ExitAttestation(
  attestation,
  { sourceReceipts = [], semanticItems = [] } = {},
) {
  const blockers = [];
  if (!attestation) {
    return { ready: false, blockers: ['Q1_EXIT_ATTESTATION_MISSING'], authority: { ...AUTHORITY_FALSE } };
  }

  if (text(attestation.schema) !== KD320_Q1_EXIT_ATTESTATION_SCHEMA) blockers.push('Q1_EXIT_SCHEMA_INVALID');
  if (text(attestation.recordId) !== KD320_Q1_EXIT_RECORD_ID) blockers.push('Q1_EXIT_RECORD_ID_INVALID');
  if (text(attestation.status) !== KD320_Q1_EXIT_STATUS) blockers.push('Q1_EXIT_STATUS_NOT_COMPLETE');
  if (!text(attestation.controlledEvidenceLedgerRef)) blockers.push('Q1_EXIT_EVIDENCE_LEDGER_REF_MISSING');
  if (!SHA256.test(text(attestation.controlledEvidenceLedgerSha256))) blockers.push('Q1_EXIT_EVIDENCE_LEDGER_SHA256_INVALID');
  if (!text(attestation.q1AuditReportRef)) blockers.push('Q1_EXIT_AUDIT_REPORT_REF_MISSING');
  if (!SHA256.test(text(attestation.q1AuditReportSha256))) blockers.push('Q1_EXIT_AUDIT_REPORT_SHA256_INVALID');

  exactSet(attestation.evidencePassRefs, KD320_Q1_EXIT_EVIDENCE_REFS, 'Q1_EXIT_EVIDENCE_REFS', blockers);
  exactSet(attestation.gatePassRefs, KD320_Q1_EXIT_GATE_REFS, 'Q1_EXIT_GATE_REFS', blockers);
  receiptBindingsReady(attestation, sourceReceipts, blockers);
  semanticBindingsReady(attestation, semanticItems, blockers);
  authorityReady(attestation.authority, blockers);

  if (!text(attestation.attestedBy) || !validTimestamp(attestation.attestedAt)) {
    blockers.push('Q1_EXIT_ATTESTOR_CUSTODY_INCOMPLETE');
  }
  if (!distinct(attestation.attestedBy, attestation.independentCheckBy)
    || !validTimestamp(attestation.independentCheckedAt)) {
    blockers.push('Q1_EXIT_INDEPENDENT_CHECK_CUSTODY_INCOMPLETE');
  }
  markStructuralFailure(blockers);

  return {
    ready: blockers.length === 0,
    blockers: [...new Set(blockers)],
    recordId: text(attestation.recordId) || null,
    status: text(attestation.status) || null,
    authority: { ...AUTHORITY_FALSE },
  };
}

export const KD320_Q1_EXIT_AUTHORITY = AUTHORITY_FALSE;
