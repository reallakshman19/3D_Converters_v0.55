import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VIBRATION_OPERATING_SCENARIO_DECLARATION,
  assembleVibrationIntegrityDataset,
  buildVibrationOperatingScenario,
} from '../converters/vibration/dataset/index.js';
import {
  VIBRATION_FACILITY_FIT_CALCULATION_ID,
  VIBRATION_FACILITY_FIT_PLAN_SCHEMA,
} from '../converters/vibration/facility/fit-plan.js';
import { executeVibrationFacilityFitPlan } from '../converters/vibration/facility/fit-execute.js';
import {
  createVibrationScenarioExecutionBinding,
  executeVibrationWithScenarioGuard,
} from '../converters/vibration/mechanisms/scenario-execution.js';
import {
  MECHANICAL_T23_SOURCE_OPTIONS,
  evaluateMechanicalFacilityCandidateWithScenario,
} from '../converters/vibration/mechanical/facility.js';
import {
  VIBRATION_TABLE_EXCHANGE_INTEGRITY,
  VIBRATION_TABLE_EXCHANGE_SCHEMA,
} from '../converters/vibration/exchange/schema.js';
import {
  bindCurrentSbcFacilityScenario,
  executeSbcFacilityWithScenario,
} from '../tabs/vibration-integrity-sbc-scenario-execution.js';
import { evaluateSbcType3ExplicitIntermediate } from '../tabs/vibration-integrity-sbc-type3-controller.js';
import { createVibrationUserEngineeringDataTable } from '../tabs/vibration-integrity-user-data-model.js';

function exchange() {
  return {
    schema: VIBRATION_TABLE_EXCHANGE_SCHEMA,
    completeExchange: true,
    integrityStatus: VIBRATION_TABLE_EXCHANGE_INTEGRITY.DECLARED_NOT_REVERIFIED,
    authority: {
      canonicalHash: 'sha256:canonical', projectionHash: 'sha256:projection',
      sourceHash: 'sha256:source', datasetId: 'plant-a', datasetVersion: 'rev-1',
    },
    sourceFileName: 'plant-a.xlsx',
    elements: [{ canonicalId: 'CANON-001', line: 'L-100', type: 'PIPE' }],
  };
}

function operatingCase(massFlow = 100) {
  return {
    caseId: 'NORMAL', line: 'L-100', label: 'Normal operation', phase: 'GAS',
    source: 'HMB-100', sourceRevision: 'C', recordId: 'HMB-100-L100-NORMAL',
    massFlow: { value: massFlow, unit: 'kg/s' },
    density: { value: 8, unit: 'kg/m3' },
    pressure: { value: 10, unit: 'barg', reference: 'gauge' },
    temperature: { value: 40, unit: 'C' },
  };
}

function dataset(massFlow = 100) {
  return assembleVibrationIntegrityDataset({
    exchange: exchange(), operatingCases: [operatingCase(massFlow)], enrichment: [],
  });
}

function scenario(massFlow = 100) {
  return buildVibrationOperatingScenario(dataset(massFlow), {
    line: 'L-100', caseId: 'NORMAL',
    coherenceDeclaration: VIBRATION_OPERATING_SCENARIO_DECLARATION,
  });
}

function scenarioBasis(current) {
  return {
    schema: 'VibrationScenarioExecutionBasis.v1',
    scenarioId: current.scenarioId,
    scenarioSnapshotHash: current.snapshotHash,
    datasetId: current.datasetId,
    line: current.line,
    caseId: current.caseId,
  };
}

function facilityRow(current = scenario()) {
  return {
    line: 'L-100',
    caseId: 'NORMAL',
    canonicalId: 'CANON-001',
    scenarioSetKey: 'VFSK1:test-current-set',
    scenarioExecutionBasis: scenarioBasis(current),
  };
}

function facilityState(currentScenario) {
  return {
    resultState: 'CURRENT_RESULT',
    runSnapshot: { runId: 'FIT-RUN-TEST' },
    workspace: { rows: [facilityRow(currentScenario)] },
    envelope: { workflow: { operatingScenarios: [currentScenario] } },
    sbcType3ScenarioBindingsByScope: {},
    sbcType3ScopeId: 'SBC-FACILITY/L-100/NORMAL/CANON-001',
    userEngineeringData: createVibrationUserEngineeringDataTable(),
    error: null,
  };
}

function readyFitPlan(binding) {
  return {
    schema: VIBRATION_FACILITY_FIT_PLAN_SCHEMA,
    authority: 'REQUEST_PLANNING_ONLY',
    engineeringAuthority: 'SCREENING',
    screeningAuthorized: true,
    calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
    qualificationMode: 'screening',
    datasetSchema: 'VibrationIntegrityDataset.v1',
    datasetId: binding.datasetId,
    items: [{
      status: 'READY',
      calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
      canonicalId: 'CANON-001', line: 'L-100', caseId: 'NORMAL',
      missing: [], invalid: [], reasons: [],
      scenarioBinding: binding,
      request: {
        calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
        inputs: {}, inputUnits: {},
        options: { qualificationMode: 'screening', includeEvidence: true },
      },
      sourceTrace: null,
    }],
    counts: { assessmentPoints: 1, items: 1, ready: 1, notReady: 0 },
    warnings: [],
  };
}

test('common runtime guard rejects same logical scenario with changed snapshot before callback', () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const binding = createVibrationScenarioExecutionBinding(prepared);
  let calls = 0;
  assert.throws(
    () => executeVibrationWithScenarioGuard({
      scenarioBinding: binding,
      operatingScenario: current,
      execute: () => { calls += 1; return 'UNREACHABLE'; },
    }),
    (error) => error.code === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH',
  );
  assert.equal(calls, 0);
});

test('common runtime guard reaches callback exactly once for the exact snapshot', () => {
  const prepared = scenario(100);
  const binding = createVibrationScenarioExecutionBinding(prepared);
  let calls = 0;
  const value = executeVibrationWithScenarioGuard({
    scenarioBinding: binding,
    operatingScenario: prepared,
    execute: ({ executionBasis }) => {
      calls += 1;
      return executionBasis.scenarioSnapshotHash;
    },
  });
  assert.equal(calls, 1);
  assert.equal(value, prepared.snapshotHash);
});

test('FIT facility execution rejects stale scenario before the central batch call is reachable', () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const plan = readyFitPlan(createVibrationScenarioExecutionBinding(prepared));
  assert.throws(
    () => executeVibrationFacilityFitPlan(plan, { operatingScenarios: [current] }),
    (error) => error.code === 'FIT_FACILITY_SCENARIO_SNAPSHOT_MISMATCH'
      && error.details?.upstreamCode === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH',
  );
});

test('Mechanical T2.3 facility wrapper fails on stale snapshot before evaluating the method', async () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const sourceKey = MECHANICAL_T23_SOURCE_OPTIONS.find((row) => row.screeningAuthorized)?.sourceKey;
  assert(sourceKey);
  await assert.rejects(
    evaluateMechanicalFacilityCandidateWithScenario({
      row: facilityRow(prepared), sourceKeys: [sourceKey],
      scenarioBinding: createVibrationScenarioExecutionBinding(prepared),
      operatingScenario: current,
    }),
    (error) => error.code === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH',
  );
});

test('SBC facility helper rejects stale current scenario before callback', () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const state = facilityState(prepared);
  const scope = state.sbcType3ScopeId;
  const custody = bindCurrentSbcFacilityScenario(state, scope);
  assert(custody);
  assert.equal(custody.runBasis.runId, 'FIT-RUN-TEST');
  state.envelope = { workflow: { operatingScenarios: [current] } };
  let calls = 0;
  assert.throws(
    () => executeSbcFacilityWithScenario(state, scope, () => { calls += 1; return 'UNREACHABLE'; }),
    (error) => error.code === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH',
  );
  assert.equal(calls, 0);
});

test('legacy SBC explicit-intermediate button path is also stale-snapshot guarded', () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const state = facilityState(prepared);
  const scope = state.sbcType3ScopeId;
  assert(bindCurrentSbcFacilityScenario(state, scope));
  state.envelope = { workflow: { operatingScenarios: [current] } };
  let calls = 0;
  const ok = evaluateSbcType3ExplicitIntermediate(
    state,
    () => {},
    () => {},
    () => { calls += 1; return { ok: true, status: 'UNREACHABLE', lof: 0.1 }; },
  );
  assert.equal(ok, false);
  assert.equal(calls, 0);
  assert.match(state.error, /VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH/);
});

test('SBC exact-snapshot callback receives the originating facility run basis', () => {
  const prepared = scenario(100);
  const state = facilityState(prepared);
  const scope = state.sbcType3ScopeId;
  assert(bindCurrentSbcFacilityScenario(state, scope));
  let observed = null;
  const value = executeSbcFacilityWithScenario(state, scope, ({ facilityRunBasis }) => {
    observed = facilityRunBasis;
    return 'OK';
  });
  assert.equal(value, 'OK');
  assert.equal(observed.runId, 'FIT-RUN-TEST');
  assert.equal(observed.datasetId, 'plant-a');
  assert.equal(observed.scenarioSetKey, 'VFSK1:test-current-set');
});

test('SBC mechanism matrix remains projection-only and cannot import the Type-3 calculator', () => {
  const here = fileURLToPath(new URL('../converters/vibration/mechanisms/sbc.js', import.meta.url));
  const source = readFileSync(here, 'utf8');
  assert.match(source, /inspectSbcFacilityType3/);
  assert.doesNotMatch(source, /calculateSbcType3FromUserEngineeringData/);
});
