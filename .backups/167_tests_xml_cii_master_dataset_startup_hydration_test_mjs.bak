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
  return () => { globalThis.localStorage = previous; };
}

test('startup hydration restores IndexedDB-backed master rows without rebuilding supportConfig arrays', async () => {
  const restore = installStorage({
    'xml-cii-master-source-lineList': JSON.stringify({
      source: 'large-lines.xlsx', datasetId: 'line-ds', rowCount: 50000,
      persistenceMode: 'indexeddb', fieldMap: { lineNo: 'Line' }, appliedRevision: 7,
    }),
  });
  const rows = Array.from({ length: 50000 }, (_, index) => ({ lineNo: `L-${index + 1}`, _rowIndex: index + 1 }));
  const store = {
    async getMetadata(id) { return id === 'line-ds' ? { datasetId: id, rowCount: rows.length, fileName: 'large-lines.xlsx' } : null; },
    async getRows(id) { return id === 'line-ds' ? rows : null; },
  };
  const stateRef = {
    current: {
      supportConfigJson: '{}',
      masterContext: {
        config: { linelist: {}, supportPositionMatch: { toleranceMm: 20 } },
        lineRows: [], rowCounts: { lineList: 0 }, previewRows: {}, sourceMetadata: {},
        appliedMappingRevision: { lineList: 0 }, rawRows: { lineList: [] },
      },
    },
  };
  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, { store });
    assert.equal(changed, true);
    assert.equal(stateRef.current.masterContext.lineRows.length, 50000);
    assert.equal(stateRef.current.masterContext.rowCounts.lineList, 50000);
    assert.equal(stateRef.current.masterContext.previewRows.lineList.length, 150);
    assert.equal(stateRef.current.masterContext.datasetRefs.lineList.datasetId, 'line-ds');
    assert.equal(stateRef.current.masterContext.appliedMappingRevision.lineList, 7);
    assert.equal(stateRef.current.masterContext.sourceMetadata.lineList.sourceType, 'indexeddb');
    const config = JSON.parse(stateRef.current.supportConfigJson);
    assert.equal('masterRows' in config.linelist, false);
    assert.equal(config.supportPositionMatch.toleranceMm, 20);
  } finally {
    restore();
  }
});

test('startup hydration is a no-op when no IndexedDB custody exists', async () => {
  const restore = installStorage();
  const stateRef = { current: { masterContext: { config: {} } } };
  try {
    const changed = await hydratePersistedMasterDatasets(stateRef, {
      store: { async getMetadata() { throw new Error('must not be called'); }, async getRows() { throw new Error('must not be called'); } },
    });
    assert.equal(changed, false);
  } finally {
    restore();
  }
});

test('canonical workflow shell hydrates persisted datasets once after initial render', async () => {
  const source = await fs.readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js', import.meta.url), 'utf8');
  assert.match(source, /hydratePersistedMasterDatasets/);
  assert.match(source, /render\(\);\s*hydratePersistedMasters\(stateRef, render\);/);
  assert.equal((source.match(/hydratePersistedMasters\(stateRef, render\)/g) || []).length, 2);
});
