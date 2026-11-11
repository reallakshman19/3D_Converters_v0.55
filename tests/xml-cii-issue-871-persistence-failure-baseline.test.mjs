import test from 'node:test';
import assert from 'node:assert/strict';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import { persistChangedMasterDetailed } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';

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

function createService(store) {
  return createMasterDatasetService({
    getXlsx: async () => { throw new Error('XLSX is not required by this JSON baseline.'); },
    store,
    prepareDataset,
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });
}

function installStorage(entries = {}, options = {}) {
  const previous = globalThis.localStorage;
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (options.failWrites) {
        throw Object.assign(new Error(options.message || 'storage quota exceeded'), {
          name: options.name || 'QuotaExceededError',
        });
      }
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
  };
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

test('C05.5.1 IndexedDB failure returns explicit session-only DATASET_READY and keeps parsed rows accessible', async (t) => {
  const persistenceError = Object.assign(new Error('IndexedDB quota exceeded'), { name: 'QuotaExceededError' });
  let persistCalls = 0;
  const service = createService({
    async persistDataset() {
      persistCalls += 1;
      throw persistenceError;
    },
    async getRows() { return null; },
  });

  const open = {
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
    requestId: 'open-pc',
    jobId: 'job-pc',
    fileName: 'Piping_class_master.json',
    masterKey: 'pipingClass',
    buffer: bytes(JSON.stringify([{ Marker: 'PC-1' }, { Marker: 'PC-2' }])),
    config: {},
    currentMap: {},
  };

  const ready = await service.handle(open);
  assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.equal(ready.metadata.datasetId, 'job-pc:pipingClass:rows:r1');
  assert.equal(ready.metadata.persistenceMode, 'session');
  assert.equal(ready.persistence.persisted, false,
    'IndexedDB quota failure must not pretend that rows are durable');
  assert.equal(ready.persistence.failure.name, 'QuotaExceededError');
  assert.match(ready.persistence.failure.message, /IndexedDB quota exceeded/);
  assert.equal(ready.persistence.quotaLimited, true);
  assert.equal(persistCalls, 1);

  // finalizeDataset() registers the parsed dataset before awaiting persistence.
  const rows = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS,
    requestId: 'rows-pc',
    datasetId: 'job-pc:pipingClass:rows:r1',
    offset: 0,
    limit: 10,
  });
  assert.deepEqual(rows.rows.map((row) => row.Marker), ['PC-1', 'PC-2']);

  t.diagnostic(JSON.stringify({
    parseSucceeded: true,
    sessionDatasetReadableAfterPersistenceFailure: true,
    dataSetReadyReturned: true,
    durability: 'SESSION_ONLY',
    failureSurface: 'TYPED_INDEXEDDB_FAILURE_WITH_SESSION_ROWS',
    nextOwner: 872,
  }));
});

test('C05.5.1 parse failure is distinct and creates no session dataset', async () => {
  let persistCalls = 0;
  const service = createService({
    async persistDataset() { persistCalls += 1; },
    async getRows() { return null; },
  });

  await assert.rejects(
    service.handle({
      type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
      requestId: 'open-invalid',
      jobId: 'job-invalid',
      fileName: 'Piping_class_master.json',
      masterKey: 'pipingClass',
      buffer: bytes('{not valid json'),
      config: {},
      currentMap: {},
    }),
    /JSON|Unexpected|property name|position/i,
  );
  assert.equal(persistCalls, 0);

  await assert.rejects(
    service.handle({
      type: MASTER_DATASET_COMMAND.GET_ROWS,
      requestId: 'rows-invalid',
      datasetId: 'job-invalid:pipingClass:rows:r1',
      offset: 0,
      limit: 10,
    }),
    /Unknown dataset/,
  );
});

test('C05.5.1 localStorage custody failure is returned as persistence failure without throwing away active context', () => {
  const storage = installStorage({}, {
    failWrites: true,
    name: 'QuotaExceededError',
    message: 'localStorage quota exceeded',
  });
  const context = {
    config: { pipingClass: { fieldMap: { size: 'Size' } } },
    pipingClassRows: [],
    rawRows: { pipingClass: [] },
    datasetRefs: {
      pipingClass: {
        datasetId: 'pc-session-visible:r1',
        datasetRevision: 1,
        rowCount: 2,
        masterKey: 'pipingClass',
        fileName: 'Piping_class_master.json',
        fieldMap: { size: 'Size' },
        persistence: 'indexeddb',
      },
    },
    sourceMetadata: {
      pipingClass: { source: 'Piping_class_master.json', rowCount: 2, status: 'loaded' },
    },
    appliedMappingRevision: { pipingClass: 1 },
  };

  try {
    const receipt = persistChangedMasterDetailed('pipingClass', context);
    assert.equal(receipt.quotaLimited, true);
    assert.ok(receipt.failures.length > 0);
    assert.ok(receipt.failures.some((failure) => failure.name === 'QuotaExceededError'));
    assert.equal(context.datasetRefs.pipingClass.datasetId, 'pc-session-visible:r1');
    assert.equal(context.datasetRefs.pipingClass.datasetRevision, 1);
  } finally {
    storage.restore();
  }
});

test('C05.5.1 corrupt cold restore isolates bad master and preserves pre-existing active-session authority', async (t) => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': JSON.stringify({
      source: 'PCF_MAT_MAP.TXT',
      datasetId: 'corrupt:mat:r3',
      datasetRevision: 3,
      rowCount: 2,
      fieldMap: {},
      appliedRevision: 3,
      persistenceMode: 'indexeddb',
    }),
  });
  const activeContext = {
    config: {
      weight: {
        masterRevision: 11,
        masterFingerprint: 'active-weight-fp',
      },
    },
    datasetRefs: {
      weight: {
        datasetId: 'active:wt:r5',
        datasetRevision: 5,
        rowCount: 2,
        masterKey: 'weight',
        masterFingerprint: 'active-weight-fp',
        persistence: 'session',
      },
    },
    rowCounts: { weight: 2 },
    previewRows: { weight: [{ Marker: 'WT-1' }] },
    sourceMetadata: { weight: { source: 'active-session', status: 'loaded', rowCount: 2 } },
    appliedMappingRevision: { weight: 11 },
    rawRows: { weight: [] },
    mappingRows: { weight: [] },
  };
  const stateRef = {
    current: {
      supportConfigJson: JSON.stringify(activeContext.config),
      masterContext: activeContext,
    },
  };
  const before = JSON.parse(JSON.stringify(stateRef.current));

  try {
    let invalidRowReads = 0;
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() { return null; },
        async getRowsRange() { invalidRowReads++; throw new Error('must not read rows after missing metadata'); },
        async getRows() { invalidRowReads++; throw new Error('must not read rows after missing metadata'); },
      },
    }), true);
    assert.equal(invalidRowReads, 0,
      'corrupt persisted Mat Map must never reach indexed row reads');
    assert.deepEqual(stateRef.current.masterContext, before.masterContext,
      'active Weight session authority must survive isolated Mat Map failure');
    assert.equal(stateRef.current.supportConfigJson, before.supportConfigJson);
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity?.materialMap, {
      masterKey: 'materialMap',
      datasetId: 'corrupt:mat:r3',
      domain: 'restore-storage',
      code: 'MISSING_DATASET',
      stage: 'metadata-validate',
    });
    assert.match(stateRef.current.masterRestoreFailures.materialMap.message,
      /Persisted materialMap dataset is unavailable/);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap, undefined,
      'missing Mat Map metadata must never become active authority');

    t.diagnostic(JSON.stringify({
      corruptPersistedAuthorityAttached: false,
      activeSessionAuthorityPreserved: true,
      failureSurface: 'PER_MASTER_TYPED_FAILURE_QUARANTINE',
      userVisibleStatusWrittenHere: false,
      nextOwners: [874, 875],
    }));
  } finally {
    storage.restore();
  }
});
