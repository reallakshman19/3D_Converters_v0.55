import {
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
} from './advanced-analysis-interface-adapter.js';
import { semanticHashAdvancedAnalysis } from './advanced-analysis-semantic-hash.js';

export const FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA = 'FlangeFaceBindingSourceRegister.v1';
export const FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA = 'FlangeFaceBindingSourceRecord.v1';
export const FLANGE_FACE_BINDING_SOURCE_AUTHORITY = 'PROJECT_SOURCE_CUSTODY_ONLY';

export const FLANGE_FACE_BINDING_SOURCE_RECORD_STATES = Object.freeze([
  'DRAFT',
  'PROJECT_CONTROLLED',
  'INDEPENDENTLY_CHECKED',
  'RETIRED',
]);

const MODEL_KEYS = Object.freeze([
  'modelId', 'modelRevisionId', 'globalFrameId', 'lengthUnit', 'sourceSchema', 'sourceKind',
  'sourceFile', 'sourceRef', 'sourcePath', 'nativeKind', 'componentRole',
]);
const JOINT_KEYS = Object.freeze([
  'jointId', 'componentId', 'selectedFaceId', 'selectedPortId', 'matingSideId',
]);
const GEOMETRY_KEYS = Object.freeze(['referencePointGlobalM', 'openingDirection']);
const ANALYSIS_KEYS = Object.freeze([
  'sourceRepository', 'sourceCommit', 'interfaceSetSemanticHash', 'interfaceId',
  'interfaceSemanticHash', 'frameSemanticHash', 'reportingSignConvention',
]);
const SOURCE_CONTROL_KEYS = Object.freeze([
  'bindingSourceId', 'modelEntitySourceId', 'calculationFaceSourceId', 'openingDirectionSourceId',
  'matingSideSourceId', 'globalFrameSourceId', 'analysisInterfaceSourceId',
]);
const AMBIGUITY_KEYS = Object.freeze([
  'identityPolicy', 'ambiguityDisposition', 'candidateCount', 'positionToleranceM',
  'orientationToleranceRad', 'toleranceSourceId',
]);
const RECORD_KEYS = Object.freeze([
  'schema', 'recordId', 'recordRevisionId', 'recordState', 'projectId', 'model', 'joint',
  'geometry', 'analysisInterface', 'sourceControl', 'ambiguityPolicy', 'semanticHash',
]);
const OPENING_DIRECTIONS = Object.freeze([
  'POSITIVE_LOCAL_X',
  'POSITIVE_LOCAL_Y',
  'POSITIVE_LOCAL_Z',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value, field, errors) {
  const result = String(value ?? '').trim();
  if (!result) errors.push(`${field} is required.`);
  return result;
}

function finite(value, field, errors, minimum = Number.NEGATIVE_INFINITY) {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    errors.push(`${field} must be finite.`);
    return null;
  }
  if (result < minimum) errors.push(`${field} must be >= ${minimum}.`);
  return result;
}

function exactKeys(record, expected, field, errors) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push(`${field} must be a record.`);
    return false;
  }
  const actual = Object.keys(record).sort();
  const target = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(target)) {
    errors.push(`${field} keys do not match the v1 contract.`);
    return false;
  }
  return true;
}

function vector(value, field, errors) {
  if (!exactKeys(value, ['x', 'y', 'z'], field, errors)) return null;
  return {
    x: finite(value.x, `${field}.x`, errors),
    y: finite(value.y, `${field}.y`, errors),
    z: finite(value.z, `${field}.z`, errors),
  };
}

function validateRecordShape(source = {}) {
  const errors = [];
  if (!exactKeys(source, RECORD_KEYS, 'record', errors)) return { ok: false, errors };
  if (source.schema !== FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA) {
    errors.push(`schema must equal ${FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA}.`);
  }
  text(source.recordId, 'recordId', errors);
  text(source.recordRevisionId, 'recordRevisionId', errors);
  text(source.projectId, 'projectId', errors);
  if (!FLANGE_FACE_BINDING_SOURCE_RECORD_STATES.includes(source.recordState)) {
    errors.push('recordState is unsupported.');
  }

  if (exactKeys(source.model, MODEL_KEYS, 'model', errors)) {
    text(source.model.modelId, 'model.modelId', errors);
    text(source.model.modelRevisionId, 'model.modelRevisionId', errors);
    text(source.model.globalFrameId, 'model.globalFrameId', errors);
    if (source.model.lengthUnit !== 'm') errors.push('model.lengthUnit must equal m.');
    if (source.model.sourceSchema !== 'rvm-converter-stage/v1') {
      errors.push('model.sourceSchema must equal rvm-converter-stage/v1.');
    }
    text(source.model.sourceKind, 'model.sourceKind', errors);
    text(source.model.sourceFile, 'model.sourceFile', errors);
    text(source.model.sourceRef, 'model.sourceRef', errors);
    text(source.model.sourcePath, 'model.sourcePath', errors);
    text(source.model.nativeKind, 'model.nativeKind', errors);
    if (source.model.componentRole !== 'PHYSICAL_FLANGE') {
      errors.push('model.componentRole must equal PHYSICAL_FLANGE.');
    }
  }

  if (exactKeys(source.joint, JOINT_KEYS, 'joint', errors)) {
    JOINT_KEYS.forEach((key) => text(source.joint[key], `joint.${key}`, errors));
  }

  if (exactKeys(source.geometry, GEOMETRY_KEYS, 'geometry', errors)) {
    vector(source.geometry.referencePointGlobalM, 'geometry.referencePointGlobalM', errors);
    if (!OPENING_DIRECTIONS.includes(source.geometry.openingDirection)) {
      errors.push(`geometry.openingDirection must be one of ${OPENING_DIRECTIONS.join(', ')}.`);
    }
  }

  if (exactKeys(source.analysisInterface, ANALYSIS_KEYS, 'analysisInterface', errors)) {
    if (source.analysisInterface.sourceRepository !== ADVANCED_ANALYSIS_SOURCE_REPOSITORY) {
      errors.push(`analysisInterface.sourceRepository must equal ${ADVANCED_ANALYSIS_SOURCE_REPOSITORY}.`);
    }
    if (source.analysisInterface.sourceCommit !== ADVANCED_ANALYSIS_SOURCE_COMMIT) {
      errors.push(`analysisInterface.sourceCommit must equal ${ADVANCED_ANALYSIS_SOURCE_COMMIT}.`);
    }
    ANALYSIS_KEYS.slice(2).forEach((key) => text(source.analysisInterface[key], `analysisInterface.${key}`, errors));
  }

  if (exactKeys(source.sourceControl, SOURCE_CONTROL_KEYS, 'sourceControl', errors)) {
    SOURCE_CONTROL_KEYS.forEach((key) => text(source.sourceControl[key], `sourceControl.${key}`, errors));
  }

  if (exactKeys(source.ambiguityPolicy, AMBIGUITY_KEYS, 'ambiguityPolicy', errors)) {
    if (source.ambiguityPolicy.identityPolicy !== 'EXACT_IDENTIFIERS_ONLY') {
      errors.push('ambiguityPolicy.identityPolicy must equal EXACT_IDENTIFIERS_ONLY.');
    }
    if (source.ambiguityPolicy.ambiguityDisposition !== 'UNAMBIGUOUS_REQUIRED') {
      errors.push('ambiguityPolicy.ambiguityDisposition must equal UNAMBIGUOUS_REQUIRED.');
    }
    const count = finite(source.ambiguityPolicy.candidateCount, 'ambiguityPolicy.candidateCount', errors, 0);
    if (count !== null && !Number.isInteger(count)) errors.push('ambiguityPolicy.candidateCount must be an integer.');
    if (count !== null && count !== 1) errors.push('ambiguityPolicy.candidateCount must equal 1.');
    finite(source.ambiguityPolicy.positionToleranceM, 'ambiguityPolicy.positionToleranceM', errors, 0);
    finite(source.ambiguityPolicy.orientationToleranceRad, 'ambiguityPolicy.orientationToleranceRad', errors, 0);
    text(source.ambiguityPolicy.toleranceSourceId, 'ambiguityPolicy.toleranceSourceId', errors);
  }

  return { ok: errors.length === 0, errors };
}

function recordProjection(record) {
  const { semanticHash: _semanticHash, ...projection } = record;
  return projection;
}

export function sealFlangeFaceBindingSourceRecord(source = {}) {
  const validation = validateRecordShape(source);
  if (!validation.ok) {
    const error = new RangeError(validation.errors.join(' '));
    error.code = 'FLANGE_FACE_BINDING_SOURCE_RECORD_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  const expected = semanticHashAdvancedAnalysis(recordProjection(source));
  if (source.semanticHash !== '' && source.semanticHash !== expected) {
    const error = new RangeError('semanticHash is stale.');
    error.code = 'FLANGE_FACE_BINDING_SOURCE_RECORD_INVALID';
    error.errors = ['semanticHash is stale.'];
    throw error;
  }
  return Object.freeze({ ...clone(source), semanticHash: expected });
}

export function createFlangeFaceBindingSourceRegister({ metadata = {}, records = [] } = {}) {
  return {
    schema: FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA,
    sourceAuthority: FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
    automaticBindingProducer: false,
    codeCompliance: false,
    designAuthority: false,
    governingEligible: false,
    metadata: clone(metadata),
    records: clone(records),
  };
}

export function validateFlangeFaceBindingSourceRegister(register = {}) {
  const errors = [];
  if (register.schema !== FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA) {
    errors.push(`schema must equal ${FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA}.`);
  }
  if (register.sourceAuthority !== FLANGE_FACE_BINDING_SOURCE_AUTHORITY) {
    errors.push(`sourceAuthority must equal ${FLANGE_FACE_BINDING_SOURCE_AUTHORITY}.`);
  }
  if (register.automaticBindingProducer !== false) errors.push('automaticBindingProducer must be false.');
  if (register.codeCompliance !== false) errors.push('codeCompliance must be false.');
  if (register.designAuthority !== false) errors.push('designAuthority must be false.');
  if (register.governingEligible !== false) errors.push('governingEligible must be false.');
  if (!Array.isArray(register.records)) {
    errors.push('records must be an array.');
    return { ok: false, errors };
  }
  const ids = new Set();
  for (const record of register.records) {
    const validation = validateRecordShape(record);
    errors.push(...validation.errors.map((message) => `${record?.recordId || 'record'}: ${message}`));
    const id = String(record?.recordId ?? '').trim();
    if (id && ids.has(id)) errors.push(`duplicate recordId: ${id}.`);
    if (id) ids.add(id);
    if (validation.ok) {
      const expected = semanticHashAdvancedAnalysis(recordProjection(record));
      if (record.semanticHash !== expected) errors.push(`${id}: semanticHash is missing or stale.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
