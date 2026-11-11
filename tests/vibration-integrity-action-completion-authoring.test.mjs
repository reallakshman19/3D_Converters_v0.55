import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY,
  buildVibrationActionCompletionAuthoringModel,
  createVibrationActionCompletionUiState,
  openVibrationActionCompletionEditor,
  submitVibrationActionCompletionEditor,
  updateVibrationActionCompletionDraft,
} from '../tabs/vibration-integrity-action-completion-controller.js';
import { renderVibrationActionCompletionPanel } from '../tabs/vibration-integrity-action-completion-view.js';

const REQUIRED = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';

function row(snapshot = 'snapshot-1') {
  return {
    line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1',
    continuationRequired: true,
    screeningCandidateStatus: REQUIRED,
    scenarioExecutionBasis: {
      schema: 'VibrationScenarioExecutionBasis.v1',
      datasetId: 'DATASET-1', scenarioId: 'OS-1', scenarioSnapshotHash: snapshot,
      line: 'L-100', caseId: 'NORMAL',
    },
  };
}

function currentState(runId = 'FIT-RUN-1') {
  return {
    ...createVibrationActionCompletionUiState(),
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

function authorCompletion(state, evidenceRefs = 'REPORT-001') {
  const model = buildVibrationActionCompletionAuthoringModel(state);
  openVibrationActionCompletionEditor(state, model.actions[0].occurrenceId);
  updateVibrationActionCompletionDraft(state, 'actorId', 'ENGINEER-001');
  updateVibrationActionCompletionDraft(state, 'reason', 'Independent detailed assessment reviewed.');
  updateVibrationActionCompletionDraft(state, 'evidenceRefs', evidenceRefs);
  return submitVibrationActionCompletionEditor(state, { recordedAt: '2026-08-21T08:30:00Z' });
}

test('authoring authority is non-engineering and cannot directly mutate lifecycle state', () => {
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.determinesCompleteness, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.determinesGoverningResult, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.directLifecycleMutationAllowed, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORING_AUTHORITY.appendOnlyLedgerRequired, true);
});

test('current OPEN action exposes only COMPLETE and appends a governed record', () => {
  const state = currentState();
  const before = buildVibrationActionCompletionAuthoringModel(state);
  assert.equal(before.enabled, true);
  assert.equal(before.actions.length, 1);
  assert.equal(before.actions[0].nextTransition, 'COMPLETE');
  assert.equal(before.actions[0].nextSequence, 1);

  const record = authorCompletion(state, 'REPORT-001\nMEAS-002');
  assert.equal(record.transition, 'COMPLETE');
  assert.equal(record.sequence, 1);
  assert.deepEqual(record.evidenceRefs, ['REPORT-001', 'MEAS-002']);
  assert.equal(state.actionCompletionLedger.records.length, 1);

  const after = buildVibrationActionCompletionAuthoringModel(state);
  assert.equal(after.actions[0].action.completionState, 'COMPLETED');
  assert.equal(after.actions[0].nextTransition, 'REOPEN');
  assert.equal(after.lifecycle.findings.length, 0);
  assert.equal(after.lifecycle.resolvedFindings.length, 1);
});

test('completed action exposes only REOPEN and append creates sequence 2', () => {
  const state = currentState();
  authorCompletion(state);
  const completed = buildVibrationActionCompletionAuthoringModel(state);
  openVibrationActionCompletionEditor(state, completed.actions[0].occurrenceId);
  assert.equal(state.actionCompletionEditor.transition, 'REOPEN');
  assert.equal(state.actionCompletionEditor.sequence, 2);
  updateVibrationActionCompletionDraft(state, 'actorId', 'ENGINEER-002');
  updateVibrationActionCompletionDraft(state, 'reason', 'New operating evidence requires reassessment.');
  const record = submitVibrationActionCompletionEditor(state, { recordedAt: '2026-08-21T09:30:00Z' });
  assert.equal(record.transition, 'REOPEN');
  assert.equal(state.actionCompletionLedger.records.length, 2);
  const reopened = buildVibrationActionCompletionAuthoringModel(state);
  assert.equal(reopened.actions[0].action.completionState, 'REOPENED');
  assert.equal(reopened.lifecycle.findings[0].state, 'REOPENED_REQUIRED_ACTION');
});

test('COMPLETE without evidence is rejected and ledger remains unchanged', () => {
  const state = currentState();
  const model = buildVibrationActionCompletionAuthoringModel(state);
  openVibrationActionCompletionEditor(state, model.actions[0].occurrenceId);
  updateVibrationActionCompletionDraft(state, 'actorId', 'ENGINEER-001');
  updateVibrationActionCompletionDraft(state, 'reason', 'Attempt without evidence.');
  assert.throws(
    () => submitVibrationActionCompletionEditor(state, { recordedAt: '2026-08-21T08:30:00Z' }),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_EVIDENCE_REQUIRED',
  );
  assert.equal(state.actionCompletionLedger.records.length, 0);
});

test('editor opened on an earlier facility run cannot append after rerun', () => {
  const state = currentState('FIT-RUN-1');
  const model = buildVibrationActionCompletionAuthoringModel(state);
  openVibrationActionCompletionEditor(state, model.actions[0].occurrenceId);
  updateVibrationActionCompletionDraft(state, 'actorId', 'ENGINEER-001');
  updateVibrationActionCompletionDraft(state, 'reason', 'Stale editor attempt.');
  updateVibrationActionCompletionDraft(state, 'evidenceRefs', 'REPORT-001');
  state.runSnapshot = { runId: 'FIT-RUN-2' };
  assert.throws(
    () => submitVibrationActionCompletionEditor(state, { recordedAt: '2026-08-21T08:30:00Z' }),
    (error) => ['VIBRATION_ACTION_COMPLETION_EDITOR_STALE', 'VIBRATION_ACTION_COMPLETION_OCCURRENCE_NOT_CURRENT'].includes(error?.code),
  );
  assert.equal(state.actionCompletionLedger.records.length, 0);
});

test('Activity authoring surface captures actor, reason and evidence without a checkbox state mutation', () => {
  const html = renderVibrationActionCompletionPanel(currentState());
  assert.match(html, /Required action completion/);
  assert.match(html, /data-vi-action-completion-open/);
  assert.doesNotMatch(html, /type="checkbox"/);

  const activity = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-activity-view.js', import.meta.url)), 'utf8');
  const shell = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-user-data-shell.js', import.meta.url)), 'utf8');
  const audit = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-audit-log.js', import.meta.url)), 'utf8');
  const controller = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-action-completion-controller.js', import.meta.url)), 'utf8');
  assert.match(activity, /renderVibrationActionCompletionPanel/);
  assert.match(shell, /createVibrationActionCompletionUiState/);
  assert.match(shell, /handleVibrationActionCompletionClick/);
  assert.match(shell, /handleVibrationActionCompletionChange/);
  assert.match(audit, /ACTION_COMPLETION_RECORDED/);
  assert.doesNotMatch(controller, /state\.[A-Za-z0-9_]*completionState\s*=/);
});
