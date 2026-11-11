import {
  ENGINEERING_CALCULATION_BATCH_VERSION,
  calculateEngineeringBatch,
} from '../../engineering-calculations/index.js';
import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import { assertVibrationScenarioExecutionBasis } from '../mechanisms/scenario-execution.js';
import {
  VIBRATION_FACILITY_FIT_CALCULATION_ID,
  VIBRATION_FACILITY_FIT_PLAN_SCHEMA,
} from './fit-plan.js';
import { normalizeFitFacilityQualificationMode } from './fit-plan-contract.js';
import { vibrationFacilityScenarioSetKey } from './scenario-handoff.js';

export const VIBRATION_FACILITY_FIT_RESULT_SCHEMA = 'VibrationFacilityFitResult.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function executionError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationFacilityFitExecutionError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function assertPlan(plan) {
  if (plan?.schema !== VIBRATION_FACILITY_FIT_PLAN_SCHEMA) {
    throw executionError(
      'FIT_FACILITY_PLAN_SCHEMA_MISMATCH',
      `Facility FIT execution requires ${VIBRATION_FACILITY_FIT_PLAN_SCHEMA}.`,
      { actual: plan?.schema ?? null },
    );
  }
  const qualificationMode = normalizeFitFacilityQualificationMode(plan.qualificationMode);
  if (plan.calculationId !== VIBRATION_FACILITY_FIT_CALCULATION_ID) {
    throw executionError(
      'FIT_FACILITY_PLAN_AUTHORITY_VIOLATION',
      'Facility FIT execution accepts only the stable FIT calculation ID.',
      { calculationId: plan.calculationId, qualificationMode },
    );
  }
  if (!Array.isArray(plan.items)) {
    throw executionError('FIT_FACILITY_PLAN_INVALID', 'Facility FIT plan items must be an array.');
  }
  for (const [index, item] of plan.items.entries()) {
    if (item.status === 'READY') {
      if (!item.request || item.request.calculationId !== VIBRATION_FACILITY_FIT_CALCULATION_ID
          || item.request.options?.qualificationMode !== qualificationMode || !item.scenarioBinding) {
        throw executionError(
          'FIT_FACILITY_PLAN_AUTHORITY_VIOLATION',
          'READY FIT plan items require an unchanged request and exact scenario binding.',
          { index, canonicalId: item.canonicalId, line: item.line, qualificationMode },
        );
      }
    } else if (item.request !== null && item.request !== undefined) {
      throw executionError(
        'FIT_FACILITY_PLAN_INVALID',
        'Non-READY FIT plan items must not contain an executable request.',
        { index, status: item.status, canonicalId: item.canonicalId },
      );
    }
  }
  return plan;
}

function scenarioMap(values = []) {
  if (!Array.isArray(values)) {
    throw executionError('FIT_FACILITY_SCENARIOS_INVALID', 'operatingScenarios must be an array.');
  }
  const scenarios = new Map();
  for (const value of values) {
    const scenario = assertVibrationOperatingScenario(value);
    const key = JSON.stringify([scenario.line, scenario.caseId]);
    if (scenarios.has(key)) {
      throw executionError(
        'FIT_FACILITY_SCENARIO_DUPLICATE',
        `Duplicate OperatingScenario for ${scenario.line}/${scenario.caseId}.`,
      );
    }
    scenarios.set(key, scenario);
  }
  return scenarios;
}

export function assertVibrationFacilityFitScenarioBindings(planInput, operatingScenarios) {
  const plan = assertPlan(planInput);
  const scenarios = scenarioMap(operatingScenarios);
  const bases = new Map();
  for (const item of plan.items.filter((candidate) => candidate.status === 'READY')) {
    const scenario = scenarios.get(JSON.stringify([item.line, item.caseId]));
    if (!scenario) {
      throw executionError(
        'FIT_FACILITY_SCENARIO_MISSING',
        `READY FIT item ${item.canonicalId} has no current OperatingScenario.`,
        { line: item.line, caseId: item.caseId, canonicalId: item.canonicalId },
      );
    }
    try {
      bases.set(item, assertVibrationScenarioExecutionBasis(item.scenarioBinding, scenario));
    } catch (error) {
      throw executionError(
        error?.code === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH'
          ? 'FIT_FACILITY_SCENARIO_SNAPSHOT_MISMATCH'
          : 'FIT_FACILITY_SCENARIO_IDENTITY_MISMATCH',
        `FIT scenario custody failed for ${item.canonicalId}: ${String(error?.message || error)}`,
        { line: item.line, caseId: item.caseId, canonicalId: item.canonicalId, upstreamCode: error?.code ?? null },
      );
    }
  }
  return bases;
}

function notAssessedRow(item) {
  return {
    status: 'NOT_ASSESSED_DATA_INCOMPLETE',
    calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
    canonicalId: item.canonicalId,
    line: item.line,
    caseId: item.caseId,
    missing: Object.freeze([...(item.missing ?? [])]),
    invalid: Object.freeze([...(item.invalid ?? [])]),
    reasons: Object.freeze([...(item.reasons ?? [])]),
    sourceTrace: item.sourceTrace ?? null,
    centralResult: null,
  };
}

function failedRow(item, centralResult, scenarioExecutionBasis) {
  return {
    status: 'CALCULATION_FAILED',
    calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
    canonicalId: item.canonicalId,
    line: item.line,
    caseId: item.caseId,
    errors: centralResult?.errors ?? Object.freeze([]),
    scenarioExecutionBasis,
    sourceTrace: item.sourceTrace ?? null,
    centralResult,
  };
}

function calculatedRow(item, centralResult, qualificationMode, scenarioExecutionBasis) {
  return {
    status: qualificationMode === 'screening' ? 'CALCULATED_SCREENING' : 'CALCULATED_BENCHMARK',
    calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
    canonicalId: item.canonicalId,
    line: item.line,
    caseId: item.caseId,
    standardLof: centralResult.outputs.standardLof,
    refinedLof: centralResult.outputs.refinedLof,
    governingReferenceLof: centralResult.outputs.governingReferenceLof,
    referenceBand: centralResult.outputs.referenceBand,
    assessmentStatus: centralResult.assessment?.status ?? null,
    qualification: centralResult.qualification,
    qualificationCoverage: centralResult.evidence?.qualificationCoverage ?? null,
    screeningCandidate: centralResult.evidence?.screeningCandidate ?? null,
    scenarioExecutionBasis,
    sourceTrace: item.sourceTrace ?? null,
    centralResult,
  };
}

export function executeVibrationFacilityFitPlan(planInput = {}, options = {}) {
  const plan = assertPlan(planInput);
  const qualificationMode = normalizeFitFacilityQualificationMode(plan.qualificationMode);
  const readyItems = plan.items.filter((item) => item.status === 'READY');
  const scenarioSetKey = vibrationFacilityScenarioSetKey(options.operatingScenarios ?? []);
  const scenarioBases = readyItems.length
    ? assertVibrationFacilityFitScenarioBindings(plan, options.operatingScenarios)
    : new Map();
  const batch = readyItems.length
    ? calculateEngineeringBatch({
      contractVersion: ENGINEERING_CALCULATION_BATCH_VERSION,
      requests: readyItems.map((item) => item.request),
    })
    : Object.freeze({ ok: true, total: 0, succeeded: 0, failed: 0, results: Object.freeze([]) });

  if (!Array.isArray(batch.results) || batch.results.length !== readyItems.length) {
    throw executionError(
      'FIT_FACILITY_BATCH_RESULT_COUNT_MISMATCH',
      'Central batch result count does not match the number of READY facility FIT requests.',
      { expected: readyItems.length, actual: Array.isArray(batch.results) ? batch.results.length : null },
    );
  }

  const resultByPlanItem = new Map();
  readyItems.forEach((item, index) => resultByPlanItem.set(item, batch.results[index]));
  const rows = plan.items.map((item) => {
    if (item.status !== 'READY') return notAssessedRow(item);
    const centralResult = resultByPlanItem.get(item);
    const basis = scenarioBases.get(item);
    return centralResult?.ok
      ? calculatedRow(item, centralResult, qualificationMode, basis)
      : failedRow(item, centralResult, basis);
  });

  const calculated = rows.filter((row) => (
    row.status === 'CALCULATED_BENCHMARK' || row.status === 'CALCULATED_SCREENING'
  )).length;
  const calculationFailed = rows.filter((row) => row.status === 'CALCULATION_FAILED').length;
  const notAssessed = rows.filter((row) => row.status === 'NOT_ASSESSED_DATA_INCOMPLETE').length;
  const screening = qualificationMode === 'screening';

  return deepFreeze({
    schema: VIBRATION_FACILITY_FIT_RESULT_SCHEMA,
    authority: 'ORCHESTRATION_ONLY',
    engineeringAuthority: screening ? 'SCREENING' : 'NONE',
    screeningAuthorized: screening,
    calculationId: VIBRATION_FACILITY_FIT_CALCULATION_ID,
    qualificationMode,
    planSchema: plan.schema,
    datasetSchema: plan.datasetSchema ?? null,
    datasetId: plan.datasetId ?? null,
    scenarioSetKey,
    rows,
    counts: {
      total: rows.length, plannedReady: readyItems.length, calculated, calculationFailed, notAssessed,
    },
    complete: calculationFailed === 0 && notAssessed === 0,
    centralBatchSummary: {
      ok: batch.ok, total: batch.total, succeeded: batch.succeeded, failed: batch.failed,
    },
    warnings: Object.freeze([
      ...(notAssessed ? [{
        code: 'FACILITY_ROWS_NOT_ASSESSED',
        message: 'One or more FIT facility rows were not assessed because required input data were incomplete.',
        details: { count: notAssessed },
      }] : []),
      ...(calculationFailed ? [{
        code: 'FACILITY_CALCULATION_FAILURES',
        message: 'One or more READY FIT requests failed in the central Engineering Calculation API.',
        details: { count: calculationFailed },
      }] : []),
    ]),
  });
}
