import { transportLoadResultant } from '../mechanics/load-resultant.js';

export const JOINT_MODEL_CONTEXT_SCHEMA = 'JointModelContext.v1';
export const EXPLICIT_JOINT_FACE_RESOLVER_METHOD = 'FLANGE.MODEL_CONTEXT.EXPLICIT_FACE_RESULTANT';

const FRAME_TOLERANCE = 1e-9;
const OPENING_DIRECTIONS = Object.freeze(['POSITIVE_LOCAL_X', 'POSITIVE_LOCAL_Y', 'POSITIVE_LOCAL_Z']);

function fail(Type, field, message) {
  const error = new Type(message);
  error.code = 'INPUT_INVALID';
  error.field = field;
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) fail(TypeError, field, `${field} is required.`);
  return result;
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(TypeError, field, `${field} must be finite.`);
  return number;
}

function vector3(value, field) {
  return Object.freeze({
    x: finite(value?.x, `${field}.x`),
    y: finite(value?.y, `${field}.y`),
    z: finite(value?.z, `${field}.z`),
  });
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return Object.freeze({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
}

function norm(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function near(actual, expected, tolerance = FRAME_TOLERANCE) {
  return Math.abs(actual - expected) <= tolerance;
}

function validateAxis(value, field) {
  const axis = vector3(value, field);
  if (!near(norm(axis), 1)) fail(RangeError, field, `${field} must be a unit vector.`);
  return axis;
}

function validateFrame(value, globalFrameId) {
  const frameId = text(value?.frameId, 'faceFrame.frameId');
  if (frameId === globalFrameId) fail(RangeError, 'faceFrame.frameId', 'faceFrame.frameId must identify the local flange-face frame, not the global frame.');
  const xAxisGlobal = validateAxis(value?.xAxisGlobal, 'faceFrame.xAxisGlobal');
  const yAxisGlobal = validateAxis(value?.yAxisGlobal, 'faceFrame.yAxisGlobal');
  const zAxisGlobal = validateAxis(value?.zAxisGlobal, 'faceFrame.zAxisGlobal');

  if (!near(dot(xAxisGlobal, yAxisGlobal), 0)) fail(RangeError, 'faceFrame', 'Local X and Y axes must be orthogonal.');
  if (!near(dot(yAxisGlobal, zAxisGlobal), 0)) fail(RangeError, 'faceFrame', 'Local Y and Z axes must be orthogonal.');
  if (!near(dot(zAxisGlobal, xAxisGlobal), 0)) fail(RangeError, 'faceFrame', 'Local Z and X axes must be orthogonal.');
  if (!near(dot(cross(xAxisGlobal, yAxisGlobal), zAxisGlobal), 1)) {
    fail(RangeError, 'faceFrame', 'Local axes must form a right-handed frame with X cross Y = Z.');
  }

  const openingDirection = text(value?.openingDirection, 'faceFrame.openingDirection');
  if (!OPENING_DIRECTIONS.includes(openingDirection)) {
    fail(RangeError, 'faceFrame.openingDirection', `faceFrame.openingDirection must be one of ${OPENING_DIRECTIONS.join(', ')}.`);
  }

  return Object.freeze({
    frameId,
    xAxisGlobal,
    yAxisGlobal,
    zAxisGlobal,
    openingDirection,
    matingSideId: text(value?.matingSideId, 'faceFrame.matingSideId'),
    orthonormalRightHanded: true,
  });
}

function rotateGlobalToLocal(vector, frame) {
  return Object.freeze({
    x: dot(vector, frame.xAxisGlobal),
    y: dot(vector, frame.yAxisGlobal),
    z: dot(vector, frame.zAxisGlobal),
  });
}

function openingAxisKey(openingDirection) {
  if (openingDirection === 'POSITIVE_LOCAL_X') return 'x';
  if (openingDirection === 'POSITIVE_LOCAL_Y') return 'y';
  return 'z';
}

function transverseKeys(openingKey) {
  return ['x', 'y', 'z'].filter((key) => key !== openingKey);
}

function validateUnits(units) {
  if (units?.length !== 'm') fail(RangeError, 'units.length', 'units.length must be m.');
  if (units?.force !== 'N') fail(RangeError, 'units.force', 'units.force must be N.');
  if (units?.moment !== 'N.m') fail(RangeError, 'units.moment', 'units.moment must be N.m.');
  return Object.freeze({ length: 'm', force: 'N', moment: 'N.m' });
}

function validateBindings(value) {
  return Object.freeze({
    flangeMasterRecordId: text(value?.flangeMasterRecordId, 'masterBindings.flangeMasterRecordId'),
    boltMasterRecordId: text(value?.boltMasterRecordId, 'masterBindings.boltMasterRecordId'),
    gasketMasterRecordId: text(value?.gasketMasterRecordId, 'masterBindings.gasketMasterRecordId'),
    resolutionState: 'IDENTITY_ONLY_NOT_RESOLVED',
  });
}

function resolveLoadCase(loadCase, index, globalFrameId, facePointM, frame) {
  const prefix = `loadCases[${index}]`;
  const caseId = text(loadCase?.caseId, `${prefix}.caseId`);
  const sourceFrameId = text(loadCase?.sourceFrameId, `${prefix}.sourceFrameId`);
  if (sourceFrameId !== globalFrameId) {
    fail(RangeError, `${prefix}.sourceFrameId`, 'Load components must be supplied in the declared global frame.');
  }

  const transported = transportLoadResultant({
    forceN: vector3(loadCase?.forceN, `${prefix}.forceN`),
    momentNm: vector3(loadCase?.momentNm, `${prefix}.momentNm`),
    sourcePointM: vector3(loadCase?.sourcePointM, `${prefix}.sourcePointM`),
    targetPointM: facePointM,
  });
  const forceLocalN = rotateGlobalToLocal(transported.forceN, frame);
  const momentLocalNm = rotateGlobalToLocal(transported.momentNm, frame);
  const openingKey = openingAxisKey(frame.openingDirection);
  const [firstTransverse, secondTransverse] = transverseKeys(openingKey);
  const signedOpeningAxisForceN = forceLocalN[openingKey];

  return Object.freeze({
    caseId,
    sourceId: text(loadCase?.sourceId, `${prefix}.sourceId`),
    sourceFrameId,
    sourcePointM: transported.sourcePointM,
    facePointM: transported.targetPointM,
    forceAtFaceGlobalN: transported.forceN,
    momentAtFaceGlobalNm: transported.momentNm,
    forceAtFaceLocalN: forceLocalN,
    momentAtFaceLocalNm: momentLocalNm,
    openingDirection: frame.openingDirection,
    signedOpeningAxisForceN,
    positiveOpeningForceN: Math.max(0, signedOpeningAxisForceN),
    closingForceN: Math.max(0, -signedOpeningAxisForceN),
    transverseShearResultantN: Math.hypot(forceLocalN[firstTransverse], forceLocalN[secondTransverse]),
    bendingMomentResultantNm: Math.hypot(momentLocalNm[firstTransverse], momentLocalNm[secondTransverse]),
    torsionalMomentNm: momentLocalNm[openingKey],
    transportRelationship: transported.relationship,
  });
}

export function resolveExplicitJointModelContext(input = {}) {
  if (input.schema !== JOINT_MODEL_CONTEXT_SCHEMA) {
    fail(RangeError, 'schema', `schema must equal ${JOINT_MODEL_CONTEXT_SCHEMA}.`);
  }
  const globalFrameId = text(input.globalFrameId, 'globalFrameId');
  const facePointM = vector3(input.facePointM, 'facePointM');
  const faceFrame = validateFrame(input.faceFrame, globalFrameId);
  const units = validateUnits(input.units);
  const masterBindings = validateBindings(input.masterBindings);

  if (!Array.isArray(input.loadCases) || input.loadCases.length === 0) {
    fail(TypeError, 'loadCases', 'loadCases must be a non-empty array.');
  }
  const loadCases = input.loadCases.map((loadCase, index) => resolveLoadCase(loadCase, index, globalFrameId, facePointM, faceFrame));
  const seen = new Set();
  for (const loadCase of loadCases) {
    if (seen.has(loadCase.caseId)) fail(RangeError, 'loadCases', `Duplicate caseId: ${loadCase.caseId}`);
    seen.add(loadCase.caseId);
  }

  return Object.freeze({
    schema: JOINT_MODEL_CONTEXT_SCHEMA,
    method: EXPLICIT_JOINT_FACE_RESOLVER_METHOD,
    sourceAuthority: 'EXPLICIT_CALLER_SUPPLIED_CONTEXT_ONLY',
    modelId: text(input.modelId, 'modelId'),
    modelRevisionId: text(input.modelRevisionId, 'modelRevisionId'),
    jointId: text(input.jointId, 'jointId'),
    componentId: text(input.componentId, 'componentId'),
    globalFrameId,
    facePointM,
    faceFrame,
    units,
    masterBindings,
    loadCases: Object.freeze(loadCases),
    automaticModelRoute: false,
    masterBindingsResolved: false,
    solverInvoked: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}
