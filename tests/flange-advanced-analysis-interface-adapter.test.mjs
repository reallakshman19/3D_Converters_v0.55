import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADVANCED_ANALYSIS_INTERFACE_ADAPTER_METHOD,
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
  adaptAdvancedAnalysisInterfaceToJointModelContext,
} from '../converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js';
import {
  hashUtf8AdvancedAnalysis,
  semanticHashAdvancedAnalysis,
} from '../converters/engineering-calculations/flange/advanced-analysis-semantic-hash.js';

function sealInterface(source) {
  const projection = { ...source };
  delete projection.semanticHash;
  return Object.freeze({ ...projection, semanticHash: semanticHashAdvancedAnalysis(projection) });
}

function sealInterfaceSet(interfaces) {
  const draft = {
    schema: 'linear-piping-interface-set/v1',
    profileId: 'PROFILE-1',
    profileSemanticHash: 'fnv1a64:1111111111111111',
    mechanicalModelSemanticHash: 'fnv1a64:2222222222222222',
    stiffnessStateHash: 'fnv1a64:3333333333333333',
    supportAttachmentModelSemanticHash: null,
    restraintCapabilityModelSemanticHash: null,
    interfaces,
    semanticHash: '',
    evidenceHash: '',
  };
  draft.semanticHash = semanticHashAdvancedAnalysis({
    schema: draft.schema,
    profileId: draft.profileId,
    profileSemanticHash: draft.profileSemanticHash,
    mechanicalModelSemanticHash: draft.mechanicalModelSemanticHash,
    stiffnessStateHash: draft.stiffnessStateHash,
    supportAttachmentModelSemanticHash: draft.supportAttachmentModelSemanticHash,
    restraintCapabilityModelSemanticHash: draft.restraintCapabilityModelSemanticHash,
    interfaces: draft.interfaces.map((row) => ({ interfaceId: row.interfaceId, semanticHash: row.semanticHash })),
  });
  draft.evidenceHash = semanticHashAdvancedAnalysis({
    semanticHash: draft.semanticHash,
    interfaceSourceEvidence: draft.interfaces.map((row) => ({
      interfaceId: row.interfaceId,
      sourceEvidence: row.sourceEvidence,
      basisQualification: row.basisQualification,
    })),
  });
  return Object.freeze(draft);
}

function sealResult(source) {
  const projection = { ...source };
  delete projection.semanticHash;
  return Object.freeze({ ...projection, semanticHash: semanticHashAdvancedAnalysis(projection) });
}

function sealRecovery(interfaceSet, loadCaseId, result, overrides = {}) {
  const draft = {
    schema: 'linear-piping-interface-recovery/v1',
    interfaceSetSemanticHash: interfaceSet.semanticHash,
    analysisResultSemanticHash: `fnv1a64:${loadCaseId === 'LC1' ? '4444444444444444' : '5555555555555555'}`,
    executionHash: `fnv1a64:${loadCaseId === 'LC1' ? '6666666666666666' : '7777777777777777'}`,
    physicalLoadCaseHash: `fnv1a64:${loadCaseId === 'LC1' ? '8888888888888888' : '9999999999999999'}`,
    loadCaseId,
    units: { force: 'N', moment: 'N*m', length: 'm' },
    results: [result],
    status: 'QUALIFIED',
    semanticHash: '',
    evidenceHash: '',
    ...overrides,
  };
  draft.semanticHash = semanticHashAdvancedAnalysis({
    schema: draft.schema,
    interfaceSetSemanticHash: draft.interfaceSetSemanticHash,
    analysisResultSemanticHash: draft.analysisResultSemanticHash,
    executionHash: draft.executionHash,
    physicalLoadCaseHash: draft.physicalLoadCaseHash,
    loadCaseId: draft.loadCaseId,
    units: draft.units,
    results: draft.results.map((row) => ({ interfaceId: row.interfaceId, semanticHash: row.semanticHash })),
    status: draft.status,
  });
  draft.evidenceHash = semanticHashAdvancedAnalysis({
    semanticHash: draft.semanticHash,
    sourceReactionDofs: draft.results.map((row) => ({
      interfaceId: row.interfaceId,
      sourceReactionDofs: row.sourceReactionDofs,
      formulaIds: row.formulaIds,
    })),
  });
  return Object.freeze(draft);
}

function sourceFixture({ interfaceKind = 'NOZZLE', sign = 'FORCE_ON_INTERFACE_FROM_PIPE', momentReferenceZ = -95 } = {}) {
  const basis = Object.freeze({
    origin: Object.freeze({ x: 0, y: 0, z: 0 }),
    e1: Object.freeze({ x: 1, y: 0, z: 0 }),
    e2: Object.freeze({ x: 0, y: 1, z: 0 }),
    e3: Object.freeze({ x: 0, y: 0, z: 1 }),
  });
  const definition = sealInterface({
    interfaceId: 'IF-001',
    interfaceKind,
    nodeId: 'N-10',
    sourceEntityId: 'NOZZLE-10',
    supportBinding: null,
    basis,
    basisQualification: Object.freeze({ maxNormDeviation: 0, maxOrthogonalityDeviation: 0, handedness: 1 }),
    referencePointGlobal: Object.freeze({ x: 1, y: 0, z: 0 }),
    leverReferenceToNodeLocal: Object.freeze({ x: -1, y: 0, z: 0 }),
    dofMappings: Object.freeze([]),
    reportingSignConvention: sign,
    sourceEvidence: Object.freeze({
      sourceId: 'AA-MODEL',
      sourceRevision: 'REV-1',
      sourceSemanticHash: 'fnv1a64:aaaaaaaaaaaaaaaa',
    }),
    allowableProfileHash: null,
  });
  const interfaceSet = sealInterfaceSet([definition]);
  const result = sealResult({
    interfaceId: 'IF-001',
    interfaceKind,
    nodeId: 'N-10',
    frameSemanticHash: semanticHashAdvancedAnalysis(basis),
    reportingSignConvention: sign,
    forceGlobal: Object.freeze({ x: 30, y: 100, z: 0 }),
    momentAtNodeGlobal: Object.freeze({ x: 0, y: 0, z: 5 }),
    forceLocal: Object.freeze({ x: 30, y: 100, z: 0 }),
    momentAtNodeLocal: Object.freeze({ x: 0, y: 0, z: 5 }),
    momentAtReferenceLocal: Object.freeze({ x: 0, y: 0, z: momentReferenceZ }),
    referencePointGlobal: Object.freeze({ x: 1, y: 0, z: 0 }),
    leverReferenceToNodeLocal: Object.freeze({ x: -1, y: 0, z: 0 }),
    sourceReactionDofs: Object.freeze([
      Object.freeze({ dof: 'UX', value: 30 }),
      Object.freeze({ dof: 'UY', value: 100 }),
      Object.freeze({ dof: 'RZ', value: 5 }),
    ]),
    formulaIds: Object.freeze([
      'GLOBAL_REACTION_COMPONENT_GROUPING_BY_DECLARED_INTERFACE',
      'ORTHONORMAL_GLOBAL_TO_LOCAL_PROJECTION',
      'M_REFERENCE_EQUALS_M_NODE_PLUS_R_REFERENCE_TO_NODE_CROSS_F',
    ]),
  });
  return { interfaceSet, result, recovery: sealRecovery(interfaceSet, 'LC1', result) };
}

function adapterInput(fixture, overrides = {}) {
  return {
    sourceRepository: ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
    sourceCommit: ADVANCED_ANALYSIS_SOURCE_COMMIT,
    interfaceSet: fixture.interfaceSet,
    recoveries: [fixture.recovery],
    interfaceId: 'IF-001',
    referencePointRole: 'FLANGE_FACE',
    referencePointSourceId: 'PROJECT-FLANGE-FACE-BASIS-001',
    openingDirection: 'POSITIVE_LOCAL_X',
    openingDirectionSourceId: 'PROJECT-FLANGE-NORMAL-001',
    requiredReportingSignConvention: 'FORCE_ON_INTERFACE_FROM_PIPE',
    resultConsistencyTolerance: 1e-12,
    modelId: 'MODEL-1',
    modelRevisionId: 'REV-A',
    jointId: 'J-101',
    componentId: 'FLANGE-A',
    globalFrameId: 'AA-GLOBAL',
    matingSideId: 'EQUIPMENT-NOZZLE-A',
    masterBindings: {
      flangeMasterRecordId: 'FLANGE-MASTER-ROW',
      boltMasterRecordId: 'BOLT-MASTER-ROW',
      gasketMasterRecordId: 'GASKET-MASTER-ROW',
    },
    ...overrides,
  };
}

test('Advanced_Analysis semantic hash primitive retains the FNV-1a 64 offset-basis vector', () => {
  assert.equal(hashUtf8AdvancedAnalysis(''), 'fnv1a64:cbf29ce484222325');
});

test('adapts a qualified nozzle interface into JointModelContext with one-time face transport', () => {
  const fixture = sourceFixture();
  const result = adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture));
  assert.equal(result.method, ADVANCED_ANALYSIS_INTERFACE_ADAPTER_METHOD);
  assert.equal(result.interfaceKind, 'NOZZLE');
  const load = result.jointModelContext.loadCases[0];
  assert.deepEqual(load.forceAtFaceLocalN, { x: 30, y: 100, z: 0 });
  assert.deepEqual(load.momentAtFaceLocalNm, { x: 0, y: 0, z: -95 });
  assert.equal(load.signedOpeningAxisForceN, 30);
  assert.equal(load.transportRelationship, 'M_TARGET_EQUALS_M_SOURCE_PLUS_TARGET_TO_SOURCE_CROSS_FORCE');
});

test('normalizes only the Advanced_Analysis moment-unit notation with identity factor one', () => {
  const result = adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(sourceFixture()));
  assert.deepEqual(result.sourceUnits, { length: 'm', force: 'N', moment: 'N*m' });
  assert.equal(result.unitNormalization.moment, 'N*m_TO_N.m_IDENTITY_FACTOR_1');
  assert.deepEqual(result.jointModelContext.units, { length: 'm', force: 'N', moment: 'N.m' });
});

test('retains source semantic/evidence provenance for every recovery', () => {
  const fixture = sourceFixture();
  const result = adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture));
  assert.equal(result.sourceCommit, ADVANCED_ANALYSIS_SOURCE_COMMIT);
  assert.equal(result.interfaceSetSemanticHash, fixture.interfaceSet.semanticHash);
  assert.equal(result.interfaceSetEvidenceHash, fixture.interfaceSet.evidenceHash);
  assert.equal(result.recoveryEvidence[0].recoverySemanticHash, fixture.recovery.semanticHash);
  assert.equal(result.recoveryEvidence[0].resultSemanticHash, fixture.result.semanticHash);
});

test('rejects source commit drift instead of silently accepting another Advanced_Analysis revision', () => {
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(sourceFixture(), { sourceCommit: 'different' })),
    (error) => error.field === 'sourceCommit',
  );
});

test('rejects a stale interface semantic hash', () => {
  const fixture = sourceFixture();
  const badDefinition = { ...fixture.interfaceSet.interfaces[0], semanticHash: 'fnv1a64:0000000000000000' };
  const badSet = { ...fixture.interfaceSet, interfaces: [badDefinition] };
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture, { interfaceSet: badSet })),
    (error) => error.field === 'interfaceSet.interfaces[0].semanticHash',
  );
});

test('rejects stale recovery or result hash evidence', () => {
  const fixture = sourceFixture();
  const badResult = { ...fixture.result, semanticHash: 'fnv1a64:0000000000000000' };
  const badRecovery = { ...fixture.recovery, results: [badResult] };
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture, { recoveries: [badRecovery] })),
    (error) => error.field === 'recovery.results[0].semanticHash',
  );
});

test('admits only NOZZLE or EQUIPMENT interfaces for this flange boundary', () => {
  const fixture = sourceFixture({ interfaceKind: 'SUPPORT' });
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture)),
    (error) => error.field === 'interfaceKind',
  );
});

test('requires an explicit declaration that the source reference point is the flange face', () => {
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(sourceFixture(), { referencePointRole: 'NOZZLE_NODE' })),
    (error) => error.field === 'referencePointRole',
  );
});

test('does not infer or reverse the source reporting sign convention', () => {
  const fixture = sourceFixture({ sign: 'FORCE_ON_PIPE_FROM_INTERFACE' });
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture)),
    (error) => error.field === 'requiredReportingSignConvention',
  );
});

test('requires exact Advanced_Analysis SI source units before notation normalization', () => {
  const fixture = sourceFixture();
  const badRecovery = sealRecovery(fixture.interfaceSet, 'LC1', fixture.result, {
    units: { force: 'kN', moment: 'N*m', length: 'm' },
  });
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture, { recoveries: [badRecovery] })),
    (error) => error.field === 'recovery.units.force',
  );
});

test('rejects a recovery whose declared frame hash differs from the qualified interface basis', () => {
  const fixture = sourceFixture();
  const changed = sealResult({ ...fixture.result, frameSemanticHash: 'fnv1a64:bbbbbbbbbbbbbbbb' });
  const recovery = sealRecovery(fixture.interfaceSet, 'LC1', changed);
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture, { recoveries: [recovery] })),
    (error) => error.field === 'recoveries[0].frameSemanticHash',
  );
});

test('cross-checks the transported local face moment against upstream recovery evidence', () => {
  const fixture = sourceFixture({ momentReferenceZ: -94 });
  assert.throws(
    () => adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture)),
    (error) => error.field === 'recoveries[0].momentAtReferenceLocal',
  );
});

test('supports multiple qualified recoveries while preserving distinct load-case identity', () => {
  const fixture = sourceFixture();
  const result2 = sealResult({
    ...fixture.result,
    forceGlobal: { x: -10, y: 0, z: 0 },
    momentAtNodeGlobal: { x: 0, y: 0, z: 2 },
    forceLocal: { x: -10, y: 0, z: 0 },
    momentAtNodeLocal: { x: 0, y: 0, z: 2 },
    momentAtReferenceLocal: { x: 0, y: 0, z: 2 },
    sourceReactionDofs: [{ dof: 'UX', value: -10 }, { dof: 'RZ', value: 2 }],
  });
  const recovery2 = sealRecovery(fixture.interfaceSet, 'LC2', result2);
  const result = adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(fixture, { recoveries: [fixture.recovery, recovery2] }));
  assert.deepEqual(result.jointModelContext.loadCases.map((row) => row.caseId), ['LC1', 'LC2']);
  assert.equal(result.jointModelContext.loadCases[1].closingForceN, 10);
});

test('remains non-authorizing and does not resolve masters or invoke a solver', () => {
  const result = adaptAdvancedAnalysisInterfaceToJointModelContext(adapterInput(sourceFixture()));
  assert.equal(result.sourceAuthority, 'QUALIFIED_CROSS_REPOSITORY_INTERFACE_CONTRACT_NON_AUTHORIZING');
  assert.equal(result.automatic3dExtraction, false);
  assert.equal(result.masterBindingsResolved, false);
  assert.equal(result.solverInvoked, false);
  assert.equal(result.codeCompliance, false);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
  assert.equal(result.jointModelContext.masterBindings.resolutionState, 'IDENTITY_ONLY_NOT_RESOLVED');
});
