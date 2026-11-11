import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commitAppliedMaster,
  persistChangedMasterDetailed,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
import {
  serializeStandaloneImportMastersConfig,
} from '../tabs/xml-cii-2019-standalone/xml-cii-master-context.js';

function installStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

function datasetMetadata(rowCount = 100000) {
  return {
    datasetId: 'dataset-lines-1',
    rowCount,
    masterKey: 'lineList',
    fileName: 'large-lines.xlsx',
    sheetName: 'Lines',
  };
}

test('dataset-backed commit keeps only that master metadata-only during phased migration', () => {
  const legacyClassRows = [{ Class: 'A1' }];
  const config = {
    linelist: { fieldMap: { lineNo: 'Line' }, masterRows: [{ Line: 'old' }] },
    pipingClass: { fieldMap: { pipingClass: 'Class' }, masterRows: legacyClassRows },
    supportPositionMatch: { enabled: true, toleranceMm: 20 },
  };
  const committed = commitAppliedMaster({
    context: { config, pipingClassRows: legacyClassRows, appliedMappingRevision: { lineList: 4 } },
    config,
    key: 'lineList',
    fieldMap: { lineNo: 'Line' },
    datasetMetadata: datasetMetadata(),
    previewRows: [{ lineNo: 'L-001' }],
    sourceMetadata: { source: 'large-lines.xlsx' },
  });

  assert.equal('masterRows' in committed.config.linelist, false);
  assert.deepEqual(committed.config.pipingClass.masterRows, legacyClassRows);
  assert.equal(committed.context.datasetRefs.lineList.datasetId, 'dataset-lines-1');
  assert.equal(committed.context.rowCounts.lineList, 100000);
  assert.equal(committed.context.previewRows.lineList.length, 1);
  assert.equal(committed.context.appliedMappingRevision.lineList, 5);
  assert.equal(committed.config.supportPositionMatch.toleranceMm, 20);
});

test('dataset-backed persistence clears large localStorage payloads and retains custody metadata', () => {
  const storage = installStorage({
    'xml-cii-master-lineList': '[{"old":true}]',
    'xml-cii-master-raw-lineList': '[{"old":true}]',
    'xml-cii-master-workbook-lineList': '{"Lines":[]}',
  });
  try {
    const committed = commitAppliedMaster({
      context: { config: {}, appliedMappingRevision: { lineList: 1 } },
      config: {},
      key: 'lineList',
      fieldMap: { lineNo: 'Line' },
      datasetMetadata: datasetMetadata(50000),
      previewRows: [{ lineNo: 'L-001' }],
      sourceMetadata: { source: 'large-lines.xlsx' },
    });
    const receipt = persistChangedMasterDetailed('lineList', committed.context);

    assert.equal(receipt.indexedDbBacked, true);
    assert.equal(receipt.normalizedPersisted, true);
    assert.equal(receipt.estimatedDuplicateBytes, 0);
    assert.equal(storage.values.has('xml-cii-master-lineList'), false);
    assert.equal(storage.values.has('xml-cii-master-raw-lineList'), false);
    assert.equal(storage.values.has('xml-cii-master-workbook-lineList'), false);
    const custody = JSON.parse(storage.values.get('xml-cii-master-source-lineList'));
    assert.equal(custody.datasetId, 'dataset-lines-1');
    assert.equal(custody.rowCount, 50000);
    assert.equal(custody.persistenceMode, 'indexeddb');
  } finally {
    storage.restore();
  }
});

test('legacy non-worker commit retains existing row-array behavior', () => {
  const rows = [{ Line: 'L-001' }, { Line: 'L-002' }];
  const committed = commitAppliedMaster({
    context: { config: {}, appliedMappingRevision: { lineList: 0 } },
    config: {},
    key: 'lineList',
    fieldMap: { lineNo: 'Line' },
    rawRows: rows,
    normalizedRows: rows,
  });

  assert.deepEqual(committed.config.linelist.masterRows, rows);
  assert.equal(committed.context.datasetRefs.lineList, undefined);
  assert.equal(committed.context.rowCounts.lineList, 2);
});

test('supportConfigJson omits worker-backed 100k datasets without dropping legacy sections', () => {
  const huge = Array.from({ length: 100000 }, (_, index) => ({ index }));
  const legacyClassRows = [{ Class: 'A1' }];
  const json = serializeStandaloneImportMastersConfig({
    config: {
      linelist: { fieldMap: { lineNo: 'Line' }, masterRows: huge },
      pipingClass: { fieldMap: { pipingClass: 'Class' }, masterRows: legacyClassRows },
      material: { fieldMap: { material: 'Material' }, mapRows: huge },
      weight: { fieldMap: { weight: 'Kg' }, masterRows: huge },
      supportPositionMatch: { toleranceMm: 20 },
    },
    lineRows: huge,
    pipingClassRows: legacyClassRows,
    materialMapRows: huge,
    weightMasterRows: huge,
    datasetRefs: {
      lineList: { datasetId: 'line-ds' },
      materialMap: { datasetId: 'material-ds' },
      weight: { datasetId: 'weight-ds' },
    },
  });
  const parsed = JSON.parse(json);

  assert.equal('masterRows' in parsed.linelist, false);
  assert.equal('mapRows' in parsed.material, false);
  assert.equal('masterRows' in parsed.weight, false);
  assert.deepEqual(parsed.pipingClass.masterRows, legacyClassRows);
  assert.equal(parsed.supportPositionMatch.toleranceMm, 20);
  assert(json.length < 2000, `metadata config unexpectedly large: ${json.length}`);
});
