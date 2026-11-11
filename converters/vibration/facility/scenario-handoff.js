import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import {
  assertVibrationScenarioExecutionBasis,
  assertVibrationScenarioExecutionBinding,
  createVibrationScenarioExecutionBinding,
} from '../mechanisms/scenario-execution.js';

export const VIBRATION_FACILITY_SCENARIO_HANDOFF_SCHEMA = 'VibrationFacilityScenarioHandoff.v1';
export const VIBRATION_FACILITY_SCENARIO_HANDOFF_AUTHORITY = Object.freeze({
  purpose: 'FACILITY_SCENARIO_HANDOFF_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  executionAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
});

function handoffError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationFacilityScenarioHandoffError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw handoffError('VIBRATION_FACILITY_HANDOFF_TEXT_REQUIRED', `${field} is required.`, { field });
  return text;
}

function scopeKey(line, caseId) {
  return JSON.stringify([line, caseId]);
}

function normalizedScenarioSet(values, { requireNonEmpty = false } = {}) {
  if (!Array.isArray(values)) {
    throw handoffError('VIBRATION_FACILITY_HANDOFF_SCENARIOS_INVALID', 'Facility scenarios must be an array.');
  }
  if (requireNonEmpty && values.length === 0) {
    throw handoffError(
      'VIBRATION_FACILITY_HANDOFF_SCENARIOS_REQUIRED',
      'Facility scenario handoff requires at least one governed OperatingScenario.',
    );
  }
  const datasetIds = new Set();
  const seen = new Set();
  const scenarios = values.map((value) => {
    const scenario = assertVibrationOperatingScenario(value);
    const key = scopeKey(scenario.line, scenario.caseId);
    if (seen.has(key)) {
      throw handoffError(
        'VIBRATION_FACILITY_HANDOFF_SCENARIO_DUPLICATE',
        `Duplicate facility scenario for ${scenario.line}/${scenario.caseId}.`,
      );
    }
    seen.add(key);
    datasetIds.add(scenario.datasetId);
    return scenario;
  });
  if (datasetIds.size > 1) {
    throw handoffError(
      'VIBRATION_FACILITY_HANDOFF_DATASET_MIX_FORBIDDEN',
      'One facility scenario set cannot mix OperatingScenarios from different datasets.',
      { datasetIds: [...datasetIds].sort() },
    );
  }
  return { datasetId: datasetIds.size ? [...datasetIds][0] : null, scenarios };
}

function scenarioSetKeyFromNormalized(scenarios) {
  if (!scenarios.length) return null;
  const rows = scenarios.map((scenario) => [
    scenario.datasetId,
    scenario.line,
    scenario.caseId,
    scenario.scenarioId,
    scenario.identityHash,
    scenario.snapshotHash,
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return `VFSK1:${JSON.stringify(rows)}`;
}

export function vibrationFacilityScenarioSetKey(operatingScenarios = []) {
  const normalized = normalizedScenarioSet(operatingScenarios);
  return scenarioSetKeyFromNormalized(normalized.scenarios);
}

function normalizeEntries(values) {
  const normalized = normalizedScenarioSet(values, { requireNonEmpty: true });
  const entries = normalized.scenarios.map((scenario) => ({
    line: scenario.line,
    caseId: scenario.caseId,
    scenario,
    binding: createVibrationScenarioExecutionBinding(scenario),
  }));
  return {
    datasetId: normalized.datasetId,
    scenarioSetKey: scenarioSetKeyFromNormalized(normalized.scenarios),
    entries,
  };
}

export function createVibrationFacilityScenarioHandoff({ operatingScenarios, runId } = {}) {
  const normalized = normalizeEntries(operatingScenarios);
  return deepFreeze({
    schema: VIBRATION_FACILITY_SCENARIO_HANDOFF_SCHEMA,
    datasetId: normalized.datasetId,
    facilityRunId: requiredText(runId, 'runId'),
    scenarioSetKey: normalized.scenarioSetKey,
    entries: normalized.entries,
    cardinality: normalized.entries.length,
    authority: VIBRATION_FACILITY_SCENARIO_HANDOFF_AUTHORITY,
  });
}

export function assertVibrationFacilityScenarioHandoff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== VIBRATION_FACILITY_SCENARIO_HANDOFF_SCHEMA) {
    throw handoffError(
      'VIBRATION_FACILITY_HANDOFF_SCHEMA_INVALID',
      `Expected ${VIBRATION_FACILITY_SCENARIO_HANDOFF_SCHEMA}.`,
    );
  }
  const datasetId = requiredText(value.datasetId, 'datasetId');
  requiredText(value.facilityRunId, 'facilityRunId');
  requiredText(value.scenarioSetKey, 'scenarioSetKey');
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    throw handoffError('VIBRATION_FACILITY_HANDOFF_ENTRIES_INVALID', 'Facility scenario handoff entries are required.');
  }
  const seen = new Set();
  const scenarios = [];
  for (const entry of value.entries) {
    const scenario = assertVibrationOperatingScenario(entry?.scenario);
    const binding = assertVibrationScenarioExecutionBinding(entry?.binding);
    if (scenario.datasetId !== datasetId || binding.datasetId !== datasetId) {
      throw handoffError('VIBRATION_FACILITY_HANDOFF_DATASET_MISMATCH', 'Facility scenario entry dataset does not match handoff dataset.');
    }
    if (entry.line !== scenario.line || entry.caseId !== scenario.caseId) {
      throw handoffError('VIBRATION_FACILITY_HANDOFF_SCOPE_MISMATCH', 'Facility scenario entry scope does not match its OperatingScenario.');
    }
    const key = scopeKey(entry.line, entry.caseId);
    if (seen.has(key)) throw handoffError('VIBRATION_FACILITY_HANDOFF_SCENARIO_DUPLICATE', `Duplicate facility scenario for ${entry.line}/${entry.caseId}.`);
    seen.add(key);
    scenarios.push(scenario);
    assertVibrationScenarioExecutionBasis(binding, scenario);
  }
  if (value.scenarioSetKey !== scenarioSetKeyFromNormalized(scenarios)) {
    throw handoffError('VIBRATION_FACILITY_HANDOFF_SCENARIO_SET_KEY_INVALID', 'Facility scenario-set key does not match its OperatingScenario snapshots.');
  }
  if (Number(value.cardinality) !== value.entries.length) {
    throw handoffError('VIBRATION_FACILITY_HANDOFF_CARDINALITY_INVALID', 'Facility scenario handoff cardinality does not match entries.');
  }
  for (const [key, expected] of Object.entries(VIBRATION_FACILITY_SCENARIO_HANDOFF_AUTHORITY)) {
    if (value.authority?.[key] !== expected) {
      throw handoffError('VIBRATION_FACILITY_HANDOFF_AUTHORITY_INVALID', `Facility scenario handoff authority mismatch at ${key}.`);
    }
  }
  return value;
}

export function resolveVibrationFacilityScenario(handoffInput, { line, caseId } = {}) {
  const handoff = assertVibrationFacilityScenarioHandoff(handoffInput);
  const normalizedLine = requiredText(line, 'line');
  const normalizedCase = requiredText(caseId, 'caseId');
  return handoff.entries.find((entry) => (
    entry.line === normalizedLine && entry.caseId === normalizedCase
  )) ?? null;
}
