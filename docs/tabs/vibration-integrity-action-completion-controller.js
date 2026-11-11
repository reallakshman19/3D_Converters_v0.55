import { createVibrationActionCompletionRecord } from '../converters/vibration/facility/action-completion.js';
import {
  appendVibrationActionCompletionRecord,
  assertVibrationActionCompletionLedger,
  createVibrationActionCompletionLedger,
} from '../converters/vibration/facility/action-completion-ledger.js';
import { buildVibrationFacilityActionLifecycle } from '../converters/vibration/facility/action-lifecycle.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';

export const VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY = Object.freeze({
  purpose: 'CALLER_ATTESTED_COMPLETION_AUTHORING_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  determinesGoverningResult: false,
  directLifecycleMutationAllowed: false,
  appendOnlyLedgerRequired: true,
});

function authoringError(code, message) {
  const error = new Error(message);
  error.name = 'VibrationActionCompletionAuthoringError';
  error.code = code;
  return error;
}

function emptyDraft() {
  return { actorId: '', reason: '', evidenceRefs: '' };
}

export function createVibrationActionCompletionUiState() {
  return {
    actionCompletionLedger: createVibrationActionCompletionLedger(),
    actionCompletionEditor: null,
    actionCompletionDraft: emptyDraft(),
  };
}

function currentRunBasis(state) {
  if (state.resultState !== 'CURRENT_RESULT') return null;
  const result = state.envelope?.workflow?.result;
  const runId = String(state.runSnapshot?.runId ?? '').trim();
  const datasetId = String(result?.datasetId ?? '').trim();
  const scenarioSetKey = String(result?.scenarioSetKey ?? '').trim();
  if (!runId || !datasetId || !scenarioSetKey) return null;
  return createVibrationFacilityRunBasis({ runId, datasetId, scenarioSetKey });
}

function ledgerForState(state) {
  return assertVibrationActionCompletionLedger(
    state.actionCompletionLedger ?? createVibrationActionCompletionLedger(),
  );
}

function lifecycleForState(state, runBasis) {
  const registerRows = state.envelope?.workflow?.register?.rows ?? [];
  const ledger = ledgerForState(state);
  return buildVibrationFacilityActionLifecycle({
    registerRows,
    resultState: state.resultState ?? 'UNRUN',
    runBasis,
    completionRecords: ledger.records,
  });
}

function nextTransition(action) {
  if (action.completionState === 'COMPLETED') return 'REOPEN';
  if (action.completionState === 'OPEN' || action.completionState === 'REOPENED') return 'COMPLETE';
  throw authoringError(
    'VIBRATION_ACTION_COMPLETION_STATE_UNSUPPORTED',
    `Unsupported action completion state: ${action.completionState}`,
  );
}

export function buildVibrationActionCompletionAuthoringModel(state = {}) {
  const runBasis = currentRunBasis(state);
  const lifecycle = lifecycleForState(state, runBasis);
  const enabled = Boolean(runBasis) && state.resultState === 'CURRENT_RESULT';
  const actions = lifecycle.currentActions.map((action) => Object.freeze({
    action,
    occurrenceId: action.occurrence?.occurrenceId ?? null,
    authorable: enabled && Boolean(action.occurrence),
    nextTransition: action.occurrence ? nextTransition(action) : null,
    nextSequence: (action.completionHistory?.length ?? 0) + 1,
  }));
  return Object.freeze({
    authority: VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY,
    enabled,
    runBasis,
    lifecycle,
    actions: Object.freeze(actions),
    editor: state.actionCompletionEditor ?? null,
    draft: Object.freeze({ ...(state.actionCompletionDraft ?? emptyDraft()) }),
  });
}

function currentActionForOccurrence(state, occurrenceId) {
  const model = buildVibrationActionCompletionAuthoringModel(state);
  if (!model.enabled) {
    throw authoringError(
      'VIBRATION_ACTION_COMPLETION_RUN_NOT_CURRENT',
      'A current facility run is required before recording action completion.',
    );
  }
  const entry = model.actions.find((item) => item.occurrenceId === occurrenceId) ?? null;
  if (!entry?.authorable) {
    throw authoringError(
      'VIBRATION_ACTION_COMPLETION_OCCURRENCE_NOT_CURRENT',
      'The selected action occurrence is not current and authorable.',
    );
  }
  return { model, entry };
}

export function openVibrationActionCompletionEditor(state, occurrenceId) {
  const occurrence = String(occurrenceId ?? '').trim();
  const { model, entry } = currentActionForOccurrence(state, occurrence);
  state.actionCompletionEditor = Object.freeze({
    occurrenceId: occurrence,
    actionId: entry.action.actionId,
    transition: entry.nextTransition,
    sequence: entry.nextSequence,
    openedRunId: model.runBasis.runId,
    scope: entry.action.scope,
  });
  state.actionCompletionDraft = emptyDraft();
  return state.actionCompletionEditor;
}

export function updateVibrationActionCompletionDraft(state, field, value) {
  if (!['actorId', 'reason', 'evidenceRefs'].includes(field)) {
    throw authoringError('VIBRATION_ACTION_COMPLETION_DRAFT_FIELD_INVALID', `Unsupported draft field: ${field}`);
  }
  state.actionCompletionDraft = {
    ...(state.actionCompletionDraft ?? emptyDraft()),
    [field]: String(value ?? ''),
  };
  return state.actionCompletionDraft;
}

function parseEvidenceRefs(value) {
  return String(value ?? '')
    .split(/[\n,;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function submitVibrationActionCompletionEditor(state, {
  recordedAt = new Date().toISOString(),
} = {}) {
  const editor = state.actionCompletionEditor;
  if (!editor) {
    throw authoringError('VIBRATION_ACTION_COMPLETION_EDITOR_NOT_OPEN', 'No action completion editor is open.');
  }
  const { model, entry } = currentActionForOccurrence(state, editor.occurrenceId);
  if (model.runBasis.runId !== editor.openedRunId
      || entry.action.actionId !== editor.actionId
      || entry.nextTransition !== editor.transition
      || entry.nextSequence !== editor.sequence) {
    throw authoringError(
      'VIBRATION_ACTION_COMPLETION_EDITOR_STALE',
      'The action occurrence changed after the editor opened. Reopen the editor from the current action.',
    );
  }
  const draft = state.actionCompletionDraft ?? emptyDraft();
  const record = createVibrationActionCompletionRecord({
    occurrence: entry.action.occurrence,
    sequence: editor.sequence,
    transition: editor.transition,
    recordedAt,
    actorId: draft.actorId,
    reason: draft.reason,
    evidenceRefs: parseEvidenceRefs(draft.evidenceRefs),
  });
  state.actionCompletionLedger = appendVibrationActionCompletionRecord(ledgerForState(state), record);
  state.actionCompletionEditor = null;
  state.actionCompletionDraft = emptyDraft();
  return record;
}

export function cancelVibrationActionCompletionEditor(state) {
  state.actionCompletionEditor = null;
  state.actionCompletionDraft = emptyDraft();
}

export function handleVibrationActionCompletionClick(state, event, render, audit) {
  const open = event.target.closest('[data-vi-action-completion-open]')?.dataset.viActionCompletionOpen;
  if (open) {
    try {
      const editor = openVibrationActionCompletionEditor(state, open);
      state.error = null;
      audit?.('ACTION_COMPLETION_EDITOR_OPENED', {
        actionId: editor.actionId,
        occurrenceId: editor.occurrenceId,
        transition: editor.transition,
      }, editor.actionId);
    } catch (error) {
      state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    }
    render();
    return true;
  }
  if (event.target.closest('[data-vi-action-completion-cancel]')) {
    cancelVibrationActionCompletionEditor(state);
    state.error = null;
    audit?.('ACTION_COMPLETION_EDITOR_CANCELLED', {}, null);
    render();
    return true;
  }
  if (!event.target.closest('[data-vi-action-completion-submit]')) return false;
  try {
    const record = submitVibrationActionCompletionEditor(state);
    state.error = null;
    audit?.('ACTION_COMPLETION_RECORDED', {
      actionId: record.actionId,
      occurrenceId: record.occurrenceId,
      recordId: record.recordId,
      transition: record.transition,
      actorId: record.actorId,
      evidenceRefCount: record.evidenceRefs.length,
    }, record.actionId);
  } catch (error) {
    state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    audit?.('ACTION_COMPLETION_RECORD_FAILED', { error: state.error.slice(0, 500) }, null);
  }
  render();
  return true;
}

export function handleVibrationActionCompletionChange(state, event, render) {
  const field = event.target.dataset.viActionCompletionField;
  if (!field) return false;
  try {
    updateVibrationActionCompletionDraft(state, field, event.target.value);
    state.error = null;
  } catch (error) {
    state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
  }
  render();
  return true;
}
