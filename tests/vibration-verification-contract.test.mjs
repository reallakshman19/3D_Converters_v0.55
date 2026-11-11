import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_MEASUREMENT_DISPOSITION_AUTHORITY,
  VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY,
  createVibrationVerificationRequirement,
} from '../converters/vibration/verification/contracts.js';
import { evaluateVibrationVerification } from '../converters/vibration/verification/evaluate.js';
import {
  measurementSession,
  verificationEvidencePackage,
  verificationScope,
} from './vibration-verification-fixtures.mjs';

const OTHER = `sha256:${'d'.repeat(64)}`;
const scope = Object.freeze(verificationScope());

function requirement(overrides = {}) {
  return {
    requirementId: 'VR-1', scope, mechanismId: 'mechanicalExcitation',
    requirementType: 'BASIC_MEASUREMENT', reason: 'Confirm vibration response at operating case.',
    requiredProductTypes: ['OVERALL', 'FFT'], ...overrides,
  };
}

function disposition(outcome = 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT', overrides = {}) {
  return {
    dispositionId: 'VD-1', requirementId: 'VR-1', scope, mechanismId: 'mechanicalExcitation', outcome,
    evidence: { sessionIds: ['MS-1'], productIds: ['SP-1', 'SP-2'] },
    review: { reviewerId: 'eng-1', reviewedAt: '2026-08-19T09:00:00Z' },
    reason: 'Reviewed exact-scope evidence.', ...overrides,
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('requirement fixes non-authorizing verification authority', () => {
  const value = createVibrationVerificationRequirement(requirement());
  assert.equal(value.authority, VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY);
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(value.authority.determinesAssessmentCompleteness, false);
});

test('requirement rejects unsupported product types and forged authority', () => {
  expectCode(() => createVibrationVerificationRequirement(requirement({ requiredProductTypes: ['NOT_A_PRODUCT'] })), 'VIBRATION_VERIFICATION_PRODUCT_TYPE_INVALID');
  expectCode(() => createVibrationVerificationRequirement(requirement({ authority: { ...VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY, screeningAuthority: 'AUTHORIZED' } })), 'VIBRATION_VERIFICATION_AUTHORITY_INVALID');
  expectCode(() => createVibrationVerificationRequirement(requirement({ authority: { ...VIBRATION_VERIFICATION_REQUIREMENT_AUTHORITY, engineeringAuthority: 'SCREENING' } })), 'VIBRATION_VERIFICATION_AUTHORITY_INVALID');
});

test('complete exact-scope evidence waits for engineer disposition', () => {
  const value = evaluateVibrationVerification({ requirement: requirement(), measurementEvidence: verificationEvidencePackage() });
  assert.equal(value.state, 'AWAITING_ENGINEER_DISPOSITION');
  assert.deepEqual(value.evidence.missingProductTypes, []);
});

test('missing required signal product remains evidence incomplete', () => {
  const value = evaluateVibrationVerification({
    requirement: requirement(), measurementEvidence: verificationEvidencePackage({ includeFft: false }),
  });
  assert.equal(value.state, 'EVIDENCE_INCOMPLETE');
  assert.deepEqual(value.evidence.missingProductTypes, ['FFT']);
});

test('wrong operating-case snapshot evidence cannot satisfy requirement', () => {
  const wrongScope = verificationScope({ operatingCaseSnapshotHash: OTHER });
  const value = evaluateVibrationVerification({
    requirement: requirement(), measurementEvidence: verificationEvidencePackage({ scope: wrongScope }),
  });
  assert.equal(value.state, 'EVIDENCE_REQUIRED');
  assert.deepEqual(value.evidence.matchingSessionIds, []);
});

test('accepted disposition requires complete governed evidence', () => {
  expectCode(() => evaluateVibrationVerification({
    requirement: requirement(), measurementEvidence: verificationEvidencePackage({ includeFft: false }),
    disposition: disposition('EVIDENCE_ACCEPTED_FOR_REQUIREMENT', { evidence: { sessionIds: ['MS-1'], productIds: ['SP-1'] } }),
  }), 'VIBRATION_VERIFICATION_ACCEPTANCE_WITH_INCOMPLETE_EVIDENCE');
});

test('accepted disposition must explicitly cite products covering each required type', () => {
  const bad = disposition('EVIDENCE_ACCEPTED_FOR_REQUIREMENT', {
    evidence: { sessionIds: ['MS-1'], productIds: ['SP-1'] },
  });
  expectCode(() => evaluateVibrationVerification({
    requirement: requirement(), measurementEvidence: verificationEvidencePackage(), disposition: bad,
  }), 'VIBRATION_VERIFICATION_ACCEPTANCE_REFERENCES_INCOMPLETE');
});

test('engineer outcomes remain requirement workflow states without authority promotion', () => {
  for (const [outcome, expected] of [
    ['EVIDENCE_ACCEPTED_FOR_REQUIREMENT', 'VERIFICATION_EVIDENCE_ACCEPTED'],
    ['EVIDENCE_INSUFFICIENT', 'EVIDENCE_INSUFFICIENT'],
    ['SPECIALIST_REVIEW_REQUIRED', 'SPECIALIST_REVIEW_REQUIRED'],
    ['CORRECTIVE_ACTION_REQUIRED', 'CORRECTIVE_ACTION_REQUIRED'],
  ]) {
    const value = evaluateVibrationVerification({
      requirement: requirement(), measurementEvidence: verificationEvidencePackage(), disposition: disposition(outcome),
    });
    assert.equal(value.state, expected);
    assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
    assert.equal(value.authority.rootCauseAuthority, false);
  }
  assert.equal(VIBRATION_MEASUREMENT_DISPOSITION_AUTHORITY.rootCauseAuthority, false);
});

test('disposition cannot cite measurement evidence from another exact scope', () => {
  const packageValue = verificationEvidencePackage();
  packageValue.sessions.push(measurementSession({
    sessionId: 'MS-2', scope: verificationScope({ caseId: 'STARTUP' }),
  }));
  const bad = disposition('EVIDENCE_INSUFFICIENT', { evidence: { sessionIds: ['MS-2'], productIds: [] } });
  expectCode(() => evaluateVibrationVerification({
    requirement: requirement(), measurementEvidence: packageValue, disposition: bad,
  }), 'VIBRATION_VERIFICATION_WRONG_SCOPE_EVIDENCE');
});
