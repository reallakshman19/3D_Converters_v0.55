import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAxialTorsionVonMises,
  calculateInstallationAxialStress,
  calculateInstallationBoltStrength,
  calculateInstallationStrengthFromDetailedTorque,
  calculateInstallationStressUtilization,
  calculateSolidCircularTorsionalShear,
} from '../converters/engineering-calculations/bolts/installation-strength.js';

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('axial installation stress is preload divided by explicit tensile stress area', () => {
  const result = calculateInstallationAxialStress({
    axialForceN: 10_000,
    tensileStressAreaM2: 58e-6,
  });
  close(result.axialStressPa, 172_413_793.10344827, 1e-6);
});

test('solid circular reference section reproduces tau = 16T/(pi d^3)', () => {
  const result = calculateSolidCircularTorsionalShear({
    transmittedTorqueNm: 10,
    stressSectionDiameterM: 0.01,
  });
  close(result.torsionalShearStressPa, 50_929_581.7894065, 1e-6);
  assert.equal(result.sectionModel, 'SOLID_CIRCULAR_REFERENCE_SECTION');
});

test('combined installation stress reproduces independent von-Mises fixture', () => {
  const result = calculateInstallationBoltStrength({
    preloadN: 10_000,
    tensileStressAreaM2: 58e-6,
    threadTorqueNm: 10,
    stressSectionDiameterM: 0.01,
    referenceStressPa: 640e6,
  });
  close(result.axial.axialStressPa, 172_413_793.10344827, 1e-6);
  close(result.torsion.torsionalShearStressPa, 50_929_581.7894065, 1e-6);
  close(result.combined.vonMisesStressPa, 193_669_778.11741874, 1e-6);
  close(result.utilization.utilization, 0.30260902830846675, 1e-14);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('zero transmitted thread torque reduces von Mises stress to axial stress', () => {
  const result = calculateInstallationBoltStrength({
    preloadN: 20_000,
    tensileStressAreaM2: 100e-6,
    threadTorqueNm: 0,
    stressSectionDiameterM: 0.012,
    referenceStressPa: 500e6,
  });
  close(result.combined.vonMisesStressPa, 200e6, 1e-6);
  close(result.utilization.utilization, 0.4, 1e-15);
});

test('primitive von-Mises and utilization functions preserve independent identities', () => {
  const combined = calculateAxialTorsionVonMises({
    axialStressPa: 0,
    torsionalShearStressPa: 100e6,
  });
  close(combined.vonMisesStressPa, Math.sqrt(3) * 100e6, 1e-6);
  const utilization = calculateInstallationStressUtilization({
    vonMisesStressPa: combined.vonMisesStressPa,
    referenceStressPa: 400e6,
  });
  close(utilization.utilization, Math.sqrt(3) / 4, 1e-15);
});

test('detailed-torque adapter uses thread torque and explicitly excludes bearing/total torque', () => {
  const base = {
    preloadN: 10_000,
    threadTorqueNm: 10.29818664494525,
    bearingTorqueNm: 8.4,
    totalTorqueNm: 18.698186644945253,
  };
  const result = calculateInstallationStrengthFromDetailedTorque({
    detailedTorque: base,
    tensileStressAreaM2: 5.7989593107056344e-5,
    stressSectionDiameterM: 0.008159696016958068,
    referenceStressPa: 640e6,
  });
  close(result.torsion.transmittedTorqueNm, base.threadTorqueNm, 1e-15);
  close(result.torsion.torsionalShearStressPa, 96_540_363.43638532, 1e-6);
  close(result.combined.vonMisesStressPa, 240_202_647.46819475, 1e-6);
  close(result.utilization.utilization, 0.3753166366690543, 1e-14);
  assert.equal(result.torquePath.bearingTorqueIncludedInBoltTorsion, false);
  assert.equal(result.torquePath.totalWrenchTorqueIncludedInBoltTorsion, false);
});

test('changing bearing torque alone does not change installation bolt torsional stress', () => {
  const common = {
    preloadN: 10_000,
    threadTorqueNm: 10,
  };
  const first = calculateInstallationStrengthFromDetailedTorque({
    detailedTorque: { ...common, bearingTorqueNm: 5, totalTorqueNm: 15 },
    tensileStressAreaM2: 58e-6,
    stressSectionDiameterM: 0.01,
    referenceStressPa: 640e6,
  });
  const second = calculateInstallationStrengthFromDetailedTorque({
    detailedTorque: { ...common, bearingTorqueNm: 20, totalTorqueNm: 30 },
    tensileStressAreaM2: 58e-6,
    stressSectionDiameterM: 0.01,
    referenceStressPa: 640e6,
  });
  close(first.torsion.torsionalShearStressPa, second.torsion.torsionalShearStressPa, 0);
  close(first.combined.vonMisesStressPa, second.combined.vonMisesStressPa, 0);
});

test('invalid stress geometry and reference data fail closed', () => {
  assert.throws(() => calculateInstallationBoltStrength({
    preloadN: 10_000,
    tensileStressAreaM2: 58e-6,
    threadTorqueNm: 10,
    stressSectionDiameterM: 0,
    referenceStressPa: 640e6,
  }), /stressSectionDiameterM/);
  assert.throws(() => calculateInstallationBoltStrength({
    preloadN: 10_000,
    tensileStressAreaM2: 58e-6,
    threadTorqueNm: -1,
    stressSectionDiameterM: 0.01,
    referenceStressPa: 640e6,
  }), /threadTorqueNm|transmittedTorqueNm/);
  assert.throws(() => calculateInstallationStressUtilization({
    vonMisesStressPa: 100e6,
    referenceStressPa: 0,
  }), /referenceStressPa/);
});
