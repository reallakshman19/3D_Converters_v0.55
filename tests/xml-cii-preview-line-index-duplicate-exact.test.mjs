import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bigrams,
  digitRuns,
  lineKeyAliases,
  normalizeLineKey,
  selectPreviewLineLookupCandidates,
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

test('duplicate exact keys preserve production first-row precedence', () => {
  const rows = [
    { lineKey: 'S8810333', marker: 'first' },
    { lineKey: 'S8810333', marker: 'second' },
    { lineKey: 'S8810999', marker: 'other' },
  ];
  const result = selectPreviewLineLookupCandidates(entries(rows), [{
    branchName: '/ASIM-1847-3"-S8810333-91261M7-01/B1',
    lineKey: 'S8810333',
    isolatedKey: 'S8810333',
  }]);
  assert.deepEqual(result.selectedIndices, [0]);
  assert.equal(result.decisions[0].finalMatchIndex, 0);
  assert.equal(result.decisions[0].method, 'exact');
});
