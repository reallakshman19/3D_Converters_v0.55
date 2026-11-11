export const ENGINEERING_CALCULATION_CONTRACT_VERSION = 'engineering-calculation-contract/v1';
export const ENGINEERING_CALCULATION_RESULT_VERSION = 'engineering-calculation-result/v1';
export const ENGINEERING_CALCULATION_BATCH_VERSION = 'engineering-calculation-batch/v1';

export const ENGINEERING_CALCULATION_FAMILIES = Object.freeze([
  'PIPE', 'VIB', 'RELIEF', 'SUPPORT', 'EQUIP', 'FLANGE', 'HAZARD', 'ESTIMATION',
]);

export const ENGINEERING_CALCULATION_FAMILY_LABELS = Object.freeze({
  PIPE: 'Pipe Design & Pressure Integrity',
  VIB: 'Vibration & Dynamic Screening',
  RELIEF: 'Relief / Discharge / Transient Loads',
  SUPPORT: 'Local Supports & Attachments',
  EQUIP: 'Equipment Interface Loads',
  FLANGE: 'Flanges & Joints',
  HAZARD: 'Hazard & Special Screening',
  ESTIMATION: 'Engineering Estimation / Empirical Models',
});

export const METHOD_QUALIFICATION_STATES = Object.freeze([
  'CONCEPT', 'SOURCE_INVENTORIED', 'METHOD_SPECIFIED', 'IMPLEMENTED',
  'BENCHMARK_ONLY', 'SCREENING', 'PROJECT_APPROVED', 'VERIFIED',
  'PRODUCTION_AUTHORIZED', 'BLOCKED',
]);

export const DATA_QUALIFICATION_STATES = Object.freeze([
  'DRAFT', 'BENCHMARK_ONLY', 'SCREENING', 'PROJECT_APPROVED', 'VERIFIED', 'RETIRED',
]);

export const ENGINEERING_ERROR_CODES = Object.freeze([
  'CALCULATION_NOT_REGISTERED', 'CONTRACT_VERSION_UNSUPPORTED', 'INPUT_REQUIRED',
  'INPUT_INVALID', 'INPUT_UNIT_UNSUPPORTED', 'INPUT_OUTSIDE_APPLICABILITY',
  'MASTER_DATA_REQUIRED', 'MASTER_RECORD_NOT_FOUND', 'MASTER_RECORD_AMBIGUOUS',
  'MASTER_RECORD_NOT_QUALIFIED', 'ENGINEERING_METHOD_BLOCKED',
  'ENGINEERING_METHOD_NOT_QUALIFIED', 'CALCULATION_FAILED', 'ASSESSMENT_NOT_AVAILABLE',
]);

export const ENGINEERING_CALCULATION_CHECK_STATUSES = Object.freeze([
  'PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_EVALUATED', 'INDETERMINATE',
]);

export const ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES = Object.freeze([
  'PASS', 'FAIL', 'NOT_ASSESSED', 'INDETERMINATE',
]);

const LEGACY_ENGINEERING_CHECK_STATUS_ALIASES = Object.freeze({
  NOT_CHECKED: 'NOT_EVALUATED',
});

export function normalizeEngineeringCalculationId(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function createEngineeringCalculationError(code, message, details = {}, field = null) {
  const error = { code, message };
  if (field) error.field = field;
  if (details && Object.keys(details).length) error.details = details;
  return error;
}

export function cloneEngineeringValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (seen.has(value)) return seen.get(value);
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, child] of Object.entries(value)) copy[key] = cloneEngineeringValue(child, seen);
  return copy;
}

function canonicalEngineeringCheckStatus(check) {
  const declared = LEGACY_ENGINEERING_CHECK_STATUS_ALIASES[check?.status] ?? check?.status;
  if (ENGINEERING_CALCULATION_CHECK_STATUSES.includes(declared)) return declared;
  if (check?.satisfied === true) return 'PASS';
  if (check?.satisfied === false) return 'FAIL';
  return 'INDETERMINATE';
}

export function normalizeEngineeringCalculationCheck(check = {}) {
  const copy = cloneEngineeringValue(check);
  return {
    ...copy,
    id: copy.id ?? null,
    label: copy.label ?? copy.id ?? 'Unnamed check',
    actual: copy.actual ?? null,
    allowable: copy.allowable ?? null,
    comparator: copy.comparator ?? null,
    utilization: copy.utilization ?? null,
    status: canonicalEngineeringCheckStatus(copy),
    authority: copy.authority
      ?? (copy.designAuthority === true ? 'DESIGN_AUTHORITY' : copy.designAuthority === false ? 'NON_DESIGN' : 'UNDECLARED'),
    basis: copy.basis ?? null,
  };
}

export function normalizeEngineeringCalculationChecks(checks = []) {
  if (!Array.isArray(checks)) return [];
  return checks.map((check) => normalizeEngineeringCalculationCheck(check));
}

function canonicalEngineeringAssessmentOutcome(assessment) {
  if (ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES.includes(assessment?.outcome)) return assessment.outcome;
  if (assessment?.pass === true) return 'PASS';
  if (assessment?.pass === false) return 'FAIL';
  if (ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES.includes(assessment?.status)) return assessment.status;
  return 'NOT_ASSESSED';
}

export function normalizeEngineeringCalculationAssessment(assessment = null) {
  if (assessment === null || assessment === undefined) return null;
  const copy = cloneEngineeringValue(assessment);
  const outcome = canonicalEngineeringAssessmentOutcome(copy);
  const legacyStatus = copy.status;
  const disposition = copy.disposition
    ?? (legacyStatus && !ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES.includes(legacyStatus) ? legacyStatus : null);
  return {
    ...copy,
    outcome,
    ...(disposition !== null ? { disposition } : {}),
  };
}

export function deepFreezeEngineeringValue(value, seen = new WeakSet()) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreezeEngineeringValue(child, seen);
  return Object.freeze(value);
}

export function immutableEngineeringSnapshot(value) {
  return deepFreezeEngineeringValue(cloneEngineeringValue(value));
}

export function normalizeThrownEngineeringError(error, fallbackCode = 'CALCULATION_FAILED') {
  if (error?.code && error?.message) {
    return createEngineeringCalculationError(error.code, error.message, error.details ?? {});
  }
  return createEngineeringCalculationError(
    fallbackCode,
    error instanceof Error ? error.message : String(error ?? 'Unknown calculation error'),
  );
}
