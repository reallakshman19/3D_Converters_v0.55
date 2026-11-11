const PI = Math.PI;
const DEG_TO_RAD = PI / 180;

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

function positiveInteger(value, name) {
  const number = finite(value, name);
  if (!Number.isInteger(number) || number <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return number;
}

function threadHalfAngle(value) {
  const degrees = nonNegative(value, 'threadHalfAngleDeg');
  if (degrees >= 90) throw new RangeError('threadHalfAngleDeg must be less than 90 degrees.');
  return { degrees, radians: degrees * DEG_TO_RAD };
}

function frictionInputs(input = {}) {
  const thread = nonNegative(input.threadFrictionCoefficient, 'threadFrictionCoefficient');
  const bearing = nonNegative(input.bearingFrictionCoefficient, 'bearingFrictionCoefficient');
  return { thread, bearing };
}

function torqueBase(input = {}) {
  const preloadN = positive(input.preloadN, 'preloadN');
  const nominalDiameterM = positive(input.nominalDiameterM, 'nominalDiameterM');
  const pitchDiameterM = positive(input.pitchDiameterM, 'pitchDiameterM');
  const leadM = positive(input.leadM, 'leadM');
  const bearingFrictionRadiusM = positive(input.bearingFrictionRadiusM, 'bearingFrictionRadiusM');
  const angle = threadHalfAngle(input.threadHalfAngleDeg);
  const friction = frictionInputs(input);
  const tanHelixAngle = leadM / (PI * pitchDiameterM);
  const helixAngleRad = Math.atan(tanHelixAngle);
  const threadFrictionSecant = friction.thread / Math.cos(angle.radians);

  return {
    preloadN,
    nominalDiameterM,
    pitchDiameterM,
    leadM,
    bearingFrictionRadiusM,
    threadHalfAngleDeg: angle.degrees,
    threadHalfAngleRad: angle.radians,
    threadFrictionCoefficient: friction.thread,
    bearingFrictionCoefficient: friction.bearing,
    tanHelixAngle,
    helixAngleRad,
    threadFrictionSecant,
  };
}

function torqueShares({ pitchTorqueNm, threadTorqueNm, bearingTorqueNm, totalTorqueNm }) {
  if (!(totalTorqueNm > 0)) {
    return {
      pitchMechanical: 0,
      threadFrictionAndCoupling: 0,
      bearingFriction: 0,
    };
  }
  return {
    pitchMechanical: pitchTorqueNm / totalTorqueNm,
    threadFrictionAndCoupling: (threadTorqueNm - pitchTorqueNm) / totalTorqueNm,
    bearingFriction: bearingTorqueNm / totalTorqueNm,
  };
}

export function calculateBearingFrictionRadiusUniformWear({
  innerBearingDiameterM,
  outerBearingDiameterM,
} = {}) {
  const inner = nonNegative(innerBearingDiameterM, 'innerBearingDiameterM');
  const outer = positive(outerBearingDiameterM, 'outerBearingDiameterM');
  if (inner >= outer) {
    throw new RangeError('innerBearingDiameterM must be less than outerBearingDiameterM.');
  }
  return {
    bearingFrictionRadiusM: (outer + inner) / 4,
    assumption: 'UNIFORM_WEAR_ARITHMETIC_MEAN_RADIUS',
  };
}

export function calculateLegacyThreadGeometry({
  nominalDiameterM,
  pitchM,
  includedThreadAngleDeg = 60,
  starts = 1,
} = {}) {
  const diameter = positive(nominalDiameterM, 'nominalDiameterM');
  const pitch = positive(pitchM, 'pitchM');
  const includedAngle = positive(includedThreadAngleDeg, 'includedThreadAngleDeg');
  if (includedAngle >= 180) {
    throw new RangeError('includedThreadAngleDeg must be less than 180 degrees.');
  }
  const threadStarts = positiveInteger(starts, 'starts');
  const halfAngleRad = includedAngle * DEG_TO_RAD / 2;
  const fundamentalTriangleHeightM = pitch * Math.cos(halfAngleRad);
  const pitchDiameterM = diameter - 0.75 * fundamentalTriangleHeightM;
  const minorDiameterM = diameter - (17 / 12) * fundamentalTriangleHeightM;
  if (!(pitchDiameterM > 0) || !(minorDiameterM > 0)) {
    throw new RangeError('Derived thread diameters must remain greater than zero.');
  }
  const tensileStressAreaM2 = PI * (pitchDiameterM + minorDiameterM) ** 2 / 16;
  const leadM = pitch * threadStarts;
  const tanHelixAngle = leadM / (PI * pitchDiameterM);

  return {
    method: 'LEGACY_BOLT_TORQUE_CALC_THREAD_GEOMETRY_REFERENCE',
    nominalDiameterM: diameter,
    pitchM: pitch,
    includedThreadAngleDeg: includedAngle,
    threadHalfAngleDeg: includedAngle / 2,
    starts: threadStarts,
    leadM,
    fundamentalTriangleHeightM,
    pitchDiameterM,
    minorDiameterM,
    tensileStressAreaM2,
    tanHelixAngle,
    helixAngleRad: Math.atan(tanHelixAngle),
    canUseForDesignAuthority: false,
  };
}

export function calculateDetailedFrictionTorque(input = {}) {
  const values = torqueBase(input);
  const denominator = 1 - values.threadFrictionSecant * values.tanHelixAngle;
  if (!(denominator > 0)) {
    throw new RangeError(
      'Thread friction/helix denominator must remain positive for this tightening model.',
    );
  }

  const pitchTorqueNm = values.preloadN * values.leadM / (2 * PI);
  const threadTorqueNm = values.preloadN * values.pitchDiameterM / 2
    * (values.tanHelixAngle + values.threadFrictionSecant)
    / denominator;
  const bearingTorqueNm = values.preloadN
    * values.bearingFrictionCoefficient
    * values.bearingFrictionRadiusM;
  const totalTorqueNm = threadTorqueNm + bearingTorqueNm;

  return {
    method: 'DETAILED_V_THREAD_FRICTION_REFERENCE',
    sourceBasis: 'NASA_RP_1228_GENERALIZED_BEARING_RADIUS',
    preloadN: values.preloadN,
    pitchTorqueNm,
    threadTorqueNm,
    threadFrictionAndCouplingTorqueNm: threadTorqueNm - pitchTorqueNm,
    bearingTorqueNm,
    totalTorqueNm,
    effectiveNutFactor: totalTorqueNm / (values.preloadN * values.nominalDiameterM),
    denominator,
    shares: torqueShares({ pitchTorqueNm, threadTorqueNm, bearingTorqueNm, totalTorqueNm }),
    geometry: {
      nominalDiameterM: values.nominalDiameterM,
      pitchDiameterM: values.pitchDiameterM,
      leadM: values.leadM,
      threadHalfAngleDeg: values.threadHalfAngleDeg,
      tanHelixAngle: values.tanHelixAngle,
      helixAngleRad: values.helixAngleRad,
      bearingFrictionRadiusM: values.bearingFrictionRadiusM,
    },
    friction: {
      threadFrictionCoefficient: values.threadFrictionCoefficient,
      bearingFrictionCoefficient: values.bearingFrictionCoefficient,
      threadFrictionSecant: values.threadFrictionSecant,
    },
    limitations: [
      'Reference V-thread tightening model only; no Code/design authority is claimed.',
      'Friction coefficients and bearing friction radius are explicit engineering inputs.',
      'Preload scatter, embedding, relaxation, prevailing torque and tool uncertainty are not modeled.',
      'The bearing friction radius must be derived under an explicitly selected contact assumption.',
    ],
    canUseForDesignAuthority: false,
  };
}

export function calculateLegacyLinearizedDetailedTorque(input = {}) {
  const values = torqueBase(input);
  const pitchTorqueNm = values.preloadN * values.pitchDiameterM / 2 * values.tanHelixAngle;
  const threadFrictionTorqueNm = values.preloadN
    * values.pitchDiameterM / 2
    * values.threadFrictionSecant;
  const threadTorqueNm = pitchTorqueNm + threadFrictionTorqueNm;
  const bearingTorqueNm = values.preloadN
    * values.bearingFrictionCoefficient
    * values.bearingFrictionRadiusM;
  const totalTorqueNm = threadTorqueNm + bearingTorqueNm;

  return {
    method: 'LEGACY_LINEARIZED_THREAD_BEARING_FRICTION_REFERENCE',
    sourceBasis: 'BOLT_TORQUE_CALC_XLS_DISPLAYED_EQUATION',
    preloadN: values.preloadN,
    pitchTorqueNm,
    threadFrictionTorqueNm,
    threadTorqueNm,
    bearingTorqueNm,
    totalTorqueNm,
    effectiveNutFactor: totalTorqueNm / (values.preloadN * values.nominalDiameterM),
    geometry: {
      nominalDiameterM: values.nominalDiameterM,
      pitchDiameterM: values.pitchDiameterM,
      leadM: values.leadM,
      threadHalfAngleDeg: values.threadHalfAngleDeg,
      tanHelixAngle: values.tanHelixAngle,
      helixAngleRad: values.helixAngleRad,
      bearingFrictionRadiusM: values.bearingFrictionRadiusM,
    },
    friction: {
      threadFrictionCoefficient: values.threadFrictionCoefficient,
      bearingFrictionCoefficient: values.bearingFrictionCoefficient,
      threadFrictionSecant: values.threadFrictionSecant,
    },
    limitations: [
      'Legacy displayed equation is linearized and omits the exact thread friction/helix coupling denominator.',
      'This comparator exists for legacy traceability and must not be presented as the exact V-thread relation.',
      'No Code/design authority is claimed.',
    ],
    canUseForDesignAuthority: false,
  };
}

export function calculateLegacyWorkbookDetailedAssembly({
  preloadN,
  nominalDiameterM,
  pitchM,
  includedThreadAngleDeg = 60,
  starts = 1,
  threadFrictionCoefficient,
  bearingFrictionCoefficient,
  innerBearingDiameterM,
  outerBearingDiameterM,
} = {}) {
  const geometry = calculateLegacyThreadGeometry({
    nominalDiameterM,
    pitchM,
    includedThreadAngleDeg,
    starts,
  });
  const bearing = calculateBearingFrictionRadiusUniformWear({
    innerBearingDiameterM,
    outerBearingDiameterM,
  });
  const common = {
    preloadN,
    nominalDiameterM: geometry.nominalDiameterM,
    pitchDiameterM: geometry.pitchDiameterM,
    leadM: geometry.leadM,
    threadHalfAngleDeg: geometry.threadHalfAngleDeg,
    threadFrictionCoefficient,
    bearingFrictionCoefficient,
    bearingFrictionRadiusM: bearing.bearingFrictionRadiusM,
  };
  const exact = calculateDetailedFrictionTorque(common);
  const legacyLinearized = calculateLegacyLinearizedDetailedTorque(common);

  return {
    method: 'LEGACY_WORKBOOK_DETAILED_TORQUE_COMPARISON',
    geometry,
    bearing,
    exact,
    legacyLinearized,
    differenceNm: exact.totalTorqueNm - legacyLinearized.totalTorqueNm,
    relativeDifference: exact.totalTorqueNm === 0
      ? 0
      : (exact.totalTorqueNm - legacyLinearized.totalTorqueNm) / exact.totalTorqueNm,
    canUseForDesignAuthority: false,
  };
}
