function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite.`);
  return number;
}

function point(bolt, index) {
  return {
    id: String(bolt?.id ?? `BOLT-${index + 1}`),
    x: finite(bolt?.xM, `bolts[${index}].xM`),
    y: finite(bolt?.yM, `bolts[${index}].yM`),
  };
}

function loadVector(load = {}) {
  return {
    fx: finite(load.forceN?.x ?? 0, 'forceN.x'),
    fy: finite(load.forceN?.y ?? 0, 'forceN.y'),
    fz: finite(load.forceN?.z ?? 0, 'forceN.z'),
    mx: finite(load.momentNm?.x ?? 0, 'momentNm.x'),
    my: finite(load.momentNm?.y ?? 0, 'momentNm.y'),
    mz: finite(load.momentNm?.z ?? 0, 'momentNm.z'),
  };
}

function centroid(points) {
  const n = points.length;
  return {
    xM: points.reduce((sum, row) => sum + row.x, 0) / n,
    yM: points.reduce((sum, row) => sum + row.y, 0) / n,
  };
}

function centeredPoints(points, center) {
  return points.map((row) => ({
    id: row.id,
    xM: row.x - center.xM,
    yM: row.y - center.yM,
  }));
}

function geometry(points) {
  const sxx = points.reduce((sum, row) => sum + row.xM ** 2, 0);
  const syy = points.reduce((sum, row) => sum + row.yM ** 2, 0);
  const sxy = points.reduce((sum, row) => sum + row.xM * row.yM, 0);
  const determinant = sxx * syy - sxy ** 2;
  const polar = sxx + syy;
  const conditioning = sxx > 0 && syy > 0 ? determinant / (sxx * syy) : 0;
  if (!(polar > 0) || !(determinant > 0) || conditioning < 1e-12) {
    throw new RangeError('Bolt group geometry is degenerate or near-collinear for six-DOF linear distribution.');
  }
  return { sxxM2: sxx, syyM2: syy, sxyM2: sxy, determinantM4: determinant, polarM2: polar, conditioning };
}

function axialCoefficients(load, geom) {
  const { mx, my } = load;
  const d = geom.determinantM4;
  return {
    bxNPerM: -(mx * geom.sxyM2 + my * geom.syyM2) / d,
    byNPerM: (mx * geom.sxxM2 + my * geom.sxyM2) / d,
  };
}

function distributeBolt(pointRow, load, geom, axial, count) {
  const directAxial = load.fz / count;
  const directShearX = load.fx / count;
  const directShearY = load.fy / count;
  const externalAxialN = directAxial + axial.bxNPerM * pointRow.xM + axial.byNPerM * pointRow.yM;
  const torsionScale = load.mz / geom.polarM2;
  const shearXn = directShearX - torsionScale * pointRow.yM;
  const shearYn = directShearY + torsionScale * pointRow.xM;
  return {
    ...pointRow,
    externalAxialN,
    shearXn,
    shearYn,
    shearResultantN: Math.hypot(shearXn, shearYn),
  };
}

function recoveredResultant(rows) {
  return rows.reduce((sum, row) => ({
    fx: sum.fx + row.shearXn,
    fy: sum.fy + row.shearYn,
    fz: sum.fz + row.externalAxialN,
    mx: sum.mx + row.yM * row.externalAxialN,
    my: sum.my - row.xM * row.externalAxialN,
    mz: sum.mz + row.xM * row.shearYn - row.yM * row.shearXn,
  }), { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
}

function equilibrium(load, recovered) {
  return {
    applied: { ...load },
    recovered: { ...recovered },
    residual: {
      fxN: recovered.fx - load.fx,
      fyN: recovered.fy - load.fy,
      fzN: recovered.fz - load.fz,
      mxNm: recovered.mx - load.mx,
      myNm: recovered.my - load.my,
      mzNm: recovered.mz - load.mz,
    },
  };
}

export function distributeLinearBoltGroupLoads({ bolts = [], forceN = {}, momentNm = {} } = {}) {
  if (!Array.isArray(bolts) || bolts.length < 3) {
    throw new RangeError('At least three non-collinear bolt coordinates are required.');
  }
  const points = bolts.map(point);
  if (new Set(points.map((row) => row.id)).size !== points.length) {
    throw new RangeError('Bolt ids must be unique.');
  }
  const center = centroid(points);
  const centered = centeredPoints(points, center);
  const geom = geometry(centered);
  const load = loadVector({ forceN, momentNm });
  const axial = axialCoefficients(load, geom);
  const rows = centered.map((row) => distributeBolt(row, load, geom, axial, centered.length));
  const recovered = recoveredResultant(rows);
  return {
    method: 'LINEAR_RIGID_PLATE_EQUAL_BOLT_STIFFNESS_REFERENCE',
    centroidM: center,
    geometry: geom,
    bolts: rows,
    equilibrium: equilibrium(load, recovered),
    assumptions: [
      'Loads are already expressed in the bolt-group local frame at the bolt-group centroid.',
      'Rigid plate and equal bolt axial/shear stiffness are assumed.',
      'External axial bolt force is signed and is not clipped for contact or separation.',
      'Joint friction, slip sharing, prying, plate flexibility and nonlinear contact are not modeled.',
    ],
    canUseForDesignAuthority: false,
  };
}
