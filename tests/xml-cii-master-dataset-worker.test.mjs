import test from 'node:test';
import assert from 'node:assert/strict';

import { listWorkbookSheets, parseWorkbookSheet, parseTextSource } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-parser.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import { createMasterDatasetClient } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-client.js';
import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';

function bytes(text = 'data') {
  return new TextEncoder().encode(text).buffer;
}

function fakeXlsx(rows = [{ Code: 'A', Weight: '10' }]) {
  const calls = [];
  const module = {
    calls,
    read(_data, options) {
      calls.push({ ...options });
      if (options.bookSheets) return { SheetNames: ['SheetA', 'SheetB'] };
      return { SheetNames: ['SheetA', 'SheetB'], Sheets: { [options.sheets]: { name: options.sheets } } };
    },
    utils: {
      sheet_to_json(sheet, options) {
        calls.push({ sheetToJson: sheet.name, options });
        return rows.map((row) => ({ ...row }));
      },
    },
  };
  return module;
}

function memoryStore() {
  const data = new Map();
  return {
    async persistDataset(metadata, rows) { data.set(metadata.datasetId, { metadata: { ...metadata }, rows: rows.map((row) => ({ ...row })) }); },
    async getMetadata(datasetId) { return data.get(datasetId)?.metadata || null; },
    async getRows(datasetId) { return data.get(datasetId)?.rows || null; },
    async deleteDataset(datasetId) { return data.delete(datasetId); },
  };
}

test('XLSX discovery and selected-sheet parse are two distinct reads', () => {
  const xlsx = fakeXlsx();
  const buffer = bytes('xlsx');
  assert.deepEqual(listWorkbookSheets(buffer, xlsx), ['SheetA', 'SheetB']);
  assert.deepEqual(parseWorkbookSheet(buffer, 'SheetB', xlsx), [{ Code: 'A', Weight: '10' }]);
  assert.equal(xlsx.calls[0].bookSheets, true);
  assert.equal(xlsx.calls[1].sheets, 'SheetB');
  assert.equal(xlsx.calls.filter((call) => call.sheetToJson).length, 1);
  assert.equal(xlsx.calls.find((call) => call.sheetToJson)?.sheetToJson, 'SheetB');
});

test('JSON import accepts an explicit row array without workbook materialization', () => {
  const rows = parseTextSource(bytes(JSON.stringify([{ A: 1 }, { A: 2 }])), 'master.json', 'lineList');
  assert.deepEqual(rows, [{ A: 1 }, { A: 2 }]);
});

test('dataset service returns metadata + bounded preview and keeps full rows behind service', async () => {
  const xlsx = fakeXlsx(Array.from({ length: 200 }, (_, index) => ({ Weight: String(index + 1), Description: `Row ${index + 1}` })));
  const prepareDataset = (_masterKey, rawRows) => ({
    fieldMap: {},
    rows: rawRows.map((row, index) => ({ ...row, _rowIndex: index + 1 })),
    searchCorpus: rawRows.map((row) => Object.values(row).join(' ').toLowerCase()),
  });
  const service = createMasterDatasetService({
    getXlsx: async () => xlsx,
    store: memoryStore(),
    prepareDataset,
    buildSearchCorpus: (rows) => rows.map((row) => Object.values(row).join(' ').toLowerCase()),
    searchCorpusIndexes: (corpus, query) => corpus.map((value, index) => value.includes(String(query).toLowerCase()) ? index : -1).filter((index) => index >= 0),
  });
  const opened = await service.handle({
    type: 'OPEN_SOURCE', requestId: 'r1', jobId: 'job1', fileName: 'weight.xlsx', masterKey: 'weight', buffer: bytes('xlsx'), config: {}, currentMap: {},
  });
  assert.equal(opened.type, MASTER_DATASET_EVENT.SHEETS);
  const ready = await service.handle({ type: 'SELECT_SHEET', requestId: 'r2', jobId: 'job1', sheetName: 'SheetA' });
  assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.equal(ready.metadata.rowCount, 200);
  assert.equal(ready.previewRows.length, 150);
  assert.equal('rows' in ready.metadata, false);
  const search = await service.handle({ type: 'SEARCH', requestId: 'r3', datasetId: ready.metadata.datasetId, query: 'row 199' });
  assert.equal(search.type, MASTER_DATASET_EVENT.SEARCH_RESULT);
  assert.equal(search.matchCount, 1);
  assert.deepEqual(search.indexes, [198]);
  assert.equal(ready.mappingRows.length, 150);
  const selected = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS_BY_INDEXES,
    requestId: 'r4',
    datasetId: ready.metadata.datasetId,
    indexes: [198, 0, 199],
  });
  assert.equal(selected.type, MASTER_DATASET_EVENT.ROWS_RESULT);
  assert.deepEqual(selected.indexes, [198, 0, 199]);
  assert.equal(selected.rows[0].Description, 'Row 199');
  assert.equal(selected.rows[1].Description, 'Row 1');
});

class FakeWorker {
  constructor() { this.listeners = new Map(); this.posts = []; this.terminated = false; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  postMessage(message, transfer) {
    this.posts.push({ message, transfer });
    queueMicrotask(() => this.listeners.get('message')?.({ data: { type: MASTER_DATASET_EVENT.SHEETS, requestId: message.requestId, jobId: message.jobId, sheetNames: ['SheetA'] } }));
  }
  terminate() { this.terminated = true; }
}

test('client transfers ArrayBuffer ownership and hard-cancels by terminating worker', async () => {
  const fake = new FakeWorker();
  const client = createMasterDatasetClient({ workerFactory: () => fake });
  const buffer = bytes('xlsx');
  const file = { name: 'line.xlsx', arrayBuffer: async () => buffer };
  const result = await client.openFile(file, { masterKey: 'lineList', jobId: 'job-transfer' });
  assert.deepEqual(result.sheetNames, ['SheetA']);
  assert.equal(fake.posts.length, 1);
  assert.equal(fake.posts[0].transfer.length, 1);
  assert.equal(fake.posts[0].transfer[0], buffer);
  client.cancelActiveImport();
  assert.equal(fake.terminated, true);
});
