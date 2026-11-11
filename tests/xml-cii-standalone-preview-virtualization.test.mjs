import assert from 'node:assert/strict';
import test from 'node:test';
import {
  XML_CII_VIRTUAL_WINDOW_ROWS,
  buildMatchingRowIndexes,
  logicalRowCount,
  rowForLogicalIndex,
  virtualRowItems,
  virtualRowWindow,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-virtual-rows.js';

function assertWindow(count, scrollTop) {
  const window = virtualRowWindow(count, scrollTop);
  assert.ok(window.domRowCount <= XML_CII_VIRTUAL_WINDOW_ROWS);
  assert.equal(window.topSpacerPx + window.domRowCount * window.rowHeight + window.bottomSpacerPx, window.totalHeightPx);
  assert.equal(window.totalHeightPx, count * window.rowHeight);
  return window;
}

test('100,000 rows retain a bounded <=60 physical data-row window at top, middle and end', () => {
  const top = assertWindow(100_000, 0);
  const middle = assertWindow(100_000, 50_000 * 32);
  const end = assertWindow(100_000, 100_000 * 32);
  assert.deepEqual([top.start, top.end], [0, 60]);
  assert.ok(middle.start > 49_000 && middle.end < 51_000);
  assert.deepEqual([end.start, end.end], [99_940, 100_000]);
});

test('search retains every matching source-row index instead of truncating at 150', () => {
  const rows = Array.from({ length: 100_000 }, (_, index) => ({ id: index, tag: index % 100 === 0 ? 'MATCH' : 'OTHER' }));
  const indexes = buildMatchingRowIndexes(rows, 'match', (row) => row.tag.toLowerCase());
  assert.equal(indexes.length, 1_000);
  assert.equal(indexes[0], 0);
  assert.equal(indexes[150], 15_000);
  assert.equal(indexes.at(-1), 99_900);
  assert.equal(logicalRowCount(rows, indexes), 1_000);
});

test('virtual search window maps logical rows back to authoritative source row identities', () => {
  const rows = Array.from({ length: 1_000 }, (_, index) => ({ id: index }));
  const indexes = [7, 70, 700, 777, 999];
  const window = virtualRowWindow(indexes.length, 0, { windowRows: 3, overscanRows: 0 });
  const items = virtualRowItems(rows, indexes, window);
  assert.deepEqual(items.map((item) => item.sourceIndex), [7, 70, 700]);
  assert.equal(items[2].row, rows[700]);
  assert.equal(rowForLogicalIndex(rows, indexes, 4).row, rows[999]);
});

test('empty query uses the complete source row set without allocating a full index copy', () => {
  const rows = Array.from({ length: 100_000 }, (_, id) => ({ id }));
  const indexes = buildMatchingRowIndexes(rows, '   ', (row) => String(row.id));
  assert.equal(indexes, null);
  assert.equal(logicalRowCount(rows, indexes), 100_000);
});
