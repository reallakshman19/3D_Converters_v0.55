import {
  assertVibrationActionCompletionLedger,
  createVibrationActionCompletionLedger,
} from '../converters/vibration/facility/action-completion-ledger.js';
import {
  assertVibrationActionVerificationLedger,
  createVibrationActionVerificationLedger,
} from '../converters/vibration/facility/action-verification-ledger.js';
import {
  assertVibrationMitigationLedger,
  createVibrationMitigationLedger,
} from '../converters/vibration/mitigation/ledger.js';
import {
  assertVibrationRcaLedger,
  createVibrationRcaLedger,
} from '../converters/vibration/rca/ledger.js';
import {
  assertVibrationIntegrityProjectCompat,
  vibrationProjectLifecycleLedgersCompat,
} from './vibration-project-schema-compat.js';

export const VIBRATION_PROJECT_LIFECYCLE_HANDOFF_SCHEMA = 'VibrationProjectLifecycleHandoff.v1';
export const VIBRATION_PROJECT_LIFECYCLE_HANDOFF_EVENT = 'vibration-project-lifecycle-handoff';
export const VIBRATION_PROJECT_LIFECYCLE_CHANGED_EVENT = 'vibration-project-lifecycle-changed';

export const VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY = Object.freeze({
  purpose: 'PROJECT_LIFECYCLE_CUSTODY_TRANSFER_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  persistenceAuthority: 'PROJECT_CONTAINER_ONLY',
  completionAuthority: 'CALLER_ATTESTATION_ONLY',
  rootCauseAuthority: 'EXPLICIT_ENGINEER_ATTESTATION_ONLY',
  mitigationAuthority: 'CUSTODY_ONLY',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesGoverningResult: false,
  blocksCalculation: false,
});

function handoffError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationProjectLifecycleHandoffError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw handoffError('VIBRATION_PROJECT_LIFECYCLE_TEXT_REQUIRED', `${field} is required.`, { field });
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function authority(value) {
  const expectedKeys = Object.keys(VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY).sort();
  const actualKeys = Object.keys(value ?? {}).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw handoffError('VIBRATION_PROJECT_LIFECYCLE_AUTHORITY_INVALID', 'Lifecycle handoff authority shape is invalid.');
  }
  for (const [key, expected] of Object.entries(VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY)) {
    if (value[key] !== expected) {
      throw handoffError('VIBRATION_PROJECT_LIFECYCLE_AUTHORITY_INVALID', `Lifecycle handoff authority mismatch at ${key}.`, { key });
    }
  }
}

function build(projectIdInput, ledgers = {}) {
  const projectId = text(projectIdInput, 'projectId');
  return deepFreeze({
    schema: VIBRATION_PROJECT_LIFECYCLE_HANDOFF_SCHEMA,
    projectId,
    actionCompletionLedger: assertVibrationActionCompletionLedger(
      ledgers.actionCompletionLedger ?? createVibrationActionCompletionLedger(),
    ),
    actionVerificationLedger: assertVibrationActionVerificationLedger(
      ledgers.actionVerificationLedger ?? createVibrationActionVerificationLedger(),
    ),
    rcaLedger: assertVibrationRcaLedger(ledgers.rcaLedger ?? createVibrationRcaLedger()),
    mitigationLedger: assertVibrationMitigationLedger(
      ledgers.mitigationLedger ?? createVibrationMitigationLedger(),
    ),
    authority: VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY,
  });
}

function stateProjectId(projectIdInput, state, actionCompletionLedger) {
  const requestedProjectId = text(projectIdInput, 'projectId');
  const establishedProjectId = String(state.lifecycleProjectId ?? '').trim();
  if (establishedProjectId && establishedProjectId !== requestedProjectId) {
    throw handoffError(
      'VIBRATION_PROJECT_LIFECYCLE_STATE_PROJECT_MISMATCH',
      'Lifecycle state is already bound to a different vibration project.',
      { projectId: requestedProjectId, stateProjectId: establishedProjectId },
    );
  }
  if (!establishedProjectId && actionCompletionLedger.records.length) {
    throw handoffError(
      'VIBRATION_PROJECT_LIFECYCLE_M13_PROJECT_CUSTODY_REQUIRED',
      'Non-empty M13 completion custody requires an established lifecycleProjectId in workspace state.',
      { projectId: requestedProjectId },
    );
  }
  return establishedProjectId || requestedProjectId;
}

export function createVibrationProjectLifecycleHandoff({ project } = {}) {
  const validated = assertVibrationIntegrityProjectCompat(project);
  const lifecycle = vibrationProjectLifecycleLedgersCompat(validated);
  return build(lifecycle.projectId, lifecycle);
}

export function createVibrationProjectLifecycleHandoffFromState({ projectId, state = {} } = {}) {
  const actionCompletionLedger = assertVibrationActionCompletionLedger(
    state.actionCompletionLedger ?? createVibrationActionCompletionLedger(),
  );
  const resolvedProjectId = stateProjectId(projectId, state, actionCompletionLedger);
  return build(resolvedProjectId, {
    actionCompletionLedger,
    actionVerificationLedger: state.actionVerificationLedger,
    rcaLedger: state.rcaLedger,
    mitigationLedger: state.mitigationLedger,
  });
}

export function assertVibrationProjectLifecycleHandoff(value) {
  if (value?.schema !== VIBRATION_PROJECT_LIFECYCLE_HANDOFF_SCHEMA) {
    throw handoffError(
      'VIBRATION_PROJECT_LIFECYCLE_SCHEMA_INVALID',
      `Expected ${VIBRATION_PROJECT_LIFECYCLE_HANDOFF_SCHEMA}.`,
    );
  }
  const validated = build(text(value.projectId, 'handoff.projectId'), value);
  authority(value.authority);
  return validated;
}
