import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBoltTensileStress,
  calculateReferenceStressUtilization,
  calculateShortFormBoltAssembly,
  calculateShortFormTorque,
  calculateShortFormTorqueRange,
  calculateTargetPreload,
} from '../converters/engineering-calculations/bolts/short-form.js';

function close(actual, expected, tolerance = 1e-12) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('target preload is explicit stress-area-reference-fraction multiplication', () => {
  const result = calculateTargetPreload({
    tensileStressAreaM2: 100e-6,
    referenceStressPa: 200e6,
    preloadFraction: 0.5,
  });
  close(result.targetPreloadN, 10_000);
  close(result.targetReferenceStressPa, 100e6);
  close(result.referenceStressUtilization, 0.5);
});

test('short-form torque reproduces exact synthetic T=KFd case', () => {
  const result = calculateShortFormTorque({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    nutFactor: 0.2,
  });
  close(result.torqueNm, 20);
  close(result.nutFactor, 0.2);
});

test('nut-factor range produces ordered torque range without hidden friction assumptions', () => {
  const result = calculateShortFormTorqueRange({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    nutFactorMin: 0.15,
    nutFactor: 0.2,
    nutFactorMax: 0.25,
  });
  close(result.torqueMinNm, 15);
  close(result.torqueNominalNm, 20);
  close(result.torqueMaxNm, 25);
});

test('bolt tensile stress and reference utilization use explicit stress area and stress basis', () => {
  const stress = calculateBoltTensileStress({
    axialForceN: 10_000,
    tensileStressAreaM2: 100e-6,
  });
  close(stress.tensileStressPa, 100e6);

  const utilization = calculateReferenceStressUtilization({
    tensileStressPa: stress.tensileStressPa,
    referenceStressPa: 200e6,
  });
  close(utilization.utilization, 0.5);
  assert.equal(utilization.withinReferenceStress, true);
});

test('assembly pipeline preserves preload as primary quantity and remains non-authorizing', () => {
  const result = calculateShortFormBoltAssembly({
    tensileStressAreaM2: 100e-6,
    referenceStressPa: 200e6,
    preloadFraction: 0.5,
    nominalDiameterM: 0.01,
    nutFactorMin: 0.15,
    nutFactor: 0.2,
    nutFactorMax: 0.25,
  });
  close(result.preload.targetPreloadN, 10_000);
  close(result.torque.torqueNominalNm, 20);
  close(result.stress.tensileStressPa, 100e6);
  close(result.utilization.utilization, 0.5);
  assert.equal(result.installationTorsionalStressEvaluated, false);
  assert.equal(result.frictionModel, 'NUT_FACTOR_INPUT');
  assert.equal(result.canUseForDesignAuthority, false);
});

test('preload fraction is never silently defaulted or allowed above unity', () => {
  assert.throws(() => calculateTargetPreload({
    tensileStressAreaM2: 100e-6,
    referenceStressPa: 200e6,
  }), /preloadFraction/);

  assert.throws(() => calculateTargetPreload({
    tensileStressAreaM2: 100e-6,
    referenceStressPa: 200e6,
    preloadFraction: 1.01,
  }), /not exceed 1/);
});

test('nut-factor range fails closed when factor ordering is invalid', () => {
  assert.throws(() => calculateShortFormTorqueRange({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    nutFactorMin: 0.25,
    nutFactor: 0.2,
    nutFactorMax: 0.15,
  }), /min <= nominal <= max/);
});
