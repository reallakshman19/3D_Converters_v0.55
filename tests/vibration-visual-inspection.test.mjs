import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_VISUAL_PACKAGE_AUTHORITY,
  VIBRATION_VISUAL_RECORD_AUTHORITY,
  createVibrationVisualInspectionEvidencePackage,
  createVibrationVisualInspectionRecord,
} from '../converters/vibration/visual-inspection/contracts.js';
import { evaluateVibrationVisualInspectionScope } from '../converters/vibration/visual-inspection/evaluate.js';

const SNAP = `sha256:${'a'.repeat(64)}`;
const ART = `sha256:${'b'.repeat(64)}`;
const scope = Object.freeze({ lineId: 'L-1', caseId: 'NORMAL', operatingCaseSnapshotId: 'OCS-1', operatingCaseSnapshotHash: SNAP });

function record({ inspectionId = 'VI-1', observationState = 'NOT_OBSERVED', observationCode = 'FRETTING_OR_WEAR', scopeOverride = scope } = {}) {
  const note = ['OBSERVED', 'UNRESOLVED'].includes(observationState) ? 'Condition documented for engineer review.' : null;
  return {
    inspectionId, scope: scopeOverride, inspectedAt: '2026-08-19T10:00:00Z',
    inspector: { inspectorId: 'inspector-1', organization: 'Field Team', qualificationRef: 'VISUAL-QA-1' },
    subject: { subjectType: 'SUPPORT_OR_RESTRAINT', subjectId: 'SUP-1' },
    observations: [{ observationId: `${inspectionId}-OBS-1`, code: observationCode, state: observationState, note }],
    evidenceRefs: [{ artifactId: `${inspectionId}.jpg`, sha256: ART, mediaType: 'image/jpeg', immutable: true }],
    source: { source: 'FIELD-WALKDOWN', sourceRevision: 'REV-A', recordId: inspectionId },
  };
}

function pkg(records = [record()]) {
  return { schema: 'VibrationVisualInspectionEvidencePackage.v1', records };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('record fixes non-authorizing visual evidence authority', () => {
  const value = createVibrationVisualInspectionRecord(record());
  assert.equal(value.authority, VIBRATION_VISUAL_RECORD_AUTHORITY);
  assert.equal(value.authority.eiChecklistCoverage, 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE');
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('package fixes non-authorizing container authority', () => {
  const value = createVibrationVisualInspectionEvidencePackage(pkg());
  assert.equal(value.authority, VIBRATION_VISUAL_PACKAGE_AUTHORITY);
  assert.equal(value.authority.rootCauseAuthority, false);
});

test('observed and unresolved conditions require explanatory notes', () => {
  const observed = record({ observationState: 'OBSERVED' });
  observed.observations[0].note = null;
  expectCode(() => createVibrationVisualInspectionRecord(observed), 'VIBRATION_VISUAL_NOTE_REQUIRED');
  const unresolved = record({ observationState: 'UNRESOLVED' });
  unresolved.observations[0].note = '';
  expectCode(() => createVibrationVisualInspectionRecord(unresolved), 'VIBRATION_VISUAL_NOTE_REQUIRED');
});

test('visual artifact refs must be immutable and hash pinned', () => {
  const mutable = record();
  mutable.evidenceRefs[0].immutable = false;
  expectCode(() => createVibrationVisualInspectionRecord(mutable), 'VIBRATION_VISUAL_ARTIFACT_MUTABLE');
  const unhashed = record();
  unhashed.evidenceRefs[0].sha256 = '';
  expectCode(() => createVibrationVisualInspectionRecord(unhashed), 'VIBRATION_VISUAL_HASH_REQUIRED');
});

test('forged visual authority fails closed', () => {
  const value = record();
  value.authority = { ...VIBRATION_VISUAL_RECORD_AUTHORITY, screeningAuthority: 'AUTHORIZED' };
  expectCode(() => createVibrationVisualInspectionRecord(value), 'VIBRATION_VISUAL_AUTHORITY_INVALID');
});

test('duplicate inspection and observation identities fail closed', () => {
  expectCode(() => createVibrationVisualInspectionEvidencePackage(pkg([record(), record()])), 'VIBRATION_VISUAL_DUPLICATE_ID');
  const duplicateObservation = record();
  duplicateObservation.observations.push({ ...duplicateObservation.observations[0] });
  expectCode(() => createVibrationVisualInspectionRecord(duplicateObservation), 'VIBRATION_VISUAL_DUPLICATE_ID');
});

test('scope evaluator distinguishes recorded evidence from conditions requiring review', () => {
  const clear = evaluateVibrationVisualInspectionScope({ scope, evidence: pkg([record()]) });
  assert.equal(clear.state, 'VISUAL_EVIDENCE_RECORDED');
  assert.equal(clear.engineerReviewRequired, false);
  const observed = evaluateVibrationVisualInspectionScope({ scope, evidence: pkg([record({ observationState: 'OBSERVED' })]) });
  assert.equal(observed.state, 'OBSERVED_CONDITIONS_REQUIRE_REVIEW');
  assert.equal(observed.engineerReviewRequired, true);
  assert.equal(observed.authority.rootCauseAuthority, false);
});

test('unresolved takes precedence over not-inspected and observed states', () => {
  const records = [
    record({ inspectionId: 'VI-1', observationState: 'OBSERVED' }),
    record({ inspectionId: 'VI-2', observationState: 'NOT_INSPECTED' }),
    record({ inspectionId: 'VI-3', observationState: 'UNRESOLVED' }),
  ];
  const value = evaluateVibrationVisualInspectionScope({ scope, evidence: pkg(records) });
  assert.equal(value.state, 'UNRESOLVED_VISUAL_OBSERVATIONS');
  assert.equal(value.countsByObservationState.UNRESOLVED, 1);
});

test('wrong exact scope does not appear as visual evidence for requested scope', () => {
  const other = { ...scope, caseId: 'STARTUP' };
  const value = evaluateVibrationVisualInspectionScope({ scope, evidence: pkg([record({ scopeOverride: other })]) });
  assert.equal(value.state, 'NO_VISUAL_EVIDENCE');
  assert.equal(value.observationCount, 0);
});

test('scope evaluator rejects malformed operating-case snapshot hash', () => {
  const malformed = { ...scope, operatingCaseSnapshotHash: 'not-a-canonical-hash' };
  expectCode(() => evaluateVibrationVisualInspectionScope({ scope: malformed, evidence: pkg() }), 'VIBRATION_VISUAL_HASH_REQUIRED');
});
