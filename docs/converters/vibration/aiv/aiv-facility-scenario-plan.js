import {
  assertVibrationFacilityScenarioHandoff,
  resolveVibrationFacilityScenario,
} from '../facility/scenario-handoff.js';
import { assertVibrationScenarioExecutionBasis } from '../mechanisms/scenario-execution.js';

export const AIV_FACILITY_SCENARIO_EXECUTION_PLAN_SCHEMA = 'AivFacilityScenarioExecutionPlan.v1';
export const AIV_FACILITY_SCENARIO_EXECUTION_AUTHORITY = Object.freeze({
  purpose: 'AIV_FACILITY_SCENARIO_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  executionAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
});

function planError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'AivFacilityScenarioExecutionPlanError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, field, code = 'AIV_FACILITY_SCENARIO_TEXT_REQUIRED') {
  const text = String(value ?? '').trim();
  if (!text) throw planError(code, `${field} is required for linked AIV scenario custody.`, { field });
  return text;
}

function assertReadinessEnvelope(envelope) {
  if (envelope?.schema !== 'AivReadinessTableEnvelope.v2'
      || !Array.isArray(envelope.readiness?.rows)) {
    throw planError(
      'AIV_FACILITY_SCENARIO_READINESS_REQUIRED',
      'Linked AIV execution requires the exact current AivReadinessTableEnvelope.v2.',
    );
  }
  return envelope;
}

function readyRelationships(envelope) {
  return envelope.readiness.rows.filter((row) => row.status === 'READY_FOR_QUALIFICATION');
}

function scenarioEntry(handoff, row, role) {
  const lineField = role === 'SOURCE' ? 'sourceLine' : 'assessmentLine';
  const line = requiredText(row[lineField], lineField, `AIV_FACILITY_${role}_LINE_REQUIRED`);
  const caseId = requiredText(row.caseId, 'caseId', 'AIV_FACILITY_CASE_ID_REQUIRED');
  const entry = resolveVibrationFacilityScenario(handoff, { line, caseId });
  if (!entry) {
    throw planError(
      `AIV_FACILITY_${role}_SCENARIO_MISSING`,
      `No current governed OperatingScenario exists for AIV ${role.toLowerCase()} ${line}/${caseId}.`,
      {
        rowKey: row.rowKey ?? null,
        sourceCanonicalId: row.sourceCanonicalId ?? null,
        assessmentCanonicalId: row.assessmentCanonicalId ?? null,
        line,
        caseId,
      },
    );
  }
  return entry;
}

function relationshipExecution(handoff, row) {
  const source = scenarioEntry(handoff, row, 'SOURCE');
  const assessment = scenarioEntry(handoff, row, 'ASSESSMENT');
  if (source.scenario.datasetId !== assessment.scenario.datasetId
      || source.scenario.datasetId !== handoff.datasetId) {
    throw planError(
      'AIV_FACILITY_RELATIONSHIP_DATASET_MISMATCH',
      'AIV source and assessment scenarios must belong to the same governed facility dataset.',
      { rowKey: row.rowKey ?? null },
    );
  }
  return {
    rowKey: requiredText(row.rowKey, 'rowKey', 'AIV_FACILITY_ROW_KEY_REQUIRED'),
    sourceCanonicalId: requiredText(row.sourceCanonicalId, 'sourceCanonicalId'),
    assessmentCanonicalId: requiredText(row.assessmentCanonicalId, 'assessmentCanonicalId'),
    caseId: requiredText(row.caseId, 'caseId'),
    sourceLine: source.line,
    assessmentLine: assessment.line,
    sourceScenarioExecutionBasis: assertVibrationScenarioExecutionBasis(source.binding, source.scenario),
    assessmentScenarioExecutionBasis: assertVibrationScenarioExecutionBasis(assessment.binding, assessment.scenario),
  };
}

export function buildAivFacilityScenarioExecutionPlan({ handoff: handoffInput, readinessEnvelope } = {}) {
  const handoff = assertVibrationFacilityScenarioHandoff(handoffInput);
  const envelope = assertReadinessEnvelope(readinessEnvelope);
  const ready = readyRelationships(envelope);
  if (!ready.length) {
    throw planError(
      'AIV_FACILITY_SCENARIO_NO_EXECUTABLE_RELATIONSHIPS',
      'Linked AIV execution requires at least one READY_FOR_QUALIFICATION relationship.',
    );
  }
  const relationships = ready.map((row) => relationshipExecution(handoff, row));
  return deepFreeze({
    schema: AIV_FACILITY_SCENARIO_EXECUTION_PLAN_SCHEMA,
    datasetId: handoff.datasetId,
    facilityRunId: handoff.facilityRunId,
    facilityScenarioSetKey: handoff.scenarioSetKey,
    relationshipExecutions: relationships,
    cardinality: relationships.length,
    authority: AIV_FACILITY_SCENARIO_EXECUTION_AUTHORITY,
  });
}

export function assertAivFacilityScenarioExecutionPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== AIV_FACILITY_SCENARIO_EXECUTION_PLAN_SCHEMA) {
    throw planError(
      'AIV_FACILITY_SCENARIO_PLAN_SCHEMA_INVALID',
      `Expected ${AIV_FACILITY_SCENARIO_EXECUTION_PLAN_SCHEMA}.`,
    );
  }
  requiredText(value.datasetId, 'datasetId');
  requiredText(value.facilityRunId, 'facilityRunId');
  requiredText(value.facilityScenarioSetKey, 'facilityScenarioSetKey');
  if (!Array.isArray(value.relationshipExecutions) || !value.relationshipExecutions.length) {
    throw planError('AIV_FACILITY_SCENARIO_PLAN_RELATIONSHIPS_INVALID', 'Linked AIV scenario plan relationships are required.');
  }
  if (Number(value.cardinality) !== value.relationshipExecutions.length) {
    throw planError('AIV_FACILITY_SCENARIO_PLAN_CARDINALITY_INVALID', 'Linked AIV scenario plan cardinality is invalid.');
  }
  for (const item of value.relationshipExecutions) {
    requiredText(item.rowKey, 'rowKey');
    requiredText(item.sourceCanonicalId, 'sourceCanonicalId');
    requiredText(item.assessmentCanonicalId, 'assessmentCanonicalId');
    requiredText(item.caseId, 'caseId');
    const sourceBasis = item.sourceScenarioExecutionBasis;
    const assessmentBasis = item.assessmentScenarioExecutionBasis;
    if (sourceBasis?.datasetId !== value.datasetId || assessmentBasis?.datasetId !== value.datasetId) {
      throw planError('AIV_FACILITY_SCENARIO_PLAN_DATASET_MISMATCH', 'Linked AIV scenario plan contains a foreign dataset basis.');
    }
    if (sourceBasis?.line !== item.sourceLine || sourceBasis?.caseId !== item.caseId
        || assessmentBasis?.line !== item.assessmentLine || assessmentBasis?.caseId !== item.caseId) {
      throw planError('AIV_FACILITY_SCENARIO_PLAN_SCOPE_MISMATCH', 'Linked AIV scenario execution basis does not match relationship scope.');
    }
  }
  for (const [key, expected] of Object.entries(AIV_FACILITY_SCENARIO_EXECUTION_AUTHORITY)) {
    if (value.authority?.[key] !== expected) {
      throw planError('AIV_FACILITY_SCENARIO_PLAN_AUTHORITY_INVALID', `Linked AIV scenario plan authority mismatch at ${key}.`);
    }
  }
  return value;
}

export function inspectAivFacilityScenarioPlanForAssessment(planInput, row = {}) {
  if (!planInput) return Object.freeze({ ok: false, status: 'AIV_STANDALONE_NOT_FACILITY_EVIDENCE' });
  const plan = assertAivFacilityScenarioExecutionPlan(planInput);
  const matches = plan.relationshipExecutions.filter((item) => (
    item.assessmentCanonicalId === row.canonicalId
      && item.assessmentLine === row.line
      && item.caseId === row.caseId
  ));
  if (!matches.length) return Object.freeze({ ok: false, status: 'AIV_FACILITY_ASSESSMENT_SCOPE_NOT_LINKED' });
  const currentBasis = row.scenarioExecutionBasis ?? null;
  if (!currentBasis) return Object.freeze({ ok: false, status: 'AIV_FACILITY_CURRENT_SCENARIO_BASIS_MISSING' });
  if (!row.scenarioSetKey) return Object.freeze({ ok: false, status: 'AIV_FACILITY_CURRENT_SCENARIO_SET_KEY_MISSING' });
  const current = plan.facilityScenarioSetKey === row.scenarioSetKey && matches.every((item) => {
    const basis = item.assessmentScenarioExecutionBasis;
    return basis.datasetId === currentBasis.datasetId
      && basis.scenarioId === currentBasis.scenarioId
      && basis.scenarioSnapshotHash === currentBasis.scenarioSnapshotHash
      && basis.line === currentBasis.line
      && basis.caseId === currentBasis.caseId;
  });
  return Object.freeze({
    ok: current,
    status: current ? 'AIV_FACILITY_SCENARIO_CURRENT' : 'AIV_FACILITY_SCENARIO_STALE',
    matches: Object.freeze(matches),
  });
}
