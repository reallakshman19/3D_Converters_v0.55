import assert from 'node:assert/strict';
import test from 'node:test';

import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';
import { buildVibrationRoadmapWorkflowPresentation } from '../tabs/vibration-roadmap-workflow-view.js';

function node(id, status, target = null, detail = null) {
  return Object.freeze({
    id,
    label: id.replaceAll('-', ' '),
    status,
    detail,
    scope: 'MAINLINE',
    specialty: 'GENERAL',
    target,
    source: null,
  });
}

function projection(phases, context = {}) {
  return Object.freeze({
    schema: 'VibrationRoadmapProjection.v1',
    context: Object.freeze({ projectTitle: 'Demo', lineId: 'L1', ...context }),
    phases: Object.freeze(phases.map((phase) => Object.freeze({
      ...phase,
      nodes: Object.freeze(phase.nodes),
    }))),
    authority: Object.freeze({ purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY' }),
  });
}

test('workflow focus selects the earliest phase with an existing attention state', () => {
  const value = projection([
    { id: 'IDENTIFY', label: 'Identify', nodes: [node('identify', 'AVAILABLE')] },
    { id: 'SCREEN', label: 'Screen', nodes: [node('fit', 'STALE', { type: 'CALCULATION', calculationId: 'FIT' }, 'Result requires rerun')] },
    { id: 'VERIFY', label: 'Verify', nodes: [node('measure', 'ACTION')] },
  ]);
  const result = buildVibrationRoadmapWorkflowPresentation(value);
  assert.equal(result.focusPhaseId, 'SCREEN');
  assert.equal(result.nextAttention.node.id, 'fit');
  assert.equal(result.phases[0].state, 'AVAILABLE');
  assert.equal(result.phases[1].state, 'NEEDS_ATTENTION');
});

test('available/current/data states never become phase-complete authority', () => {
  const value = projection([
    { id: 'IDENTIFY', label: 'Identify', nodes: [node('identify', 'DATA')] },
    { id: 'SCREEN', label: 'Screen', nodes: [node('fit', 'CURRENT_RESULT')] },
  ]);
  const result = buildVibrationRoadmapWorkflowPresentation(value);
  assert.equal(result.nextAttention, null);
  assert.equal(result.phases[0].state, 'HAS_DATA');
  assert.equal(result.phases[1].state, 'HAS_CURRENT_RESULT');
  assert.equal(result.authority.determinesCompleteness, false);
  assert.equal(result.authority.determinesPhaseCompletion, false);
  assert.equal(result.authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('panel renders action-first workflow focus while retaining phase nodes and target navigation', () => {
  const value = projection([
    { id: 'IDENTIFY', label: 'Identify', nodes: [node('identify', 'DATA')] },
    { id: 'SCREEN', label: 'Screen', nodes: [node('aiv-inputs', 'ATTENTION', { type: 'CALCULATION', calculationId: 'AIV' }, '2 inputs require attention')] },
  ], { projectLines: [{ lineId: 'L1', label: 'Line 1' }] });
  const html = renderVibrationRoadmapPanel(value, { width: 320 });
  assert.match(html, /Vibration Assessment/);
  assert.match(html, /Next attention/);
  assert.match(html, /aiv inputs/);
  assert.match(html, /2 inputs require attention/);
  assert.match(html, /data-calc-id="AIV"/);
  assert.match(html, /data-workflow-phase-state="NEEDS_ATTENTION"/);
  assert.match(html, /data-roadmap-line-select/);
});

test('panel does not imply completion when no attention flag exists', () => {
  const value = projection([
    { id: 'SCREEN', label: 'Screen', nodes: [node('fit', 'CURRENT_RESULT')] },
  ]);
  const html = renderVibrationRoadmapPanel(value);
  assert.match(html, /No roadmap attention flag/);
  assert.match(html, /does not mean the assessment is complete/);
  assert.doesNotMatch(html, /ASSESSMENT COMPLETE/);
});
