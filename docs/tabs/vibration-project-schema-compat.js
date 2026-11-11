import * as projectSchema from '../converters/vibration/project/schema.js?v=20260903-pr720-lifecycle-schema-1';

function compatibilityError(apiName) {
  const error = new Error(
    `Loaded vibration project schema does not provide ${apiName}; refresh the application to load a consistent module version.`,
  );
  error.name = 'VibrationProjectSchemaCompatibilityError';
  error.code = 'VIBRATION_PROJECT_SCHEMA_LIFECYCLE_API_UNAVAILABLE';
  error.details = Object.freeze({ apiName });
  return error;
}

export function resolveVibrationProjectSchemaApi(schemaModule, apiName) {
  const api = schemaModule?.[apiName];
  if (typeof api !== 'function') throw compatibilityError(apiName);
  return api;
}

export function assertVibrationIntegrityProjectCompat(value) {
  return resolveVibrationProjectSchemaApi(
    projectSchema,
    'assertVibrationIntegrityProject',
  )(value);
}

export function vibrationProjectLifecycleLedgersCompat(value) {
  return resolveVibrationProjectSchemaApi(
    projectSchema,
    'vibrationProjectLifecycleLedgers',
  )(value);
}

export function attachVibrationProjectLifecycleLedgersCompat(value, ledgers = {}) {
  return resolveVibrationProjectSchemaApi(
    projectSchema,
    'attachVibrationProjectLifecycleLedgers',
  )(value, ledgers);
}
