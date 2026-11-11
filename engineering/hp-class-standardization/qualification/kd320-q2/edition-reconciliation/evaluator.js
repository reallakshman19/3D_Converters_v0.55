export const KD320_EDITION_RECONCILIATION_SCHEMA = 'kd320-edition-reconciliation-candidate/v1';

const TARGET = Object.freeze({
  referenceId: 'PVP2025-154710',
  sourceCodeEdition: '2023',
  targetCodeEdition: '2025',
  methodId: 'KD3-FATIGUE-001',
  benchmarkId: 'KD3-QF-022',
  controlledSourceRef: 'Q1-SRC-VIII3-2025',
});

const SEMANTIC_IDS = Object.freeze(Array.from({ length: 12 }, (_, i) =>
  `KD320-SEM-${String(i + 2).padStart(3, '0')}`));
const ALLOWED_COMPARISONS = new Set([
  'IDENTICAL',
  'EQUIVALENT_WITH_NON_NUMERICAL_EDITORIAL_CHANGE',
  'CHANGED_REQUIRES_NEW_ORACLE',
  'NOT_COMPARABLE',
  'PENDING_CONTROLLED_2025_SOURCE',
]);
const READY_COMPARISONS = new Set([
  'IDENTICAL',
  'EQUIVALENT_WITH_NON_NUMERICAL_EDITORIAL_CHANGE',
]);
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function text(value) { return String(value ?? '').trim(); }
function identity(value) { return text(value).toLowerCase(); }
function validTimestamp(value) { return ISO.test(text(value)); }
function distinct(a, b) { return Boolean(text(a) && text(b) && identity(a) !== identity(b)); }

function uniqueBy(items, key) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = text(item?.[key]);
    if (!id || map.has(id)) return null;
    map.set(id, item);
  }
  return map;
}

function validateAuthority(authority, structural) {
  for (const key of [
    'targetQf022Ready', 'q2OracleAdmissionReady', 'nativeCoreKd3Qualified',
    'codeCompliance', 'canUseForDesignAuthority', 'productionKernelAllowed',
    'automaticPromotionAllowed',
  ]) {
    if (authority?.[key] !== false) structural.push(`AUTHORITY_${key}_MUST_REMAIN_FALSE`);
  }
}

function validateTarget(target, structural) {
  for (const [key, expected] of Object.entries(TARGET)) {
    if (text(target?.[key]) !== expected) structural.push(`TARGET_${key.toUpperCase()}_MISMATCH`);
  }
}

function evaluateRow(row, blockers, changed) {
  const id = text(row?.semanticId) || 'UNKNOWN_SEMANTIC';
  const comparison = text(row?.comparisonStatus);
  let ready = true;
  const require = (condition, code) => {
    if (!condition) { blockers.push(`${id}:${code}`); ready = false; }
  };
  require(text(row?.sourceEdition) === '2023', 'SOURCE_EDITION_MUST_BE_2023');
  require(text(row?.targetEdition) === '2025', 'TARGET_EDITION_MUST_BE_2025');
  require(Boolean(text(row?.sourceLocator)), 'SOURCE_LOCATOR_MISSING');
  require(Boolean(text(row?.targetControlledLocator)), 'TARGET_CONTROLLED_LOCATOR_MISSING');
  require(Boolean(text(row?.controlledSemanticRef)), 'CONTROLLED_SEMANTIC_REF_MISSING');
  require(ALLOWED_COMPARISONS.has(comparison), 'COMPARISON_STATUS_INVALID');
  require(Boolean(text(row?.comparedBy)) && validTimestamp(row?.comparedAt), 'COMPARATOR_CUSTODY_INCOMPLETE');
  require(distinct(row?.comparedBy, row?.independentCheckBy)
    && validTimestamp(row?.independentCheckedAt), 'INDEPENDENT_CHECK_CUSTODY_INCOMPLETE');
  if (comparison === 'CHANGED_REQUIRES_NEW_ORACLE' || comparison === 'NOT_COMPARABLE') changed.push(id);
  if (!READY_COMPARISONS.has(comparison)) ready = false;
  return ready;
}

export function evaluateKd320EditionReconciliation(candidate = {}) {
  const structural = [];
  const blockers = [];
  const changedSemantics = [];
  if (text(candidate.schema) !== KD320_EDITION_RECONCILIATION_SCHEMA) structural.push('SCHEMA_INVALID');
  validateTarget(candidate.target, structural);
  validateAuthority(candidate.authority, structural);

  const paperHashReady = SHA256.test(text(candidate.sourceEvidence?.paperSha256));
  if (!paperHashReady) blockers.push('PUBLISHED_PAPER_SHA256_PENDING');
  if (!text(candidate.sourceEvidence?.bibliographicRef)) blockers.push('PUBLISHED_PAPER_BIBLIOGRAPHIC_REF_MISSING');
  if (!text(candidate.sourceEvidence?.exactLocator)) blockers.push('PUBLISHED_PAPER_EXACT_LOCATOR_MISSING');
  if (text(candidate.sourceEvidence?.sourceCodeEdition) !== '2023') structural.push('SOURCE_EVIDENCE_EDITION_MUST_BE_2023');

  const controlledHashReady = SHA256.test(text(candidate.targetEvidence?.documentSha256));
  if (!controlledHashReady) blockers.push('CONTROLLED_2025_DOCUMENT_SHA256_PENDING');
  if (text(candidate.targetEvidence?.controlledSourceRef) !== TARGET.controlledSourceRef) {
    structural.push('TARGET_CONTROLLED_SOURCE_REF_MISMATCH');
  }
  if (!text(candidate.targetEvidence?.secureStorageRef)) blockers.push('CONTROLLED_2025_SECURE_STORAGE_REF_MISSING');

  const rows = uniqueBy(candidate.semanticReconciliation, 'semanticId');
  if (!rows) structural.push('SEMANTIC_ROWS_DUPLICATE_OR_INVALID');
  if (rows && (rows.size !== SEMANTIC_IDS.length || !SEMANTIC_IDS.every((id) => rows.has(id)))) {
    structural.push('SEMANTIC_ROW_SET_MISMATCH');
  }

  const rowReadiness = [];
  if (rows) {
    for (const id of SEMANTIC_IDS) {
      if (rows.has(id)) rowReadiness.push(evaluateRow(rows.get(id), blockers, changedSemantics));
    }
  }
  const allRowsReady = rows?.size === SEMANTIC_IDS.length
    && rowReadiness.length === SEMANTIC_IDS.length
    && rowReadiness.every(Boolean);

  let state = 'CONTROLLED_2025_RECONCILIATION_PENDING';
  if (changedSemantics.length) state = 'CONTROLLED_2025_RECONCILIATION_CHANGED_NEW_ORACLE_REQUIRED';
  else if (!structural.length && paperHashReady && controlledHashReady && allRowsReady) {
    state = 'EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION';
  }

  return {
    ok: structural.length === 0,
    structuralErrors: [...new Set(structural)],
    blockers: [...new Set(blockers)],
    changedSemantics: [...new Set(changedSemantics)],
    state,
    editionReconciliationReady: state === 'EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION',
    targetQf022Ready: false,
    authority: {
      q2OracleAdmissionReady: false,
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
    nextAction: state === 'EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION'
      ? 'SUBMIT_RECONCILED_PUBLISHED_ORACLE_THROUGH_Q2_ADMISSION'
      : (changedSemantics.length ? 'OBTAIN_NEW_TARGET_2025_ORACLE' : 'COMPLETE_CONTROLLED_2025_RECONCILIATION'),
  };
}

export const KD320_EDITION_RECONCILIATION_TARGET = TARGET;
export const KD320_EDITION_RECONCILIATION_SEMANTICS = SEMANTIC_IDS;
