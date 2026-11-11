import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDetailedFrictionTorque } from '../converters/engineering-calculations/bolts/detailed-friction.js';
import { calculateInstallationStrengthFromDetailedTorque } from '../converters/engineering-calculations/bolts/installation-strength.js';

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const torqueInput = Object.freeze({
  preloadN: 10_000,
  nominalDiameterM: 0.01,
  pitchDiameterM: 0.009025721420742507,
  leadM: 0.0015,
  threadHalfAngleDeg: 30,
  threadFrictionCoefficient: 0.15,
  bearingFrictionCoefficient: 0.12,
  bearingFrictionRadiusM: 0.007,
});

test('detailed friction thread torque feeds installation torsion while bearing torque remains excluded', () => {
  const detailed = calculateDetailedFrictionTorque(torqueInput);
  const strength = calculateInstallationStrengthFromDetailedTorque({
    detailedTorque: detailed,
    tensileStressAreaM2: 5.7989593107056344e-5,
    stressSectionDiameterM: 0.008159696016958068,
    referenceStressPa: 640e6,
  });

  close(detailed.threadTorqueNm, 10.29818664494525, 1e-12);
  close(detailed.bearingTorqueNm, 8.4, 1e-12);
  close(strength.torsion.transmittedTorqueNm, detailed.threadTorqueNm, 1e-15);
  close(strength.combined.vonMisesStressPa, 240_202_647.46819475, 1e-6);
  assert.equal(strength.torquePath.bearingTorqueIncludedInBoltTorsion, false);
  assert.equal(strength.torquePath.totalWrenchTorqueIncludedInBoltTorsion, false);
});

test('bearing-friction change alters wrench torque but not thread-torque installation stress', () => {
  const lowBearing = calculateDetailedFrictionTorque({ ...torqueInput, bearingFrictionCoefficient: 0.05 });
  const highBearing = calculateDetailedFrictionTorque({ ...torqueInput, bearingFrictionCoefficient: 0.25 });
  assert.notEqual(lowBearing.totalTorqueNm, highBearing.totalTorqueNm);
  close(lowBearing.threadTorqueNm, highBearing.threadTorqueNm, 0);

  const common = {
    tensileStressAreaM2: 5.7989593107056344e-5,
    stressSectionDiameterM: 0.008159696016958068,
    referenceStressPa: 640e6,
  };
  const lowStrength = calculateInstallationStrengthFromDetailedTorque({ detailedTorque: lowBearing, ...common });
  const highStrength = calculateInstallationStrengthFromDetailedTorque({ detailedTorque: highBearing, ...common });
  close(lowStrength.torsion.torsionalShearStressPa, highStrength.torsion.torsionalShearStressPa, 0);
  close(lowStrength.combined.vonMisesStressPa, highStrength.combined.vonMisesStressPa, 0);
});
