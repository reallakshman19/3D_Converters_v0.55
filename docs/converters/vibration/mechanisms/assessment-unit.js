import { createHash } from 'node:crypto';
import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import {
  VIBRATION_ASSESSMENT_UNIT_TYPES,
  VIBRATION_REQUIRED_ASSESSMENT_SET_SCHEMA,
  VIBRATION_REQUIRED_QUALIFICATIONS,
} from './coverage.js';
import {
  assertVibrationScenarioExecutionBasis,
  assertVibrationScenarioExecutionBinding,
  createVibrationScenarioExecutionBinding,
} from './scenario-execution.js';

export const VIBRATION_ASSESSMENT_UNIT_SCHEMA = 'VibrationAssessmentUnit.v1';
export const VIBRATION_ASSESSMENT_UNIT_SET_SCHEMA = 'VibrationAssessmentUnitSet.v1';
export const VIBRATION_ASSESSMENT_EXECUTION_BASIS_SCHEMA = 'VibrationAssessmentExecutionBasis.v1';
export const VIBRATION_ASSESSMENT_UNIT_AUTHORITY = Object.freeze({
  purpose: 'ASSESSMENT_UNIT_SCENARIO_CUSTODY_ONLY',
  engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
  numericalAuthority: 'NONE', executionAuthority: 'NONE',
  determinesApplicability: false, determinesCompleteness: false,
  crossScenarioMixingAllowed: false, scenarioSubstitutionAllowed: false,
});

function unitError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationAssessmentUnitError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_TEXT_REQUIRED', `${field} is required.`, { field });
  }
  return value.trim();
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

function normalizeScope(scope = {}) {
  return {
    line: requireText(scope.line, 'requirement.scope.line'),
    caseId: requireText(scope.caseId, 'requirement.scope.caseId'),
    canonicalId: requireText(scope.canonicalId, 'requirement.scope.canonicalId'),
  };
}

function normalizeRequirement(requirement = {}) {
  const assessmentUnitType = requireText(requirement.assessmentUnitType, 'requirement.assessmentUnitType');
  if (!VIBRATION_ASSESSMENT_UNIT_TYPES.includes(assessmentUnitType)) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_TYPE_INVALID', `Unsupported assessment unit type ${assessmentUnitType}.`, { assessmentUnitType });
  }
  const requiredQualification = requireText(requirement.requiredQualification, 'requirement.requiredQualification');
  if (!VIBRATION_REQUIRED_QUALIFICATIONS.includes(requiredQualification)) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_QUALIFICATION_INVALID', `Unsupported required qualification ${requiredQualification}.`, { requiredQualification });
  }
  return {
    assessmentId: requireText(requirement.assessmentId, 'requirement.assessmentId'),
    identificationId: requireText(requirement.identificationId, 'requirement.identificationId'),
    mechanismId: requireText(requirement.mechanismId, 'requirement.mechanismId'),
    scope: normalizeScope(requirement.scope), assessmentUnitType, requiredQualification,
  };
}

function assertRequirementScenarioScope(requirement, binding) {
  if (requirement.scope.line !== binding.line || requirement.scope.caseId !== binding.caseId) {
    throw unitError(
      'VIBRATION_ASSESSMENT_UNIT_SCENARIO_SCOPE_MISMATCH',
      'Assessment requirement line/case does not match the operating scenario.',
      {
        requirementLine: requirement.scope.line, requirementCaseId: requirement.scope.caseId,
        scenarioLine: binding.line, scenarioCaseId: binding.caseId,
      },
    );
  }
}

function logicalIdentity(requirement, binding) {
  return sha256({
    assessmentId: requirement.assessmentId,
    mechanismId: requirement.mechanismId,
    assessmentUnitType: requirement.assessmentUnitType,
    scenarioId: binding.scenarioId,
  });
}

function unitSnapshotCore(unit) {
  return {
    assessmentUnitId: unit.assessmentUnitId,
    assessmentId: unit.assessmentId,
    identificationId: unit.identificationId,
    mechanismId: unit.mechanismId,
    assessmentUnitType: unit.assessmentUnitType,
    requiredQualification: unit.requiredQualification,
    scope: unit.scope,
    operatingScenario: unit.operatingScenario,
  };
}

function buildUnit(requirement, binding) {
  const identityHash = logicalIdentity(requirement, binding);
  const unit = {
    schema: VIBRATION_ASSESSMENT_UNIT_SCHEMA,
    assessmentUnitId: `VAU-${identityHash.slice('sha256:'.length, 'sha256:'.length + 24)}`,
    identityHash,
    assessmentId: requirement.assessmentId, identificationId: requirement.identificationId,
    mechanismId: requirement.mechanismId, assessmentUnitType: requirement.assessmentUnitType,
    requiredQualification: requirement.requiredQualification,
    scope: requirement.scope, operatingScenario: binding, authority: VIBRATION_ASSESSMENT_UNIT_AUTHORITY,
  };
  unit.unitSnapshotHash = sha256(unitSnapshotCore(unit));
  return deepFreeze(unit);
}

export function createVibrationAssessmentUnit({ requirement, operatingScenario } = {}) {
  const normalizedRequirement = normalizeRequirement(requirement);
  const binding = createVibrationScenarioExecutionBinding(operatingScenario);
  assertRequirementScenarioScope(normalizedRequirement, binding);
  return buildUnit(normalizedRequirement, binding);
}

function scenarioMap(values = []) {
  if (!Array.isArray(values)) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_SCENARIOS_INVALID', 'operatingScenarios must be an array.');
  }
  const byScope = new Map();
  const datasetIds = new Set();
  for (const value of values) {
    const scenario = assertVibrationOperatingScenario(value);
    datasetIds.add(scenario.datasetId);
    const key = JSON.stringify([scenario.line, scenario.caseId]);
    if (byScope.has(key)) {
      throw unitError('VIBRATION_ASSESSMENT_UNIT_SCENARIO_DUPLICATE', `Duplicate operating scenario for ${scenario.line}/${scenario.caseId}.`);
    }
    byScope.set(key, scenario);
  }
  if (datasetIds.size > 1) {
    throw unitError(
      'VIBRATION_ASSESSMENT_UNIT_DATASET_MIX_FORBIDDEN',
      'One assessment-unit set cannot mix operating scenarios from different datasets.',
      { datasetIds: [...datasetIds].sort() },
    );
  }
  return byScope;
}

export function createVibrationAssessmentUnitSet({ requiredAssessmentSet, operatingScenarios } = {}) {
  if (requiredAssessmentSet?.schema !== VIBRATION_REQUIRED_ASSESSMENT_SET_SCHEMA) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_REQUIRED_SET_INVALID', `requiredAssessmentSet must use ${VIBRATION_REQUIRED_ASSESSMENT_SET_SCHEMA}.`);
  }
  const scenarios = scenarioMap(operatingScenarios);
  const units = (requiredAssessmentSet.required ?? []).map((requirement) => {
    const normalized = normalizeRequirement(requirement);
    const key = JSON.stringify([normalized.scope.line, normalized.scope.caseId]);
    const scenario = scenarios.get(key);
    if (!scenario) {
      throw unitError(
        'VIBRATION_ASSESSMENT_UNIT_SCENARIO_MISSING',
        `No operating scenario is available for ${normalized.scope.line}/${normalized.scope.caseId}.`,
        { assessmentId: normalized.assessmentId },
      );
    }
    return createVibrationAssessmentUnit({ requirement: normalized, operatingScenario: scenario });
  });
  const setCore = {
    requiredAssessmentSetId: requireText(requiredAssessmentSet.setId, 'requiredAssessmentSet.setId'),
    units: units.map((unit) => [unit.assessmentUnitId, unit.unitSnapshotHash]),
  };
  return deepFreeze({
    schema: VIBRATION_ASSESSMENT_UNIT_SET_SCHEMA,
    setId: sha256(setCore), requiredAssessmentSetId: setCore.requiredAssessmentSetId,
    units, cardinality: units.length, authority: VIBRATION_ASSESSMENT_UNIT_AUTHORITY,
  });
}

export function assertVibrationAssessmentUnit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== VIBRATION_ASSESSMENT_UNIT_SCHEMA) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_SCHEMA_INVALID', `Expected ${VIBRATION_ASSESSMENT_UNIT_SCHEMA}.`);
  }
  const requirement = normalizeRequirement(value);
  const binding = assertVibrationScenarioExecutionBinding(value.operatingScenario);
  assertRequirementScenarioScope(requirement, binding);
  const expectedIdentity = logicalIdentity(requirement, binding);
  const expectedId = `VAU-${expectedIdentity.slice('sha256:'.length, 'sha256:'.length + 24)}`;
  if (value.identityHash !== expectedIdentity || value.assessmentUnitId !== expectedId) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_IDENTITY_INVALID', 'Assessment-unit identity does not match its requirement/scenario binding.');
  }
  const authority = value.authority ?? {};
  if (authority.purpose !== VIBRATION_ASSESSMENT_UNIT_AUTHORITY.purpose
      || authority.engineeringAuthority !== 'NONE' || authority.screeningAuthority !== 'NOT_AUTHORIZED'
      || authority.designAuthority !== false || authority.numericalAuthority !== 'NONE'
      || authority.executionAuthority !== 'NONE' || authority.crossScenarioMixingAllowed !== false
      || authority.scenarioSubstitutionAllowed !== false) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_AUTHORITY_INVALID', 'Assessment-unit authority boundary is invalid.');
  }
  if (value.unitSnapshotHash !== sha256(unitSnapshotCore(value))) {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_SNAPSHOT_HASH_INVALID', 'Assessment-unit snapshot hash does not match its content.');
  }
  return value;
}

function assessmentExecutionError(error) {
  if (error?.code === 'VIBRATION_SCENARIO_EXECUTION_IDENTITY_MISMATCH') {
    return unitError('VIBRATION_ASSESSMENT_UNIT_SCENARIO_IDENTITY_MISMATCH', error.message, error.details);
  }
  if (error?.code === 'VIBRATION_SCENARIO_EXECUTION_SNAPSHOT_MISMATCH') {
    return unitError('VIBRATION_ASSESSMENT_UNIT_SCENARIO_SNAPSHOT_MISMATCH', error.message, error.details);
  }
  return error;
}

export function assertVibrationAssessmentUnitExecutionBasis(assessmentUnitInput, operatingScenarioInput) {
  const unit = assertVibrationAssessmentUnit(assessmentUnitInput);
  let scenarioBasis;
  try {
    scenarioBasis = assertVibrationScenarioExecutionBasis(unit.operatingScenario, operatingScenarioInput);
  } catch (error) {
    throw assessmentExecutionError(error);
  }
  return deepFreeze({
    schema: VIBRATION_ASSESSMENT_EXECUTION_BASIS_SCHEMA,
    assessmentUnitId: unit.assessmentUnitId,
    assessmentUnitSnapshotHash: unit.unitSnapshotHash,
    scenarioId: scenarioBasis.scenarioId,
    scenarioSnapshotHash: scenarioBasis.scenarioSnapshotHash,
    authority: {
      purpose: 'PRE_EXECUTION_SCENARIO_BINDING_CHECK_ONLY',
      engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
      numericalAuthority: 'NONE', executionAuthority: 'NONE',
    },
  });
}

export function executeVibrationAssessmentUnitWithScenarioGuard({
  assessmentUnit, operatingScenario, execute,
} = {}) {
  if (typeof execute !== 'function') {
    throw unitError('VIBRATION_ASSESSMENT_UNIT_EXECUTOR_REQUIRED', 'execute must be a function.');
  }
  const executionBasis = assertVibrationAssessmentUnitExecutionBasis(assessmentUnit, operatingScenario);
  return execute({ assessmentUnit, operatingScenario, executionBasis });
}
