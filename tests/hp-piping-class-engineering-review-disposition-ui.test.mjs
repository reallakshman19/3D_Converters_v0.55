import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const core = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition.js', import.meta.url), 'utf8');
const enhancer = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition-enhancer.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../tabs/engineering-workspace-tab.js', import.meta.url), 'utf8');

test('active HP route composes review disposition after report export and cleans it up independently', () => {
  assert.match(route, /hp-piping-class-engineering-review-report-enhancer\.js/);
  assert.match(route, /hp-piping-class-engineering-review-disposition-enhancer\.js/);
  assert.match(route, /installHpPipingClassEngineeringReviewDispositionEnhancer/);
  assert.match(route, /destroyReviewDisposition/);
});

test('disposition enhancer re-evaluates the canonical project instead of trusting visible report text', () => {
  assert.match(enhancer, /validateHpPipingClassProject/);
  assert.match(enhancer, /evaluateHpPipingClassProject/);
  assert.match(enhancer, /buildHpPipingClassEngineeringReviewReport/);
  assert.match(enhancer, /includeEvidence: true/);
  assert.doesNotMatch(enhancer, /innerText.*pressure|textContent.*Salt/i);
});

test('review custody remains separate and v1/v2 storage never silently migrates or coexists ambiguously', () => {
  assert.match(enhancer, /format-converters\.hpPipingClassEngineeringReviewDisposition\.v2/);
  assert.match(enhancer, /format-converters\.hpPipingClassEngineeringReviewDisposition\.v1/);
  assert.match(enhancer, /Both v1 and v2 HP review custody stores exist/);
  assert.match(enhancer, /HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION/);
  assert.match(enhancer, /HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION/);
  assert.match(enhancer, /ledger\.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION/);
  assert.match(enhancer, /readStoredProject\(\) \?\? contextProject/);
  assert.match(enhancer, /contextProject = null/);
  assert.doesNotMatch(enhancer, /setItem\(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY/);
});

test('UI exposes only non-authorizing review dispositions, append-only language and declared-identity disclosure', () => {
  for (const token of [
    'NO_OBJECTION_FOR_ENGINEERING_REVIEW',
    'COMMENTS_RECORDED',
    'REJECTED_FOR_ENGINEERING_REVIEW',
    'Records cannot be edited or deleted here',
    'REVIEW CUSTODY ONLY',
    'No design-release or Code authority granted',
    'user-declared',
    'not a digital signature',
    'tamper-evident v2 SHA-256 entry chain',
  ]) assert.ok(enhancer.toLowerCase().includes(token.toLowerCase()), `missing ${token}`);
  assert.doesNotMatch(enhancer, />Approved<|APPROVED_FOR_DESIGN|DESIGN_APPROVED/);
});

test('report and entry binding use SHA-256 while identity/release authority remain unavailable', () => {
  assert.match(core, /crypto\?\.subtle/);
  assert.match(core, /SHA-256/);
  assert.match(core, /serializeHpPipingClassEngineeringReviewReportJson/);
  assert.match(core, /canAuthorizeRelease: false/);
  assert.match(core, /actorIdentityAuthority: 'USER_DECLARED'/);
  assert.match(core, /digitalSignature: false/);
  assert.match(core, /verifyHpPipingClassReviewDispositionLedgerChain/);
  assert.match(core, /verifyHpPipingClassReviewDispositionPackage/);
  assert.doesNotMatch(core, /Math\.exp|Math\.log/);
  assert.doesNotMatch(enhancer, /Math\.exp|Math\.log/);
});
