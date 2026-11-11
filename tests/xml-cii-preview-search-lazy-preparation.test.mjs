import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreviewSearchRows,
  previewSearchPreparationStats,
  previewSearchText,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-preview-search.js';
import {
  buildMatchingRowIndexes,
  virtualRowItems,
  virtualRowWindow,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-virtual-rows.js';

function withJsonParseCounter(run) {
  const original = JSON.parse;
  let count = 0;
  JSON.parse = (...args) => {
    count += 1;
    return original(...args);
  };
  try {
    return run(() => count);
  } finally {
    JSON.parse = original;
  }
}

test('100k Preview rows stay lazy until display/search and search corpus is memoized', () => {
  const sourceRows = Array.from({ length: 100_000 }, (_, index) => ({
    lineNoKey: `LN-${index}`,
    lineKey1: 'SYS',
    lineKey2: String(index),
    lineSeqNo: String(index),
    marker: index === 99_999 ? 'needle-target' : 'ordinary',
  }));

  withJsonParseCounter((parseCount) => {
    const rows = buildPreviewSearchRows(
      { key: 'lineList', rows: sourceRows },
      {
        supportConfigJson: '{"linelist":{"fieldMap":{}}}',
        masterContext: { rawRows: { lineList: [] } },
      },
    );

    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 100_000);
    assert.equal(parseCount(), 1, 'fallback support config must parse once per view build');
    assert.deepEqual(previewSearchPreparationStats(rows), {
      lazy: true,
      sourceRows: 100_000,
      normalizedRows: 0,
    });

    const window = virtualRowWindow(rows.length, 0);
    const visible = virtualRowItems(rows, null, window);
    assert.equal(visible.length, 60);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 60);

    const first = buildMatchingRowIndexes(rows, 'needle-target', previewSearchText);
    assert.deepEqual(first, [99_999]);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 100_000);
    assert.equal(parseCount(), 1, 'search must not reparse support config per row');

    const second = buildMatchingRowIndexes(rows, 'needle-target', previewSearchText);
    assert.deepEqual(second, [99_999]);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 100_000, 'second search must reuse normalized rows');

    const cleared = buildMatchingRowIndexes(rows, '', previewSearchText);
    assert.equal(cleared, null);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 100_000, 'clearing search must not rebuild the corpus');
  });
});

test('committed parsed config avoids JSON.parse and raw Line List fallback keeps mapped search fields', () => {
  withJsonParseCounter((parseCount) => {
    const state = {
      supportConfigJson: '{"should":"not be parsed"}',
      masterContext: {
        config: {
          linelist: {
            fieldMap: {
              lineKey1: 'Service',
              lineKey2: 'Line Number',
              lineSeqNo: 'Line Number',
            },
          },
        },
        rawRows: {
          lineList: [
            { Service: 'P', 'Line Number': '1001', Description: 'mapped target' },
          ],
        },
      },
    };

    const rows = buildPreviewSearchRows({ key: 'lineList', rows: [] }, state);
    assert.equal(parseCount(), 0);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 0);

    assert.equal(rows[0].lineKey1, 'P');
    assert.equal(rows[0].lineKey2, '1001');
    assert.equal(rows[0].lineSeqNo, '1001');
    assert.equal(previewSearchText(rows[0]).includes('p1001'), true);
    assert.equal(previewSearchPreparationStats(rows).normalizedRows, 1);
    assert.equal(parseCount(), 0);
  });
});

test('APPLIED rows remain authoritative over raw rows', () => {
  const applied = [{ lineNoKey: 'APPLIED-1', lineKey1: 'A', lineSeqNo: '1' }];
  const rows = buildPreviewSearchRows(
    { key: 'lineList', rows: applied },
    {
      masterContext: {
        config: { linelist: { fieldMap: {} } },
        rawRows: { lineList: [{ lineNoKey: 'RAW-1', lineKey1: 'R', lineSeqNo: '1' }] },
      },
    },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lineNoKey, 'APPLIED-1');
});

test('non-Line-List masters keep their existing row-array identity', () => {
  const applied = [{ pipingClass: 'P1' }];
  const rows = buildPreviewSearchRows(
    { key: 'pipingClass', rows: applied },
    { masterContext: { rawRows: { pipingClass: [{ pipingClass: 'RAW' }] } } },
  );
  assert.equal(rows, applied);
  assert.deepEqual(previewSearchPreparationStats(rows), {
    lazy: false,
    sourceRows: 1,
    normalizedRows: 0,
  });
});
