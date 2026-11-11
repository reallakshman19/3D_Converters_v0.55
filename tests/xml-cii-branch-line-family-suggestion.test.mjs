import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBranchLineKeySuggestion } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-line-map-panel.js';
import { detectBranchLinePattern } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-line-pattern-detect.js';

test('exact boundary-safe key remains highest authority', () => {
  const result = resolveBranchLineKeySuggestion('/AREA-10-S8810105-01/B1', ['S88101', 'S8810105']);
  assert.deepEqual(result, { status: 'match', key: 'S8810105', candidates: ['S8810105'] });
});

test('progressive family mask maps only when one loaded key survives', () => {
  const result = resolveBranchLineKeySuggestion('/GLRD-1000-6"-P4110010-93833-01/B1', ['P4110001']);
  assert.equal(result.status, 'match');
  assert.equal(result.key, 'P4110001');
  assert.deepEqual(result.candidates, ['P4110001']);
  assert.equal(result.method, 'progressive-family-mask');
  assert.equal(result.mask, 'P41100XX');
  assert.equal(result.wildcardCount, 2);
});

test('progressive family mask blocks ambiguous loaded keys', () => {
  const result = resolveBranchLineKeySuggestion(
    '/GLRD-1000-6"-P4110010-93833-01/B1',
    ['P4110001', 'P4110003'],
  );
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.key, '');
  assert.deepEqual(result.candidates, ['P4110001', 'P4110003']);
  assert.equal(result.mask, 'P41100XX');
});

test('family resolver never rewrites a B designator into a P family', () => {
  const result = resolveBranchLineKeySuggestion(
    '/GLRD-1000-6"-B4110004-93833-01/B1',
    ['P4110001', 'P4110003'],
  );
  assert.deepEqual(result, { status: 'none', key: '', candidates: [] });
});

test('exact loaded token wins even when neighboring family keys exist', () => {
  const result = resolveBranchLineKeySuggestion(
    '/GLRD-1000-6"-P4110010-93833-01/B1',
    ['P4110010', 'P4110001', 'P4110003'],
  );
  assert.deepEqual(result, { status: 'match', key: 'P4110010', candidates: ['P4110010'] });
});

function confidenceFixture(exactCount, totalCount) {
  const branches = Array.from({ length: totalCount }, (_, index) => `/AREA-P${String(index + 1).padStart(4, '0')}/B1`);
  const loadedKeys = Array.from({ length: exactCount }, (_, index) => `P${String(index + 1).padStart(4, '0')}`);
  return detectBranchLinePattern(branches, loadedKeys);
}

test('pattern confidence labels are threshold categories, not generic >50% match labels', () => {
  const low = confidenceFixture(6, 10);
  const medium = confidenceFixture(7, 10);
  const high = confidenceFixture(19, 20);

  assert.equal(low.status, 'detected');
  assert.equal(low.best.evaluation.coverage, 0.6);
  assert.equal(low.best.confidence, 'LOW');

  assert.equal(medium.status, 'detected');
  assert.equal(medium.best.evaluation.coverage, 0.7);
  assert.equal(medium.best.confidence, 'MEDIUM');

  assert.equal(high.status, 'detected');
  assert.equal(high.best.evaluation.coverage, 0.95);
  assert.equal(high.best.evaluation.distinctKeyCount, 19);
  assert.equal(high.best.confidence, 'HIGH');
});
