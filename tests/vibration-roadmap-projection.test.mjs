import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnergyInstituteEitDocument } from '../converters/vibration/eit/parse.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

function fixture() {
  return parseEnergyInstituteEitDocument({
    options: { version: 5 },
    lines: [{
      rid: '4', modules: 'fit,fip,sbc,mex', fit: '0.02', fit_data: '[{"span":"8.32"}]',
      fip: '1.00', fip_data: '[{"lof":1}]', mex: '0.40', mex_data: '[{"lof":0.4}]',
      sbc: '0.66', sbc_data: '[{"lof":0.66}]',
    }],
    pipes: [], streams: [], mats: [],
  });
}

function mechanismNode(projection, mechanismId) {
  return projection.phases.flatMap((phase) => phase.nodes)
    .find((node) => node.mechanismId === mechanismId);
}

test('imported data drives guidance status without promoting current authority', () => {
  const projection = buildVibrationRoadmapProjection({ eitImport: fixture(), context: { eitRid: '4' } });
  assert.equal(mechanismNode(projection, 'fit').status, 'IMPORTED');
  assert.equal(mechanismNode(projection, 'deadlegPulsation').status, 'IMPORTED');
  assert.equal(mechanismNode(projection, 'smallBoreConnections').status, 'IMPORTED');
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
  assert.equal(projection.authority.determinesApplicability, false);
});

test('missing module stays AVAILABLE and never becomes NOT_APPLICABLE implicitly', () => {
  const projection = buildVibrationRoadmapProjection({ eitImport: fixture() });
  assert.equal(mechanismNode(projection, 'aiv').status, 'AVAILABLE');
  assert.notEqual(mechanismNode(projection, 'aiv').status, 'NOT_APPLICABLE');
});

test('NOT_APPLICABLE requires explicit evidence', () => {
  const withoutEvidence = buildVibrationRoadmapProjection({
    mechanismStates: { aiv: { requirementState: 'NOT_APPLICABLE' } },
  });
  assert.equal(mechanismNode(withoutEvidence, 'aiv').status, 'ATTENTION');
  const withEvidence = buildVibrationRoadmapProjection({
    mechanismStates: { aiv: { requirementState: 'NOT_APPLICABLE', requirementEvidenceId: 'T1-EVID-1' } },
  });
  assert.equal(mechanismNode(withEvidence, 'aiv').status, 'NOT_APPLICABLE');
});

test('current and stale registered result states outrank imported history', () => {
  const current = buildVibrationRoadmapProjection({
    eitImport: fixture(), mechanismStates: { fit: { resultState: 'CURRENT_RESULT' } },
  });
  assert.equal(mechanismNode(current, 'fit').status, 'CURRENT_RESULT');
  const stale = buildVibrationRoadmapProjection({
    eitImport: fixture(), mechanismStates: { fit: { resultState: 'STALE_RESULT' } },
  });
  assert.equal(mechanismNode(stale, 'fit').status, 'STALE');
});

test('panel is guidance-only and reuses existing calculation-id navigation seam', () => {
  const html = renderVibrationRoadmapPanel(buildVibrationRoadmapProjection({ eitImport: fixture() }));
  assert.match(html, /Guidance only · not an applicability or completion gate/);
  assert.match(html, /data-calc-id="VIB\.FIV\.FLOW_TURBULENCE"/);
  assert.match(html, /data-calc-id="VIB\.AIV\.ACOUSTIC"/);
  assert.doesNotMatch(html, /SAFE|PASS/i);
});
