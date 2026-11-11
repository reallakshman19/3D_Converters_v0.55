import { buildAivFacilityScenarioExecutionPlan } from './aiv-facility-scenario-plan.js';

function executionError(code, message) {
  const error = new Error(message);
  error.name = 'AivFacilityExecutionError';
  error.code = code;
  return error;
}

function blockedLinkError(status, errorCode) {
  return executionError(
    errorCode || 'AIV_FACILITY_SCENARIO_HANDOFF_NOT_CURRENT',
    `Linked facility AIV execution requires a CURRENT governed facility scenario handoff; received ${status ?? 'UNKNOWN'}.`,
  );
}

export function executeAivWithFacilityScenarioCustody({
  facilityLinkIntent = false,
  facilityScenarioHandoff = null,
  facilityScenarioHandoffStatus = null,
  facilityScenarioHandoffErrorCode = null,
  readinessEnvelope,
  request,
  calculate,
} = {}) {
  if (typeof calculate !== 'function') {
    throw executionError('AIV_FACILITY_CALCULATOR_REQUIRED', 'calculate must be a function.');
  }
  let scenarioExecutionPlan = null;
  if (facilityLinkIntent) {
    if (facilityScenarioHandoffStatus !== 'CURRENT' || !facilityScenarioHandoff) {
      throw blockedLinkError(facilityScenarioHandoffStatus, facilityScenarioHandoffErrorCode);
    }
    scenarioExecutionPlan = buildAivFacilityScenarioExecutionPlan({
      handoff: facilityScenarioHandoff,
      readinessEnvelope,
    });
  }
  const result = calculate(request);
  return Object.freeze({ result, scenarioExecutionPlan });
}
