import { inspectAivFacilityScenarioPlanForAssessment } from '../aiv/aiv-facility-scenario-plan.js';
import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import { inspectMechanicalFacilityCandidate, mechanicalFacilityScopeId } from '../mechanical/facility.js';
import { inspectSbcFacilityType3, sbcFacilityScopeId } from '../sbc/facility.js';
import {
  assertVibrationFacilityRunBasis,
  createVibrationFacilityRunBasis,
  vibrationFacilityRunBasisMatches,
} from './run-basis.js';

export const VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCHEMA = 'VibrationFacilityMechanismEvidence.v1';
export const VIBRATION_FACILITY_MECHANISM_EVIDENCE_AUTHORITY = Object.freeze({
  purpose: 'FACILITY_MECHANISM_REPRODUCIBILITY_PROJECTION_ONLY',
  engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
  numericalAuthority: 'NONE', aggregationAuthority: 'NONE', persistenceAuthority: 'NONE',
  determinesApplicability: false, determinesCompleteness: false,
  blocksExecution: false, blocksNavigation: false, blocksCalculation: false, blocksPersistence: false,
});

function evidenceError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationFacilityMechanismEvidenceError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function jsonClone(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)); }
function scope(row) { return Object.freeze({ line: row.line ?? null, caseId: row.caseId ?? null, canonicalId: row.canonicalId ?? null }); }
function scopeKey(line, caseId) { return JSON.stringify([line, caseId]); }
function scenarioBasis(scenario) {
  return Object.freeze({
    schema: 'VibrationScenarioExecutionBasis.v1', scenarioId: scenario.scenarioId,
    scenarioSnapshotHash: scenario.snapshotHash, datasetId: scenario.datasetId,
    line: scenario.line, caseId: scenario.caseId,
  });
}
function scenarioBasisMatches(candidate, current) {
  if (!candidate || !current) return false;
  return candidate.datasetId === current.datasetId && candidate.scenarioId === current.scenarioId
    && candidate.scenarioSnapshotHash === current.scenarioSnapshotHash
    && candidate.line === current.line && candidate.caseId === current.caseId;
}

function scenarioMap(values, runBasis) {
  if (!Array.isArray(values)) throw evidenceError(
    'VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCENARIOS_INVALID', 'operatingScenarios must be an array.',
  );
  const map = new Map();
  for (const value of values) {
    const scenario = assertVibrationOperatingScenario(value);
    if (scenario.datasetId !== runBasis.datasetId) throw evidenceError(
      'VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCENARIO_DATASET_MISMATCH',
      'OperatingScenario dataset does not match the facility run basis.',
    );
    const key = scopeKey(scenario.line, scenario.caseId);
    if (map.has(key)) throw evidenceError(
      'VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCENARIO_DUPLICATE',
      `Duplicate OperatingScenario for ${scenario.line}/${scenario.caseId}.`,
    );
    map.set(key, scenario);
  }
  return map;
}

function runRows(rowsInput, runBasis, scenarios) {
  if (!Array.isArray(rowsInput)) throw evidenceError(
    'VIBRATION_FACILITY_MECHANISM_EVIDENCE_ROWS_INVALID', 'Facility register rows must be an array.',
  );
  return rowsInput.map((input) => {
    const rowScope = scope(input);
    if (!rowScope.line || !rowScope.canonicalId || !rowScope.caseId) throw evidenceError(
      'VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCOPE_INVALID',
      'Facility mechanism evidence requires line, caseId and canonicalId.', rowScope,
    );
    if (input.scenarioSetKey !== runBasis.scenarioSetKey
        || (input.scenarioExecutionBasis && input.scenarioExecutionBasis.datasetId !== runBasis.datasetId)) {
      throw evidenceError(
        'VIBRATION_FACILITY_MECHANISM_EVIDENCE_BASE_RUN_MISMATCH',
        'Facility register row does not belong to the supplied run/scenario set.', rowScope,
      );
    }
    const scenario = scenarios.get(scopeKey(input.line, input.caseId));
    if (!scenario) throw evidenceError(
      'VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCENARIO_MISSING',
      'Facility register row has no current OperatingScenario in this run.', rowScope,
    );
    const currentBasis = scenarioBasis(scenario);
    if (input.scenarioExecutionBasis && !scenarioBasisMatches(input.scenarioExecutionBasis, currentBasis)) {
      throw evidenceError(
        'VIBRATION_FACILITY_MECHANISM_EVIDENCE_ROW_SCENARIO_MISMATCH',
        'Facility register row scenario basis is not current for this run.', rowScope,
      );
    }
    return input.scenarioExecutionBasis
      ? input
      : Object.freeze({ ...input, scenarioExecutionBasis: currentBasis });
  });
}

function excluded(mechanismId, row, reason, evidenceSchema = null) {
  return Object.freeze({
    mechanismId, scope: row ? scope(row) : null, status: 'STALE_OR_FOREIGN', reason,
    evidenceSchema, numericalValueRetained: false,
  });
}
function candidateRunCurrent(candidate, runBasis) {
  if (!candidate?.facilityRunBasis) return 'FACILITY_RUN_BASIS_MISSING';
  try {
    return vibrationFacilityRunBasisMatches(candidate.facilityRunBasis, runBasis)
      ? null : 'FACILITY_RUN_BASIS_MISMATCH';
  } catch { return 'FACILITY_RUN_BASIS_INVALID'; }
}

function mechanicalEvidence(rows, resultsByScope, runBasis, current, rejected) {
  const currentScopeIds = new Set();
  for (const row of rows) {
    const scopeId = mechanicalFacilityScopeId(row); currentScopeIds.add(scopeId);
    const candidate = resultsByScope?.[scopeId] ?? null; if (!candidate) continue;
    const runReason = candidateRunCurrent(candidate, runBasis);
    if (runReason) { rejected.push(excluded('mechanicalExcitation', row, runReason, candidate?.schema)); continue; }
    const inspected = inspectMechanicalFacilityCandidate(row, candidate);
    if (!inspected.ok) { rejected.push(excluded('mechanicalExcitation', row, inspected.status, candidate?.schema)); continue; }
    if (!scenarioBasisMatches(candidate.scenarioExecutionBasis, row.scenarioExecutionBasis)) {
      rejected.push(excluded('mechanicalExcitation', row, 'SCENARIO_BASIS_MISMATCH', candidate.schema)); continue;
    }
    current.push(Object.freeze({
      mechanismId: 'mechanicalExcitation', evidenceTier: 'SCREENING', scope: scope(row), facilityScopeId: scopeId,
      resultSchema: candidate.schema, resultStatus: candidate.status,
      value: Object.freeze({ governingLof: candidate.governingLof, governingSourceKey: candidate.governingSourceKey ?? null }),
      authority: jsonClone(candidate.authority ?? null), scenarioExecutionBasis: jsonClone(candidate.scenarioExecutionBasis),
      facilityRunBasis: jsonClone(assertVibrationFacilityRunBasis(candidate.facilityRunBasis)),
    }));
  }
  for (const [scopeId, candidate] of Object.entries(resultsByScope ?? {})) {
    if (!currentScopeIds.has(scopeId)) rejected.push(excluded('mechanicalExcitation', null, 'FACILITY_SCOPE_NOT_CURRENT', candidate?.schema));
  }
}

function sbcEvidence(rows, resultsByScope, runBasis, current, rejected) {
  const currentScopeIds = new Set();
  for (const row of rows) {
    const scopeId = sbcFacilityScopeId(row); currentScopeIds.add(scopeId);
    const candidate = resultsByScope?.[scopeId] ?? null; if (!candidate) continue;
    const runReason = candidateRunCurrent(candidate, runBasis);
    if (runReason) { rejected.push(excluded('smallBoreConnections', row, runReason, candidate?.schema)); continue; }
    const inspected = inspectSbcFacilityType3(row, { precomputedCandidate: candidate });
    if (!inspected.ok) { rejected.push(excluded('smallBoreConnections', row, inspected.status, candidate?.schema)); continue; }
    if (!scenarioBasisMatches(candidate.scenarioExecutionBasis, row.scenarioExecutionBasis)) {
      rejected.push(excluded('smallBoreConnections', row, 'SCENARIO_BASIS_MISMATCH', candidate?.schema)); continue;
    }
    current.push(Object.freeze({
      mechanismId: 'smallBoreConnections', evidenceTier: 'CANDIDATE', scope: scope(row), facilityScopeId: scopeId,
      resultSchema: candidate.schema ?? null, resultStatus: candidate.status ?? null, value: Object.freeze({ lof: candidate.lof }),
      authority: jsonClone(candidate.authority ?? inspected.authority ?? null),
      scenarioExecutionBasis: jsonClone(candidate.scenarioExecutionBasis),
      facilityRunBasis: jsonClone(assertVibrationFacilityRunBasis(candidate.facilityRunBasis)),
    }));
  }
  for (const [scopeId, candidate] of Object.entries(resultsByScope ?? {})) {
    if (!currentScopeIds.has(scopeId)) rejected.push(excluded('smallBoreConnections', null, 'FACILITY_SCOPE_NOT_CURRENT', candidate?.schema));
  }
}

function aivEvidence(rows, session, runBasis, current, rejected) {
  if (!session) return;
  const plan = session.scenarioExecutionPlan;
  if (session.executionContext !== 'FACILITY_LINKED' || !plan) {
    rejected.push(excluded('aiv', null, 'AIV_STANDALONE_NOT_FACILITY_EVIDENCE', session.schema)); return;
  }
  if (session.resultState !== 'CURRENT_RESULT') {
    rejected.push(excluded('aiv', null, 'AIV_RESULT_NOT_CURRENT', session.schema)); return;
  }
  if (plan.facilityRunId !== runBasis.runId) {
    rejected.push(excluded('aiv', null, 'AIV_FACILITY_RUN_STALE', session.schema)); return;
  }
  if (plan.scenarioSetKey !== runBasis.scenarioSetKey || plan.datasetId !== runBasis.datasetId) {
    rejected.push(excluded('aiv', null, 'AIV_FACILITY_SCENARIO_SET_STALE', session.schema)); return;
  }
  const byScope = new Map(rows.map((row) => [JSON.stringify([row.line, row.caseId, row.canonicalId]), row]));
  for (const result of session.screeningResult?.outputs?.assessmentResults ?? []) {
    const row = byScope.get(JSON.stringify([result.line, result.caseId, result.assessmentCanonicalId])) ?? null;
    if (!row) { rejected.push(excluded('aiv', null, 'AIV_FACILITY_ASSESSMENT_SCOPE_NOT_CURRENT', result.schema)); continue; }
    const admission = inspectAivFacilityScenarioPlanForAssessment(plan, row);
    if (!admission.ok) { rejected.push(excluded('aiv', row, admission.status, result.schema)); continue; }
    current.push(Object.freeze({
      mechanismId: 'aiv', evidenceTier: 'ASSESSMENT_SCREENING', scope: scope(row), facilityScopeId: null,
      resultSchema: result.schema ?? null, resultStatus: result.status ?? null, value: Object.freeze({ lof: result.lof }),
      authority: jsonClone(result.authority ?? null), scenarioExecutionBasis: jsonClone(row.scenarioExecutionBasis),
      facilityRunBasis: jsonClone(runBasis),
    }));
  }
}

function countByMechanism(items) {
  const counts = {}; for (const item of items) counts[item.mechanismId] = (counts[item.mechanismId] ?? 0) + 1; return counts;
}

export function buildVibrationFacilityMechanismEvidence({
  runId, datasetId, scenarioSetKey, registerRows = [], operatingScenarios = [],
  mechanicalResultsByScope = {}, sbcResultsByScope = {}, aivSession = null,
} = {}) {
  const run = createVibrationFacilityRunBasis({ runId, datasetId, scenarioSetKey });
  const scenarios = scenarioMap(operatingScenarios, run);
  const rows = runRows(registerRows, run, scenarios);
  const currentEvidence = []; const excludedEvidence = [];
  mechanicalEvidence(rows, mechanicalResultsByScope, run, currentEvidence, excludedEvidence);
  sbcEvidence(rows, sbcResultsByScope, run, currentEvidence, excludedEvidence);
  aivEvidence(rows, aivSession, run, currentEvidence, excludedEvidence);
  return deepFreeze({
    schema: VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCHEMA,
    authority: VIBRATION_FACILITY_MECHANISM_EVIDENCE_AUTHORITY,
    run, currentEvidence, excludedEvidence,
    summary: {
      currentCount: currentEvidence.length, excludedCount: excludedEvidence.length,
      currentByMechanism: countByMechanism(currentEvidence), excludedByMechanism: countByMechanism(excludedEvidence),
      completenessDetermined: false, governingResultDetermined: false,
    },
  });
}
