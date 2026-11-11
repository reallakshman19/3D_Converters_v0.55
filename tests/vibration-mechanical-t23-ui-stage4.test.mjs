import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderMechanicalFacilityPanel } from '../tabs/vibration-integrity-mechanical-view.js';

const SCOPE = 'MECHANICAL-FACILITY/L-100/NORMAL/CAN-1';

function state(overrides = {}) {
  return {
    mechanicalFacilityScopeId: SCOPE,
    mechanicalSourceKeysByScope: {
      [SCOPE]: ['CENTRIFUGAL_COMPRESSOR', 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW'],
    },
    mechanicalNotApplicableByScope: {},
    mechanicalCandidateResultsByScope: {},
    mechanicalPendingByScope: {},
    ...overrides,
  };
}

test('Mechanical panel exposes exact equipment selection and bounded direct screening authority', () => {
  const html = renderMechanicalFacilityPanel(state());
  assert.match(html, /Mechanical excitation · EI AVIFF T2\.3/u);
  assert.match(html, /data-vi-mechanical-source="CENTRIFUGAL_COMPRESSOR"/u);
  assert.match(html, /data-vi-mechanical-source="ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW"/u);
  assert.match(html, /data-vi-mechanical-not-applicable/u);
  assert.match(html, /Qualified direct Table T2-3 screening/u);
  assert.match(html, /nine direct T2\.3 machinery baseline values are screening-qualified/u);
  assert.match(html, /Shared-support transfer and the conditional 0\.4 reduction[\s\S]*remain outside this authority/u);
  assert.match(html, /data-vi-mechanical-evaluate/u);
});

test('explicit not-applicable state disables direct equipment evaluation', () => {
  const html = renderMechanicalFacilityPanel(state({
    mechanicalSourceKeysByScope: { [SCOPE]: [] },
    mechanicalNotApplicableByScope: { [SCOPE]: true },
  }));
  assert.match(html, /data-vi-mechanical-not-applicable checked/u);
  assert.match(html, /NOT APPLICABLE/u);
  assert.match(html, /data-vi-mechanical-evaluate disabled/u);
});

test('shared-support rule is visible but disabled until adjacent-line LOF is modeled', () => {
  const html = renderMechanicalFacilityPanel(state());
  assert.match(html, /Shared supports with adjacent line LOF/u);
  assert.match(html, /PIPEWORK_SHARING_SUPPORTS_WITH_LINE_LOF_GE_0_50[^>]*[\s\S]*?disabled/u);
  assert.match(html, /Requires explicit adjacent-line LOF/u);
});

test('calculated panel publishes screening LOF and governing source without design promotion', () => {
  const result = Object.freeze({
    governingLof: 0.4,
    governingSourceKey: 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW',
    rows: Object.freeze([
      { sourceKey: 'CENTRIFUGAL_COMPRESSOR', baselineLof: 0.2, qualificationGate: 'DIRECT_TABLE_T2_3_BASELINE' },
      { sourceKey: 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW', baselineLof: 0.4, qualificationGate: 'DIRECT_TABLE_T2_3_BASELINE' },
    ]),
  });
  const html = renderMechanicalFacilityPanel(state({
    mechanicalCandidateResultsByScope: { [SCOPE]: result },
  }));
  assert.match(html, /Screening LOF[\s\S]*0\.4/u);
  assert.match(html, /Governing source/u);
  assert.match(html, /Authority[\s\S]*SCREENING/u);
  assert.doesNotMatch(html, /DESIGN/u);
});

test('screening view and mechanism projection route Mechanical facility state into the matrix', async () => {
  const view = await readFile(new URL('../tabs/vibration-integrity-view.js', import.meta.url), 'utf8');
  const mechanisms = await readFile(new URL('../tabs/vibration-integrity-mechanisms.js', import.meta.url), 'utf8');
  assert.match(view, /data-vi-mechanical-facility-scope/u);
  assert.match(view, /Mechanical inputs/u);
  assert.match(mechanisms, /mechanicalSourceKeysByScope/u);
  assert.match(mechanisms, /mechanicalNotApplicableByScope/u);
  assert.match(mechanisms, /mechanicalCandidateResultsByScope/u);
  assert.match(mechanisms, /buildMechanicalVibrationMechanismAssessmentSet/u);
});
