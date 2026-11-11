const PI = Math.PI;

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new TypeError(`${field} must be a finite number.`);
    error.code = 'INPUT_INVALID';
    error.field = field;
    throw error;
  }
  return number;
}

function nonNegative(value, field) {
  const number = finiteNumber(value, field);
  if (number < 0) {
    const error = new RangeError(`${field} must be greater than or equal to zero.`);
    error.code = 'INPUT_OUTSIDE_APPLICABILITY';
    error.field = field;
    throw error;
  }
  return number;
}

function positive(value, field) {
  const number = finiteNumber(value, field);
  if (number <= 0) {
    const error = new RangeError(`${field} must be greater than zero.`);
    error.code = 'INPUT_OUTSIDE_APPLICABILITY';
    error.field = field;
    throw error;
  }
  return number;
}

function normalizeInput(input = {}) {
  return Object.freeze({
    ratedPressurePa: positive(input.ratedPressurePa, 'ratedPressurePa'),
    designPressurePa: nonNegative(input.designPressurePa, 'designPressurePa'),
    gasketReactionDiameterM: positive(input.gasketReactionDiameterM, 'gasketReactionDiameterM'),
    momentFactor: nonNegative(input.momentFactor, 'momentFactor'),
    bendingMomentNm: nonNegative(input.bendingMomentNm, 'bendingMomentNm'),
    openingAxialForceN: nonNegative(input.openingAxialForceN, 'openingAxialForceN'),
  });
}

function equivalentPressureComponents(values) {
  const g2 = values.gasketReactionDiameterM ** 2;
  const g3 = values.gasketReactionDiameterM ** 3;
  return Object.freeze({
    bendingPressurePa: 16 * values.bendingMomentNm / (PI * g3),
    axialPressurePa: 4 * values.openingAxialForceN / (PI * g2),
  });
}

export function calculateUg44RatedFlange(input = {}) {
  const values = normalizeInput(input);
  const equivalent = equivalentPressureComponents(values);
  const externalEquivalentPressurePa = equivalent.bendingPressurePa + equivalent.axialPressurePa;
  const availablePressurePa = values.ratedPressurePa * (1 + values.momentFactor);
  const demandPressurePa = values.designPressurePa + externalEquivalentPressurePa;
  const uncappedMaximumPressurePa = availablePressurePa - externalEquivalentPressurePa;
  const maximumPressurePa = Math.min(values.ratedPressurePa, uncappedMaximumPressurePa);
  const utilization = availablePressurePa > 0 ? demandPressurePa / availablePressurePa : Infinity;

  return Object.freeze({
    methodId: 'FLANGE.RATED_LOAD.UG44B',
    unitSystem: 'SI',
    pass: demandPressurePa <= availablePressurePa,
    utilization,
    marginPa: availablePressurePa - demandPressurePa,
    maximumPressurePa,
    uncappedMaximumPressurePa,
    availablePressurePa,
    demandPressurePa,
    externalEquivalentPressurePa,
    ...equivalent,
    inputs: values,
  });
}

export function ug44AcceptanceEquation(input = {}) {
  const values = normalizeInput(input);
  const leftNm = 16 * values.bendingMomentNm
    + 4 * values.openingAxialForceN * values.gasketReactionDiameterM;
  const rightNm = PI * values.gasketReactionDiameterM ** 3
    * ((values.ratedPressurePa - values.designPressurePa)
      + values.momentFactor * values.ratedPressurePa);
  return Object.freeze({ leftNm, rightNm, pass: leftNm <= rightNm });
}
