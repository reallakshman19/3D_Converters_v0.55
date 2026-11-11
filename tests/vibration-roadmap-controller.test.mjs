import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowVibrationRoadmap,
  vibrationProjectFileName,
  VIBRATION_PROJECT_CHANGED_EVENT,
  VIBRATION_ROADMAP_STATE_EVENT,
} from '../tabs/vibration-roadmap-controller.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

test('roadmap only mounts for Vibration family or its landing', () => {
  assert.equal(shouldShowVibrationRoadmap({ family: 'VIB' }, {}), true);
  assert.equal(shouldShowVibrationRoadmap({ family: 'PIPE' }, { familyLanding: 'VIB' }), true);
  assert.equal(shouldShowVibrationRoadmap({ family: 'PIPE' }, {}), false);
});

test('roadmap and project events are dedicated orchestration channels', () => {
  assert.equal(VIBRATION_ROADMAP_STATE_EVENT, 'vibration-roadmap-state');
  assert.equal(VIBRATION_PROJECT_CHANGED_EVENT, 'vibration-project-changed');
});

test('native project filename is deterministic and uses .vibproj', () => {
  assert.equal(vibrationProjectFileName({ project: { title: 'Gas Compression / Area 1' } }), 'Gas-Compression-Area-1.vibproj');
});

test('active calculation is highlighted without changing roadmap authority', () => {
  const projection = buildVibrationRoadmapProjection({ context: { calculationId: 'VIB.AIV.ACOUSTIC' } });
  const html = renderVibrationRoadmapPanel(projection);
  assert.match(html, /class="vibration-roadmap-node is-active"[^>]*data-calc-id="VIB\.AIV\.ACOUSTIC"/);
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
});

test('project controls retain explicit persistence-only boundary', () => {
  const projection = buildVibrationRoadmapProjection({ context: { projectId: 'P1', projectTitle: 'P1', projectLines: [{ lineId: 'L1', label: 'Line 1' }], lineId: 'L1' } });
  const html = renderVibrationRoadmapPanel(projection);
  assert.match(html, /Import EI \.eit/);
  assert.match(html, /Open project/);
  assert.match(html, /Save project/);
  assert.match(html, /Project persistence only · imported results require registered rerun/);
});

test('collapsed presentation retains non-binding authority statement', () => {
  const projection = buildVibrationRoadmapProjection();
  const html = renderVibrationRoadmapPanel(projection, { collapsed: true });
  assert.match(html, /vibration-roadmap-panel is-collapsed/);
  assert.match(html, /Guidance only · not an applicability or completion gate/);
});
