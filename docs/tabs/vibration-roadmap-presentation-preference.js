export const VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA = 'VibrationRoadmapPresentationPreference.v1';
export const VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_STORAGE_KEY = '3D_Converters.vibrationRoadmapPresentationPreference.v1';
export const VIBRATION_ROADMAP_MIN_WIDTH = 260;
export const VIBRATION_ROADMAP_DEFAULT_WIDTH = 320;
export const VIBRATION_ROADMAP_MAX_WIDTH = 520;

export const VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_AUTHORITY = Object.freeze({
  purpose: 'USER_INTERFACE_PRESENTATION_PREFERENCE_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  projectPersistenceAuthority: 'NONE',
  calculationExecutionAuthority: 'NONE',
  blocking: false,
});

const PREFERENCE_KEYS = Object.freeze(['collapsed', 'roadmapWidth', 'schema']);

export function clampVibrationRoadmapWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return VIBRATION_ROADMAP_DEFAULT_WIDTH;
  return Math.min(VIBRATION_ROADMAP_MAX_WIDTH, Math.max(VIBRATION_ROADMAP_MIN_WIDTH, Math.round(number)));
}

function hasExactPreferenceKeys(value) {
  return Object.keys(value).sort().join('|') === PREFERENCE_KEYS.join('|');
}

export function parseVibrationRoadmapPresentationPreference(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!hasExactPreferenceKeys(parsed)) return null;
    if (parsed.schema !== VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA) return null;
    if (typeof parsed.collapsed !== 'boolean') return null;
    if (!Number.isInteger(parsed.roadmapWidth)) return null;
    if (parsed.roadmapWidth < VIBRATION_ROADMAP_MIN_WIDTH || parsed.roadmapWidth > VIBRATION_ROADMAP_MAX_WIDTH) return null;
    return Object.freeze({
      schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
      roadmapWidth: parsed.roadmapWidth,
      collapsed: parsed.collapsed,
    });
  } catch {
    return null;
  }
}

export function loadVibrationRoadmapPresentationPreference(storage) {
  try {
    if (typeof storage?.getItem !== 'function') return null;
    return parseVibrationRoadmapPresentationPreference(
      storage.getItem(VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function saveVibrationRoadmapPresentationPreference(storage, { roadmapWidth, collapsed }) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(
      VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
        roadmapWidth: clampVibrationRoadmapWidth(roadmapWidth),
        collapsed: collapsed === true,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
