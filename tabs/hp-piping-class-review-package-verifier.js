import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION,
  HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY,
  HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1,
  parseHpPipingClassReviewDispositionLedger,
  summarizeHpPipingClassReviewDisposition,
  verifyHpPipingClassReviewDispositionPackage,
} from './hp-piping-class-engineering-review-disposition.js';
import {
  parseHpPipingClassReviewDispositionLedgerV2,
  summarizeHpPipingClassReviewDispositionV2,
} from './hp-piping-class-engineering-review-disposition-v2.js';
import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2,
  verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint,
  verifyHpPipingClassReviewDispositionPackageV2,
} from './hp-piping-class-engineering-review-disposition-package-v2.js';
import {
  HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION,
  verifyHpPipingClassEngineeringReviewReportRoundTrip,
} from './hp-piping-class-engineering-review-report.js';
import { canonicalHpPipingClassReviewJson } from './hp-piping-class-review-disposition-chain-v2.js';

export const HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION =
  'hp-piping-class-review-package-verification-receipt/v1';
export const HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION_V2 =
  'hp-piping-class-review-package-verification-receipt/v2';

function text(value) {
  return String(value ?? '').trim();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  return canonicalHpPipingClassReviewJson(value);
}

function identity(report = {}) {
  return Object.freeze({ projectId: text(report.identity?.projectId), classId: text(report.identity?.classId), revision: text(report.identity?.revision) });
}

function trustMatrixV1() {
  return Object.freeze({
    reportContentSha256Binding: 'PASS',
    embeddedReportSchemaRoundTrip: 'PASS',
    ledgerStructuralValidation: 'PASS',
    storedSummaryRecomputation: 'PASS',
    ledgerEntryCryptographicIntegrity: 'NOT_AVAILABLE_V1',
    legacyV1EntryCryptographicIntegrity: 'NOT_APPLICABLE_V1_PACKAGE',
    externalCheckpointVerification: 'NOT_APPLICABLE_V1',
    reviewerIdentityAuthentication: 'NOT_AVAILABLE_USER_DECLARED',
    digitalSignature: false,
    nativeCoreKd3Qualified: false,
    codeCompliance: false,
    designAuthority: false,
    releaseAuthority: false,
  });
}

function trustMatrixV2({ checkpointVerified = false, legacyCount = 0 } = {}) {
  return Object.freeze({
    reportContentSha256Binding: 'PASS',
    embeddedReportSchemaRoundTrip: 'PASS',
    ledgerStructuralValidation: 'PASS',
    storedSummaryRecomputation: 'PASS',
    ledgerEntryCryptographicIntegrity: checkpointVerified
      ? 'PASS_AGAINST_EXTERNAL_CHECKPOINT'
      : 'INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY',
    legacyV1EntryCryptographicIntegrity: legacyCount > 0
      ? 'NOT_AVAILABLE_V1'
      : 'NOT_PRESENT',
    externalCheckpointVerification: checkpointVerified ? 'PASS' : 'NOT_SUPPLIED',
    reviewerIdentityAuthentication: 'NOT_AVAILABLE_USER_DECLARED',
    digitalSignature: false,
    nativeCoreKd3Qualified: false,
    codeCompliance: false,
    designAuthority: false,
    releaseAuthority: false,
  });
}
function issue(code, message) { return Object.freeze({ code, message: String(message ?? '') }); }
function assertPackageShape(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw Object.assign(new TypeError('HP review package must be a JSON object.'), {
      code: 'HP_REVIEW_PACKAGE_OBJECT_REQUIRED',
    });
  }
  if (![HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION,
    HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2].includes(pkg.schemaVersion)) {
    throw Object.assign(
      new TypeError(`Unsupported HP review package schema ${text(pkg.schemaVersion) || '(blank)'}.`),
      { code: 'HP_REVIEW_PACKAGE_SCHEMA_UNSUPPORTED' },
    );
  }
  if (pkg.report?.schemaVersion !== HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION) {
    throw Object.assign(new TypeError('Embedded engineering-review report schema is unsupported.'), {
      code: 'HP_REVIEW_PACKAGE_REPORT_SCHEMA_UNSUPPORTED',
    });
  }
}

async function verifyV1(pkg) {
  const packageVerification = await verifyHpPipingClassReviewDispositionPackage(pkg);
  if (!packageVerification.ok) {
    throw Object.assign(
      new TypeError(packageVerification.error || 'Review package verification failed.'),
      { code: 'HP_REVIEW_PACKAGE_CONTENT_BINDING_FAILED' },
    );
  }
  const ledger = parseHpPipingClassReviewDispositionLedger(pkg.ledger);
  const recomputedSummary = await summarizeHpPipingClassReviewDisposition(ledger, pkg.report);
  if (canonicalJson(pkg.summary) !== canonicalJson(recomputedSummary)) {
    throw Object.assign(
      new TypeError('Stored review-package summary does not match a fresh recomputation.'),
      { code: 'HP_REVIEW_PACKAGE_SUMMARY_MISMATCH' },
    );
  }
  const reportIdentity = identity(pkg.report);
  const currentHash = packageVerification.reportSha256;
  const currentEntries = ledger.entries.filter((entry) => entry.reportSha256 === currentHash
    && entry.projectId === reportIdentity.projectId
    && entry.classId === reportIdentity.classId
    && entry.revision === reportIdentity.revision);
  const historicalEntries = ledger.entries.filter((entry) => !currentEntries.includes(entry));
  return {
    ledger,
    recomputedSummary,
    currentEntries,
    historicalEntries,
    packageVerification,
    trust: trustMatrixV1(),
    checkpointVerification: null,
  };
}

async function verifyV2(pkg, checkpoint) {
  const packageVerification = await verifyHpPipingClassReviewDispositionPackageV2(pkg);
  if (!packageVerification.ok) {
    throw Object.assign(
      new TypeError(packageVerification.error || 'Review v2 package verification failed.'),
      { code: 'HP_REVIEW_PACKAGE_CONTENT_BINDING_FAILED' },
    );
  }
  const ledger = await parseHpPipingClassReviewDispositionLedgerV2(pkg.ledger);
  const recomputedSummary = await summarizeHpPipingClassReviewDispositionV2(ledger, pkg.report);
  if (canonicalJson(pkg.summary) !== canonicalJson(recomputedSummary)) {
    throw Object.assign(
      new TypeError('Stored review-package v2 summary does not match a fresh recomputation.'),
      { code: 'HP_REVIEW_PACKAGE_SUMMARY_MISMATCH' },
    );
  }
  let checkpointVerification = null;
  if (checkpoint) {
    try {
      checkpointVerification = await verifyHpPipingClassReviewDispositionLedgerV2AgainstCheckpoint(
        ledger,
        checkpoint,
      );
    } catch (error) {
      throw Object.assign(new TypeError(error.message), {
        code: 'HP_REVIEW_PACKAGE_CHECKPOINT_MISMATCH',
      });
    }
  }
  return {
    ledger,
    recomputedSummary,
    currentEntries: [...recomputedSummary.currentEntries],
    historicalEntries: [...recomputedSummary.historicalEntries],
    packageVerification,
    trust: trustMatrixV2({
      checkpointVerified: Boolean(checkpointVerification?.ok),
      legacyCount: recomputedSummary.legacyV1RecordCount,
    }),
    checkpointVerification,
  };
}

function receiptLimitations(pkg, trust) {
  if (pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2) {
    return Object.freeze([
      'PASS always includes report hash, report schema, ledger structure, chain arithmetic and stored-summary self-consistency.',
      trust.externalCheckpointVerification === 'PASS'
        ? 'The v2 ledger prefix also matches the separately supplied checkpoint.'
        : 'No external checkpoint was supplied; the v2 hash chain therefore establishes internal consistency only.',
      'Legacy v1 entries are not retroactively authenticated by the v2 anchor.',
      'Reviewer/checker identity remains USER_DECLARED and is not authenticated by PKI or digital signature.',
      'Native CORE KD-3 / KD320 remains not qualified by this verification.',
      'This verification does not establish ASME Code compliance, design approval or release authority.',
    ]);
  }
  return Object.freeze([
    'PASS means the embedded report hash, report schema round trip, ledger structure/authority and stored summary are internally consistent.',
    'The v1 review ledger is not a cryptographic hash chain; independently modified review-entry content cannot be proven authentic from this package alone.',
    'Reviewer/checker identity is USER_DECLARED and is not authenticated by PKI or digital signature.',
    'Native CORE KD-3 / KD320 remains not qualified by this verification.',
    'This verification does not establish ASME Code compliance, design approval or release authority.',
  ]);
}

export async function verifyHpPipingClassReviewPackageObject(packageValue, {
  checkpoint = null,
} = {}) {
  try {
    const pkg = clone(packageValue);
    assertPackageShape(pkg);
    if (checkpoint && pkg.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2) {
      throw Object.assign(new TypeError('External checkpoints apply only to v2 review packages.'), {
        code: 'HP_REVIEW_PACKAGE_CHECKPOINT_NOT_APPLICABLE_V1',
      });
    }

    const reportVerification = verifyHpPipingClassEngineeringReviewReportRoundTrip(pkg.report);
    if (!reportVerification.ok) {
      throw Object.assign(
        new TypeError(reportVerification.error || 'Embedded engineering-review report round trip failed.'),
        { code: 'HP_REVIEW_PACKAGE_REPORT_ROUNDTRIP_FAILED' },
      );
    }

    const verified = pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2
      ? await verifyV2(pkg, checkpoint)
      : await verifyV1(pkg);
    const current = verified.currentEntries.at(-1) ?? null;
    const isV2 = pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION_V2;
    const receipt = Object.freeze({
      schemaVersion: isV2
        ? HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION_V2
        : HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION,
      verificationPurpose: 'INDEPENDENT_REVIEW_PACKAGE_SELF_CONSISTENCY',
      verificationAuthority: isV2 && verified.checkpointVerification?.ok
        ? 'PACKAGE_CHAIN_CHECKPOINT_VERIFICATION_ONLY'
        : 'PACKAGE_SELF_CONSISTENCY_ONLY',
      packageSchemaVersion: pkg.schemaVersion,
      reportSchemaVersion: pkg.report.schemaVersion,
      reportSha256: verified.packageVerification.reportSha256,
      identity: identity(pkg.report),
      currentDisposition: current?.disposition ?? 'PENDING_REVIEW',
      currentActor: current?.actor ?? null,
      currentRole: current?.role ?? null,
      currentRecordedAt: current?.recordedAt ?? null,
      currentRecordCount: verified.currentEntries.length,
      historicalRecordCount: verified.historicalEntries.length,
      currentEntryIntegrity: current?.integrityClass ?? (isV2 ? null : 'LEGACY_V1_UNSEALED'),
      hashChainedV2RecordCount: verified.recomputedSummary.hashChainedV2RecordCount ?? 0,
      legacyV1RecordCount: verified.recomputedSummary.legacyV1RecordCount ?? 0,
      chainHeadSha256: verified.recomputedSummary.chainHeadSha256 ?? null,
      checkpointVerification: verified.checkpointVerification,
      reportProductCount: pkg.report.productResults?.length ?? 0,
      reportCycleCount: pkg.report.cycleResults?.length ?? 0,
      externalKdCustodyCount: pkg.report.externalKdCustody?.length ?? 0,
      projectState: text(pkg.report.reviewSummary?.projectState) || null,
      trust: verified.trust,
      limitations: receiptLimitations(pkg, verified.trust),
    });
    return Object.freeze({
      ok: true,
      package: Object.freeze(pkg),
      ledger: verified.ledger,
      recomputedSummary: verified.recomputedSummary,
      currentEntries: Object.freeze(
        verified.currentEntries.map((entry) => Object.freeze(clone(entry))),
      ),
      historicalEntries: Object.freeze(
        verified.historicalEntries.map((entry) => Object.freeze(clone(entry))),
      ),
      receipt,
      issues: Object.freeze([]),
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      package: null,
      ledger: null,
      recomputedSummary: null,
      currentEntries: Object.freeze([]),
      historicalEntries: Object.freeze([]),
      receipt: null,
      issues: Object.freeze([
        issue(error?.code || 'HP_REVIEW_PACKAGE_VERIFICATION_FAILED', error?.message || error),
      ]),
    });
  }
}

export async function verifyHpPipingClassReviewPackageJson(textValue, {
  checkpointText = '',
} = {}) {
  let parsed;
  let checkpoint = null;
  try {
    parsed = JSON.parse(String(textValue ?? ''));
  } catch (error) {
    return Object.freeze({
      ok: false,
      package: null,
      ledger: null,
      recomputedSummary: null,
      currentEntries: Object.freeze([]),
      historicalEntries: Object.freeze([]),
      receipt: null,
      issues: Object.freeze([
        issue('HP_REVIEW_PACKAGE_JSON_INVALID', `Review package JSON is invalid: ${error.message}`),
      ]),
    });
  }
  if (String(checkpointText ?? '').trim()) {
    try {
      checkpoint = JSON.parse(String(checkpointText));
    } catch (error) {
      return Object.freeze({
        ok: false,
        package: null,
        ledger: null,
        recomputedSummary: null,
        currentEntries: Object.freeze([]),
        historicalEntries: Object.freeze([]),
        receipt: null,
        issues: Object.freeze([
          issue('HP_REVIEW_CHECKPOINT_JSON_INVALID', `Checkpoint JSON is invalid: ${error.message}`),
        ]),
      });
    }
  }
  return verifyHpPipingClassReviewPackageObject(parsed, { checkpoint });
}

export function serializeHpPipingClassReviewPackageVerificationReceipt(receipt) {
  const trust = receipt?.trust ?? {};
  if (receipt?.schemaVersion === HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION) {
    if (
      receipt.verificationAuthority !== 'PACKAGE_SELF_CONSISTENCY_ONLY'
      || trust.ledgerEntryCryptographicIntegrity !== 'NOT_AVAILABLE_V1'
      || trust.reviewerIdentityAuthentication !== 'NOT_AVAILABLE_USER_DECLARED'
      || trust.digitalSignature !== false
      || trust.nativeCoreKd3Qualified !== false
      || trust.codeCompliance !== false
      || trust.designAuthority !== false
      || trust.releaseAuthority !== false
    ) {
      throw new TypeError(
        'HP v1 review-package verification receipt cannot promote integrity, identity or engineering authority.',
      );
    }
    return `${JSON.stringify(receipt, null, 2)}\n`;
  }

  if (receipt?.schemaVersion !== HP_PIPING_CLASS_REVIEW_PACKAGE_VERIFICATION_RECEIPT_VERSION_V2) {
    throw new TypeError('Unsupported HP review-package verification receipt schema.');
  }
  const checkpointPass = trust.externalCheckpointVerification === 'PASS';
  const expectedAuthority = checkpointPass
    ? 'PACKAGE_CHAIN_CHECKPOINT_VERIFICATION_ONLY'
    : 'PACKAGE_SELF_CONSISTENCY_ONLY';
  const expectedIntegrity = checkpointPass
    ? 'PASS_AGAINST_EXTERNAL_CHECKPOINT'
    : 'INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY';
  if (
    receipt.verificationAuthority !== expectedAuthority
    || trust.ledgerEntryCryptographicIntegrity !== expectedIntegrity
    || trust.reviewerIdentityAuthentication !== 'NOT_AVAILABLE_USER_DECLARED'
    || trust.digitalSignature !== false
    || trust.nativeCoreKd3Qualified !== false
    || trust.codeCompliance !== false
    || trust.designAuthority !== false
    || trust.releaseAuthority !== false
  ) {
    throw new TypeError(
      'HP v2 review-package verification receipt cannot promote checkpoint, identity or engineering authority.',
    );
  }
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
