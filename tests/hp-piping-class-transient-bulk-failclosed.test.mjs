import assert from 'node:assert/strict';
import test from 'node:test';
import { previewHpPipingClassTransientBulkInput } from '../tabs/hp-piping-class-transient-bulk-input.js';

function baseProject() {
  return {
    transient: {
      spectrum: { spectrumId: 'SPEC-1' },
      states: [
        { spectrumId: 'SPEC-1', stateId: 'LOW', pressureMpa: 2, materialTemperatureC: 40, structuralTemperatureC: 40 },
        { spectrumId: 'SPEC-1', stateId: 'HIGH', pressureMpa: 20, materialTemperatureC: 80, structuralTemperatureC: 80 },
      ],
      transitions: [{ spectrumId: 'SPEC-1', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 500 }],
    },
    fatigueEvidence: [],
  };
}

const headerStates = 'state_id,pressure_mpa,material_temperature_c,structural_temperature_c';
const headerCycles = 'cycle_id,from_state_id,to_state_id,total_cycles,cycles_per_year,category,provenance_id';

function codes(result) {
  return new Set(result.issues.map((row) => row.code));
}

test('missing current spectrum identity blocks admission', () => {
  const p = baseProject();
  p.transient.spectrum.spectrumId = '';
  const result = previewHpPipingClassTransientBulkInput(p, {
    statesText: `${headerStates}\nLOW,2,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,LOW,HIGH,500,,,`,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('TRANSIENT_BULK_SPECTRUM_ID_REQUIRED'));
});

test('case-only state or cycle identity changes are blocked', () => {
  const stateCase = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nlow,2,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,low,HIGH,500,,,`,
  });
  assert.equal(stateCase.ok, false);
  assert.ok(codes(stateCase).has('STATE_BULK_STATE_ID_CASE_RENAME_BLOCKED'));

  const cycleCase = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,2,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nc1,LOW,HIGH,500,,,`,
  });
  assert.equal(cycleCase.ok, false);
  assert.ok(codes(cycleCase).has('CYCLE_BULK_CYCLE_ID_CASE_RENAME_BLOCKED'));
});

test('duplicate identities are case-insensitive and fail closed', () => {
  const result = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,2,40,40\nlow,3,41,41`,
    cyclesText: `${headerCycles}\nC1,LOW,LOW,10,,,\nc1,LOW,LOW,20,,,`,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('STATE_BULK_STATE_ID_DUPLICATE'));
  assert.ok(codes(result).has('CYCLE_BULK_CYCLE_ID_DUPLICATE'));
});

test('unknown and case-mismatched state references are rejected', () => {
  const unknown = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,2,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,LOW,MISSING,500,,,`,
  });
  assert.ok(codes(unknown).has('CYCLE_BULK_STATE_UNKNOWN'));

  const mismatch = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,2,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,LOW,high,500,,,`,
  });
  assert.ok(codes(mismatch).has('CYCLE_BULK_STATE_CASE_MISMATCH'));
});

test('negative pressure and cycle counts are rejected', () => {
  const result = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,-1,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,LOW,HIGH,-1,-2,PRESSURE,OPS`,
  });
  const issueCodes = codes(result);
  assert.ok(issueCodes.has('STATE_BULK_PRESSURE_INVALID'));
  assert.ok(issueCodes.has('CYCLE_BULK_TOTAL_CYCLES_INVALID'));
  assert.ok(issueCodes.has('CYCLE_BULK_CYCLES_PER_YEAR_INVALID'));
});

test('blank required numeric cells do not coerce to zero', () => {
  const result = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `${headerStates}\nLOW,,40,40\nHIGH,20,80,80`,
    cyclesText: `${headerCycles}\nC1,LOW,HIGH,,,,`,
  });
  const issueCodes = codes(result);
  assert.ok(issueCodes.has('STATE_BULK_PRESSURE_INVALID'));
  assert.ok(issueCodes.has('CYCLE_BULK_TOTAL_CYCLES_INVALID'));
});

test('header ownership is exact and design pressure is not part of the transient contract', () => {
  const result = previewHpPipingClassTransientBulkInput(baseProject(), {
    statesText: `state_id,design_pressure_mpa,material_temperature_c,structural_temperature_c\nLOW,2,40,40`,
    cyclesText: `${headerCycles}\nC1,LOW,HIGH,500,,,`,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('STATE_BULK_HEADER_MISMATCH'));
});
