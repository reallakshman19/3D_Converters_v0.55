import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bigrams,
  digitRuns,
  lineKeyAliases,
  normalizeLineKey,
  selectPreviewLineLookupCandidates,
  sparseRowsByOriginalIndex,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index-core.js';

function entries(rows) {
  return rows.map((row, index) => ({
    index,
    row,
    rowKey: row.lineKey || '',
    rowSeq: row.lineSeq || '',
    cleanKey: normalizeLineKey(row.lineKey || ''),
    aliases: lineKeyAliases(row.lineKey || ''),
    rowDigits: digitRuns(`${row.lineSeq || ''} ${row.lineKey || ''}`),
    rowKeyBigrams: bigrams(row.lineKey || ''),
    rowSeqBigrams: bigrams(row.lineSeq || ''),
  }));
}

test('exact match retains only the original source index', () => {
  const rows = [{ lineKey: 'A100001' }, { lineKey: 'A100002' }, { lineKey: 'A100003' }];
  const result = selectPreviewLineLookupCandidates(entries(rows), [
    { branchName: '/X/A100002/B1', lineKey: 'A100002', isolatedKey: 'A100002' },
  ]);
  assert.deepEqual(result.selectedIndices, [1]);
  assert.equal(result.decisions[0].method, 'exact');
  const sparse = sparseRowsByOriginalIndex(rows, result.selectedIndices);
  assert.equal(sparse.length, 3);
  assert.equal(sparse[1], rows[1]);
  assert.equal(0 in sparse, false);
});

test('unique service-prefix alias remains unique', () => {
  const rows = [{ lineKey: 'A8810145' }, { lineKey: 'B8810999' }];
  const result = selectPreviewLineLookupCandidates(entries(rows), [
    { branchName: '/X/8810145/B1', lineKey: '8810145', isolatedKey: '8810145' },
  ]);
  assert.deepEqual(result.selectedIndices, [0]);
  assert.equal(result.decisions[0].method, 'alias');
});

test('ambiguous alias retains every alias row before fuzzy resolution', () => {
  const rows = [
    { lineKey: 'A8810145', lineSeq: '8810145' },
    { lineKey: 'B8810145', lineSeq: '8810145' },
    { lineKey: 'C7777777', lineSeq: '7777777' },
  ];
  const result = selectPreviewLineLookupCandidates(entries(rows), [
    { branchName: '/ASIM-X-8810145-Z/B1', lineKey: '8810145', isolatedKey: '8810145' },
  ]);
  assert.deepEqual(result.decisions[0].ambiguousAliasIndexes, [0, 1]);
  assert.ok(result.selectedIndices.includes(0));
  assert.ok(result.selectedIndices.includes(1));
});

test('fuzzy line-sequence selection keeps the same first best candidate', () => {
  const rows = [
    { lineKey: 'A8810145', lineSeq: '8810145' },
    { lineKey: 'A8810146', lineSeq: '8810146' },
    { lineKey: 'A9999999', lineSeq: '9999999' },
  ];
  const result = selectPreviewLineLookupCandidates(entries(rows), [
    { branchName: '/ASIM-1840-3-S8810XXX-8810146/B1', lineKey: 'S8810XXX', isolatedKey: 'S8810XXX' },
  ]);
  assert.equal(result.decisions[0].finalMatchIndex, 1);
  assert.equal(result.decisions[0].method, 'similar-lineseq');
  assert.ok(result.decisions[0].fuzzyConfidence >= 1);
});

test('multi-branch union preserves original array positions', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ lineKey: `A${String(8800000 + index)}` }));
  const result = selectPreviewLineLookupCandidates(entries(rows), [
    { branchName: '/X/A8800002/B1', lineKey: 'A8800002', isolatedKey: 'A8800002' },
    { branchName: '/X/A8800009/B2', lineKey: 'A8800009', isolatedKey: 'A8800009' },
  ]);
  assert.deepEqual(result.selectedIndices, [2, 9]);
  const sparse = sparseRowsByOriginalIndex(rows, result.selectedIndices);
  assert.equal(sparse.length, rows.length);
  assert.equal(sparse[2], rows[2]);
  assert.equal(sparse[9], rows[9]);
  assert.equal(sparse.filter(Boolean).length, 2);
});

test('1000-row controlled exact case reduces lookup population to three rows', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    lineKey: `A${String(8000000 + index).padStart(7, '0')}`,
  }));
  const wanted = [100, 500, 900];
  const branches = wanted.map((index) => ({
    branchName: `/ASIM-X-${rows[index].lineKey}/B1`,
    lineKey: rows[index].lineKey,
    isolatedKey: rows[index].lineKey,
  }));
  const result = selectPreviewLineLookupCandidates(entries(rows), branches);
  assert.deepEqual(result.selectedIndices, wanted);
  assert.equal(result.selectedIndices.length / rows.length, 0.003);
});

test('retained SYS-0010 timing master shape rejects unrelated PERF Line List rows', () => {
  for (const count of [250, 1000]) {
    const rows = Array.from({ length: count }, (_, index) => ({
      lineKey: `PERF${90000000 + index}`,
      lineSeq: String(90000000 + index),
    }));
    const result = selectPreviewLineLookupCandidates(entries(rows), [{
      branchName: '/ASIM-1847-3"-S8810333-91261M7-01/B1',
      lineKey: 'S8810333',
      isolatedKey: 'S8810333',
    }]);
    assert.deepEqual(result.selectedIndices, []);
    assert.equal(result.decisions[0].method, 'none');
  }
});
