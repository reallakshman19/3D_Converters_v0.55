import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VIBRATION_ACTION_COMPLETION_AUTHORITY,
  createVibrationActionCompletionRecord,
} from '../converters/vibration/facility/action-completion.js';
import {
  appendVibrationActionCompletionRecord,
  createVibrationActionCompletionLedger,
} from '../converters/vibration/facility/action-completion-ledger.js';
import {
  buildVibrationFacilityRowActionLifecycle,
} from '../converters/vibration/facility/action-lifecycle.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';

const REQUIRED = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';

function runBasis(runId = 'FIT-RUN-1') {
  return createVibrationFacilityRunBasis({
    runId,
    datasetId: 'DATASET-1',
    scenarioSetKey: 'VFSK1-example',
  });
}

function row(overrides = {}) {
  return {
    line: 'L-100',
    caseId: 'NORMAL',
    canonicalId: 'CAN-1',
    screeningCandidateStatus: REQUIRED,
    continuationRequired: true,
    scenarioExecutionBasis: {
      schema: 'VibrationScenarioExecutionBasis.v1',
      scenarioId: 'OS-1',
      scenarioSnapshotHash: 'snapshot-1',
      datasetId: 'DATASET-1',
      line: 'L-100',
      caseId: 'NORMAL',
    },
    ...overrides,
  };
}

function openLifecycle(options = {}) {
  return buildVibrationFacilityRowActionLifecycle(row(options.row), {
    resultState: 'CURRENT_RESULT',
    runBasis: options.runBasis ?? runBasis(),
    completionRecords: options.completionRecords ?? [],
  });
}

function completeRecord(occurrence, overrides = {}) {
  return createVibrationActionCompletionRecord({
    occurrence,
    sequence: 1,
    transition: 'COMPLETE',
    recordedAt: '2026-08-21T08:00:00Z',
    actorId: 'ENGINEER-001',
    reason: 'Detailed assessment evidence reviewed.',
    evidenceRefs: ['REPORT-001'],
    ...overrides,
  });
}

test('completion custody has no engineering, screening, design or governing authority', () => {
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.persistenceAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.completionAuthority, 'CALLER_ATTESTATION_ONLY');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.storageSemantics, 'APPEND_ONLY_RECORD_CONTRACT');
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.determinesCompleteness, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.determinesGoverningResult, false);
  assert.equal(VIBRATION_ACTION_COMPLETION_AUTHORITY.blocksCalculation, false);
});

test('append-only ledger admits only the next legal occurrence transition', () => {
  const action = openLifecycle().currentActions[0];
  const completion = completeRecord(action.occurrence);
  const reopen = createVibrationActionCompletionRecord({
    occurrence: action.occurrence,
    sequence: 2,
    transition: 'REOPEN',
    recordedAt: '2026-08-21T09:00:00Z',
    actorId: 'ENGINEER-002',
    reason: 'New evidence requires reassessment.',
    evidenceRefs: [],
  });
  let ledger = createVibrationActionCompletionLedger();
  ledger = appendVibrationActionCompletionRecord(ledger, completion);
  ledger = appendVibrationActionCompletionRecord(ledger, reopen);
  assert.equal(ledger.records.length, 2);
  assert.equal(ledger.records[0].transition, 'COMPLETE');
  assert.equal(ledger.records[1].transition, 'REOPEN');
  assert.throws(
    () => appendVibrationActionCompletionRecord(ledger, completion),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_LEDGER_SEQUENCE_GAP',
  );
  const illegalThird = createVibrationActionCompletionRecord({
    occurrence: action.occurrence,
    sequence: 3,
    transition: 'REOPEN',
    recordedAt: '2026-08-21T10:00:00Z',
    actorId: 'ENGINEER-003',
    reason: 'Illegal repeated reopen.',
    evidenceRefs: [],
  });
  assert.throws(
    () => appendVibrationActionCompletionRecord(ledger, illegalThird),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_LEDGER_ILLEGAL_TRANSITION',
  );
});

test('exact completion record closes the current finding but does not remove the source action', () => {
  const open = openLifecycle();
  const action = open.currentActions[0];
  assert.equal(action.completionState, 'OPEN');
  assert.equal(open.findings[0].state, 'OPEN_REQUIRED_ACTION');
  assert.ok(action.occurrence?.occurrenceId);

  const completion = completeRecord(action.occurrence);
  const completed = openLifecycle({ completionRecords: [completion] });
  assert.equal(completed.currentActions.length, 1);
  assert.equal(completed.currentActions[0].completionState, 'COMPLETED');
  assert.equal(completed.currentActions[0].completionHistory.length, 1);
  assert.equal(completed.findings.length, 0);
  assert.equal(completed.resolvedFindings.length, 1);
  assert.equal(completed.resolvedFindings[0].state, 'CLOSED_COMPLETED_ACTION');
  assert.equal(completed.summary.appliedCompletionRecordCount, 1);
});

test('reopen transition restores an unresolved finding with append-only history', () => {
  const action = openLifecycle().currentActions[0];
  const completion = completeRecord(action.occurrence);
  const reopen = createVibrationActionCompletionRecord({
    occurrence: action.occurrence,
    sequence: 2,
    transition: 'REOPEN',
    recordedAt: '2026-08-21T09:00:00Z',
    actorId: 'ENGINEER-002',
    reason: 'New operating evidence requires reassessment.',
    evidenceRefs: [],
  });
  const lifecycle = openLifecycle({ completionRecords: [completion, reopen] });
  assert.equal(lifecycle.currentActions[0].completionState, 'REOPENED');
  assert.equal(lifecycle.currentActions[0].completionHistory.length, 2);
  assert.equal(lifecycle.findings.length, 1);
  assert.equal(lifecycle.findings[0].state, 'REOPENED_REQUIRED_ACTION');
  assert.equal(lifecycle.resolvedFindings.length, 0);
});

test('completion requires evidence and transition history is strictly ordered', () => {
  const action = openLifecycle().currentActions[0];
  assert.throws(
    () => completeRecord(action.occurrence, { evidenceRefs: [] }),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_EVIDENCE_REQUIRED',
  );
  const illegalReopen = createVibrationActionCompletionRecord({
    occurrence: action.occurrence,
    sequence: 1,
    transition: 'REOPEN',
    recordedAt: '2026-08-21T09:00:00Z',
    actorId: 'ENGINEER-002',
    reason: 'Invalid first transition.',
    evidenceRefs: [],
  });
  assert.throws(
    () => openLifecycle({ completionRecords: [illegalReopen] }),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_ILLEGAL_TRANSITION',
  );
  const sequenceTwo = completeRecord(action.occurrence, { sequence: 2 });
  assert.throws(
    () => openLifecycle({ completionRecords: [sequenceTwo] }),
    (error) => error?.code === 'VIBRATION_ACTION_COMPLETION_SEQUENCE_GAP',
  );
});

test('completion from an identical prior run cannot close the new run action', () => {
  const run1 = openLifecycle({ runBasis: runBasis('FIT-RUN-1') });
  const completion = completeRecord(run1.currentActions[0].occurrence);
  const run2 = openLifecycle({
    runBasis: runBasis('FIT-RUN-2'),
    completionRecords: [completion],
  });
  assert.equal(run2.currentActions[0].actionId, run1.currentActions[0].actionId);
  assert.notEqual(run2.currentActions[0].occurrence.occurrenceId, run1.currentActions[0].occurrence.occurrenceId);
  assert.equal(run2.currentActions[0].completionState, 'OPEN');
  assert.equal(run2.findings.length, 1);
  assert.equal(run2.foreignCompletionRecords.length, 1);
  assert.equal(run2.foreignCompletionRecords[0].reason, 'ACTION_OCCURRENCE_MISMATCH');
});

test('scenario snapshot drift also creates a different action occurrence', () => {
  const first = openLifecycle();
  const completion = completeRecord(first.currentActions[0].occurrence);
  const changed = openLifecycle({
    row: {
      scenarioExecutionBasis: {
        ...row().scenarioExecutionBasis,
        scenarioSnapshotHash: 'snapshot-2',
      },
    },
    completionRecords: [completion],
  });
  assert.equal(changed.currentActions[0].completionState, 'OPEN');
  assert.equal(changed.foreignCompletionRecords.length, 1);
});

test('run-evidence path requires the governed append-only completion ledger', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../tabs/vibration-integrity-run-evidence.js', import.meta.url)),
    'utf8',
  );
  assert.match(source, /createVibrationFacilityRunBasis/);
  assert.match(source, /runId: snapshot\.runId/);
  assert.match(source, /createVibrationActionCompletionLedger/);
  assert.match(source, /assertVibrationActionCompletionLedger/);
  assert.match(source, /state\.actionCompletionLedger/);
  assert.match(source, /completionRecords: ledger\.records/);
  assert.doesNotMatch(source, /state\.actionCompletionRecords/);
  assert.doesNotMatch(source, /completionState\s*=\s*['"]COMPLETED['"]/);
});
