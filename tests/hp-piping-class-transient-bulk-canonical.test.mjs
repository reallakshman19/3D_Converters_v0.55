import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveChapterIxTransientSpectrum } from '../converters/b313-chapter-ix/transient-spectrum.js';
import { applyHpPipingClassTransientBulkInput } from '../tabs/hp-piping-class-transient-bulk-input.js';

const statesText = [
  'state_id,pressure_mpa,material_temperature_c,structural_temperature_c',
  'LOW,2,40,45',
  'HIGH,20,80,75',
].join('\n');

const cyclesText = [
  'cycle_id,from_state_id,to_state_id,total_cycles,cycles_per_year,category,provenance_id',
  'C1,LOW,HIGH,500,25,PRESSURE_CYCLE,OPS-001',
].join('\n');

function project() {
  return {
    metadata: {},
    transient: {
      spectrum: { spectrumId: 'SPEC-1', designLifeYears: 20, preparedBy: 'Engineer A' },
      states: [],
      transitions: [],
    },
    fatigueEvidence: [],
  };
}

test('bulk-applied state/cycle model is accepted directly by canonical transient resolver', () => {
  const applied = applyHpPipingClassTransientBulkInput(project(), { statesText, cyclesText });
  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);

  const resolved = resolveChapterIxTransientSpectrum(applied.project.transient);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.canUseForDesignAuthority, false);
  assert.equal(resolved.spectrumId, 'SPEC-1');
  assert.equal(resolved.designLifeYears, 20);
  assert.equal(resolved.cycleCount, 1);
  assert.equal(resolved.totalDeclaredCycles, 500);
  assert.equal(resolved.cycles[0].cycleId, 'C1');
  assert.equal(resolved.cycles[0].pressureRangeMpa, 18);
  assert.equal(resolved.cycles[0].meanPressureMpa, 11);
  assert.equal(resolved.cycles[0].materialTemperatureRangeC, 40);
  assert.equal(resolved.cycles[0].structuralTemperatureRangeC, 30);
  assert.equal(resolved.cycles[0].cyclesPerYear, 25);
  assert.equal(resolved.cycles[0].provenanceId, 'OPS-001');
});

test('changing total lifetime cycles does not mutate state stress basis and canonical resolver uses the new n', () => {
  const changedCycles = cyclesText.replace(',500,25,', ',750,37.5,');
  const applied = applyHpPipingClassTransientBulkInput(project(), { statesText, cyclesText: changedCycles });
  const resolved = resolveChapterIxTransientSpectrum(applied.project.transient);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.totalDeclaredCycles, 750);
  assert.equal(resolved.cycles[0].totalCycles, 750);
  assert.equal(resolved.cycles[0].cyclesPerYear, 37.5);
  assert.equal(resolved.cycles[0].pressureRangeMpa, 18);
  assert.equal(resolved.cycles[0].meanPressureMpa, 11);
});
