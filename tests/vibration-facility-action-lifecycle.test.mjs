import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VIBRATION_FACILITY_ACTION_LIFECYCLE_AUTHORITY,
  buildVibrationFacilityActionLifecycle,
  buildVibrationFacilityRowActionLifecycle,
} from '../converters/vibration/facility/action-lifecycle.js';

const REQUIRED = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';

function row(overrides = {}) {
  return {
    line: 'L-100',
    caseId: 'NORMAL',
    canonicalId: 'CAN-1',
    screeningCandidateStatus: 'QUALIFIED_BOUNDED_SCREENING',
    continuationRequired: false,
    governingReferenceLof: 0.4,
    ...overrides,
  };
}

test('M13 lifecycle is non-numerical, non-completeness and non-blocking authority', () => {
  const lifecycle = buildVibrationFacilityActionLifecycle({ registerRows: [], resultState: 'CURRENT_RESULT' });
  assert.deepEqual(lifecycle.authority, VIBRATION_FACILITY_ACTION_LIFECYCLE_AUTHORITY);
  assert.equal(lifecycle.authority.engineeringAuthority, 'NONE');
  assert.equal(lifecycle.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(lifecycle.authority.determinesApplicability, false);
  assert.equal(lifecycle.authority.determinesCompleteness, false);
  assert.equal(lifecycle.authority.determinesGoverningResult, false);
  assert.equal(lifecycle.authority.blocksCalculation, false);
  assert.equal(lifecycle.authority.blocksPersistence, false);
});

test('explicit qualified FIT continuation creates one SHALL action and one open finding', () => {
  const lifecycle = buildVibrationFacilityRowActionLifecycle(row({
    screeningCandidateStatus: REQUIRED,
    continuationRequired: true,
    governingReferenceLof: 1.2,
  }), { resultState: 'CURRENT_RESULT' });

  assert.equal(lifecycle.currentActions.length, 1);
  assert.equal(lifecycle.findings.length, 1);
  const action = lifecycle.currentActions[0];
  assert.equal(action.schema, 'VibrationRequiredAction.v1');
  assert.equal(action.module, 'FIT');
  assert.equal(action.actionKey, 'FURTHER_ASSESSMENT');
  assert.equal(action.obligation, 'SHALL');
  assert.equal(action.completionState, 'OPEN');
  assert.equal(action.reason, REQUIRED);
  assert.equal(action.source.obligationAuthority, 'CARRIED_FROM_SOURCE_RESULT_ONLY');
  assert.equal(lifecycle.findings[0].state, 'OPEN_REQUIRED_ACTION');
  assert.equal(lifecycle.findings[0].actionId, action.actionId);
});

test('numerical magnitude alone never creates an action or finding', () => {
  const lifecycle = buildVibrationFacilityRowActionLifecycle(row({
    governingReferenceLof: 10,
    screeningCandidateStatus: 'QUALIFIED_BOUNDED_SCREENING',
    continuationRequired: false,
  }), { resultState: 'CURRENT_RESULT' });
  assert.equal(lifecycle.currentActions.length, 0);
  assert.equal(lifecycle.findings.length, 0);
  assert.equal(lifecycle.sourceConflicts.length, 0);
});

test('bare continuation boolean without exact source-result status fails closed', () => {
  const lifecycle = buildVibrationFacilityRowActionLifecycle(row({
    continuationRequired: true,
    screeningCandidateStatus: 'QUALIFIED_BOUNDED_SCREENING',
  }), { resultState: 'CURRENT_RESULT' });
  assert.equal(lifecycle.currentActions.length, 0);
  assert.equal(lifecycle.findings.length, 0);
  assert.equal(lifecycle.sourceConflicts[0].code, 'FIT_CONTINUATION_STATUS_CONFLICT');
});

test('required status without continuation boolean also fails closed', () => {
  const lifecycle = buildVibrationFacilityRowActionLifecycle(row({
    continuationRequired: false,
    screeningCandidateStatus: REQUIRED,
  }), { resultState: 'CURRENT_RESULT' });
  assert.equal(lifecycle.currentActions.length, 0);
  assert.equal(lifecycle.sourceConflicts[0].code, 'FIT_CONTINUATION_STATUS_CONFLICT');
});

test('stale result retains historical required action but cannot create a current finding', () => {
  const lifecycle = buildVibrationFacilityRowActionLifecycle(row({
    continuationRequired: true,
    screeningCandidateStatus: REQUIRED,
  }), { resultState: 'STALE_RESULT' });
  assert.equal(lifecycle.currentActions.length, 0);
  assert.equal(lifecycle.retainedStaleActions.length, 1);
  assert.equal(lifecycle.findings.length, 0);
});

test('facility lifecycle preserves deterministic scope and rejects duplicate required actions', () => {
  const required = row({ continuationRequired: true, screeningCandidateStatus: REQUIRED });
  const second = row({
    line: 'L-200', canonicalId: 'CAN-2', continuationRequired: true,
    screeningCandidateStatus: REQUIRED,
  });
  const lifecycle = buildVibrationFacilityActionLifecycle({
    registerRows: [required, second], resultState: 'CURRENT_RESULT',
  });
  assert.equal(lifecycle.currentActions.length, 2);
  assert.equal(lifecycle.findings.length, 2);
  assert.notEqual(lifecycle.currentActions[0].actionId, lifecycle.currentActions[1].actionId);

  assert.throws(
    () => buildVibrationFacilityActionLifecycle({
      registerRows: [required, { ...required }], resultState: 'CURRENT_RESULT',
    }),
    /Duplicate vibration required action/,
  );
});

test('live register and run evidence consume the same canonical M13 lifecycle', () => {
  const view = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-view.js', import.meta.url)), 'utf8');
  const evidence = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-run-evidence.js', import.meta.url)), 'utf8');
  assert.match(view, /buildVibrationFacilityRowActionLifecycle/);
  assert.match(view, /Required actions \/ findings/);
  assert.doesNotMatch(view, /row\.continuationRequired \? 'Further assessment required'/);
  assert.match(evidence, /buildVibrationFacilityActionLifecycle/);
  assert.match(evidence, /actionLifecycle:/);
});
