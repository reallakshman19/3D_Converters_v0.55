import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVibrationIntegritySelectedAssessmentContext } from '../tabs/vibration-integrity-roadmap-bridge.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function selectedAssessment() {
  return Object.freeze({
    schema: 'VibrationIntegrityRoadmapAssessmentContext.v1',
    rowKey: 'ROW-1',
    lineCaseAssessmentStatus: Object.freeze({
      schema: 'VibrationLineCaseAssessmentStatus.v1',
      scope: Object.freeze({ line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' }),
      state: 'REQUIRED_ASSESSMENT_INCOMPLETE',
      nextActionCode: 'COMPLETE_REQUIRED_ASSESSMENTS',
      completeness: Object.freeze({ state: 'INCOMPLETE' }),
      screeningEvidence: Object.freeze({ state: 'CURRENT' }),
      authority: Object.freeze({
        purpose: 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY',
        determinesApplicability: false,
        determinesCompleteness: false,
      }),
    }),
    authority: Object.freeze({
      purpose: 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY',
      determinesApplicability: false,
      determinesCompleteness: false,
      createsCaseIdentity: false,
      persistenceAuthority: 'NONE',
    }),
  });
}

function projection(context = {}) {
  return Object.freeze({
    schema: 'VibrationRoadmapProjection.v1',
    context: Object.freeze(context),
    phases: Object.freeze([]),
    authority: Object.freeze({ purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY' }),
  });
}

test('no selected facility row produces no exact assessment context', () => {
  assert.equal(buildVibrationIntegritySelectedAssessmentContext({}), null);
});

test('right rail renders exact selected line/case workflow status and next action', () => {
  const html = renderVibrationRoadmapPanel(projection({ selectedAssessment: selectedAssessment() }));
  assert.match(html, /Selected assessment/);
  assert.match(html, /10-P-100 · NORMAL/);
  assert.match(html, /LINE-A/);
  assert.match(html, /REQUIRED_ASSESSMENT_INCOMPLETE/);
  assert.match(html, /Complete required assessments/);
  assert.match(html, /EI INCOMPLETE · Screening CURRENT/);
  assert.match(html, /Exact register scope · project mapping not asserted · workflow projection only/);
});

test('panel does not invent a selected case when exact context is absent', () => {
  const html = renderVibrationRoadmapPanel(projection());
  assert.doesNotMatch(html, /vibration-roadmap-assessment/);
  assert.doesNotMatch(html, /Case next action/);
});

test('panel fails closed when selected context lacks governed authority envelopes', () => {
  const ungoverned = { ...selectedAssessment(), authority: undefined };
  const html = renderVibrationRoadmapPanel(projection({ selectedAssessment: ungoverned }));
  assert.doesNotMatch(html, /vibration-roadmap-assessment/);
  assert.doesNotMatch(html, /Case next action/);
});

test('FIT workspace publishes and clears selected assessment through existing roadmap event seam', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tabs/vibration-integrity-tab.js'), 'utf8');
  assert.match(source, /VIBRATION_ROADMAP_STATE_EVENT/);
  assert.match(source, /selectedAssessment/);
  assert.match(source, /bubbles:\s*true/);
  assert.match(source, /publishAssessmentContext\(null\)/);
});

test('bridge remains transient projection-only and consumes the governed line-case status', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tabs/vibration-integrity-roadmap-bridge.js'), 'utf8');
  assert.match(source, /buildVibrationLineCaseAssessmentStatus/);
  assert.match(source, /determinesApplicability:\s*false/);
  assert.match(source, /determinesCompleteness:\s*false/);
  assert.match(source, /createsCaseIdentity:\s*false/);
  assert.match(source, /persistenceAuthority:\s*'NONE'/);
});
