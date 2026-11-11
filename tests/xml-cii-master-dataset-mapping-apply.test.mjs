import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCurrentDraft, rawRowsForMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js';

function stateRef() {
  return {
    current: {
      supportConfigJson: JSON.stringify({ linelist: { fieldMap: { lineNo: 'OldLine' } } }),
      masterContext: {
        config: { linelist: { fieldMap: { lineNo: 'OldLine' } } },
        lineRows: [], rawRows: { lineList: [] },
        mappingRows: { lineList: [{ OldLine: 'L-1', NewLine: 'L-1' }] },
        previewRows: { lineList: [{ lineNo: 'L-1' }] },
        rowCounts: { lineList: 100000 },
        datasetRefs: { lineList: { datasetId: 'line-ds-r1', rowCount: 100000, fieldMap: { lineNo: 'OldLine' }, persistence: 'indexeddb' } },
        appliedMappingRevision: { lineList: 3 },
        mappingDrafts: { lineList: { fieldMap: { lineNo: 'NewLine' }, dirty: true, basisAppliedRevision: 3 } },
        sourceMetadata: { lineList: { key: 'lineList', source: 'lines.xlsx', sourceType: 'worker-import', status: 'loaded', rowCount: 100000 } },
      },
    },
  };
}

function ready() {
  return {
    metadata: {
      datasetId: 'line-ds-r2', masterKey: 'lineList', rowCount: 100000,
      fileName: 'lines.xlsx', fieldMap: { lineNo: 'NewLine' },
    },
    previewRows: [{ lineNo: 'L-1', _rowIndex: 1 }],
    mappingRows: [{ OldLine: 'L-1', NewLine: 'L-1' }],
  };
}

test('dataset-backed Apply mapping remaps in worker and advances APPLIED basis exactly once', async () => {
  const ref = stateRef();
  const sample = rawRowsForMaster(ref, 'lineList');
  assert.equal(sample.length, 1, 'mapping UI should use bounded mappingRows sample');
  const calls = [];
  await applyCurrentDraft(ref, 'lineList', {
    remapDataset: async (key, datasetId, fieldMap) => {
      calls.push({ key, datasetId, fieldMap });
      return ready();
    },
  });

  assert.deepEqual(calls, [{ key: 'lineList', datasetId: 'line-ds-r1', fieldMap: { lineNo: 'NewLine' } }]);
  assert.equal(ref.current.masterContext.datasetRefs.lineList.datasetId, 'line-ds-r2');
  assert.equal(ref.current.masterContext.rowCounts.lineList, 100000);
  assert.equal(ref.current.masterContext.appliedMappingRevision.lineList, 4);
  assert.equal(ref.current.masterContext.mappingDrafts.lineList, undefined);
  assert.deepEqual(ref.current.masterContext.lineRows, []);
  assert.deepEqual(ref.current.masterContext.rawRows.lineList, []);
  assert.equal(ref.current.masterContext.mappingRows.lineList.length, 1);
  const config = JSON.parse(ref.current.supportConfigJson);
  assert.equal(config.linelist.fieldMap.lineNo, 'NewLine');
  assert.equal('masterRows' in config.linelist, false);
});

test('stale worker remap result cannot replace a newer APPLIED basis', async () => {
  const ref = stateRef();
  const beforeId = ref.current.masterContext.datasetRefs.lineList.datasetId;
  await assert.rejects(
    applyCurrentDraft(ref, 'lineList', {
      remapDataset: async () => {
        ref.current.masterContext = {
          ...ref.current.masterContext,
          appliedMappingRevision: { ...ref.current.masterContext.appliedMappingRevision, lineList: 4 },
        };
        return ready();
      },
    }),
    /stale result was not applied/,
  );
  assert.equal(ref.current.masterContext.datasetRefs.lineList.datasetId, beforeId);
  assert.equal(ref.current.masterContext.appliedMappingRevision.lineList, 4);
});
