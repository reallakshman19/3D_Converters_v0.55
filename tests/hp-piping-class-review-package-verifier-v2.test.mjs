import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendHpPipingClassReviewDispositionV2,
  createHpPipingClassReviewDispositionLedgerV2,
} from '../tabs/hp-piping-class-engineering-review-disposition-v2.js';
import {
  buildHpPipingClassReviewDispositionCheckpointV2,
  buildHpPipingClassReviewDispositionPackageV2,
} from '../tabs/hp-piping-class-engineering-review-disposition-package-v2.js';
import {
  serializeHpPipingClassReviewPackageVerificationReceipt,
  verifyHpPipingClassReviewPackageObject,
} from '../tabs/hp-piping-class-review-package-verifier.js';

function report() {
  return {
    schemaVersion: 'hp-piping-class-engineering-review-report/v1',
    reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    identity: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision: 'A' },
    sourceContracts: {},
    method: { b313Edition: '2024', viii3Edition: '2025', calculationMode: 'USER_CALCULATED_KD3' },
    canonicalUnits: { length: 'mm', pressure: 'MPa', stress: 'MPa', temperature: 'degC' },
    authority: {
      calculationMode: 'USER_CALCULATED_KD3',
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      engineeringAuthority: 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY',
      reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    },
    classBasis: { designPressureMpa: 20, internalAllowanceMm: 3, externalAllowanceMm: 0 },
    productInputs: [],
    transient: { spectrum: null, states: [], transitions: [] },
    reviewSummary: { projectState: 'CALCULATED_NOT_AUTHORIZED' },
    productResults: [],
    cycleResults: [],
    externalKdCustody: [],
    advisories: [],
    limitations: ['REVIEW ONLY — NO DESIGN AUTHORITY.'],
  };
}

async function packageAndCheckpoint() {
  const ledger = await appendHpPipingClassReviewDispositionV2(
    createHpPipingClassReviewDispositionLedgerV2(),
    report(),
    {
      actor: 'ENGINEER_C',
      role: 'REVIEWER',
      disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW',
      recordedAt: '2026-08-21T11:00:00Z',
    },
  );
  return {
    pkg: await buildHpPipingClassReviewDispositionPackageV2(report(), ledger),
    checkpoint: await buildHpPipingClassReviewDispositionCheckpointV2(ledger),
  };
}

test('valid v2 package without checkpoint reports internal consistency only', async () => {
  const { pkg } = await packageAndCheckpoint();
  const result = await verifyHpPipingClassReviewPackageObject(pkg);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.schemaVersion, 'hp-piping-class-review-package-verification-receipt/v2');
  assert.equal(result.receipt.verificationAuthority, 'PACKAGE_SELF_CONSISTENCY_ONLY');
  assert.equal(result.receipt.trust.ledgerEntryCryptographicIntegrity, 'INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY');
  assert.equal(result.receipt.trust.externalCheckpointVerification, 'NOT_SUPPLIED');
  assert.equal(result.receipt.trust.reviewerIdentityAuthentication, 'NOT_AVAILABLE_USER_DECLARED');
  assert.equal(result.receipt.trust.digitalSignature, false);
  assert.equal(result.receipt.trust.nativeCoreKd3Qualified, false);
  assert.equal(result.receipt.trust.codeCompliance, false);
  assert.equal(result.receipt.trust.designAuthority, false);
  assert.equal(result.receipt.trust.releaseAuthority, false);
});

test('separately supplied matching checkpoint elevates only chain-prefix verification', async () => {
  const { pkg, checkpoint } = await packageAndCheckpoint();
  const result = await verifyHpPipingClassReviewPackageObject(pkg, { checkpoint });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.verificationAuthority, 'PACKAGE_CHAIN_CHECKPOINT_VERIFICATION_ONLY');
  assert.equal(result.receipt.trust.ledgerEntryCryptographicIntegrity, 'PASS_AGAINST_EXTERNAL_CHECKPOINT');
  assert.equal(result.receipt.trust.externalCheckpointVerification, 'PASS');
  assert.equal(result.receipt.trust.reviewerIdentityAuthentication, 'NOT_AVAILABLE_USER_DECLARED');
  assert.equal(result.receipt.trust.digitalSignature, false);
  assert.equal(result.receipt.checkpointVerification.ok, true);
});

test('checkpoint mismatch blocks instead of falling back to internal-only PASS', async () => {
  const { pkg, checkpoint } = await packageAndCheckpoint();
  const wrong = JSON.parse(JSON.stringify(checkpoint));
  wrong.chainHeadSha256 = 'f'.repeat(64);
  const result = await verifyHpPipingClassReviewPackageObject(pkg, { checkpoint: wrong });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, 'HP_REVIEW_PACKAGE_CHECKPOINT_MISMATCH');
});

test('v2 receipt serializer rejects authenticity, identity and engineering-authority promotion', async () => {
  const { pkg } = await packageAndCheckpoint();
  const result = await verifyHpPipingClassReviewPackageObject(pkg);
  assert.equal(result.ok, true);
  assert.match(serializeHpPipingClassReviewPackageVerificationReceipt(result.receipt), /INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY/);

  for (const mutate of [
    (r) => { r.trust.ledgerEntryCryptographicIntegrity = 'PASS_AGAINST_EXTERNAL_CHECKPOINT'; },
    (r) => { r.trust.reviewerIdentityAuthentication = 'PASS'; },
    (r) => { r.trust.digitalSignature = true; },
    (r) => { r.trust.nativeCoreKd3Qualified = true; },
    (r) => { r.trust.codeCompliance = true; },
    (r) => { r.trust.designAuthority = true; },
    (r) => { r.trust.releaseAuthority = true; },
    (r) => { r.verificationAuthority = 'DESIGN_RELEASE'; },
  ]) {
    const promoted = JSON.parse(JSON.stringify(result.receipt));
    mutate(promoted);
    assert.throws(
      () => serializeHpPipingClassReviewPackageVerificationReceipt(promoted),
      /cannot promote checkpoint, identity or engineering authority/,
    );
  }
});
