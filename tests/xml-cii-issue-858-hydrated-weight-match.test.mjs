import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
import { weightMatchConfigFromState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js';

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

test('C05.4.4 cold-hydrated Valve Weight stays dataset-backed and needs no second materialization/import for Weight Match authority', async () => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json',
      datasetId: 'issue858:wt:r5',
      datasetRevision: 5,
      rowCount: 2,
      fieldMap: { bore: 'Bore' },
      appliedRevision: 11,
      persistenceMode: 'indexeddb',
      masterFingerprint: 'fp-858',
    }),
  });
  const rows = [{ Bore: 100 }, { Bore: 150 }];
  const stateRef = { current: { supportConfigJson: '{}', masterContext: blankContext() } };
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          return id === 'issue858:wt:r5' ? {
            datasetId: id,
            datasetRevision: 5,
            rowCount: rows.length,
            fileName: 'wtValveweights.json',
            mappingRows: rows,
            masterFingerprint: 'fp-858',
          } : null;
        },
        async getRowsRange(id, offset, limit) {
          return id === 'issue858:wt:r5' ? rows.slice(offset, offset + limit) : null;
        },
        async getRows(id) { return id === 'issue858:wt:r5' ? rows : null; },
      },
    }), true);

    const hydrated = stateRef.current.masterContext.datasetRefs.weight;
    assert.equal(hydrated.datasetId, 'issue858:wt:r5');
    assert.equal(hydrated.datasetRevision, 5);
    assert.equal(hydrated.masterFingerprint, 'fp-858');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.weight, 11);
    assert.equal(stateRef.current.masterContext.config.weight.masterRevision, 11);

    let materializeCalls = 0;
    const config = await weightMatchConfigFromState(stateRef.current, {
      materializeRows: async () => {
        materializeCalls += 1;
        throw new Error('dataset-backed Weight Match authority must not require compatibility row materialization');
      },
    });

    assert.equal(materializeCalls, 0);
    assert.equal('masterRows' in (config.weight || {}), false);
    assert.equal(config.weight.masterRevision, 11);
    assert.equal(config.weight.masterFingerprint, 'fp-858');
    assert.notEqual(config.weight.masterRevision, hydrated.datasetRevision);
  } finally {
    storage.restore();
  }
});

test('C05.4.4 Weight Match ranking callback uses hydrated weight datasetId directly', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js';
  const source = await fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8');

  assert.match(source, /const weightDatasetRef = state\?\.masterContext\?\.datasetRefs\?\.weight \|\| null;/);
  assert.match(source, /rankWeightIssues:\s*weightDatasetRef\?\.datasetId\s*\?\s*async/);
  assert.match(
    source,
    /rankMasterDatasetWeightIssues\('weight',\s*weightDatasetRef\.datasetId,\s*issues,\s*compactConfig,/,
  );

  const callbackStart = source.indexOf('rankWeightIssues: weightDatasetRef?.datasetId ? async');
  const callbackEnd = source.indexOf('prepareWeightBasis:', callbackStart);
  assert.ok(callbackStart >= 0 && callbackEnd > callbackStart);
  const callback = source.slice(callbackStart, callbackEnd);
  assert.doesNotMatch(callback, /openFile|openBuffer|openSource|upload/i);
});

test('C05.4.4 Weight Match source/docs mirror remains byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
