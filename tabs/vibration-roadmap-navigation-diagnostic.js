export const VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY = Object.freeze({
  purpose: 'UI_NAVIGATION_DIAGNOSTIC_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  determinesApplicability: false,
  determinesCompleteness: false,
  blocksCalculation: false,
});

const DIAGNOSTIC_KEYS = Object.freeze(['authority', 'code', 'details', 'message']);
const AUTHORITY_KEYS = Object.freeze(Object.keys(VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY));

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`VIBRATION_ROADMAP_NAVIGATION_${field}_REQUIRED`);
  return normalized;
}

export function createVibrationRoadmapNavigationDiagnostic({ code, message, details = {} } = {}) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    throw new TypeError('VIBRATION_ROADMAP_NAVIGATION_DETAILS_INVALID');
  }
  return Object.freeze({
    code: requiredText(code, 'CODE'),
    message: requiredText(message, 'MESSAGE'),
    details: Object.freeze({ ...details }),
    authority: VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY,
  });
}

export function isVibrationRoadmapNavigationDiagnostic(value) {
  if (!exactKeys(value, DIAGNOSTIC_KEYS)
      || typeof value.code !== 'string' || !value.code.trim()
      || typeof value.message !== 'string' || !value.message.trim()
      || !value.details || typeof value.details !== 'object' || Array.isArray(value.details)
      || !exactKeys(value.authority, AUTHORITY_KEYS)) return false;
  return AUTHORITY_KEYS.every((key) => (
    value.authority[key] === VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY[key]
  ));
}
