import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOLT_GROUP_COORDINATE_CONVENTION,
  BOLT_GROUP_REFERENCE_METHOD_ID,
  evaluateBoltGroupLoadCase,
  evaluateBoltGroupLoadCases,
} from '../converters/engineering-calculations/bolts/group-assessment.js';

const SQUARE = Object.freeze([
  { id: 'B1', xM: -0.1, yM: -0.1, zM: 0 },
  { id: 'B2', xM: 0.1, yM: -0.1, zM: 0 },
  { id: 'B3', xM: 0.1, yM: 0.1, zM: 0 },
  { id: 'B4', xM: -0.1, yM: 0.1, zM: 0 },
]);

function vector(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function loadCase(id, overrides = {}) {
  return {
    id,
    forceN: vector(),
    momentNm: vector(),
    referencePointM: vector(),
    ...overrides,
  };
}

function close(actual, expected, tolerance = 1e-9) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function assertEquilibrium(result, tolerance = 1e-9) {
  Object.values(result.equilibrium.residual).forEach((value) => close(value, 0, tolerance));
}

test('explicit centroid reference reproduces the validated low-level distribution contract', () => {
  const result = evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCase: loadCase('AXIAL', { forceN: vector(0, 0, 4000) }),
  });
  assert.equal(result.methodId, BOLT_GROUP_REFERENCE_METHOD_ID);
  assert.equal(result.coordinateConvention, BOLT_GROUP_COORDINATE_CONVENTION);
  assert.deepEqual(result.bolts.map((row) => row.externalAxialN), [1000, 1000, 1000, 1000]);
  assert.deepEqual(result.transport.addedMomentNm, vector());
  assertEquilibrium(result);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
});

test('off-centroid force is transported to the bolt-group centroid with r cross F', () => {
  const result = evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCase: loadCase('OFFSET-SHEAR', {
      forceN: vector(0, 1000, 0),
      referencePointM: vector(0.2, 0, 0),
    }),
  });
  close(result.transport.addedMomentNm.z, 200);
  close(result.centroidResultant.momentNm.z, 200);
  close(result.centroidResultant.forceN.y, 1000);
  assertEquilibrium(result);
});

test('reference-point z offset correctly creates in-plane moment components', () => {
  const result = evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCase: loadCase('Z-OFFSET', {
      forceN: vector(1000, 500, 0),
      referencePointM: vector(0, 0, 0.3),
    }),
  });
  close(result.transport.addedMomentNm.x, -150);
  close(result.transport.addedMomentNm.y, 300);
  close(result.transport.addedMomentNm.z, 0);
  assertEquilibrium(result);
});

test('asymmetric planar geometry preserves six-DOF equilibrium after resultant transport', () => {
  const bolts = [
    { id: 'A', xM: -0.12, yM: -0.04, zM: 0.05 },
    { id: 'B', xM: 0.08, yM: -0.07, zM: 0.05 },
    { id: 'C', xM: 0.11, yM: 0.09, zM: 0.05 },
    { id: 'D', xM: -0.05, yM: 0.13, zM: 0.05 },
  ];
  const result = evaluateBoltGroupLoadCase({
    frameId: 'NOZZLE-FLANGE-LOCAL',
    bolts,
    loadCase: loadCase('SIX-DOF', {
      forceN: vector(620, 310, 2400),
      momentNm: vector(75, -55, 18),
      referencePointM: vector(0.3, -0.1, 0.4),
    }),
  });
  assertEquilibrium(result, 1e-8);
  close(result.boltGroupCentroidM.z, 0.05);
  assert.equal(result.geometry.planar, true);
  assert.equal(result.geometry.boltCount, 4);
});

test('multi-case array API returns per-bolt axial and shear envelopes', () => {
  const result = evaluateBoltGroupLoadCases({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCases: [
      loadCase('OPEN', { forceN: vector(0, 0, 4000) }),
      loadCase('CLOSE', { forceN: vector(0, 0, -2000) }),
      loadCase('TORSION', { momentNm: vector(0, 0, 40) }),
    ],
  });
  assert.equal(result.cases.length, 3);
  result.envelope.forEach((row) => {
    close(row.maxExternalAxialN, 1000);
    assert.equal(row.maxExternalAxialCaseId, 'OPEN');
    close(row.minExternalAxialN, -500);
    assert.equal(row.minExternalAxialCaseId, 'CLOSE');
    close(row.maxShearResultantN, Math.hypot(50, 50));
    assert.equal(row.maxShearCaseId, 'TORSION');
  });
});

test('preload combination is an explicit non-modeled boundary, not a hidden arithmetic step', () => {
  const result = evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCase: loadCase('OPEN', { forceN: vector(0, 0, 4000) }),
  });
  assert.equal(result.preloadCombination.state, 'NOT_MODELED');
  assert.equal(result.preloadCombination.preloadCombinationPermitted, false);
  assert.equal(result.preloadCombination.directExternalAxialIncrementPermitted, false);
  assert.equal(Object.hasOwn(result.bolts[0], 'combinedAxialN'), false);
});

test('non-planar bolt coordinates fail closed', () => {
  assert.throws(() => evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: [
      { id: 'A', xM: -0.1, yM: -0.1, zM: 0 },
      { id: 'B', xM: 0.1, yM: -0.1, zM: 0 },
      { id: 'C', xM: 0, yM: 0.1, zM: 0.01 },
    ],
    loadCase: loadCase('CASE'),
  }), (error) => error.code === 'BOLT_GROUP_NOT_PLANAR');
});

test('collinear geometry retains a structured degeneracy failure', () => {
  assert.throws(() => evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: [
      { id: 'A', xM: -0.1, yM: 0, zM: 0 },
      { id: 'B', xM: 0, yM: 0, zM: 0 },
      { id: 'C', xM: 0.1, yM: 0, zM: 0 },
    ],
    loadCase: loadCase('CASE', { momentNm: vector(10, 0, 0) }),
  }), (error) => error.code === 'BOLT_GROUP_GEOMETRY_DEGENERATE');
});

test('duplicate load-case identity fails closed before evaluation', () => {
  assert.throws(() => evaluateBoltGroupLoadCases({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCases: [loadCase('DUP'), loadCase('DUP')],
  }), (error) => error.code === 'LOAD_CASE_ID_DUPLICATE');
});

test('six-DOF contract rejects omitted vector components instead of silently defaulting them', () => {
  assert.throws(() => evaluateBoltGroupLoadCase({
    frameId: 'JOINT-LOCAL',
    bolts: SQUARE,
    loadCase: {
      id: 'INCOMPLETE',
      forceN: { x: 0, y: 0 },
      momentNm: vector(),
      referencePointM: vector(),
    },
  }), (error) => error.code === 'INPUT_INVALID' && error.field === 'loadCases[0].forceN.z');
});
