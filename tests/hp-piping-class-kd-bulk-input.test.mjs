import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_KD_BULK_HEADERS,
  applyHpPipingClassKdBulkInput,
  previewHpPipingClassKdBulkInput,
} from '../tabs/hp-piping-class-kd-bulk-input.js';

function project() {
  return {
    transient: { transitions: [
      { cycleId: 'C1', fromStateId: 'P0', toStateId: 'P1' },
      { cycleId: 'C2', fromStateId: 'P1', toStateId: 'P0' },
    ] },
    fatigueEvidence: [{ productId: 'P-1', externalResults: [{
      cycleId: 'C1', fromStateId: 'P0', toStateId: 'P1', locationId: 'OLD',
      userAlternatingStressIntensityMpa: 10,
      equivalentAlternatingStressMpa: 11,
      permissibleCycles: 100,
      associatedMeanStressMpa: 33,
      calculationBasis: { code: 'VIII-3', edition: '2025', methodRef: 'KD-3', calculationRef: 'CALC-1', calculatedBy: 'A' },
    }] }],
  };
}

const header = HP_PIPING_CLASS_KD_BULK_HEADERS.join('\t');

test('valid TSV maps every governed cycle and preserves same-cycle custody', () => {
  const value = project();
  const source = `${header}\nC2\tL2\t20\t25\t5000\nC1\tL1\t15\t18\t2000`;
  const preview = previewHpPipingClassKdBulkInput(value, 0, source);
  assert.equal(preview.ok, true);
  assert.equal(preview.delimiter, 'TSV');
  const applied = applyHpPipingClassKdBulkInput(value, 0, source);
  assert.equal(applied.applied, true);
  assert.deepEqual(value.fatigueEvidence[0].externalResults.map((row) => row.cycleId), ['C1', 'C2']);
  assert.equal(value.fatigueEvidence[0].externalResults[0].locationId, 'L1');
  assert.equal(value.fatigueEvidence[0].externalResults[0].equivalentAlternatingStressMpa, 18);
  assert.equal(value.fatigueEvidence[0].externalResults[0].permissibleCycles, 2000);
  assert.equal(value.fatigueEvidence[0].externalResults[0].associatedMeanStressMpa, 33);
  assert.equal(value.fatigueEvidence[0].externalResults[0].calculationBasis.calculationRef, 'CALC-1');
  assert.deepEqual(value.fatigueEvidence[0].externalResults[1].calculationBasis, {});
});

test('valid CSV supports quoted location text', () => {
  const source = `${HP_PIPING_CLASS_KD_BULK_HEADERS.join(',')}\nC1,"NOZZLE, A",15,18,2000\nC2,L2,20,25,5000`;
  const preview = previewHpPipingClassKdBulkInput(project(), 0, source);
  assert.equal(preview.ok, true);
  assert.equal(preview.delimiter, 'CSV');
  assert.equal(preview.rows[0].locationId, 'NOZZLE, A');
});

test('duplicate or unknown cycles fail closed without mutation', () => {
  const value = project();
  const before = structuredClone(value);
  const source = `${header}\nC1\tL1\t15\t18\t2000\nC1\tL2\t20\t25\t5000\nC9\tL9\t10\t12\t1000`;
  const result = applyHpPipingClassKdBulkInput(value, 0, source);
  assert.equal(result.applied, false);
  assert.equal(result.issues.some((row) => row.code === 'KD_BULK_CYCLE_DUPLICATE'), true);
  assert.equal(result.issues.some((row) => row.code === 'KD_BULK_CYCLE_UNKNOWN'), true);
  assert.deepEqual(value, before);
});

test('partial table is rejected because bulk mode requires the complete governed set', () => {
  const value = project();
  const before = structuredClone(value);
  const result = applyHpPipingClassKdBulkInput(value, 0, `${header}\nC1\tL1\t15\t18\t2000`);
  assert.equal(result.applied, false);
  assert.equal(result.issues.some((row) => row.code === 'KD_BULK_CYCLE_MISSING'), true);
  assert.deepEqual(value, before);
});

test('invalid Seq or permissible life is rejected', () => {
  const source = `${header}\nC1\tL1\t15\t-1\t2000\nC2\tL2\t20\t25\t0`;
  const preview = previewHpPipingClassKdBulkInput(project(), 0, source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'KD_BULK_SEQ_INVALID'), true);
  assert.equal(preview.issues.some((row) => row.code === 'KD_BULK_N_INVALID'), true);
});

test('blank user Salt clears stale cross-check and zero Seq may omit N', () => {
  const value = project();
  const source = `${header}\nC1\tL1\t\t0\t\nC2\tL2\t20\t25\t5000`;
  const applied = applyHpPipingClassKdBulkInput(value, 0, source);
  assert.equal(applied.applied, true);
  assert.equal('userAlternatingStressIntensityMpa' in value.fatigueEvidence[0].externalResults[0], false);
  assert.equal('permissibleCycles' in value.fatigueEvidence[0].externalResults[0], false);
});
