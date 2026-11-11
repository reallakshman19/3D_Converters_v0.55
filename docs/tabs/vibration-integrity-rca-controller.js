import {
  assertVibrationActionVerificationLedger,
  createVibrationActionVerificationLedger,
} from '../converters/vibration/facility/action-verification-ledger.js';
import {
  VIBRATION_RCA_CONCLUSION_OUTCOMES,
  createVibrationRcaHypothesis,
} from '../converters/vibration/rca/contracts.js';
import {
  appendVibrationRcaHypothesis,
  assertVibrationRcaLedger,
  createVibrationRcaLedger,
} from '../converters/vibration/rca/ledger.js';
import { buildVibrationActionCompletionAuthoringModel } from './vibration-integrity-action-completion-controller.js';
import { auditVibrationRca } from './vibration-integrity-rca-audit.js';
import { assertVibrationProjectEvidenceHandoff } from './vibration-project-evidence-handoff.js';

export const VIBRATION_RCA_AUTHORING_AUTHORITY = Object.freeze({
  purpose: 'EXPLICIT_ENGINEER_RCA_AUTHORING_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  completionAuthority: 'NONE',
  rootCauseAuthority: 'EXPLICIT_ENGINEER_ATTESTATION_ONLY',
  platformRootCauseInference: false,
  autoConfirmAllowed: false,
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
});

function rcaError(code, message) {
  const error = new Error(message);
  error.name = 'VibrationRcaAuthoringError';
  error.code = code;
  return error;
}

function emptyDraft() {
  return {
    hypothesisId: '', statement: '',
    evidenceForRecordIds: [], evidenceAgainstRecordIds: [],
    conclusionOutcome: 'NO_CONCLUSION', engineerId: '', conclusionReason: '',
  };
}

function verificationLedger(state) {
  return assertVibrationActionVerificationLedger(
    state.actionVerificationLedger ?? createVibrationActionVerificationLedger(),
  );
}

function rcaLedger(state) {
  return assertVibrationRcaLedger(state.rcaLedger ?? createVibrationRcaLedger());
}

function projectHandoff(state) {
  return state.projectEvidenceHandoff == null ? null : assertVibrationProjectEvidenceHandoff(state.projectEvidenceHandoff);
}

function actionVerificationRecords(ledger, projectId, occurrenceId) {
  return ledger.records.filter((record) => record.projectId === projectId
    && record.attachment.occurrence.occurrenceId === occurrenceId);
}

function verificationRevision(records) {
  return JSON.stringify(records.map((record) => [
    record.recordId,
    record.attachment.verificationStatusFingerprint,
  ]));
}

export function buildVibrationRcaAuthoringModel(state = {}) {
  const completion = buildVibrationActionCompletionAuthoringModel(state);
  const handoff = projectHandoff(state);
  const vLedger = verificationLedger(state);
  const ledger = rcaLedger(state);
  const enabled = completion.enabled && Boolean(handoff);
  const actions = completion.actions.map((entry) => {
    const verificationRecords = handoff
      ? actionVerificationRecords(vLedger, handoff.projectId, entry.occurrenceId) : [];
    const records = handoff ? ledger.records.filter((record) => record.projectId === handoff.projectId
      && record.hypothesis.occurrence.occurrenceId === entry.occurrenceId) : [];
    return Object.freeze({
      action: entry.action,
      occurrenceId: entry.occurrenceId,
      authorable: enabled && Boolean(entry.action.occurrence) && verificationRecords.length > 0,
      verificationRecords: Object.freeze(verificationRecords),
      verificationRevisionKey: verificationRevision(verificationRecords),
      acceptedVerificationCount: verificationRecords.filter((record) => (
        record.attachment.verificationStatus.state === 'VERIFICATION_EVIDENCE_ACCEPTED'
      )).length,
      rcaRecords: Object.freeze(records),
      latestRcaRecord: records.at(-1) ?? null,
    });
  });
  return Object.freeze({
    authority: VIBRATION_RCA_AUTHORING_AUTHORITY,
    enabled,
    handoff,
    verificationLedger: vLedger,
    ledger,
    actions: Object.freeze(actions),
    editor: state.rcaEditor ?? null,
    draft: Object.freeze({ ...(state.rcaDraft ?? emptyDraft()) }),
    conclusionOutcomes: VIBRATION_RCA_CONCLUSION_OUTCOMES,
  });
}

function currentEntry(state, occurrenceId) {
  const model = buildVibrationRcaAuthoringModel(state);
  if (!model.enabled) throw rcaError('VIBRATION_RCA_PROJECT_EVIDENCE_REQUIRED', 'A current facility run and governed project handoff are required for RCA.');
  const entry = model.actions.find((item) => item.occurrenceId === occurrenceId) ?? null;
  if (!entry?.authorable) {
    throw rcaError('VIBRATION_RCA_VERIFICATION_EVIDENCE_REQUIRED', 'The current action occurrence needs at least one exact project-scoped verification record before RCA authoring.');
  }
  return { model, entry };
}

export function openVibrationRcaEditor(state, occurrenceId) {
  const occurrence = String(occurrenceId ?? '').trim();
  const { model, entry } = currentEntry(state, occurrence);
  state.rcaEditor = Object.freeze({
    occurrenceId: occurrence,
    actionId: entry.action.actionId,
    runId: entry.action.occurrence.runBasis.runId,
    projectId: model.handoff.projectId,
    verificationRevisionKey: entry.verificationRevisionKey,
  });
  state.rcaDraft = emptyDraft();
  return state.rcaEditor;
}

export function updateVibrationRcaDraft(state, field, value) {
  const allowed = new Set(['hypothesisId', 'statement', 'conclusionOutcome', 'engineerId', 'conclusionReason']);
  if (!allowed.has(field)) throw rcaError('VIBRATION_RCA_DRAFT_FIELD_INVALID', `Unsupported RCA draft field: ${field}`);
  state.rcaDraft = { ...(state.rcaDraft ?? emptyDraft()), [field]: String(value ?? '') };
  return state.rcaDraft;
}

export function toggleVibrationRcaEvidence(state, direction, recordId, checked) {
  const field = direction === 'FOR' ? 'evidenceForRecordIds'
    : direction === 'AGAINST' ? 'evidenceAgainstRecordIds' : null;
  if (!field) throw rcaError('VIBRATION_RCA_EVIDENCE_DIRECTION_INVALID', 'RCA evidence direction must be FOR or AGAINST.');
  const id = String(recordId ?? '').trim();
  if (!id) throw rcaError('VIBRATION_RCA_EVIDENCE_ID_REQUIRED', 'Verification record ID is required.');
  const draft = state.rcaDraft ?? emptyDraft();
  const selected = new Set(draft[field] ?? []);
  if (checked) selected.add(id); else selected.delete(id);
  state.rcaDraft = { ...draft, [field]: [...selected] };
  return state.rcaDraft;
}

function conclusionFromDraft(draft, recordedAt) {
  if (draft.conclusionOutcome === 'NO_CONCLUSION') return null;
  return {
    outcome: draft.conclusionOutcome,
    engineerId: draft.engineerId,
    recordedAt,
    reason: draft.conclusionReason,
  };
}

export function submitVibrationRcaEditor(state, { recordedAt = new Date().toISOString() } = {}) {
  const editor = state.rcaEditor;
  if (!editor) throw rcaError('VIBRATION_RCA_EDITOR_NOT_OPEN', 'No RCA editor is open.');
  const { model, entry } = currentEntry(state, editor.occurrenceId);
  if (entry.action.actionId !== editor.actionId
      || entry.action.occurrence.runBasis.runId !== editor.runId
      || model.handoff.projectId !== editor.projectId
      || entry.verificationRevisionKey !== editor.verificationRevisionKey) {
    throw rcaError('VIBRATION_RCA_EDITOR_STALE', 'Facility run, project identity or verification evidence changed after the RCA editor opened.');
  }
  const draft = state.rcaDraft ?? emptyDraft();
  const hypothesis = createVibrationRcaHypothesis({
    projectId: model.handoff.projectId,
    occurrence: entry.action.occurrence,
    mechanismId: entry.action.mechanismId,
    verificationLedger: model.verificationLedger,
    hypothesisId: draft.hypothesisId,
    statement: draft.statement,
    evidenceForRecordIds: draft.evidenceForRecordIds,
    evidenceAgainstRecordIds: draft.evidenceAgainstRecordIds,
    conclusion: conclusionFromDraft(draft, recordedAt),
  });
  state.rcaLedger = appendVibrationRcaHypothesis(model.ledger, model.handoff.projectId, hypothesis, recordedAt);
  state.rcaEditor = null;
  state.rcaDraft = emptyDraft();
  return hypothesis;
}

export function cancelVibrationRcaEditor(state) {
  state.rcaEditor = null;
  state.rcaDraft = emptyDraft();
}

export function handleVibrationRcaClick(state, event, render) {
  const open = event.target.closest('[data-vi-rca-open]')?.dataset.viRcaOpen;
  if (open) {
    try {
      const editor = openVibrationRcaEditor(state, open); state.error = null;
      auditVibrationRca(state, 'RCA_EDITOR_OPENED', editor, editor.actionId);
    } catch (error) { state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`; }
    render(); return true;
  }
  if (event.target.closest('[data-vi-rca-cancel]')) {
    const editor = state.rcaEditor; cancelVibrationRcaEditor(state); state.error = null;
    auditVibrationRca(state, 'RCA_EDITOR_CANCELLED', { occurrenceId: editor?.occurrenceId ?? null }, editor?.actionId ?? null);
    render(); return true;
  }
  if (!event.target.closest('[data-vi-rca-submit]')) return false;
  try {
    const hypothesis = submitVibrationRcaEditor(state); state.error = null;
    auditVibrationRca(state, 'RCA_HYPOTHESIS_RECORDED', {
      hypothesisId: hypothesis.hypothesisId,
      hypothesisRecordId: hypothesis.hypothesisRecordId,
      outcome: hypothesis.conclusion?.outcome ?? null,
      evidenceCount: hypothesis.evidence.length,
    }, hypothesis.actionId);
  } catch (error) {
    state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    auditVibrationRca(state, 'RCA_RECORD_FAILED', { error: state.error.slice(0, 500) }, state.rcaEditor?.actionId ?? null);
  }
  render(); return true;
}

export function handleVibrationRcaChange(state, event, render) {
  const direction = event.target.dataset.viRcaEvidence;
  const field = event.target.dataset.viRcaField;
  if (!direction && !field) return false;
  try {
    if (direction) toggleVibrationRcaEvidence(state, direction, event.target.value, event.target.checked);
    else updateVibrationRcaDraft(state, field, event.target.value);
    state.error = null;
  } catch (error) { state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`; }
  render(); return true;
}
