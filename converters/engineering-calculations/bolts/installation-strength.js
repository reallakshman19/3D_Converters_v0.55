const PI = Math.PI;

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite.`);
  return number;
}

function positive(value, name) {
  const number = finite(value, name);
  if (number <= 0) throw new RangeError(`${name} must be greater than zero.`);
  return number;
}

function nonNegative(value, name) {
  const number = finite(value, name);
  if (number < 0) throw new RangeError(`${name} must be greater than or equal to zero.`);
  return number;
}

function optionalNonNegative(value, name) {
  if (value === undefined || value === null) return null;
  return nonNegative(value, name);
}

export function calculateInstallationAxialStress({
  axialForceN,
  tensileStressAreaM2,
} = {}) {
  const force = nonNegative(axialForceN, 'axialForceN');
  const area = positive(tensileStressAreaM2, 'tensileStressAreaM2');
  return {
    axialStressPa: force / area,
    axialForceN: force,
    tensileStressAreaM2: area,
  };
}

export function calculateSolidCircularTorsionalShear({
  transmittedTorqueNm,
  stressSectionDiameterM,
} = {}) {
  const torque = nonNegative(transmittedTorqueNm, 'transmittedTorqueNm');
  const diameter = positive(stressSectionDiameterM, 'stressSectionDiameterM');
  return {
    torsionalShearStressPa: 16 * torque / (PI * diameter ** 3),
    transmittedTorqueNm: torque,
    stressSectionDiameterM: diameter,
    sectionModel: 'SOLID_CIRCULAR_REFERENCE_SECTION',
  };
}

export function calculateAxialTorsionVonMises({
  axialStressPa,
  torsionalShearStressPa,
} = {}) {
  const axial = finite(axialStressPa, 'axialStressPa');
  const torsion = nonNegative(torsionalShearStressPa, 'torsionalShearStressPa');
  return {
    vonMisesStressPa: Math.sqrt(axial ** 2 + 3 * torsion ** 2),
    axialStressPa: axial,
    torsionalShearStressPa: torsion,
  };
}

export function calculateInstallationStressUtilization({
  vonMisesStressPa,
  referenceStressPa,
} = {}) {
  const stress = nonNegative(vonMisesStressPa, 'vonMisesStressPa');
  const reference = positive(referenceStressPa, 'referenceStressPa');
  return {
    utilization: stress / reference,
    withinReferenceStress: stress <= reference,
    referenceStressPa: reference,
  };
}

export function calculateInstallationBoltStrength({
  preloadN,
  tensileStressAreaM2,
  threadTorqueNm,
  stressSectionDiameterM,
  referenceStressPa,
} = {}) {
  const axial = calculateInstallationAxialStress({
    axialForceN: preloadN,
    tensileStressAreaM2,
  });
  const torsion = calculateSolidCircularTorsionalShear({
    transmittedTorqueNm: threadTorqueNm,
    stressSectionDiameterM,
  });
  const combined = calculateAxialTorsionVonMises({
    axialStressPa: axial.axialStressPa,
    torsionalShearStressPa: torsion.torsionalShearStressPa,
  });
  const utilization = calculateInstallationStressUtilization({
    vonMisesStressPa: combined.vonMisesStressPa,
    referenceStressPa,
  });

  return {
    method: 'INSTALLATION_AXIAL_THREAD_TORSION_VON_MISES_REFERENCE',
    state: 'REFERENCE_KERNEL_ONLY',
    axial,
    torsion,
    combined,
    utilization,
    torquePath: {
      transmittedTorqueComponent: 'THREAD_TORQUE_ONLY',
      bearingTorqueIncludedInBoltTorsion: false,
      totalWrenchTorqueIncludedInBoltTorsion: false,
    },
    limitations: [
      'Installation tightening state only; operating-load combination is outside this reference.',
      'Stress section is represented as an explicit solid circular diameter.',
      'Thread-root stress concentration, bending and local notch effects are not modeled.',
      'Residual torsion after tightening, relaxation, embedding and preload scatter are not modeled.',
      'Reference stress is an explicit caller input and is not qualified here as Code/design allowable.',
    ],
    canUseForDesignAuthority: false,
  };
}

export function calculateInstallationStrengthFromDetailedTorque({
  detailedTorque,
  tensileStressAreaM2,
  stressSectionDiameterM,
  referenceStressPa,
} = {}) {
  if (!detailedTorque || typeof detailedTorque !== 'object') {
    throw new TypeError('detailedTorque must be an object.');
  }
  const preloadN = positive(detailedTorque.preloadN, 'detailedTorque.preloadN');
  const threadTorqueNm = nonNegative(
    detailedTorque.threadTorqueNm,
    'detailedTorque.threadTorqueNm',
  );
  const result = calculateInstallationBoltStrength({
    preloadN,
    tensileStressAreaM2,
    threadTorqueNm,
    stressSectionDiameterM,
    referenceStressPa,
  });

  return {
    ...result,
    torquePath: {
      ...result.torquePath,
      source: 'DETAILED_FRICTION_THREAD_TORQUE',
      threadTorqueNm,
      bearingTorqueNm: optionalNonNegative(detailedTorque.bearingTorqueNm, 'detailedTorque.bearingTorqueNm'),
      totalWrenchTorqueNm: optionalNonNegative(detailedTorque.totalTorqueNm, 'detailedTorque.totalTorqueNm'),
    },
  };
}
