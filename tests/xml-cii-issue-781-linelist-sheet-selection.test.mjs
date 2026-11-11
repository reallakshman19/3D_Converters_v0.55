import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { suggestWorkbookSheet } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-sheet-selector.js';
import { prepareNormalizedDataset, buildSearchCorpus, searchCorpusIndexes } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js';
import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function lineListRows(prefix = 'L') {
  return [
    { 'Line Number': `${prefix}-100`, 'Piping Class': '61440', DN: '400', 'Design Pressure': '1500', 'Design Temperature': '120', Material: 'A106-B' },
    { 'Line Number': `${prefix}-200`, 'Piping Class': '61440', DN: '300', 'Design Pressure': '1200', 'Design Temperature': '100', Material: 'A106-B' },
  ];
}

function unrelatedRows() {
  return [{ Notes: 'Cover page' }, { Notes: 'Revision history' }];
}

function bytes(text = 'xlsx') {
  return new TextEncoder().encode(text).buffer;
}

function memoryStore() {
  const data = new Map();
  return {
    async persistDataset(metadata, rows) { data.set(metadata.datasetId, { metadata, rows }); },
    async getMetadata(id) { return data.get(id)?.metadata || null; },
    async getRows(id) { return data.get(id)?.rows || null; },
  };
}

test('line-list sheet name priority is deterministic and avoids semantic sampling', () => {
  let samples = 0;
  const sampleSheet = () => { samples += 1; return lineListRows(); };
  const exact = suggestWorkbookSheet({
    masterKey: 'lineList', sheetNames: ['ReadMe', 'linelist', 'Line List'], sampleSheet, prepareDataset: prepareNormalizedDataset,
  });
  assert.equal(exact.sheetName, 'linelist');
  assert.equal(exact.basis, 'exact-name');
  assert.equal(samples, 0);

  const alias = suggestWorkbookSheet({
    masterKey: 'lineList', sheetNames: ['ReadMe', 'Line-List'], sampleSheet, prepareDataset: prepareNormalizedDataset,
  });
  assert.equal(alias.sheetName, 'Line-List');
  assert.equal(alias.basis, 'alias-name');
  assert.equal(samples, 0);
});

test('semantic selection reuses existing line-list normalization and fails back to workbook order', () => {
  const samples = new Map([
    ['Cover', unrelatedRows()],
    ['Process Data', lineListRows('P')],
    ['Notes', [{ Owner: 'Stress' }, { Owner: 'Piping' }]],
  ]);
  const selected = suggestWorkbookSheet({
    masterKey: 'lineList',
    sheetNames: ['Cover', 'Process Data', 'Notes'],
    sampleSheet: (name) => samples.get(name) || [],
    prepareDataset: prepareNormalizedDataset,
  });
  assert.equal(selected.sheetName, 'Process Data');
  assert.equal(selected.basis, 'semantic-sample');
  assert(selected.score >= 16);
  assert(selected.evidence.includes('line-identity'));
  assert(selected.evidence.includes('piping-class'));

  const fallback = suggestWorkbookSheet({
    masterKey: 'lineList',
    sheetNames: ['Cover', 'Notes'],
    sampleSheet: (name) => samples.get(name) || [],
    prepareDataset: prepareNormalizedDataset,
  });
  assert.equal(fallback.sheetName, 'Cover');
  assert.equal(fallback.basis, 'first-sheet-fallback');
});

test('non-line-list masters preserve first-sheet behavior without sampling', () => {
  let samples = 0;
  const selected = suggestWorkbookSheet({
    masterKey: 'weight',
    sheetNames: ['Weights', 'Archive'],
    sampleSheet: () => { samples += 1; return []; },
    prepareDataset: prepareNormalizedDataset,
  });
  assert.equal(selected.sheetName, 'Weights');
  assert.equal(selected.basis, 'first-sheet-non-linelist');
  assert.equal(samples, 0);
});

test('worker service returns only suggested-sheet metadata and keeps sampling bounded', async () => {
  const sheetRows = new Map([
    ['Cover', unrelatedRows()],
    ['Process Data', [...lineListRows('P'), ...Array.from({ length: 200 }, (_, index) => ({
      'Line Number': `P-${index + 300}`, 'Piping Class': '61440', DN: '200', 'Design Pressure': '900', 'Design Temperature': '90', Material: 'A106-B',
    }))]],
  ]);
  const sampleCalls = [];
  const fullCalls = [];
  const xlsx = {
    read(_data, options = {}) {
      if (options.bookSheets) return { SheetNames: ['Cover', 'Process Data'] };
      const name = options.sheets;
      return { SheetNames: [name], Sheets: { [name]: { '!ref': 'A1:F1000', __name: name } } };
    },
    utils: {
      decode_range() { return { s: { r: 0, c: 0 }, e: { r: 999, c: 5 } }; },
      sheet_to_json(sheet, options = {}) {
        const rows = sheetRows.get(sheet.__name) || [];
        if (options.range) {
          sampleCalls.push({ name: sheet.__name, range: options.range });
          return rows.slice(0, Math.max(0, options.range.e.r - options.range.s.r));
        }
        fullCalls.push(sheet.__name);
        return rows;
      },
    },
  };

  const service = createMasterDatasetService({
    getXlsx: async () => xlsx,
    store: memoryStore(),
    prepareDataset: prepareNormalizedDataset,
    buildSearchCorpus,
    searchCorpusIndexes,
  });

  const opened = await service.handle({
    type: 'OPEN_SOURCE', requestId: 'open', jobId: 'job', fileName: 'line-list.xlsx', masterKey: 'lineList',
    buffer: bytes(), config: {}, currentMap: {}, fieldMapOverride: null,
  });
  assert.equal(opened.type, 'SHEETS');
  assert.deepEqual(opened.sheetNames, ['Cover', 'Process Data']);
  assert.equal(opened.suggestedSheet, 'Process Data');
  assert.equal(opened.suggestionBasis, 'semantic-sample');
  assert.equal('rows' in opened, false);
  assert.equal('rawRows' in opened, false);
  assert(sampleCalls.length >= 2);
  assert(sampleCalls.every(({ range }) => range.e.r - range.s.r <= 25));
  assert.deepEqual(fullCalls, []);

  const autoReady = await service.handle({ type: 'SELECT_SHEET', requestId: 'auto', jobId: 'job', sheetName: opened.suggestedSheet });
  assert.equal(autoReady.metadata.sheetName, 'Process Data');
  assert.equal(autoReady.metadata.rowCount, sheetRows.get('Process Data').length);
  assert.deepEqual(fullCalls, ['Process Data']);

  const manualReady = await service.handle({ type: 'SELECT_SHEET', requestId: 'manual', jobId: 'job', sheetName: 'Cover' });
  assert.equal(manualReady.metadata.sheetName, 'Cover');
  assert.notEqual(manualReady.metadata.datasetId, autoReady.metadata.datasetId);
  assert.deepEqual(fullCalls, ['Process Data', 'Cover']);
});

test('UI consumes a valid worker suggestion while retaining first-sheet fallback', () => {
  const source = fs.readFileSync(path.join(root, 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js'), 'utf8');
  assert.match(source, /const suggested = String\(response\?\.suggestedSheet \|\| ''\)/);
  assert.match(source, /suggested && sheetNames\.includes\(suggested\) \? suggested : firstSheet/);
  assert.match(source, /coordinator\.selectSheet\(key, selectedSheet\)/);
  assert.match(source, /coordinator\.selectSheet\(key, select\.value\)/, 'Manual worksheet selection must remain worker-backed.');
});
