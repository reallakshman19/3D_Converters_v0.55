import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const controllerSource = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-controller.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-panel.css'), 'utf8');

function panel(context = {}, options = {}) {
  return renderVibrationRoadmapPanel(buildVibrationRoadmapProjection({ context }), options);
}

test('VIB-UI-004/006 resize, landmark and collapse semantics expose current state and relationships', () => {
  const html = panel({}, { width: 420 });
  assert.match(html, /id="vibration-roadmap-panel"/);
  assert.match(html, /aria-labelledby="vibration-roadmap-heading"/);
  assert.match(html, /id="vibration-roadmap-heading"/);
  assert.match(html, /id="vibration-roadmap-content"/);
  assert.match(html, /aria-valuemin="260"/);
  assert.match(html, /aria-valuemax="520"/);
  assert.match(html, /aria-valuenow="420"/);
  assert.match(html, /aria-valuetext="420 pixels"/);
  assert.match(html, /aria-controls="vibration-roadmap-panel"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="vibration-roadmap-content"/);

  const collapsed = panel({}, { collapsed: true, width: 420 });
  assert.match(collapsed, /aria-expanded="false"/);
  assert.doesNotMatch(collapsed, /data-roadmap-resize/);
});

test('VIB-UI-004 controller synchronizes resize separator value after pointer or keyboard width changes', () => {
  assert.match(controllerSource, /handle\?\.setAttribute\('aria-valuenow', String\(roadmapWidth\)\)/);
  assert.match(controllerSource, /handle\?\.setAttribute\('aria-valuetext', `\$\{roadmapWidth\} pixels`\)/);
});

test('VIB-UI-005 resize hit target is at least 20 px while the visual separator remains narrow', () => {
  assert.match(css, /\.vibration-roadmap-resize\{[^}]*width:20px/);
  assert.match(css, /\.vibration-roadmap-resize::after\{[^}]*width:2px/);
});

test('VIB-UI-003 core roadmap typography no longer uses 8 px or 9 px text', () => {
  assert.doesNotMatch(css, /font-size:(?:8|9)px/);
  assert.match(css, /vibration-roadmap-project-actions button,.vibration-roadmap-focus-action\{[^}]*font-size:12px/);
  assert.match(css, /vibration-roadmap-node strong\{[^}]*font-size:12px/);
});

test('VIB-UI-007 informational roadmap nodes are not focusable no-op buttons', () => {
  const html = panel();
  assert.match(html, /<div class="vibration-roadmap-node is-informational"[^>]*data-roadmap-node-id=/);
  assert.doesNotMatch(html, /<button[^>]*aria-disabled="true"[^>]*class="vibration-roadmap-node/);
});

test('VIB-UI-008 project feedback uses live status semantics without changing authority', () => {
  const info = panel({ projectMessage: 'Project opened.', projectMessageKind: 'info' });
  assert.match(info, /data-kind="info" role="status" aria-live="polite" aria-atomic="true"/);

  const error = panel({ projectMessage: 'Project failed.', projectMessageKind: 'error' });
  assert.match(error, /data-kind="error" role="alert" aria-live="assertive" aria-atomic="true"/);
});

test('VIB-UI-009 invalid selected-assessment authority remains fail-closed but visible', () => {
  const html = panel({
    selectedAssessment: {
      schema: 'VibrationIntegrityRoadmapAssessmentContext.v1',
      authority: {
        purpose: 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY',
        determinesApplicability: true,
        determinesCompleteness: false,
        createsCaseIdentity: false,
        persistenceAuthority: 'NONE',
      },
      lineCaseAssessmentStatus: null,
    },
  });
  assert.match(html, /data-selected-assessment-diagnostic/);
  assert.match(html, /data-selected-assessment-diagnostic-code="VIBRATION_ROADMAP_SELECTED_ASSESSMENT_AUTHORITY_INVALID"/);
  assert.match(html, /Selected assessment context unavailable/);
  assert.match(html, /remained fail-closed/);
  assert.doesNotMatch(html, /data-line-case-workflow-state=/);
});
