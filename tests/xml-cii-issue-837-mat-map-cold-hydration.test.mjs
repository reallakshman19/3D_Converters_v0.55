import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { commitDatasetReadyMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-commit.js';
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

function blankContext() {
  return {
    config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {},
    previewRows: {}, sourceMetadata: {}, appliedMappingRevision: {},
  };
}

function startupState() {
  return { current: { supportConfigJson: '{}', masterContext: blankContext() } };
}

test('C05.3 Mat_Map keeps dataset revision through compact restart custody and cold hydration', async (t) => {
  const storage = installStorage();
  const rows = [
    { pcfMaterial: 'A106-B', caesarMaterial: '1' },
    { pcfMaterial: 'A312-TP316L', caesarMaterial: '8' },
  ];
  const expectedRevision = 3;
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'materialMap',
      ready: {
        metadata: {
          datasetId: 'issue837:mat:r3',
          datasetRevision: expectedRevision,
          rowCount: rows.length,
          masterKey: 'materialMap',
          fileName: 'PCF_MAT_MAP.TXT',
          fieldMap: {},
        },
        previewRows: rows,
        mappingRows: rows,
      },
      sourceMetadata: {
        key: 'materialMap', source: 'PCF_MAT_MAP.TXT', sourceType: 'worker-import',
        status: 'loaded', rowCount: rows.length,
      },
    });

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-materialMap') || '{}');
    const stateRef = startupState();
    const store = {
      async getMetadata(id) {
        return id === 'issue837:mat:r3'
          ? {
            datasetId: id, datasetRevision: expectedRevision, rowCount: rows.length,
            fileName: 'PCF_MAT_MAP.TXT', mappingRows: rows,
          }
          : null;
      },
      async getRowsRange(id, offset, limit) {
        return id === 'issue837:mat:r3' ? rows.slice(offset, offset + limit) : null;
      },
      async getRows(id) { return id === 'issue837:mat:r3' ? rows : null; },
    };
    const changed = await hydratePersistedMasterDatasets(stateRef, { store });
    const coldRef = stateRef.current.masterContext.datasetRefs.materialMap;
    const observation = {
      commitDatasetRevision: committed.datasetRef?.datasetRevision ?? null,
      custodyDatasetRevision: custody.datasetRevision ?? null,
      coldDatasetRevision: coldRef?.datasetRevision ?? null,
      datasetIdStable: coldRef?.datasetId === committed.datasetRef?.datasetId,
      appliedRevisionStable:
        stateRef.current.masterContext.appliedMappingRevision.materialMap === committed.revision,
      rowCountStable: coldRef?.rowCount === rows.length,
      previewRestored: stateRef.current.masterContext.previewRows.materialMap?.length === rows.length,
      compactNoNormalizedDuplicate: !storage.values.has('xml-cii-master-materialMap'),
      compactNoRawDuplicate: !storage.values.has('xml-cii-master-raw-materialMap'),
    };
    t.diagnostic(JSON.stringify(observation));

    assert.equal(changed, true);
    assert.equal(observation.commitDatasetRevision, expectedRevision, 'materialMap datasetRef must retain worker datasetRevision');
    assert.equal(observation.custodyDatasetRevision, expectedRevision, 'Mat_Map restart custody must persist datasetRevision');
    assert.equal(observation.coldDatasetRevision, expectedRevision, 'cold materialMap datasetRef must restore datasetRevision');
    assert.equal(observation.datasetIdStable, true);
    assert.equal(observation.appliedRevisionStable, true);
    assert.equal(observation.rowCountStable, true);
    assert.equal(observation.previewRestored, true);
    assert.equal(observation.compactNoNormalizedDuplicate, true);
    assert.equal(observation.compactNoRawDuplicate, true);
  } finally {
    storage.restore();
  }
});

test('C05.3 later three-master custody retains independent Piping Class and Weight revisions', async () => {
  const storage = installStorage({
    'xml-cii-master-source-pipingClass': JSON.stringify({
      source: 'Piping class master.xlsx', datasetId: 'issue837:pc:r4', datasetRevision: 4,
      rowCount: 1, fieldMap: {}, appliedRevision: 2, persistenceMode: 'indexeddb',
    }),
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.xlsx', datasetId: 'issue837:wt:r5', datasetRevision: 5,
      rowCount: 1, fieldMap: {}, appliedRevision: 6, persistenceMode: 'indexeddb',
      masterFingerprint: 'fp',
    }),
  });
  const rows = {
    'issue837:pc:r4': [{ Marker: 'PC' }],
    'issue837:wt:r5': [{ Marker: 'WT' }],
  };
  const store = {
    async getMetadata(id) {
      if (!rows[id]) return null;
      return {
        datasetId: id,
        datasetRevision: id.includes(':pc:') ? 4 : 5,
        rowCount: 1,
        fileName: id.includes(':pc:') ? 'Piping class master.xlsx' : 'wtValveweights.xlsx',
        mappingRows: rows[id],
        ...(id.includes(':wt:') ? { masterFingerprint: 'fp' } : {}),
      };
    },
    async getRowsRange(id) { return rows[id] || null; },
    async getRows(id) { return rows[id] || null; },
  };
  const stateRef = startupState();
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, { store }), true);
    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.datasetRevision, 4);
    // Successor C05.4 promoted Weight revision custody. Do not undo that
    // stronger protection merely to satisfy the old C05.3 milestone.
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetRevision, 5);
    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.datasetId, 'issue837:pc:r4');
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetId, 'issue837:wt:r5');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, 6);
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.masterFingerprint, 'fp');
    assert.deepEqual(stateRef.current.masterContext.pipingClassRows || [], []);
    assert.deepEqual(stateRef.current.masterContext.weightMasterRows || [], []);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.pipingClass, undefined);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.weight, undefined);
  } finally {
    storage.restore();
  }
});


test('C05.3 rejects a stale Mat_Map revision with typed failure and no row access', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': JSON.stringify({
      source: 'PCF_MAT_MAP.TXT',
      datasetId: 'issue837:mat:r3',
      datasetRevision: 3,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 1,
      persistenceMode: 'indexeddb',
    }),
  });
  const stateRef = startupState();
  let staleRowReads = 0;
  try {
    // After C05.5.4.4, a bad master is quarantined individually and reported
    // via a stable typed identity rather than rejecting the entire hydrate call.
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return {
            datasetId: 'issue837:mat:r3',
            datasetRevision: 4,
            rowCount: 1,
            fileName: 'PCF_MAT_MAP.TXT',
          };
        },
        async getRowsRange() { staleRowReads++; throw Error('MUST_NOT_READ_STALE_MAT_MAP'); },
        async getRows() { staleRowReads++; throw Error('MUST_NOT_READ_STALE_MAT_MAP'); },
      },
    }), true);
    assert.equal(staleRowReads, 0, 'Mat Map revision mismatch must veto row materialization');
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity.materialMap, {
      masterKey: 'materialMap',
      datasetId: 'issue837:mat:r3',
      domain: 'restore-storage',
      code: 'REVISION_MISMATCH',
      stage: 'metadata-validate',
    });
    assert.match(stateRef.current.masterRestoreFailures.materialMap.message,
      /Persisted materialMap dataset revision mismatch: expected 3, received 4/);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap, undefined,
      'a stale Mat Map revision cannot become active authority');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.materialMap, undefined,
      'stale Mat Map applied revision cannot reach live configuration');
  } finally {
    storage.restore();
  }
});

test('C05.3 changed runtime modules match docs deployment mirrors', async () => {
  for (const sourcePath of [
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js',
  ]) {
    const [source, docs] = await Promise.all([
      fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
      fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
    ]);
    assert.equal(source, docs, sourcePath + ' must match docs mirror');
  }
});
