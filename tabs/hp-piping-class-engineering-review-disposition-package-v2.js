import { hashHpPipingClassEngineeringReviewReport } from './hp-piping-class-engineering-review-disposition.js';
import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2,
  createHpPipingClassReviewDispositionLedgerV2,
  parseHpPipingClassReviewDispositionLedgerV2,
  summarizeHpPipingClassReviewDispositionV2,
} from './hp-piping-class-engineering-review-disposition-v2.js';
import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256,
  canonicalHpPipingClassReviewJson,
  isHpPipingClassReviewSha256,
} from './hp-piping-class-review-disposition-chain-v2.js';

export const HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2 =
  'hp-piping-class-engineering-review-disposition-package/v2';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_CHECKPOINT_VERSION =
  'hp-piping-class-engineering-review-disposition-checkpoint/v1';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function authority() {
  return Object.freeze({
    purpose: 'REVIEW_CUSTODY_ONLY',
    calculationMode: 'USER_CALCULATED_KD3',
    nativeCoreKd3Qualified: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
    canAuthorizeRelease: false,
    actorIdentityAuthority: 'USER_DECLARED',
    digitalSignature: false,
  });
}

function assertAuthority(value, path = 'authority') {
  const source = value ?? {};
  for (const [field, expected] of Object.entries(authority())) {
    if (source[field] !== expected) {
      throw new TypeError(`${path}.${field} must remain ${String(expected)}.`);
    }
  }
}

export async function buildHpPipingClassReviewDispositionCheckpointV2(ledgerValue) {
  const ledger = ledgerValue
    ? await parseHpPipingClassReviewDispositionLedgerV2(ledgerValue)
    : createHpPipingClassReviewDispositionLedgerV2();
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_CHECKPOINT_VERSION,
    ledgerSchemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2,
    hashAlgorithm: 'SHA-256',
    legacyV1AnchorSha256: ledger.chain.legacyV1AnchorSha256,
    legacyV1RecordCount: ledger.chain.legacyV1EntryCount,
    hashChainedV2RecordCount: ledger.entries.length,
    chainHeadSha256: ledger.chain.headEntrySha256,
    limitations: Object.freeze([
      'This checkpoint provides tamper evidence only when retained in independent trusted custody from the ledger/package being verified.',
      'It does not authenticate reviewer/checker identity and is not a digital signature.',
    ]),
  });
}

export async function verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint(
  ledgerValue,
  checkpoint,
) {
  const ledger = await parseHpPipingClassReviewDispositionLedgerV2(ledgerValue);
  if (
    checkpoint?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_CHECKPOINT_VERSION
    || checkpoint?.ledgerSchemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2
    || checkpoint?.hashAlgorithm !== 'SHA-256'
  ) {
    throw new TypeError('Unsupported HP review disposition checkpoint schema.');
  }
  if (
    checkpoint.legacyV1AnchorSha256 !== ledger.chain.legacyV1AnchorSha256
    || checkpoint.legacyV1RecordCount !== ledger.chain.legacyV1EntryCount
  ) {
    throw new TypeError('HP review disposition checkpoint legacy anchor/count mismatch.');
  }
  if (
    !Number.isInteger(checkpoint.hashChainedV2RecordCount)
    || checkpoint.hashChainedV2RecordCount < 0
    || checkpoint.hashChainedV2RecordCount > ledger.entries.length
  ) {
    throw new TypeError('HP review disposition checkpoint v2 record count is invalid for this ledger.');
  }
  const expectedHead = checkpoint.hashChainedV2RecordCount === 0
    ? (ledger.chain.legacyV1AnchorSha256
      ?? HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256)
    : ledger.entries[checkpoint.hashChainedV2RecordCount - 1].entrySha256;
  if (checkpoint.chainHeadSha256 !== expectedHead) {
    throw new TypeError(
      'HP review disposition checkpoint chain head does not match the retained ledger prefix.',
    );
  }
  return Object.freeze({
    ok: true,
    checkpointRecordCount: checkpoint.hashChainedV2RecordCount,
    currentV2RecordCount: ledger.entries.length,
    appendedSinceCheckpoint:
      ledger.entries.length - checkpoint.hashChainedV2RecordCount,
    checkpointChainHeadSha256: checkpoint.chainHeadSha256,
    currentChainHeadSha256: ledger.chain.headEntrySha256,
  });
}

export function serializeHpPipingClassReviewDispositionCheckpointV2Json(checkpoint) {
  if (
    checkpoint?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_CHECKPOINT_VERSION
    || checkpoint?.ledgerSchemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2
    || checkpoint?.hashAlgorithm !== 'SHA-256'
    || !isHpPipingClassReviewSha256(checkpoint.chainHeadSha256)
  ) {
    throw new TypeError('Unsupported HP review disposition checkpoint.');
  }
  return `${JSON.stringify(checkpoint, null, 2)}\n`;
}

export async function buildHpPipingClassReviewDispositionPackageV2(report, ledgerValue) {
  const ledger = ledgerValue
    ? await parseHpPipingClassReviewDispositionLedgerV2(ledgerValue)
    : createHpPipingClassReviewDispositionLedgerV2();
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const summary = await summarizeHpPipingClassReviewDispositionV2(ledger, report);
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2,
    authority: authority(),
    reportSha256,
    report: Object.freeze(clone(report)),
    ledger,
    summary,
    limitations: Object.freeze([
      'V2 SHA-256 chaining establishes internal chain consistency and detects changes relative to an independently retained trusted checkpoint.',
      'A self-contained hash chain is not reviewer authenticity; an attacker who can rewrite the complete package can also recompute unkeyed hashes.',
      'Legacy v1 entries are preserved and canonically anchored as a snapshot, but their pre-migration authenticity remains NOT_AVAILABLE_V1.',
      'Reviewer/checker identity remains USER_DECLARED; hash chaining is not PKI/e-signature authentication.',
      'Review custody does not establish Code compliance, design approval or release authority.',
      'Native CORE KD-3 / KD320 remains not qualified.',
    ]),
  });
}

export function serializeHpPipingClassReviewDispositionPackageV2Json(pkg) {
  if (pkg?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2) {
    throw new TypeError('Unsupported HP review disposition v2 package schema.');
  }
  assertAuthority(pkg.authority, 'package.authority');
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export async function verifyHpPipingClassReviewDispositionPackageV2(pkg) {
  try {
    if (pkg?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2) {
      throw new TypeError('Unsupported HP review disposition v2 package schema.');
    }
    assertAuthority(pkg.authority, 'package.authority');
    const ledger = await parseHpPipingClassReviewDispositionLedgerV2(pkg.ledger);
    const expectedHash = await hashHpPipingClassEngineeringReviewReport(pkg.report);
    if (pkg.reportSha256 !== expectedHash) {
      throw new TypeError('Review disposition v2 package report SHA-256 mismatch.');
    }
    const summary = await summarizeHpPipingClassReviewDispositionV2(ledger, pkg.report);
    if (canonicalHpPipingClassReviewJson(pkg.summary)
        !== canonicalHpPipingClassReviewJson(summary)) {
      throw new TypeError('Review disposition v2 package summary mismatch.');
    }
    return Object.freeze({
      ok: true,
      reportSha256: expectedHash,
      currentRecordCount: summary.currentRecordCount,
      historicalRecordCount: summary.historicalRecordCount,
      hashChainedV2RecordCount: summary.hashChainedV2RecordCount,
      legacyV1RecordCount: summary.legacyV1RecordCount,
      chainHeadSha256: summary.chainHeadSha256,
      chainIntegrity: 'INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY',
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: String(error?.message || error),
      reportSha256: null,
      currentRecordCount: 0,
      historicalRecordCount: 0,
      hashChainedV2RecordCount: 0,
      legacyV1RecordCount: 0,
      chainHeadSha256: null,
      chainIntegrity: null,
    });
  }
}
