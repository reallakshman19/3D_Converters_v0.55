import test from 'node:test';
import assert from 'node:assert/strict';

import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { createMasterDatasetImportCoordinator } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js';
import { xmlCiiWeightMasterRowsFingerprint } from '../converters/xml-cii2019-core/rigid-weight-authority.js';

function bytes(value) { return new TextEncoder().encode(value).buffer; }
function memoryStore() {
  const data = new Map();
  return {
    data,
    async persistDataset(metadata, rows) { data.set(metadata.datasetId, { metadata: structuredClone(metadata), rows: structuredClone(rows) }); },
    async getMetadata(id) { return data.get(id)?.metadata || null; },
    async getRows(id) { return data.get(id)?.rows || null; },
  };
}

function serviceWithStore(store) {
  return createMasterDatasetService({
    getXlsx: async () => { throw new Error('xlsx not used'); },
    store,
    prepareDataset(masterKey, rawRows, _currentMap, _config, override) {
      const fieldMap = override || { value: 'A' };
      const rows = rawRows.map((row, index) => ({ ...row, _rowIndex: index + 1, value: row[fieldMap.value] ?? '' }));
      return { fieldMap, rows, searchCorpus: rows.map((row) => String(row.value).toLowerCase()) };
    },
    buildSearchCorpus: (rows) => rows.map((row) => String(row.value).toLowerCase()),
    searchCorpusIndexes: (corpus, query) => corpus.map((value, index) => value.includes(String(query).toLowerCase()) ? index : -1).filter((index) => index >= 0),
  });
}

test('worker remap creates a new dataset revision and preserves the prior persisted dataset', async () => {
  const store = memoryStore();
  const service = serviceWithStore(store);
  const raw = [{ A: 'old-1', B: 'new-1' }, { A: 'old-2', B: 'new-2' }];
  const first = await service.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE, requestId: 'open', jobId: 'job-remap', fileName: 'rows.json', masterKey: 'lineList',
    buffer: bytes(JSON.stringify(raw)), config: {}, currentMap: {},
  });
  assert.equal(first.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.match(first.metadata.datasetId, /:r1$/);
  assert.deepEqual(store.data.get(first.metadata.datasetId).rows.map((row) => row.value), ['old-1', 'old-2']);

  const second = await service.handle({
    type: MASTER_DATASET_COMMAND.REMAP_DATASET, requestId: 'remap', datasetId: first.metadata.datasetId, fieldMap: { value: 'B' },
  });
  assert.equal(second.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.match(second.metadata.datasetId, /:r2$/);
  assert.notEqual(second.metadata.datasetId, first.metadata.datasetId);
  assert.deepEqual(store.data.get(first.metadata.datasetId).rows.map((row) => row.value), ['old-1', 'old-2']);
  assert.deepEqual(store.data.get(second.metadata.datasetId).rows.map((row) => row.value), ['new-1', 'new-2']);
  assert.equal(store.data.size, 2);
});

test('worker emits Weight master fingerprint in dataset metadata', async () => {
  const store = memoryStore();
  const service = serviceWithStore(store);
  const raw = [{ A: '10', B: '11' }, { A: '20', B: '22' }];
  const ready = await service.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE, requestId: 'weight-open', jobId: 'weight-job', fileName: 'weight.json', masterKey: 'weight',
    buffer: bytes(JSON.stringify(raw)), config: {}, currentMap: {},
  });
  const persisted = store.data.get(ready.metadata.datasetId).rows;
  assert.equal(ready.metadata.masterFingerprint, xmlCiiWeightMasterRowsFingerprint(persisted));
  assert.ok(ready.metadata.masterFingerprint);
});

test('remap fails closed after raw session custody is unavailable', async () => {
  const store = memoryStore();
  const firstService = serviceWithStore(store);
  const raw = [{ A: 'old', B: 'new' }];
  const ready = await firstService.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE, requestId: 'open', jobId: 'job-reload', fileName: 'rows.json', masterKey: 'lineList',
    buffer: bytes(JSON.stringify(raw)), config: {}, currentMap: {},
  });
  const reloadedService = serviceWithStore(store);
  await assert.rejects(
    () => reloadedService.handle({ type: MASTER_DATASET_COMMAND.REMAP_DATASET, requestId: 'remap', datasetId: ready.metadata.datasetId, fieldMap: { value: 'B' } }),
    /Raw rows are session-only/,
  );
});

test('coordinator promotes remapped dataset to active custody', async () => {
  const calls = [];
  const client = {
    async remapDataset(datasetId, fieldMap) {
      calls.push({ datasetId, fieldMap });
      return { type: MASTER_DATASET_EVENT.DATASET_READY, metadata: { datasetId: 'ds-r2', rowCount: 2 } };
    },
    dispose() {},
  };
  const coordinator = createMasterDatasetImportCoordinator({ client });
  const result = await coordinator.remapDataset('lineList', 'ds-r1', { lineNo: 'Line' });
  assert.equal(result.metadata.datasetId, 'ds-r2');
  assert.deepEqual(calls, [{ datasetId: 'ds-r1', fieldMap: { lineNo: 'Line' } }]);
  const active = await coordinator.remapDataset('lineList', '', { lineNo: 'Line2' });
  assert.equal(active.metadata.datasetId, 'ds-r2');
  assert.equal(calls[1].datasetId, 'ds-r2');
});
