import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../tabs/engineering-workspace-tab.js', import.meta.url), 'utf8');
const enhancer = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition-v2-enhancer.js', import.meta.url), 'utf8');
const ledger = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition-v2.js', import.meta.url), 'utf8');
const packageV2 = await readFile(new URL('../tabs/hp-piping-class-engineering-review-disposition-package-v2.js', import.meta.url), 'utf8');
const verifier = await readFile(new URL('../tabs/hp-piping-class-review-package-verifier.js', import.meta.url), 'utf8');
const verifierUi = await readFile(new URL('../tabs/hp-piping-class-review-package-verifier-tab.js', import.meta.url), 'utf8');

test('active HP route uses v2 review custody instead of the legacy v1 enhancer', () => {
  assert.match(route, /hp-piping-class-engineering-review-disposition-v2-enhancer\.js/);
  assert.match(route, /installHpPipingClassEngineeringReviewDispositionV2Enhancer/);
  assert.doesNotMatch(route, /installHpPipingClassEngineeringReviewDispositionEnhancer/);
});

test('v2 enhancer preserves v1 storage and writes only the separate v2 key', () => {
  assert.match(enhancer, /hpPipingClassEngineeringReviewDisposition\.v1/);
  assert.match(enhancer, /hpPipingClassEngineeringReviewDisposition\.v2/);
  assert.match(enhancer, /resolveHpPipingClassReviewDispositionLedgerV2/);
  assert.match(enhancer, /setItem\(\s*HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V2/);
  assert.doesNotMatch(enhancer, /setItem\(\s*HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V1/);
});

test('v2 review custody still delegates engineering numbers to canonical project/orchestrator/report contracts', () => {
  for (const token of [
    'validateHpPipingClassProject',
    'evaluateHpPipingClassProject',
    'buildHpPipingClassEngineeringReviewReport',
  ]) assert.ok(enhancer.includes(token), `missing canonical ownership token ${token}`);
  for (const forbidden of ['Math.exp(', 'Math.log(', 'pressureDesignThicknessMm =', 'coreSaltMpa =']) {
    assert.equal(enhancer.includes(forbidden), false, `duplicate engineering math found: ${forbidden}`);
  }
});

test('v2 entry hash commits predecessor plus immutable review content', () => {
  for (const token of [
    'previousEntrySha256',
    'entrySha256',
    'reportSha256',
    'projectId',
    'classId',
    'revision',
    'role',
    'actor',
    'disposition',
    'comment',
    'recordedAt',
    'authority',
  ]) assert.ok(ledger.includes(token), `missing v2 custody token ${token}`);
});

test('UI and package contract do not overstate a self-contained hash chain as authenticity', () => {
  assert.match(enhancer, /self-contained hash chain proves internal consistency only/i);
  assert.match(enhancer, /independently/i);
  assert.match(enhancer, /not a signature/i);
  assert.match(packageV2, /INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY/);
  assert.match(packageV2, /attacker.*recompute unkeyed hashes/i);
  assert.match(packageV2, /USER_DECLARED/);
  assert.match(packageV2, /does not authenticate reviewer\/checker identity/i);
});

test('independent verifier distinguishes no-checkpoint and checkpoint trust states', () => {
  assert.match(verifier, /INTERNAL_HASH_CHAIN_CONSISTENCY_ONLY/);
  assert.match(verifier, /PASS_AGAINST_EXTERNAL_CHECKPOINT/);
  assert.match(verifier, /PACKAGE_CHAIN_CHECKPOINT_VERIFICATION_ONLY/);
  assert.match(verifier, /NOT_AVAILABLE_USER_DECLARED/);
  assert.match(verifierUi, /Optional independently retained v2 checkpoint/);
  assert.match(verifierUi, /self-contained SHA-256 chain can be recomputed/i);
  assert.match(verifierUi, /does not mean the actor is authenticated or the design is approved/i);
});
