function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new TypeError(`${field} must be a finite number.`);
    error.code = 'INPUT_INVALID';
    error.field = field;
    throw error;
  }
  return number;
}

export function transportMomentToJointFace({ forceN = {}, momentNm = {}, offsetM = {} } = {}) {
  const fx = finite(forceN.x ?? 0, 'forceN.x');
  const fy = finite(forceN.y ?? 0, 'forceN.y');
  const fz = finite(forceN.z ?? 0, 'forceN.z');
  const mx = finite(momentNm.x ?? 0, 'momentNm.x');
  const my = finite(momentNm.y ?? 0, 'momentNm.y');
  const mz = finite(momentNm.z ?? 0, 'momentNm.z');
  const rx = finite(offsetM.x ?? 0, 'offsetM.x');
  const ry = finite(offsetM.y ?? 0, 'offsetM.y');
  const rz = finite(offsetM.z ?? 0, 'offsetM.z');

  return Object.freeze({
    x: mx + ry * fz - rz * fy,
    y: my + rz * fx - rx * fz,
    z: mz + rx * fy - ry * fx,
  });
}

export function resolveFlangeOpeningLoads({ forceN = {}, momentNm = {}, openingAxis = 'positive-z' } = {}) {
  const fx = finite(forceN.x ?? 0, 'forceN.x');
  const fy = finite(forceN.y ?? 0, 'forceN.y');
  const fz = finite(forceN.z ?? 0, 'forceN.z');
  const mx = finite(momentNm.x ?? 0, 'momentNm.x');
  const my = finite(momentNm.y ?? 0, 'momentNm.y');
  const mz = finite(momentNm.z ?? 0, 'momentNm.z');
  if (!['positive-z', 'negative-z'].includes(openingAxis)) {
    const error = new RangeError('openingAxis must be positive-z or negative-z.');
    error.code = 'INPUT_INVALID';
    error.field = 'openingAxis';
    throw error;
  }

  const signedOpeningForce = openingAxis === 'positive-z' ? fz : -fz;
  return Object.freeze({
    openingAxialForceN: Math.max(0, signedOpeningForce),
    bendingMomentNm: Math.hypot(mx, my),
    torsionalMomentNm: Math.abs(mz),
    transverseShearN: Math.hypot(fx, fy),
  });
}
