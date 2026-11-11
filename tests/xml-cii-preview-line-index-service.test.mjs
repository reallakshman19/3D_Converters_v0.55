import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXmlCiiServiceProcessFallback,
  deriveXmlCiiServiceFromBranchName,
} from '../converters/xml-cii2019-core/service-process-fallback.js';

const rows = Array.from({ length: 30 }, (_, index) => ({
  Service: index % 3 === 0 ? 'WATER' : 'GAS',
  P1: index % 3 === 0 ? '1200' : '4000',
  T1: index % 3 === 0 ? '80' : '120',
}));

function run(masterRows) {
  return buildXmlCiiServiceProcessFallback({
    branchName: '/ASIM-1840-3-S8810XXX-WATER/B1',
    lineRow: { service: 'WATER' },
    config: { linelist: { masterRows } },
  });
}

test('sparse lookup view preserves service fallback population and consensus', () => {
  const dense = run(rows);
  const sparse = new Array(rows.length);
  rows.forEach((row, index) => {
    if (row.Service === 'WATER') sparse[index] = row;
  });
  const reduced = run(sparse);
  assert.equal(reduced.stats.matchedRows, dense.stats.matchedRows);
  assert.deepEqual(reduced.fields.p1, dense.fields.p1);
  assert.deepEqual(reduced.fields.t1, dense.fields.t1);
});

test('SYS-0010 branch service does not admit PERF timing rows', () => {
  const branchName = '/ASIM-1847-3"-S8810333-91261M7-01/B1';
  assert.equal(deriveXmlCiiServiceFromBranchName(branchName), 'ASIM');
  const perfRows = Array.from({ length: 250 }, (_, index) => ({
    Service: 'PERF',
    'Line Number': String(90000000 + index),
    P1: '100',
  }));
  const fallback = buildXmlCiiServiceProcessFallback({
    branchName,
    lineRow: null,
    config: { linelist: { masterRows: perfRows } },
    fields: [],
  });
  assert.equal(fallback.service, 'ASIM');
  assert.equal(fallback.stats.matchedRows, 0);
});
