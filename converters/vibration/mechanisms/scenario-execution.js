import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';

export const VIBRATION_SCENARIO_EXECUTION_BINDING_SCHEMA = 'VibrationScenarioExecutionBinding.v1';
export const VIBRATION_SCENARIO_EXECUTION_BASIS_SCHEMA = 'VibrationScenarioExecutionBasis.v1';

export const VIBRATION_SCENARIO_EXECUTION_AUTHORITY = Object.freeze({
  purpose: 'RUNTIME_SCENARIO_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  executionAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  crossScenarioMixingAllowed: false,
  scenarioSubstitutionAllowed: false,
});

function guardError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationScenarioExecutionError';
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
  if (typeof value !== 'string' || !value.trim()) {
    throw guardError('VIBRATION_SCENARIO_EXECUTION_TEXT_REQUIRED', `${field} is required.`, { field });
  }
  return value.trim();
}

function bindingFromScenario(scenario) {
  return {
    schema: VIBRATION_SCENARIO_EXECUTION_BINDING_SCHEMA,
    scenarioId: scenario.scenarioId,
    scenarioIdentityHash: scenario.identityHash,
    scenarioSnapshotHash: scenario.snapshotHash,
    datasetId: scenario.datasetId,
    line: scenario.line,
    caseId: scenario.caseId,
    provenanceStatus: scenario.provenance?.status ?? 'INCOMPLETE',
    authority: VIBRATION_SCENARIO_EXECUTION_AUTHORITY,
  };
}

export function createVibrationScenarioExecutionBinding(operatingScenarioInput) {
  const scenario = assertVibrationOperatingScenario(operatingScenarioInput);
  return deepFreeze(bindingFromScenario(scenario));
}

export function assertVibrationScenarioExecutionBinding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== VIBRATION_SCENARIO_EXECUTION_BINDING_SCHEMA) {
    throw guardError(
      'VIBRATION_SCENARIO_EXECUTION_BINDING_SCHEMA_INVALID',
      `Expected ${VIBRATION_SCENARIO_EXECUTION_BINDING_SCHEMA}.`,
    );
  }
  for (const field of [
    'scenarioId', 'scenarioIdentityHash', 'scenarioSnapshotHash', 'datasetId', 'line', 'caseId',
  ]) requiredText(value[field], field);
  const authority = value.authority ?? {};
  for (const [key, expected] of Object.entries(VIBRATION_SCENARIO_EXECUTION_AUTHORITY)) {
    if (authority[key] !== expected) {
      throw guardError(
        'VIBRATION_SCENARIO_EXECUTION_BINDING_AUTHORITY_INVALID',
        `Scenario execution binding authority mismatch at ${key}.`,
      );
    }
  }
  return value;
}

export function assertVibrationScenarioExecutionBasis(bindingInput, operatingScenarioInput) {
  const binding = assertVibrationScenarioExecutionBinding(bindingInput);
  const scenario = assertVibrationOperatingScenario(operatingScenarioInput);
  if (binding.datasetId !== scenario.datasetId
      || binding.line !== scenario.line
      || binding.caseId !== scenario.caseId
      || binding.scenarioId !== scenario.scenarioId
      || binding.scenarioIdentityHash !== scenario.identityHash) {
    throw guardError(
      'VIBRATION_SCENARIO_EXECUTION_IDENTITY_MISMATCH',
      'Current OperatingScenario identity does not match the prepared execution binding.',
      {
        expectedScenarioId: binding.scenarioId,
        actualScenarioId: scenario.scenarioId,
      },
    );
  }
  if (binding.scenarioSnapshotHash !== scenario.snapshotHash) {
    throw guardError(
      'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH',
      'Current OperatingScenario snapshot does not match the prepared execution binding.',
      {
        expected: binding.scenarioSnapshotHash,
        actual: scenario.snapshotHash,
      },
    );
  }
  return deepFreeze({
    schema: VIBRATION_SCENARIO_EXECUTION_BASIS_SCHEMA,
    scenarioId: scenario.scenarioId,
    scenarioSnapshotHash: scenario.snapshotHash,
    datasetId: scenario.datasetId,
    line: scenario.line,
    caseId: scenario.caseId,
    authority: VIBRATION_SCENARIO_EXECUTION_AUTHORITY,
  });
}

export function executeVibrationWithScenarioGuard({
  scenarioBinding,
  operatingScenario,
  execute,
} = {}) {
  if (typeof execute !== 'function') {
    throw guardError('VIBRATION_SCENARIO_EXECUTOR_REQUIRED', 'execute must be a function.');
  }
  const executionBasis = assertVibrationScenarioExecutionBasis(scenarioBinding, operatingScenario);
  return execute({ operatingScenario, scenarioBinding, executionBasis });
}
