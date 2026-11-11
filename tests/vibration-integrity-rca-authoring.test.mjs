import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertVibrationActionVerificationLedger } from '../converters/vibration/facility/action-verification-ledger.js';
import { createVibrationActionCompletionUiState } from '../tabs/vibration-integrity-action-completion-controller.js';
import {
  buildVibrationActionVerificationAuthoringModel,
  createVibrationActionVerificationUiState,
  openVibrationActionVerificationEditor,
  setVibrationActionVerificationProjectEvidence,
  submitVibrationActionVerificationEditor,
  toggleVibrationActionVerificationSelection,
  updateVibrationActionVerificationDraft,
} from '../tabs/vibration-integrity-action-verification-controller.js';
import {
  VIBRATION_RCA_AUTHORING_AUTHORITY,
  buildVibrationRcaAuthoringModel,
  openVibrationRcaEditor,
  submitVibrationRcaEditor,
  toggleVibrationRcaEvidence,
  updateVibrationRcaDraft,
} from '../tabs/vibration-integrity-rca-controller.js';
import { assertVibrationRcaHypothesis } from '../converters/vibration/rca/contracts.js';
import { createVibrationProjectEvidenceHandoff } from '../tabs/vibration-project-evidence-handoff.js';
import {
  verificationEvidencePackage,
  verificationProject,
  verificationScope,
} from './vibration-verification-fixtures.mjs';

const REQUIRED = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';
const OTHER_SHA = `sha256:${'9'.repeat(64)}`;

function row() {
  const scope = verificationScope();
  return {
    line: scope.lineId, caseId: scope.caseId, canonicalId: 'CAN-1',
    continuationRequired: true,
    screeningCandidateStatus: REQUIRED,
    scenarioExecutionBasis: {
      schema: 'VibrationScenarioExecutionBasis.v1',
      datasetId: 'DATASET-1', scenarioId: scope.operatingCaseSnapshotId,
      scenarioSnapshotHash: scope.operatingCaseSnapshotHash,
      line: scope.lineId, caseId: scope.caseId,
    },
  };
}

function handoff(projectId = 'P-1') {
  const project = verificationProject(verificationEvidencePackage());
  project.project = { ...project.project, projectId };
  return createVibrationProjectEvidenceHandoff({ project, selectedLineId: 'L-1' });
}

function currentState() {
  return {
    ...createVibrationActionCompletionUiState(),
    ...createVibrationActionVerificationUiState(handoff()),
    resultState: 'CURRENT_RESULT',
    runSnapshot: { runId: 'FIT-RUN-1' },
    envelope: {
      workflow: {
        result: { datasetId: 'DATASET-1', scenarioSetKey: 'VFSK1-example' },
        register: { rows: [row()] },
      },
    },
    error: null,
  };
}

function recordVerification(state, { accepted = false, requirementId = 'VERIFY-1' } = {}) {
  const model = buildVibrationActionVerificationAuthoringModel(state);
  openVibrationActionVerificationEditor(state, model.actions[0].occurrenceId);
  updateVibrationActionVerificationDraft(state, 'requirementId', requirementId);
  updateVibrationActionVerificationDraft(state, 'requirementReason', 'Field evidence for vibration investigation.');
  toggleVibrationActionVerificationSelection(state, 'requiredProductTypes', 'OVERALL', true);
  if (accepted) {
    updateVibrationActionVerificationDraft(state, 'includeDisposition', true);
    updateVibrationActionVerificationDraft(state, 'dispositionId', `DISP-${requirementId}`);
    updateVibrationActionVerificationDraft(state, 'reviewerId', 'ENGINEER-VERIFIER');
    updateVibrationActionVerificationDraft(state, 'dispositionReason', 'Required field product reviewed and accepted.');
    toggleVibrationActionVerificationSelection(state, 'sessionIds', 'MS-1', true);
    toggleVibrationActionVerificationSelection(state, 'productIds', 'SP-1', true);
  }
  submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T13:00:00Z' });
  return state.actionVerificationLedger.records.at(-1);
}

function populateRca(state, verificationRecord, { outcome = 'NO_CONCLUSION' } = {}) {
  const model = buildVibrationRcaAuthoringModel(state);
  openVibrationRcaEditor(state, model.actions[0].occurrenceId);
  updateVibrationRcaDraft(state, 'hypothesisId', 'RCA-HYP-1');
  updateVibrationRcaDraft(state, 'statement', 'Broadband vibration is driven by the assessed flow-related excitation mechanism.');
  toggleVibrationRcaEvidence(state, 'FOR', verificationRecord.recordId, true);
  updateVibrationRcaDraft(state, 'conclusionOutcome', outcome);
  if (outcome !== 'NO_CONCLUSION') {
    updateVibrationRcaDraft(state, 'engineerId', 'ENGINEER-RCA');
    updateVibrationRcaDraft(state, 'conclusionReason', 'Evidence reviewed against the stated physical hypothesis.');
  }
}

test('M15 RCA authoring cannot autonomously create engineering, screening, design or completion authority', () => {
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.completionAuthority, 'NONE');
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.rootCauseAuthority, 'EXPLICIT_ENGINEER_ATTESTATION_ONLY');
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.platformRootCauseInference, false);
  assert.equal(VIBRATION_RCA_AUTHORING_AUTHORITY.autoConfirmAllowed, false);
});

test('RCA is unavailable until exact project-scoped verification evidence exists', () => {
  const state = currentState();
  const model = buildVibrationRcaAuthoringModel(state);
  assert.equal(model.actions[0].authorable, false);
  assert.equal(model.actions[0].verificationRecords.length, 0);
});

test('M15 source record is V2 and cryptographically binds verification disposition/status custody', () => {
  const state = currentState();
  const record = recordVerification(state, { accepted: true });
  assert.equal(record.attachment.schema, 'VibrationActionVerificationAttachment.v2');
  assert.match(record.attachment.verificationStatusFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(record.attachment.attachmentId, /sha256:/u);
});

test('semantic verification-state tamper is rejected before RCA can consume the ledger', () => {
  const state = currentState();
  recordVerification(state, { accepted: true });
  const parsed = JSON.parse(JSON.stringify(state.actionVerificationLedger));
  parsed.records[0].attachment.verificationStatus.state = 'AWAITING_ENGINEER_DISPOSITION';
  assert.throws(
    () => assertVibrationActionVerificationLedger(parsed),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_STATUS_STATE_MISMATCH',
  );
});

test('coherent disposition/state rewrite still fails the bound status fingerprint', () => {
  const state = currentState();
  recordVerification(state, { accepted: true });
  const parsed = JSON.parse(JSON.stringify(state.actionVerificationLedger));
  parsed.records[0].attachment.verificationStatus.disposition.outcome = 'EVIDENCE_INSUFFICIENT';
  parsed.records[0].attachment.verificationStatus.state = 'EVIDENCE_INSUFFICIENT';
  assert.throws(
    () => assertVibrationActionVerificationLedger(parsed),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_STATUS_FINGERPRINT_INVALID',
  );
});

test('evidence-linked hypothesis can remain open without claiming root cause', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state);
  populateRca(state, verificationRecord);
  const hypothesis = submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:10:00Z' });
  assert.equal(hypothesis.state, 'HYPOTHESIS_OPEN');
  assert.equal(hypothesis.conclusion, null);
  assert.match(hypothesis.evidence[0].verificationStatusFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(state.rcaLedger.records.length, 1);
  assert.equal(state.actionCompletionLedger.records.length, 0);
});

test('confirmed root cause fails closed without accepted supporting verification evidence', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: false });
  populateRca(state, verificationRecord, { outcome: 'CONFIRMED_ROOT_CAUSE' });
  assert.throws(
    () => submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:15:00Z' }),
    (error) => error?.code === 'VIBRATION_RCA_ACCEPTED_EVIDENCE_REQUIRED',
  );
  assert.equal(state.rcaLedger, undefined);
});

test('explicit engineer conclusion may confirm root cause only with accepted supporting verification evidence', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord, { outcome: 'CONFIRMED_ROOT_CAUSE' });
  const hypothesis = submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:20:00Z' });
  assert.equal(hypothesis.conclusion.outcome, 'CONFIRMED_ROOT_CAUSE');
  assert.equal(hypothesis.conclusion.engineerId, 'ENGINEER-RCA');
  assert.equal(hypothesis.authority.platformRootCauseInference, false);
  assert.equal(state.actionCompletionLedger.records.length, 0);
});

test('open hypothesis can later receive an immutable engineer-conclusion revision', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord);
  submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:21:00Z' });
  populateRca(state, verificationRecord, { outcome: 'CONFIRMED_ROOT_CAUSE' });
  submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:22:00Z' });
  assert.equal(state.rcaLedger.records.length, 2);
  assert.equal(state.rcaLedger.records[0].hypothesisRevision, 1);
  assert.equal(state.rcaLedger.records[0].hypothesis.state, 'HYPOTHESIS_OPEN');
  assert.equal(state.rcaLedger.records[1].hypothesisRevision, 2);
  assert.equal(state.rcaLedger.records[1].hypothesis.conclusion.outcome, 'CONFIRMED_ROOT_CAUSE');
});

test('a concluded hypothesis cannot be anonymously downgraded back to open', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord, { outcome: 'CONFIRMED_ROOT_CAUSE' });
  submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:23:00Z' });
  populateRca(state, verificationRecord);
  assert.throws(
    () => submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:24:00Z' }),
    (error) => error?.code === 'VIBRATION_RCA_LEDGER_CONCLUSION_ATTESTATION_REQUIRED',
  );
  assert.equal(state.rcaLedger.records.length, 1);
});

test('the same verification record cannot be evidence both for and against', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord);
  toggleVibrationRcaEvidence(state, 'AGAINST', verificationRecord.recordId, true);
  assert.throws(
    () => submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:25:00Z' }),
    (error) => error?.code === 'VIBRATION_RCA_EVIDENCE_CONFLICT',
  );
});

test('RCA editor stales when verification evidence changes after opening', () => {
  const state = currentState();
  const first = recordVerification(state, { accepted: true, requirementId: 'VERIFY-1' });
  populateRca(state, first);
  recordVerification(state, { accepted: true, requirementId: 'VERIFY-2' });
  assert.throws(
    () => submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:30:00Z' }),
    (error) => error?.code === 'VIBRATION_RCA_EDITOR_STALE',
  );
});

test('RCA history and evidence do not cross project identity', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord);
  submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:35:00Z' });
  setVibrationActionVerificationProjectEvidence(state, handoff('P-2'));
  const model = buildVibrationRcaAuthoringModel(state);
  assert.equal(model.actions[0].verificationRecords.length, 0);
  assert.equal(model.actions[0].rcaRecords.length, 0);
  assert.equal(model.actions[0].authorable, false);
});

test('RCA hypothesis fingerprint rejects post-creation evidence/conclusion custody drift', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord, { outcome: 'CONTRIBUTING_FACTOR' });
  const hypothesis = submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:40:00Z' });
  const parsed = JSON.parse(JSON.stringify(hypothesis));
  parsed.statement = 'Tampered hypothesis statement';
  assert.throws(
    () => assertVibrationRcaHypothesis(parsed),
    (error) => error?.code === 'VIBRATION_RCA_HYPOTHESIS_FINGERPRINT_INVALID',
  );
});

test('RCA evidence requires a canonical verification-status fingerprint', () => {
  const state = currentState();
  const verificationRecord = recordVerification(state, { accepted: true });
  populateRca(state, verificationRecord);
  const hypothesis = submitVibrationRcaEditor(state, { recordedAt: '2026-08-21T13:45:00Z' });
  const parsed = JSON.parse(JSON.stringify(hypothesis));
  parsed.evidence[0].verificationStatusFingerprint = 'NOT-A-HASH';
  assert.throws(
    () => assertVibrationRcaHypothesis(parsed),
    (error) => error?.code === 'VIBRATION_RCA_VERIFICATION_STATUS_FINGERPRINT_INVALID',
  );
  parsed.evidence[0].verificationStatusFingerprint = OTHER_SHA;
  assert.throws(
    () => assertVibrationRcaHypothesis(parsed),
    (error) => error?.code === 'VIBRATION_RCA_HYPOTHESIS_FINGERPRINT_INVALID',
  );
});

test('Activity wiring places RCA after verification and before explicit completion, and M14 audit reads the real evidence field', () => {
  const activity = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-activity-view.js', import.meta.url)), 'utf8');
  const verification = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-action-verification-controller.js', import.meta.url)), 'utf8');
  assert.ok(activity.indexOf('renderVibrationActionVerificationPanel(state)') < activity.indexOf('renderVibrationRcaPanel(state)'));
  assert.ok(activity.indexOf('renderVibrationRcaPanel(state)') < activity.indexOf('renderVibrationActionCompletionPanel(state)'));
  assert.match(verification, /handleVibrationRcaClick/);
  assert.match(verification, /handleVibrationRcaChange/);
  assert.match(verification, /attachment\.evidence\.sessions\.length/);
  assert.doesNotMatch(verification, /attachment\.evidenceSnapshot/);
});
