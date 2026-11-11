import test from 'node:test';
import assert from 'node:assert/strict';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { createMasterDatasetImportCoordinator } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js';
import { MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';

function bytes(text = 'data') {
  return new TextEncoder().encode(text).buffer;
}

function memoryStore() {
  const data = new Map();
  return {
    async persistDataset(metadata, rows) { data.set(metadata.datasetId, { metadata, rows }); },
    async getMetadata(id) { return data.get(id)?.metadata || null; },
    async getRows(id) { return data.get(id)?.rows || null; },
  };
}

test('worker service preserves explicit saved mapping and exposes bounded raw rows', async () => {
  const rawRows = Array.from({ length: 2500 }, (_, index) => ({ SRC: `L-${index + 1}` }));
  let receivedOverride = null;
  const service = createMasterDatasetService({
    getXlsx: async () => ({
      read(_data, options) {
        if (options.bookSheets) return { SheetNames: ['Lines'] };
        return { SheetNames: ['Lines'], Sheets: { Lines: {} } };
      },
      utils: { sheet_to_json: () => rawRows },
    }),
    store: memoryStore(),
    prepareDataset(_key, rows, _currentMap, _config, override) {
      receivedOverride = override;
      return {
        fieldMap: { ...override },
        rows: rows.map((row, index) => ({ lineNo: row.SRC, _rowIndex: index + 1 })),
        searchCorpus: rows.map((row) => row.SRC.toLowerCase()),
      };
    },
    buildSearchCorpus: (rows) => rows.map((row) => row.lineNo.toLowerCase()),
    searchCorpusIndexes: () => [],
  });

  await service.handle({
    type: 'OPEN_SOURCE', requestId: 'open', jobId: 'job', fileName: 'lines.xlsx', masterKey: 'lineList',
    buffer: bytes('xlsx'), config: {}, currentMap: {}, fieldMapOverride: { lineNo: 'SRC' },
  });
  const ready = await service.handle({ type: 'SELECT_SHEET', requestId: 'sheet', jobId: 'job', sheetName: 'Lines' });
  assert.deepEqual(receivedOverride, { lineNo: 'SRC' });
  assert.equal(ready.mappingRows.length, 150);

  const raw = await service.handle({
    type: 'GET_RAW_ROWS', requestId: 'raw', datasetId: ready.metadata.datasetId, offset: 2000, limit: 2000,
  });
  assert.equal(raw.raw, true);
  assert.equal(raw.rows.length, 500);
  assert.equal(raw.rows[0].SRC, 'L-2001');
});

test('coordinator hydrates normalized and raw rows in bounded chunks', async () => {
  const calls = [];
  const rowCount = 4500;
  const client = {
    async openFile() { return { type: MASTER_DATASET_EVENT.SHEETS, jobId: 'job-1', sheetNames: ['Lines'] }; },
    async selectSheet() {
      return { type: MASTER_DATASET_EVENT.DATASET_READY, metadata: { datasetId: 'ds-1', rowCount }, previewRows: [{ n: 1 }], mappingRows: [{ raw: 1 }] };
    },
    async getRows(_id, offset, limit) {
      calls.push(['normal', offset, limit]);
      const count = Math.min(limit, rowCount - offset);
      return { rows: Array.from({ length: count }, (_, i) => ({ n: offset + i })) };
    },
    async getRawRows(_id, offset, limit) {
      calls.push(['raw', offset, limit]);
      const count = Math.min(limit, rowCount - offset);
      return { rows: Array.from({ length: count }, (_, i) => ({ raw: offset + i })) };
    },
    async releaseSource() {}, async releaseDataset() {}, search() {}, dispose() {},
  };
  const coordinator = createMasterDatasetImportCoordinator({ client });
  const file = { name: 'lines.xlsx', arrayBuffer: async () => bytes('xlsx') };
  const opened = await coordinator.openFile('lineList', file, {});
  assert.equal(opened.type, MASTER_DATASET_EVENT.SHEETS);
  const ready = await coordinator.selectSheet('lineList', 'Lines');
  const hydrated = await coordinator.materialize(ready);

  assert.equal(hydrated.rows.length, rowCount);
  assert.equal(hydrated.rawRows.length, rowCount);
  assert.deepEqual(calls.filter(([kind]) => kind === 'normal').map(([, offset]) => offset), [0, 2000, 4000]);
  assert.deepEqual(calls.filter(([kind]) => kind === 'raw').map(([, offset]) => offset), [0, 2000, 4000]);
  assert.equal(Math.max(...calls.map(([, , limit]) => limit)), 2000);
});
