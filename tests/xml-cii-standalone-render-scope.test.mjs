import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyXmlCiiRenderScope } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-render-scope.js';

function basis() {
  const raw = {
    lineList: [{ RAW: 'L' }],
    pipingClass: [{ RAW: 'P' }],
    materialMap: [{ RAW: 'M' }],
    weight: [{ RAW: 'W' }],
  };
  const masterContext = {
    config: { linelist: { fieldMap: { lineKey: 'LINE' } } },
    lineRows: [{ lineKey: 'L-100' }],
    pipingClassRows: [{ class: 'P1' }],
    materialMapRows: [{ code: 1 }],
    weightMasterRows: [{ weight: 10 }],
    rawRows: raw,
    appliedMappingRevision: { lineList: 1, pipingClass: 1, materialMap: 1, weight: 1 },
    mappingDrafts: {},
    sourceMetadata: {},
    rowCounts: { lineList: 1, pipingClass: 1, materialMap: 1, weight: 1 },
    previewRows: {},
    sheetNames: {},
    activeSheet: {},
    workbookData: {},
    diagnostics: [],
    diagnosticsByMaster: {},
  };
  return {
    activePhaseId: 'source',
    activeSubTabId: 'lineList',
    supportConfigJson: '{"marker":"same"}',
    options: Object.freeze({ outputMode: 'both' }),
    masterContext,
    importMastersWriteBackStatus: '',
  };
}

function draftOnlyNext(previous, key = 'lineList') {
  const ctx = previous.masterContext;
  return {
    ...previous,
    importMastersWriteBackStatus: 'Draft changed; applied basis unchanged.',
    masterContext: {
      ...ctx,
      rawRows: { ...ctx.rawRows },
      appliedMappingRevision: { ...ctx.appliedMappingRevision },
      mappingDrafts: {
        ...ctx.mappingDrafts,
        [key]: { fieldMap: { lineKey: 'LINE_2' }, dirty: true, basisAppliedRevision: 1 },
      },
    },
  };
}

test('one visible master draft change is eligible for master-local render', () => {
  const previous = basis();
  const next = draftOnlyNext(previous);
  assert.deepEqual(classifyXmlCiiRenderScope(previous, next), { kind: 'master-draft', masterKey: 'lineList' });
});

test('applied revision change always forces full render', () => {
  const previous = basis();
  const next = draftOnlyNext(previous);
  next.masterContext.appliedMappingRevision.lineList = 2;
  assert.equal(classifyXmlCiiRenderScope(previous, next).kind, 'full');
});

test('config authority change always forces full render', () => {
  const previous = basis();
  const next = draftOnlyNext(previous);
  next.masterContext.config = { ...previous.masterContext.config, marker: 'changed' };
  assert.equal(classifyXmlCiiRenderScope(previous, next).kind, 'full');
});

test('row or raw-source change always forces full render', () => {
  const previous = basis();
  const nextRows = draftOnlyNext(previous);
  nextRows.masterContext.lineRows = [{ lineKey: 'L-200' }];
  assert.equal(classifyXmlCiiRenderScope(previous, nextRows).kind, 'full');

  const nextRaw = draftOnlyNext(previous);
  nextRaw.masterContext.rawRows.lineList = [{ RAW: 'NEW' }];
  assert.equal(classifyXmlCiiRenderScope(previous, nextRaw).kind, 'full');
});

test('hidden or multi-master draft changes fail closed to full render', () => {
  const previous = basis();
  const hidden = draftOnlyNext(previous);
  hidden.activeSubTabId = 'weight';
  assert.equal(classifyXmlCiiRenderScope(previous, hidden).kind, 'full');

  const multiple = draftOnlyNext(previous);
  multiple.masterContext.mappingDrafts.weight = { fieldMap: { weight: 'W' }, dirty: true, basisAppliedRevision: 1 };
  assert.equal(classifyXmlCiiRenderScope(previous, multiple).kind, 'full');
});

test('initial and no-op render requests remain full', () => {
  const state = basis();
  assert.equal(classifyXmlCiiRenderScope(null, state).kind, 'full');
  assert.equal(classifyXmlCiiRenderScope(state, state).kind, 'full');
});

test('dataset-backed authority ignores full row-array identity while preserving dataset/revision changes', () => {
  const previous = basis();
  previous.masterContext.datasetRefs = {
    lineList: { datasetId: 'ds-line-1', rowCount: 1, fileName: 'line.xlsx', sheetName: 'Line List', persistence: 'indexeddb' },
  };
  const next = draftOnlyNext(previous);
  next.masterContext.lineRows = [];
  next.masterContext.rawRows.lineList = [];
  assert.deepEqual(classifyXmlCiiRenderScope(previous, next), { kind: 'master-draft', masterKey: 'lineList' });

  const changedDataset = draftOnlyNext(previous);
  changedDataset.masterContext.datasetRefs = {
    ...previous.masterContext.datasetRefs,
    lineList: { ...previous.masterContext.datasetRefs.lineList, datasetId: 'ds-line-2' },
  };
  changedDataset.masterContext.lineRows = [];
  changedDataset.masterContext.rawRows.lineList = [];
  assert.equal(classifyXmlCiiRenderScope(previous, changedDataset).kind, 'full');
});

