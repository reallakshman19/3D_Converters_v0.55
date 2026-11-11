import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import {
  createVibrationFacilityRunBasis,
  vibrationFacilityRunBasisMatches,
} from './run-basis.js';
import { vibrationFacilityScenarioSetKey } from './scenario-handoff.js';

export const VIBRATION_FACILITY_MECHANISM_CURRENTNESS_SCHEMA =
  'VibrationFacilityMechanismCurrentnessProjection.v1';

export const VIBRATION_FACILITY_MECHANISM_CURRENTNESS_AUTHORITY = Object.freeze({
  purpose: 'PRESENTATION_CURRENTNESS_FILTER_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
});

function scopeKey(line, caseId) {
  return JSON.stringify([line, caseId ?? null]);
}

function emptyProjection(status, excluded = []) {
  return Object.freeze({
    schema: VIBRATION_FACILITY_MECHANISM_CURRENTNESS_SCHEMA,
    authority: VIBRATION_FACILITY_MECHANISM_CURRENTNESS_AUTHORITY,
    status,
    run: null,
    mechanicalCandidateResultsByScope: Object.freeze({}),
    sbcCandidateResultsByScope: Object.freeze({}),
    aivScreeningSession: null,
    excluded: Object.freeze([...excluded]),
  });
}

function currentRun(options) {
  if (options.resultState !== 'CURRENT_RESULT') return null;
  try {
    return createVibrationFacilityRunBasis({
      runId: options.runId,
      datasetId: options.datasetId,
      scenarioSetKey: options.scenarioSetKey,
    });
  } catch {
    return null;
  }
}

function scenarioMap(values, run) {
  if (!Array.isArray(values)) return null;
  const map = new Map();
  try {
    if (vibrationFacilityScenarioSetKey(values) !== run.scenarioSetKey) return null;
    for (const input of values) {
      const scenario = assertVibrationOperatingScenario(input);
      if (scenario.datasetId !== run.datasetId) return null;
      const key = scopeKey(scenario.line, scenario.caseId);
      if (map.has(key)) return null;
      map.set(key, scenario);
    }
  } catch {
    return null;
  }
  return map;
}

function scenarioBasisMatches(candidate, scenarios) {
  const basis = candidate?.scenarioExecutionBasis;
  if (!basis) return false;
  const scenario = scenarios.get(scopeKey(basis.line, basis.caseId));
  return Boolean(scenario)
    && basis.datasetId === scenario.datasetId
    && basis.scenarioId === scenario.scenarioId
    && basis.scenarioSnapshotHash === scenario.snapshotHash
    && basis.line === scenario.line
    && (basis.caseId ?? null) === (scenario.caseId ?? null);
}

function candidateCurrent(candidate, run, scenarios) {
  if (!candidate?.facilityRunBasis) return false;
  try {
    return vibrationFacilityRunBasisMatches(candidate.facilityRunBasis, run)
      && scenarioBasisMatches(candidate, scenarios);
  } catch {
    return false;
  }
}

function filterCandidateMap(mechanismId, values, run, scenarios, excluded) {
  const current = {};
  for (const [scopeId, candidate] of Object.entries(values ?? {})) {
    if (candidateCurrent(candidate, run, scenarios)) {
      current[scopeId] = candidate;
    } else {
      excluded.push(Object.freeze({ mechanismId, scopeId, reason: 'STALE_OR_FOREIGN_RUN_CUSTODY' }));
    }
  }
  return Object.freeze(current);
}

function currentAivSession(session, run, excluded) {
  if (!session) return null;
  const plan = session.scenarioExecutionPlan;
  const current = session.resultState === 'CURRENT_RESULT'
    && session.executionContext === 'FACILITY_LINKED'
    && plan
    && plan.facilityRunId === run.runId
    && plan.datasetId === run.datasetId
    && plan.scenarioSetKey === run.scenarioSetKey;
  if (current) return session;
  excluded.push(Object.freeze({
    mechanismId: 'aiv',
    scopeId: null,
    reason: 'STALE_OR_FOREIGN_RUN_CUSTODY',
  }));
  return null;
}

export function projectVibrationFacilityMechanismCurrentness(options = {}) {
  const run = currentRun(options);
  if (!run) return emptyProjection('FACILITY_RUN_NOT_CURRENT');
  const scenarios = scenarioMap(options.operatingScenarios, run);
  if (!scenarios) return emptyProjection('FACILITY_SCENARIO_SET_INVALID');
  const excluded = [];
  const mechanicalCandidateResultsByScope = filterCandidateMap(
    'mechanicalExcitation', options.mechanicalCandidateResultsByScope, run, scenarios, excluded,
  );
  const sbcCandidateResultsByScope = filterCandidateMap(
    'smallBoreConnections', options.sbcCandidateResultsByScope, run, scenarios, excluded,
  );
  const aivScreeningSession = currentAivSession(options.aivScreeningSession, run, excluded);
  return Object.freeze({
    schema: VIBRATION_FACILITY_MECHANISM_CURRENTNESS_SCHEMA,
    authority: VIBRATION_FACILITY_MECHANISM_CURRENTNESS_AUTHORITY,
    status: 'CURRENT_RUN_PROJECTED',
    run,
    mechanicalCandidateResultsByScope,
    sbcCandidateResultsByScope,
    aivScreeningSession,
    excluded: Object.freeze([...excluded]),
  });
}
