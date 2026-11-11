export const HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_VERSION =
  'hp-piping-class-review-disposition-sha256-chain/v1';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256 = '0'.repeat(64);
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_CANONICALIZATION =
  'SORTED_JSON_KEYS_RECURSIVE/v1';

const SHA256 = /^[0-9a-f]{64}$/u;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalHpPipingClassReviewJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function isHpPipingClassReviewSha256(value) {
  return SHA256.test(String(value ?? ''));
}

export async function hashHpPipingClassReviewCanonicalValue(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is required for HP review hash-chain custody.');
  }
  const bytes = new TextEncoder().encode(canonicalHpPipingClassReviewJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function hpPipingClassReviewDispositionEntryHashMaterial(entry) {
  return Object.freeze({
    schemaVersion: entry.schemaVersion,
    entryId: entry.entryId,
    sequence: entry.sequence,
    previousEntrySha256: entry.previousEntrySha256,
    reportSchemaVersion: entry.reportSchemaVersion,
    reportSha256: entry.reportSha256,
    projectId: entry.projectId,
    classId: entry.classId,
    revision: entry.revision,
    role: entry.role,
    actor: entry.actor,
    disposition: entry.disposition,
    comment: entry.comment ?? null,
    recordedAt: entry.recordedAt,
    authority: clone(entry.authority),
  });
}

export async function hashHpPipingClassReviewDispositionEntryV2(entry) {
  return hashHpPipingClassReviewCanonicalValue(
    hpPipingClassReviewDispositionEntryHashMaterial(entry),
  );
}

export function createHpPipingClassReviewDispositionChainMetadata({
  legacyV1AnchorSha256 = null,
  legacyV1EntryCount = 0,
  headEntrySha256 = null,
} = {}) {
  const initialHead = legacyV1AnchorSha256
    ?? HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256;
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_VERSION,
    algorithm: 'SHA-256',
    canonicalization: HP_PIPING_CLASS_REVIEW_DISPOSITION_CHAIN_CANONICALIZATION,
    genesisPreviousSha256: HP_PIPING_CLASS_REVIEW_DISPOSITION_ZERO_SHA256,
    legacyV1AnchorSha256,
    legacyV1EntryCount,
    headEntrySha256: headEntrySha256 ?? initialHead,
  });
}
