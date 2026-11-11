import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY,
  assertVibrationProjectEvidenceHandoff,
  createVibrationProjectEvidenceHandoff,
} from '../tabs/vibration-project-evidence-handoff.js';
import {
  verificationEvidencePackage,
  verificationProject,
} from './vibration-verification-fixtures.mjs';

const OTHER_HASH = `sha256:${'d'.repeat(64)}`;

test('project evidence handoff is transport-only and retains validated measurement evidence', () => {
  const pkg = verificationEvidencePackage();
  const handoff = createVibrationProjectEvidenceHandoff({
    project: verificationProject(pkg), selectedLineId: 'L-1',
  });
  assert.equal(handoff.schema, 'VibrationProjectEvidenceHandoff.v1');
  assert.equal(handoff.projectId, 'P-1');
  assert.equal(handoff.selectedLineId, 'L-1');
  assert.equal(handoff.measurementEvidence.sessions[0].sessionId, 'MS-1');
  assert.equal(VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY.determinesCompletion, false);
  assert.equal(VIBRATION_PROJECT_EVIDENCE_HANDOFF_AUTHORITY.determinesAssessmentCompleteness, false);
});

test('selected roadmap line must exist in the governed project', () => {
  assert.throws(
    () => createVibrationProjectEvidenceHandoff({
      project: verificationProject(verificationEvidencePackage()), selectedLineId: 'UNKNOWN',
    }),
    (error) => error?.code === 'VIBRATION_PROJECT_EVIDENCE_LINE_INVALID',
  );
});

test('line selection does not rewrite measurement evidence identity', () => {
  const project = verificationProject(verificationEvidencePackage());
  const selected = createVibrationProjectEvidenceHandoff({ project, selectedLineId: 'L-1' });
  const unselected = createVibrationProjectEvidenceHandoff({ project, selectedLineId: null });
  assert.equal(selected.evidenceRevisionKey, unselected.evidenceRevisionKey);
});

test('measurement artifact mutation without matching revision key is rejected', () => {
  const handoff = createVibrationProjectEvidenceHandoff({
    project: verificationProject(verificationEvidencePackage()), selectedLineId: 'L-1',
  });
  const parsed = JSON.parse(JSON.stringify(handoff));
  parsed.measurementEvidence.products[0].artifact.sha256 = OTHER_HASH;
  assert.throws(
    () => assertVibrationProjectEvidenceHandoff(parsed),
    (error) => error?.code === 'VIBRATION_PROJECT_EVIDENCE_REVISION_INVALID',
  );
});

test('calibration or acquisition provenance mutation also invalidates the evidence revision', () => {
  const handoff = createVibrationProjectEvidenceHandoff({
    project: verificationProject(verificationEvidencePackage()), selectedLineId: 'L-1',
  });
  const parsed = JSON.parse(JSON.stringify(handoff));
  parsed.measurementEvidence.sessions[0].channels[0].calibration.certificateId = 'CERT-2';
  assert.throws(
    () => assertVibrationProjectEvidenceHandoff(parsed),
    (error) => error?.code === 'VIBRATION_PROJECT_EVIDENCE_REVISION_INVALID',
  );
});
