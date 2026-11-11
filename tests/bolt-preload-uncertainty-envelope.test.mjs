import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessExplicitPreloadEnvelope,
  EXPLICIT_PRELOAD_ENVELOPE_METHOD,
} from '../converters/engineering-calculations/bolts/preload-uncertainty.js';

const INPUT = Object.freeze({
  assemblyMethodId: 'PROJECT_TORQUE_CONTROL_A',
  sequenceId: 'PROJECT_SEQUENCE_A',
  uncertaintyBasisId: 'PROJECT_PRELOAD_BOUNDS_REV_A',
  bolts: Object.freeze([
    Object.freeze({ boltId: 'B1', minimumPreloadN: 90_000, targetPreloadN: 100_000, maximumPreloadN: 112_000 }),
    Object.freeze({ boltId: 'B2', minimumPreloadN: 92_000, targetPreloadN: 100_000, maximumPreloadN: 109_000 }),
    Object.freeze({ boltId: 'B3', minimumPreloadN: 88_000, targetPreloadN: 100_000, maximumPreloadN: 111_000 }),
  ]),
});

function close(actual, expected, tolerance = 1e-12) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test('sums explicit per-bolt bounds into a joint clamp envelope', () => {
  const result = assessExplicitPreloadEnvelope(INPUT);
  assert.equal(result.jointClamp.minimumClampN, 270_000);
  assert.equal(result.jointClamp.targetClampN, 300_000);
  assert.equal(result.jointClamp.maximumClampN, 332_000);
  assert.equal(result.jointClamp.lowerClampDeviationN, 30_000);
  assert.equal(result.jointClamp.upperClampDeviationN, 32_000);
});

test('retains asymmetric bolt bounds without symmetrizing scatter', () => {
  const result = assessExplicitPreloadEnvelope(INPUT);
  assert.equal(result.bolts[0].lowerDeviationN, 10_000);
  assert.equal(result.bolts[0].upperDeviationN, 12_000);
  close(result.bolts[0].minimumToTargetRatio, 0.9);
  close(result.bolts[0].maximumToTargetRatio, 1.12);
});

test('reports deterministic bound widths only, not statistical confidence', () => {
  const result = assessExplicitPreloadEnvelope(INPUT);
  assert.equal(result.jointClamp.boundWidthN, 62_000);
  close(result.jointClamp.boundWidthFractionOfTarget, 62_000 / 300_000);
  assert.equal(result.probabilisticInterpretation, false);
  assert.equal(result.combinationRule, 'SIMULTANEOUS_EXPLICIT_BOUNDS_SUM');
});

test('requires explicit assembly method, sequence and uncertainty basis identities', () => {
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, assemblyMethodId: '' }), (error) => error.field === 'assemblyMethodId');
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, sequenceId: null }), (error) => error.field === 'sequenceId');
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, uncertaintyBasisId: undefined }), (error) => error.field === 'uncertaintyBasisId');
});

test('requires every bound explicitly and creates no hidden scatter defaults', () => {
  const bolts = [{ boltId: 'B1', targetPreloadN: 100_000, maximumPreloadN: 110_000 }];
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, bolts }), (error) => error.field === 'bolts[0].minimumPreloadN');
});

test('rejects negative preload bounds', () => {
  const bolts = [{ boltId: 'B1', minimumPreloadN: -1, targetPreloadN: 100_000, maximumPreloadN: 110_000 }];
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, bolts }), (error) => error.code === 'INPUT_INVALID');
});

test('rejects bounds that do not contain the target preload', () => {
  assert.throws(() => assessExplicitPreloadEnvelope({
    ...INPUT,
    bolts: [{ boltId: 'B1', minimumPreloadN: 101_000, targetPreloadN: 100_000, maximumPreloadN: 110_000 }],
  }), (error) => error.field === 'bolts[0].minimumPreloadN');
  assert.throws(() => assessExplicitPreloadEnvelope({
    ...INPUT,
    bolts: [{ boltId: 'B1', minimumPreloadN: 90_000, targetPreloadN: 100_000, maximumPreloadN: 99_000 }],
  }), (error) => error.field === 'bolts[0].maximumPreloadN');
});

test('rejects duplicate bolt identities', () => {
  const bolts = [
    { boltId: 'B1', minimumPreloadN: 90_000, targetPreloadN: 100_000, maximumPreloadN: 110_000 },
    { boltId: 'B1', minimumPreloadN: 90_000, targetPreloadN: 100_000, maximumPreloadN: 110_000 },
  ];
  assert.throws(() => assessExplicitPreloadEnvelope({ ...INPUT, bolts }), (error) => error.field === 'bolts');
});

test('declares predictive assembly physics as not modeled', () => {
  const result = assessExplicitPreloadEnvelope(INPUT);
  assert.equal(result.predictsElasticInteraction, false);
  assert.equal(result.predictsSequenceEffects, false);
  assert.equal(result.predictsToolScatter, false);
  assert.equal(result.predictsFrictionScatter, false);
});

test('remains non-authorizing and outside the central engineering registry', () => {
  const result = assessExplicitPreloadEnvelope(INPUT);
  assert.equal(result.method, EXPLICIT_PRELOAD_ENVELOPE_METHOD);
  assert.equal(result.sourceAuthority, 'EXPLICIT_INPUT_BOUND_ONLY');
  assert.equal(result.codeCompliance, false);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
});
