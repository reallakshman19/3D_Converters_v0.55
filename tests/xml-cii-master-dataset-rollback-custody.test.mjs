import test from 'node:test';
import assert from 'node:assert/strict';

import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';

function installStorage(entries = {}) {
  const previous = globalThis.localStorage;
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return () => { globalThis.localStorage = previous; };
}

function memoryStore() {
  const data = new Map();
  return {
    data,
    async persistDataset(metadata, rows) { data.set(metadata.datasetId, { metadata, rows }); },
    async getMetadata(id) { return data.get(id)?.metadata || null; },
    async getRows(id) { return data.get(id)?.rows || null; },
  };
}

test('startup hydration preserves non-master support config when masterContext is empty', async () => {
  const restore = installStorage({
    'xml-cii-master-source-lineList': JSON.stringify({
      source: 'lines.xlsx', datasetId: 'applied-line-ds', rowCount: 2,
      persistenceMode: 'indexeddb', fieldMap: { lineNo: 'Line' }, appliedRevision: 4,
    }),
  });
  const rows = [{ lineNo: 'L-1' }, { lineNo: 'L-2' }];
  const store = {
    async getMetadata(id) { return id === 'applied-line-ds' ? { datasetId: id, fileName: 'lines.xlsx' } : null; },
    async getRows(id) { return id === 'applied-line-ds' ? rows : null; },
  };
  const stateRef = {
    current: {
      supportConfigJson: JSON.stringify({
        linelist: { masterRows: [{ Line: 'legacy' }] },
        supportPositionMatch: { enabled: true, toleranceMm: 20, mode: 'euclidean' },
      }),
      masterContext: null,
    },
  };
  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, { store });
    assert.equal(changed, true);
    assert.equal(stateRef.current.masterContext.lineRows.length, 0);
    assert.equal(stateRef.current.masterContext.rowCounts.lineList, 2);
    assert.equal(stateRef.current.masterContext.previewRows.lineList.length, 2);
    assert.equal(stateRef.current.masterContext.datasetRefs.lineList.datasetId, 'applied-line-ds');
    const config = JSON.parse(stateRef.current.supportConfigJson);
    assert.equal(config.supportPositionMatch.enabled, true);
    assert.equal(config.supportPositionMatch.toleranceMm, 20);
    assert.equal(config.supportPositionMatch.mode, 'euclidean');
    assert.equal('masterRows' in config.linelist, false);
  } finally {
    restore();
  }
});

test('re-parsing the same workbook sheet creates a new dataset without overwriting prior APPLIED bytes', async () => {
  const rows = [{ Line: 'L-1' }, { Line: 'L-2' }];
  const store = memoryStore();
  const xlsx = {
    read(_data, options) {
      if (options.bookSheets) return { SheetNames: ['Lines'] };
      return { SheetNames: ['Lines'], Sheets: { Lines: {} } };
    },
    utils: { sheet_to_json: () => rows },
  };
  const service = createMasterDatasetService({
    getXlsx: async () => xlsx,
    store,
    prepareDataset(_key, rawRows) {
      return {
        fieldMap: { lineNo: 'Line' },
        rows: rawRows.map((row) => ({ lineNo: row.Line })),
        searchCorpus: rawRows.map((row) => row.Line.toLowerCase()),
      };
    },
    buildSearchCorpus: (datasetRows) => datasetRows.map((row) => row.lineNo.toLowerCase()),
    searchCorpusIndexes: () => [],
  });
  const buffer = new TextEncoder().encode('xlsx').buffer;
  const opened = await service.handle({
    type: 'OPEN_SOURCE', requestId: 'open', jobId: 'job-1', fileName: 'lines.xlsx',
    masterKey: 'lineList', buffer, config: {}, currentMap: {},
  });
  assert.deepEqual(opened.sheetNames, ['Lines']);

  const first = await service.handle({ type: 'SELECT_SHEET', requestId: 's1', jobId: 'job-1', sheetName: 'Lines' });
  const second = await service.handle({ type: 'SELECT_SHEET', requestId: 's2', jobId: 'job-1', sheetName: 'Lines' });

  assert.notEqual(first.metadata.datasetId, second.metadata.datasetId);
  assert.equal(first.metadata.datasetRevision, 1);
  assert.equal(second.metadata.datasetRevision, 2);
  assert.match(first.metadata.datasetId, /:Lines:r1$/);
  assert.match(second.metadata.datasetId, /:Lines:r2$/);
  assert.equal(store.data.size, 2);
  assert.deepEqual(store.data.get(first.metadata.datasetId).rows, [{ lineNo: 'L-1' }, { lineNo: 'L-2' }]);
  assert.deepEqual(store.data.get(second.metadata.datasetId).rows, [{ lineNo: 'L-1' }, { lineNo: 'L-2' }]);
});
