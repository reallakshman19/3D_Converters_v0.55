import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVibrationActionCompletionAuthoringModel, createVibrationActionCompletionUiState } from '../tabs/vibration-integrity-action-completion-controller.js';
import {
  VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY,
  buildVibrationActionVerificationAuthoringModel,
  createVibrationActionVerificationUiState,
  openVibrationActionVerificationEditor,
  setVibrationActionVerificationProjectEvidence,
  submitVibrationActionVerificationEditor,
  toggleVibrationActionVerificationSelection,
  updateVibrationActionVerificationDraft,
} from '../tabs/vibration-integrity-action-verification-controller.js';
import { createVibrationProjectEvidenceHandoff } from '../tabs/vibration-project-evidence-handoff.js';
import {
  VERIFICATION_SNAPSHOT_HASH,
  verificationEvidencePackage,
  verificationProject,
  verificationScope,
} from './vibration-verification-fixtures.mjs';

const REQUIRED = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';

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

function handoff(pkg = verificationEvidencePackage(), projectId = 'P-1') {
  const project = verificationProject(pkg);
  project.project = { ...project.project, projectId };
  return createVibrationProjectEvidenceHandoff({ project, selectedLineId: 'L-1' });
}

function currentState(projectEvidence = handoff(), runId = 'FIT-RUN-1') {
  return {
    ...createVibrationActionCompletionUiState(),
    ...createVibrationActionVerificationUiState(projectEvidence),
    resultState: 'CURRENT_RESULT',
    runSnapshot: { runId },
    envelope: {
      workflow: {
        result: { datasetId: 'DATASET-1', scenarioSetKey: 'VFSK1-example' },
        register: { rows: [row()] },
      },
    },
    error: null,
  };
}

function populateRequirement(state, { disposition = false, requirementId = 'VERIFY-1' } = {}) {
  const model = buildVibrationActionVerificationAuthoringModel(state);
  openVibrationActionVerificationEditor(state, model.actions[0].occurrenceId);
  updateVibrationActionVerificationDraft(state, 'requirementId', requirementId);
  updateVibrationActionVerificationDraft(state, 'requirementReason', 'Confirm field response before closing the required action.');
  toggleVibrationActionVerificationSelection(state, 'requiredProductTypes', 'OVERALL', true);
  if (disposition) {
    updateVibrationActionVerificationDraft(state, 'includeDisposition', true);
    updateVibrationActionVerificationDraft(state, 'dispositionId', `DISP-${requirementId}`);
    updateVibrationActionVerificationDraft(state, 'reviewerId', 'ENGINEER-002');
    updateVibrationActionVerificationDraft(state, 'dispositionReason', 'Required field product reviewed.');
    toggleVibrationActionVerificationSelection(state, 'sessionIds', 'MS-1', true);
    toggleVibrationActionVerificationSelection(state, 'productIds', 'SP-1', true);
  }
}

test('M14 Activity authoring has no screening, completion, completeness or design authority', () => {
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.completionAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.determinesCompletion, false);
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORING_AUTHORITY.determinesAssessmentCompleteness, false);
});

test('only exact scenario-scope project evidence is selectable for the current action occurrence', () => {
  const state = currentState();
  const model = buildVibrationActionVerificationAuthoringModel(state);
  assert.equal(model.enabled, true);
  assert.deepEqual(model.actions[0].sessions.map((item) => item.sessionId), ['MS-1']);
  assert.deepEqual(model.actions[0].products.map((item) => item.productId), ['SP-1', 'SP-2']);
  const wrong = verificationEvidencePackage({
    scope: verificationScope({ operatingCaseSnapshotHash: `sha256:${'e'.repeat(64)}` }),
  });
  setVibrationActionVerificationProjectEvidence(state, handoff(wrong));
  const mismatched = buildVibrationActionVerificationAuthoringModel(state);
  assert.equal(mismatched.actions[0].sessions.length, 0);
  assert.equal(mismatched.actions[0].products.length, 0);
});

test('measurement can be attached before disposition and action remains OPEN', () => {
  const state = currentState();
  populateRequirement(state);
  const attachment = submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:00:00Z' });
  assert.equal(attachment.verificationStatus.state, 'AWAITING_ENGINEER_DISPOSITION');
  assert.equal(state.actionVerificationLedger.records.length, 1);
  assert.equal(state.actionVerificationLedger.records[0].projectId, 'P-1');
  assert.equal(state.actionCompletionLedger.records.length, 0);
  assert.equal(buildVibrationActionCompletionAuthoringModel(state).actions[0].action.completionState, 'OPEN');
});

test('accepted engineer disposition is recorded but cannot auto-complete the action', () => {
  const state = currentState();
  populateRequirement(state, { disposition: true });
  const attachment = submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:15:00Z' });
  assert.equal(attachment.verificationStatus.state, 'VERIFICATION_EVIDENCE_ACCEPTED');
  assert.deepEqual(attachment.verificationStatus.disposition.evidence.productIds, ['SP-1']);
  assert.equal(state.actionVerificationLedger.records[0].projectId, 'P-1');
  assert.equal(state.actionCompletionLedger.records.length, 0);
  assert.equal(buildVibrationActionCompletionAuthoringModel(state).actions[0].action.completionState, 'OPEN');
});

test('verification history is project-scoped even for an identical facility occurrence and evidence', () => {
  const state = currentState(handoff(verificationEvidencePackage(), 'P-1'));
  populateRequirement(state, { requirementId: 'VERIFY-P1' });
  const first = submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:05:00Z' });
  assert.equal(buildVibrationActionVerificationAuthoringModel(state).actions[0].attachmentCount, 1);
  setVibrationActionVerificationProjectEvidence(state, handoff(verificationEvidencePackage(), 'P-2'));
  const p2Before = buildVibrationActionVerificationAuthoringModel(state);
  assert.equal(p2Before.actions[0].attachmentCount, 0);
  assert.equal(p2Before.actions[0].latestRecord, null);
  populateRequirement(state, { requirementId: 'VERIFY-P1' });
  const second = submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:06:00Z' });
  assert.equal(first.attachmentId, second.attachmentId);
  assert.deepEqual(state.actionVerificationLedger.records.map((record) => record.projectId), ['P-1', 'P-2']);
  assert.equal(buildVibrationActionVerificationAuthoringModel(state).actions[0].attachmentCount, 1);
});

test('accepted disposition without explicit required product reference fails and ledger is unchanged', () => {
  const state = currentState();
  populateRequirement(state, { disposition: true });
  toggleVibrationActionVerificationSelection(state, 'productIds', 'SP-1', false);
  assert.throws(
    () => submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:15:00Z' }),
    (error) => error?.code === 'VIBRATION_VERIFICATION_ACCEPTANCE_REFERENCES_INCOMPLETE',
  );
  assert.equal(state.actionVerificationLedger.records.length, 0);
});

test('editor cannot append after project measurement evidence revision changes', () => {
  const state = currentState();
  populateRequirement(state);
  const changed = verificationEvidencePackage();
  changed.products[0] = {
    ...changed.products[0],
    artifact: { ...changed.products[0].artifact, sha256: `sha256:${'f'.repeat(64)}` },
  };
  setVibrationActionVerificationProjectEvidence(state, handoff(changed));
  assert.throws(
    () => submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:30:00Z' }),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_EDITOR_STALE',
  );
  assert.equal(state.actionVerificationLedger.records.length, 0);
});

test('editor cannot append after project identity changes even with identical evidence', () => {
  const state = currentState();
  populateRequirement(state);
  setVibrationActionVerificationProjectEvidence(state, handoff(verificationEvidencePackage(), 'P-2'));
  assert.throws(
    () => submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:30:00Z' }),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_EDITOR_STALE',
  );
  assert.equal(state.actionVerificationLedger.records.length, 0);
});

test('editor cannot append after identical-scenario facility rerun changes runId', () => {
  const state = currentState();
  populateRequirement(state);
  state.runSnapshot = { runId: 'FIT-RUN-2' };
  assert.throws(
    () => submitVibrationActionVerificationEditor(state, { recordedAt: '2026-08-21T11:30:00Z' }),
    (error) => ['VIBRATION_ACTION_VERIFICATION_EDITOR_STALE', 'VIBRATION_ACTION_VERIFICATION_OCCURRENCE_NOT_CURRENT'].includes(error?.code),
  );
  assert.equal(state.actionVerificationLedger.records.length, 0);
});

test('product wiring transports project evidence and renders verification before explicit completion', () => {
  const engineering = readFileSync(fileURLToPath(new URL('../tabs/engineering-calculations-tab.js', import.meta.url)), 'utf8');
  const integrity = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-tab.js', import.meta.url)), 'utf8');
  const activity = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-activity-view.js', import.meta.url)), 'utf8');
  const controller = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-action-verification-controller.js', import.meta.url)), 'utf8');
  const audit = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-audit-log.js', import.meta.url)), 'utf8');
  assert.match(engineering, /VIBRATION_PROJECT_CHANGED_EVENT/);
  assert.match(engineering, /VIBRATION_PROJECT_EVIDENCE_HANDOFF_EVENT/);
  assert.match(integrity, /VIBRATION_PROJECT_EVIDENCE_HANDOFF_EVENT/);
  assert.match(integrity, /handleVibrationActionVerificationClick/);
  assert.match(integrity, /handleVibrationActionVerificationChange/);
  assert.ok(activity.indexOf('renderVibrationActionVerificationPanel') < activity.indexOf('renderVibrationActionCompletionPanel(state)'));
  assert.match(audit, /ACTION_VERIFICATION_RECORDED/);
  assert.doesNotMatch(controller, /createVibrationActionCompletionRecord|appendVibrationActionCompletionRecord/);
});

test('fixture remains bound to canonical verification snapshot hash', () => {
  assert.equal(row().scenarioExecutionBasis.scenarioSnapshotHash, VERIFICATION_SNAPSHOT_HASH);
});
