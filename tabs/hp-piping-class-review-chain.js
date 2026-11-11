export const HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY = 'SHA256_HASH_CHAIN_SELF_CONSISTENCY_VERIFIED';
export const HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1 = 'NOT_AVAILABLE_V1';

const SHA256 = /^[0-9a-f]{64}$/u;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is required for HP review custody integrity.');
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashHpPipingClassReviewDispositionEntry(entry) {
  const payload = clone(entry);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('HP review disposition entry must be an object.');
  delete payload.entrySha256;
  return sha256(payload);
}

export async function verifyHpPipingClassReviewDispositionLedgerChain(ledger) {
  try {
    if (ledger?.schemaVersion === 'hp-piping-class-engineering-review-disposition-ledger/v1') {
      return Object.freeze({
        ok: true,
        integrity: HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1,
        entryCount: Array.isArray(ledger.entries) ? ledger.entries.length : 0,
        ledgerHeadSha256: null,
      });
    }
    if (ledger?.schemaVersion !== 'hp-piping-class-engineering-review-disposition-ledger/v2') {
      throw new TypeError('Unsupported HP review disposition ledger schema for chain verification.');
    }
    let priorHash = null;
    for (const [index, entry] of (ledger.entries ?? []).entries()) {
      const path = `ledger.entries[${index}]`;
      if (entry.previousEntrySha256 !== priorHash) throw new TypeError(`${path}.previousEntrySha256 does not match the preceding entry hash.`);
      if (!SHA256.test(String(entry.entrySha256 ?? ''))) throw new TypeError(`${path}.entrySha256 must be a SHA-256 digest.`);
      const expected = await hashHpPipingClassReviewDispositionEntry(entry);
      if (entry.entrySha256 !== expected) throw new TypeError(`${path}.entrySha256 does not match the canonical entry payload.`);
      priorHash = entry.entrySha256;
    }
    return Object.freeze({
      ok: true,
      integrity: HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY,
      entryCount: ledger.entries?.length ?? 0,
      ledgerHeadSha256: priorHash,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      integrity: null,
      entryCount: 0,
      ledgerHeadSha256: null,
      error: String(error?.message || error),
    });
  }
}
