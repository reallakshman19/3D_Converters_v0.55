import {
  assertVibrationIntegrityProject,
  cloneProjectValue,
  deepFreezeProjectValue,
  createVibrationProjectError,
} from './schema.js';

export const VIBRATION_INTEGRITY_PROJECT_FILE_EXTENSION = '.vibproj';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function serializeVibrationIntegrityProject(project) {
  assertVibrationIntegrityProject(project);
  return `${JSON.stringify(canonical(project), null, 2)}\n`;
}

export function parseVibrationIntegrityProject(text) {
  let parsed;
  try { parsed = JSON.parse(String(text ?? '')); }
  catch (error) {
    throw createVibrationProjectError('VIBRATION_PROJECT_JSON_INVALID', 'Vibration project import requires valid JSON.', { message: String(error?.message || error) });
  }
  assertVibrationIntegrityProject(parsed);
  return deepFreezeProjectValue(cloneProjectValue(parsed));
}
