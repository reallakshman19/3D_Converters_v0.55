import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLANGE_UG44_ENGINEERING_CALCULATION_ID,
  calculateEngineering,
  getEngineeringCalculationDefinition,
  listEngineeringCalculations,
} from '../converters/engineering-calculations/index.js';

function analyticalMomentForEquivalentPressure(pressurePa, diameterM) {
  return pressurePa * Math.PI * diameterM ** 3 / 16;
}

test('UG44 adapter is registered as non-authorizing benchmark-only FLANGE calculation', () => {
  const definition = getEngineeringCalculationDefinition(FLANGE_UG44_ENGINEERING_CALCULATION_ID);
  assert.equal(definition?.family, 'FLANGE');
  assert.equal(definition?.authority?.calculationState, 'BENCHMARK_ONLY');
  assert.equal(definition?.authority?.qualificationState, 'BENCHMARK_ONLY');
  assert.equal(definition?.authority?.codeCompliance, false);
  assert.ok(listEngineeringCalculations({ availableOnly: true })
    .some((item) => item.id === FLANGE_UG44_ENGINEERING_CALCULATION_ID));
});

test('central engine converts units and reproduces an independent pressure-equivalent case', () => {
  const diameterM = 0.1;
  const externalPressurePa = 3_000_000;
  const bendingMomentNm = analyticalMomentForEquivalentPressure(externalPressurePa, diameterM);
  const result = calculateEngineering({
    calculationId: FLANGE_UG44_ENGINEERING_CALCULATION_ID,
    inputs: {
      ratedPressure: 4_000,
      designPressure: 1_000,
      gasketReactionDiameter: 100,
      momentFactor: 0.5,
      bendingMoment: bendingMomentNm,
      openingAxialForce: 0,
    },
    inputUnits: {
      ratedPressure: 'kPa',
      designPressure: 'kPa',
      gasketReactionDiameter: 'mm',
      bendingMoment: 'N*m',
      openingAxialForce: 'N',
    },
  });

  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.outputs.maximumPressure - 3_000_000) < 1e-8);
  assert.ok(Math.abs(result.outputs.bendingEquivalentPressure - externalPressurePa) < 1e-8);
  assert.ok(Math.abs(result.outputs.utilization - (4 / 6)) < 1e-12);
  assert.equal(result.outputs.equationSatisfied, true);
  assert.equal(result.checks[0].status, 'PASS');
  assert.equal(result.checks[0].authority, 'BENCHMARK_ONLY');
  assert.equal(result.assessment.status, 'PASS');
  assert.equal(result.qualification.effective, 'BENCHMARK_ONLY');
  assert.equal(result.qualification.designAuthority, false);
  assert.equal(result.assessment.governingEligible, false);
  assert.equal(result.assessment.codeCompliance, false);
});

test('successful UG44 execution reports FAIL when the reference relationship is exceeded', () => {
  const diameterM = 0.1;
  const externalPressurePa = 2_000_000;
  const result = calculateEngineering({
    calculationId: FLANGE_UG44_ENGINEERING_CALCULATION_ID,
    inputs: {
      ratedPressure: 4_000_000,
      designPressure: 5_000_000,
      gasketReactionDiameter: diameterM,
      momentFactor: 0.5,
      bendingMoment: analyticalMomentForEquivalentPressure(externalPressurePa, diameterM),
      openingAxialForce: 0,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.outputs.equationSatisfied, false);
  assert.ok(result.outputs.utilization > 1);
  assert.ok(result.outputs.margin < 0);
  assert.equal(result.checks[0].status, 'FAIL');
  assert.equal(result.checks[0].authority, 'BENCHMARK_ONLY');
  assert.equal(result.assessment.status, 'FAIL');
  assert.equal(result.assessment.governingEligible, false);
  assert.equal(result.assessment.codeCompliance, false);
});

test('central engine fails closed on a negative opening axial force', () => {
  const result = calculateEngineering({
    calculationId: FLANGE_UG44_ENGINEERING_CALCULATION_ID,
    inputs: {
      ratedPressure: 4_000_000,
      designPressure: 1_000_000,
      gasketReactionDiameter: 0.1,
      momentFactor: 0.5,
      bendingMoment: 0,
      openingAxialForce: -1,
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === 'INPUT_INVALID'));
});
