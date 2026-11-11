import test from 'node:test';
import assert from 'node:assert/strict';

import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';

const CASES = Object.freeze([
  Object.freeze({
    key: 'pipingClass',
    source: 'Piping class master.xlsx',
    datasetId: 'issue835:pc:r4',
    marker: 'PC',
  }),
  Object.freeze({
    key: 'materialMap',
    source: 'PCF_MAT_MAP.TXT',
    datasetId: 'issue835:mat:r4',
    marker: 'MAT',
  }),
  Object.freeze({
    key: 'weight',
    source: 'wtValveweights.xlsx',
    datasetId: 'issue835:wt:r4',
    marker: 'WT',
    masterFingerprint: 'issue835-weight-fingerprint',
  }),
]);

function installStorage(entries = {}) {
  const previous = globalThis.localStorage;
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return {
    values,
    restore() { globalThis.localStorage = previous; },
  };
}

function startupState() {
  return {
    current: {
      supportConfigJson: JSON.stringify({
        pipingClass: { fieldMap: {} },
        material: { fieldMap: {} },
        weight: { fieldMap: {} },
      }),
      masterContext: {
        config: {},
        rawRows: {},
        mappingRows: {},
        datasetRefs: {},
        rowCounts: {},
        previewRows: {},
        sourceMetadata: {},
        appliedMappingRevision: {},
      },
    },
  };
}

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

async function probeSaveBoundary(masterCase) {
  const persisted = [];
  const service = createMasterDatasetService({
    getXlsx: async () => { throw new Error('XLSX is not required by this JSON service-boundary probe.'); },
    store: {
      async persistDataset(metadata, rows) {
        persisted.push({ metadata, rows });
      },
      async getRows() { return null; },
    },
    prepareDataset,
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });
  const ready = await service.handle({
    type: MASTER_DATASET_COMMAND.OPEN_SOURCE,
    requestId: `issue835-save-${masterCase.key}`,
    jobId: `issue835-${masterCase.key}`,
    fileName: `${masterCase.key}.json`,
    masterKey: masterCase.key,
    buffer: bytes(JSON.stringify([{ Marker: masterCase.marker }])),
    config: {},
    currentMap: {},
  });
  assert.equal(ready.type, MASTER_DATASET_EVENT.DATASET_READY);
  assert.equal(ready.metadata.datasetRevision, 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].metadata.datasetRevision, 1);
  return 'PASS';
}

async function probeColdHydration(masterCase) {
  const datasetRevision = 4;
  const appliedRevision = 7;
  const custody = {
    source: masterCase.source,
    datasetId: masterCase.datasetId,
    rowCount: 1,
    fieldMap: { marker: 'Marker' },
    appliedRevision,
    datasetRevision,
    persistenceMode: 'indexeddb',
    ...(masterCase.masterFingerprint ? { masterFingerprint: masterCase.masterFingerprint } : {}),
  };
  const storage = installStorage({
    [`xml-cii-master-source-${masterCase.key}`]: JSON.stringify(custody),
  });
  const row = { Marker: masterCase.marker };
  const store = {
    async getMetadata(datasetId) {
      if (datasetId !== masterCase.datasetId) return null;
      return {
        datasetId,
        datasetRevision,
        rowCount: 1,
        fileName: masterCase.source,
        mappingRows: [row],
        ...(masterCase.masterFingerprint ? { masterFingerprint: masterCase.masterFingerprint } : {}),
      };
    },
    async getRowsRange(datasetId, offset, limit) {
      return datasetId === masterCase.datasetId ? [row].slice(offset, offset + limit) : null;
    },
    async getRows(datasetId) {
      return datasetId === masterCase.datasetId ? [row] : null;
    },
  };
  const stateRef = startupState();
  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, { store });
    const context = stateRef.current.masterContext;
    const ref = context.datasetRefs[masterCase.key];
    return {
      discovery: changed && ref?.datasetId === masterCase.datasetId ? 'PASS' : 'RED',
      identityRevision: ref?.datasetRevision === datasetRevision ? 'PASS' : 'RED',
      hydrate: context.rowCounts[masterCase.key] === 1
        && context.previewRows[masterCase.key]?.[0]?.Marker === masterCase.marker ? 'PASS' : 'RED',
      runtimeReattach: ref?.persistence === 'indexeddb'
        && context.appliedMappingRevision[masterCase.key] === appliedRevision ? 'PASS' : 'RED',
      observedDatasetRevision: ref?.datasetRevision,
      expectedDatasetRevision: datasetRevision,
    };
  } finally {
    storage.restore();
  }
}

for (const masterCase of CASES) {
  test(`C05.1 ${masterCase.key} save + cold-load custody baseline`, async (t) => {
    const save = await probeSaveBoundary(masterCase);
    const cold = await probeColdHydration(masterCase);
    const baseline = {
      master: masterCase.key,
      save,
      discovery: cold.discovery,
      identityRevision: cold.identityRevision,
      hydrate: cold.hydrate,
      runtimeReattach: cold.runtimeReattach,
      classification: cold.identityRevision === 'RED' ? 'IDENTITY_REVISION' : 'NONE',
      expectedDatasetRevision: cold.expectedDatasetRevision,
      observedDatasetRevision: cold.observedDatasetRevision ?? null,
    };
    t.diagnostic(JSON.stringify(baseline));
    assert.deepEqual(
      {
        save: baseline.save,
        discovery: baseline.discovery,
        identityRevision: baseline.identityRevision,
        hydrate: baseline.hydrate,
        runtimeReattach: baseline.runtimeReattach,
        classification: baseline.classification,
      },
      {
        save: 'PASS',
        discovery: 'PASS',
        identityRevision: 'PASS',
        hydrate: 'PASS',
        runtimeReattach: 'PASS',
        classification: 'NONE',
      },
      `${masterCase.key} C04-head baseline changed; update C05 serial responsibility evidence before continuing`,
    );
  });
}

/*
 * The original #835 baseline was an intentionally RED snapshot of a lost
 * datasetRevision. C05.2/C05.3/C05.4 now preserve it. In integrated #228,
 * keep the positive three-master custody oracle and negative fail-closed
 * regression together; do not turn the historical failure into a skip.
 */
for (const masterCase of CASES) {
  test(`C05.1 ${masterCase.key} refuses stale persisted revision before row access`, async () => {
    const custody = {
      source: masterCase.source,
      datasetId: masterCase.datasetId,
      datasetRevision: 4,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 7,
      persistenceMode: 'indexeddb',
      ...(masterCase.masterFingerprint ? { masterFingerprint: masterCase.masterFingerprint } : {}),
    };
    const storage = installStorage({
      [`xml-cii-master-source-${masterCase.key}`]: JSON.stringify(custody),
    });
    const stateRef = startupState();
    let invalidRowReads = 0;
    try {
      assert.equal(await hydratePersistedMasterDatasets(stateRef, {
        store: {
          async getMetadata(id) {
            assert.equal(id, masterCase.datasetId);
            return {
              datasetId: id,
              datasetRevision: 5,
              rowCount: 1,
              fileName: masterCase.source,
              ...(masterCase.masterFingerprint ? { masterFingerprint: masterCase.masterFingerprint } : {}),
            };
          },
          async getRowsRange() { invalidRowReads++; throw Error('STALE_CUSTODY_ROWS_FORBIDDEN'); },
          async getRows() { invalidRowReads++; throw Error('STALE_CUSTODY_ROWS_FORBIDDEN'); },
        },
      }), true);
      assert.equal(invalidRowReads, 0, 'revision mismatch must veto indexed row reads');
      assert.deepEqual(stateRef.current.masterRestoreFailureIdentity?.[masterCase.key], {
        masterKey: masterCase.key,
        datasetId: masterCase.datasetId,
        domain: 'restore-storage',
        code: 'REVISION_MISMATCH',
        stage: 'metadata-validate',
      });
      assert.equal(stateRef.current.masterContext.datasetRefs?.[masterCase.key], undefined,
        'stale persisted authority must not become active');
      assert.equal(stateRef.current.masterContext.appliedMappingRevision?.[masterCase.key], undefined,
        'stale applied mapping revision must not activate');
    } finally {
      storage.restore();
    }
  });
}
