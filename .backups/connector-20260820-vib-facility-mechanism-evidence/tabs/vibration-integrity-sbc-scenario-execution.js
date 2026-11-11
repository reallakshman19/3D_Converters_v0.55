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

export function bindCurrentSbcFacilityScenario(state, scope) {
  const row = facilityRow(state, scope);
  const scenario = operatingScenarioForRow(state, row);
  if (!row || !scenario) return null;
  const binding = createVibrationScenarioExecutionBinding(scenario);
  state.sbcType3ScenarioBindingsByScope = {
    ...state.sbcType3ScenarioBindingsByScope,
    [scope]: binding,
  };
  return Object.freeze({ row, scenario, binding });
}

export function currentSbcFacilityScenarioCustody(state, scope) {
  const row = facilityRow(state, scope);
  const scenario = operatingScenarioForRow(state, row);
  const binding = state.sbcType3ScenarioBindingsByScope?.[scope] ?? null;
  return row && scenario && binding ? Object.freeze({ row, scenario, binding }) : null;
}

export function executeSbcFacilityWithScenario(state, scope, execute) {
  const custody = currentSbcFacilityScenarioCustody(state, scope);
  if (!custody) {
    const error = new Error(
      'Open this SBC facility scope from a current facility run before evaluating.',
    );
    error.name = 'SbcFacilityScenarioError';
    error.code = 'SBC_OPERATING_SCENARIO_NOT_CURRENT';
    throw error;
  }
  return executeVibrationWithScenarioGuard({
    scenarioBinding: custody.binding,
    operatingScenario: custody.scenario,
    execute,
  });
}
