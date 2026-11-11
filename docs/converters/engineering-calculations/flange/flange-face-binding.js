import {
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
  adaptAdvancedAnalysisInterfaceToJointModelContext,
} from './advanced-analysis-interface-adapter.js';
import { semanticHashAdvancedAnalysis } from './advanced-analysis-semantic-hash.js';

export const FLANGE_FACE_BINDING_SCHEMA = 'FlangeFaceBinding.v1';
export const FLANGE_FACE_BINDING_METHOD = 'FLANGE.MODEL_CONTEXT.SEALED_FACE_BINDING_V1';
export const FLANGE_FACE_BINDING_SOURCE_AUTHORITY = 'CONTROLLED_PROJECT_SEMANTIC_BINDING_NON_AUTHORIZING';

const MODEL_ENTITY_KEYS = Object.freeze([
  'sourceSchema', 'sourceKind', 'sourceFile', 'sourceRef', 'sourcePath', 'nativeKind', 'componentRole',
]);
const ANALYSIS_INTERFACE_KEYS = Object.freeze([
  'sourceRepository', 'sourceCommit', 'interfaceSetSemanticHash', 'interfaceId',
  'interfaceSemanticHash', 'frameSemanticHash', 'reportingSignConvention',
]);
const FLANGE_FACE_KEYS = Object.freeze(['referencePointGlobal', 'openingDirection', 'matingSideId']);
const PROVENANCE_KEYS = Object.freeze([
  'bindingSourceId', 'modelEntitySourceId', 'referencePointSourceId', 'openingDirectionSourceId', 'matingSideSourceId',
]);
const BINDING_KEYS = Object.freeze([
  'schema', 'bindingId', 'bindingRevisionId', 'modelId', 'modelRevisionId', 'jointId', 'componentId',
  'globalFrameId', 'modelEntity', 'analysisInterface', 'flangeFace', 'provenance', 'semanticHash',
]);
const OPENING_DIRECTIONS = Object.freeze(['POSITIVE_LOCAL_X', 'POSITIVE_LOCAL_Y', 'POSITIVE_LOCAL_Z']);

function fail(field, message) {
  const error = new RangeError(message);
  error.code = 'FLANGE_FACE_BINDING_INVALID';
  error.field = field;
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) fail(field, `${field} is required.`);
  return result;
}

function finite(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result)) fail(field, `${field} must be finite.`);
  return result;
}

function exactKeys(record, expected, field) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(field, `${field} must be a record.`);
  const actual = Object.keys(record).sort();
  const target = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(target)) fail(field, `${field} keys do not match ${FLANGE_FACE_BINDING_SCHEMA}.`);
}

function vector(value, field) {
  exactKeys(value, ['x', 'y', 'z'], field);
  return Object.freeze({
    x: finite(value.x, `${field}.x`),
    y: finite(value.y, `${field}.y`),
    z: finite(value.z, `${field}.z`),
  });
}

function sameVector(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function canonicalModelEntity(source) {
  exactKeys(source, MODEL_ENTITY_KEYS, 'modelEntity');
  if (source.sourceSchema !== 'rvm-converter-stage/v1') {
    fail('modelEntity.sourceSchema', 'modelEntity.sourceSchema must equal rvm-converter-stage/v1.');
  }
  if (source.componentRole !== 'PHYSICAL_FLANGE') {
    fail('modelEntity.componentRole', 'modelEntity.componentRole must explicitly equal PHYSICAL_FLANGE.');
  }
  return Object.freeze({
    sourceSchema: source.sourceSchema,
    sourceKind: text(source.sourceKind, 'modelEntity.sourceKind'),
    sourceFile: text(source.sourceFile, 'modelEntity.sourceFile'),
    sourceRef: text(source.sourceRef, 'modelEntity.sourceRef'),
    sourcePath: text(source.sourcePath, 'modelEntity.sourcePath'),
    nativeKind: text(source.nativeKind, 'modelEntity.nativeKind'),
    componentRole: source.componentRole,
  });
}

function canonicalAnalysisInterface(source) {
  exactKeys(source, ANALYSIS_INTERFACE_KEYS, 'analysisInterface');
  if (source.sourceRepository !== ADVANCED_ANALYSIS_SOURCE_REPOSITORY) {
    fail('analysisInterface.sourceRepository', `analysisInterface.sourceRepository must equal ${ADVANCED_ANALYSIS_SOURCE_REPOSITORY}.`);
  }
  if (source.sourceCommit !== ADVANCED_ANALYSIS_SOURCE_COMMIT) {
    fail('analysisInterface.sourceCommit', `analysisInterface.sourceCommit must equal ${ADVANCED_ANALYSIS_SOURCE_COMMIT}.`);
  }
  return Object.freeze({
    sourceRepository: source.sourceRepository,
    sourceCommit: source.sourceCommit,
    interfaceSetSemanticHash: text(source.interfaceSetSemanticHash, 'analysisInterface.interfaceSetSemanticHash'),
    interfaceId: text(source.interfaceId, 'analysisInterface.interfaceId'),
    interfaceSemanticHash: text(source.interfaceSemanticHash, 'analysisInterface.interfaceSemanticHash'),
    frameSemanticHash: text(source.frameSemanticHash, 'analysisInterface.frameSemanticHash'),
    reportingSignConvention: text(source.reportingSignConvention, 'analysisInterface.reportingSignConvention'),
  });
}

function canonicalFlangeFace(source) {
  exactKeys(source, FLANGE_FACE_KEYS, 'flangeFace');
  const openingDirection = text(source.openingDirection, 'flangeFace.openingDirection');
  if (!OPENING_DIRECTIONS.includes(openingDirection)) {
    fail('flangeFace.openingDirection', `flangeFace.openingDirection must be one of ${OPENING_DIRECTIONS.join(', ')}.`);
  }
  return Object.freeze({
    referencePointGlobal: vector(source.referencePointGlobal, 'flangeFace.referencePointGlobal'),
    openingDirection,
    matingSideId: text(source.matingSideId, 'flangeFace.matingSideId'),
  });
}

function canonicalProvenance(source) {
  exactKeys(source, PROVENANCE_KEYS, 'provenance');
  return Object.freeze(Object.fromEntries(PROVENANCE_KEYS.map((key) => [key, text(source[key], `provenance.${key}`)])));
}

function bindingProjection(record) {
  const { semanticHash: _semanticHash, ...projection } = record;
  return projection;
}

export function sealFlangeFaceBinding(source = {}) {
  exactKeys(source, BINDING_KEYS, 'binding');
  if (source.schema !== FLANGE_FACE_BINDING_SCHEMA) fail('schema', `schema must equal ${FLANGE_FACE_BINDING_SCHEMA}.`);
  const draft = {
    schema: FLANGE_FACE_BINDING_SCHEMA,
    bindingId: text(source.bindingId, 'bindingId'),
    bindingRevisionId: text(source.bindingRevisionId, 'bindingRevisionId'),
    modelId: text(source.modelId, 'modelId'),
    modelRevisionId: text(source.modelRevisionId, 'modelRevisionId'),
    jointId: text(source.jointId, 'jointId'),
    componentId: text(source.componentId, 'componentId'),
    globalFrameId: text(source.globalFrameId, 'globalFrameId'),
    modelEntity: canonicalModelEntity(source.modelEntity),
    analysisInterface: canonicalAnalysisInterface(source.analysisInterface),
    flangeFace: canonicalFlangeFace(source.flangeFace),
    provenance: canonicalProvenance(source.provenance),
    semanticHash: '',
  };
  const expected = semanticHashAdvancedAnalysis(bindingProjection(draft));
  if (source.semanticHash !== '' && source.semanticHash !== expected) fail('semanticHash', 'binding.semanticHash is stale.');
  return Object.freeze({ ...draft, semanticHash: expected });
}

function requireBindingMatchesInterface(binding, interfaceSet) {
  const declared = binding.analysisInterface;
  if (interfaceSet?.semanticHash !== declared.interfaceSetSemanticHash) {
    fail('analysisInterface.interfaceSetSemanticHash', 'Binding interface-set hash differs from the supplied interface set.');
  }
  const definition = interfaceSet?.interfaces?.find((row) => row.interfaceId === declared.interfaceId);
  if (!definition) fail('analysisInterface.interfaceId', `Interface ${declared.interfaceId} is absent from the supplied interface set.`);
  if (definition.semanticHash !== declared.interfaceSemanticHash) {
    fail('analysisInterface.interfaceSemanticHash', 'Binding interface semantic hash differs from the supplied interface definition.');
  }
  const frameHash = semanticHashAdvancedAnalysis(definition.basis);
  if (frameHash !== declared.frameSemanticHash) fail('analysisInterface.frameSemanticHash', 'Binding frame hash differs from the supplied interface basis.');
  if (definition.reportingSignConvention !== declared.reportingSignConvention) {
    fail('analysisInterface.reportingSignConvention', 'Binding reporting sign convention differs from the supplied interface definition.');
  }
  const point = vector(definition.referencePointGlobal, 'interface.referencePointGlobal');
  if (!sameVector(point, binding.flangeFace.referencePointGlobal)) {
    fail('flangeFace.referencePointGlobal', 'Binding flange-face point differs from the qualified interface reference point.');
  }
  return definition;
}

export function adaptBoundAdvancedAnalysisFlangeToJointModelContext(input = {}) {
  const binding = sealFlangeFaceBinding(input.binding);
  requireBindingMatchesInterface(binding, input.interfaceSet);
  const adapted = adaptAdvancedAnalysisInterfaceToJointModelContext({
    sourceRepository: binding.analysisInterface.sourceRepository,
    sourceCommit: binding.analysisInterface.sourceCommit,
    interfaceSet: input.interfaceSet,
    recoveries: input.recoveries,
    interfaceId: binding.analysisInterface.interfaceId,
    referencePointRole: 'FLANGE_FACE',
    referencePointSourceId: binding.provenance.referencePointSourceId,
    openingDirection: binding.flangeFace.openingDirection,
    openingDirectionSourceId: binding.provenance.openingDirectionSourceId,
    requiredReportingSignConvention: binding.analysisInterface.reportingSignConvention,
    resultConsistencyTolerance: input.resultConsistencyTolerance,
    modelId: binding.modelId,
    modelRevisionId: binding.modelRevisionId,
    jointId: binding.jointId,
    componentId: binding.componentId,
    globalFrameId: binding.globalFrameId,
    matingSideId: binding.flangeFace.matingSideId,
    masterBindings: input.masterBindings,
  });
  return Object.freeze({
    method: FLANGE_FACE_BINDING_METHOD,
    sourceAuthority: FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
    bindingSemanticHash: binding.semanticHash,
    binding,
    modelEntity: binding.modelEntity,
    interfaceSetSemanticHash: binding.analysisInterface.interfaceSetSemanticHash,
    interfaceId: binding.analysisInterface.interfaceId,
    interfaceSemanticHash: binding.analysisInterface.interfaceSemanticHash,
    frameSemanticHash: binding.analysisInterface.frameSemanticHash,
    jointModelContext: adapted.jointModelContext,
    recoveryEvidence: adapted.recoveryEvidence,
    automatic3dExtraction: false,
    geometryInferenceUsed: false,
    masterBindingsResolved: false,
    solverInvoked: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}
