import { resolveExplicitJointModelContext, JOINT_MODEL_CONTEXT_SCHEMA } from './joint-model-context.js';
import { semanticHashAdvancedAnalysis } from './advanced-analysis-semantic-hash.js';

export const ADVANCED_ANALYSIS_SOURCE_REPOSITORY = 'reallaksh19/Advanced_Analysis';
export const ADVANCED_ANALYSIS_SOURCE_COMMIT = 'eabb93cd44c59ce182d73284cb707653917e07c8';
export const ADVANCED_ANALYSIS_INTERFACE_ADAPTER_METHOD = 'FLANGE.MODEL_CONTEXT.ADVANCED_ANALYSIS_INTERFACE_V1';

const INTERFACE_SET_SCHEMA = 'linear-piping-interface-set/v1';
const INTERFACE_RECOVERY_SCHEMA = 'linear-piping-interface-recovery/v1';
const ALLOWED_INTERFACE_KINDS = Object.freeze(['NOZZLE', 'EQUIPMENT']);
const SOURCE_UNITS = Object.freeze({ length: 'm', force: 'N', moment: 'N*m' });
const INTERFACE_SET_KEYS = Object.freeze([
  'schema', 'profileId', 'profileSemanticHash', 'mechanicalModelSemanticHash', 'stiffnessStateHash',
  'supportAttachmentModelSemanticHash', 'restraintCapabilityModelSemanticHash', 'interfaces', 'semanticHash', 'evidenceHash',
]);
const INTERFACE_KEYS = Object.freeze([
  'interfaceId', 'interfaceKind', 'nodeId', 'sourceEntityId', 'supportBinding', 'basis', 'basisQualification',
  'referencePointGlobal', 'leverReferenceToNodeLocal', 'dofMappings', 'reportingSignConvention', 'sourceEvidence',
  'allowableProfileHash', 'semanticHash',
]);
const RECOVERY_KEYS = Object.freeze([
  'schema', 'interfaceSetSemanticHash', 'analysisResultSemanticHash', 'executionHash', 'physicalLoadCaseHash',
  'loadCaseId', 'units', 'results', 'status', 'semanticHash', 'evidenceHash',
]);
const RESULT_KEYS = Object.freeze([
  'interfaceId', 'interfaceKind', 'nodeId', 'frameSemanticHash', 'reportingSignConvention', 'forceGlobal',
  'momentAtNodeGlobal', 'forceLocal', 'momentAtNodeLocal', 'momentAtReferenceLocal', 'referencePointGlobal',
  'leverReferenceToNodeLocal', 'sourceReactionDofs', 'formulaIds', 'semanticHash',
]);

function fail(field, message) {
  const error = new RangeError(message);
  error.code = 'ADVANCED_ANALYSIS_SOURCE_INVALID';
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
  if (JSON.stringify(actual) !== JSON.stringify(target)) fail(field, `${field} keys do not match the qualified source contract.`);
  return record;
}

function vector(value, field) {
  exactKeys(value, ['x', 'y', 'z'], field);
  return Object.freeze({ x: finite(value.x, `${field}.x`), y: finite(value.y, `${field}.y`), z: finite(value.z, `${field}.z`) });
}

function sameVector(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function maxVectorDelta(left, right) {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y), Math.abs(left.z - right.z));
}

function verifyInterfaceSet(record) {
  exactKeys(record, INTERFACE_SET_KEYS, 'interfaceSet');
  if (record.schema !== INTERFACE_SET_SCHEMA) fail('interfaceSet.schema', `interfaceSet.schema must equal ${INTERFACE_SET_SCHEMA}.`);
  if (!Array.isArray(record.interfaces) || record.interfaces.length === 0) fail('interfaceSet.interfaces', 'interfaceSet.interfaces must be non-empty.');
  for (const [index, definition] of record.interfaces.entries()) {
    exactKeys(definition, INTERFACE_KEYS, `interfaceSet.interfaces[${index}]`);
    const { semanticHash, ...projection } = definition;
    if (semanticHash !== semanticHashAdvancedAnalysis(projection)) fail(`interfaceSet.interfaces[${index}].semanticHash`, 'Interface semantic hash is stale.');
  }
  const expectedSemantic = semanticHashAdvancedAnalysis({
    schema: record.schema,
    profileId: record.profileId,
    profileSemanticHash: record.profileSemanticHash,
    mechanicalModelSemanticHash: record.mechanicalModelSemanticHash,
    stiffnessStateHash: record.stiffnessStateHash,
    supportAttachmentModelSemanticHash: record.supportAttachmentModelSemanticHash,
    restraintCapabilityModelSemanticHash: record.restraintCapabilityModelSemanticHash,
    interfaces: record.interfaces.map((row) => ({ interfaceId: row.interfaceId, semanticHash: row.semanticHash })),
  });
  if (record.semanticHash !== expectedSemantic) fail('interfaceSet.semanticHash', 'Interface-set semantic hash is stale.');
  const expectedEvidence = semanticHashAdvancedAnalysis({
    semanticHash: record.semanticHash,
    interfaceSourceEvidence: record.interfaces.map((row) => ({
      interfaceId: row.interfaceId,
      sourceEvidence: row.sourceEvidence,
      basisQualification: row.basisQualification,
    })),
  });
  if (record.evidenceHash !== expectedEvidence) fail('interfaceSet.evidenceHash', 'Interface-set evidence hash is stale.');
  return record;
}

function verifyRecovery(record, interfaceSet) {
  exactKeys(record, RECOVERY_KEYS, 'recovery');
  if (record.schema !== INTERFACE_RECOVERY_SCHEMA) fail('recovery.schema', `recovery.schema must equal ${INTERFACE_RECOVERY_SCHEMA}.`);
  if (record.interfaceSetSemanticHash !== interfaceSet.semanticHash) fail('recovery.interfaceSetSemanticHash', 'Recovery is stale against the supplied interface set.');
  if (!Array.isArray(record.results) || record.results.length === 0) fail('recovery.results', 'recovery.results must be non-empty.');
  for (const [index, result] of record.results.entries()) {
    exactKeys(result, RESULT_KEYS, `recovery.results[${index}]`);
    const { semanticHash, ...projection } = result;
    if (semanticHash !== semanticHashAdvancedAnalysis(projection)) fail(`recovery.results[${index}].semanticHash`, 'Interface-result semantic hash is stale.');
  }
  const expectedIds = interfaceSet.interfaces.map((row) => row.interfaceId).sort();
  const actualIds = record.results.map((row) => row.interfaceId).sort();
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) fail('recovery.results', 'Recovery interface identities differ from the supplied interface set.');
  const expectedSemantic = semanticHashAdvancedAnalysis({
    schema: record.schema,
    interfaceSetSemanticHash: record.interfaceSetSemanticHash,
    analysisResultSemanticHash: record.analysisResultSemanticHash,
    executionHash: record.executionHash,
    physicalLoadCaseHash: record.physicalLoadCaseHash,
    loadCaseId: record.loadCaseId,
    units: record.units,
    results: record.results.map((row) => ({ interfaceId: row.interfaceId, semanticHash: row.semanticHash })),
    status: record.status,
  });
  if (record.semanticHash !== expectedSemantic) fail('recovery.semanticHash', 'Recovery semantic hash is stale.');
  const expectedEvidence = semanticHashAdvancedAnalysis({
    semanticHash: record.semanticHash,
    sourceReactionDofs: record.results.map((row) => ({
      interfaceId: row.interfaceId,
      sourceReactionDofs: row.sourceReactionDofs,
      formulaIds: row.formulaIds,
    })),
  });
  if (record.evidenceHash !== expectedEvidence) fail('recovery.evidenceHash', 'Recovery evidence hash is stale.');
  return record;
}

function requireSourceUnits(units) {
  exactKeys(units, ['force', 'moment', 'length'], 'recovery.units');
  for (const key of Object.keys(SOURCE_UNITS)) {
    if (units[key] !== SOURCE_UNITS[key]) fail(`recovery.units.${key}`, `Advanced_Analysis ${key} unit must be ${SOURCE_UNITS[key]}.`);
  }
}

export function adaptAdvancedAnalysisInterfaceToJointModelContext(input = {}) {
  if (input.sourceRepository !== ADVANCED_ANALYSIS_SOURCE_REPOSITORY) fail('sourceRepository', `sourceRepository must equal ${ADVANCED_ANALYSIS_SOURCE_REPOSITORY}.`);
  if (input.sourceCommit !== ADVANCED_ANALYSIS_SOURCE_COMMIT) fail('sourceCommit', `sourceCommit must equal ${ADVANCED_ANALYSIS_SOURCE_COMMIT}.`);
  if (input.referencePointRole !== 'FLANGE_FACE') fail('referencePointRole', 'referencePointRole must explicitly equal FLANGE_FACE.');
  const tolerance = finite(input.resultConsistencyTolerance, 'resultConsistencyTolerance');
  if (tolerance < 0) fail('resultConsistencyTolerance', 'resultConsistencyTolerance must be non-negative.');
  const interfaceSet = verifyInterfaceSet(input.interfaceSet);
  const interfaceId = text(input.interfaceId, 'interfaceId');
  const definition = interfaceSet.interfaces.find((row) => row.interfaceId === interfaceId);
  if (!definition) fail('interfaceId', `Interface ${interfaceId} is absent from interfaceSet.`);
  if (!ALLOWED_INTERFACE_KINDS.includes(definition.interfaceKind)) fail('interfaceKind', 'Only NOZZLE or EQUIPMENT interfaces are admitted for this flange adapter.');
  const basis = definition.basis;
  const facePointM = vector(definition.referencePointGlobal, 'interface.referencePointGlobal');
  const sourcePointM = vector(basis.origin, 'interface.basis.origin');
  const frameHash = semanticHashAdvancedAnalysis(basis);
  const requiredSign = text(input.requiredReportingSignConvention, 'requiredReportingSignConvention');
  if (definition.reportingSignConvention !== requiredSign) fail('requiredReportingSignConvention', 'Declared interface reporting sign convention does not match the required load sense.');
  if (!Array.isArray(input.recoveries) || input.recoveries.length === 0) fail('recoveries', 'recoveries must be a non-empty array.');

  const sourceRows = input.recoveries.map((source, index) => {
    const recovery = verifyRecovery(source, interfaceSet);
    requireSourceUnits(recovery.units);
    const result = recovery.results.find((row) => row.interfaceId === interfaceId);
    if (!result) fail(`recoveries[${index}]`, `Recovery omits interface ${interfaceId}.`);
    if (result.interfaceKind !== definition.interfaceKind || result.nodeId !== definition.nodeId) fail(`recoveries[${index}]`, 'Recovery interface identity differs from the interface definition.');
    if (result.frameSemanticHash !== frameHash) fail(`recoveries[${index}].frameSemanticHash`, 'Recovery frame hash differs from the interface basis.');
    if (result.reportingSignConvention !== requiredSign) fail(`recoveries[${index}].reportingSignConvention`, 'Recovery reporting sign convention differs from the required load sense.');
    const resultReference = vector(result.referencePointGlobal, `recoveries[${index}].referencePointGlobal`);
    const resultLever = vector(result.leverReferenceToNodeLocal, `recoveries[${index}].leverReferenceToNodeLocal`);
    if (!sameVector(resultReference, facePointM) || !sameVector(resultLever, definition.leverReferenceToNodeLocal)) fail(`recoveries[${index}]`, 'Recovery reference-point evidence differs from the interface definition.');
    return { recovery, result };
  });

  const context = resolveExplicitJointModelContext({
    schema: JOINT_MODEL_CONTEXT_SCHEMA,
    modelId: input.modelId,
    modelRevisionId: input.modelRevisionId,
    jointId: input.jointId,
    componentId: input.componentId,
    globalFrameId: input.globalFrameId,
    facePointM,
    faceFrame: {
      frameId: `AA:${interfaceId}:${frameHash}`,
      xAxisGlobal: basis.e1,
      yAxisGlobal: basis.e2,
      zAxisGlobal: basis.e3,
      openingDirection: input.openingDirection,
      matingSideId: input.matingSideId,
    },
    units: { length: 'm', force: 'N', moment: 'N.m' },
    masterBindings: input.masterBindings,
    loadCases: sourceRows.map(({ recovery, result }) => ({
      caseId: recovery.loadCaseId,
      sourceId: `${input.sourceRepository}@${input.sourceCommit}:${recovery.semanticHash}:${result.semanticHash}`,
      sourceFrameId: input.globalFrameId,
      sourcePointM,
      forceN: result.forceGlobal,
      momentNm: result.momentAtNodeGlobal,
    })),
  });

  for (let index = 0; index < sourceRows.length; index += 1) {
    const resolved = context.loadCases[index];
    const { result } = sourceRows[index];
    if (maxVectorDelta(resolved.forceAtFaceLocalN, result.forceLocal) > tolerance) fail(`recoveries[${index}].forceLocal`, 'Resolved local force disagrees with Advanced_Analysis recovery evidence.');
    if (maxVectorDelta(resolved.momentAtFaceLocalNm, result.momentAtReferenceLocal) > tolerance) fail(`recoveries[${index}].momentAtReferenceLocal`, 'Resolved face moment disagrees with Advanced_Analysis recovery evidence.');
  }

  return Object.freeze({
    method: ADVANCED_ANALYSIS_INTERFACE_ADAPTER_METHOD,
    sourceAuthority: 'QUALIFIED_CROSS_REPOSITORY_INTERFACE_CONTRACT_NON_AUTHORIZING',
    sourceRepository: input.sourceRepository,
    sourceCommit: input.sourceCommit,
    interfaceSetSemanticHash: interfaceSet.semanticHash,
    interfaceSetEvidenceHash: interfaceSet.evidenceHash,
    interfaceId,
    interfaceKind: definition.interfaceKind,
    interfaceSemanticHash: definition.semanticHash,
    interfaceSourceEvidence: definition.sourceEvidence,
    referencePointRole: 'FLANGE_FACE',
    referencePointSourceId: text(input.referencePointSourceId, 'referencePointSourceId'),
    openingDirectionSourceId: text(input.openingDirectionSourceId, 'openingDirectionSourceId'),
    requiredReportingSignConvention: requiredSign,
    sourceUnits: SOURCE_UNITS,
    unitNormalization: Object.freeze({ moment: 'N*m_TO_N.m_IDENTITY_FACTOR_1' }),
    resultConsistencyTolerance: tolerance,
    recoveryEvidence: Object.freeze(sourceRows.map(({ recovery, result }) => Object.freeze({
      loadCaseId: recovery.loadCaseId,
      recoverySemanticHash: recovery.semanticHash,
      recoveryEvidenceHash: recovery.evidenceHash,
      resultSemanticHash: result.semanticHash,
      physicalLoadCaseHash: recovery.physicalLoadCaseHash,
      analysisResultSemanticHash: recovery.analysisResultSemanticHash,
    }))),
    jointModelContext: context,
    automatic3dExtraction: false,
    masterBindingsResolved: false,
    solverInvoked: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}
