import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLANGE_FACE_BINDING_METHOD,
  FLANGE_FACE_BINDING_SCHEMA,
  FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
  adaptBoundAdvancedAnalysisFlangeToJointModelContext,
  sealFlangeFaceBinding,
} from '../converters/engineering-calculations/flange/flange-face-binding.js';
import {
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
} from '../converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js';
import { semanticHashAdvancedAnalysis } from '../converters/engineering-calculations/flange/advanced-analysis-semantic-hash.js';

function sealInterface(source) {
  const projection = { ...source };
  delete projection.semanticHash;
  return Object.freeze({ ...projection, semanticHash: semanticHashAdvancedAnalysis(projection) });
}

function sealInterfaceSet(definition) {
  const draft = {
    schema: 'linear-piping-interface-set/v1', profileId: 'PROFILE-1',
    profileSemanticHash: 'fnv1a64:1111111111111111', mechanicalModelSemanticHash: 'fnv1a64:2222222222222222',
    stiffnessStateHash: 'fnv1a64:3333333333333333', supportAttachmentModelSemanticHash: null,
    restraintCapabilityModelSemanticHash: null, interfaces: [definition], semanticHash: '', evidenceHash: '',
  };
  draft.semanticHash = semanticHashAdvancedAnalysis({
    schema: draft.schema, profileId: draft.profileId, profileSemanticHash: draft.profileSemanticHash,
    mechanicalModelSemanticHash: draft.mechanicalModelSemanticHash, stiffnessStateHash: draft.stiffnessStateHash,
    supportAttachmentModelSemanticHash: null, restraintCapabilityModelSemanticHash: null,
    interfaces: [{ interfaceId: definition.interfaceId, semanticHash: definition.semanticHash }],
  });
  draft.evidenceHash = semanticHashAdvancedAnalysis({
    semanticHash: draft.semanticHash,
    interfaceSourceEvidence: [{
      interfaceId: definition.interfaceId,
      sourceEvidence: definition.sourceEvidence,
      basisQualification: definition.basisQualification,
    }],
  });
  return Object.freeze(draft);
}

function sealResult(source) {
  const projection = { ...source };
  delete projection.semanticHash;
  return Object.freeze({ ...projection, semanticHash: semanticHashAdvancedAnalysis(projection) });
}

function sealRecovery(interfaceSet, result) {
  const draft = {
    schema: 'linear-piping-interface-recovery/v1', interfaceSetSemanticHash: interfaceSet.semanticHash,
    analysisResultSemanticHash: 'fnv1a64:4444444444444444', executionHash: 'fnv1a64:5555555555555555',
    physicalLoadCaseHash: 'fnv1a64:6666666666666666', loadCaseId: 'LC1',
    units: { force: 'N', moment: 'N*m', length: 'm' }, results: [result], status: 'QUALIFIED',
    semanticHash: '', evidenceHash: '',
  };
  draft.semanticHash = semanticHashAdvancedAnalysis({
    schema: draft.schema, interfaceSetSemanticHash: draft.interfaceSetSemanticHash,
    analysisResultSemanticHash: draft.analysisResultSemanticHash, executionHash: draft.executionHash,
    physicalLoadCaseHash: draft.physicalLoadCaseHash, loadCaseId: draft.loadCaseId, units: draft.units,
    results: [{ interfaceId: result.interfaceId, semanticHash: result.semanticHash }], status: draft.status,
  });
  draft.evidenceHash = semanticHashAdvancedAnalysis({
    semanticHash: draft.semanticHash,
    sourceReactionDofs: [{ interfaceId: result.interfaceId, sourceReactionDofs: result.sourceReactionDofs, formulaIds: result.formulaIds }],
  });
  return Object.freeze(draft);
}

function fixture() {
  const basis = Object.freeze({
    origin: Object.freeze({ x: 0, y: 0, z: 0 }),
    e1: Object.freeze({ x: 1, y: 0, z: 0 }),
    e2: Object.freeze({ x: 0, y: 1, z: 0 }),
    e3: Object.freeze({ x: 0, y: 0, z: 1 }),
  });
  const definition = sealInterface({
    interfaceId: 'IF-001', interfaceKind: 'NOZZLE', nodeId: 'N-10', sourceEntityId: 'NOZZLE-10', supportBinding: null,
    basis, basisQualification: Object.freeze({ maxNormDeviation: 0, maxOrthogonalityDeviation: 0, handedness: 1 }),
    referencePointGlobal: Object.freeze({ x: 1, y: 0, z: 0 }),
    leverReferenceToNodeLocal: Object.freeze({ x: -1, y: 0, z: 0 }), dofMappings: Object.freeze([]),
    reportingSignConvention: 'FORCE_ON_INTERFACE_FROM_PIPE',
    sourceEvidence: Object.freeze({ sourceId: 'AA-MODEL', sourceRevision: 'REV-1', sourceSemanticHash: 'fnv1a64:aaaaaaaaaaaaaaaa' }),
    allowableProfileHash: null,
  });
  const interfaceSet = sealInterfaceSet(definition);
  const result = sealResult({
    interfaceId: 'IF-001', interfaceKind: 'NOZZLE', nodeId: 'N-10', frameSemanticHash: semanticHashAdvancedAnalysis(basis),
    reportingSignConvention: 'FORCE_ON_INTERFACE_FROM_PIPE', forceGlobal: Object.freeze({ x: 30, y: 100, z: 0 }),
    momentAtNodeGlobal: Object.freeze({ x: 0, y: 0, z: 5 }), forceLocal: Object.freeze({ x: 30, y: 100, z: 0 }),
    momentAtNodeLocal: Object.freeze({ x: 0, y: 0, z: 5 }), momentAtReferenceLocal: Object.freeze({ x: 0, y: 0, z: -95 }),
    referencePointGlobal: Object.freeze({ x: 1, y: 0, z: 0 }), leverReferenceToNodeLocal: Object.freeze({ x: -1, y: 0, z: 0 }),
    sourceReactionDofs: Object.freeze([{ dof: 'UX', value: 30 }, { dof: 'UY', value: 100 }, { dof: 'RZ', value: 5 }]),
    formulaIds: Object.freeze(['GLOBAL_REACTION_COMPONENT_GROUPING_BY_DECLARED_INTERFACE', 'ORTHONORMAL_GLOBAL_TO_LOCAL_PROJECTION', 'M_REFERENCE_EQUALS_M_NODE_PLUS_R_REFERENCE_TO_NODE_CROSS_F']),
  });
  const binding = sealFlangeFaceBinding({
    schema: FLANGE_FACE_BINDING_SCHEMA, bindingId: 'BIND-001', bindingRevisionId: 'REV-1',
    modelId: 'MODEL-1', modelRevisionId: 'MODEL-REV-A', jointId: 'J-101', componentId: 'FLANGE-A', globalFrameId: 'AA-GLOBAL',
    modelEntity: {
      sourceSchema: 'rvm-converter-stage/v1', sourceKind: '3DV_SELECTION', sourceFile: 'model.rvm', sourceRef: 'RVM-REF-123',
      sourcePath: '/LINE-100/FLANGE-101', nativeKind: 'WeldNeckFlange', componentRole: 'PHYSICAL_FLANGE',
    },
    analysisInterface: {
      sourceRepository: ADVANCED_ANALYSIS_SOURCE_REPOSITORY, sourceCommit: ADVANCED_ANALYSIS_SOURCE_COMMIT,
      interfaceSetSemanticHash: interfaceSet.semanticHash, interfaceId: definition.interfaceId,
      interfaceSemanticHash: definition.semanticHash, frameSemanticHash: semanticHashAdvancedAnalysis(basis),
      reportingSignConvention: definition.reportingSignConvention,
    },
    flangeFace: { referencePointGlobal: { x: 1, y: 0, z: 0 }, openingDirection: 'POSITIVE_LOCAL_X', matingSideId: 'EQUIPMENT-NOZZLE-A' },
    provenance: {
      bindingSourceId: 'PROJECT-BINDING-REGISTER-001', modelEntitySourceId: '3DV-SELECTION-RECORD-123',
      referencePointSourceId: 'PROJECT-FLANGE-FACE-001', openingDirectionSourceId: 'PROJECT-FLANGE-NORMAL-001',
      matingSideSourceId: 'PROJECT-MATING-SIDE-001',
    }, semanticHash: '',
  });
  return { basis, definition, interfaceSet, result, recovery: sealRecovery(interfaceSet, result), binding };
}

function masterBindings() {
  return { flangeMasterRecordId: 'FLANGE-MASTER-ROW', boltMasterRecordId: 'BOLT-MASTER-ROW', gasketMasterRecordId: 'GASKET-MASTER-ROW' };
}

function adapt(f, overrides = {}) {
  return adaptBoundAdvancedAnalysisFlangeToJointModelContext({
    binding: f.binding, interfaceSet: f.interfaceSet, recoveries: [f.recovery],
    resultConsistencyTolerance: 1e-12, masterBindings: masterBindings(), ...overrides,
  });
}

test('seals a deterministic FlangeFaceBinding.v1 semantic hash', () => {
  const f = fixture();
  assert.match(f.binding.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
  assert.equal(sealFlangeFaceBinding(f.binding).semanticHash, f.binding.semanticHash);
});

test('binds a controlled flange entity and interface into JointModelContext without separate face declarations', () => {
  const f = fixture();
  const output = adapt(f);
  assert.equal(output.method, FLANGE_FACE_BINDING_METHOD);
  assert.equal(output.bindingSemanticHash, f.binding.semanticHash);
  assert.deepEqual(output.jointModelContext.loadCases[0].momentAtFaceLocalNm, { x: 0, y: 0, z: -95 });
  assert.equal(output.jointModelContext.loadCases[0].signedOpeningAxisForceN, 30);
});

test('retains the exact 3DV entity identity as binding evidence, not geometric authority', () => {
  const output = adapt(fixture());
  assert.equal(output.modelEntity.sourceRef, 'RVM-REF-123');
  assert.equal(output.modelEntity.sourcePath, '/LINE-100/FLANGE-101');
  assert.equal(output.modelEntity.nativeKind, 'WeldNeckFlange');
  assert.equal(output.geometryInferenceUsed, false);
});

test('rejects a stale binding semantic hash', () => {
  const f = fixture();
  assert.throws(() => sealFlangeFaceBinding({ ...f.binding, semanticHash: 'fnv1a64:0000000000000000' }), (error) => error.field === 'semanticHash');
});

test('rejects a non-rvm stage source schema', () => {
  const f = fixture();
  const binding = { ...f.binding, modelEntity: { ...f.binding.modelEntity, sourceSchema: 'other/v1' }, semanticHash: '' };
  assert.throws(() => sealFlangeFaceBinding(binding), (error) => error.field === 'modelEntity.sourceSchema');
});

test('requires an explicit PHYSICAL_FLANGE role instead of inferring it from nativeKind', () => {
  const f = fixture();
  const binding = { ...f.binding, modelEntity: { ...f.binding.modelEntity, componentRole: 'UNKNOWN' }, semanticHash: '' };
  assert.throws(() => sealFlangeFaceBinding(binding), (error) => error.field === 'modelEntity.componentRole');
});

test('rejects a binding tied to a different interface-set semantic hash', () => {
  const f = fixture();
  const raw = { ...f.binding, analysisInterface: { ...f.binding.analysisInterface, interfaceSetSemanticHash: 'fnv1a64:bbbbbbbbbbbbbbbb' }, semanticHash: '' };
  const binding = sealFlangeFaceBinding(raw);
  assert.throws(() => adapt(f, { binding }), (error) => error.field === 'analysisInterface.interfaceSetSemanticHash');
});

test('rejects a binding tied to a different interface semantic hash', () => {
  const f = fixture();
  const raw = { ...f.binding, analysisInterface: { ...f.binding.analysisInterface, interfaceSemanticHash: 'fnv1a64:bbbbbbbbbbbbbbbb' }, semanticHash: '' };
  const binding = sealFlangeFaceBinding(raw);
  assert.throws(() => adapt(f, { binding }), (error) => error.field === 'analysisInterface.interfaceSemanticHash');
});

test('rejects a binding tied to a different interface frame', () => {
  const f = fixture();
  const raw = { ...f.binding, analysisInterface: { ...f.binding.analysisInterface, frameSemanticHash: 'fnv1a64:bbbbbbbbbbbbbbbb' }, semanticHash: '' };
  const binding = sealFlangeFaceBinding(raw);
  assert.throws(() => adapt(f, { binding }), (error) => error.field === 'analysisInterface.frameSemanticHash');
});

test('rejects a flange-face point that differs from the qualified interface reference point', () => {
  const f = fixture();
  const raw = { ...f.binding, flangeFace: { ...f.binding.flangeFace, referencePointGlobal: { x: 2, y: 0, z: 0 } }, semanticHash: '' };
  const binding = sealFlangeFaceBinding(raw);
  assert.throws(() => adapt(f, { binding }), (error) => error.field === 'flangeFace.referencePointGlobal');
});

test('rejects reporting-sign drift between binding and analysis interface', () => {
  const f = fixture();
  const raw = { ...f.binding, analysisInterface: { ...f.binding.analysisInterface, reportingSignConvention: 'FORCE_ON_PIPE_FROM_INTERFACE' }, semanticHash: '' };
  const binding = sealFlangeFaceBinding(raw);
  assert.throws(() => adapt(f, { binding }), (error) => error.field === 'analysisInterface.reportingSignConvention');
});

test('requires source identity and provenance fields instead of permitting anonymous binding', () => {
  const f = fixture();
  const raw = { ...f.binding, modelEntity: { ...f.binding.modelEntity, sourceRef: '' }, semanticHash: '' };
  assert.throws(() => sealFlangeFaceBinding(raw), (error) => error.field === 'modelEntity.sourceRef');
});

test('remains non-authorizing and leaves automatic extraction, masters and solvers blocked', () => {
  const output = adapt(fixture());
  assert.equal(output.sourceAuthority, FLANGE_FACE_BINDING_SOURCE_AUTHORITY);
  assert.equal(output.automatic3dExtraction, false);
  assert.equal(output.masterBindingsResolved, false);
  assert.equal(output.solverInvoked, false);
  assert.equal(output.codeCompliance, false);
  assert.equal(output.canUseForDesignAuthority, false);
  assert.equal(output.governingEligible, false);
});
