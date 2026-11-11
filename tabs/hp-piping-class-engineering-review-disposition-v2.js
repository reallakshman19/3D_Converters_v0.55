import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITIONS,
  HP_PIPING_CLASS_REVIEW_ROLES,
  hashHpPipingClassEngineeringReviewReport,
  parseHpPipingClassReviewDispositionLedger,
} from './hp-piping-class-engineering-review-disposition.js';
import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_CANONICALIZATION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256,
  createHpPipingClassReviewDispositionChainMetadata,
  hashHpPipingClassReviewCanonicalValue,
  hashHpPipingClassReviewDispositionEntryV2,
  isHpPipingClassReviewSha256,
} from './hp-piping-class-review-disposition-chain-v2.js';

export const HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2 =
  'hp-piping-class-engineering-review-disposition-ledger/v2';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_ENTRY_VERSION_V2 =
  'hp-piping-class-engineering-review-disposition-entry/v2';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? '').trim();
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

function assertIso(value, path) {
  const candidate = text(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) {
    throw new TypeError(`${path} must be a valid ISO date-time.`);
  }
  return new Date(candidate).toISOString();
}

function reportIdentity(report) {
  return {
    projectId: text(report?.identity?.projectId),
    classId: text(report?.identity?.classId),
    revision: text(report?.identity?.revision),
  };
}

export function createHpPipingClassReviewDispositionLedgerV2() {
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2,
    authority: authority(),
    chain: createHpPipingClassReviewDispositionChainMetadata(),
    legacyV1Ledger: null,
    entries: Object.freeze([]),
  });
}

export async function anchorHpPipingClassReviewDispositionLedgerV1ToV2(value) {
  const legacy = parseHpPipingClassReviewDispositionLedger(value);
  const anchor = await hashHpPipingClassReviewCanonicalValue(legacy);
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2,
    authority: authority(),
    chain: createHpPipingClassReviewDispositionChainMetadata({
      legacyV1AnchorSha256: anchor,
      legacyV1EntryCount: legacy.entries.length,
    }),
    legacyV1Ledger: legacy,
    entries: Object.freeze([]),
  });
}

function assertEntry(entry, index, expectedSequence, expectedPrevious) {
  const path = `ledger.entries[${index}]`;
  if (entry?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_ENTRY_VERSION_V2) {
    throw new TypeError(`${path}.schemaVersion is unsupported.`);
  }
  if (!text(entry.entryId)) throw new TypeError(`${path}.entryId is required.`);
  if (entry.sequence !== expectedSequence) {
    throw new TypeError(`${path}.sequence must continue the legacy/v2 append-only sequence.`);
  }
  if (entry.previousEntrySha256 !== expectedPrevious) {
    throw new TypeError(`${path}.previousEntrySha256 does not match the chain predecessor.`);
  }
  for (const field of ['reportSha256', 'entrySha256']) {
    if (!isHpPipingClassReviewSha256(entry[field])) {
      throw new TypeError(`${path}.${field} must be SHA-256.`);
    }
  }
  for (const field of ['projectId', 'classId', 'revision', 'actor']) {
    if (!text(entry[field])) throw new TypeError(`${path}.${field} is required.`);
  }
  if (!HP_PIPING_CLASS_REVIEW_ROLES.includes(entry.role)) {
    throw new TypeError(`${path}.role is unsupported.`);
  }
  if (!HP_PIPING_CLASS_REVIEW_DISPOSITIONS.includes(entry.disposition)) {
    throw new TypeError(`${path}.disposition is unsupported.`);
  }
  assertIso(entry.recordedAt, `${path}.recordedAt`);
  if (
    ['COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW'].includes(entry.disposition)
    && !text(entry.comment)
  ) {
    throw new TypeError(`${path}.comment is required for ${entry.disposition}.`);
  }
  assertAuthority(entry.authority, `${path}.authority`);
}

export async function parseHpPipingClassReviewDispositionLedgerV2(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : clone(value);
  if (parsed?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION_V2) {
    throw new TypeError('Unsupported HP review disposition v2 ledger schema.');
  }
  assertAuthority(parsed.authority, 'ledger.authority');
  if (
    parsed.chain?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_VERSION
    || parsed.chain?.algorithm !== 'SHA-256'
    || parsed.chain?.canonicalization
      !== HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_CANONICALIZATION
    || parsed.chain?.genesisPreviousSha256
      !== HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256
  ) {
    throw new TypeError('HP review disposition v2 chain metadata is invalid.');
  }

  let legacy = null;
  let legacyAnchor = null;
  let legacyCount = 0;
  if (parsed.legacyV1Ledger != null) {
    legacy = parseHpPipingClassReviewDispositionLedger(parsed.legacyV1Ledger);
    legacyAnchor = await hashHpPipingClassReviewCanonicalValue(legacy);
    legacyCount = legacy.entries.length;
    if (parsed.chain.legacyV1AnchorSha256 !== legacyAnchor) {
      throw new TypeError('HP review disposition v2 legacy anchor SHA-256 mismatch.');
    }
    if (parsed.chain.legacyV1EntryCount !== legacyCount) {
      throw new TypeError('HP review disposition v2 legacy entry count mismatch.');
    }
  } else if (
    parsed.chain.legacyV1AnchorSha256 !== null
    || parsed.chain.legacyV1EntryCount !== 0
  ) {
    throw new TypeError(
      'HP review disposition v2 legacy chain metadata exists without a legacy ledger snapshot.',
    );
  }

  if (!Array.isArray(parsed.entries)) {
    throw new TypeError('HP review disposition v2 entries must be an array.');
  }
  let previous = legacyAnchor ?? HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256;
  const ids = new Set();
  for (const [index, entry] of parsed.entries.entries()) {
    assertEntry(entry, index, legacyCount + index + 1, previous);
    if (ids.has(entry.entryId)) {
      throw new TypeError(`ledger.entries[${index}].entryId must be unique.`);
    }
    ids.add(entry.entryId);
    const expectedHash = await hashHpPipingClassReviewDispositionEntryV2(entry);
    if (entry.entrySha256 !== expectedHash) {
      throw new TypeError(
        `ledger.entries[${index}].entrySha256 does not match immutable entry content.`,
      );
    }
    previous = entry.entrySha256;
  }
  if (parsed.chain.headEntrySha256 !== previous) {
    throw new TypeError('HP review disposition v2 chain head mismatch.');
  }

  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    authority: authority(),
    chain: createHpPipingClassReviewDispositionChainMetadata({
      legacyV1AnchorSha256: legacyAnchor,
      legacyV1EntryCount: legacyCount,
      headEntrySha256: previous,
    }),
    legacyV1Ledger: legacy,
    entries: Object.freeze(parsed.entries.map((entry) => Object.freeze(clone(entry)))),
  });
}

export async function resolveHpPipingClassReviewDispositionLedgerV2({
  v2Value = null,
  v1Value = null,
} = {}) {
  if (v2Value) return parseHpPipingClassReviewDispositionLedgerV2(v2Value);
  if (v1Value) return anchorHpPipingClassReviewDispositionLedgerV1ToV2(v1Value);
  return createHpPipingClassReviewDispositionLedgerV2();
}

export async function appendHpPipingClassReviewDispositionV2(
  ledgerValue,
  report,
  input = {},
) {
  const ledger = ledgerValue
    ? await parseHpPipingClassReviewDispositionLedgerV2(ledgerValue)
    : createHpPipingClassReviewDispositionLedgerV2();
  const actor = text(input.actor);
  if (!actor) throw new TypeError('Reviewer/checker identity is required.');
  const role = text(input.role).toUpperCase();
  if (!HP_PIPING_CLASS_REVIEW_ROLES.includes(role)) {
    throw new TypeError(`Unsupported review role ${role || '(blank)'}.`);
  }
  const disposition = text(input.disposition).toUpperCase();
  if (!HP_PIPING_CLASS_REVIEW_DISPOSITIONS.includes(disposition)) {
    throw new TypeError(`Unsupported review disposition ${disposition || '(blank)'}.`);
  }
  const comment = text(input.comment);
  if (
    ['COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW'].includes(disposition)
    && !comment
  ) {
    throw new TypeError(`A comment is required for ${disposition}.`);
  }
  const recordedAt = assertIso(input.recordedAt ?? new Date().toISOString(), 'recordedAt');
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const identity = reportIdentity(report);
  if (Object.values(identity).some((value) => !value)) {
    throw new TypeError('Report project/class/revision identity is incomplete.');
  }

  const sequence = ledger.chain.legacyV1EntryCount + ledger.entries.length + 1;
  const entryBase = {
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_ENTRY_VERSION_V2,
    entryId: [
      identity.classId,
      identity.revision,
      'v2',
      String(sequence).padStart(4, '0'),
      reportSha256.slice(0, 16),
    ].join(':'),
    sequence,
    previousEntrySha256: ledger.chain.headEntrySha256,
    reportSchemaVersion: report.schemaVersion,
    reportSha256,
    ...identity,
    role,
    actor,
    disposition,
    comment: comment || null,
    recordedAt,
    authority: authority(),
  };
  const entrySha256 = await hashHpPipingClassReviewDispositionEntryV2(entryBase);
  const entry = Object.freeze({ ...entryBase, entrySha256 });
  return Object.freeze({
    schemaVersion: ledger.schemaVersion,
    authority: authority(),
    chain: createHpPipingClassReviewDispositionChainMetadata({
      legacyV1AnchorSha256: ledger.chain.legacyV1AnchorSha256,
      legacyV1EntryCount: ledger.chain.legacyV1EntryCount,
      headEntrySha256: entrySha256,
    }),
    legacyV1Ledger: ledger.legacyV1Ledger,
    entries: Object.freeze([...ledger.entries, entry]),
  });
}

function combinedEntries(ledger) {
  const legacy = (ledger.legacyV1Ledger?.entries ?? []).map((entry) => Object.freeze({
    ...clone(entry),
    integrityClass: 'LEGACY_V1_UNSEALED',
  }));
  const chained = ledger.entries.map((entry) => Object.freeze({
    ...clone(entry),
    integrityClass: 'HASH_CHAIN_V2',
  }));
  return [...legacy, ...chained];
}

export async function summarizeHpPipingClassReviewDispositionV2(ledgerValue, report) {
  const ledger = ledgerValue
    ? await parseHpPipingClassReviewDispositionLedgerV2(ledgerValue)
    : createHpPipingClassReviewDispositionLedgerV2();
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const identity = reportIdentity(report);
  const allEntries = combinedEntries(ledger);
  const currentEntries = allEntries.filter((entry) => (
    entry.reportSha256 === reportSha256
    && entry.projectId === identity.projectId
    && entry.classId === identity.classId
    && entry.revision === identity.revision
  ));
  const historicalEntries = allEntries.filter((entry) => !currentEntries.includes(entry));
  const latest = currentEntries.at(-1) ?? null;
  return Object.freeze({
    reportSha256,
    identity: Object.freeze(identity),
    currentEntries: Object.freeze(currentEntries),
    historicalEntries: Object.freeze(historicalEntries),
    currentDisposition: latest?.disposition ?? 'PENDING_REVIEW',
    currentActor: latest?.actor ?? null,
    currentRole: latest?.role ?? null,
    currentRecordedAt: latest?.recordedAt ?? null,
    currentEntryIntegrity: latest?.integrityClass ?? null,
    currentRecordCount: currentEntries.length,
    historicalRecordCount: historicalEntries.length,
    legacyV1RecordCount: ledger.chain.legacyV1EntryCount,
    hashChainedV2RecordCount: ledger.entries.length,
    chainHeadSha256: ledger.chain.headEntrySha256,
    legacyV1AnchorSha256: ledger.chain.legacyV1AnchorSha256,
    authority: authority(),
  });
}

export { HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION };
