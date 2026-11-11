import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';

function installStorage(entries = {}) {
  const previous = globalThis.localStorage;
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return { restore: () => { globalThis.localStorage = previous; } };
}

function baseState(activeWeight = false) {
  const context = {
    config: {},
    rawRows: {},
    mappingRows: {},
    datasetRefs: {},
    rowCounts: {},
    previewRows: {},
    sourceMetadata: {},
    appliedMappingRevision: {},
  };
  if (activeWeight) {
    context.config.weight = { masterRevision: 11, masterFingerprint: 'active-fp' };
    context.datasetRefs.weight = {
      datasetId: 'session:weight:r9',
      datasetRevision: 9,
      rowCount: 2,
      masterKey: 'weight',
      fileName: 'wtValveweights.json',
      masterFingerprint: 'active-fp',
      persistence: 'session',
    };
    context.weightMasterRows = [{ Marker: 'ACTIVE-1' }, { Marker: 'ACTIVE-2' }];
    context.rawRows.weight = [{ Raw: 'ACTIVE' }];
    context.mappingRows.weight = [{ Marker: 'ACTIVE-1' }];
    context.rowCounts.weight = 2;
    context.previewRows.weight = [{ Marker: 'ACTIVE-1' }, { Marker: 'ACTIVE-2' }];
    context.sourceMetadata.weight = {
      key: 'weight',
      source: 'active-session',
      sourceType: 'worker-import',
      status: 'loaded',
      rowCount: 2,
    };
    context.appliedMappingRevision.weight = 11;
  }
  return {
    current: {
      supportConfigJson: JSON.stringify(context.config),
      masterContext: context,
    },
  };
}

function custody(masterKey, overrides = {}) {
  const value = {
    source: masterKey === 'weight' ? 'wtValveweights.json' : 'PCF_MAT_MAP.TXT',
    datasetId: `issue883:${masterKey}:r3`,
    datasetRevision: 3,
    rowCount: 2,
    fieldMap: {},
    appliedRevision: 3,
    persistenceMode: 'indexeddb',
    ...(masterKey === 'weight' ? { masterFingerprint: 'fp-883' } : {}),
    ...overrides,
  };
  return JSON.stringify(value);
}

function assertIdentity(stateRef, masterKey, expected) {
  const identity = stateRef.current.masterRestoreFailureIdentity?.[masterKey];
  assert.deepEqual(identity, {
    masterKey,
    datasetId: expected.datasetId,
    domain: 'restore-storage',
    code: expected.code,
    stage: expected.stage,
  });
  assert.doesNotThrow(() => JSON.stringify(identity));
  const receipt = stateRef.current.masterRestoreFailures?.[masterKey];
  assert.equal(receipt.masterKey, masterKey);
  assert.equal(receipt.datasetId, expected.datasetId);
  assert.equal(receipt.stage, 'startup-hydration');
  assert.equal(receipt.name, 'Error');
  assert.match(receipt.message, expected.messagePattern);
}

const MATRIX = [
  {
    name: 'missing dataset',
    code: 'MISSING_DATASET',
    stage: 'metadata-validate',
    store: {
      async getMetadata() { return null; },
      async getRowsRange() { throw new Error('must not read rows'); },
      async getRows() { throw new Error('must not read rows'); },
    },
    messagePattern: /dataset is unavailable/,
  },
  {
    name: 'row-count mismatch',
    code: 'ROW_COUNT_MISMATCH',
    stage: 'metadata-validate',
    store: {
      async getMetadata(id) {
        return { datasetId: id, datasetRevision: 3, rowCount: 3, fileName: 'PCF_MAT_MAP.TXT' };
      },
      async getRowsRange() { throw new Error('must not read rows'); },
      async getRows() { throw new Error('must not read rows'); },
    },
    messagePattern: /row count mismatch/,
  },
  {
    name: 'revision mismatch',
    code: 'REVISION_MISMATCH',
    stage: 'metadata-validate',
    store: {
      async getMetadata(id) {
        return { datasetId: id, datasetRevision: 4, rowCount: 2, fileName: 'PCF_MAT_MAP.TXT' };
      },
      async getRowsRange() { throw new Error('must not read rows'); },
      async getRows() { throw new Error('must not read rows'); },
    },
    messagePattern: /dataset revision mismatch/,
  },
  {
    name: 'preview unavailable',
    code: 'PREVIEW_ROWS_UNAVAILABLE',
    stage: 'preview-read',
    store: {
      async getMetadata(id) {
        return { datasetId: id, datasetRevision: 3, rowCount: 2, fileName: 'PCF_MAT_MAP.TXT' };
      },
      async getRowsRange() { return null; },
      async getRows() { return [{ Marker: 'A' }, { Marker: 'B' }]; },
    },
    messagePattern: /preview is unavailable/,
  },
  {
    name: 'metadata storage read failure',
    code: 'STORAGE_READ_FAILED',
    stage: 'metadata-read',
    store: {
      async getMetadata() { throw Object.assign(new Error('IndexedDB transaction aborted'), { name: 'AbortError' }); },
      async getRowsRange() { throw new Error('must not read rows'); },
      async getRows() { throw new Error('must not read rows'); },
    },
    messagePattern: /storage read failed during metadata-read/,
  },
  {
    name: 'preview storage read failure',
    code: 'STORAGE_READ_FAILED',
    stage: 'preview-read',
    store: {
      async getMetadata(id) {
        return { datasetId: id, datasetRevision: 3, rowCount: 2, fileName: 'PCF_MAT_MAP.TXT' };
      },
      async getRowsRange() { throw new Error('IndexedDB preview cursor failed'); },
      async getRows() { return [{ Marker: 'A' }, { Marker: 'B' }]; },
    },
    messagePattern: /storage read failed during preview-read/,
  },
  {
    name: 'full-row storage read failure',
    code: 'STORAGE_READ_FAILED',
    stage: 'rows-read',
    store: {
      async getMetadata(id) {
        return { datasetId: id, datasetRevision: 3, rowCount: 2, fileName: 'PCF_MAT_MAP.TXT' };
      },
      async getRows() { throw new Error('IndexedDB row read failed'); },
    },
    messagePattern: /storage read failed during rows-read/,
  },
];

for (const spec of MATRIX) {
  test(`C05.5.4.4 classifies ${spec.name}`, async () => {
    const datasetId = 'issue883:materialMap:r3';
    const storage = installStorage({
      'xml-cii-master-source-materialMap': custody('materialMap', { datasetId }),
    });
    const stateRef = baseState();
    try {
      assert.equal(await hydratePersistedMasterDatasets(stateRef, { store: spec.store }), true);
      assertIdentity(stateRef, 'materialMap', {
        datasetId,
        code: spec.code,
        stage: spec.stage,
        messagePattern: spec.messagePattern,
      });
      assert.equal(stateRef.current.masterContext.datasetRefs.materialMap, undefined);
    } finally {
      storage.restore();
    }
  });
}

test('C05.5.4.4 classifies Weight fingerprint migration failure without replacing active session authority', async () => {
  const datasetId = 'issue883:weight:r5';
  const storage = installStorage({
    'xml-cii-master-source-weight': custody('weight', {
      datasetId,
      datasetRevision: 5,
      appliedRevision: 11,
      masterFingerprint: '',
    }),
  });
  const stateRef = baseState(true);
  const before = structuredClone(stateRef.current.masterContext);
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return {
            datasetId: id,
            datasetRevision: 5,
            rowCount: 2,
            fileName: 'wtValveweights.json',
            masterFingerprint: '',
          };
        },
        async getRowsRange() { return [{ Marker: 'WT-1' }]; },
        async getRows() { return [{ Marker: 'WT-1' }]; },
      },
    }), true);

    assertIdentity(stateRef, 'weight', {
      datasetId,
      code: 'FINGERPRINT_MIGRATION_FAILED',
      stage: 'fingerprint-migration',
      messagePattern: /fingerprint migration requires 2 rows/,
    });
    assert.deepEqual(stateRef.current.masterContext, before);
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.persistence, 'session');
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.masterFingerprint, 'active-fp');
  } finally {
    storage.restore();
  }
});

test('C05.5.4.4 successful restore clears both human and machine failure state for that key only', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': custody('materialMap'),
  });
  const rows = [{ Marker: 'A' }, { Marker: 'B' }];
  const stateRef = baseState();
  stateRef.current.masterRestoreFailures = {
    materialMap: { masterKey: 'materialMap', datasetId: 'old', stage: 'startup-hydration', name: 'Error', message: 'old' },
    weight: { masterKey: 'weight', datasetId: 'other', stage: 'startup-hydration', name: 'Error', message: 'keep' },
  };
  stateRef.current.masterRestoreFailureIdentity = {
    materialMap: { masterKey: 'materialMap', datasetId: 'old', domain: 'restore-storage', code: 'MISSING_DATASET', stage: 'metadata-validate' },
    weight: { masterKey: 'weight', datasetId: 'other', domain: 'restore-storage', code: 'ROW_COUNT_MISMATCH', stage: 'metadata-validate' },
  };

  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return {
            datasetId: id,
            datasetRevision: 3,
            rowCount: 2,
            fileName: 'PCF_MAT_MAP.TXT',
            mappingRows: rows,
          };
        },
        async getRowsRange(_id, offset, limit) { return rows.slice(offset, offset + limit); },
        async getRows() { return rows; },
      },
    }), true);

    assert.equal(stateRef.current.masterRestoreFailures.materialMap, undefined);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.materialMap, undefined);
    assert.equal(stateRef.current.masterRestoreFailures.weight.message, 'keep');
    assert.equal(stateRef.current.masterRestoreFailureIdentity.weight.code, 'ROW_COUNT_MISMATCH');
  } finally {
    storage.restore();
  }
});

test('C05.5.4.4 startup hydration source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
