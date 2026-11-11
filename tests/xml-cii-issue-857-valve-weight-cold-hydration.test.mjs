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

function blankContext() {
  return {
    config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {},
    previewRows: {}, sourceMetadata: {}, appliedMappingRevision: {},
  };
}

function startupState() {
  return { current: { supportConfigJson: '{}', masterContext: blankContext() } };
}

test('C05.4.3 cold hydration restores Valve Weight datasetRevision without conflating weight identity semantics', async () => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json',
      datasetId: 'issue857:wt:r5',
      datasetRevision: 5,
      rowCount: 2,
      fieldMap: { bore: 'Bore' },
      appliedRevision: 11,
      persistenceMode: 'indexeddb',
      masterFingerprint: 'fp-857',
    }),
  });
  const rows = [{ Bore: 100 }, { Bore: 150 }];
  const stateRef = startupState();
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return id === 'issue857:wt:r5' ? {
            datasetId: id,
            datasetRevision: 5,
            rowCount: rows.length,
            fileName: 'wtValveweights.json',
            mappingRows: rows,
            masterFingerprint: 'fp-857',
          } : null;
        },
        async getRowsRange(id, offset, limit) {
          return id === 'issue857:wt:r5' ? rows.slice(offset, offset + limit) : null;
        },
        async getRows(id) { return id === 'issue857:wt:r5' ? rows : null; },
      },
    }), true);

    const context = stateRef.current.masterContext;
    const ref = context.datasetRefs.weight;
    assert.equal(ref.datasetId, 'issue857:wt:r5');
    assert.equal(ref.datasetRevision, 5);
    assert.equal(ref.masterFingerprint, 'fp-857');
    assert.equal(context.appliedMappingRevision.weight, 11);
    assert.equal(context.config.weight.masterRevision, 11);
    assert.equal(context.config.weight.masterFingerprint, 'fp-857');
    assert.notEqual(context.config.weight.masterRevision, ref.datasetRevision);
    assert.equal(context.rowCounts.weight, 2);
  } finally {
    storage.restore();
  }
});

test('C05.4.3 stale positive Weight revision records typed refusal and never materializes stale rows', async () => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json',
      datasetId: 'issue857:wt:r5',
      datasetRevision: 5,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 11,
      persistenceMode: 'indexeddb',
      masterFingerprint: 'fp-857',
    }),
  });
  const stateRef = startupState();
  let invalidRowReads = 0;
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return {
            datasetId: 'issue857:wt:r5',
            datasetRevision: 6,
            rowCount: 1,
            fileName: 'wtValveweights.json',
            masterFingerprint: 'fp-857',
          };
        },
        async getRowsRange() { invalidRowReads++; throw Error('MUST_NOT_READ_STALE_WEIGHT'); },
        async getRows() { invalidRowReads++; throw Error('MUST_NOT_READ_STALE_WEIGHT'); },
      },
    }), true);
    assert.equal(invalidRowReads, 0,
      'Weight revision mismatch must veto IndexedDB row reads before fingerprint binding');
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity.weight, {
      masterKey: 'weight',
      datasetId: 'issue857:wt:r5',
      domain: 'restore-storage',
      code: 'REVISION_MISMATCH',
      stage: 'metadata-validate',
    });
    assert.match(stateRef.current.masterRestoreFailures.weight.message,
      /Persisted weight dataset revision mismatch: expected 5, received 6/);
    assert.equal(stateRef.current.masterContext.datasetRefs.weight, undefined,
      'mismatched Weight dataset must not become active authority');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, undefined);
    assert.equal(stateRef.current.masterContext.config.weight, undefined,
      'Weight fingerprint/masterRevision cannot be published from invalid metadata');
  } finally {
    storage.restore();
  }
});

test('C05.4.3 predecessor Piping Class and Mat_Map dataset revisions remain green', async () => {
  const storage = installStorage({
    'xml-cii-master-source-pipingClass': JSON.stringify({
      source: 'Piping class master.xlsx', datasetId: 'issue857:pc:r4', datasetRevision: 4,
      rowCount: 1, fieldMap: {}, appliedRevision: 2, persistenceMode: 'indexeddb',
    }),
    'xml-cii-master-source-materialMap': JSON.stringify({
      source: 'PCF_MAT_MAP.TXT', datasetId: 'issue857:mat:r3', datasetRevision: 3,
      rowCount: 1, fieldMap: {}, appliedRevision: 3, persistenceMode: 'indexeddb',
    }),
  });
  const rows = {
    'issue857:pc:r4': [{ Marker: 'PC' }],
    'issue857:mat:r3': [{ Marker: 'MAT' }],
  };
  const stateRef = startupState();
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          if (!rows[id]) return null;
          return {
            datasetId: id,
            datasetRevision: id.includes(':pc:') ? 4 : 3,
            rowCount: 1,
            fileName: id.includes(':pc:') ? 'Piping class master.xlsx' : 'PCF_MAT_MAP.TXT',
            mappingRows: rows[id],
          };
        },
        async getRowsRange(id) { return rows[id] || null; },
        async getRows(id) { return rows[id] || null; },
      },
    }), true);

    assert.equal(stateRef.current.masterContext.datasetRefs.pipingClass.datasetRevision, 4);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.datasetRevision, 3);
  } finally {
    storage.restore();
  }
});

test('C05.4.3 startup hydration source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
