export const VIBRATION_FACILITY_RUN_BASIS_SCHEMA = 'VibrationFacilityRunBasis.v1';

export const VIBRATION_FACILITY_RUN_BASIS_AUTHORITY = Object.freeze({
  purpose: 'FACILITY_RUN_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
});

function basisError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationFacilityRunBasisError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw basisError(
      'VIBRATION_FACILITY_RUN_BASIS_TEXT_REQUIRED',
      `${field} is required for facility run custody.`,
      { field },
    );
  }
  return text;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createVibrationFacilityRunBasis({ runId, datasetId, scenarioSetKey } = {}) {
  return deepFreeze({
    schema: VIBRATION_FACILITY_RUN_BASIS_SCHEMA,
    runId: requiredText(runId, 'runId'),
    datasetId: requiredText(datasetId, 'datasetId'),
    scenarioSetKey: requiredText(scenarioSetKey, 'scenarioSetKey'),
    authority: VIBRATION_FACILITY_RUN_BASIS_AUTHORITY,
  });
}

export function assertVibrationFacilityRunBasis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== VIBRATION_FACILITY_RUN_BASIS_SCHEMA) {
    throw basisError(
      'VIBRATION_FACILITY_RUN_BASIS_SCHEMA_INVALID',
      `Expected ${VIBRATION_FACILITY_RUN_BASIS_SCHEMA}.`,
    );
  }
  requiredText(value.runId, 'runId');
  requiredText(value.datasetId, 'datasetId');
  requiredText(value.scenarioSetKey, 'scenarioSetKey');
  for (const [key, expected] of Object.entries(VIBRATION_FACILITY_RUN_BASIS_AUTHORITY)) {
    if (value.authority?.[key] !== expected) {
      throw basisError(
        'VIBRATION_FACILITY_RUN_BASIS_AUTHORITY_INVALID',
        `Facility run basis authority mismatch at ${key}.`,
      );
    }
  }
  return value;
}

export function vibrationFacilityRunBasisMatches(leftInput, rightInput) {
  const left = assertVibrationFacilityRunBasis(leftInput);
  const right = assertVibrationFacilityRunBasis(rightInput);
  return left.runId === right.runId
    && left.datasetId === right.datasetId
    && left.scenarioSetKey === right.scenarioSetKey;
}
