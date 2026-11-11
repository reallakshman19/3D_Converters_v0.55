import assert from 'node:assert/strict';
import test from 'node:test';

import { formatXmlCiiPerfEvidence } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf-evidence.js';

test('performance evidence reports aggregate counts and subsystem timings only', () => {
  const formatted = formatXmlCiiPerfEvidence({
    configParseCount: 2,
    masterMappingDraftChanges: 10,
    masterRequestedFullRenderCount: 4,
    workspaceFullRenderCount: 1,
    workspacePartialRenderCount: 3,
    masterPartialDomUpdateCount: 3,
    masterXlsxReadMs: 180.25,
    masterNormalizeMs: 31.75,
    masterPersistMs: 8.5,
  });

  const counters = Object.fromEntries(formatted.counters.map((item) => [item.key, item.value]));
  assert.equal(counters.configParseCount, 2);
  assert.equal(counters.masterMappingDraftChanges, 10);
  assert.equal(counters.masterRequestedFullRenderCount, 4);
  assert.equal(counters.workspaceFullRenderCount, 1);
  assert.equal(counters.workspacePartialRenderCount, 3);
  assert.equal(counters.masterPartialDomUpdateCount, 3);

  const timings = Object.fromEntries(formatted.timings.map((item) => [item.key, item.text]));
  assert.equal(timings.masterXlsxReadMs, '180.3 ms');
  assert.equal(timings.masterNormalizeMs, '31.8 ms');
  assert.equal(timings.masterPersistMs, '8.5 ms');

  const keys = [...formatted.counters, ...formatted.timings].map((item) => item.key);
  assert.equal(keys.some((key) => /candidate|rowTrace|elementId/i.test(key)), false);
});
