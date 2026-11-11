import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY,
  HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION,
  appendHpPipingClassReviewDisposition,
  buildHpPipingClassReviewDispositionPackage,
  createHpPipingClassReviewDispositionLedger,
  summarizeHpPipingClassReviewDisposition,
} from '../tabs/hp-piping-class-engineering-review-disposition.js';
import {
  HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION,
  serializeHpPipingClassReviewPackageVerificationReceipt,
  verifyHpPipingClassReviewPackageJson,
  verifyHpPipingClassReviewPackageObject,
} from '../tabs/hp-piping-class-review-package-verifier.js';

function report({ pressure = 20, revision = 'A' } = {}) {
  return {
    schemaVersion: 'hp-piping-class-engineering-review-report/v1', reportPurpose: 'ENGINEERING_REVIEW_ONLY', identity: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision },
    sourceContracts: { projectVersion: 'hp-piping-class-project/v2', orchestratorVersion: 'hp-piping-class-orchestrator/v1', resultExportVersion: 'hp-piping-class-result-export/v1' },
    method: { b313Edition: '2024', viii3Edition: '2025', calculationMode: 'USER_CALCULATED_KD3' },
    authority: { calculationMode: 'USER_CALCULATED_KD3', nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false, engineeringAuthority: 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY', reportPurpose: 'ENGINEERING_REVIEW_ONLY' },
    classBasis: { designPressureMpa: pressure, internalAllowanceMm: 3, externalAllowanceMm: 0 }, reviewSummary: { projectState: 'CALCULATED_NOT_AUTHORIZED', resultRoundTrip: { ok: true } },
    productInputs: [{ productId: 'NPS4-S160', nominalSize: 'NPS 4', outsideDiameterMm: 114.3, allowableStressMpa: 138, nominalWallMm: 13.49, minusTolerancePct: 12.5 }],
    productResults: [{ productId: 'NPS4-S160', reviewPriority: 'FATIGUE_EVALUATED', staticPass: true, requiredNominalThicknessMm: 12.240449712388969, pressureRatingMpa: 23.086120852009273, cumulativeUsage: 0.05, engineeringState: 'REVIEW_COMPLETE_NOT_AUTHORIZED' }],
    cycleResults: [{ productId: 'NPS4-S160', cycleId: 'C1', coreSaltMpa: 63.29949581051363, equivalentAlternatingStressMpa: 70, permissibleCycles: 10000, appliedCycles: 500, cycleUsage: 0.05 }],
    externalKdCustody: [{ productId: 'NPS4-S160', cycleId: 'C1', calculationBasis: { calculationRef: 'HP-FAT-EXT-001', checkedBy: 'ENGINEER_B' } }], advisories: [], limitations: ['REVIEW ONLY — NO DESIGN AUTHORITY.'],
  };
}
async function packageFor(sourceReport = report(), legacy = false) {
  const seed = legacy ? createHpPipingClassReviewDispositionLedger({ schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION }) : null;
  const ledger = await appendHpPipingClassReviewDisposition(seed, sourceReport, { actor: 'ENGINEER_C', role: 'REVIEWER', disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW', recordedAt: '2026-08-21T10:30:00Z' });
  return buildHpPipingClassReviewDispositionPackage(sourceReport, ledger);
}

test('v2 package yields hash-chain self-consistency receipt without authority promotion', async () => {
  const result = await verifyHpPipingClassReviewPackageJson(JSON.stringify(await packageFor()));
  assert.equal(result.ok, true);
  assert.equal(result.receipt.schemaVersion, HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION);
  assert.equal(result.receipt.currentDisposition, 'NO_OBJECTION_FOR_ENGINEERING_REVIEW');
  assert.equal(result.receipt.trust.ledgerEntryCryptographicIntegrity, HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY);
  assert.match(result.receipt.trust.ledgerHeadSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.receipt.trust.reviewerIdentityAuthentication, 'NOT_AVAILABLE_USER_DECLARED');
  assert.equal(result.receipt.trust.digitalSignature, false);
  assert.equal(result.receipt.trust.codeCompliance, false);
  assert.equal(result.receipt.trust.designAuthority, false);
  assert.equal(result.receipt.trust.releaseAuthority, false);
});

test('legacy v1 package remains verifiable but cannot claim ledger-entry cryptographic integrity', async () => {
  const result = await verifyHpPipingClassReviewPackageObject(await packageFor(report(), true));
  assert.equal(result.ok, true);
  assert.equal(result.receipt.trust.ledgerEntryCryptographicIntegrity, HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1);
  assert.equal(result.receipt.trust.ledgerHeadSha256, null);
});

test('v2 entry content tamper is detected even when report bytes are unchanged', async () => {
  const pkg = JSON.parse(JSON.stringify(await packageFor()));
  pkg.ledger.entries[0].actor = 'ATTACKER';
  pkg.summary.currentActor = 'ATTACKER';
  const result = await verifyHpPipingClassReviewPackageObject(pkg);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, 'HP_REVIEW_PACKAGE_CONTENT_BINDING_FAILED');
  assert.match(result.issues[0].message, /hash chain|entrySha256/i);
});

test('embedded report and stored summary tamper remain independently detected', async () => {
  const reportTamper = JSON.parse(JSON.stringify(await packageFor())); reportTamper.report.classBasis.designPressureMpa = 21;
  const a = await verifyHpPipingClassReviewPackageObject(reportTamper);
  assert.equal(a.ok, false); assert.equal(a.issues[0].code, 'HP_REVIEW_PACKAGE_CONTENT_BINDING_FAILED');
  const summaryTamper = JSON.parse(JSON.stringify(await packageFor())); summaryTamper.summary.currentDisposition = 'REJECTED_FOR_ENGINEERING_REVIEW';
  const b = await verifyHpPipingClassReviewPackageObject(summaryTamper);
  assert.equal(b.ok, false); assert.equal(b.issues[0].code, 'HP_REVIEW_PACKAGE_SUMMARY_MISMATCH');
});

test('non-contiguous ledger sequence and authority promotion fail closed', async () => {
  const brokenSequence = JSON.parse(JSON.stringify(await packageFor())); brokenSequence.ledger.entries[0].sequence = 2;
  const sequenceResult = await verifyHpPipingClassReviewPackageObject(brokenSequence);
  assert.equal(sequenceResult.ok, false); assert.match(sequenceResult.issues[0].message, /append-only and contiguous/);
  const promoted = JSON.parse(JSON.stringify(await packageFor())); promoted.authority.canAuthorizeRelease = true;
  const authorityResult = await verifyHpPipingClassReviewPackageObject(promoted);
  assert.equal(authorityResult.ok, false); assert.match(authorityResult.issues[0].message, /canAuthorizeRelease must remain false/);
});

test('historical custody remains separate after a legitimate report/revision change', async () => {
  const oldReport = report();
  const oldLedger = await appendHpPipingClassReviewDisposition(null, oldReport, { actor: 'ENGINEER_C', role: 'REVIEWER', disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW', recordedAt: '2026-08-21T10:30:00Z' });
  const result = await verifyHpPipingClassReviewPackageObject(await buildHpPipingClassReviewDispositionPackage(report({ pressure: 21, revision: 'B' }), oldLedger));
  assert.equal(result.ok, true); assert.equal(result.receipt.currentDisposition, 'PENDING_REVIEW'); assert.equal(result.receipt.currentRecordCount, 0); assert.equal(result.receipt.historicalRecordCount, 1);
});

test('semantic key reordering of stored summary does not create a false tamper finding', async () => {
  const pkg = JSON.parse(JSON.stringify(await packageFor()));
  const summary = await summarizeHpPipingClassReviewDisposition(pkg.ledger, pkg.report);
  pkg.summary = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(summary))).reverse());
  assert.equal((await verifyHpPipingClassReviewPackageObject(pkg)).ok, true);
});

test('invalid JSON is classified and receipt serializer rejects forged integrity or authority', async () => {
  const invalid = await verifyHpPipingClassReviewPackageJson('{not-json');
  assert.equal(invalid.ok, false); assert.equal(invalid.issues[0].code, 'HP_REVIEW_PACKAGE_JSON_INVALID');
  const valid = await verifyHpPipingClassReviewPackageObject(await packageFor());
  const parsed = JSON.parse(serializeHpPipingClassReviewPackageVerificationReceipt(valid.receipt));
  assert.equal(parsed.trust.designAuthority, false); assert.equal(parsed.trust.releaseAuthority, false); assert.equal(parsed.trust.codeCompliance, false);
  const forged = JSON.parse(JSON.stringify(valid.receipt)); forged.trust.reviewerIdentityAuthentication = 'AUTHENTICATED';
  assert.throws(() => serializeHpPipingClassReviewPackageVerificationReceipt(forged), /cannot promote/);
});
