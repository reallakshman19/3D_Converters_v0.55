import {
  VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY,
  createVibrationAssessmentEvidenceBasis,
  createVibrationAssessmentEvidenceLedger,
  createVibrationAssessmentEvidenceReceipt,
  createVibrationAssessmentEvidenceError,
} from './assessment-evidence.js';

export const VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_SCHEMA = 'VibrationAssessmentEvidenceCurrentness.v1';
export const VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_CURRENTNESS_SCHEMA = 'VibrationAssessmentEvidenceLedgerCurrentness.v1';
export const VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_STATES = Object.freeze([
  'BASIS_UNAVAILABLE', 'EVIDENCE_CURRENT', 'STALE_EVIDENCE',
]);

export const VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY = Object.freeze({
  authority: 'ASSESSMENT_EVIDENCE_FRESHNESS_ONLY',
  createsCurrentEngineeringResult: false,
  promotesReceiptAuthority: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const COMPARISONS = Object.freeze([
  ['methodId', 'METHOD_ID_CHANGED'],
  ['methodRevision', 'METHOD_REVISION_CHANGED'],
  ['qualificationRevision', 'QUALIFICATION_REVISION_CHANGED'],
  ['methodDefinitionHash', 'METHOD_DEFINITION_CHANGED'],
  ['engineeringInputsHash', 'ENGINEERING_INPUTS_CHANGED'],
  ['sourceBasisHash', 'SOURCE_BASIS_CHANGED'],
]);

function staleReasons(receiptBasis, currentBasis) {
  return COMPARISONS
    .filter(([field]) => receiptBasis[field] !== currentBasis[field])
    .map(([, reason]) => reason);
}

export function evaluateVibrationAssessmentEvidenceCurrentness({ receipt, currentBasis = null } = {}) {
  const normalizedReceipt = createVibrationAssessmentEvidenceReceipt(receipt);
  if (currentBasis == null) {
    return deepFreeze({
      schema: VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_SCHEMA,
      receiptId: normalizedReceipt.receiptId,
      assessmentItemId: normalizedReceipt.assessmentItemId,
      state: 'BASIS_UNAVAILABLE',
      reasons: ['CURRENT_BASIS_UNAVAILABLE'],
      receiptAuthority: VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY,
      authority: VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY,
    });
  }
  const normalizedBasis = createVibrationAssessmentEvidenceBasis(currentBasis);
  const reasons = staleReasons(normalizedReceipt.basis, normalizedBasis);
  return deepFreeze({
    schema: VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_SCHEMA,
    receiptId: normalizedReceipt.receiptId,
    assessmentItemId: normalizedReceipt.assessmentItemId,
    state: reasons.length ? 'STALE_EVIDENCE' : 'EVIDENCE_CURRENT',
    reasons,
    receiptAuthority: VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY,
    authority: VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY,
  });
}

function basisMap(value) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createVibrationAssessmentEvidenceError('VIBRATION_ASSESSMENT_EVIDENCE_BASIS_MAP_INVALID', 'currentBasisByAssessmentItemId must be an object map.');
  }
  return value;
}

function countStates(results) {
  const counts = { BASIS_UNAVAILABLE: 0, EVIDENCE_CURRENT: 0, STALE_EVIDENCE: 0 };
  for (const result of results) counts[result.state] += 1;
  return Object.freeze(counts);
}

export function evaluateVibrationAssessmentEvidenceLedgerCurrentness({ ledger, currentBasisByAssessmentItemId = {} } = {}) {
  const normalizedLedger = createVibrationAssessmentEvidenceLedger(ledger);
  const basisByItem = basisMap(currentBasisByAssessmentItemId);
  const results = normalizedLedger.receipts.map((receipt) => evaluateVibrationAssessmentEvidenceCurrentness({
    receipt,
    currentBasis: basisByItem[receipt.assessmentItemId] ?? null,
  }));
  return deepFreeze({
    schema: VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_CURRENTNESS_SCHEMA,
    receiptCount: results.length,
    countsByState: countStates(results),
    results,
    authority: VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY,
  });
}
