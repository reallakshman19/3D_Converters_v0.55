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

function vector3(value = {}, field) {
  return Object.freeze({
    x: finite(value.x, `${field}.x`),
    y: finite(value.y, `${field}.y`),
    z: finite(value.z, `${field}.z`),
  });
}

function subtract(a, b) {
  return Object.freeze({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
}

function cross(a, b) {
  return Object.freeze({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
}

/**
 * Transport a force/moment resultant between two points in the same Cartesian frame.
 *
 * M_target = M_source + (r_source - r_target) x F
 */
export function transportLoadResultant({
  forceN,
  momentNm,
  sourcePointM,
  targetPointM,
} = {}) {
  const force = vector3(forceN, 'forceN');
  const sourceMoment = vector3(momentNm, 'momentNm');
  const source = vector3(sourcePointM, 'sourcePointM');
  const target = vector3(targetPointM, 'targetPointM');
  const targetToSourceM = subtract(source, target);
  const addedMomentNm = cross(targetToSourceM, force);

  return Object.freeze({
    forceN: force,
    momentNm: Object.freeze({
      x: sourceMoment.x + addedMomentNm.x,
      y: sourceMoment.y + addedMomentNm.y,
      z: sourceMoment.z + addedMomentNm.z,
    }),
    sourcePointM: source,
    targetPointM: target,
    targetToSourceM,
    addedMomentNm,
    relationship: 'M_TARGET_EQUALS_M_SOURCE_PLUS_TARGET_TO_SOURCE_CROSS_FORCE',
  });
}
