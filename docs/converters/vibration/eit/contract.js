export const ENERGY_INSTITUTE_EIT_SCHEMA = 'EnergyInstituteEit.v5';
export const ENERGY_INSTITUTE_EIT_VERSION = 5;
export const ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA = 'EnergyInstituteEitImport.v1';

function eitError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'EnergyInstituteEitError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function objectRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw eitError('EIT_OBJECT_REQUIRED', `${field} must be an object.`, { field });
  }
  return value;
}

function arrayField(value, field, { optional = false } = {}) {
  if (optional && value === undefined) return [];
  if (!Array.isArray(value)) {
    throw eitError('EIT_ARRAY_REQUIRED', `${field} must be an array.`, { field });
  }
  return value;
}

export function assertEnergyInstituteEitV5Document(value) {
  const document = objectRecord(value, 'document');
  const options = objectRecord(document.options, 'options');
  if (Number(options.version) !== ENERGY_INSTITUTE_EIT_VERSION) {
    throw eitError(
      'EIT_VERSION_UNSUPPORTED',
      `Energy Institute .eit requires options.version = ${ENERGY_INSTITUTE_EIT_VERSION}.`,
      { actual: options.version ?? null },
    );
  }
  arrayField(document.lines, 'lines');
  arrayField(document.pipes, 'pipes');
  arrayField(document.streams, 'streams');
  arrayField(document.mats, 'mats', { optional: true });
  return document;
}

export function cloneEitValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function deepFreezeEitValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreezeEitValue(child);
  return Object.freeze(value);
}

export function createEitError(code, message, details = {}) {
  return eitError(code, message, details);
}
