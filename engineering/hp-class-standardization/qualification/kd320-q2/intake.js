import { evaluateKd320Q1ExitAttestation } from '../kd320-q1/formal-exit.js';

const TARGET = Object.freeze({
  b313Edition: '2024',
  viii3Edition: '2025',
  methodId: 'KD3-FATIGUE-001',
  routeId: 'ROUTE-KD3-2024',
});

const RECEIPT_IDS = Object.freeze(['Q1-SRC-B313-2024', 'Q1-SRC-VIII3-2025']);
const SEMANTIC_IDS = Object.freeze(Array.from({ length: 14 }, (_, i) =>
  `KD320-SEM-${String(i + 1).padStart(3, '0')}`));
const METHOD_SEMANTIC_IDS = Object.freeze(SEMANTIC_IDS.slice(1, 13));
const CHAIN_SEMANTIC_CUSTODY = Object.freeze({
  alternatingStressIntensityMpa: 'KD320-SEM-003',
  associatedMeanStressMpa: 'KD320-SEM-004',
  correctionParameters: 'KD320-SEM-006',
  equivalentAlternatingStressMpa: 'KD320-SEM-007',
  fatigueCurveSelection: 'KD320-SEM-008',
  fatigueCurveEvaluation: 'KD320-SEM-009',
  permissibleCycles: 'KD320-SEM-010',
  materialTemperatureSelection: 'KD320-SEM-011',
  applicabilityEnvelope: 'KD320-SEM-012',
  failClosedLimits: 'KD320-SEM-013',
});
const PUBLISHED_REQUIRED_RECEIPTS = Object.freeze(['Q1-SRC-VIII3-2025']);
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function identity(value) {
  return text(value).toLocaleLowerCase();
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function uniqueBy(items, key) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = text(item?.[key]);
    if (!id || map.has(id)) return null;
    map.set(id, item);
  }
  return map;
}

function validPair(a, b) {
  return Boolean(text(a) && text(b) && identity(a) !== identity(b));
}

function validTimestamp(value) {
  return ISO_RE.test(text(value));
}

function validateTarget(target, blockers) {
  for (const [key, expected] of Object.entries(TARGET)) {
    if (text(target?.[key]) !== expected) blockers.push(`TARGET_${key.toUpperCase()}_MISMATCH`);
  }
}

function validateAuthority(authority, blockers) {
  const forbidden = ['nativeCoreKd3Qualified', 'codeCompliance', 'canUseForDesignAuthority',
    'productionKernelAllowed', 'automaticPromotionAllowed'];
  if (forbidden.some((key) => authority?.[key] === true)) blockers.push('AUTHORITY_PROMOTION_PROHIBITED');
}

function receiptReady(receipt, blockers) {
  const prefix = text(receipt?.receiptId) || 'UNKNOWN_RECEIPT';
  let ready = true;
  const require = (condition, code) => {
    if (!condition) { blockers.push(`${prefix}:${code}`); ready = false; }
  };
  require(text(receipt?.status) === 'VERIFIED', 'STATUS_NOT_VERIFIED');
  require(Boolean(text(receipt?.secureStorageRef)), 'SECURE_STORAGE_REF_MISSING');
  require(SHA256_RE.test(text(receipt?.documentSha256)), 'DOCUMENT_SHA256_INVALID');
  require(Array.isArray(receipt?.exactLocators) && receipt.exactLocators.length > 0
    && receipt.exactLocators.every((v) => Boolean(text(v))), 'EXACT_LOCATORS_MISSING');
  require(Boolean(text(receipt?.verifiedBy)) && validTimestamp(receipt?.verifiedAt),
    'VERIFIER_CUSTODY_INCOMPLETE');
  require(validPair(receipt?.verifiedBy, receipt?.independentCheckBy)
    && validTimestamp(receipt?.independentCheckedAt), 'INDEPENDENT_RECEIPT_CHECK_MISSING');
  return ready;
}

function semanticReady(item, blockers) {
  const id = text(item?.semanticId) || 'UNKNOWN_SEMANTIC';
  let ready = true;
  const require = (condition, code) => {
    if (!condition) { blockers.push(`${id}:${code}`); ready = false; }
  };
  require(text(item?.status) === 'INDEPENDENTLY_CHECKED', 'STATUS_NOT_INDEPENDENTLY_CHECKED');
  require(RECEIPT_IDS.includes(text(item?.controlledSourceRef)), 'CONTROLLED_SOURCE_REF_INVALID');
  require(Boolean(text(item?.exactSourceLocator)), 'EXACT_SOURCE_LOCATOR_MISSING');
  require(Boolean(text(item?.controlledSemanticRef)), 'CONTROLLED_SEMANTIC_REF_MISSING');
  for (const field of ['units', 'signConvention', 'selectionRule', 'interpolationRule', 'applicabilityRule']) {
    require(Boolean(text(item?.[field])), `${field.toUpperCase()}_MISSING`);
  }
  require(Boolean(text(item?.extractedBy)) && validTimestamp(item?.extractedAt),
    'EXTRACTOR_CUSTODY_INCOMPLETE');
  require(validPair(item?.extractedBy, item?.independentCheckBy)
    && validTimestamp(item?.independentCheckedAt), 'INDEPENDENT_SEMANTIC_CHECK_MISSING');
  return ready;
}

function semanticSetReady(refs, required, prefix, blockers) {
  const supplied = new Set(Array.isArray(refs) ? refs.map(text).filter(Boolean) : []);
  const missing = required.filter((id) => !supplied.has(id));
  if (missing.length) blockers.push(`${prefix}:SEMANTIC_REFS_INCOMPLETE:${missing.join(',')}`);
  const invalid = [...supplied].filter((id) => !SEMANTIC_IDS.includes(id));
  if (invalid.length) blockers.push(`${prefix}:SEMANTIC_REFS_INVALID:${invalid.join(',')}`);
  return missing.length === 0 && invalid.length === 0;
}

function receiptSetReady(refs, required, prefix, blockers) {
  const supplied = new Set(Array.isArray(refs) ? refs.map(text).filter(Boolean) : []);
  const missing = required.filter((id) => !supplied.has(id));
  if (missing.length) blockers.push(`${prefix}:SOURCE_RECEIPT_REFS_INCOMPLETE:${missing.join(',')}`);
  const invalid = [...supplied].filter((id) => !RECEIPT_IDS.includes(id));
  if (invalid.length) blockers.push(`${prefix}:SOURCE_RECEIPT_REFS_INVALID:${invalid.join(',')}`);
  return missing.length === 0 && invalid.length === 0;
}

function validateChain(chain, prefix, blockers, semanticRefs) {
  let ready = semanticSetReady(semanticRefs, Object.values(CHAIN_SEMANTIC_CUSTODY), prefix, blockers);
  const require = (condition, code) => {
    if (!condition) { blockers.push(`${prefix}:${code}`); ready = false; }
  };
  require(finite(chain?.alternatingStressIntensityMpa) && chain.alternatingStressIntensityMpa > 0,
    'SALT_INVALID');
  require(finite(chain?.associatedMeanStressMpa), 'MEAN_STRESS_INVALID');
  require(Array.isArray(chain?.correctionParameters) && chain.correctionParameters.length > 0,
    'CORRECTION_PARAMETERS_MISSING');
  for (const parameter of chain?.correctionParameters || []) {
    require(Boolean(text(parameter?.name)) && finite(parameter?.value)
      && Boolean(text(parameter?.units)) && METHOD_SEMANTIC_IDS.includes(text(parameter?.semanticRef)),
    'CORRECTION_PARAMETER_INVALID');
  }
  require(finite(chain?.equivalentAlternatingStressMpa) && chain.equivalentAlternatingStressMpa > 0,
    'SEQ_INVALID');
  require(finite(chain?.permissibleCycles) && chain.permissibleCycles > 0, 'N_INVALID');
  return ready;
}

function projectOracleReady(oracle, blockers) {
  if (!oracle) { blockers.push('PROJECT_ORACLE_MISSING'); return false; }
  const refsReady = semanticSetReady(
    oracle.semanticRefs, METHOD_SEMANTIC_IDS, 'PROJECT_ORACLE', blockers);
  let ready = validateChain(oracle.chain, 'PROJECT_ORACLE', blockers, oracle.semanticRefs) && refsReady;
  const require = (condition, code) => {
    if (!condition) { blockers.push(`PROJECT_ORACLE:${code}`); ready = false; }
  };
  require(text(oracle.benchmarkId) === 'KD3-QF-023', 'BENCHMARK_ID_INVALID');
  require(text(oracle.evidenceClass) === 'INDEPENDENT_CHECKED_PROJECT_CALCULATION',
    'EVIDENCE_CLASS_INVALID');
  require(text(oracle.methodId) === TARGET.methodId && text(oracle.routeId) === TARGET.routeId,
    'METHOD_ROUTE_MISMATCH');
  require(Boolean(text(oracle.calculationRef)), 'CALCULATION_REF_MISSING');
  require(Boolean(text(oracle.locationId)), 'LOCATION_ID_MISSING');
  require(text(oracle.b313Edition) === TARGET.b313Edition
    && text(oracle.viii3Edition) === TARGET.viii3Edition, 'EDITION_MISMATCH');
  require(validPair(oracle.calculatedBy, oracle.checkedBy)
    && validTimestamp(oracle.calculatedAt) && validTimestamp(oracle.checkedAt),
    'INDEPENDENT_CHECK_CUSTODY_MISSING');
  require(receiptSetReady(
    oracle.controlledSourceReceiptRefs, RECEIPT_IDS, 'PROJECT_ORACLE', blockers),
  'SOURCE_RECEIPT_REFS_INCOMPLETE');
  return ready;
}

function publishedOracleReady(oracle, blockers) {
  if (!oracle) { blockers.push('PRIMARY_PUBLISHED_ORACLE_MISSING'); return false; }
  const refsReady = semanticSetReady(
    oracle.semanticRefs, METHOD_SEMANTIC_IDS, 'PRIMARY_PUBLISHED_ORACLE', blockers);
  let ready = validateChain(
    oracle.chain, 'PRIMARY_PUBLISHED_ORACLE', blockers, oracle.semanticRefs) && refsReady;
  const require = (condition, code) => {
    if (!condition) { blockers.push(`PRIMARY_PUBLISHED_ORACLE:${code}`); ready = false; }
  };
  require(text(oracle.benchmarkId) === 'KD3-QF-022', 'BENCHMARK_ID_INVALID');
  require(text(oracle.evidenceClass) === 'PRIMARY_PUBLISHED_NUMERICAL_ORACLE',
    'EVIDENCE_CLASS_INVALID');
  require(text(oracle.viii3Edition) === TARGET.viii3Edition
    && text(oracle.methodId) === TARGET.methodId, 'METHOD_EDITION_MISMATCH');
  require(Boolean(text(oracle.bibliographicRef)), 'BIBLIOGRAPHIC_REF_MISSING');
  require(Boolean(text(oracle.exactLocator)), 'EXACT_LOCATOR_MISSING');
  require(SHA256_RE.test(text(oracle.sourceSha256)), 'SOURCE_SHA256_INVALID');
  require(validPair(oracle.extractedBy, oracle.admittedBy)
    && validTimestamp(oracle.extractedAt) && validTimestamp(oracle.admittedAt),
    'INDEPENDENT_ADMISSION_CUSTODY_MISSING');
  require(receiptSetReady(
    oracle.controlledSourceReceiptRefs, PUBLISHED_REQUIRED_RECEIPTS,
    'PRIMARY_PUBLISHED_ORACLE', blockers), 'SOURCE_RECEIPT_REFS_INCOMPLETE');
  return ready;
}

export function evaluateKd320Q2AdmissionCandidate(candidate = {}) {
  const blockers = [];
  if (text(candidate.schema) !== 'kd320-q2-admission-candidate/v1') blockers.push('SCHEMA_INVALID');
  validateTarget(candidate.target, blockers);
  validateAuthority(candidate.authority, blockers);

  const receiptMap = uniqueBy(candidate.sourceReceipts, 'receiptId');
  if (!receiptMap) blockers.push('SOURCE_RECEIPTS_DUPLICATE_OR_INVALID');
  if (receiptMap && (receiptMap.size !== RECEIPT_IDS.length
    || !RECEIPT_IDS.every((id) => receiptMap.has(id)))) blockers.push('SOURCE_RECEIPT_SET_MISMATCH');
  const receiptChecks = receiptMap && receiptMap.size === RECEIPT_IDS.length
    && RECEIPT_IDS.every((id) => receiptMap.has(id))
    ? RECEIPT_IDS.map((id) => receiptReady(receiptMap.get(id), blockers))
    : [];
  const receiptsComplete = receiptChecks.length === RECEIPT_IDS.length
    && receiptChecks.every(Boolean);

  const semanticMap = uniqueBy(candidate.semanticItems, 'semanticId');
  if (!semanticMap) blockers.push('SEMANTIC_ITEMS_DUPLICATE_OR_INVALID');
  if (semanticMap && (semanticMap.size !== SEMANTIC_IDS.length
    || !SEMANTIC_IDS.every((id) => semanticMap.has(id)))) blockers.push('SEMANTIC_ITEM_SET_MISMATCH');
  const semanticChecks = semanticMap && semanticMap.size === SEMANTIC_IDS.length
    && SEMANTIC_IDS.every((id) => semanticMap.has(id))
    ? SEMANTIC_IDS.map((id) => semanticReady(semanticMap.get(id), blockers))
    : [];
  const semanticsComplete = semanticChecks.length === SEMANTIC_IDS.length
    && semanticChecks.every(Boolean);

  const q1Exit = evaluateKd320Q1ExitAttestation(candidate.q1ExitAttestation, {
    sourceReceipts: candidate.sourceReceipts,
    semanticItems: candidate.semanticItems,
  });
  blockers.push(...q1Exit.blockers);
  const q1Complete = receiptsComplete && semanticsComplete && q1Exit.ready;
  const projectReady = (candidate.projectOracle || q1Complete)
    ? projectOracleReady(candidate.projectOracle, blockers) : false;
  const primaryReady = (candidate.publishedOracle || q1Complete)
    ? publishedOracleReady(candidate.publishedOracle, blockers) : false;

  let state = 'Q1_CONTROLLED_EVIDENCE_PENDING';
  if (q1Complete && projectReady && primaryReady) state = 'Q2_ORACLE_ADMISSION_READY';
  else if (q1Complete && projectReady) state = 'Q2_PROJECT_ORACLE_RETAINED_PRIMARY_PENDING';
  else if (q1Complete && primaryReady) state = 'Q2_PRIMARY_ORACLE_RETAINED_PROJECT_PENDING';
  else if (q1Complete) state = 'Q1_COMPLETE_Q2_ORACLE_PENDING';

  const structuralBlockers = blockers.filter((code) =>
    code === 'SCHEMA_INVALID' || code.startsWith('TARGET_') || code === 'AUTHORITY_PROMOTION_PROHIBITED'
    || code.includes('DUPLICATE_OR_INVALID') || code.endsWith('_SET_MISMATCH'));
  return {
    ok: structuralBlockers.length === 0,
    state,
    q1Complete,
    q2OracleAdmissionReady: state === 'Q2_ORACLE_ADMISSION_READY',
    blockers: [...new Set(blockers)],
    q1Exit,
    oracleCustody: {
      methodSemanticRefs: [...METHOD_SEMANTIC_IDS],
      chainSemanticCustody: { ...CHAIN_SEMANTIC_CUSTODY },
      publishedRequiredReceiptRefs: [...PUBLISHED_REQUIRED_RECEIPTS],
    },
    authority: {
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
    nextStage: state === 'Q2_ORACLE_ADMISSION_READY'
      ? 'Q3_ISOLATED_NATIVE_KERNEL_IMPLEMENTATION_CANDIDATE'
      : 'COMPLETE_CONTROLLED_EVIDENCE_AND_ORACLE_CUSTODY',
  };
}

export const KD320_Q2_TARGET = TARGET;
export const KD320_Q2_REQUIRED_RECEIPTS = RECEIPT_IDS;
export const KD320_Q2_REQUIRED_SEMANTICS = SEMANTIC_IDS;
export const KD320_Q2_METHOD_SEMANTICS = METHOD_SEMANTIC_IDS;
export const KD320_Q2_CHAIN_SEMANTIC_CUSTODY = CHAIN_SEMANTIC_CUSTODY;
export const KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS = PUBLISHED_REQUIRED_RECEIPTS;
