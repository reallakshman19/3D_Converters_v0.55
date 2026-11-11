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
    config: {},
    rawRows: {},
    mappingRows: {},
    datasetRefs: {},
    rowCounts: {},
    previewRows: {},
    sourceMetadata: {},
    appliedMappingRevision: {},
  };
}

function startupState() {
  return {
    current: {
      supportConfigJson: '{}',
      masterContext: blankContext(),
    },
  };
}

test('C05.2 piping class keeps dataset revision through compact restart custody and cold hydration', async (t) => {
  const storage = installStorage();
  const rows = [{ Marker: 'PC-1' }, { Marker: 'PC-2' }];
  const expectedRevision = 4;
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'pipingClass',
      ready: {
        metadata: {
          datasetId: 'issue836:pc:r4',
          datasetRevision: expectedRevision,
          rowCount: rows.length,
          masterKey: 'pipingClass',
          fileName: 'Piping class master.xlsx',
          fieldMap: { marker: 'Marker' },
        },
        previewRows: rows,
        mappingRows: rows,
      },
      sourceMetadata: {
        key: 'pipingClass',
        source: 'Piping class master.xlsx',
        sourceType: 'worker-import',
        status: 'loaded',
        rowCount: rows.length,
      },
    });

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-pipingClass') || '{}');
    const stateRef = startupState();
    const store = {
      async getMetadata(id) {
        return id === 'issue836:pc:r4'
          ? {
            datasetId: id,
            datasetRevision: expectedRevision,
            rowCount: rows.length,
            fileName: 'Piping class master.xlsx',
            mappingRows: rows,
          }
          : null;
      },
      async getRowsRange(id, offset, limit) {
        return id === 'issue836:pc:r4' ? rows.slice(offset, offset + limit) : null;
      },
      async getRows(id) {
        return id === 'issue836:pc:r4' ? rows : null;
      },
    };
    const changed = await hydratePersistedMasterDatasets(stateRef, { store });
    const coldRef = stateRef.current.masterContext.datasetRefs.pipingClass;

    const observation = {
      commitDatasetRevision: committed.datasetRef?.datasetRevision ?? null,
      custodyDatasetRevision: custody.datasetRevision ?? null,
      coldDatasetRevision: coldRef?.datasetRevision ?? null,
      datasetIdStable: coldRef?.datasetId === committed.datasetRef?.datasetId,
      appliedRevisionStable:
        stateRef.current.masterContext.appliedMappingRevision.pipingClass === committed.revision,
      rowCountStable: coldRef?.rowCount === rows.length,
      previewRestored: stateRef.current.masterContext.previewRows.pipingClass?.length === rows.length,
      compactNoNormalizedDuplicate: !storage.values.has('xml-cii-master-pipingClass'),
      compactNoRawDuplicate: !storage.values.has('xml-cii-master-raw-pipingClass'),
    };
    t.diagnostic(JSON.stringify(observation));

    assert.equal(changed, true);
    assert.equal(observation.commitDatasetRevision, expectedRevision, 'datasetRef must retain worker datasetRevision');
    assert.equal(observation.custodyDatasetRevision, expectedRevision, 'restart custody must persist datasetRevision');
    assert.equal(observation.coldDatasetRevision, expectedRevision, 'cold datasetRef must restore datasetRevision');
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

test('C05.2 successors retain independent Mat Map and Weight dataset revisions without staging full rows', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': JSON.stringify({
      source: 'PCF_MAT_MAP.TXT',
      datasetId: 'issue836:mat:r2',
      datasetRevision: 2,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 3,
      persistenceMode: 'indexeddb',
    }),
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.xlsx',
      datasetId: 'issue836:wt:r5',
      datasetRevision: 5,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 6,
      persistenceMode: 'indexeddb',
      masterFingerprint: 'fp',
    }),
  });
  const rows = {
    'issue836:mat:r2': [{ Marker: 'MAT' }],
    'issue836:wt:r5': [{ Marker: 'WT' }],
  };
  const store = {
    async getMetadata(id) {
      return rows[id]
        ? {
          datasetId: id,
          datasetRevision: id.includes(':mat:') ? 2 : 5,
          rowCount: 1,
          fileName: id.includes(':mat:') ? 'PCF_MAT_MAP.TXT' : 'wtValveweights.xlsx',
          mappingRows: rows[id],
          ...(id.includes(':wt:') ? { masterFingerprint: 'fp' } : {}),
        }
        : null;
    },
    async getRowsRange(id) { return rows[id] || null; },
    async getRows(id) { return rows[id] || null; },
  };
  const stateRef = startupState();
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, { store }), true);
    // C05.3/C05.4 extended the original C05.2 milestone to all three master
    // revisions. Preserve this stronger custody contract; never drop the
    // revisions to satisfy the former one-master temporal assertion.
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.datasetRevision, 2);
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetRevision, 5);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.datasetId, 'issue836:mat:r2');
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.datasetId, 'issue836:wt:r5');
    assert.deepEqual(stateRef.current.masterContext.materialMapRows || [], []);
    assert.deepEqual(stateRef.current.masterContext.weightMasterRows || [], []);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.materialMap, undefined);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.weight, undefined);
  } finally {
    storage.restore();
  }
});


test('C05.2 stale Piping Class revision is quarantined with typed failure and cannot restore rows', async () => {
  const storage = installStorage({
    'xml-cii-master-source-pipingClass': JSON.stringify({
      source: 'Piping class master.xlsx',
      datasetId: 'issue836:pc:r4',
      datasetRevision: 4,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 1,
      persistenceMode: 'indexeddb',
    }),
  });
  const stateRef = startupState();
  let readAfterStale = 0;
  try {
    // C05.5.4.4 supersedes the old top-level assert.rejects: failures are
    // classified per master so unaffected masters may restore independently.
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return {
            datasetId: 'issue836:pc:r4',
            datasetRevision: 5,
            rowCount: 1,
            fileName: 'Piping class master.xlsx',
          };
        },
        async getRowsRange() { readAfterStale++; throw new Error('MUST_NOT_READ_STALE_ROWS'); },
        async getRows() { readAfterStale++; throw new Error('MUST_NOT_READ_STALE_ROWS'); },
      },
    }), true);
    assert.equal(readAfterStale, 0, 'stale identity must be vetoed before row materialization');
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity.pipingClass, {
      masterKey: 'pipingClass',
      datasetId: 'issue836:pc:r4',
      domain: 'restore-storage',
      code: 'REVISION_MISMATCH',
      stage: 'metadata-validate',
    });
    assert.match(stateRef.current.masterRestoreFailures.pipingClass.message,
      /Persisted pipingClass dataset revision mismatch: expected 4, received 5/);
    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass, undefined,
      'stale datasetRef must never become current source authority');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.pipingClass, undefined,
      'no stale mapping revision may be applied');
  } finally {
    storage.restore();
  }
});

test('C05.2 changed runtime modules match docs deployment mirrors', async () => {
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
