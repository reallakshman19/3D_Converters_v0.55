import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_ROADMAP_DEFAULT_WIDTH,
  VIBRATION_ROADMAP_MAX_WIDTH,
  VIBRATION_ROADMAP_MIN_WIDTH,
  VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_AUTHORITY,
  VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
  VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_STORAGE_KEY,
  clampVibrationRoadmapWidth,
  loadVibrationRoadmapPresentationPreference,
  parseVibrationRoadmapPresentationPreference,
  saveVibrationRoadmapPresentationPreference,
} from '../tabs/vibration-roadmap-presentation-preference.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test('presentation preference has no engineering, project-persistence, or calculation authority', () => {
  assert.deepEqual(VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_AUTHORITY, {
    purpose: 'USER_INTERFACE_PRESENTATION_PREFERENCE_ONLY',
    engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    projectPersistenceAuthority: 'NONE',
    calculationExecutionAuthority: 'NONE',
    blocking: false,
  });
});

test('width clamp preserves the governed 260-520 px range and 320 px default', () => {
  assert.equal(clampVibrationRoadmapWidth(undefined), VIBRATION_ROADMAP_DEFAULT_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(10), VIBRATION_ROADMAP_MIN_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(999), VIBRATION_ROADMAP_MAX_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(411.6), 412);
});

test('save and load persist only versioned presentation fields', () => {
  const storage = memoryStorage();
  assert.equal(saveVibrationRoadmapPresentationPreference(storage, { roadmapWidth: 417, collapsed: true }), true);
  const raw = storage.getItem(VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_STORAGE_KEY);
  assert.deepEqual(JSON.parse(raw), {
    schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
    roadmapWidth: 417,
    collapsed: true,
  });
  assert.deepEqual(loadVibrationRoadmapPresentationPreference(storage), {
    schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
    roadmapWidth: 417,
    collapsed: true,
  });
});

test('malformed, foreign-version, and authority-injected preferences are ignored', () => {
  assert.equal(parseVibrationRoadmapPresentationPreference('{invalid'), null);
  assert.equal(parseVibrationRoadmapPresentationPreference(JSON.stringify({
    schema: 'VibrationRoadmapPresentationPreference.v2', roadmapWidth: 320, collapsed: false,
  })), null);
  assert.equal(parseVibrationRoadmapPresentationPreference(JSON.stringify({
    schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
    roadmapWidth: 320,
    collapsed: false,
    designAuthority: true,
  })), null);
  assert.equal(parseVibrationRoadmapPresentationPreference(JSON.stringify({
    schema: VIBRATION_ROADMAP_PRESENTATION_PREFERENCE_SCHEMA,
    roadmapWidth: 521,
    collapsed: false,
  })), null);
});

test('storage denial is fail-soft and cannot block the roadmap', () => {
  const denied = {
    getItem() { throw new Error('storage denied'); },
    setItem() { throw new Error('storage denied'); },
  };
  assert.equal(loadVibrationRoadmapPresentationPreference(denied), null);
  assert.equal(saveVibrationRoadmapPresentationPreference(denied, { roadmapWidth: 320, collapsed: false }), false);
});
