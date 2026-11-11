
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import {
  masterImportPersistenceStatus,
  retryCurrentMasterPersistence,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js';
import { commitDatasetReadyMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-commit.js';
import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';

function bytes(textValue) {
  return new TextEncoder().encode(textValue).buffer;
}

function installStorage() {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

function prepareDataset(_masterKey, rawRows, currentMap = {}) {
  return {
    fieldMap: Object.keys(currentMap || {}).length ? currentMap : { marker: 'Marker' },
    rows: rawRows.map((row, index) => ({ ...row, _rowIndex: index + 1 })),
    searchCorpus: rawRows.map((row) => JSON.stringify(row).toLowerCase()),
  };
}

function sessionState(key = 'weight') {
  const configKey = key === 'materialMap' ? 'material' : key;
  const fingerprint = key === 'weight' ? 'fp-session-875' : '';
  const ref = {
    datasetId: 'session:' + key + ':r5',
    datasetRevision: 5,
    rowCount: 2,
    masterKey: key,
    fileName: key === 'weight' ? 'wtValveweights.json' : key + '.json',
    fieldMap: { marker: 'Marker' },
    ...(fingerprint ? { masterFingerprint: fingerprint } : {}),
    persistence: 'session',
  };
  const configSection = {
    fieldMap: { marker: 'Marker' },
    ...(key === 'weight' ? { masterRevision: 7, masterFingerprint: fingerprint } : {}),
  };
  const context = {
    config: { [configKey]: configSection },
    rawRows: { [key]: [] },
    mappingRows: { [key]: [{ Marker: 'A' }, { Marker: 'B' }] },
    datasetRefs: { [key]: ref },
    rowCounts: { [key]: 2 },
    previewRows: { [key]: [{ Marker: 'A' }, { Marker: 'B' }] },
    sourceMetadata: { [key]: { key, source: ref.fileName, sourceType: 'worker-import', status: 'loaded', rowCount: 2 } },
    appliedMappingRevision: { [key]: 7 },
  };
  return {
    current: {
      supportConfigJson: JSON.stringify(context.config),
      masterContext: context,
      importMastersLoading: false,
      importMastersWriteBackStatus: '',
      masterPersistenceFailures: {
        [key]: {
          key,
          datasetId: ref.datasetId,
          phase: 'indexeddb',
          name: 'QuotaExceededError',
          message: 'IndexedDB quota exceeded',
          quotaLimited: true,
        },
      },
    },
  };
}

function blankContext() {
  return {
    config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {},
    previewRows: {}, sourceMetadata: {}, appliedMappingRevision: {},
  };
}

test('C05.5.5 worker persistence retry reuses parsed dataset and preserves identity', async () => {
  let prepareCalls = 0;
  let persistCalls = 0;
  const persisted = [];
  const service = createMasterDatasetService({
    getXlsx: async () => { throw new Error('XLSX not needed'); },
    store: {
      async persistDataset(metadata, rows) {
        persistCalls += 1;
        if (persistCalls <= 2) throw Object.assign(new Error('IndexedDB quota exceeded'), { name: 'QuotaExceededError' });
        persisted.push({ metadata, rows });
      },
      async getRows() { return null; },
    },
    prepareDataset(masterKey, rawRows, currentMap, config, override) {
      prepareCalls += 1;
      return prepareDataset(masterKey, rawRows, currentMap, config, override);
    },
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });

  const ready = await service.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
    requestId: 'open-875',
    jobId: 'job-875',
    fileName: 'wtValveweights.json',
    masterKey: 'weight',
    buffer: bytes(JSON.stringify([{ Marker: 'W1' }, { Marker: 'W2' }])),
    config: {},
    currentMap: {},
  });
  const identity = {
    datasetId: ready.metadata.datasetId,
    datasetRevision: ready.metadata.datasetRevision,
    masterFingerprint: ready.metadata.masterFingerprint,
  };
  assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.equal(ready.metadata.persistenceMode, 'session');
  assert.equal(ready.persistence.persisted, false);
  assert.equal(prepareCalls, 1);

  const failedRetry = await service.handle({
    type: MASTER_DATASET_COMMAND.RETRY_PERSISTENCE,
    requestId: 'retry-fail-875',
    datasetId: identity.datasetId,
  });
  assert.equal(failedRetry.type, MASTER_DATASET_EVENT.PERSISTENCE_RESULT);
  assert.equal(failedRetry.persistence.persisted, false);
  assert.equal(failedRetry.metadata.persistenceMode, 'session');
  assert.equal(failedRetry.metadata.datasetId, identity.datasetId);
  assert.equal(failedRetry.metadata.datasetRevision, identity.datasetRevision);
  assert.equal(failedRetry.metadata.masterFingerprint, identity.masterFingerprint);
  assert.equal(prepareCalls, 1);

  const rows = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS,
    requestId: 'rows-875',
    datasetId: identity.datasetId,
    offset: 0,
    limit: 10,
  });
  assert.deepEqual(rows.rows.map((row) => row.Marker), ['W1', 'W2']);

  const successfulRetry = await service.handle({
    type: MASTER_DATASET_COMMAND.RETRY_PERSISTENCE,
    requestId: 'retry-ok-875',
    datasetId: identity.datasetId,
  });
  assert.equal(successfulRetry.type, MASTER_DATASET_EVENT.PERSISTENCE_RESULT);
  assert.equal(successfulRetry.persistence.persisted, true);
  assert.equal(successfulRetry.metadata.persistenceMode, 'indexeddb');
  assert.equal(successfulRetry.metadata.datasetId, identity.datasetId);
  assert.equal(successfulRetry.metadata.datasetRevision, identity.datasetRevision);
  assert.equal(successfulRetry.metadata.masterFingerprint, identity.masterFingerprint);
  assert.equal(prepareCalls, 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].metadata.datasetId, identity.datasetId);
  assert.equal(persisted[0].rows.length, 2);
});

test('C05.5.5 user-visible status distinguishes parse success from storage failure', () => {
  const indexedDb = masterImportPersistenceStatus('Imported wtValveweights.json.', {
    persisted: false,
    failure: { name: 'QuotaExceededError', message: 'IndexedDB quota exceeded' },
    quotaLimited: true,
  }, null);
  assert.match(indexedDb, /Parse\/import succeeded/);
  assert.match(indexedDb, /Active session is usable/);
  assert.match(indexedDb, /durable IndexedDB persistence failed/);
  assert.match(indexedDb, /Reload will not restore this session-only dataset as durable/);
  assert.match(indexedDb, /Retry durable save/);
  assert.doesNotMatch(indexedDb, /parse failed|import failed/i);

  const restart = masterImportPersistenceStatus('Imported PCF_MAT_MAP.TXT.', {
    persisted: true, failure: null, quotaLimited: false,
  }, {
    failures: [{ name: 'QuotaExceededError', message: 'localStorage quota exceeded' }],
    quotaLimited: true,
    indexedDbBacked: true,
    normalizedPersisted: true,
  });
  assert.match(restart, /Parse\/import succeeded/);
  assert.match(restart, /restart custody could not be saved/);
  assert.match(restart, /Active session remains usable/);
  assert.match(restart, /Retry durable save/);
});

test('C05.5.5 retry promotes only persistence custody and not mapping authority', async () => {
  const stateRef = sessionState('weight');
  const beforeRef = structuredClone(stateRef.current.masterContext.datasetRefs.weight);
  const beforeRevision = stateRef.current.masterContext.appliedMappingRevision.weight;
  let retryCalls = 0;
  let custodyCalls = 0;

  const result = await retryCurrentMasterPersistence(stateRef, 'weight', {
    async retryPersistence(_key, datasetId) {
      retryCalls += 1;
      assert.equal(datasetId, beforeRef.datasetId);
      return {
        type: MASTER_DATASET_EVENT.PERSISTENCE_RESULT,
        datasetId,
        metadata: { ...beforeRef, persistenceMode: 'indexeddb' },
        persistence: { persisted: true, failure: null, quotaLimited: false },
      };
    },
    persistCustody(key, context) {
      custodyCalls += 1;
      assert.equal(key, 'weight');
      assert.equal(context.datasetRefs.weight.persistence, 'indexeddb');
      return {
        writes: 1, failures: [], compact: true, quotaLimited: false,
        normalizedPersisted: true, indexedDbBacked: true, sessionOnly: false,
      };
    },
  });

  const afterRef = stateRef.current.masterContext.datasetRefs.weight;
  assert.equal(afterRef.datasetId, beforeRef.datasetId);
  assert.equal(afterRef.datasetRevision, beforeRef.datasetRevision);
  assert.equal(afterRef.masterFingerprint, beforeRef.masterFingerprint);
  assert.equal(afterRef.persistence, 'indexeddb');
  assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, beforeRevision);
  assert.equal(stateRef.current.masterContext.config.weight.masterRevision, 7);
  assert.equal(stateRef.current.masterPersistenceFailures.weight, undefined);
  assert.match(stateRef.current.importMastersWriteBackStatus, /Dataset identity and applied mapping revision are unchanged/);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'durable');
  assert.equal(retryCalls, 1);
  assert.equal(custodyCalls, 1);
});

test('C05.5.5 failed worker retry remains session-only and retryable', async () => {
  const stateRef = sessionState('materialMap');
  const before = structuredClone(stateRef.current.masterContext);
  const result = await retryCurrentMasterPersistence(stateRef, 'materialMap', {
    async retryPersistence() {
      return {
        persistence: {
          persisted: false,
          failure: { name: 'QuotaExceededError', message: 'still full' },
          quotaLimited: true,
        },
      };
    },
    persistCustody() {
      throw new Error('custody must not run when IndexedDB retry fails');
    },
  });

  assert.deepEqual(stateRef.current.masterContext, before);
  assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.persistence, 'session');
  assert.equal(stateRef.current.masterPersistenceFailures.materialMap.phase, 'indexeddb');
  assert.equal(stateRef.current.masterPersistenceFailures.materialMap.name, 'QuotaExceededError');
  assert.match(stateRef.current.importMastersWriteBackStatus, /Parse\/import succeeded/);
  assert.match(stateRef.current.importMastersWriteBackStatus, /Retry durable save/);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'indexeddb-failure');
});

test('C05.5.5 restart-custody retry avoids re-persisting already durable rows', async () => {
  const stateRef = sessionState('pipingClass');
  const basisRevision = stateRef.current.masterContext.appliedMappingRevision.pipingClass;
  let workerCalls = 0;
  let custodyCalls = 0;

  const first = await retryCurrentMasterPersistence(stateRef, 'pipingClass', {
    async retryPersistence() {
      workerCalls += 1;
      return { persistence: { persisted: true, failure: null, quotaLimited: false } };
    },
    persistCustody() {
      custodyCalls += 1;
      return {
        writes: 0,
        failures: [{ key: 'xml-cii-master-source-pipingClass', name: 'QuotaExceededError', message: 'localStorage full' }],
        compact: true,
        quotaLimited: true,
        normalizedPersisted: true,
        indexedDbBacked: true,
        sessionOnly: false,
      };
    },
  });

  assert.equal(first.ok, false);
  assert.equal(first.reason, 'restart-custody-failure');
  assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.persistence, 'indexeddb');
  assert.equal(stateRef.current.masterContext.appliedMappingRevision.pipingClass, basisRevision);
  assert.equal(stateRef.current.masterPersistenceFailures.pipingClass.phase, 'restart-custody');

  const second = await retryCurrentMasterPersistence(stateRef, 'pipingClass', {
    async retryPersistence() {
      workerCalls += 1;
      throw new Error('worker retry must be skipped after rows are durable');
    },
    persistCustody() {
      custodyCalls += 1;
      return {
        writes: 1, failures: [], compact: true, quotaLimited: false,
        normalizedPersisted: true, indexedDbBacked: true, sessionOnly: false,
      };
    },
  });

  assert.equal(second.ok, true);
  assert.equal(second.reason, 'durable');
  assert.equal(workerCalls, 1);
  assert.equal(custodyCalls, 2);
  assert.equal(stateRef.current.masterPersistenceFailures.pipingClass, undefined);
  assert.equal(stateRef.current.masterContext.appliedMappingRevision.pipingClass, basisRevision);
});

test('C05.5.5 stale retry result cannot overwrite newer authority', async () => {
  const stateRef = sessionState('weight');
  const oldId = stateRef.current.masterContext.datasetRefs.weight.datasetId;
  const result = await retryCurrentMasterPersistence(stateRef, 'weight', {
    async retryPersistence() {
      const context = stateRef.current.masterContext;
      stateRef.current = {
        ...stateRef.current,
        masterContext: {
          ...context,
          datasetRefs: {
            ...context.datasetRefs,
            weight: Object.freeze({
              ...context.datasetRefs.weight,
              datasetId: 'session:weight:newer',
              datasetRevision: 6,
              persistence: 'session',
            }),
          },
          appliedMappingRevision: { ...context.appliedMappingRevision, weight: 8 },
        },
      };
      return { persistence: { persisted: true, failure: null, quotaLimited: false } };
    },
    persistCustody() {
      throw new Error('stale retry must not write restart custody');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'stale-result');
  assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetId, 'session:weight:newer');
  assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetRevision, 6);
  assert.equal(stateRef.current.masterContext.datasetRefs.weight.persistence, 'session');
  assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, 8);
  assert.notEqual(stateRef.current.masterContext.datasetRefs.weight.datasetId, oldId);
});

test('C05.5.5 reload never treats session-only custody as durable', async () => {
  const storage = installStorage();
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'materialMap',
      ready: {
        metadata: {
          datasetId: 'session:materialMap:r2',
          datasetRevision: 2,
          rowCount: 2,
          masterKey: 'materialMap',
          fileName: 'PCF_MAT_MAP.TXT',
          fieldMap: { marker: 'Marker' },
          persistenceMode: 'session',
        },
        previewRows: [{ Marker: 'A' }, { Marker: 'B' }],
        mappingRows: [{ Marker: 'A' }, { Marker: 'B' }],
        persistence: {
          persisted: false,
          failure: { name: 'QuotaExceededError', message: 'IndexedDB quota exceeded' },
          quotaLimited: true,
        },
      },
      sourceMetadata: { key: 'materialMap', source: 'PCF_MAT_MAP.TXT', status: 'loaded', rowCount: 2 },
    });
    assert.equal(committed.context.datasetRefs.materialMap.persistence, 'session');

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-materialMap') || '{}');
    assert.equal(custody.persistenceMode, 'session');
    assert.equal(custody.datasetId, undefined);

    const reload = { current: { supportConfigJson: '{}', masterContext: blankContext() } };
    let storageReads = 0;
    assert.equal(await hydratePersistedMasterDatasets(reload, {
      store: {
        async getMetadata() { storageReads += 1; throw new Error('must not read session-only custody'); },
        async getRowsRange() { storageReads += 1; throw new Error('must not read session-only custody'); },
        async getRows() { storageReads += 1; throw new Error('must not read session-only custody'); },
      },
    }), false);
    assert.equal(storageReads, 0);
    assert.equal(reload.current.masterContext.datasetRefs.materialMap, undefined);
  } finally {
    storage.restore();
  }
});

test('C05.5.5 later durable import replaces prior session authority cleanly', () => {
  const storage = installStorage();
  try {
    const first = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'weight',
      ready: {
        metadata: {
          datasetId: 'session:weight:r1',
          datasetRevision: 1,
          rowCount: 1,
          masterKey: 'weight',
          fileName: 'wtValveweights.json',
          fieldMap: {},
          masterFingerprint: 'fp-old',
          persistenceMode: 'session',
        },
        previewRows: [{ Marker: 'OLD' }],
        mappingRows: [{ Marker: 'OLD' }],
      },
      sourceMetadata: { key: 'weight', source: 'wtValveweights.json', status: 'loaded', rowCount: 1 },
    });

    const second = commitDatasetReadyMaster({
      context: first.context,
      config: first.config,
      key: 'weight',
      ready: {
        metadata: {
          datasetId: 'durable:weight:r2',
          datasetRevision: 2,
          rowCount: 2,
          masterKey: 'weight',
          fileName: 'wtValveweights.json',
          fieldMap: {},
          masterFingerprint: 'fp-new',
          persistenceMode: 'indexeddb',
        },
        previewRows: [{ Marker: 'NEW1' }, { Marker: 'NEW2' }],
        mappingRows: [{ Marker: 'NEW1' }, { Marker: 'NEW2' }],
      },
      sourceMetadata: { key: 'weight', source: 'wtValveweights.json', status: 'loaded', rowCount: 2 },
    });

    assert.equal(first.context.datasetRefs.weight.persistence, 'session');
    assert.equal(second.context.datasetRefs.weight.persistence, 'indexeddb');
    assert.equal(second.context.datasetRefs.weight.datasetId, 'durable:weight:r2');
    assert.equal(second.context.datasetRefs.weight.datasetRevision, 2);
    assert.equal(second.context.datasetRefs.weight.masterFingerprint, 'fp-new');
    assert.equal(second.context.appliedMappingRevision.weight, first.context.appliedMappingRevision.weight + 1);

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-weight') || '{}');
    assert.equal(custody.persistenceMode, 'indexeddb');
    assert.equal(custody.datasetId, 'durable:weight:r2');
    assert.equal(custody.datasetRevision, 2);
    assert.equal(custody.masterFingerprint, 'fp-new');
  } finally {
    storage.restore();
  }
});

test('C05.5.5 UI contains explicit session-only state and retry control', async () => {
  const source = await fs.readFile(
    new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js', import.meta.url),
    'utf8',
  );
  assert.ok(source.includes('SESSION ONLY — active now; reload requires durable retry or re-import'));
  assert.ok(source.includes('Retry durable save'));
  assert.ok(source.includes('retry-master-persistence'));
  assert.ok(source.includes('Parse/import succeeded and this master is usable now'));
});

test('C05.5.5 modified runtime modules and docs mirrors are byte-identical', async () => {
  const paths = [
    'tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-smart.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-cii-zip.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
    'tabs/xml-cii-2019-standalone-tab.js',
  ];
  for (const sourcePath of paths) {
    const source = await fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8');
    const docs = await fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8');
    assert.equal(source, docs, sourcePath);
  }
});

test('C05.5.5 retry custody remains reachable through successor C05 and P0 import generations', async () => {
  // Strictly pin the successor cache chain for each exact original module:
  // C05.6.2 authority and Mode-B legitimately superseded some 20261006 tags.
  // The retry handler/worker must keep the original retry-generation boundary.
  const retry = '20261006-c05-5-5-persistence-retry-1';
  const authority = '20261007-c05-6-2-consumer-authority-1';
  const modeB = '20261008-p0-mode-b-parity-1';
  const graph = [
    ['tabs/xml-cii-2019-standalone-tab.js', modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js', modeB, authority],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js', authority],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js', modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-cii-zip.js', modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a.js', modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js', retry, authority],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-smart.js', modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels.js', retry],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js', retry, modeB],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js', retry],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js', retry],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js', retry],
    ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js', authority],
    ['tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js', authority],
    ['tabs/xml-cii-2019-standalone/workers/master-dataset-client.js', retry, authority],
    ['tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js', retry, authority],
    ['tabs/xml-cii-2019-standalone/workers/master-dataset-service.js', retry],
  ];
  assert.equal(graph.length, 18, 'all original retry-import graph modules must remain covered');
  for (const [path, ...requiredGenerations] of graph) {
    const [source, deployed] = await Promise.all([
      fs.readFile(new URL('../' + path, import.meta.url), 'utf8'),
      fs.readFile(new URL('../docs/' + path, import.meta.url), 'utf8'),
    ]);
    assert.equal(source, deployed, path + ' source/docs mirror mismatch');
    for (const generation of requiredGenerations)
      assert.ok(source.includes(generation), path + ' missing required import version ' + generation);
  }
});
