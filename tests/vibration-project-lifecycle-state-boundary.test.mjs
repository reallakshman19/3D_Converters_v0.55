import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createVibrationActionCompletionRecord,
  createVibrationActionOccurrence,
} from '../converters/vibration/facility/action-completion.js';
import {
  appendVibrationActionCompletionRecord,
  createVibrationActionCompletionLedger,
} from '../converters/vibration/facility/action-completion-ledger.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';
import { createVibrationProjectLifecycleHandoffFromState } from '../tabs/vibration-project-lifecycle-handoff.js';
import { clearVibrationProjectLifecycleState } from '../tabs/vibration-project-lifecycle-state.js';
import { VERIFICATION_SNAPSHOT_HASH } from './vibration-verification-fixtures.mjs';

function completionLedger() {
  const action = {
    schema: 'VibrationRequiredAction.v1',
    actionId: 'ACTION-1',
    mechanismId: 'fit',
    scope: { line: 'L-1', caseId: 'NORMAL', canonicalId: 'CAN-1' },
    module: 'FIT',
    actionKey: 'FURTHER_ASSESSMENT',
    obligation: 'SHALL',
    reason: 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED',
    completionState: 'OPEN',
    resultState: 'CURRENT_RESULT',
    source: { kind: 'FIT_SCREENING_CONTINUATION' },
  };
  const runBasis = createVibrationFacilityRunBasis({
    runId: 'RUN-1', datasetId: 'DATASET-1', scenarioSetKey: 'VFSK1-state-boundary',
  });
  const occurrence = createVibrationActionOccurrence({
    action,
    runBasis,
    scenarioExecutionBasis: {
      datasetId: 'DATASET-1', scenarioId: 'OCS-1',
      scenarioSnapshotHash: VERIFICATION_SNAPSHOT_HASH,
      line: 'L-1', caseId: 'NORMAL',
    },
  });
  const record = createVibrationActionCompletionRecord({
    occurrence,
    sequence: 1,
    transition: 'COMPLETE',
    recordedAt: '2026-09-03T02:30:00Z',
    actorId: 'ENGINEER-1',
    reason: 'Field implementation attested with retained evidence.',
    evidenceRefs: ['FIELD-PACK-001'],
  });
  return appendVibrationActionCompletionRecord(createVibrationActionCompletionLedger(), record);
}

test('M13 lifecycle state cannot be relabelled after project custody is established', () => {
  assert.throws(
    () => createVibrationProjectLifecycleHandoffFromState({
      projectId: 'P-A',
      state: { lifecycleProjectId: 'P-B', actionCompletionLedger: completionLedger() },
    }),
    (error) => error?.code === 'VIBRATION_PROJECT_LIFECYCLE_STATE_PROJECT_MISMATCH',
  );
});

test('non-empty M13 ledger cannot acquire project custody from a caller label alone', () => {
  assert.throws(
    () => createVibrationProjectLifecycleHandoffFromState({
      projectId: 'P-A',
      state: { actionCompletionLedger: completionLedger() },
    }),
    (error) => error?.code === 'VIBRATION_PROJECT_LIFECYCLE_M13_PROJECT_CUSTODY_REQUIRED',
  );
});

test('null-project clear removes lifecycle custody and stale editors without damaging unrelated workspace state', () => {
  const workspace = Object.freeze({ rows: Object.freeze([{ rowKey: 'ROW-1' }]) });
  const auditLog = Object.freeze({ schema: 'sentinel-audit', events: Object.freeze([]) });
  const projectEvidenceHandoff = Object.freeze({ projectId: 'P-A', sentinel: true });
  const state = {
    lifecycleProjectId: 'P-A',
    actionCompletionLedger: completionLedger(),
    actionCompletionEditor: { occurrenceId: 'OCC-1' },
    actionCompletionDraft: { actorId: 'old', reason: 'old', evidenceRefs: 'old' },
    actionVerificationLedger: { records: [{ projectId: 'P-A' }] },
    actionVerificationEditor: { occurrenceId: 'OCC-1' },
    actionVerificationDraft: { requirementId: 'old' },
    rcaLedger: { records: [{ projectId: 'P-A' }] },
    rcaEditor: { occurrenceId: 'OCC-1' },
    rcaDraft: { hypothesisId: 'old' },
    mitigationLedger: { records: [{ projectId: 'P-A' }] },
    workspace,
    auditLog,
    projectEvidenceHandoff,
    resultState: 'CURRENT_RESULT',
  };

  assert.equal(clearVibrationProjectLifecycleState(state), state);
  assert.equal(state.lifecycleProjectId, null);
  assert.equal(state.actionCompletionLedger.records.length, 0);
  assert.equal(state.actionVerificationLedger.records.length, 0);
  assert.equal(state.rcaLedger.records.length, 0);
  assert.equal(state.mitigationLedger.records.length, 0);
  assert.equal(state.actionCompletionEditor, null);
  assert.equal(state.actionVerificationEditor, null);
  assert.equal(state.rcaEditor, null);
  assert.deepEqual(state.actionCompletionDraft, { actorId: '', reason: '', evidenceRefs: '' });
  assert.equal(state.actionVerificationDraft.requirementId, '');
  assert.equal(state.rcaDraft.hypothesisId, '');
  assert.equal(state.workspace, workspace);
  assert.equal(state.auditLog, auditLog);
  assert.equal(state.projectEvidenceHandoff, projectEvidenceHandoff);
  assert.equal(state.resultState, 'CURRENT_RESULT');
});

test('both null-project event paths delegate to the canonical lifecycle clear', () => {
  const source = fs.readFileSync(new URL('../tabs/vibration-integrity-tab.js', import.meta.url), 'utf8');
  const calls = source.match(/clearVibrationProjectLifecycleState\(state\)/gu) ?? [];
  assert.equal(calls.length, 2);
  assert.match(source, /if \(!projectId\) clearVibrationProjectLifecycleState\(state\);/u);
  assert.match(source, /else clearVibrationProjectLifecycleState\(state\);/u);
});
