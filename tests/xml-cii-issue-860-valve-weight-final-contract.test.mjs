import test from 'node:test';
import assert from 'node:assert/strict';

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

test('C05.4 final state preserves Valve Weight revision from commit through cold hydration', async () => {
  const storage = installStorage();
  const rows = [
    { Bore: 100, Rating: '150', Length: 240, Weight: 42.5, Type: 'VALV' },
    { Bore: 150, Rating: '300', Length: 320, Weight: 78.2, Type: 'VALV' },
  ];
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(10),
      config: {},
      key: 'weight',
      ready: {
        metadata: {
          datasetId: 'issue860:wt:r5',
          datasetRevision: 5,
          rowCount: rows.length,
          masterKey: 'weight',
          fileName: 'wtValveweights.json',
          fieldMap: { bore: 'Bore', rating: 'Rating', length: 'Length', weight: 'Weight', type: 'Type' },
          masterFingerprint: 'fp-860',
        },
        previewRows: rows,
        mappingRows: rows,
      },
      sourceMetadata: {
        key: 'weight',
        source: 'wtValveweights.json',
        sourceType: 'worker-import',
        status: 'loaded',
        rowCount: rows.length,
      },
    });

    const custody = JSON.parse(storage.values.get('xml-cii-master-source-weight') || '{}');
    assert.equal(committed.datasetRef.datasetRevision, 5);
    assert.equal(custody.datasetRevision, 5);
    assert.equal(committed.datasetRef.masterFingerprint, 'fp-860');
    assert.equal(custody.masterFingerprint, 'fp-860');
    assert.equal(committed.revision, 11);
    assert.equal(committed.config.weight.masterRevision, 11);
    assert.notEqual(committed.config.weight.masterRevision, committed.datasetRef.datasetRevision);
    assert.equal(storage.values.has('xml-cii-master-weight'), false);
    assert.equal(storage.values.has('xml-cii-master-raw-weight'), false);

    const stateRef = { current: { supportConfigJson: '{}', masterContext: blankContext() } };
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return id === 'issue860:wt:r5' ? {
            datasetId: id,
            datasetRevision: 5,
            rowCount: rows.length,
            fileName: 'wtValveweights.json',
            mappingRows: rows,
            masterFingerprint: 'fp-860',
          } : null;
        },
        async getRowsRange(id, offset, limit) {
          return id === 'issue860:wt:r5' ? rows.slice(offset, offset + limit) : null;
        },
        async getRows(id) { return id === 'issue860:wt:r5' ? rows : null; },
      },
    }), true);

    const context = stateRef.current.masterContext;
    const ref = context.datasetRefs.weight;
    assert.equal(ref.datasetId, 'issue860:wt:r5');
    assert.equal(ref.datasetRevision, 5);
    assert.equal(ref.masterFingerprint, 'fp-860');
    assert.equal(context.appliedMappingRevision.weight, 11);
    assert.equal(context.config.weight.masterRevision, 11);
    assert.equal(context.config.weight.masterFingerprint, 'fp-860');
    assert.notEqual(context.config.weight.masterRevision, ref.datasetRevision);
    assert.equal(context.rowCounts.weight, rows.length);
  } finally {
    storage.restore();
  }
});
