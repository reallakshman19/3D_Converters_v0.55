import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AIV_CI_PANEL_EVIDENCE,
  describeAivProductPathEvidence,
} from '../tabs/vibration-aiv-promotion-status.js';

const CONTROLLED = Object.freeze({ status: 'PASS', counts: { passed: 22, checks: 22 } });

test('imported EI EIT is explicit review-required evidence, not an unloaded benchmark', () => {
  const evidence = describeAivProductPathEvidence({
    eitImport: { counts: { aivLines: 3 } },
    benchmark: { loaded: null },
  }, CONTROLLED);
  assert.equal(evidence.status, 'IMPORTED_EIT_REVIEW_REQUIRED');
  assert.match(evidence.basis, /3 AIV lines/u);
  assert.match(evidence.basis, /Historical AIV values remain evidence only/u);
  assert.match(evidence.basis, /rerun VIB\.AIV\.ACOUSTIC/u);
});

test('exact controlled benchmark keeps committed PASS classification', () => {
  const evidence = describeAivProductPathEvidence({
    benchmark: { loaded: { modified: false } },
    assumptionProfileModified: false,
  }, CONTROLLED);
  assert.equal(evidence.status, 'PASS');
  assert.match(evidence.basis, /22\/22 committed checks pass/u);
});

test('modified controlled benchmark remains not applicable to committed parity', () => {
  const evidence = describeAivProductPathEvidence({
    benchmark: { loaded: { modified: true } },
  }, CONTROLLED);
  assert.equal(evidence.status, 'NOT_APPLICABLE_MODIFIED_INPUTS');
});

test('empty workspace still reports that the controlled benchmark is not loaded', () => {
  const evidence = describeAivProductPathEvidence({}, CONTROLLED);
  assert.equal(evidence.status, 'CONTROLLED_BENCHMARK_NOT_LOADED');
});

test('promotion view is wired to truthful status classifier and does not hardcode stale CI budget state', async () => {
  const source = await readFile(new URL('../tabs/vibration-aiv-promotion-view.js', import.meta.url), 'utf8');
  assert.match(source, /describeAivProductPathEvidence/u);
  assert.match(source, /AIV_CI_PANEL_EVIDENCE/u);
  assert.doesNotMatch(source, /Actions budget prevents execution/u);
  assert.doesNotMatch(source, /Hosted jobs continue to receive no runner\/steps/u);
  assert.equal(AIV_CI_PANEL_EVIDENCE.status, 'NOT_A_LIVE_CI_STATUS');
});
