import test from 'node:test';
import assert from 'node:assert/strict';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';

function serviceWith(rowsById, metadataById) {
  return createMasterDatasetService({
    getXlsx: async () => { throw new Error('xlsx not required'); },
    store: {
      async persistDataset() {},
      async getMetadata(id) { return metadataById[id] || null; },
      async getRows(id) { return rowsById[id] || null; },
    },
    prepareDataset: (_masterKey, rows) => ({
      fieldMap: {},
      rows,
      searchCorpus: rows.map((row) => JSON.stringify(row).toLowerCase()),
    }),
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });
}

test('C05.6.2 baseline: generic GET_ROWS currently ignores requested masterKey and accepts cross-master datasetId', async (t) => {
  const id = 'issue893:materialMap:r3';
  const service = serviceWith(
    { [id]: [{ Material: 'CS', Code: 'A106B' }] },
    { [id]: { datasetId: id, datasetRevision: 3, masterKey: 'materialMap', rowCount: 1 } },
  );

  const result = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS,
    requestId: 'cross-key-baseline',
    datasetId: id,
    masterKey: 'pipingClass',
    datasetRevision: 3,
    offset: 0,
    limit: 1,
  });

  assert.equal(result.type, MASTER_DATASET_EVENT.ROWS_RESULT);
  assert.equal(result.datasetId, id);
  assert.equal(result.rows[0].Code, 'A106B');
  t.diagnostic('CROSS_MASTER_KEY_NOT_ENFORCED');
});

test('C05.6.2 baseline: generic GET_ROWS currently ignores expected datasetRevision', async (t) => {
  const id = 'issue893:pipingClass:r5';
  const service = serviceWith(
    { [id]: [{ Class: 'A1', Bore: 80 }] },
    { [id]: { datasetId: id, datasetRevision: 5, masterKey: 'pipingClass', rowCount: 1 } },
  );

  const result = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS,
    requestId: 'stale-revision-baseline',
    datasetId: id,
    masterKey: 'pipingClass',
    datasetRevision: 4,
    offset: 0,
    limit: 1,
  });

  assert.equal(result.type, MASTER_DATASET_EVENT.ROWS_RESULT);
  assert.equal(result.datasetId, id);
  assert.equal(result.rows[0].Class, 'A1');
  t.diagnostic('STALE_DATASET_REVISION_NOT_ENFORCED');
});

test('C05.6.2 baseline: Weight Match already rejects non-weight dataset authority', async () => {
  const id = 'issue893:materialMap:r2';
  const service = serviceWith(
    { [id]: [{ Material: 'CS' }] },
    { [id]: { datasetId: id, datasetRevision: 2, masterKey: 'materialMap', rowCount: 1 } },
  );

  await assert.rejects(
    () => service.handle({
      type: MASTER_DATASET_COMMAND.RANK_WEIGHT_ISSUES,
      requestId: 'weight-key-guard',
      datasetId: id,
      issues: [],
      config: {},
    }),
    /Weight Match requires a weight dataset; received materialMap/,
  );
});
