import {
  createVibrationActionVerificationAttachment,
  createVibrationActionVerificationRequirement,
  vibrationVerificationScopeFromActionOccurrence,
} from '../converters/vibration/facility/action-verification.js';
import {
  appendVibrationActionVerificationAttachment,
  assertVibrationActionVerificationLedger,
  createVibrationActionVerificationLedger,
} from '../converters/vibration/facility/action-verification-ledger.js';
import { VIBRATION_SIGNAL_PRODUCT_TYPES } from '../converters/vibration/measurement/contracts.js';
import {
  VIBRATION_MEASUREMENT_DISPOSITION_OUTCOMES,
  VIBRATION_VERIFICATION_REQUIREMENT_TYPES,
} from '../converters/vibration/verification/contracts.js';
import { auditVibrationActionVerification } from './vibration-integrity-action-verification-audit.js';
import { buildVibrationActionCompletionAuthoringModel } from './vibration-integrity-action-completion-controller.js';
import { handleVibrationRcaChange, handleVibrationRcaClick } from './vibration-integrity-rca-controller.js';
import { assertVibrationProjectEvidenceHandoff } from './vibration-project-evidence-handoff.js';
export const VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY = Object.freeze({
  purpose: 'PROJECT_EVIDENCE_ACTION_VERIFICATION_AUTHORING_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  rootCauseAuthority: false,
});

function authoringError(code, message) {
  const error = new Error(message);
  error.name = 'VibrationActionVerificationAuthoringError';
  error.code = code;
  return error;
}

function emptyDraft() {
  return {
    requirementId: '', requirementType: 'BASIC_MEASUREMENT', requirementReason: '',
    requiredProductTypes: [], includeDisposition: false,
    dispositionId: '', dispositionOutcome: 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT',
    reviewerId: '', dispositionReason: '', sessionIds: [], productIds: [],
  };
}

export function createVibrationActionVerificationUiState(projectEvidenceHandoff = null) {
  return {
    projectEvidenceHandoff: projectEvidenceHandoff == null ? null : assertVibrationProjectEvidenceHandoff(projectEvidenceHandoff),
    actionVerificationLedger: createVibrationActionVerificationLedger(),
    actionVerificationEditor: null,
    actionVerificationDraft: emptyDraft(),
  };
}

export function setVibrationActionVerificationProjectEvidence(state, handoff) {
  state.projectEvidenceHandoff = handoff == null ? null : assertVibrationProjectEvidenceHandoff(handoff);
  return state.projectEvidenceHandoff;
}

function sameScope(left, right) {
  return left.lineId === right.lineId
    && left.caseId === right.caseId
    && left.operatingCaseSnapshotId === right.operatingCaseSnapshotId
    && left.operatingCaseSnapshotHash === right.operatingCaseSnapshotHash;
}

function evidenceForOccurrence(handoff, occurrence) {
  if (!handoff || !occurrence) return { sessions: [], products: [], availableProductTypes: [] };
  const scope = vibrationVerificationScopeFromActionOccurrence(occurrence);
  const sessions = handoff.measurementEvidence.sessions.filter((session) => sameScope(session.scope, scope));
  const ids = new Set(sessions.map((session) => session.sessionId));
  const products = handoff.measurementEvidence.products.filter((product) => ids.has(product.sessionId));
  return {
    sessions,
    products,
    availableProductTypes: [...new Set(products.map((product) => product.productType))].sort(),
  };
}

function ledgerForState(state) {
  return assertVibrationActionVerificationLedger(
    state.actionVerificationLedger ?? createVibrationActionVerificationLedger(),
  );
}

export function buildVibrationActionVerificationAuthoringModel(state = {}) {
  const completion = buildVibrationActionCompletionAuthoringModel(state);
  const handoff = state.projectEvidenceHandoff == null ? null : assertVibrationProjectEvidenceHandoff(state.projectEvidenceHandoff);
  const ledger = ledgerForState(state);
  const enabled = completion.enabled && Boolean(handoff);
  const actions = completion.actions.map((entry) => {
    const evidence = evidenceForOccurrence(handoff, entry.action.occurrence);
    const records = ledger.records.filter((record) => record.projectId === handoff?.projectId
      && record.attachment.occurrence.occurrenceId === entry.occurrenceId);
    return Object.freeze({
      action: entry.action,
      occurrenceId: entry.occurrenceId,
      authorable: enabled && Boolean(entry.action.occurrence),
      sessions: Object.freeze(evidence.sessions),
      products: Object.freeze(evidence.products),
      availableProductTypes: Object.freeze(evidence.availableProductTypes),
      latestRecord: records.at(-1) ?? null,
      attachmentCount: records.length,
    });
  });
  return Object.freeze({
    authority: VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY,
    enabled,
    handoff,
    ledger,
    actions: Object.freeze(actions),
    editor: state.actionVerificationEditor ?? null,
    draft: Object.freeze({ ...(state.actionVerificationDraft ?? emptyDraft()) }),
    productTypes: VIBRATION_SIGNAL_PRODUCT_TYPES,
    requirementTypes: VIBRATION_VERIFICATION_REQUIREMENT_TYPES,
    dispositionOutcomes: VIBRATION_MEASUREMENT_DISPOSITION_OUTCOMES,
  });
}

function currentEntry(state, occurrenceId) {
  const model = buildVibrationActionVerificationAuthoringModel(state);
  if (!model.enabled) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_PROJECT_EVIDENCE_REQUIRED', 'A current facility run and governed vibration project evidence handoff are required.');
  }
  const entry = model.actions.find((item) => item.occurrenceId === occurrenceId) ?? null;
  if (!entry?.authorable) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_OCCURRENCE_NOT_CURRENT', 'The selected action occurrence is not current and authorable.');
  }
  return { model, entry };
}

export function openVibrationActionVerificationEditor(state, occurrenceId) {
  const occurrence = String(occurrenceId ?? '').trim();
  const { model, entry } = currentEntry(state, occurrence);
  state.actionVerificationEditor = Object.freeze({
    occurrenceId: occurrence,
    actionId: entry.action.actionId,
    openedRunId: entry.action.occurrence.runBasis.runId,
    projectId: model.handoff.projectId,
    evidenceRevisionKey: model.handoff.evidenceRevisionKey,
  });
  state.actionVerificationDraft = emptyDraft();
  return state.actionVerificationEditor;
}

export function updateVibrationActionVerificationDraft(state, field, value) {
  const allowed = new Set([
    'requirementId', 'requirementType', 'requirementReason', 'includeDisposition',
    'dispositionId', 'dispositionOutcome', 'reviewerId', 'dispositionReason',
  ]);
  if (!allowed.has(field)) throw authoringError('VIBRATION_ACTION_VERIFICATION_DRAFT_FIELD_INVALID', `Unsupported verification draft field: ${field}`);
  state.actionVerificationDraft = {
    ...(state.actionVerificationDraft ?? emptyDraft()),
    [field]: field === 'includeDisposition' ? value === true : String(value ?? ''),
  };
  return state.actionVerificationDraft;
}

export function toggleVibrationActionVerificationSelection(state, group, value, checked) {
  const allowed = {
    requiredProductTypes: new Set(VIBRATION_SIGNAL_PRODUCT_TYPES),
    sessionIds: null,
    productIds: null,
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, group)) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_SELECTION_INVALID', `Unsupported verification selection group: ${group}`);
  }
  const item = String(value ?? '').trim();
  if (!item || (allowed[group] && !allowed[group].has(item))) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_SELECTION_INVALID', `Invalid ${group} selection.`);
  }
  const draft = state.actionVerificationDraft ?? emptyDraft();
  const next = new Set(draft[group] ?? []);
  if (checked) next.add(item); else next.delete(item);
  state.actionVerificationDraft = { ...draft, [group]: [...next] };
  return state.actionVerificationDraft;
}

function assertSelectedEvidence(entry, draft) {
  const sessions = new Set(entry.sessions.map((session) => session.sessionId));
  const products = new Set(entry.products.map((product) => product.productId));
  if ((draft.sessionIds ?? []).some((id) => !sessions.has(id)) || (draft.productIds ?? []).some((id) => !products.has(id))) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_SELECTION_STALE', 'Selected measurement evidence is not current for this action occurrence.');
  }
}

export function submitVibrationActionVerificationEditor(state, { recordedAt = new Date().toISOString() } = {}) {
  const editor = state.actionVerificationEditor;
  if (!editor) throw authoringError('VIBRATION_ACTION_VERIFICATION_EDITOR_NOT_OPEN', 'No verification editor is open.');
  const { model, entry } = currentEntry(state, editor.occurrenceId);
  if (entry.action.actionId !== editor.actionId
      || entry.action.occurrence.runBasis.runId !== editor.openedRunId
      || model.handoff.projectId !== editor.projectId
      || model.handoff.evidenceRevisionKey !== editor.evidenceRevisionKey) {
    throw authoringError('VIBRATION_ACTION_VERIFICATION_EDITOR_STALE', 'Facility run, project identity or project measurement evidence changed after the editor opened.');
  }
  const draft = state.actionVerificationDraft ?? emptyDraft();
  assertSelectedEvidence(entry, draft);
  const requirement = createVibrationActionVerificationRequirement({
    action: entry.action,
    occurrence: entry.action.occurrence,
    requirementId: draft.requirementId,
    requirementType: draft.requirementType,
    reason: draft.requirementReason,
    requiredProductTypes: draft.requiredProductTypes,
  });
  const disposition = draft.includeDisposition ? {
    dispositionId: draft.dispositionId,
    requirementId: requirement.requirementId,
    scope: requirement.scope,
    mechanismId: requirement.mechanismId,
    outcome: draft.dispositionOutcome,
    evidence: { sessionIds: draft.sessionIds, productIds: draft.productIds },
    review: { reviewerId: draft.reviewerId, reviewedAt: recordedAt },
    reason: draft.dispositionReason,
  } : null;
  const attachment = createVibrationActionVerificationAttachment({
    action: entry.action,
    occurrence: entry.action.occurrence,
    requirement,
    measurementEvidence: model.handoff.measurementEvidence,
    disposition,
  });
  state.actionVerificationLedger = appendVibrationActionVerificationAttachment(
    model.ledger, model.handoff.projectId, attachment, recordedAt,
  );
  state.actionVerificationEditor = null;
  state.actionVerificationDraft = emptyDraft();
  return attachment;
}

export function cancelVibrationActionVerificationEditor(state) {
  state.actionVerificationEditor = null;
  state.actionVerificationDraft = emptyDraft();
}

export function handleVibrationActionVerificationClick(state, event, render) {
  const open = event.target.closest('[data-vi-action-verification-open]')?.dataset.viActionVerificationOpen;
  if (open) {
    try {
      const editor = openVibrationActionVerificationEditor(state, open);
      state.error = null;
      auditVibrationActionVerification(state, 'ACTION_VERIFICATION_EDITOR_OPENED', {
        actionId: editor.actionId, occurrenceId: editor.occurrenceId, projectId: editor.projectId,
      }, editor.actionId);
    } catch (error) {
      state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    }
    render(); return true;
  }
  if (event.target.closest('[data-vi-action-verification-cancel]')) {
    const editor = state.actionVerificationEditor;
    cancelVibrationActionVerificationEditor(state);
    state.error = null;
    auditVibrationActionVerification(state, 'ACTION_VERIFICATION_EDITOR_CANCELLED', {
      actionId: editor?.actionId ?? null, occurrenceId: editor?.occurrenceId ?? null,
    }, editor?.actionId ?? null);
    render(); return true;
  }
  if (!event.target.closest('[data-vi-action-verification-submit]')) return handleVibrationRcaClick(state, event, render);
  try {
    const attachment = submitVibrationActionVerificationEditor(state);
    state.error = null;
    auditVibrationActionVerification(state, 'ACTION_VERIFICATION_RECORDED', {
      attachmentId: attachment.attachmentId,
      actionId: attachment.action.actionId,
      occurrenceId: attachment.occurrence.occurrenceId,
      requirementId: attachment.requirement.requirementId,
      verificationState: attachment.verificationStatus.state,
      sessionCount: attachment.evidence.sessions.length,
      productCount: attachment.evidence.products.length,
    }, attachment.action.actionId);
  } catch (error) {
    state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    auditVibrationActionVerification(state, 'ACTION_VERIFICATION_RECORD_FAILED', {
      error: state.error.slice(0, 500),
    }, state.actionVerificationEditor?.actionId ?? null);
  }
  render(); return true;
}

export function handleVibrationActionVerificationChange(state, event, render) {
  const group = event.target.dataset.viActionVerificationSelection;
  const field = event.target.dataset.viActionVerificationField;
  if (!group && !field) return handleVibrationRcaChange(state, event, render);
  try {
    if (group) toggleVibrationActionVerificationSelection(state, group, event.target.value, event.target.checked);
    else updateVibrationActionVerificationDraft(state, field, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
    state.error = null;
  } catch (error) { state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`; }
  render(); return true;
}
