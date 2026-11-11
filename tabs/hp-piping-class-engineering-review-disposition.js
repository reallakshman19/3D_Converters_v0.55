import {
  HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION,
  serializeHpPipingClassEngineeringReviewReportJson,
} from './hp-piping-class-engineering-review-report.js';
import {
  HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY,
  HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1,
  hashHpPipingClassReviewDispositionEntry,
  verifyHpPipingClassReviewDispositionLedgerChain,
} from './hp-piping-class-review-chain.js';

export const HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION = 'hp-piping-class-engineering-review-disposition-ledger/v1';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION = 'hp-piping-class-engineering-review-disposition-ledger/v2';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION = 'hp-piping-class-engineering-review-disposition-package/v1';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION = 'hp-piping-class-engineering-review-disposition-package/v2';

export const HP_PIPING_CLASS_REVIEW_DISPOSITIONS = Object.freeze([
  'NO_OBJECTION_FOR_ENGINEERING_REVIEW',
  'COMMENTS_RECORDED',
  'REJECTED_FOR_ENGINEERING_REVIEW',
]);
export const HP_PIPING_CLASS_REVIEW_ROLES = Object.freeze(['CHECKER', 'REVIEWER']);

const SHA256 = /^[0-9a-f]{64}$/u;
const LEDGER_VERSIONS = new Set([HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION, HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION]);
const PACKAGE_VERSIONS = new Set([HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION, HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION]);
const V2_ENTRY_KEYS = new Set(['entryId', 'sequence', 'previousEntrySha256', 'entrySha256', 'reportSchemaVersion', 'reportSha256', 'projectId', 'classId', 'revision', 'role', 'actor', 'disposition', 'comment', 'recordedAt', 'authority']);

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value ?? '').trim(); }
function authority() {
  return Object.freeze({
    purpose: 'REVIEW_CUSTODY_ONLY', calculationMode: 'USER_CALCULATED_KD3', nativeCoreKd3Qualified: false,
    codeCompliance: false, canUseForDesignAuthority: false, canAuthorizeRelease: false,
    actorIdentityAuthority: 'USER_DECLARED', digitalSignature: false,
  });
}
function assertAuthority(value, path = 'authority') {
  const source = value ?? {};
  if (source.purpose !== 'REVIEW_CUSTODY_ONLY') throw new TypeError(`${path}.purpose must remain REVIEW_CUSTODY_ONLY.`);
  if (source.calculationMode !== 'USER_CALCULATED_KD3') throw new TypeError(`${path}.calculationMode must remain USER_CALCULATED_KD3.`);
  for (const field of ['nativeCoreKd3Qualified', 'codeCompliance', 'canUseForDesignAuthority', 'canAuthorizeRelease', 'digitalSignature']) {
    if (source[field] !== false) throw new TypeError(`${path}.${field} must remain false.`);
  }
  if (source.actorIdentityAuthority !== 'USER_DECLARED') throw new TypeError(`${path}.actorIdentityAuthority must remain USER_DECLARED.`);
}
function assertIso(value, path) {
  const candidate = text(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) throw new TypeError(`${path} must be a valid ISO date-time.`);
  return new Date(candidate).toISOString();
}
function assertReport(report) {
  if (report?.schemaVersion !== HP_PIPING_CLASS_ENGINEERING_REVIEW_REPORT_VERSION) throw new TypeError('A canonical hp-piping-class-engineering-review-report/v1 report is required.');
  if (report?.reportPurpose !== 'ENGINEERING_REVIEW_ONLY') throw new TypeError('Report purpose must remain ENGINEERING_REVIEW_ONLY.');
  if (report?.authority?.nativeCoreKd3Qualified !== false || report?.authority?.codeCompliance !== false || report?.authority?.canUseForDesignAuthority !== false) {
    throw new TypeError('Report authority is not eligible for review-custody binding.');
  }
}
function assertExactKeys(value, allowed, path) {
  for (const key of Object.keys(value ?? {})) if (!allowed.has(key)) throw new TypeError(`${path}.${key} is not allowed by the v2 entry contract.`);
}
function assertEntry(entry, index, schemaVersion, priorEntry) {
  const path = `ledger.entries[${index}]`;
  if (!text(entry.entryId)) throw new TypeError(`${path}.entryId must be unique and non-empty.`);
  if (!Number.isInteger(entry.sequence) || entry.sequence !== index + 1) throw new TypeError(`${path}.sequence must be append-only and contiguous.`);
  if (!SHA256.test(String(entry.reportSha256 ?? ''))) throw new TypeError(`${path}.reportSha256 must be a SHA-256 digest.`);
  for (const field of ['projectId', 'classId', 'revision', 'actor']) if (!text(entry[field])) throw new TypeError(`${path}.${field} is required.`);
  if (!HP_PIPING_CLASS_REVIEW_ROLES.includes(entry.role)) throw new TypeError(`${path}.role is unsupported.`);
  if (!HP_PIPING_CLASS_REVIEW_DISPOSITIONS.includes(entry.disposition)) throw new TypeError(`${path}.disposition is unsupported.`);
  assertIso(entry.recordedAt, `${path}.recordedAt`);
  if (['COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW'].includes(entry.disposition) && !text(entry.comment)) throw new TypeError(`${path}.comment is required for ${entry.disposition}.`);
  assertAuthority(entry.authority, `${path}.authority`);
  if (schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION) {
    assertExactKeys(entry, V2_ENTRY_KEYS, path);
    const expectedPrevious = priorEntry?.entrySha256 ?? null;
    if (entry.previousEntrySha256 !== expectedPrevious) throw new TypeError(`${path}.previousEntrySha256 must bind the preceding entry.`);
    if (!SHA256.test(String(entry.entrySha256 ?? ''))) throw new TypeError(`${path}.entrySha256 must be a SHA-256 digest.`);
  }
}

export async function hashHpPipingClassEngineeringReviewReport(report) {
  assertReport(report);
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is required for HP review disposition custody.');
  const canonical = serializeHpPipingClassEngineeringReviewReportJson(report);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createHpPipingClassReviewDispositionLedger({ schemaVersion = HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION } = {}) {
  if (!LEDGER_VERSIONS.has(schemaVersion)) throw new TypeError('Unsupported HP review disposition ledger schema.');
  return Object.freeze({ schemaVersion, authority: authority(), entries: Object.freeze([]) });
}

export function parseHpPipingClassReviewDispositionLedger(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : clone(value);
  if (!LEDGER_VERSIONS.has(parsed?.schemaVersion)) throw new TypeError('Unsupported HP review disposition ledger schema.');
  assertAuthority(parsed.authority, 'ledger.authority');
  if (!Array.isArray(parsed.entries)) throw new TypeError('HP review disposition ledger entries must be an array.');
  const ids = new Set();
  parsed.entries.forEach((entry, index) => {
    assertEntry(entry, index, parsed.schemaVersion, parsed.entries[index - 1]);
    if (ids.has(entry.entryId)) throw new TypeError(`ledger.entries[${index}].entryId must be unique and non-empty.`);
    ids.add(entry.entryId);
  });
  return Object.freeze({ schemaVersion: parsed.schemaVersion, authority: authority(), entries: Object.freeze(parsed.entries.map((entry) => Object.freeze(clone(entry)))) });
}

function reportIdentity(report) {
  return { projectId: text(report?.identity?.projectId), classId: text(report?.identity?.classId), revision: text(report?.identity?.revision) };
}
function packageVersionForLedger(ledger) {
  return ledger.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION
    ? HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION : HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION;
}
function assertPackageLedgerVersion(pkg) {
  if (pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION && pkg.ledger?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION) throw new TypeError('v2 review package requires a v2 review ledger.');
  if (pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_V1_VERSION && pkg.ledger?.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION) throw new TypeError('v1 review package requires a v1 review ledger.');
}

export async function appendHpPipingClassReviewDisposition(ledgerValue, report, input = {}) {
  const ledger = ledgerValue ? parseHpPipingClassReviewDispositionLedger(ledgerValue) : createHpPipingClassReviewDispositionLedger();
  assertReport(report);
  if (ledger.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION) {
    const integrity = await verifyHpPipingClassReviewDispositionLedgerChain(ledger);
    if (!integrity.ok) throw new TypeError(`Existing v2 review ledger hash chain is invalid: ${integrity.error}`);
  }
  const actor = text(input.actor);
  if (!actor) throw new TypeError('Reviewer/checker identity is required.');
  const role = text(input.role).toUpperCase();
  const disposition = text(input.disposition).toUpperCase();
  if (!HP_PIPING_CLASS_REVIEW_ROLES.includes(role)) throw new TypeError(`Unsupported review role ${role || '(blank)'}.`);
  if (!HP_PIPING_CLASS_REVIEW_DISPOSITIONS.includes(disposition)) throw new TypeError(`Unsupported review disposition ${disposition || '(blank)'}.`);
  const comment = text(input.comment);
  if (['COMMENTS_RECORDED', 'REJECTED_FOR_ENGINEERING_REVIEW'].includes(disposition) && !comment) throw new TypeError(`A comment is required for ${disposition}.`);
  const recordedAt = assertIso(input.recordedAt ?? new Date().toISOString(), 'recordedAt');
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const identity = reportIdentity(report);
  if (Object.values(identity).some((value) => !value)) throw new TypeError('Report project/class/revision identity is incomplete.');
  const sequence = ledger.entries.length + 1;
  const base = {
    entryId: `${identity.classId}:${identity.revision}:${reportSha256.slice(0, 16)}:${String(sequence).padStart(4, '0')}`,
    sequence, reportSchemaVersion: report.schemaVersion, reportSha256, ...identity, role, actor, disposition,
    comment: comment || null, recordedAt, authority: authority(),
  };
  let entry = base;
  if (ledger.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION) {
    const chained = { ...base, previousEntrySha256: ledger.entries.at(-1)?.entrySha256 ?? null };
    entry = { ...chained, entrySha256: await hashHpPipingClassReviewDispositionEntry(chained) };
  }
  return Object.freeze({ schemaVersion: ledger.schemaVersion, authority: authority(), entries: Object.freeze([...ledger.entries, Object.freeze(entry)]) });
}

export async function summarizeHpPipingClassReviewDisposition(ledgerValue, report) {
  const ledger = ledgerValue ? parseHpPipingClassReviewDispositionLedger(ledgerValue) : createHpPipingClassReviewDispositionLedger();
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const identity = reportIdentity(report);
  const currentEntries = ledger.entries.filter((entry) => entry.reportSha256 === reportSha256 && entry.projectId === identity.projectId && entry.classId === identity.classId && entry.revision === identity.revision);
  const historicalEntries = ledger.entries.filter((entry) => !currentEntries.includes(entry));
  return Object.freeze({
    reportSha256, identity: Object.freeze(identity), currentEntries: Object.freeze(currentEntries), historicalEntries: Object.freeze(historicalEntries),
    currentDisposition: currentEntries.at(-1)?.disposition ?? 'PENDING_REVIEW', currentActor: currentEntries.at(-1)?.actor ?? null,
    currentRole: currentEntries.at(-1)?.role ?? null, currentRecordedAt: currentEntries.at(-1)?.recordedAt ?? null,
    currentRecordCount: currentEntries.length, historicalRecordCount: historicalEntries.length, authority: authority(),
  });
}

export async function buildHpPipingClassReviewDispositionPackage(report, ledgerValue) {
  assertReport(report);
  const ledger = ledgerValue ? parseHpPipingClassReviewDispositionLedger(ledgerValue) : createHpPipingClassReviewDispositionLedger();
  const integrity = await verifyHpPipingClassReviewDispositionLedgerChain(ledger);
  if (!integrity.ok) throw new TypeError(`Review ledger integrity verification failed: ${integrity.error}`);
  const reportSha256 = await hashHpPipingClassEngineeringReviewReport(report);
  const summary = await summarizeHpPipingClassReviewDisposition(ledger, report);
  const isV2 = ledger.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION;
  return Object.freeze({
    schemaVersion: packageVersionForLedger(ledger), authority: authority(), reportSha256,
    ...(isV2 ? { ledgerHeadSha256: integrity.ledgerHeadSha256 } : {}),
    report: Object.freeze(clone(report)), ledger, summary,
    limitations: Object.freeze([
      'Review disposition records are custody records only and do not establish Code compliance.',
      'NO_OBJECTION_FOR_ENGINEERING_REVIEW is not design approval or release authorization.',
      isV2 ? 'The v2 SHA-256 entry chain provides package self-consistency and tamper-evidence only; it is not an external timestamp, signature, or proof of reviewer authenticity.' : 'Legacy v1 review entries are not hash-chained; entry-level cryptographic integrity is unavailable.',
      'Reviewer/checker identity is user-declared; this package is not a digital signature or PKI/e-signature record.',
      'Any change to the canonical engineering review report produces a different SHA-256 binding; prior records remain historical.',
      'Native CORE KD-3 / KD320 remains not qualified.',
    ]),
  });
}

export function serializeHpPipingClassReviewDispositionPackageJson(pkg) {
  if (!PACKAGE_VERSIONS.has(pkg?.schemaVersion)) throw new TypeError('Unsupported HP review disposition package schema.');
  assertAuthority(pkg.authority, 'package.authority');
  assertPackageLedgerVersion(pkg);
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export async function verifyHpPipingClassReviewDispositionPackage(pkg) {
  try {
    if (!PACKAGE_VERSIONS.has(pkg?.schemaVersion)) throw new TypeError('Unsupported HP review disposition package schema.');
    assertAuthority(pkg.authority, 'package.authority');
    assertPackageLedgerVersion(pkg);
    const ledger = parseHpPipingClassReviewDispositionLedger(pkg.ledger);
    const integrity = await verifyHpPipingClassReviewDispositionLedgerChain(ledger);
    if (!integrity.ok) throw new TypeError(`Review ledger integrity verification failed: ${integrity.error}`);
    if (pkg.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_PACKAGE_VERSION && pkg.ledgerHeadSha256 !== integrity.ledgerHeadSha256) throw new TypeError('Review disposition package ledgerHeadSha256 does not match the verified v2 chain head.');
    const expectedHash = await hashHpPipingClassEngineeringReviewReport(pkg.report);
    if (pkg.reportSha256 !== expectedHash) throw new TypeError('Review disposition package report SHA-256 does not match the embedded report.');
    const summary = await summarizeHpPipingClassReviewDisposition(ledger, pkg.report);
    if (summary.reportSha256 !== pkg.reportSha256) throw new TypeError('Review disposition summary/report binding mismatch.');
    return Object.freeze({
      ok: true, reportSha256: expectedHash, currentRecordCount: summary.currentRecordCount, historicalRecordCount: summary.historicalRecordCount,
      ledgerEntryCryptographicIntegrity: integrity.integrity, ledgerHeadSha256: integrity.ledgerHeadSha256,
    });
  } catch (error) {
    return Object.freeze({ ok: false, error: String(error?.message || error), reportSha256: null, currentRecordCount: 0, historicalRecordCount: 0, ledgerEntryCryptographicIntegrity: null, ledgerHeadSha256: null });
  }
}

export { HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY, HP_PIPING_CLASS_REVIEW_CHAIN_NOT_AVAILABLE_V1, verifyHpPipingClassReviewDispositionLedgerChain };
