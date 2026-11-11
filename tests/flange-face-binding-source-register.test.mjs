import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLANGE_FACE_BINDING_SOURCE_AUTHORITY,
  FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA,
  FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA,
  createFlangeFaceBindingSourceRegister,
  sealFlangeFaceBindingSourceRecord,
  validateFlangeFaceBindingSourceRegister,
} from '../converters/engineering-calculations/flange/flange-face-binding-source-register.js';
import {
  ADVANCED_ANALYSIS_SOURCE_COMMIT,
  ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
} from '../converters/engineering-calculations/flange/advanced-analysis-interface-adapter.js';

function rawRecord(overrides = {}) {
  const record = {
    schema: FLANGE_FACE_BINDING_SOURCE_RECORD_SCHEMA,
    recordId: 'FFBS-001',
    recordRevisionId: 'REV-1',
    recordState: 'DRAFT',
    projectId: 'PROJECT-1',
    model: {
      modelId: 'MODEL-1',
      modelRevisionId: 'MODEL-REV-A',
      globalFrameId: 'AA-GLOBAL',
      lengthUnit: 'm',
      sourceSchema: 'rvm-converter-stage/v1',
      sourceKind: '3DV_SELECTION',
      sourceFile: 'model.rvm',
      sourceRef: 'RVM-REF-123',
      sourcePath: '/LINE-100/FLANGE-101',
      nativeKind: 'WeldNeckFlange',
      componentRole: 'PHYSICAL_FLANGE',
    },
    joint: {
      jointId: 'J-101',
      componentId: 'FLANGE-A',
      selectedFaceId: 'F-FLANGE-A-END-2',
      selectedPortId: 'P-FLANGE-A-FLANGE_END_2',
      matingSideId: 'EQUIPMENT-NOZZLE-A',
    },
    geometry: {
      referencePointGlobalM: { x: 1, y: 2, z: 3 },
      openingDirection: 'POSITIVE_LOCAL_X',
    },
    analysisInterface: {
      sourceRepository: ADVANCED_ANALYSIS_SOURCE_REPOSITORY,
      sourceCommit: ADVANCED_ANALYSIS_SOURCE_COMMIT,
      interfaceSetSemanticHash: 'fnv1a64:1111111111111111',
      interfaceId: 'IF-001',
      interfaceSemanticHash: 'fnv1a64:2222222222222222',
      frameSemanticHash: 'fnv1a64:3333333333333333',
      reportingSignConvention: 'FORCE_ON_INTERFACE_FROM_PIPE',
    },
    sourceControl: {
      bindingSourceId: 'PROJECT-BINDING-REGISTER-001',
      modelEntitySourceId: '3DV-SELECTION-RECORD-123',
      calculationFaceSourceId: 'PROJECT-FLANGE-FACE-001',
      openingDirectionSourceId: 'PROJECT-FLANGE-NORMAL-001',
      matingSideSourceId: 'PROJECT-MATING-SIDE-001',
      globalFrameSourceId: 'PROJECT-GLOBAL-FRAME-001',
      analysisInterfaceSourceId: 'AA-INTERFACE-CUSTODY-001',
    },
    ambiguityPolicy: {
      identityPolicy: 'EXACT_IDENTIFIERS_ONLY',
      ambiguityDisposition: 'UNAMBIGUOUS_REQUIRED',
      candidateCount: 1,
      positionToleranceM: 0.0001,
      orientationToleranceRad: 0.001,
      toleranceSourceId: 'PROJECT-BINDING-TOLERANCE-001',
    },
    semanticHash: '',
  };
  return { ...record, ...overrides };
}

function sealed(overrides = {}) {
  return sealFlangeFaceBindingSourceRecord(rawRecord(overrides));
}

test('seals a deterministic source-record semantic hash', () => {
  const record = sealed();
  assert.match(record.semanticHash, /^fnv1a64:[0-9a-f]{16}$/u);
  assert.equal(sealFlangeFaceBindingSourceRecord(record).semanticHash, record.semanticHash);
});

test('creates a non-authorizing source-custody register', () => {
  const register = createFlangeFaceBindingSourceRegister({ records: [sealed()] });
  assert.equal(register.schema, FLANGE_FACE_BINDING_SOURCE_REGISTER_SCHEMA);
  assert.equal(register.sourceAuthority, FLANGE_FACE_BINDING_SOURCE_AUTHORITY);
  assert.equal(register.automaticBindingProducer, false);
  assert.equal(register.codeCompliance, false);
  assert.equal(register.designAuthority, false);
  assert.equal(register.governingEligible, false);
  assert.equal(validateFlangeFaceBindingSourceRegister(register).ok, true);
});

test('requires explicit physical-flange source role', () => {
  const raw = rawRecord({ model: { ...rawRecord().model, componentRole: 'UNKNOWN' } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /PHYSICAL_FLANGE/u);
});

test('requires exact rvm converter-stage source schema', () => {
  const raw = rawRecord({ model: { ...rawRecord().model, sourceSchema: 'uxml-topology-v1' } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /rvm-converter-stage\/v1/u);
});

test('requires the pinned Advanced_Analysis source revision', () => {
  const raw = rawRecord({
    analysisInterface: { ...rawRecord().analysisInterface, sourceCommit: '0000000000000000000000000000000000000000' },
  });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /sourceCommit/u);
});

test('requires explicit selected face, port and mating-side identities', () => {
  const raw = rawRecord({ joint: { ...rawRecord().joint, selectedFaceId: '' } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /selectedFaceId/u);
});

test('requires exactly one unambiguous candidate', () => {
  const raw = rawRecord({ ambiguityPolicy: { ...rawRecord().ambiguityPolicy, candidateCount: 2 } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /candidateCount must equal 1/u);
});

test('requires caller-supplied non-negative positional and orientation tolerances', () => {
  const raw = rawRecord({ ambiguityPolicy: { ...rawRecord().ambiguityPolicy, positionToleranceM: undefined } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(raw), /positionToleranceM must be finite/u);

  const negative = rawRecord({ ambiguityPolicy: { ...rawRecord().ambiguityPolicy, orientationToleranceRad: -0.1 } });
  assert.throws(() => sealFlangeFaceBindingSourceRecord(negative), /orientationToleranceRad must be >= 0/u);
});

test('rejects stale semantic hashes', () => {
  const record = { ...sealed(), semanticHash: 'fnv1a64:0000000000000000' };
  assert.throws(() => sealFlangeFaceBindingSourceRecord(record), /semanticHash is stale/u);
});

test('rejects duplicate source record ids', () => {
  const first = sealed();
  const second = sealed({ recordRevisionId: 'REV-2' });
  const register = createFlangeFaceBindingSourceRegister({ records: [first, second] });
  const validation = validateFlangeFaceBindingSourceRegister(register);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /duplicate recordId/u);
});

test('does not infer geometry or produce FlangeFaceBinding records', () => {
  const register = createFlangeFaceBindingSourceRegister({ records: [sealed()] });
  assert.equal(register.automaticBindingProducer, false);
  assert.equal('binding' in register, false);
  assert.equal('jointModelContext' in register, false);
});
