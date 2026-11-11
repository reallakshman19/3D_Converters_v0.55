import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY,
  HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITIONS,
  appendHpPipingClassReviewDisposition,
  buildHpPipingClassReviewDispositionPackage,
  createHpPipingClassReviewDispositionLedger,
  hashHpPipingClassEngineeringReviewReport,
  parseHpPipingClassReviewDispositionLedger,
  summarizeHpPipingClassReviewDisposition,
  verifyHpPipingClassReviewDispositionLedgerChain,
  verifyHpPipingClassReviewDispositionPackage,
} from '../tabs/hp-piping-class-engineering-review-disposition.js';

function report({ pressure = 20, revision = 'A' } = {}) {
  return {
    schemaVersion: 'hp-piping-class-engineering-review-report/v1', reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    identity: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision },
    authority: { calculationMode: 'USER_CALCULATED_KD3', nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false, engineeringAuthority: 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY', reportPurpose: 'ENGINEERING_REVIEW_ONLY' },
    classBasis: { designPressureMpa: pressure, internalAllowanceMm: 3, externalAllowanceMm: 0 },
    productResults: [{ productId: 'NPS4-S160', pressureRatingMpa: 23.086120852009273, cumulativeUsage: 0.05 }],
    cycleResults: [{ productId: 'NPS4-S160', cycleId: 'C1', coreSaltMpa: 63.29949581051363, equivalentAlternatingStressMpa: 70, permissibleCycles: 10000, appliedCycles: 500, cycleUsage: 0.05 }],
    externalKdCustody: [{ productId: 'NPS4-S160', cycleId: 'C1', calculationBasis: { calculationRef: 'HP-FAT-EXT-001', checkedBy: 'ENGINEER_B' } }],
  };
}
const input = (overrides = {}) => ({ actor: 'ENGINEER_C', role: 'REVIEWER', disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW', recordedAt: '2026-08-21T10:30:00Z', ...overrides });

test('review dispositions intentionally exclude approval/release semantics', () => {
  assert.deepEqual(HP_PIPING_CLASS_REVIEW_DISPOSITIONS, ['NO_OBJECTION_FOR_ENGINEERING_REVIEW', 'COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW']);
  assert.equal(HP_PIPING_CLASS_REVIEW_DISPOSITIONS.some((value) => /APPROV|RELEASE/.test(value)), false);
});

test('new review custody is v2 and first entry is SHA-256 chained without identity promotion', async () => {
  const source = report();
  const ledger = await appendHpPipingClassReviewDisposition(createHpPipingClassReviewDispositionLedger(), source, input());
  assert.equal(ledger.schemaVersion, HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION);
  assert.equal(ledger.entries[0].reportSha256, await hashHpPipingClassEngineeringReviewReport(source));
  assert.equal(ledger.entries[0].previousEntrySha256, null);
  assert.match(ledger.entries[0].entrySha256, /^[0-9a-f]{64}$/u);
  const integrity = await verifyHpPipingClassReviewDispositionLedgerChain(ledger);
  assert.equal(integrity.ok, true);
  assert.equal(integrity.integrity, HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY);
  assert.equal(integrity.ledgerHeadSha256, ledger.entries[0].entrySha256);
  assert.equal(ledger.entries[0].authority.actorIdentityAuthority, 'USER_DECLARED');
  assert.equal(ledger.entries[0].authority.digitalSignature, false);
  assert.equal(ledger.entries[0].authority.canAuthorizeRelease, false);
});

test('second v2 entry binds the exact first entry hash and preserves contiguous sequence', async () => {
  let ledger = await appendHpPipingClassReviewDisposition(null, report(), input());
  ledger = await appendHpPipingClassReviewDisposition(ledger, report(), input({ actor: 'ENGINEER_D', role: 'CHECKER', disposition: 'COMMENTS_RECORDED', comment: 'Check item R-01.', recordedAt: '2026-08-21T11:00:00Z' }));
  assert.equal(ledger.entries[1].sequence, 2);
  assert.equal(ledger.entries[1].previousEntrySha256, ledger.entries[0].entrySha256);
  assert.equal((await verifyHpPipingClassReviewDispositionLedgerChain(ledger)).ok, true);
});

test('v2 chain detects entry payload, previous-link and entry-hash tampering', async () => {
  let ledger = await appendHpPipingClassReviewDisposition(null, report(), input());
  ledger = await appendHpPipingClassReviewDisposition(ledger, report(), input({ actor: 'ENGINEER_D', role: 'CHECKER', disposition: 'COMMENTS_RECORDED', comment: 'Check item R-01.', recordedAt: '2026-08-21T11:00:00Z' }));
  for (const mutate of [
    (value) => { value.entries[0].actor = 'ATTACKER'; },
    (value) => { value.entries[1].previousEntrySha256 = '0'.repeat(64); },
    (value) => { value.entries[1].entrySha256 = 'f'.repeat(64); },
  ]) {
    const tampered = JSON.parse(JSON.stringify(ledger));
    mutate(tampered);
    const integrity = await verifyHpPipingClassReviewDispositionLedgerChain(tampered);
    assert.equal(integrity.ok, false);
  }
});

test('legacy v1 remains parseable and appendable without silent promotion to v2 integrity', async () => {
  const legacy = createHpPipingClassReviewDispositionLedger({ schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION });
  const appended = await appendHpPipingClassReviewDisposition(legacy, report(), input());
  assert.equal(appended.schemaVersion, HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION);
  assert.equal('entrySha256' in appended.entries[0], false);
  assert.equal((await verifyHpPipingClassReviewDispositionLedgerChain(appended)).integrity, HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1);
  const pkg = await buildHpPipingClassReviewDispositionPackage(report(), appended);
  assert.equal(pkg.schemaVersion, HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION);
  const verified = await verifyHpPipingClassReviewDispositionPackage(pkg);
  assert.equal(verified.ok, true);
  assert.equal(verified.ledgerEntryCryptographicIntegrity, HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1);
});

test('v2 package binds report hash and verified ledger head', async () => {
  const ledger = await appendHpPipingClassReviewDisposition(null, report(), input());
  const pkg = await buildHpPipingClassReviewDispositionPackage(report(), ledger);
  assert.equal(pkg.schemaVersion, HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION);
  assert.equal(pkg.ledgerHeadSha256, ledger.entries[0].entrySha256);
  const verified = await verifyHpPipingClassReviewDispositionPackage(pkg);
  assert.equal(verified.ok, true);
  assert.equal(verified.ledgerEntryCryptographicIntegrity, HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY);
  assert.equal(verified.ledgerHeadSha256, ledger.entries[0].entrySha256);
});

test('report change makes prior review historical instead of carrying it forward', async () => {
  const ledger = await appendHpPipingClassReviewDisposition(null, report(), input());
  const changed = report({ pressure: 21 });
  assert.notEqual(await hashHpPipingClassEngineeringReviewReport(report()), await hashHpPipingClassEngineeringReviewReport(changed));
  const summary = await summarizeHpPipingClassReviewDisposition(ledger, changed);
  assert.equal(summary.currentDisposition, 'PENDING_REVIEW');
  assert.equal(summary.currentRecordCount, 0);
  assert.equal(summary.historicalRecordCount, 1);
});

test('comments and rejection require an explicit comment', async () => {
  for (const disposition of ['COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW']) {
    await assert.rejects(appendHpPipingClassReviewDisposition(null, report(), input({ role: 'CHECKER', disposition, comment: undefined })), /comment is required/i);
  }
});

test('parser rejects authority promotion, fake digital-signature authority and sequence corruption', async () => {
  const ledger = await appendHpPipingClassReviewDisposition(null, report(), input({ role: 'CHECKER', disposition: 'COMMENTS_RECORDED', comment: 'Resolve item R-01.' }));
  const promoted = JSON.parse(JSON.stringify(ledger)); promoted.authority.canAuthorizeRelease = true;
  assert.throws(() => parseHpPipingClassReviewDispositionLedger(promoted), /canAuthorizeRelease must remain false/);
  const signed = JSON.parse(JSON.stringify(ledger)); signed.entries[0].authority.digitalSignature = true;
  assert.throws(() => parseHpPipingClassReviewDispositionLedger(signed), /digitalSignature must remain false/);
  const reordered = JSON.parse(JSON.stringify(ledger)); reordered.entries[0].sequence = 2;
  assert.throws(() => parseHpPipingClassReviewDispositionLedger(reordered), /append-only and contiguous/);
});

test('package detects report tamper and ledger chain-head tamper', async () => {
  const ledger = await appendHpPipingClassReviewDisposition(null, report(), input());
  const pkg = await buildHpPipingClassReviewDispositionPackage(report(), ledger);
  const reportTamper = JSON.parse(JSON.stringify(pkg)); reportTamper.report.classBasis.designPressureMpa = 22;
  assert.equal((await verifyHpPipingClassReviewDispositionPackage(reportTamper)).ok, false);
  const headTamper = JSON.parse(JSON.stringify(pkg)); headTamper.ledgerHeadSha256 = '0'.repeat(64);
  const failed = await verifyHpPipingClassReviewDispositionPackage(headTamper);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /ledgerHeadSha256/);
});
