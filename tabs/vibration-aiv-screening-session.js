import { assertAivFacilityScenarioExecutionPlan } from '../converters/vibration/aiv/aiv-facility-scenario-plan.js';

export const AIV_SCREENING_SESSION_SCHEMA = 'AivScreeningSessionEvidence.v1';

let currentSession = null;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertCurrentScreeningResult(result) {
  if (!result || typeof result !== 'object' || result.ok !== true) {
    throw new TypeError('AIV screening session requires a successful registered calculation result.');
  }
  if (result.calculationId !== 'VIB.AIV.ACOUSTIC'
      || result.outputs?.screeningResultScope !== 'ASSESSMENT'
      || result.assessment?.resultScope !== 'ASSESSMENT_SCREENING'
      || result.assessment?.screeningAuthority !== 'AUTHORIZED'
      || result.assessment?.lineCaseSummaryAuthoritativeForScreening !== false
      || result.assessment?.designAuthority !== false) {
    throw new Error('AIV_SCREENING_SESSION_AUTHORITY_INVALID');
  }
  return result;
}

export function publishCurrentAivScreeningSession(result, {
  inputRevision = null,
  scenarioExecutionPlan = null,
} = {}) {
  const screened = assertCurrentScreeningResult(result);
  const linkedPlan = scenarioExecutionPlan == null
    ? null
    : assertAivFacilityScenarioExecutionPlan(scenarioExecutionPlan);
  currentSession = deepFreeze({
    schema: AIV_SCREENING_SESSION_SCHEMA,
    calculationId: 'VIB.AIV.ACOUSTIC',
    resultState: 'CURRENT_RESULT',
    inputRevision: Number.isSafeInteger(inputRevision) && inputRevision >= 0 ? inputRevision : null,
    executionContext: linkedPlan ? 'FACILITY_LINKED' : 'STANDALONE',
    scenarioExecutionPlan: linkedPlan,
    screeningResult: screened,
    authority: {
      purpose: 'SESSION_CURRENT_SCREENING_EVIDENCE_ONLY',
      screeningAuthority: 'INHERITED_FROM_REGISTERED_AIV_RESULT',
      facilityScenarioAuthority: linkedPlan ? 'CUSTODY_ONLY' : 'NONE',
      lineCaseAggregationAuthority: false,
      designAuthority: false,
    },
  });
  return currentSession;
}

export function clearCurrentAivScreeningSession() {
  currentSession = null;
}

export function getCurrentAivScreeningSession() {
  return currentSession;
}
