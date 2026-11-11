import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';
import {
  createVibrationScenarioExecutionBinding,
  executeVibrationWithScenarioGuard,
} from '../converters/vibration/mechanisms/scenario-execution.js';
import { sbcFacilityScopeId } from '../converters/vibration/sbc/facility.js?v=20260820-runtime-scenario-guard-1';

function facilityRow(state, scope) {
  return (state.workspace?.rows ?? []).find((row) => {
    try {
      return sbcFacilityScopeId(row) === scope;
    } catch {
      return false;
    }
  }) ?? null;
}

function operatingScenarioForRow(state, row) {
  if (!row || state.resultState !== 'CURRENT_RESULT') return null;
  return (state.envelope?.workflow?.operatingScenarios ?? []).find((scenario) => (
    scenario.line === row.line && scenario.caseId === row.caseId
  )) ?? null;
}

function facilityRunBasisForRow(state, row) {
  if (!row || state.resultState !== 'CURRENT_RESULT') return null;
  const result = state.envelope?.workflow?.result;
  const scenario = operatingScenarioForRow(state, row);
  const runId = state.runSnapshot?.runId;
  const datasetId = result?.datasetId ?? scenario?.datasetId;
  const scenarioSetKey = result?.scenarioSetKey ?? row.scenarioSetKey;
  if (!runId || !datasetId || !scenarioSetKey) return null;
  return createVibrationFacilityRunBasis({ runId, datasetId, scenarioSetKey });
}

export function bindCurrentSbcFacilityScenario(state, scope) {
  const row = facilityRow(state, scope);
  const scenario = operatingScenarioForRow(state, row);
  const runBasis = facilityRunBasisForRow(state, row);
  if (!row || !scenario || !runBasis) return null;
  const binding = createVibrationScenarioExecutionBinding(scenario);
  state.sbcType3ScenarioBindingsByScope = {
    ...state.sbcType3ScenarioBindingsByScope,
    [scope]: binding,
  };
  return Object.freeze({ row, scenario, binding, runBasis });
}

export function currentSbcFacilityScenarioCustody(state, scope) {
  const row = facilityRow(state, scope);
  const scenario = operatingScenarioForRow(state, row);
  const binding = state.sbcType3ScenarioBindingsByScope?.[scope] ?? null;
  const runBasis = facilityRunBasisForRow(state, row);
  return row && scenario && binding && runBasis
    ? Object.freeze({ row, scenario, binding, runBasis })
    : null;
}

export function executeSbcFacilityWithScenario(state, scope, execute) {
  const custody = currentSbcFacilityScenarioCustody(state, scope);
  if (!custody) {
    const error = new Error(
      'Open this SBC facility scope from a current facility run before evaluating.',
    );
    error.name = 'SbcFacilityScenarioError';
    error.code = 'SBC_FACILITY_RUN_NOT_CURRENT';
    throw error;
  }
  return executeVibrationWithScenarioGuard({
    scenarioBinding: custody.binding,
    operatingScenario: custody.scenario,
    execute: (guarded) => execute({ ...guarded, facilityRunBasis: custody.runBasis }),
  });
}
