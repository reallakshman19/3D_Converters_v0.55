import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION,
  serializeHpPipingClassReviewPackageVerificationReceipt,
} from '../tabs/hp-piping-class-review-package-verifier.js';

function receipt() {
  return {
    schemaVersion: HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION,
    verificationPurpose: 'INDEPENDENT_REVIEW_PACKAGE_SELF_CONSISTENCY',
    verificationAuthority: 'PACKAGE_SELF_CONSISTENCY_ONLY',
    trust: {
      reportContentSha256Binding: 'PASS',
      embeddedReportSchemaRoundTrip: 'PASS',
      ledgerStructuralValidation: 'PASS',
      storedSummaryRecomputation: 'PASS',
      ledgerEntryCryptographicIntegrity: 'NOT_AVAILABLE_V1',
      reviewerIdentityAuthentication: 'NOT_AVAILABLE_USER_DECLARED',
      digitalSignature: false,
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      designAuthority: false,
      releaseAuthority: false,
    },
  };
}

test('receipt serializer preserves non-authorizing verification boundary', () => {
  const parsed = JSON.parse(serializeHpPipingClassReviewPackageVerificationReceipt(receipt()));
  assert.equal(parsed.verificationAuthority, 'PACKAGE_SELF_CONSISTENCY_ONLY');
  assert.equal(parsed.trust.nativeCoreKd3Qualified, false);
  assert.equal(parsed.trust.codeCompliance, false);
  assert.equal(parsed.trust.designAuthority, false);
  assert.equal(parsed.trust.releaseAuthority, false);
});

test('receipt serializer rejects false promotion of unavailable integrity, identity or engineering authority', () => {
  for (const mutate of [
    (value) => { value.trust.ledgerEntryCryptographicIntegrity = 'PASS'; },
    (value) => { value.trust.reviewerIdentityAuthentication = 'PASS'; },
    (value) => { value.trust.digitalSignature = true; },
    (value) => { value.trust.nativeCoreKd3Qualified = true; },
    (value) => { value.trust.codeCompliance = true; },
    (value) => { value.trust.designAuthority = true; },
    (value) => { value.trust.releaseAuthority = true; },
    (value) => { value.verificationAuthority = 'DESIGN_AUTHORITY'; },
  ]) {
    const value = receipt();
    mutate(value);
    assert.throws(() => serializeHpPipingClassReviewPackageVerificationReceipt(value), /cannot promote/);
  }
});
