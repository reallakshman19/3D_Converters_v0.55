import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import {
  createVibrationRoadmapNavigationDiagnostic,
  isVibrationRoadmapNavigationDiagnostic,
  VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY,
} from '../tabs/vibration-roadmap-navigation-diagnostic.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const controllerSource = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-controller.js'), 'utf8');

function diagnostic(code, message) {
  return createVibrationRoadmapNavigationDiagnostic({ code, message, details: {} });
}

test('VIB-UI-002 navigation diagnostic contract is closed and explicitly non-authoritative', () => {
  const value = diagnostic('VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND', 'Missing target.');
  assert.equal(isVibrationRoadmapNavigationDiagnostic(value), true);
  assert.deepEqual(value.authority, VIBRATION_ROADMAP_NAVIGATION_DIAGNOSTIC_AUTHORITY);
  assert.equal(value.authority.engineeringAuthority, 'NONE');
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(value.authority.designAuthority, false);
  assert.equal(value.authority.blocksCalculation, false);
  assert.equal(isVibrationRoadmapNavigationDiagnostic({ ...value, unexpected: true }), false);
  assert.equal(isVibrationRoadmapNavigationDiagnostic({
    ...value,
    authority: { ...value.authority, blocksExecution: false },
  }), false);
  assert.equal(isVibrationRoadmapNavigationDiagnostic({
    ...value,
    authority: { ...value.authority, blocksCalculation: true },
  }), false);
});

test('VIB-UI-002 controller does not silently optional-chain workspace or assessment clicks', () => {
  assert.doesNotMatch(controllerSource, /workspaceTab\([^)]*\)\?\.click\(\)/);
  assert.doesNotMatch(controllerSource, /assessmentRow\([^)]*\)\?\.click\(\)/);
  assert.match(controllerSource, /VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND/);
  assert.match(controllerSource, /VIBRATION_ROADMAP_ASSESSMENT_TARGET_NOT_FOUND/);
  assert.match(controllerSource, /failNavigation\(/);
  assert.match(controllerSource, /createVibrationRoadmapNavigationDiagnostic/);
});

test('VIB-UI-002 navigation failures render a visible non-authoritative diagnostic', () => {
  const projection = buildVibrationRoadmapProjection({
    context: {
      navigationDiagnostic: diagnostic(
        'VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND',
        'Case task is not available in the current workspace view.',
      ),
    },
  });
  const html = renderVibrationRoadmapPanel(projection);
  assert.match(html, /data-roadmap-navigation-message/);
  assert.match(html, /data-roadmap-navigation-code="VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND"/);
  assert.match(html, /Navigation unavailable/);
  assert.match(html, /Case task is not available in the current workspace view\./);
  assert.match(html, /no engineering authority and no calculation blocking/i);
});

test('VIB-UI-002 malformed or authority-promoting diagnostics are not projected', () => {
  const valid = diagnostic('BAD', 'Bad diagnostic');
  const promoted = {
    ...valid,
    authority: { ...valid.authority, blocksCalculation: true },
  };
  const unknownAuthorityField = {
    ...valid,
    authority: { ...valid.authority, blocksExecution: false },
  };
  for (const bad of [promoted, unknownAuthorityField, { ...valid, unexpected: true }]) {
    const html = renderVibrationRoadmapPanel(buildVibrationRoadmapProjection({
      context: { navigationDiagnostic: bad },
    }));
    assert.doesNotMatch(html, /data-roadmap-navigation-message/);
  }
});
