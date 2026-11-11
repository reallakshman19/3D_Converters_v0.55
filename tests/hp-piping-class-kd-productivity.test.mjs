import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addAllHpPipingClassExternalResults,
  copyFirstHpPipingClassKdBasisToAll,
} from '../tabs/hp-piping-class-kd-productivity.js';

function project() {
  return {
    transient: {
      transitions: [
        { cycleId: 'C1', fromStateId: 'P0', toStateId: 'P1' },
        { cycleId: 'C2', fromStateId: 'P1', toStateId: 'P0' },
        { cycleId: 'C3', fromStateId: 'P0', toStateId: 'P2' },
      ],
    },
    fatigueEvidence: [{
      productId: 'P-1',
      externalResults: [{
        cycleId: 'C1', fromStateId: 'P0', toStateId: 'P1', locationId: 'L1',
        equivalentAlternatingStressMpa: 70, permissibleCycles: 10000,
        calculationBasis: { code: 'VIII-3', edition: '2025', methodRef: 'KD-3', calculationRef: 'CALC-1', calculatedBy: 'A' },
      }],
    }],
  };
}

test('add all creates exactly the uncovered governed cycles', () => {
  const value = project();
  const result = addAllHpPipingClassExternalResults(value, 0);
  assert.equal(result.added, 2);
  assert.deepEqual(value.fatigueEvidence[0].externalResults.map((row) => row.cycleId), ['C1', 'C2', 'C3']);
  assert.deepEqual(value.fatigueEvidence[0].externalResults[1], {
    cycleId: 'C2', fromStateId: 'P1', toStateId: 'P0', locationId: '', calculationBasis: {},
  });
  assert.equal(addAllHpPipingClassExternalResults(value, 0).added, 0);
});

test('copy first basis copies custody only and does not alter engineering values', () => {
  const value = project();
  addAllHpPipingClassExternalResults(value, 0);
  const before = value.fatigueEvidence[0].externalResults.map((row) => ({
    cycleId: row.cycleId, from: row.fromStateId, to: row.toStateId, locationId: row.locationId,
    seq: row.equivalentAlternatingStressMpa, permissibleCycles: row.permissibleCycles,
  }));
  const sourceBasis = value.fatigueEvidence[0].externalResults[0].calculationBasis;
  const result = copyFirstHpPipingClassKdBasisToAll(value, 0);
  assert.equal(result.copied, 2);
  assert.deepEqual(value.fatigueEvidence[0].externalResults.map((row) => row.calculationBasis), [sourceBasis, sourceBasis, sourceBasis]);
  assert.notEqual(value.fatigueEvidence[0].externalResults[1].calculationBasis, sourceBasis);
  assert.notEqual(value.fatigueEvidence[0].externalResults[2].calculationBasis, sourceBasis);
  assert.deepEqual(value.fatigueEvidence[0].externalResults.map((row) => ({
    cycleId: row.cycleId, from: row.fromStateId, to: row.toStateId, locationId: row.locationId,
    seq: row.equivalentAlternatingStressMpa, permissibleCycles: row.permissibleCycles,
  })), before);
});

test('helpers fail closed for missing packages or insufficient rows', () => {
  assert.equal(addAllHpPipingClassExternalResults({}, 0).reason, 'EVIDENCE_PACKAGE_NOT_FOUND');
  assert.equal(copyFirstHpPipingClassKdBasisToAll(project(), 0).reason, 'MULTIPLE_ROWS_REQUIRED');
});
