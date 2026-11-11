import { createVibrationActionCompletionLedger } from '../converters/vibration/facility/action-completion-ledger.js';
import { createVibrationActionVerificationLedger } from '../converters/vibration/facility/action-verification-ledger.js';
import { createVibrationMitigationLedger } from '../converters/vibration/mitigation/ledger.js';
import { createVibrationRcaLedger } from '../converters/vibration/rca/ledger.js';

function emptyCompletionDraft() {
  return { actorId: '', reason: '', evidenceRefs: '' };
}

function emptyVerificationDraft() {
  return {
    requirementId: '', requirementType: 'BASIC_MEASUREMENT', requirementReason: '',
    requiredProductTypes: [], includeDisposition: false,
    dispositionId: '', dispositionOutcome: 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT',
    reviewerId: '', dispositionReason: '', sessionIds: [], productIds: [],
  };
}

function emptyRcaDraft() {
  return {
    hypothesisId: '', statement: '',
    evidenceForRecordIds: [], evidenceAgainstRecordIds: [],
    conclusionOutcome: 'NO_CONCLUSION', engineerId: '', conclusionReason: '',
  };
}

export function clearVibrationProjectLifecycleState(state) {
  state.lifecycleProjectId = null;
  state.actionCompletionLedger = createVibrationActionCompletionLedger();
  state.actionCompletionEditor = null;
  state.actionCompletionDraft = emptyCompletionDraft();
  state.actionVerificationLedger = createVibrationActionVerificationLedger();
  state.actionVerificationEditor = null;
  state.actionVerificationDraft = emptyVerificationDraft();
  state.rcaLedger = createVibrationRcaLedger();
  state.rcaEditor = null;
  state.rcaDraft = emptyRcaDraft();
  state.mitigationLedger = createVibrationMitigationLedger();
  return state;
}
