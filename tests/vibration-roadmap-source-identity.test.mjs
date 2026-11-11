import assert from 'node:assert/strict';
import test from 'node:test';
import { VIBRATION_ROADMAP_NODES } from '../converters/vibration/roadmap/registry.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

function node(projection, id) { return projection.phases.flatMap((phase) => phase.nodes).find((item) => item.id === id); }

test('lifecycle roadmap exposes separate T5 through T13 source identities', () => {
  const byId = new Map(VIBRATION_ROADMAP_NODES.map((item) => [item.id, item]));
  assert.equal(byId.get('visual-piping').source.sources[0].technicalModule, 'T5');
  assert.equal(byId.get('visual-tubing').source.sources[0].technicalModule, 'T6');
  assert.equal(byId.get('basic-measurement').source.sources[0].technicalModule, 'T7');
  assert.equal(byId.get('specialist-measurement').source.sources[0].technicalModule, 'T8');
  assert.equal(byId.get('predictive-analysis').source.sources[0].technicalModule, 'T9');
  assert.equal(byId.get('mainline-mitigation').source.sources[0].technicalModule, 'T10');
  assert.equal(byId.get('branch-mitigation').source.sources[0].technicalModule, 'T11');
  assert.equal(byId.get('thermowell-mitigation').source.sources[0].technicalModule, 'T12');
  assert.equal(byId.get('good-design-practice').source.sources[0].technicalModule, 'T13');
});

test('source state is observational and cannot change engineering roadmap status', () => {
  const projection = buildVibrationRoadmapProjection({ mechanismStates: { thermowells: { resultState: 'CURRENT_RESULT' } } });
  const thw = node(projection, 'mechanism-thermowells');
  assert.equal(thw.status, 'CURRENT_RESULT'); assert.equal(thw.source.status, 'CONFLICTED');
  assert.equal(projection.authority.engineeringAuthority, 'NONE'); assert.equal(projection.authority.screeningAuthority, 'NOT_AUTHORIZED'); assert.equal(projection.authority.designAuthority, false);
});

test('post-mod verification source remains explicitly unresolved', () => {
  const projection = buildVibrationRoadmapProjection(); const item = node(projection, 'post-mod-verification');
  assert.equal(item.source.status, 'UNRESOLVED'); assert.equal(item.status, 'AVAILABLE');
});

test('rendered panel makes source reconciliation and conflicts visible', () => {
  const html = renderVibrationRoadmapPanel(buildVibrationRoadmapProjection());
  assert.match(html, /data-source-status="RECONCILIATION_REQUIRED"/);
  assert.match(html, /data-source-status="CONFLICTED"/);
  assert.match(html, /Source conflict: T4 ↔ ASME PTC 19.3 TW-2016 repository label/);
  assert.match(html, /source identity does not grant engineering authority/);
  assert.match(html, /Guidance only · not an applicability or completion gate/);
});
