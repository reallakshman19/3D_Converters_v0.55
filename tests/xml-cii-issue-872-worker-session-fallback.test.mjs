import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';

function bytes(text) {
  return new TextEncoder().encode(text).buffer;
}

function prepareDataset(_masterKey, rawRows, currentMap = {}) {
  return {
    fieldMap: Object.keys(currentMap || {}).length ? currentMap : { marker: 'Marker' },
    rows: rawRows.map((row, index) => ({ ...row, _rowIndex: index + 1 })),
    searchCorpus: rawRows.map((row) => JSON.stringify(row).toLowerCase()),
  };
}

function serviceWith(store) {
  return createMasterDatasetService({
    getXlsx: async () => { throw new Error('XLSX is not required by this JSON contract.'); },
    store,
    prepareDataset,
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });
}

for (const masterKey of ['pipingClass', 'materialMap', 'weight']) {
  test(`C05.5.2 ${masterKey} remains active-session usable when IndexedDB persistence fails`, async () => {
    const failure = Object.assign(new Error('IndexedDB quota exceeded'), { name: 'QuotaExceededError' });
    const service = serviceWith({
      async persistDataset() { throw failure; },
      async getRows() { return null; },
    });
    const jobId = `job-${masterKey}`;
    const ready = await service.handle({
      type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
      requestId: `open-${masterKey}`,
      jobId,
      fileName: `${masterKey}.json`,
      masterKey,
      buffer: bytes(JSON.stringify([{ Marker: `${masterKey}-1` }, { Marker: `${masterKey}-2` }])),
      config: {},
      currentMap: {},
    });

    assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
    assert.equal(ready.metadata.persistenceMode, 'session');
    assert.equal(ready.persistence.persisted, false);
    assert.equal(ready.persistence.failure.name, 'QuotaExceededError');
    assert.match(ready.persistence.failure.message, /IndexedDB quota exceeded/);
    assert.equal(ready.persistence.quotaLimited, true);
    assert.equal(ready.metadata.rowCount, 2);

    const rows = await service.handle({
      type: MASTER_DATASET_COMMAND.GET_ROWS,
      requestId: `rows-${masterKey}`,
      datasetId: ready.metadata.datasetId,
      offset: 0,
      limit: 10,
    });
    assert.deepEqual(rows.rows.map((row) => row.Marker), [`${masterKey}-1`, `${masterKey}-2`]);
  });
}

test('C05.5.2 durable success still reports IndexedDB persistence', async () => {
  const persisted = [];
  const service = serviceWith({
    async persistDataset(metadata, rows) { persisted.push({ metadata, rows }); },
    async getRows() { return null; },
  });
  const ready = await service.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
    requestId: 'open-ok',
    jobId: 'job-ok',
    fileName: 'pipingClass.json',
    masterKey: 'pipingClass',
    buffer: bytes(JSON.stringify([{ Marker: 'PC' }])),
    config: {},
    currentMap: {},
  });

  assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.equal(ready.metadata.persistenceMode, 'indexeddb');
  assert.deepEqual(ready.persistence, { persisted: true, failure: null, quotaLimited: false });
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].metadata.persistenceMode, 'indexeddb');
});

test('C05.5.2 parse failure remains a parse failure and never reaches persistence fallback', async () => {
  let persistCalls = 0;
  const service = serviceWith({
    async persistDataset() { persistCalls += 1; },
    async getRows() { return null; },
  });

  await assert.rejects(
    service.handle({
      type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
      requestId: 'open-invalid',
      jobId: 'job-invalid',
      fileName: 'invalid.json',
      masterKey: 'pipingClass',
      buffer: bytes('{invalid json'),
      config: {},
      currentMap: {},
    }),
    /JSON|Unexpected|property name|position/i,
  );
  assert.equal(persistCalls, 0);
});

test('C05.5.2 worker service source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
