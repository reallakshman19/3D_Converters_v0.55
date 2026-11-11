function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
  return value;
}

function fraction(value, name) {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${name} must be greater than 0 and not exceed 1.`);
  }
  return value;
}

function orderedNutFactors({ nutFactorMin, nutFactor, nutFactorMax }) {
  const min = finitePositive(nutFactorMin, 'nutFactorMin');
  const nominal = finitePositive(nutFactor, 'nutFactor');
  const max = finitePositive(nutFactorMax, 'nutFactorMax');
  if (!(min <= nominal && nominal <= max)) {
    throw new RangeError('Nut factors must satisfy min <= nominal <= max.');
  }
  return { min, nominal, max };
}

export function calculateTargetPreload({
  tensileStressAreaM2,
  referenceStressPa,
  preloadFraction,
}) {
  const area = finitePositive(tensileStressAreaM2, 'tensileStressAreaM2');
  const stress = finitePositive(referenceStressPa, 'referenceStressPa');
  const targetFraction = fraction(preloadFraction, 'preloadFraction');
  return {
    targetPreloadN: area * stress * targetFraction,
    targetReferenceStressPa: stress * targetFraction,
    referenceStressUtilization: targetFraction,
  };
}

export function calculateShortFormTorque({ preloadN, nominalDiameterM, nutFactor }) {
  const preload = finitePositive(preloadN, 'preloadN');
  const diameter = finitePositive(nominalDiameterM, 'nominalDiameterM');
  const k = finitePositive(nutFactor, 'nutFactor');
  return {
    torqueNm: k * preload * diameter,
    nutFactor: k,
  };
}

export function calculateShortFormTorqueRange({
  preloadN,
  nominalDiameterM,
  nutFactorMin,
  nutFactor,
  nutFactorMax,
}) {
  const preload = finitePositive(preloadN, 'preloadN');
  const diameter = finitePositive(nominalDiameterM, 'nominalDiameterM');
  const factors = orderedNutFactors({ nutFactorMin, nutFactor, nutFactorMax });
  return {
    torqueMinNm: factors.min * preload * diameter,
    torqueNominalNm: factors.nominal * preload * diameter,
    torqueMaxNm: factors.max * preload * diameter,
    nutFactors: factors,
  };
}

export function calculateBoltTensileStress({ axialForceN, tensileStressAreaM2 }) {
  if (!Number.isFinite(axialForceN)) throw new RangeError('axialForceN must be finite.');
  const area = finitePositive(tensileStressAreaM2, 'tensileStressAreaM2');
  return { tensileStressPa: axialForceN / area };
}

export function calculateReferenceStressUtilization({ tensileStressPa, referenceStressPa }) {
  if (!Number.isFinite(tensileStressPa)) throw new RangeError('tensileStressPa must be finite.');
  const reference = finitePositive(referenceStressPa, 'referenceStressPa');
  return {
    utilization: tensileStressPa / reference,
    withinReferenceStress: tensileStressPa <= reference,
  };
}

export function calculateShortFormBoltAssembly(input = {}) {
  const preload = calculateTargetPreload(input);
  const torque = calculateShortFormTorqueRange({
    preloadN: preload.targetPreloadN,
    nominalDiameterM: input.nominalDiameterM,
    nutFactorMin: input.nutFactorMin,
    nutFactor: input.nutFactor,
    nutFactorMax: input.nutFactorMax,
  });
  const stress = calculateBoltTensileStress({
    axialForceN: preload.targetPreloadN,
    tensileStressAreaM2: input.tensileStressAreaM2,
  });
  const utilization = calculateReferenceStressUtilization({
    tensileStressPa: stress.tensileStressPa,
    referenceStressPa: input.referenceStressPa,
  });
  return {
    method: 'SHORT_FORM_T_EQUALS_KFD_REFERENCE',
    preload,
    torque,
    stress,
    utilization,
    installationTorsionalStressEvaluated: false,
    frictionModel: 'NUT_FACTOR_INPUT',
    canUseForDesignAuthority: false,
  };
}
