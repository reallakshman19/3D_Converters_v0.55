import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPLICIT_JOINT_FACE_RESOLVER_METHOD,
  JOINT_MODEL_CONTEXT_SCHEMA,
  resolveExplicitJointModelContext,
} from '../converters/engineering-calculations/flange/joint-model-context.js';

const BASE = Object.freeze({
  schema: JOINT_MODEL_CONTEXT_SCHEMA,
  modelId: 'MODEL-1',
  modelRevisionId: 'REV-A',
  jointId: 'J-101',
  componentId: 'FLANGE-A',
  globalFrameId: 'GLOBAL',
  facePointM: Object.freeze({ x: 0, y: 0, z: 0 }),
  faceFrame: Object.freeze({
    frameId: 'FLANGE-A-FACE',
    xAxisGlobal: Object.freeze({ x: 1, y: 0, z: 0 }),
    yAxisGlobal: Object.freeze({ x: 0, y: 1, z: 0 }),
    zAxisGlobal: Object.freeze({ x: 0, y: 0, z: 1 }),
    openingDirection: 'POSITIVE_LOCAL_Z',
    matingSideId: 'MATE-B',
  }),
  units: Object.freeze({ length: 'm', force: 'N', moment: 'N.m' }),
  masterBindings: Object.freeze({
    flangeMasterRecordId: 'FLANGE-MASTER-ROW',
    boltMasterRecordId: 'BOLT-MASTER-ROW',
    gasketMasterRecordId: 'GASKET-MASTER-ROW',
  }),
  loadCases: Object.freeze([
    Object.freeze({
      caseId: 'LC1',
      sourceId: 'ANALYSIS-LC1',
      sourceFrameId: 'GLOBAL',
      sourcePointM: Object.freeze({ x: 0, y: 0, z: 0 }),
      forceN: Object.freeze({ x: 10, y: 20, z: 30 }),
      momentNm: Object.freeze({ x: 40, y: 50, z: 60 }),
    }),
  ]),
});

function close(actual, expected, tolerance = 1e-12) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test('preserves an identity local frame and separates opening, shear, bending and torsion', () => {
  const result = resolveExplicitJointModelContext(BASE);
  const load = result.loadCases[0];
  assert.deepEqual(load.forceAtFaceLocalN, { x: 10, y: 20, z: 30 });
  assert.deepEqual(load.momentAtFaceLocalNm, { x: 40, y: 50, z: 60 });
  assert.equal(load.signedOpeningAxisForceN, 30);
  assert.equal(load.positiveOpeningForceN, 30);
  assert.equal(load.closingForceN, 0);
  close(load.transverseShearResultantN, Math.hypot(10, 20));
  close(load.bendingMomentResultantNm, Math.hypot(40, 50));
  assert.equal(load.torsionalMomentNm, 60);
});

test('uses the P3 reference-point transport relationship exactly once before rotation', () => {
  const loadCases = [{
    caseId: 'LC1', sourceId: 'ANALYSIS-LC1', sourceFrameId: 'GLOBAL',
    sourcePointM: { x: 1, y: 0, z: 0 },
    forceN: { x: 0, y: 100, z: 0 },
    momentNm: { x: 0, y: 0, z: 5 },
  }];
  const result = resolveExplicitJointModelContext({ ...BASE, loadCases });
  assert.equal(result.loadCases[0].momentAtFaceGlobalNm.z, 105);
  assert.equal(result.loadCases[0].transportRelationship, 'M_TARGET_EQUALS_M_SOURCE_PLUS_TARGET_TO_SOURCE_CROSS_FORCE');
});

test('rotates global components into a declared right-handed local frame using R transpose', () => {
  const faceFrame = {
    ...BASE.faceFrame,
    xAxisGlobal: { x: 0, y: 1, z: 0 },
    yAxisGlobal: { x: -1, y: 0, z: 0 },
    zAxisGlobal: { x: 0, y: 0, z: 1 },
  };
  const result = resolveExplicitJointModelContext({ ...BASE, faceFrame });
  assert.deepEqual(result.loadCases[0].forceAtFaceLocalN, { x: 20, y: -10, z: 30 });
  assert.deepEqual(result.loadCases[0].momentAtFaceLocalNm, { x: 50, y: -40, z: 60 });
});

test('supports an explicitly declared non-Z opening axis', () => {
  const faceFrame = { ...BASE.faceFrame, openingDirection: 'POSITIVE_LOCAL_X' };
  const result = resolveExplicitJointModelContext({ ...BASE, faceFrame });
  const load = result.loadCases[0];
  assert.equal(load.signedOpeningAxisForceN, 10);
  close(load.transverseShearResultantN, Math.hypot(20, 30));
  close(load.bendingMomentResultantNm, Math.hypot(50, 60));
  assert.equal(load.torsionalMomentNm, 40);
});

test('retains closing load separately rather than converting it to opening demand', () => {
  const loadCases = [{ ...BASE.loadCases[0], forceN: { x: 0, y: 0, z: -30 } }];
  const load = resolveExplicitJointModelContext({ ...BASE, loadCases }).loadCases[0];
  assert.equal(load.signedOpeningAxisForceN, -30);
  assert.equal(load.positiveOpeningForceN, 0);
  assert.equal(load.closingForceN, 30);
});

test('rejects non-unit or non-orthogonal flange-face axes', () => {
  assert.throws(() => resolveExplicitJointModelContext({
    ...BASE,
    faceFrame: { ...BASE.faceFrame, xAxisGlobal: { x: 2, y: 0, z: 0 } },
  }), (error) => error.field === 'faceFrame.xAxisGlobal');

  assert.throws(() => resolveExplicitJointModelContext({
    ...BASE,
    faceFrame: { ...BASE.faceFrame, yAxisGlobal: { x: 1, y: 0, z: 0 } },
  }), (error) => error.field === 'faceFrame');
});

test('rejects a left-handed local frame', () => {
  assert.throws(() => resolveExplicitJointModelContext({
    ...BASE,
    faceFrame: { ...BASE.faceFrame, zAxisGlobal: { x: 0, y: 0, z: -1 } },
  }), (error) => error.field === 'faceFrame');
});

test('requires load components in the declared global frame', () => {
  const loadCases = [{ ...BASE.loadCases[0], sourceFrameId: 'SOME_OTHER_FRAME' }];
  assert.throws(() => resolveExplicitJointModelContext({ ...BASE, loadCases }), (error) => error.field === 'loadCases[0].sourceFrameId');
});

test('requires explicit canonical SI units and does not silently convert', () => {
  assert.throws(() => resolveExplicitJointModelContext({ ...BASE, units: { length: 'mm', force: 'N', moment: 'N.m' } }), (error) => error.field === 'units.length');
  assert.throws(() => resolveExplicitJointModelContext({ ...BASE, units: { length: 'm', force: 'kN', moment: 'N.m' } }), (error) => error.field === 'units.force');
  assert.throws(() => resolveExplicitJointModelContext({ ...BASE, units: { length: 'm', force: 'N', moment: 'kN.m' } }), (error) => error.field === 'units.moment');
});

test('rejects duplicate load-case identities', () => {
  const loadCases = [BASE.loadCases[0], { ...BASE.loadCases[0], sourceId: 'SECOND-SOURCE' }];
  assert.throws(() => resolveExplicitJointModelContext({ ...BASE, loadCases }), (error) => error.field === 'loadCases');
});

test('keeps master bindings as explicit identity-only metadata', () => {
  const result = resolveExplicitJointModelContext(BASE);
  assert.equal(result.masterBindings.flangeMasterRecordId, 'FLANGE-MASTER-ROW');
  assert.equal(result.masterBindings.resolutionState, 'IDENTITY_ONLY_NOT_RESOLVED');
  assert.equal(result.masterBindingsResolved, false);
});

test('is explicit-input only and remains non-authorizing with no solver invocation', () => {
  const result = resolveExplicitJointModelContext(BASE);
  assert.equal(result.method, EXPLICIT_JOINT_FACE_RESOLVER_METHOD);
  assert.equal(result.sourceAuthority, 'EXPLICIT_CALLER_SUPPLIED_CONTEXT_ONLY');
  assert.equal(result.automaticModelRoute, false);
  assert.equal(result.solverInvoked, false);
  assert.equal(result.codeCompliance, false);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
});
