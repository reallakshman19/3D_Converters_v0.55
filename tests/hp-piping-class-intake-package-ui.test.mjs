import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../tabs/engineering-workspace-tab.js', import.meta.url), 'utf8');
const enhancer = await readFile(new URL('../tabs/hp-piping-class-intake-package-enhancer.js', import.meta.url), 'utf8');
const contract = await readFile(new URL('../tabs/hp-piping-class-intake-package.js', import.meta.url), 'utf8');
const review = await readFile(new URL('../tabs/hp-piping-class-intake-package-review.js', import.meta.url), 'utf8');

test('active HP route preserves product/transient paths and composes intake package enhancer', () => {
  assert.match(route, /hp-piping-class-product-bulk-workbench-tab\.js/);
  assert.match(route, /hp-piping-class-transient-bulk-enhancer\.js/);
  assert.match(route, /hp-piping-class-intake-package-enhancer\.js/);
  assert.match(route, /installHpPipingClassIntakePackageEnhancer/);
  assert.match(route, /hp-piping-class-kd-bulk-workbench-tab\.js/);
});

test('package UI requires explicit validate/apply and reuses canonical JSON import controller bridge', () => {
  assert.match(enhancer, /Validate package/);
  assert.match(enhancer, /Apply \+ calculate/);
  assert.match(enhancer, /serializeHpPipingClassWorkspaceProject/);
  assert.match(enhancer, /new DataTransfer\(\)/);
  assert.ok(enhancer.includes('[data-hpwb-file]'));
  assert.ok(enhancer.includes('[data-hpwb-action="calculate"]'));
  assert.match(enhancer, /waitForImportedProject/);
});

test('package UI states full-replacement semantics and clears applied badge after later project edits', () => {
  assert.match(enhancer, /Replacement import/);
  assert.match(enhancer, /replaces the current HP Piping Class workspace project/);
  assert.match(enhancer, /It is not a merge or patch operation/);
  assert.match(enhancer, /state\.applied/);
  assert.match(enhancer, /setState\(\{ applied: false \}\)/);
});

test('package adapter delegates each table to existing bulk validators instead of reimplementing formulas', () => {
  assert.match(contract, /applyHpPipingClassProductBulkInput/);
  assert.match(contract, /applyHpPipingClassTransientBulkInput/);
  assert.match(contract, /applyHpPipingClassKdBulkInput/);
  for (const forbidden of [/Math\.exp\(/, /Math\.log\(/, /calculateChapterIx/, /alternatingStressIntensityMpa\s*=/]) {
    assert.doesNotMatch(contract, forbidden);
  }
});

test('canonical preflight uses existing HP orchestrator, fails closed on exceptions and never introduces calculation math', () => {
  assert.match(review, /evaluateHpPipingClassProject/);
  assert.match(review, /includeEvidence: false/);
  assert.match(review, /INTAKE_PACKAGE_CANONICAL_PREFLIGHT_EXCEPTION/);
  assert.doesNotMatch(review, /Math\.exp\(/);
  assert.doesNotMatch(review, /Math\.log\(/);
  assert.doesNotMatch(review, /calculateChapterIx/);
});

test('authority cannot be accepted from package and UI remains explicitly review-only', () => {
  assert.match(contract, /INTAKE_PACKAGE_AUTHORITY_FIELD_FORBIDDEN/);
  assert.match(contract, /nativeCoreKd3Qualified/);
  assert.match(contract, /canUseForDesignAuthority/);
  assert.match(enhancer, /Authority fields are forbidden/);
  assert.match(enhancer, /REVIEW ONLY/);
});
