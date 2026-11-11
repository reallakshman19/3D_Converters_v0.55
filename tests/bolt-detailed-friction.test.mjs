import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBearingFrictionRadiusUniformWear,
  calculateDetailedFrictionTorque,
  calculateLegacyLinearizedDetailedTorque,
  calculateLegacyThreadGeometry,
  calculateLegacyWorkbookDetailedAssembly,
} from '../converters/engineering-calculations/bolts/detailed-friction.js';

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const LEGACY_GEOMETRY = Object.freeze({
  nominalDiameterM: 0.01,
  pitchM: 0.0015,
  includedThreadAngleDeg: 60,
  starts: 1,
});

test('legacy workbook thread geometry reproduces independently derived 60-degree relationships', () => {
  const result = calculateLegacyThreadGeometry(LEGACY_GEOMETRY);
  close(result.fundamentalTriangleHeightM, 0.0012990381056766582, 1e-16);
  close(result.pitchDiameterM, 0.009025721420742507, 1e-16);
  close(result.minorDiameterM, 0.008159696016958068, 1e-16);
  close(result.tensileStressAreaM2, 5.7989593107056344e-5, 1e-18);
  close(result.tanHelixAngle, 0.05290046158287113, 1e-15);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('uniform-wear bearing radius matches the legacy (do + di) / 4 expression', () => {
  const result = calculateBearingFrictionRadiusUniformWear({
    innerBearingDiameterM: 0.012,
    outerBearingDiameterM: 0.016,
  });
  close(result.bearingFrictionRadiusM, 0.007);
  assert.equal(result.assumption, 'UNIFORM_WEAR_ARITHMETIC_MEAN_RADIUS');
});

test('exact V-thread model reproduces an independent detailed torque fixture', () => {
  const geometry = calculateLegacyThreadGeometry(LEGACY_GEOMETRY);
  const result = calculateDetailedFrictionTorque({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    pitchDiameterM: geometry.pitchDiameterM,
    leadM: geometry.leadM,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: 0.15,
    bearingFrictionCoefficient: 0.12,
    bearingFrictionRadiusM: 0.007,
  });

  close(result.pitchTorqueNm, 2.3873241463784303, 1e-12);
  close(result.threadTorqueNm, 10.29818664494525, 1e-12);
  close(result.bearingTorqueNm, 8.4, 1e-12);
  close(result.totalTorqueNm, 18.698186644945253, 1e-12);
  close(result.effectiveNutFactor, 0.18698186644945253, 1e-14);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('direct torque expression reproduces NASA RP-1228 K identity when bearing radius is 0.625d', () => {
  const geometry = calculateLegacyThreadGeometry(LEGACY_GEOMETRY);
  const preloadN = 10_000;
  const nominalDiameterM = 0.01;
  const mu = 0.15;
  const result = calculateDetailedFrictionTorque({
    preloadN,
    nominalDiameterM,
    pitchDiameterM: geometry.pitchDiameterM,
    leadM: geometry.leadM,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: mu,
    bearingFrictionCoefficient: mu,
    bearingFrictionRadiusM: 0.625 * nominalDiameterM,
  });

  const tanPsi = geometry.leadM / (Math.PI * geometry.pitchDiameterM);
  const secAlpha = 1 / Math.cos(Math.PI / 6);
  const expectedK = geometry.pitchDiameterM / (2 * nominalDiameterM)
    * (tanPsi + mu * secAlpha)
    / (1 - mu * tanPsi * secAlpha)
    + 0.625 * mu;

  close(result.effectiveNutFactor, expectedK, 1e-14);
  close(result.totalTorqueNm, expectedK * preloadN * nominalDiameterM, 1e-12);
});

test('zero friction reduces the exact model to preload times lead over 2pi', () => {
  const result = calculateDetailedFrictionTorque({
    preloadN: 12_000,
    nominalDiameterM: 0.012,
    pitchDiameterM: 0.0108,
    leadM: 0.00175,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: 0,
    bearingFrictionCoefficient: 0,
    bearingFrictionRadiusM: 0.008,
  });
  const expected = 12_000 * 0.00175 / (2 * Math.PI);
  close(result.threadTorqueNm, expected, 1e-12);
  close(result.totalTorqueNm, expected, 1e-12);
  close(result.shares.pitchMechanical, 1, 1e-12);
});

test('legacy linearized comparator remains distinct from the exact friction/helix model', () => {
  const geometry = calculateLegacyThreadGeometry(LEGACY_GEOMETRY);
  const input = {
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    pitchDiameterM: geometry.pitchDiameterM,
    leadM: geometry.leadM,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: 0.15,
    bearingFrictionCoefficient: 0.12,
    bearingFrictionRadiusM: 0.007,
  };
  const exact = calculateDetailedFrictionTorque(input);
  const linearized = calculateLegacyLinearizedDetailedTorque(input);

  close(linearized.totalTorqueNm, 18.603828184222817, 1e-12);
  assert.ok(exact.totalTorqueNm > linearized.totalTorqueNm);
  assert.ok(Math.abs(exact.totalTorqueNm - linearized.totalTorqueNm) > 0.09);
  assert.match(linearized.limitations.join('\n'), /linearized/i);
});

test('legacy assembly wrapper exposes exact and displayed-workbook comparators without authority promotion', () => {
  const result = calculateLegacyWorkbookDetailedAssembly({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    pitchM: 0.0015,
    includedThreadAngleDeg: 60,
    starts: 1,
    threadFrictionCoefficient: 0.15,
    bearingFrictionCoefficient: 0.12,
    innerBearingDiameterM: 0.012,
    outerBearingDiameterM: 0.016,
  });

  close(result.exact.totalTorqueNm, 18.698186644945253, 1e-12);
  close(result.legacyLinearized.totalTorqueNm, 18.603828184222817, 1e-12);
  close(result.differenceNm, 0.09435846072243592, 1e-12);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('invalid geometry and singular thread friction/helix combinations fail closed', () => {
  assert.throws(() => calculateBearingFrictionRadiusUniformWear({
    innerBearingDiameterM: 0.02,
    outerBearingDiameterM: 0.01,
  }), /less than/);

  assert.throws(() => calculateDetailedFrictionTorque({
    preloadN: 10_000,
    nominalDiameterM: 0.01,
    pitchDiameterM: 0.01,
    leadM: 0.1,
    threadHalfAngleDeg: 30,
    threadFrictionCoefficient: 1,
    bearingFrictionCoefficient: 0.1,
    bearingFrictionRadiusM: 0.007,
  }), /denominator/);
});
