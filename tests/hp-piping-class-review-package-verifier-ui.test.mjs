import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const verifier = await readFile(new URL('../tabs/hp-piping-class-review-package-verifier.js', import.meta.url), 'utf8');
const tab = await readFile(new URL('../tabs/hp-piping-class-review-package-verifier-tab.js', import.meta.url), 'utf8');
const disposition = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition.js', import.meta.url), 'utf8');

test('verifier remains read-only with respect to HP project and review ledger storage', () => {
  assert.match(tab, /This tool does not import or modify the HP engineering project/);
  assert.doesNotMatch(tab, /localStorage\.setItem|sessionStorage\.setItem|HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY|HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY|data-hpwb-bind/);
});

test('UI distinguishes v2 chain self-consistency from legacy v1 and identity authentication', () => {
  for (const token of [
    'PACKAGE SELF-CONSISTENCY VERIFIED', 'v2 review entries form a verified SHA-256 hash chain', 'v1 review entries are not hash-chained or digitally signed',
    'Reviewer/checker identity is user-declared', 'does not mean design-approved', 'v1 / v2', 'Ledger chain head', 'Entry hash',
  ]) assert.ok(tab.includes(token), `missing verifier disclosure: ${token}`);
  assert.match(verifier, /ledgerEntryCryptographicIntegrity: packageVerification\.ledgerEntryCryptographicIntegrity/);
  assert.match(verifier, /reviewerIdentityAuthentication: 'NOT_AVAILABLE_USER_DECLARED'/);
  assert.match(verifier, /digitalSignature: false/); assert.match(verifier, /codeCompliance: false/); assert.match(verifier, /designAuthority: false/); assert.match(verifier, /releaseAuthority: false/);
});

test('v2 chain verifier is required by the disposition package path', () => {
  assert.match(disposition, /verifyHpPipingClassReviewDispositionLedgerChain/);
  assert.match(disposition, /ledgerHeadSha256/);
  assert.match(disposition, /hp-piping-class-engineering-review-disposition-ledger\/v2/);
  assert.match(disposition, /hp-piping-class-engineering-review-disposition-package\/v2/);
});

test('verifier recomputes package summary rather than trusting exported summary text', () => {
  assert.match(verifier, /summarizeHpPipingClassReviewDisposition/);
  assert.match(verifier, /canonicalJson\(pkg\.summary\) !== canonicalJson\(recomputedSummary\)/);
  assert.match(verifier, /HP_REVIEW_PACKAGE_SUMMARY_MISMATCH/);
});

test('verifier uses existing disposition/report validators and adds no engineering formula path', () => {
  assert.match(verifier, /verifyHpPipingClassReviewDispositionPackage/); assert.match(verifier, /verifyHpPipingClassEngineeringReviewReportRoundTrip/); assert.match(verifier, /parseHpPipingClassReviewDispositionLedger/);
  assert.doesNotMatch(verifier, /Math\.exp|Math\.log/); assert.doesNotMatch(tab, /Math\.exp|Math\.log/);
});

test('verification receipt export stays gated on successful verification', () => {
  assert.match(tab, /data-hp-review-package-action="receipt" disabled/); assert.match(tab, /receiptButton\.disabled = !state\.result\?\.ok/); assert.match(tab, /serializeHpPipingClassReviewPackageVerificationReceipt/);
});
