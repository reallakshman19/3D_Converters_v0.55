import { VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA } from '../mechanisms/contracts.js';

export const VIBRATION_ASSESSMENT_EVIDENCE_RECEIPT_SCHEMA = 'VibrationAssessmentEvidenceReceipt.v1';
export const VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_SCHEMA = 'VibrationAssessmentEvidenceLedger.v1';

export const VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY = Object.freeze({
  authority: 'ASSESSMENT_RESULT_EVIDENCE_ONLY',
  createsCurrentEngineeringResult: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function evidenceError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationAssessmentEvidenceError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_TEXT_REQUIRED', `${field} must be non-empty text.`, { field });
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  return text(value, field);
}

function canonicalHash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_HASH_REQUIRED', `${field} must be a canonical sha256 hash.`, { field });
  }
  return value;
}

function timestamp(value, field) {
  const normalized = text(value, field);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_TIME_INVALID', `${field} must be an ISO-compatible timestamp.`, { field });
  }
  return normalized;
}

function cloneJson(value, field) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_PAYLOAD_INVALID', `${field} contains a non-finite number.`, { field });
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => cloneJson(item, `${field}[${index}]`));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_PAYLOAD_INVALID', `${field} must contain JSON-safe values only.`, { field });
  }
  const copy = {};
  for (const [key, child] of Object.entries(value)) copy[key] = cloneJson(child, `${field}.${key}`);
  return copy;
}

function scopeValue(value = {}) {
  return {
    line: text(value.line, 'scope.line'),
    caseId: value.caseId == null ? null : text(value.caseId, 'scope.caseId'),
    canonicalId: text(value.canonicalId, 'scope.canonicalId'),
  };
}

function authoritySnapshot(value = {}) {
  if (value.designAuthority !== false || value.rootCauseAuthority !== false || value.codeCompliance !== false) {
    throw evidenceError(
      'VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_SNAPSHOT_UNSUPPORTED',
      'Assessment evidence v1 only accepts non-design, non-root-cause, non-code-compliance calculation snapshots.',
    );
  }
  return {
    qualificationEffective: text(value.qualificationEffective, 'authorityAtCalculation.qualificationEffective'),
    engineeringAuthority: text(value.engineeringAuthority, 'authorityAtCalculation.engineeringAuthority'),
    screeningAuthority: text(value.screeningAuthority, 'authorityAtCalculation.screeningAuthority'),
    designAuthority: false,
    rootCauseAuthority: false,
    codeCompliance: false,
  };
}

function assertReceiptAuthority(value) {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_INVALID', 'receipt.authority must be an authority object.');
  }
  if (Object.keys(value).length !== Object.keys(VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY).length) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_INVALID', 'receipt.authority cannot add authority fields.');
  }
  for (const [key, expected] of Object.entries(VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY)) {
    if (value[key] !== expected) {
      throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_INVALID', 'receipt.authority cannot promote engineering authority.', { key });
    }
  }
}

export function createVibrationAssessmentEvidenceBasis(input = {}) {
  return deepFreeze({
    methodId: text(input.methodId, 'basis.methodId'),
    methodRevision: text(input.methodRevision, 'basis.methodRevision'),
    qualificationRevision: text(input.qualificationRevision, 'basis.qualificationRevision'),
    methodDefinitionHash: canonicalHash(input.methodDefinitionHash, 'basis.methodDefinitionHash'),
    engineeringInputsHash: canonicalHash(input.engineeringInputsHash, 'basis.engineeringInputsHash'),
    sourceBasisHash: canonicalHash(input.sourceBasisHash, 'basis.sourceBasisHash'),
  });
}

export function createVibrationAssessmentEvidenceReceipt(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_ASSESSMENT_EVIDENCE_RECEIPT_SCHEMA) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_SCHEMA_MISMATCH', `receipt.schema must be ${VIBRATION_ASSESSMENT_EVIDENCE_RECEIPT_SCHEMA}.`);
  }
  assertReceiptAuthority(input.authority);
  return deepFreeze({
    schema: VIBRATION_ASSESSMENT_EVIDENCE_RECEIPT_SCHEMA,
    receiptId: text(input.receiptId, 'receipt.receiptId'),
    assessmentItemId: text(input.assessmentItemId, 'receipt.assessmentItemId'),
    mechanismId: text(input.mechanismId, 'receipt.mechanismId'),
    scope: scopeValue(input.scope),
    calculatedAt: timestamp(input.calculatedAt, 'receipt.calculatedAt'),
    basis: createVibrationAssessmentEvidenceBasis(input.basis),
    resultStateAtCalculation: input.resultStateAtCalculation === 'CURRENT_RESULT'
      ? 'CURRENT_RESULT'
      : (() => { throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_RESULT_NOT_CURRENT', 'Receipt requires resultStateAtCalculation CURRENT_RESULT.'); })(),
    resultPayload: cloneJson(input.resultPayload, 'receipt.resultPayload'),
    authorityAtCalculation: authoritySnapshot(input.authorityAtCalculation),
    sourceReceiptId: optionalText(input.sourceReceiptId, 'receipt.sourceReceiptId'),
    authority: VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY,
  });
}

export function createVibrationAssessmentEvidenceReceiptFromItem({ receiptId, item, basis, calculatedAt, authorityAtCalculation, sourceReceiptId = null } = {}) {
  if (item?.schema !== VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_ITEM_SCHEMA_INVALID', `item must use ${VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA}.`);
  }
  if (item.resultState !== 'CURRENT_RESULT' || item.result == null) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_RESULT_NOT_CURRENT', 'Only a current calculated assessment item can create an evidence receipt.');
  }
  return createVibrationAssessmentEvidenceReceipt({
    receiptId,
    assessmentItemId: item.itemId,
    mechanismId: item.mechanismId,
    scope: item.scope,
    calculatedAt,
    basis,
    resultStateAtCalculation: item.resultState,
    resultPayload: item.result,
    authorityAtCalculation,
    sourceReceiptId,
  });
}

export function createVibrationAssessmentEvidenceLedger(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_SCHEMA) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_SCHEMA_MISMATCH', `ledger.schema must be ${VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_SCHEMA}.`);
  }
  if (!Array.isArray(input.receipts)) throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_ARRAY_REQUIRED', 'ledger.receipts must be an array.');
  const receipts = input.receipts.map(createVibrationAssessmentEvidenceReceipt);
  const ids = receipts.map((item) => item.receiptId);
  if (new Set(ids).size !== ids.length) {
    throw evidenceError('VIBRATION_ASSESSMENT_EVIDENCE_DUPLICATE_RECEIPT_ID', 'ledger.receiptId values must be unique.');
  }
  return deepFreeze({ schema: VIBRATION_ASSESSMENT_EVIDENCE_LEDGER_SCHEMA, receipts, authority: VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY });
}

export function createVibrationAssessmentEvidenceError(code, message, details = {}) {
  return evidenceError(code, message, details);
}
