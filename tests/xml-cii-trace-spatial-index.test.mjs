import test from 'node:test';
import assert from 'node:assert/strict';

import { groupTraceEntriesSpatially } from '../tabs/xml-cii-2019-standalone/xml-cii-trace-spatial-index.js';

const entry = (root, x, id) => ({
  jsonNodeNo: id,
  branch: { root, original: root },
  point: { x, y: 0, z: 0 },
});

test('spatial grouping preserves anchor-distance grouping semantics', () => {
  const groups = groupTraceEntriesSpatially([
    entry('/A', 0, '1'),
    entry('/A', 5, '2'),
    entry('/A', 10, '3'),
  ], 6);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].entries.map((item) => item.jsonNodeNo), ['1', '2']);
  assert.deepEqual(groups[1].entries.map((item) => item.jsonNodeNo), ['3']);
});

test('different branch roots never share a spatial group', () => {
  const groups = groupTraceEntriesSpatially([
    entry('/A', 0, '1'),
    entry('/B', 0, '2'),
  ], 6);
  assert.equal(groups.length, 2);
});

test('negative coordinates search neighboring quantized cells', () => {
  const groups = groupTraceEntriesSpatially([
    entry('/A', -6.1, '1'),
    entry('/A', -0.2, '2'),
  ], 6);
  assert.equal(groups.length, 1);
});

test('equal-distance choice remains first-created group', () => {
  const groups = groupTraceEntriesSpatially([
    entry('/A', 0, '1'),
    entry('/A', 12, '2'),
    entry('/A', 6, '3'),
  ], 6);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].entries.map((item) => item.jsonNodeNo), ['1', '3']);
});
