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
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

function activeWeightContext() {
  return {
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
}

function stateWithActiveWeight(extra = {}) {
  const context = activeWeightContext();
  return {
    current: {
      supportConfigJson: JSON.stringify(context.config),
      masterContext: context,
      ...extra,
    },
  };
}

function custody(masterKey, overrides = {}) {
  const defaults = {
    source: masterKey === 'pipingClass'
      ? 'Piping_class_master.json'
      : masterKey === 'materialMap'
        ? 'PCF_MAT_MAP.TXT'
        : 'wtValveweights.json',
    datasetId: `issue881:${masterKey}:r1`,
    datasetRevision: 1,
    rowCount: 2,
    fieldMap: {},
    appliedRevision: 1,
    persistenceMode: 'indexeddb',
  };
  return JSON.stringify({ ...defaults, ...overrides });
}

test('C05.5.4.2 valid persisted sibling restores while corrupt peer is isolated', async (t) => {
  const storage = installStorage({
    'xml-cii-master-source-pipingClass': custody('pipingClass', {
      datasetId: 'issue881:pipingClass:r4',
      datasetRevision: 4,
      appliedRevision: 2,
    }),
    'xml-cii-master-source-materialMap': custody('materialMap', {
      datasetId: 'issue881:materialMap:r3',
      datasetRevision: 3,
      appliedRevision: 3,
    }),
  });
  const stateRef = stateWithActiveWeight({
    masterRestoreFailures: {
      pipingClass: {
        masterKey: 'pipingClass',
        datasetId: 'stale',
        stage: 'startup-hydration',
        name: 'Error',
        message: 'stale receipt',
      },
    },
  });
  const activeWeightBefore = JSON.parse(JSON.stringify(stateRef.current.masterContext.datasetRefs.weight));
  const pipingRows = [{ Marker: 'PC-1' }, { Marker: 'PC-2' }];

  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          if (id === 'issue881:pipingClass:r4') {
            return {
              datasetId: id,
              datasetRevision: 4,
              rowCount: 2,
              fileName: 'Piping_class_master.json',
              mappingRows: pipingRows,
            };
          }
          if (id === 'issue881:materialMap:r3') return null;
          return null;
        },
        async getRowsRange(id, offset, limit) {
          if (id === 'issue881:pipingClass:r4') return pipingRows.slice(offset, offset + limit);
          throw new Error('corrupt materialMap rows must not be read');
        },
        async getRows(id) {
          return id === 'issue881:pipingClass:r4' ? pipingRows : null;
        },
      },
    });

    assert.equal(changed, true);
    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.datasetId, 'issue881:pipingClass:r4');
    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.datasetRevision, 4);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap, undefined);
    assert.deepEqual(stateRef.current.masterContext.datasetRefs.weight, activeWeightBefore);

    assert.equal(stateRef.current.masterRestoreFailures.pipingClass, undefined);
    assert.deepEqual(stateRef.current.masterRestoreFailures.materialMap, {
      masterKey: 'materialMap',
      datasetId: 'issue881:materialMap:r3',
      stage: 'startup-hydration',
      name: 'Error',
      message: 'Persisted materialMap dataset is unavailable.',
    });

    assert.equal(storage.values.has('xml-cii-master-materialMap'), false);
    assert.equal(storage.values.has('xml-cii-master-raw-materialMap'), false);

    t.diagnostic(JSON.stringify({
      validSiblingRestored: true,
      corruptSiblingAttached: false,
      activeSessionWeightPreserved: true,
      structuredFailureRetained: true,
    }));
  } finally {
    storage.restore();
  }
});

test('C05.5.4.2 multiple failed persisted masters preserve active runtime and retain independent receipts', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': custody('materialMap', {
      datasetId: 'issue881:materialMap:r3',
      datasetRevision: 3,
      rowCount: 2,
    }),
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json',
      datasetId: 'issue881:weight:r5',
      datasetRevision: 5,
      rowCount: 2,
      fieldMap: {},
      appliedRevision: 11,
      persistenceMode: 'indexeddb',
      masterFingerprint: '',
    }),
  });
  const stateRef = stateWithActiveWeight();
  const beforeContext = JSON.parse(JSON.stringify(stateRef.current.masterContext));

  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          if (id === 'issue881:materialMap:r3') {
            return {
              datasetId: id,
              datasetRevision: 3,
              rowCount: 3,
              fileName: 'PCF_MAT_MAP.TXT',
            };
          }
          if (id === 'issue881:weight:r5') {
            return {
              datasetId: id,
              datasetRevision: 5,
              rowCount: 2,
              fileName: 'wtValveweights.json',
              masterFingerprint: '',
            };
          }
          return null;
        },
        async getRowsRange(id) {
          if (id === 'issue881:weight:r5') return [{ Marker: 'WT-1' }];
          throw new Error('materialMap rows must not be read after row-count mismatch');
        },
        async getRows(id) {
          return id === 'issue881:weight:r5' ? [{ Marker: 'WT-1' }] : null;
        },
      },
    });

    assert.equal(changed, true);
    assert.deepEqual(stateRef.current.masterContext, beforeContext);
    assert.match(stateRef.current.masterRestoreFailures.materialMap.message, /row count mismatch/);
    assert.match(stateRef.current.masterRestoreFailures.weight.message, /fingerprint migration requires 2 rows/);
    assert.equal(stateRef.current.masterRestoreFailures.materialMap.stage, 'startup-hydration');
    assert.equal(stateRef.current.masterRestoreFailures.weight.stage, 'startup-hydration');
  } finally {
    storage.restore();
  }
});

test('C05.5.4.2 a later successful restore clears only that key previous failure receipt', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': custody('materialMap', {
      datasetId: 'issue881:materialMap:r3',
      datasetRevision: 3,
      appliedRevision: 3,
    }),
  });
  const rows = [{ Marker: 'MAT-1' }, { Marker: 'MAT-2' }];
  const stateRef = stateWithActiveWeight({
    masterRestoreFailures: {
      materialMap: {
        masterKey: 'materialMap',
        datasetId: 'old',
        stage: 'startup-hydration',
        name: 'Error',
        message: 'old materialMap failure',
      },
      weight: {
        masterKey: 'weight',
        datasetId: 'unrelated',
        stage: 'startup-hydration',
        name: 'Error',
        message: 'unrelated retained receipt',
      },
    },
  });

  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return id === 'issue881:materialMap:r3'
            ? {
              datasetId: id,
              datasetRevision: 3,
              rowCount: 2,
              fileName: 'PCF_MAT_MAP.TXT',
              mappingRows: rows,
            }
            : null;
        },
        async getRowsRange(id, offset, limit) {
          return id === 'issue881:materialMap:r3' ? rows.slice(offset, offset + limit) : null;
        },
        async getRows(id) {
          return id === 'issue881:materialMap:r3' ? rows : null;
        },
      },
    }), true);

    assert.equal(stateRef.current.masterRestoreFailures.materialMap, undefined);
    assert.equal(stateRef.current.masterRestoreFailures.weight.message, 'unrelated retained receipt');
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.datasetRevision, 3);
  } finally {
    storage.restore();
  }
});

test('C05.5.4.2 startup hydration source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
