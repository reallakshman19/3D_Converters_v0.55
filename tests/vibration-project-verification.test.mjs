import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProjectVibrationVerification } from '../converters/vibration/project/verification.js';
import {
  verificationEvidencePackage,
  verificationProject,
  verificationScope,
} from './vibration-verification-fixtures.mjs';

const scope = Object.freeze(verificationScope());

function requirement(id = 'VR-1', overrides = {}) {
  return {
    requirementId: id, scope, mechanismId: 'fit', requirementType: 'BASIC_MEASUREMENT',
    reason: 'Verify field response.', requiredProductTypes: ['FFT'], ...overrides,
  };
}

function disposition(requirementId = 'VR-1', outcome = 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT') {
  return {
    dispositionId: `VD-${requirementId}`, requirementId, scope, mechanismId: 'fit', outcome,
    evidence: { sessionIds: ['MS-1'], productIds: ['SP-2'] },
    review: { reviewerId: 'eng-1', reviewedAt: '2026-08-19T09:00:00Z' },
    reason: 'Reviewed exact-scope FFT.',
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('project projection uses existing measurement package and reports accepted requirement', () => {
  const value = evaluateProjectVibrationVerification(verificationProject(verificationEvidencePackage()), {
    requirements: [requirement()], dispositions: [disposition()],
  });
  assert.equal(value.schema, 'VibrationProjectVerificationProjection.v1');
  assert.equal(value.requirementCount, 1);
  assert.equal(value.results[0].state, 'VERIFICATION_EVIDENCE_ACCEPTED');
  assert.equal(value.countsByState.VERIFICATION_EVIDENCE_ACCEPTED, 1);
  assert.equal(value.authority.persistsVerificationState, false);
});

test('project with no measurement package fails closed to evidence required', () => {
  const value = evaluateProjectVibrationVerification(verificationProject(undefined), {
    requirements: [requirement()],
  });
  assert.equal(value.results[0].state, 'EVIDENCE_REQUIRED');
});

test('requirement cannot reference a line outside the project', () => {
  expectCode(() => evaluateProjectVibrationVerification(verificationProject(verificationEvidencePackage()), {
    requirements: [requirement('VR-X', { scope: verificationScope({ lineId: 'L-X' }) })],
  }), 'VIBRATION_VERIFICATION_DANGLING_PROJECT_LINE');
});

test('orphan disposition is rejected', () => {
  expectCode(() => evaluateProjectVibrationVerification(verificationProject(verificationEvidencePackage()), {
    requirements: [requirement()], dispositions: [disposition('VR-X')],
  }), 'VIBRATION_VERIFICATION_ORPHAN_DISPOSITION');
});

test('multiple current dispositions for one requirement fail closed', () => {
  const first = disposition();
  const second = { ...disposition(), dispositionId: 'VD-2', outcome: 'SPECIALIST_REVIEW_REQUIRED' };
  expectCode(() => evaluateProjectVibrationVerification(verificationProject(verificationEvidencePackage()), {
    requirements: [requirement()], dispositions: [first, second],
  }), 'VIBRATION_VERIFICATION_MULTIPLE_CURRENT_DISPOSITIONS');
});

test('duplicate requirement identities fail closed', () => {
  expectCode(() => evaluateProjectVibrationVerification(verificationProject(verificationEvidencePackage()), {
    requirements: [requirement(), requirement()],
  }), 'VIBRATION_VERIFICATION_DUPLICATE_REQUIREMENT_ID');
});

test('projection does not mutate project or persist lifecycle state', () => {
  const source = verificationProject(verificationEvidencePackage());
  const before = JSON.stringify(source);
  const value = evaluateProjectVibrationVerification(source, { requirements: [requirement()] });
  assert.equal(JSON.stringify(source), before);
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(value.authority.determinesAssessmentCompleteness, false);
  assert.equal(value.authority.rootCauseAuthority, false);
});
