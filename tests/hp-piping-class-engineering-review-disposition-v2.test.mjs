import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendHpPipingClassReviewDisposition,
  createHpPipingClassReviewDispositionLedger,
} from '../tabs/hp-piping-class-engineering-review-disposition.js';
import {
  appendHpPipingClassReviewDispositionV2,
  anchorHpPipingClassReviewDispositionLedgerV1ToV2,
  parseHpPipingClassReviewDispositionLedgerV2,
  summarizeHpPipingClassReviewDispositionV2,
} from '../tabs/hp-piping-class-engineering-review-disposition-v2.js';
import {
  buildHpPipingClassReviewDispositionCheckpointV2,
  buildHpPipingClassReviewDispositionPackageV2,
  verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint,
  verifyHpPipingClassReviewDispositionPackageV2,
} from '../tabs/hp-piping-class-engineering-review-disposition-package-v2.js';

function report({ pressure = 20, revision = 'A' } = {}) {
  return {
    schemaVersion: 'hp-piping-class-engineering-review-report/v1',
    reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    identity: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision },
    authority: {
      calculationMode: 'USER_CALCULATED_KD3',
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      engineeringAuthority: 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY',
      reportPurpose: 'ENGINEERING_REVIEW_ONLY',
    },
    classBasis: { designPressureMpa: pressure, internalAllowanceMm: 3, externalAllowanceMm: 0 },
    productInputs: [],
    productResults: [],
    cycleResults: [],
    externalKdCustody: [],
    reviewSummary: { projectState: 'CALCULATED_NOT_AUTHORIZED' },
  };
}

async function legacyLedger() {
  return appendHpPipingClassReviewDisposition(
    createHpPipingClassReviewDispositionLedger(),
    report(),
    {
      actor: 'ENGINEER_B',
      role: 'CHECKER',
      disposition: 'COMMENTS_RECORDED',
      comment: 'Legacy v1 review note.',
      recordedAt: '2026-08-21T10:00:00Z',
    },
  );
}

async function v2WithTwoEntries() {
  const anchored = await anchorHpPipingClassReviewDispositionLedgerV1ToV2(await legacyLedger());
  const one = await appendHpPipingClassReviewDispositionV2(anchored, report(), {
    actor: 'ENGINEER_C',
    role: 'REVIEWER',
    disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW',
    recordedAt: '2026-08-21T11:00:00Z',
  });
  return appendHpPipingClassReviewDispositionV2(one, report({ pressure: 21, revision: 'B' }), {
    actor: 'ENGINEER_D',
    role: 'CHECKER',
    disposition: 'COMMENTS_RECORDED',
    comment: 'Revision B reviewed with comments.',
    recordedAt: '2026-08-21T12:00:00Z',
  });
}

test('v2 migration anchors validated v1 snapshot without retroactively authenticating v1 entries', async () => {
  const legacy = await legacyLedger();
  const anchored = await anchorHpPipingClassReviewDispositionLedgerV1ToV2(legacy);
  assert.equal(anchored.chain.legacyV1EntryCount, 1);
  assert.match(anchored.chain.legacyV1AnchorSha256, /^[0-9a-f]{64}$/);
  assert.equal(anchored.entries.length, 0);
  assert.deepEqual(anchored.legacyV1Ledger, legacy);

  const next = await appendHpPipingClassReviewDispositionV2(anchored, report(), {
    actor: 'ENGINEER_C', role: 'REVIEWER', disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW', recordedAt: '2026-08-21T11:00:00Z',
  });
  assert.equal(next.entries[0].sequence, 2);
  assert.equal(next.entries[0].previousEntrySha256, anchored.chain.legacyV1AnchorSha256);
  assert.equal(next.entries[0].entrySha256, next.chain.headEntrySha256);
  const summary = await summarizeHpPipingClassReviewDispositionV2(next, report());
  assert.equal(summary.legacyV1RecordCount, 1);
  assert.equal(summary.hashChainedV2RecordCount, 1);
  assert.equal(summary.currentEntries[0].integrityClass, 'LEGACY_V1_UNSEALED');
  assert.equal(summary.currentEntries[1].integrityClass, 'HASH_CHAIN_V2');
});

test('v2 parser detects immutable entry-content tamper', async () => {
  const ledger = await v2WithTwoEntries();
  const tampered = JSON.parse(JSON.stringify(ledger));
  tampered.entries[0].actor = 'ATTACKER_REWRITE';
  await assert.rejects(parseHpPipingClassReviewDispositionLedgerV2(tampered), /entrySha256 does not match/);
});

test('v2 parser detects deletion, reordering and predecessor-link corruption', async () => {
  const ledger = await v2WithTwoEntries();
  const deleted = JSON.parse(JSON.stringify(ledger));
  deleted.entries.shift();
  await assert.rejects(parseHpPipingClassReviewDispositionLedgerV2(deleted), /sequence must continue|previousEntrySha256/);

  const reordered = JSON.parse(JSON.stringify(ledger));
  reordered.entries.reverse();
  await assert.rejects(parseHpPipingClassReviewDispositionLedgerV2(reordered), /sequence must continue|previousEntrySha256/);

  const broken = JSON.parse(JSON.stringify(ledger));
  broken.entries[1].previousEntrySha256 = '0'.repeat(64);
  await assert.rejects(parseHpPipingClassReviewDispositionLedgerV2(broken), /previousEntrySha256/);
});

test('v2 parser detects any change to the anchored legacy v1 snapshot', async () => {
  const ledger = await v2WithTwoEntries();
  const tampered = JSON.parse(JSON.stringify(ledger));
  tampered.legacyV1Ledger.entries[0].comment = 'rewritten legacy history';
  await assert.rejects(parseHpPipingClassReviewDispositionLedgerV2(tampered), /legacy anchor SHA-256 mismatch/);
});

test('v2 package reports internal hash-chain consistency without overstating authenticity', async () => {
  const ledger = await v2WithTwoEntries();
  const pkg = await buildHpPipingClassReviewDispositionPackageV2(report({ pressure: 21, revision: 'B' }), ledger);
  const verified = await verifyHpPipingClassReviewDispositionPackageV2(pkg);
  assert.equal(verified.ok, true);
  assert.equal(verified.chainIntegrity, 'INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY');
  assert.equal(verified.hashChainedV2RecordCount, 2);
  assert.equal(verified.legacyV1RecordCount, 1);
  assert.ok(pkg.limitations.some((line) => /attacker.*recompute unkeyed hashes/i.test(line)));
  assert.ok(pkg.limitations.some((line) => /USER_DECLARED/i.test(line)));

  const summaryTamper = JSON.parse(JSON.stringify(pkg));
  summaryTamper.summary.hashChainedV2RecordCount = 99;
  const failed = await verifyHpPipingClassReviewDispositionPackageV2(summaryTamper);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /summary mismatch/i);
});

test('independently retained checkpoint verifies a retained chain prefix and permits later append-only extension', async () => {
  const anchored = await anchorHpPipingClassReviewDispositionLedgerV1ToV2(await legacyLedger());
  const one = await appendHpPipingClassReviewDispositionV2(anchored, report(), {
    actor: 'ENGINEER_C', role: 'REVIEWER', disposition: 'NO_OBJECTION_FOR_ENGINEERING_REVIEW', recordedAt: '2026-08-21T11:00:00Z',
  });
  const checkpoint = await buildHpPipingClassReviewDispositionCheckpointV2(one);
  const two = await appendHpPipingClassReviewDispositionV2(one, report({ pressure: 21, revision: 'B' }), {
    actor: 'ENGINEER_D', role: 'CHECKER', disposition: 'COMMENTS_RECORDED', comment: 'Revision B note.', recordedAt: '2026-08-21T12:00:00Z',
  });
  const verified = await verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint(two, checkpoint);
  assert.equal(verified.ok, true);
  assert.equal(verified.checkpointRecordCount, 1);
  assert.equal(verified.currentV2RecordCount, 2);
  assert.equal(verified.appendedSinceCheckpoint, 1);

  const fake = JSON.parse(JSON.stringify(checkpoint));
  fake.chainHeadSha256 = 'f'.repeat(64);
  await assert.rejects(
    verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint(two, fake),
    /checkpoint chain head does not match/i,
  );
});
