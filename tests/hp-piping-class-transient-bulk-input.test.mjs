import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHpPipingClassTransientBulkInput,
  previewHpPipingClassTransientBulkInput,
} from '../tabs/hp-piping-class-transient-bulk-input.js';

function project() {
  return {
    metadata: { projectId: 'P1', classId: 'HP', revision: 'A', referenceSampleId: 'REF' },
    transient: {
      spectrum: { spectrumId: 'SPEC-1', designLifeYears: 20 },
      states: [
        { spectrumId: 'SPEC-1', stateId: 'LOW', pressureMpa: 2, materialTemperatureC: 40, structuralTemperatureC: 40 },
        { spectrumId: 'SPEC-1', stateId: 'HIGH', pressureMpa: 20, materialTemperatureC: 80, structuralTemperatureC: 80 },
      ],
      transitions: [
        { spectrumId: 'SPEC-1', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 500, category: 'PRESSURE_CYCLE' },
      ],
    },
    fatigueEvidence: [{
      productId: 'NPS4-S160',
      externalResults: [{
        cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', locationId: 'BORE_INNER_SURFACE',
        equivalentAlternatingStressMpa: 70, permissibleCycles: 10000,
      }],
    }],
  };
}

const states = [
  'state_id,pressure_mpa,material_temperature_c,structural_temperature_c',
  'LOW,2,40,40',
  'HIGH,20,80,80',
].join('\n');

const cycles = [
  'cycle_id,from_state_id,to_state_id,total_cycles,cycles_per_year,category,provenance_id',
  'C1,LOW,HIGH,500,25,PRESSURE_CYCLE,OPS-001',
].join('\n');

test('two-table preview uses current spectrum identity and reproduces input pressure range', () => {
  const result = previewHpPipingClassTransientBulkInput(project(), { statesText: states, cyclesText: cycles });
  assert.equal(result.ok, true);
  assert.equal(result.spectrumId, 'SPEC-1');
  assert.equal(result.summary.parsedStates, 2);
  assert.equal(result.summary.parsedCycles, 1);
  assert.equal(result.summary.totalDeclaredCycles, 500);
  assert.equal(result.transitions[0].previewPressureRangeMpa, 18);
  assert.equal(result.transitions[0].cyclesPerYear, 25);
});

test('apply replaces transient rows through canonical field names and retains exact KD custody', () => {
  const result = applyHpPipingClassTransientBulkInput(project(), { statesText: states, cyclesText: cycles });
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.deepEqual(result.project.transient.states.map((row) => row.spectrumId), ['SPEC-1', 'SPEC-1']);
  assert.equal(result.project.transient.transitions[0].spectrumId, 'SPEC-1');
  assert.equal(result.project.transient.transitions[0].previewPressureRangeMpa, undefined);
  assert.equal(result.project.fatigueEvidence.length, 1);
  assert.equal(result.project.fatigueEvidence[0].externalResults.length, 1);
  assert.equal(result.plan.removedExternalRows.length, 0);
  assert.equal(result.project.metadata.referenceSampleId, undefined);
});

test('new governed cycle is explicit as missing from existing KD package', () => {
  const expanded = `${cycles}\nC2,HIGH,LOW,100,,SHUTDOWN,OPS-002`;
  const result = previewHpPipingClassTransientBulkInput(project(), { statesText: states, cyclesText: expanded });
  assert.equal(result.ok, true);
  assert.equal(result.summary.parsedCycles, 2);
  assert.equal(result.summary.fatiguePackagesNeedingCycleRows, 1);
  assert.deepEqual(result.plan.packages[0].missingCycleIds, ['C2']);
});

test('changed state pair invalidates external Seq/N custody instead of rewriting it', () => {
  const changed = [
    'cycle_id,from_state_id,to_state_id,total_cycles,cycles_per_year,category,provenance_id',
    'C1,HIGH,LOW,500,25,PRESSURE_CYCLE,OPS-001',
  ].join('\n');
  const result = applyHpPipingClassTransientBulkInput(project(), { statesText: states, cyclesText: changed });
  assert.equal(result.ok, true);
  assert.equal(result.plan.removedExternalRows.length, 1);
  assert.equal(result.plan.removedExternalRows[0].reason, 'STATE_PAIR_CHANGED');
  assert.deepEqual(result.plan.removedFatigueProductIds, ['NPS4-S160']);
  assert.equal(result.project.fatigueEvidence.length, 0);
});

test('state pressure or temperature drift invalidates external Seq/N even when cycle identity and pair are unchanged', () => {
  const changedStates = [
    'state_id,pressure_mpa,material_temperature_c,structural_temperature_c',
    'LOW,2,40,40',
    'HIGH,21,81,80',
  ].join('\n');
  const result = applyHpPipingClassTransientBulkInput(project(), { statesText: changedStates, cyclesText: cycles });
  assert.equal(result.ok, true);
  assert.equal(result.plan.removedExternalRows.length, 1);
  assert.equal(result.plan.removedExternalRows[0].cycleId, 'C1');
  assert.equal(result.plan.removedExternalRows[0].reason, 'STATE_VALUE_CHANGED');
  assert.deepEqual(result.plan.removedFatigueProductIds, ['NPS4-S160']);
  assert.equal(result.project.fatigueEvidence.length, 0);
  assert.equal(result.transitions[0].previewPressureRangeMpa, 19);
});

test('removed cycle removes stale external row while retaining other valid KD rows', () => {
  const p = project();
  p.transient.transitions.push({ spectrumId: 'SPEC-1', cycleId: 'C2', fromStateId: 'HIGH', toStateId: 'LOW', totalCycles: 100 });
  p.fatigueEvidence[0].externalResults.push({ cycleId: 'C2', fromStateId: 'HIGH', toStateId: 'LOW', locationId: 'BORE' });
  const result = applyHpPipingClassTransientBulkInput(p, { statesText: states, cyclesText: cycles });
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.removedExternalRows.map((row) => [row.cycleId, row.reason]), [['C2', 'CYCLE_REMOVED']]);
  assert.equal(result.project.fatigueEvidence[0].externalResults.length, 1);
  assert.equal(result.project.fatigueEvidence[0].externalResults[0].cycleId, 'C1');
});

test('CSV and TSV contracts normalize to the same transient model', () => {
  const stateTsv = states.replaceAll(',', '\t');
  const cycleTsv = cycles.replaceAll(',', '\t');
  const result = previewHpPipingClassTransientBulkInput(project(), { statesText: stateTsv, cyclesText: cycleTsv });
  assert.equal(result.ok, true);
  assert.equal(result.statesDelimiter, 'TSV');
  assert.equal(result.cyclesDelimiter, 'TSV');
  assert.equal(result.transitions[0].previewPressureRangeMpa, 18);
});
