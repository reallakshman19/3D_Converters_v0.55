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

function blankContext(weightRevision = 0) {
  return {
    config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {},
    previewRows: {}, sourceMetadata: {}, appliedMappingRevision: { weight: weightRevision },
  };
}

const ROWS = [
  { Bore: 100, Rating: '150', Length: 240, Weight: 42.5, Type: 'VALV' },
  { Bore: 150, Rating: '300', Length: 320, Weight: 78.2, Type: 'VALV' },
];

test('C05.4.2 Valve Weight commit retains datasetRevision without changing fingerprint/masterRevision semantics', () => {
  const storage = installStorage();
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(10),
      config: {},
      key: 'weight',
      ready: {
        metadata: {
          datasetId: 'issue856:wt:r5',
          datasetRevision: 5,
          rowCount: ROWS.length,
          masterKey: 'weight',
          fileName: 'wtValveweights.json',
          fieldMap: { bore: 'Bore', rating: 'Rating', length: 'Length', weight: 'Weight', type: 'Type' },
          masterFingerprint: 'fp-856',
        },
        previewRows: ROWS,
        mappingRows: ROWS,
      },
      sourceMetadata: {
        key: 'weight', source: 'wtValveweights.json', sourceType: 'worker-import',
        status: 'loaded', rowCount: ROWS.length,
      },
    });

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-weight') || '{}');
    assert.equal(committed.datasetRef.datasetRevision, 5);
    assert.equal(custody.datasetRevision, 5);
    assert.equal(committed.datasetRef.masterFingerprint, 'fp-856');
    assert.equal(custody.masterFingerprint, 'fp-856');
    assert.equal(committed.revision, 11);
    assert.equal(committed.config.weight.masterRevision, 11);
    assert.notEqual(committed.config.weight.masterRevision, committed.datasetRef.datasetRevision);
    assert.equal(storage.values.has('xml-cii-master-weight'), false);
    assert.equal(storage.values.has('xml-cii-master-raw-weight'), false);
  } finally {
    storage.restore();
  }
});

test('C05.4.2 successor cold hydration preserves Weight revision and independent fingerprint/masterRevision authority', async () => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json',
      datasetId: 'issue856:wt:r5',
      datasetRevision: 5,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 11,
      persistenceMode: 'indexeddb',
      masterFingerprint: 'fp-856',
    }),
  });
  const stateRef = { current: { supportConfigJson: '{}', masterContext: blankContext() } };
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return {
            datasetId: 'issue856:wt:r5',
            datasetRevision: 5,
            rowCount: 1,
            fileName: 'wtValveweights.json',
            mappingRows: [{ Marker: 'WT' }],
            masterFingerprint: 'fp-856',
          };
        },
        async getRowsRange() { return [{ Marker: 'WT' }]; },
        async getRows() { return [{ Marker: 'WT' }]; },
      },
    }), true);

    const ref = stateRef.current.masterContext.datasetRefs.weight;
    // C05.4.3 was implemented after this historical RED milestone. The
    // complete pipeline must retain its row-version authority at cold start.
    assert.equal(ref.datasetRevision, 5);
    assert.equal(ref.datasetId, 'issue856:wt:r5');
    assert.equal(ref.rowCount, 1);
    assert.equal(ref.persistence, 'indexeddb');
    assert.equal(stateRef.current.masterRestoreFailureIdentity.weight, undefined);
    assert.deepEqual(stateRef.current.masterContext.weightMasterRows || [], []);
    assert.equal(ref.masterFingerprint, 'fp-856');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, 11);
    assert.equal(stateRef.current.masterContext.config.weight.masterRevision, 11);
    assert.notEqual(stateRef.current.masterContext.config.weight.masterRevision, 5);
  } finally {
    storage.restore();
  }
});

test('C05.4.2 runtime source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
