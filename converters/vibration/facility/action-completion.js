import { assertVibrationFacilityRunBasis } from './run-basis.js';

export const VIBRATION_ACTION_OCCURRENCE_SCHEMA = 'VibrationActionOccurrence.v1';
export const VIBRATION_ACTION_COMPLETION_RECORD_SCHEMA = 'VibrationActionCompletionRecord.v1';

export const VIBRATION_ACTION_COMPLETION_AUTHORITY = Object.freeze({
  purpose: 'CALLER_ATTESTED_ACTION_COMPLETION_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'CALLER_ATTESTATION_ONLY',
  storageSemantics: 'APPEND_ONLY_RECORD_CONTRACT',
  determinesApplicability: false,
  determinesCompleteness: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
});

const TRANSITIONS = new Set(['COMPLETE', 'REOPEN']);

function completionError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationActionCompletionError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw completionError('VIBRATION_ACTION_COMPLETION_TEXT_REQUIRED', `${field} is required.`, { field });
  return text;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertAuthority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_ACTION_COMPLETION_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw completionError('VIBRATION_ACTION_COMPLETION_AUTHORITY_INVALID', `Completion authority mismatch at ${key}.`);
    }
  }
  return value;
}

function isoTimestamp(value) {
  const text = requiredText(value, 'recordedAt');
  if (Number.isNaN(Date.parse(text))) {
    throw completionError('VIBRATION_ACTION_COMPLETION_TIMESTAMP_INVALID', 'recordedAt must be an ISO-compatible timestamp.');
  }
  return text;
}

function scenarioBasis(value = {}) {
  const basis = {
    datasetId: requiredText(value.datasetId, 'scenarioExecutionBasis.datasetId'),
    scenarioId: requiredText(value.scenarioId, 'scenarioExecutionBasis.scenarioId'),
    scenarioSnapshotHash: requiredText(value.scenarioSnapshotHash, 'scenarioExecutionBasis.scenarioSnapshotHash'),
    line: requiredText(value.line, 'scenarioExecutionBasis.line'),
    caseId: requiredText(value.caseId, 'scenarioExecutionBasis.caseId'),
  };
  return Object.freeze(basis);
}

function occurrenceId(actionId, run, scenario) {
  return JSON.stringify([
    actionId, run.runId, run.datasetId, run.scenarioSetKey,
    scenario.scenarioId, scenario.scenarioSnapshotHash, scenario.line, scenario.caseId,
  ]);
}

export function createVibrationActionOccurrence({ action, runBasis, scenarioExecutionBasis } = {}) {
  const actionId = requiredText(action?.actionId, 'action.actionId');
  const line = requiredText(action?.scope?.line, 'action.scope.line');
  const caseId = requiredText(action?.scope?.caseId, 'action.scope.caseId');
  const run = assertVibrationFacilityRunBasis(runBasis);
  const scenario = scenarioBasis(scenarioExecutionBasis);
  if (scenario.datasetId !== run.datasetId) {
    throw completionError('VIBRATION_ACTION_OCCURRENCE_DATASET_MISMATCH', 'Action scenario dataset does not match the facility run.');
  }
  if (scenario.line !== line || scenario.caseId !== caseId) {
    throw completionError('VIBRATION_ACTION_OCCURRENCE_SCOPE_MISMATCH', 'Action scope does not match its scenario execution basis.');
  }
  return deepFreeze({
    schema: VIBRATION_ACTION_OCCURRENCE_SCHEMA,
    occurrenceId: occurrenceId(actionId, run, scenario),
    actionId,
    runBasis: run,
    scenarioExecutionBasis: scenario,
    authority: VIBRATION_ACTION_COMPLETION_AUTHORITY,
  });
}

export function assertVibrationActionOccurrence(value) {
  if (value?.schema !== VIBRATION_ACTION_OCCURRENCE_SCHEMA) {
    throw completionError('VIBRATION_ACTION_OCCURRENCE_SCHEMA_INVALID', `Expected ${VIBRATION_ACTION_OCCURRENCE_SCHEMA}.`);
  }
  const run = assertVibrationFacilityRunBasis(value.runBasis);
  const scenario = scenarioBasis(value.scenarioExecutionBasis);
  const actionId = requiredText(value.actionId, 'occurrence.actionId');
  if (scenario.datasetId !== run.datasetId) {
    throw completionError('VIBRATION_ACTION_OCCURRENCE_DATASET_MISMATCH', 'Action scenario dataset does not match the facility run.');
  }
  if (value.occurrenceId !== occurrenceId(actionId, run, scenario)) {
    throw completionError('VIBRATION_ACTION_OCCURRENCE_ID_INVALID', 'Action occurrence identity does not match its custody fields.');
  }
  assertAuthority(value.authority);
  return value;
}

function evidenceRefs(values, transition) {
  if (!Array.isArray(values)) throw completionError('VIBRATION_ACTION_COMPLETION_EVIDENCE_INVALID', 'evidenceRefs must be an array.');
  const refs = values.map((value, index) => requiredText(value, `evidenceRefs[${index}]`));
  if (new Set(refs).size !== refs.length) {
    throw completionError('VIBRATION_ACTION_COMPLETION_EVIDENCE_DUPLICATE', 'evidenceRefs must be unique.');
  }
  if (transition === 'COMPLETE' && refs.length === 0) {
    throw completionError('VIBRATION_ACTION_COMPLETION_EVIDENCE_REQUIRED', 'Completing a required action requires at least one evidence reference.');
  }
  return Object.freeze(refs);
}

export function createVibrationActionCompletionRecord({
  occurrence, sequence, transition, recordedAt, actorId, reason, evidenceRefs: refs = [],
} = {}) {
  const resolvedOccurrence = assertVibrationActionOccurrence(occurrence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw completionError('VIBRATION_ACTION_COMPLETION_SEQUENCE_INVALID', 'sequence must be a positive integer.');
  }
  const transitionValue = requiredText(transition, 'transition');
  if (!TRANSITIONS.has(transitionValue)) {
    throw completionError('VIBRATION_ACTION_COMPLETION_TRANSITION_INVALID', 'transition must be COMPLETE or REOPEN.');
  }
  const record = {
    schema: VIBRATION_ACTION_COMPLETION_RECORD_SCHEMA,
    recordId: JSON.stringify([resolvedOccurrence.occurrenceId, sequence, transitionValue]),
    actionId: resolvedOccurrence.actionId,
    occurrenceId: resolvedOccurrence.occurrenceId,
    sequence,
    transition: transitionValue,
    recordedAt: isoTimestamp(recordedAt),
    actorId: requiredText(actorId, 'actorId'),
    reason: requiredText(reason, 'reason'),
    evidenceRefs: evidenceRefs(refs, transitionValue),
    authority: VIBRATION_ACTION_COMPLETION_AUTHORITY,
  };
  return deepFreeze(record);
}

export function assertVibrationActionCompletionRecord(value) {
  if (value?.schema !== VIBRATION_ACTION_COMPLETION_RECORD_SCHEMA) {
    throw completionError('VIBRATION_ACTION_COMPLETION_RECORD_SCHEMA_INVALID', `Expected ${VIBRATION_ACTION_COMPLETION_RECORD_SCHEMA}.`);
  }
  if (!Number.isInteger(value.sequence) || value.sequence < 1) {
    throw completionError('VIBRATION_ACTION_COMPLETION_SEQUENCE_INVALID', 'sequence must be a positive integer.');
  }
  const transition = requiredText(value.transition, 'record.transition');
  if (!TRANSITIONS.has(transition)) throw completionError('VIBRATION_ACTION_COMPLETION_TRANSITION_INVALID', 'Invalid completion transition.');
  const expectedId = JSON.stringify([requiredText(value.occurrenceId, 'record.occurrenceId'), value.sequence, transition]);
  if (value.recordId !== expectedId) throw completionError('VIBRATION_ACTION_COMPLETION_RECORD_ID_INVALID', 'Completion record identity mismatch.');
  requiredText(value.actionId, 'record.actionId');
  isoTimestamp(value.recordedAt);
  requiredText(value.actorId, 'record.actorId');
  requiredText(value.reason, 'record.reason');
  evidenceRefs(value.evidenceRefs, transition);
  assertAuthority(value.authority);
  return value;
}

export function evaluateVibrationActionCompletion({ occurrence, records = [] } = {}) {
  const resolvedOccurrence = assertVibrationActionOccurrence(occurrence);
  if (!Array.isArray(records)) throw completionError('VIBRATION_ACTION_COMPLETION_RECORDS_INVALID', 'records must be an array.');
  const exact = [];
  const foreign = [];
  for (const input of records) {
    const record = assertVibrationActionCompletionRecord(input);
    if (record.actionId !== resolvedOccurrence.actionId) continue;
    if (record.occurrenceId === resolvedOccurrence.occurrenceId) exact.push(record);
    else foreign.push(Object.freeze({ record, reason: 'ACTION_OCCURRENCE_MISMATCH' }));
  }
  exact.sort((left, right) => left.sequence - right.sequence);
  let state = 'OPEN';
  for (let index = 0; index < exact.length; index += 1) {
    const record = exact[index];
    if (record.sequence !== index + 1) {
      throw completionError('VIBRATION_ACTION_COMPLETION_SEQUENCE_GAP', 'Completion records must use contiguous sequence numbers.');
    }
    if (record.transition === 'COMPLETE') {
      if (state === 'COMPLETED') throw completionError('VIBRATION_ACTION_COMPLETION_ILLEGAL_TRANSITION', 'Cannot complete an already completed action.');
      state = 'COMPLETED';
    } else {
      if (state !== 'COMPLETED') throw completionError('VIBRATION_ACTION_COMPLETION_ILLEGAL_TRANSITION', 'REOPEN requires a previously completed action.');
      state = 'REOPENED';
    }
  }
  return deepFreeze({
    completionState: state,
    appliedRecords: exact,
    foreignRecords: foreign,
    latestRecord: exact.at(-1) ?? null,
  });
}
