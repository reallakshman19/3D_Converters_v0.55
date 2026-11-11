import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateEngineering,
  getEngineeringCalculationDefinition,
  listEngineeringCalculations,
} from '../converters/engineering-calculations/index.js';

const SHORT_FORM_ID = 'BOLT.PRELOAD_TORQUE.SHORT_FORM';
const DETAILED_ID = 'BOLT.TORQUE.DETAILED_FRICTION';
const INSTALLATION_ID = 'BOLT.STRENGTH.INSTALLATION_AXIAL_TORSION';

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function calculate(calculationId, inputs, inputUnits = {}) {
  return calculateEngineering({ calculationId, inputs, inputUnits });
}

test('central registry exposes all three bolt reference calculators under Flanges & Joints', () => {
  const familyIds = new Set(listEngineeringCalculations({ family: 'FLANGE' }).map((row) => row.id));
  for (const id of [SHORT_FORM_ID, DETAILED_ID, INSTALLATION_ID]) {
    assert.ok(familyIds.has(id), `${id} not registered under FLANGE family`);
    const definition = getEngineeringCalculationDefinition(id);
    assert.equal(definition.family, 'FLANGE');
    assert.equal(definition.authority.qualificationState, 'IMPLEMENTED');
    assert.equal(definition.authority.codeCompliance, false);
  }
});

test('short-form adapter converts units and reproduces independent F = As S alpha and T = KFd fixture', () => {
  const result = calculate(SHORT_FORM_ID, {
    tensileStressArea: 58,
    referenceStress: 640,
    preloadFraction: 0.7,
    nominalDiameter: 10,
    nutFactorMin: 0.15,
    nutFactor: 0.2,
    nutFactorMax: 0.25,
  }, {
    tensileStressArea: 'mm2',
    referenceStress: 'MPa',
    nominalDiameter: 'mm',
  });

  assert.equal(result.ok, true);
  close(result.outputs.targetPreload, 25_984, 1e-9);
  close(result.outputs.targetReferenceStress, 448e6, 1e-6);
  close(result.outputs.torqueMin, 38.976, 1e-12);
  close(result.outputs.torqueNominal, 51.968, 1e-12);
  close(result.outputs.torqueMax, 64.96, 1e-12);
  close(result.outputs.tensileStress, 448e6, 1e-6);
  close(result.outputs.utilization, 0.7, 1e-15);
  assert.equal(result.assessment.governingEligible, false);
  assert.equal(result.qualification.designAuthority, false);
});

test('detailed-friction adapter converts geometry/load units and reproduces V-thread torque fixture', () => {
  const result = calculate(DETAILED_ID, {
    preload: 10,
    nominalDiameter: 10,
    pitchDiameter: 9.025721420742507,
    lead: 1.5,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: 0.15,
    bearingFrictionCoefficient: 0.12,
    bearingFrictionRadius: 7,
  }, {
    preload: 'kN',
    nominalDiameter: 'mm',
    pitchDiameter: 'mm',
    lead: 'mm',
    bearingFrictionRadius: 'mm',
  });

  assert.equal(result.ok, true);
  close(result.outputs.pitchTorque, 2.3873241463784303, 1e-12);
  close(result.outputs.threadTorque, 10.29818664494525, 1e-12);
  close(result.outputs.bearingTorque, 8.4, 1e-12);
  close(result.outputs.totalTorque, 18.698186644945253, 1e-12);
  close(result.outputs.effectiveNutFactor, 0.18698186644945253, 1e-14);
  assert.equal(result.assessment.governingEligible, false);
  assert.equal(result.qualification.designAuthority, false);
});

test('installation-strength adapter converts units and reproduces independent solid-circle/von-Mises fixture', () => {
  const result = calculate(INSTALLATION_ID, {
    preload: 10,
    tensileStressArea: 58,
    threadTorque: 10,
    stressSectionDiameter: 10,
    referenceStress: 640,
  }, {
    preload: 'kN',
    tensileStressArea: 'mm2',
    threadTorque: 'N*m',
    stressSectionDiameter: 'mm',
    referenceStress: 'MPa',
  });

  assert.equal(result.ok, true);
  close(result.outputs.axialStress, 172_413_793.10344827, 1e-6);
  close(result.outputs.torsionalShearStress, 50_929_581.7894065, 1e-6);
  close(result.outputs.vonMisesStress, 193_669_778.11741874, 1e-6);
  close(result.outputs.utilization, 0.30260902830846675, 1e-14);
  assert.equal(result.outputs.withinReferenceStress, true);
  assert.equal(result.intermediates.torquePath.transmittedTorqueComponent, 'THREAD_TORQUE_ONLY');
  assert.equal(result.assessment.status, 'PASS');
  assert.equal(result.assessment.governingEligible, false);

  const [check] = result.checks;
  assert.equal(check.id, 'INSTALLATION_VON_MISES_REFERENCE_STRESS');
  assert.equal(check.label, 'Installation von-Mises stress vs explicit reference stress');
  close(check.actual, result.outputs.vonMisesStress, 1e-6);
  close(check.allowable, 640e6, 1e-6);
  assert.equal(check.comparator, '<=');
  close(check.utilization, result.outputs.utilization, 1e-14);
  assert.equal(check.status, 'PASS');
  assert.equal(check.authority, 'BENCHMARK_ONLY');
  assert.equal(check.basis, 'EXPLICIT_CALLER_REFERENCE_STRESS');
});

test('invalid nut-factor ordering fails closed through the central engine', () => {
  const result = calculate(SHORT_FORM_ID, {
    tensileStressArea: 58e-6,
    referenceStress: 640e6,
    preloadFraction: 0.7,
    nominalDiameter: 0.01,
    nutFactorMin: 0.25,
    nutFactor: 0.2,
    nutFactorMax: 0.15,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'CALCULATION_FAILED');
  assert.match(result.errors[0].message, /min <= nominal <= max/);
});

test('unsupported detailed-friction thread angle fails input validation before calculation', () => {
  const result = calculate(DETAILED_ID, {
    preload: 10_000,
    nominalDiameter: 0.01,
    pitchDiameter: 0.009,
    lead: 0.0015,
    threadHalfAngleDeg: 90,
    threadFrictionCoefficient: 0.15,
    bearingFrictionCoefficient: 0.12,
    bearingFrictionRadius: 0.007,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'INPUT_INVALID');
  assert.equal(result.errors[0].field, 'threadHalfAngleDeg');
});
