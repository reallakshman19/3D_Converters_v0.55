import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';
import {
  VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY,
  resolveVibrationCaseActionWorkspace,
} from '../tabs/vibration-roadmap-workspace-routing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function selectedAssessment(nextActionCode = 'AUTHOR_T1_IDENTIFICATION') {
  return Object.freeze({
    schema: 'VibrationIntegrityRoadmapAssessmentContext.v1',
    authority: Object.freeze({
      purpose: 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY',
      determinesApplicability: false,
      determinesCompleteness: false,
      createsCaseIdentity: false,
      persistenceAuthority: 'NONE',
    }),
    lineCaseAssessmentStatus: Object.freeze({
      schema: 'VibrationLineCaseAssessmentStatus.v1',
      scope: Object.freeze({ line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' }),
      state: 'IDENTIFICATION_MISSING',
      nextActionCode,
      completeness: Object.freeze({ state: 'INCOMPLETE' }),
      screeningEvidence: Object.freeze({ state: 'NONE' }),
      authority: Object.freeze({
        purpose: 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY',
        determinesApplicability: false,
        determinesCompleteness: false,
      }),
    }),
  });
}

function projection(selected) {
  return Object.freeze({
    schema: 'VibrationRoadmapProjection.v1',
    context: Object.freeze({ selectedAssessment: selected }),
    phases: Object.freeze([]),
    authority: Object.freeze({ purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY' }),
  });
}

test('case action routing uses existing identification and screening workspaces only', () => {
  assert.equal(resolveVibrationCaseActionWorkspace('AUTHOR_T1_IDENTIFICATION').workspaceId, 'identification');
  assert.equal(resolveVibrationCaseActionWorkspace('REVIEW_NOT_APPLICABLE_EVIDENCE').workspaceId, 'identification');
  assert.equal(resolveVibrationCaseActionWorkspace('COMPLETE_REQUIRED_ASSESSMENTS').workspaceId, 'screening');
  assert.equal(resolveVibrationCaseActionWorkspace('REVIEW_ASSESSMENT_GAPS').workspaceId, 'screening');
  assert.equal(resolveVibrationCaseActionWorkspace('REVIEW_COMPLETE_ASSESSMENT_EVIDENCE').workspaceId, 'screening');
  assert.equal(resolveVibrationCaseActionWorkspace('UNSUPPORTED_ACTION'), null);
});

test('navigation contract cannot determine the engineering next action', () => {
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.determinesNextAction, false);
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.determinesApplicability, false);
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.determinesCompleteness, false);
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY.persistenceAuthority, 'NONE');
});

test('governed selected case renders an executable central workspace action', () => {
  const html = renderVibrationRoadmapPanel(projection(selectedAssessment()));
  assert.match(html, /Open case task/);
  assert.match(html, /data-vibration-workspace-id="identification"/);
  assert.match(html, /data-vibration-workflow-action="AUTHOR_T1_IDENTIFICATION"/);
});

test('unsupported governed next action stays visible but non-clickable', () => {
  const html = renderVibrationRoadmapPanel(projection(selectedAssessment('UNSUPPORTED_ACTION')));
  assert.match(html, /UNSUPPORTED_ACTION/);
  assert.match(html, /No central workspace route is registered/);
  assert.doesNotMatch(html, /data-vibration-workspace-id=/);
});

test('roadmap controller validates the action route then clicks the existing workspace tab', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-controller.js'), 'utf8');
  assert.match(source, /resolveVibrationCaseActionWorkspace\(workspaceTarget\.dataset\.vibrationWorkflowAction\)/);
  assert.match(source, /route\?\.workspaceId === workspaceTarget\.dataset\.vibrationWorkspaceId/);
  assert.match(source, /querySelectorAll\('\[data-vi-workspace-tab\]'\)/);
  assert.match(source, /button\.dataset\.viWorkspaceTab === workspaceId/);
  assert.match(source, /workspaceTab\(container, route\.workspaceId\)\?\.click\(\)/);
});

test('case-action route remains controller-level navigation with no persistence or calculation target', () => {
  const controller = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-controller.js'), 'utf8');
  const start = controller.indexOf("const workspaceTarget = event.target.closest('[data-vibration-workspace-id]')");
  const end = controller.indexOf("const action = event.target.closest('[data-roadmap-action]')", start);
  const block = controller.slice(start, end);
  assert.doesNotMatch(block, /serializeVibrationIntegrityProject/);
  assert.doesNotMatch(block, /parseVibrationIntegrityProject/);
  assert.doesNotMatch(block, /data-calc-id/);
  assert.doesNotMatch(block, /calculate/);
});
