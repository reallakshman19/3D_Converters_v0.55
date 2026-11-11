import { VIBRATION_SIGNAL_PRODUCT_TYPES } from '../measurement/contracts.js';

export const VIBRATION_VERIFICATION_REQUIREMENT_SCHEMA = 'VibrationVerificationRequirement.v1';
export const VIBRATION_MEASUREMENT_DISPOSITION_SCHEMA = 'VibrationMeasurementDisposition.v1';

export const VIBRATION_VERIFICATION_REQUIREMENT_TYPES = Object.freeze([
  'BASIC_MEASUREMENT',
  'SPECIALIST_MEASUREMENT',
]);

export const VIBRATION_MEASUREMENT_DISPOSITION_OUTCOMES = Object.freeze([
  'EVIDENCE_ACCEPTED_FOR_REQUIREMENT',
  'EVIDENCE_INSUFFICIENT',
  'SPECIALIST_REVIEW_REQUIRED',
  'CORRECTIVE_ACTION_REQUIRED',
]);

export const VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY = Object.freeze({
  authority: 'FIELD_VERIFICATION_REQUIREMENT_ONLY',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

export const VIBRATION_MEASUREMENT_DISPOSITION_AUTHORITY = Object.freeze({
  authority: 'ENGINEER_VERIFICATION_DISPOSITION_ONLY',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function verificationError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationVerificationError';
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
    throw verificationError('VIBRATION_VERIFICATION_TEXT_REQUIRED', `${field} must be non-empty text.`, { field });
  }
  return value.trim();
}

function enumValue(value, allowed, field) {
  const normalized = text(value, field);
  if (!allowed.includes(normalized)) {
    throw verificationError('VIBRATION_VERIFICATION_ENUM_INVALID', `${field} is not supported.`, { field, value: normalized });
  }
  return normalized;
}

function canonicalHash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw verificationError('VIBRATION_VERIFICATION_HASH_REQUIRED', `${field} must be a canonical sha256 hash.`, { field });
  }
  return value;
}

function timestamp(value, field) {
  const normalized = text(value, field);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw verificationError('VIBRATION_VERIFICATION_TIME_INVALID', `${field} must be an ISO-compatible timestamp.`, { field });
  }
  return normalized;
}

function uniqueTextArray(value, field, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    throw verificationError('VIBRATION_VERIFICATION_ARRAY_REQUIRED', `${field} must be ${nonEmpty ? 'a non-empty' : 'an'} array.`, { field });
  }
  const normalized = value.map((item) => text(item, `${field}[]`));
  if (new Set(normalized).size !== normalized.length) {
    throw verificationError('VIBRATION_VERIFICATION_DUPLICATE_ID', `${field} must contain unique values.`, { field });
  }
  return normalized;
}

function scopeValue(value = {}, field = 'scope') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw verificationError('VIBRATION_VERIFICATION_OBJECT_REQUIRED', `${field} must be an object.`, { field });
  }
  return {
    lineId: text(value.lineId, `${field}.lineId`),
    caseId: text(value.caseId, `${field}.caseId`),
    operatingCaseSnapshotId: text(value.operatingCaseSnapshotId, `${field}.operatingCaseSnapshotId`),
    operatingCaseSnapshotHash: canonicalHash(value.operatingCaseSnapshotHash, `${field}.operatingCaseSnapshotHash`),
  };
}

function assertAuthority(value, expected, field) {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw verificationError('VIBRATION_VERIFICATION_AUTHORITY_INVALID', `${field} must be an authority object.`, { field });
  }
  if (Object.keys(value).length !== Object.keys(expected).length) {
    throw verificationError('VIBRATION_VERIFICATION_AUTHORITY_INVALID', `${field} cannot add authority fields.`, { field });
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) {
      throw verificationError('VIBRATION_VERIFICATION_AUTHORITY_INVALID', `${field} cannot promote engineering authority.`, { field, key });
    }
  }
}

function productTypes(value) {
  const types = uniqueTextArray(value, 'requiredProductTypes', { nonEmpty: true });
  for (const productType of types) {
    if (!VIBRATION_SIGNAL_PRODUCT_TYPES.includes(productType)) {
      throw verificationError('VIBRATION_VERIFICATION_PRODUCT_TYPE_INVALID', 'requiredProductTypes contains an unsupported signal product type.', { productType });
    }
  }
  return types;
}

export function createVibrationVerificationRequirement(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_VERIFICATION_REQUIREMENT_SCHEMA) {
    throw verificationError('VIBRATION_VERIFICATION_SCHEMA_MISMATCH', `requirement.schema must be ${VIBRATION_VERIFICATION_REQUIREMENT_SCHEMA}.`);
  }
  assertAuthority(input.authority, VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY, 'requirement.authority');
  return deepFreeze({
    schema: VIBRATION_VERIFICATION_REQUIREMENT_SCHEMA,
    requirementId: text(input.requirementId, 'requirement.requirementId'),
    scope: scopeValue(input.scope, 'requirement.scope'),
    mechanismId: text(input.mechanismId, 'requirement.mechanismId'),
    requirementType: enumValue(input.requirementType, VIBRATION_VERIFICATION_REQUIREMENT_TYPES, 'requirement.requirementType'),
    reason: text(input.reason, 'requirement.reason'),
    requiredProductTypes: productTypes(input.requiredProductTypes),
    authority: VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY,
  });
}

function dispositionEvidence(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw verificationError('VIBRATION_VERIFICATION_OBJECT_REQUIRED', 'disposition.evidence must be an object.');
  }
  const sessionIds = uniqueTextArray(value.sessionIds ?? [], 'disposition.evidence.sessionIds');
  const productIds = uniqueTextArray(value.productIds ?? [], 'disposition.evidence.productIds');
  if (sessionIds.length === 0 && productIds.length === 0) {
    throw verificationError('VIBRATION_VERIFICATION_EVIDENCE_REFERENCE_REQUIRED', 'Disposition must reference at least one measurement session or signal product.');
  }
  return { sessionIds, productIds };
}

export function createVibrationMeasurementDisposition(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_MEASUREMENT_DISPOSITION_SCHEMA) {
    throw verificationError('VIBRATION_VERIFICATION_SCHEMA_MISMATCH', `disposition.schema must be ${VIBRATION_MEASUREMENT_DISPOSITION_SCHEMA}.`);
  }
  assertAuthority(input.authority, VIBRATION_MEASUREMENT_DISPOSITION_AUTHORITY, 'disposition.authority');
  return deepFreeze({
    schema: VIBRATION_MEASUREMENT_DISPOSITION_SCHEMA,
    dispositionId: text(input.dispositionId, 'disposition.dispositionId'),
    requirementId: text(input.requirementId, 'disposition.requirementId'),
    scope: scopeValue(input.scope, 'disposition.scope'),
    mechanismId: text(input.mechanismId, 'disposition.mechanismId'),
    outcome: enumValue(input.outcome, VIBRATION_MEASUREMENT_DISPOSITION_OUTCOMES, 'disposition.outcome'),
    evidence: dispositionEvidence(input.evidence),
    review: {
      reviewerId: text(input.review?.reviewerId, 'disposition.review.reviewerId'),
      reviewedAt: timestamp(input.review?.reviewedAt, 'disposition.review.reviewedAt'),
    },
    reason: text(input.reason, 'disposition.reason'),
    authority: VIBRATION_MEASUREMENT_DISPOSITION_AUTHORITY,
  });
}

export function createVibrationVerificationError(code, message, details = {}) {
  return verificationError(code, message, details);
}
