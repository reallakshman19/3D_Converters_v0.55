import { distributeLinearBoltGroupLoads } from './group-loads.js';
import { transportLoadResultant } from '../mechanics/load-resultant.js';

export const BOLT_GROUP_REFERENCE_METHOD_ID = 'BOLT.GROUP.LINEAR_RIGID_PLATE.REFERENCE';
export const BOLT_GROUP_COORDINATE_CONVENTION = 'RIGHT_HANDED_XY_BOLT_PLANE_Z_NORMAL';

function fail(Type, code, message, field = null) {
  const error = new Type(message);
  error.code = code;
  if (field) error.field = field;
  throw error;
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(TypeError, 'INPUT_INVALID', `${field} must be finite.`, field);
  return number;
}

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) fail(TypeError, 'INPUT_INVALID', `${field} is required.`, field);
  return result;
}

function vector3(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(TypeError, 'INPUT_INVALID', `${field} must be an x/y/z object.`, field);
  }
  return Object.freeze({
    x: finite(value.x, `${field}.x`),
    y: finite(value.y, `${field}.y`),
    z: finite(value.z, `${field}.z`),
  });
}

function normalizeBolts(bolts) {
  if (!Array.isArray(bolts) || bolts.length < 3) {
    fail(RangeError, 'BOLT_GROUP_GEOMETRY_INVALID', 'At least three planar bolt coordinates are required.', 'bolts');
  }
  const rows = bolts.map((bolt, index) => Object.freeze({
    id: requiredText(bolt?.id, `bolts[${index}].id`),
    xM: finite(bolt?.xM, `bolts[${index}].xM`),
    yM: finite(bolt?.yM, `bolts[${index}].yM`),
    zM: finite(bolt?.zM, `bolts[${index}].zM`),
  }));
  if (new Set(rows.map((row) => row.id)).size !== rows.length) {
    fail(RangeError, 'BOLT_GROUP_ID_DUPLICATE', 'Bolt ids must be unique.', 'bolts');
  }
  const z0 = rows[0].zM;
  const toleranceM = Math.max(1e-12, Math.abs(z0) * 1e-12);
  if (rows.some((row) => Math.abs(row.zM - z0) > toleranceM)) {
    fail(RangeError, 'BOLT_GROUP_NOT_PLANAR', 'All bolt coordinates must lie in one z plane.', 'bolts');
  }
  return Object.freeze(rows);
}

function boltCentroid(bolts) {
  const count = bolts.length;
  return Object.freeze({
    x: bolts.reduce((sum, row) => sum + row.xM, 0) / count,
    y: bolts.reduce((sum, row) => sum + row.yM, 0) / count,
    z: bolts[0].zM,
  });
}

function normalizeLoadCase(loadCase, index) {
  if (!loadCase || typeof loadCase !== 'object' || Array.isArray(loadCase)) {
    fail(TypeError, 'INPUT_INVALID', `loadCases[${index}] must be an object.`, `loadCases[${index}]`);
  }
  return Object.freeze({
    id: requiredText(loadCase.id, `loadCases[${index}].id`),
    forceN: vector3(loadCase.forceN, `loadCases[${index}].forceN`),
    momentNm: vector3(loadCase.momentNm, `loadCases[${index}].momentNm`),
    referencePointM: vector3(loadCase.referencePointM, `loadCases[${index}].referencePointM`),
  });
}

function combinationBoundary() {
  return Object.freeze({
    state: 'NOT_MODELED',
    preloadCombinationPermitted: false,
    directExternalAxialIncrementPermitted: false,
    reason: 'A qualified bolt/joint stiffness, contact/separation and preload-loss model is required before external axial force can be combined with assembly preload.',
  });
}

function decorateBoltRows(kernelRows, inputBolts) {
  const byId = new Map(inputBolts.map((row) => [row.id, row]));
  return Object.freeze(kernelRows.map((row) => {
    const input = byId.get(row.id);
    return Object.freeze({
      id: row.id,
      pointM: Object.freeze({ x: input.xM, y: input.yM, z: input.zM }),
      relativeToCentroidM: Object.freeze({ x: row.xM, y: row.yM, z: 0 }),
      externalAxialN: row.externalAxialN,
      shearN: Object.freeze({ x: row.shearXn, y: row.shearYn }),
      shearResultantN: row.shearResultantN,
    });
  }));
}

function runKernel(bolts, transported) {
  try {
    return distributeLinearBoltGroupLoads({
      bolts: bolts.map((row) => ({ id: row.id, xM: row.xM, yM: row.yM })),
      forceN: transported.forceN,
      momentNm: transported.momentNm,
    });
  } catch (error) {
    if (/degenerate|collinear/i.test(String(error?.message))) {
      error.code = 'BOLT_GROUP_GEOMETRY_DEGENERATE';
    }
    throw error;
  }
}

function evaluateNormalizedCase({ frameId, coordinateConvention, bolts, centroid, loadCase }) {
  const transported = transportLoadResultant({
    forceN: loadCase.forceN,
    momentNm: loadCase.momentNm,
    sourcePointM: loadCase.referencePointM,
    targetPointM: centroid,
  });
  const kernel = runKernel(bolts, transported);
  return Object.freeze({
    ok: true,
    methodId: BOLT_GROUP_REFERENCE_METHOD_ID,
    method: kernel.method,
    authority: 'REFERENCE_KERNEL_ONLY',
    frameId,
    coordinateConvention,
    loadCaseId: loadCase.id,
    boltGroupCentroidM: centroid,
    inputResultant: Object.freeze({
      forceN: loadCase.forceN,
      momentNm: loadCase.momentNm,
      referencePointM: loadCase.referencePointM,
    }),
    centroidResultant: Object.freeze({ forceN: transported.forceN, momentNm: transported.momentNm }),
    transport: Object.freeze({
      targetToSourceM: transported.targetToSourceM,
      addedMomentNm: transported.addedMomentNm,
      relationship: transported.relationship,
    }),
    geometry: Object.freeze({ ...kernel.geometry, planar: true, boltCount: bolts.length }),
    bolts: decorateBoltRows(kernel.bolts, bolts),
    equilibrium: Object.freeze({ ...kernel.equilibrium, referencePoint: 'BOLT_GROUP_CENTROID' }),
    preloadCombination: combinationBoundary(),
    assumptions: Object.freeze([
      ...kernel.assumptions,
      'Bolt coordinates and the six-DOF load resultant are expressed in the declared common local frame.',
      'All bolts are planar and the z axis is normal to the bolt plane.',
      'Load-resultant transport is rigid-body statics only; no global-to-local rotation is performed here.',
    ]),
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}

function governingBy(rows, selector, preferGreater = true) {
  return rows.reduce((best, row) => {
    if (!best) return row;
    const current = selector(row);
    const chosen = selector(best);
    return (preferGreater ? current > chosen : current < chosen) ? row : best;
  }, null);
}

function envelopeForBolt(id, cases) {
  const rows = cases.map((caseResult) => ({
    caseId: caseResult.loadCaseId,
    ...caseResult.bolts.find((bolt) => bolt.id === id),
  }));
  const maxAxial = governingBy(rows, (row) => row.externalAxialN);
  const minAxial = governingBy(rows, (row) => row.externalAxialN, false);
  const maxAbsAxial = governingBy(rows, (row) => Math.abs(row.externalAxialN));
  const maxShear = governingBy(rows, (row) => row.shearResultantN);
  return Object.freeze({
    id,
    maxExternalAxialN: maxAxial.externalAxialN,
    maxExternalAxialCaseId: maxAxial.caseId,
    minExternalAxialN: minAxial.externalAxialN,
    minExternalAxialCaseId: minAxial.caseId,
    maxAbsExternalAxialN: Math.abs(maxAbsAxial.externalAxialN),
    maxAbsExternalAxialCaseId: maxAbsAxial.caseId,
    maxShearResultantN: maxShear.shearResultantN,
    maxShearCaseId: maxShear.caseId,
  });
}

export function evaluateBoltGroupLoadCase({
  frameId,
  coordinateConvention = BOLT_GROUP_COORDINATE_CONVENTION,
  bolts,
  loadCase,
} = {}) {
  const normalizedFrameId = requiredText(frameId, 'frameId');
  if (coordinateConvention !== BOLT_GROUP_COORDINATE_CONVENTION) {
    fail(RangeError, 'COORDINATE_CONVENTION_UNSUPPORTED', `coordinateConvention must be ${BOLT_GROUP_COORDINATE_CONVENTION}.`, 'coordinateConvention');
  }
  const normalizedBolts = normalizeBolts(bolts);
  const centroid = boltCentroid(normalizedBolts);
  const normalizedCase = normalizeLoadCase(loadCase, 0);
  return evaluateNormalizedCase({
    frameId: normalizedFrameId,
    coordinateConvention,
    bolts: normalizedBolts,
    centroid,
    loadCase: normalizedCase,
  });
}

export function evaluateBoltGroupLoadCases({
  frameId,
  coordinateConvention = BOLT_GROUP_COORDINATE_CONVENTION,
  bolts,
  loadCases,
} = {}) {
  const normalizedFrameId = requiredText(frameId, 'frameId');
  if (coordinateConvention !== BOLT_GROUP_COORDINATE_CONVENTION) {
    fail(RangeError, 'COORDINATE_CONVENTION_UNSUPPORTED', `coordinateConvention must be ${BOLT_GROUP_COORDINATE_CONVENTION}.`, 'coordinateConvention');
  }
  const normalizedBolts = normalizeBolts(bolts);
  if (!Array.isArray(loadCases) || !loadCases.length) {
    fail(RangeError, 'LOAD_CASES_REQUIRED', 'At least one load case is required.', 'loadCases');
  }
  const normalizedCases = Object.freeze(loadCases.map(normalizeLoadCase));
  if (new Set(normalizedCases.map((row) => row.id)).size !== normalizedCases.length) {
    fail(RangeError, 'LOAD_CASE_ID_DUPLICATE', 'Load-case ids must be unique.', 'loadCases');
  }
  const centroid = boltCentroid(normalizedBolts);
  const cases = Object.freeze(normalizedCases.map((loadCase) => evaluateNormalizedCase({
    frameId: normalizedFrameId,
    coordinateConvention,
    bolts: normalizedBolts,
    centroid,
    loadCase,
  })));
  return Object.freeze({
    ok: true,
    methodId: BOLT_GROUP_REFERENCE_METHOD_ID,
    authority: 'REFERENCE_KERNEL_ONLY',
    frameId: normalizedFrameId,
    coordinateConvention,
    boltGroupCentroidM: centroid,
    cases,
    envelope: Object.freeze(normalizedBolts.map((bolt) => envelopeForBolt(bolt.id, cases))),
    preloadCombination: combinationBoundary(),
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}
