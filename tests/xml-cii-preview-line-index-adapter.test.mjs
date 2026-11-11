import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePreviewLineListCoreConfig } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-line-index.js';

function element(localName, textContent) {
  return { nodeType: 1, localName, textContent };
}

function sourceDocument(branchNames) {
  const branches = branchNames.map((branchName) => ({
    childNodes: [element('Branchname', branchName)],
  }));
  return {
    getElementsByTagName(name) {
      return name === 'Branch' ? branches : [];
    },
  };
}

function lineConfig(rows) {
  return {
    linelist: {
      masterRows: rows,
      fieldMap: {
        lineKey1: 'Service',
        lineKey2: 'Line Number',
        lineSeqNo: 'Line Number',
        pipingClass: 'Piping Class',
      },
    },
  };
}

function perfRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    Service: 'PERF',
    'Line Number': String(90000000 + index),
    'Piping Class': `P${String(index % 40).padStart(2, '0')}`,
  }));
}

test('retained SYS-0010 timing shape produces an empty expensive-lookup population', () => {
  for (const count of [250, 1000]) {
    const rows = perfRows(count);
    const config = lineConfig(rows);
    const prepared = preparePreviewLineListCoreConfig(sourceDocument([
      '/ASIM-1847-3"-S8810333-91261M7-01/B1',
    ]), config);
    assert.equal(prepared.indexed, true);
    assert.equal(prepared.sourceRows, count);
    assert.equal(prepared.lookupRows, 0);
    assert.equal(prepared.config.linelist.masterRows.length, count);
    assert.equal(prepared.config.linelist.masterRows.filter(Boolean).length, 0);
    assert.equal(config.linelist.masterRows, rows);
  }
});

test('exact match remains at its original source index', () => {
  const rows = perfRows(12);
  rows[7] = { Service: 'S', 'Line Number': '8810333', 'Piping Class': 'P07' };
  const config = lineConfig(rows);
  const prepared = preparePreviewLineListCoreConfig(sourceDocument([
    '/ASIM-1847-3"-S8810333-91261M7-01/B1',
  ]), config);
  assert.equal(prepared.lookupRows, 1);
  assert.deepEqual(prepared.selectedIndices, [7]);
  assert.equal(prepared.config.linelist.masterRows[7], rows[7]);
  assert.equal(prepared.config.linelist.masterRows.filter(Boolean).length, 1);
});

test('unmatched branch retains every same-Service fallback row', () => {
  const rows = perfRows(12);
  for (const index of [2, 5, 9]) rows[index] = {
    Service: 'WATER',
    'Line Number': String(91000000 + index),
    'Piping Class': 'P01',
    P1: '1200',
  };
  const config = lineConfig(rows);
  const prepared = preparePreviewLineListCoreConfig(sourceDocument([
    '/ASIM-1847-3"-S1234567-91261M7-WATER-01/B1',
  ]), config);
  assert.equal(prepared.lookupRows, 3);
  assert.deepEqual(prepared.selectedIndices, [2, 5, 9]);
  assert.equal(prepared.config.linelist.masterRows[2], rows[2]);
  assert.equal(prepared.config.linelist.masterRows[5], rows[5]);
  assert.equal(prepared.config.linelist.masterRows[9], rows[9]);
});
