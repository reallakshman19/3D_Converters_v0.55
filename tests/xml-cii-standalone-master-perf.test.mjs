import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitAppliedMaster,
  persistChangedMaster,
  readSupportConfigOnce,
  stageMasterMappingDraft,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
import {
  requestMeasuredFullRender,
  resetXmlCiiPerfMetrics,
  snapshotXmlCiiPerfMetrics,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js';
import { createXmlCiiAdaptedWorkflowState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';

class LocalStorageMock {
  constructor() {
    this.map = new Map();
    this.setCalls = [];
    this.removeCalls = [];
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    const text = String(value);
    this.map.set(key, text);
    this.setCalls.push([key, text]);
  }

  removeItem(key) {
    this.map.delete(key);
    this.removeCalls.push(key);
  }

  clear() {
    this.map.clear();
    this.setCalls.length = 0;
    this.removeCalls.length = 0;
  }
}

function withPerfAndStorage(fn) {
  const previousStorage = globalThis.localStorage;
  const previousPerf = globalThis.__XML_CII_PERF__;
  const storage = new LocalStorageMock();
  globalThis.localStorage = storage;
  globalThis.__XML_CII_PERF__ = true;
  resetXmlCiiPerfMetrics();
  try {
    return fn(storage);
  } finally {
    resetXmlCiiPerfMetrics();
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousPerf === undefined) delete globalThis.__XML_CII_PERF__;
    else globalThis.__XML_CII_PERF__ = previousPerf;
  }
}

function setJson(storage, key, value) {
  storage.map.set(key, JSON.stringify(value));
}

test('support config is parsed once per explicit runtime boundary call', () => withPerfAndStorage(() => {
  const state = { supportConfigJson: JSON.stringify({ coordinateTolerance: 1, marker: 'cached-once' }) };
  assert.deepEqual(readSupportConfigOnce(state), { coordinateTolerance: 1, marker: 'cached-once' });
  assert.equal(snapshotXmlCiiPerfMetrics().configParseCount, 1);

  assert.deepEqual(readSupportConfigOnce(state), { coordinateTolerance: 1, marker: 'cached-once' });
  assert.equal(snapshotXmlCiiPerfMetrics().configParseCount, 2);
}));

test('ten mapping edits remain draft-only with zero persistence writes', () => withPerfAndStorage((storage) => {
  const config = { linelist: { fieldMap: { lineKey: 'LINE' } } };
  let context = {
    lineRows: [{ LINE: 'A' }],
    appliedMappingRevision: { lineList: 1 },
    mappingDrafts: {},
  };

  for (let index = 0; index < 10; index += 1) {
    context = stageMasterMappingDraft(context, config, 'lineList', { lineKey: `LINE_${index}` });
  }

  const metrics = snapshotXmlCiiPerfMetrics();
  assert.equal(metrics.masterMappingDraftChanges, 10);
  assert.equal(metrics.masterPersistCommitCount, 0);
  assert.equal(metrics.masterStorageWriteCount, 0);
  assert.equal(storage.setCalls.length, 0);
  assert.deepEqual(config.linelist.fieldMap, { lineKey: 'LINE' });
  assert.equal(context.appliedMappingRevision.lineList, 1);
  assert.equal(context.mappingDrafts.lineList.dirty, true);
  assert.deepEqual(context.mappingDrafts.lineList.fieldMap, { lineKey: 'LINE_9' });
}));

test('explicit apply advances authority once and persists only the changed master', () => withPerfAndStorage((storage) => {
  const initialConfig = { linelist: { fieldMap: { lineKey: 'OLD' } } };
  const initialContext = {
    lineRows: [{ OLD: 'A' }],
    pipingClassRows: [{ CLASS: 'P1' }],
    materialMapRows: [{ MATERIAL: 'M1' }],
    weightMasterRows: [{ ITEM: 'V1' }],
    appliedMappingRevision: { lineList: 1, pipingClass: 1, materialMap: 1, weight: 1 },
    mappingDrafts: { lineList: { fieldMap: { lineKey: 'LINE' }, dirty: true, basisAppliedRevision: 1 } },
    rawRows: { lineList: [{ RawLine: 'A' }] },
    sourceMetadata: {},
    sheetNames: { lineList: ['Sheet1'] },
    activeSheet: { lineList: 'Sheet1' },
    workbookData: { lineList: { Sheet1: [{ RawLine: 'A' }] } },
  };

  const applied = commitAppliedMaster({
    context: initialContext,
    config: initialConfig,
    key: 'lineList',
    fieldMap: { lineKey: 'LINE' },
    rawRows: [{ RawLine: 'A' }],
    normalizedRows: [{ LINE: 'A' }],
    sourceMetadata: { source: 'line-list.xlsx' },
  });

  assert.equal(applied.revision, 2);
  assert.equal(applied.context.appliedMappingRevision.lineList, 2);
  assert.equal(applied.context.mappingDrafts.lineList, undefined);
  assert.deepEqual(applied.config.linelist.fieldMap, { lineKey: 'LINE' });

  const writes = persistChangedMaster('lineList', applied.context);
  assert.equal(writes, 6);
  assert.equal(snapshotXmlCiiPerfMetrics().masterPersistCommitCount, 1);
  assert.equal(snapshotXmlCiiPerfMetrics().masterStorageWriteCount, 6);
  assert.equal(storage.setCalls.length, 6);
  assert.deepEqual(
    storage.setCalls.map(([key]) => key).sort(),
    [
      'xml-cii-master-activesheet-lineList',
      'xml-cii-master-lineList',
      'xml-cii-master-raw-lineList',
      'xml-cii-master-sheetnames-lineList',
      'xml-cii-master-source-lineList',
      'xml-cii-master-workbook-lineList',
    ],
  );
  assert.deepEqual(JSON.parse(storage.map.get('xml-cii-master-source-lineList')), {
    source: 'line-list.xlsx',
    fieldMap: { lineKey: 'LINE' },
    appliedRevision: 2,
  });
  assert.equal(storage.setCalls.some(([key]) => key.includes('pipingClass')), false);
  assert.equal(storage.setCalls.some(([key]) => key.includes('materialMap')), false);
  assert.equal(storage.setCalls.some(([key]) => key.endsWith('-weight')), false);

  const repeatWrites = persistChangedMaster('lineList', applied.context);
  assert.equal(repeatWrites, 0);
  assert.equal(snapshotXmlCiiPerfMetrics().masterPersistCommitCount, 2);
  assert.equal(snapshotXmlCiiPerfMetrics().masterStorageWriteCount, 6);
  assert.equal(storage.setCalls.length, 6);
}));

test('measured full-render counter records exactly the requested render count', () => withPerfAndStorage(() => {
  let renders = 0;
  requestMeasuredFullRender(() => { renders += 1; return 'first'; });
  requestMeasuredFullRender(() => { renders += 1; return 'second'; });
  assert.equal(renders, 2);
  assert.equal(snapshotXmlCiiPerfMetrics().masterRequestedFullRenderCount, 2);
}));

test('restart restores dedicated rows, workbook custody, applied mapping and revision for all four masters', () => withPerfAndStorage((storage) => {
  const fixtures = {
    lineList: [{ LINE_KEY: 'L-100' }],
    pipingClass: [{ CLASS: 'P-100', OD: 114.3 }],
    materialMap: [{ MATERIAL: 'A106-B', CODE: 1 }],
    weight: [{ TYPE: 'VALVE', WEIGHT: 123.4 }],
  };

  setJson(storage, 'xml-cii-import-masters-v1', { config: {} });
  for (const [key, rows] of Object.entries(fixtures)) {
    setJson(storage, `xml-cii-master-${key}`, rows);
    setJson(storage, `xml-cii-master-raw-${key}`, [{ RAW: key }]);
    setJson(storage, `xml-cii-master-sheetnames-${key}`, ['Data']);
    setJson(storage, `xml-cii-master-activesheet-${key}`, 'Data');
    setJson(storage, `xml-cii-master-workbook-${key}`, { Data: [{ RAW: key }] });
  }

  // One legacy string-only source proves backward compatibility. The other three
  // use Batch-A compact source custody carrying the applied mapping and revision.
  setJson(storage, 'xml-cii-master-source-lineList', 'lineList.xlsx');
  setJson(storage, 'xml-cii-master-source-pipingClass', {
    source: 'pipingClass.xlsx',
    fieldMap: { class: 'CLASS', od: 'OD' },
    appliedRevision: 7,
  });
  setJson(storage, 'xml-cii-master-source-materialMap', {
    source: 'materialMap.xlsx',
    fieldMap: { material: 'MATERIAL', code: 'CODE' },
    appliedRevision: 4,
  });
  setJson(storage, 'xml-cii-master-source-weight', {
    source: 'weight.xlsx',
    fieldMap: { type: 'TYPE', weight: 'WEIGHT' },
    appliedRevision: 5,
  });

  const state = createXmlCiiAdaptedWorkflowState();
  const context = state.masterContext;
  assert.deepEqual(context.lineRows, fixtures.lineList);
  assert.deepEqual(context.pipingClassRows, fixtures.pipingClass);
  assert.deepEqual(context.materialMapRows, fixtures.materialMap);
  assert.deepEqual(context.weightMasterRows, fixtures.weight);
  assert.deepEqual(context.config.pipingClass.masterRows, fixtures.pipingClass);
  assert.deepEqual(context.config.pipingClass.fieldMap, { class: 'CLASS', od: 'OD' });
  assert.deepEqual(context.config.material.fieldMap, { material: 'MATERIAL', code: 'CODE' });
  assert.deepEqual(context.config.weight.fieldMap, { type: 'TYPE', weight: 'WEIGHT' });
  assert.deepEqual(context.rowCounts, { lineList: 1, pipingClass: 1, materialMap: 1, weight: 1 });
  assert.deepEqual(context.appliedMappingRevision, { lineList: 1, pipingClass: 7, materialMap: 4, weight: 5 });

  for (const key of Object.keys(fixtures)) {
    assert.equal(context.sourceMetadata[key].source, `${key}.xlsx`);
    assert.deepEqual(context.rawRows[key], [{ RAW: key }]);
    assert.deepEqual(context.sheetNames[key], ['Data']);
    assert.equal(context.activeSheet[key], 'Data');
    assert.deepEqual(context.workbookData[key], { Data: [{ RAW: key }] });
  }
}));
