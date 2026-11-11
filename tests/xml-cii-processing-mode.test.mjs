import test from 'node:test';
import assert from 'node:assert/strict';
import { xmlCiiProcessingMode, singleXmlCiiSourceState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-processing-mode.js';

test('Single is default and combined document starts one clean source with shared engineering configuration', () => {
  assert.equal(xmlCiiProcessingMode({}), 'single');
  assert.equal(xmlCiiProcessingMode({ xmlCombinationMode: 'mode-b' }), 'single');
  for (const mode of ['single', 'mode-a', 'mode-b']) assert.equal(xmlCiiProcessingMode({ xmlProcessingMode: mode }), mode);
  const config = { rating: { ratingSequence: [['9', '900']] }, weight: { masterRows: [{ weight: 123 }] },
    overrides: { rigidWeight: { '/OLD::10': 57.25 }, rating: { '/OLD::10': '150' } },
    linelist: { branchLineKeyMap: { '/OLD': 'OLD' } } };
  config.weight.finalizedMatches = { '/OLD::10': { weightKg: 57.25 } };
  const masterContext = { datasetRefs: { weight: { datasetId: 'published-weight', rowCount: 1595 } }, config };
  const original = { xmlProcessingMode: 'mode-b', supportConfigJson: JSON.stringify(config), masterContext,
    options: { kgToNewton: true }, regexTesterConfig: { formats: ['EXPLICIT'] }, sourceBatch: { sources: [{ sourceId: 'OLD' }] },
    stagedJsonText: '{"old":"geometry"}', result: { ciiText: 'OLD CII' },
    previewDiagnosticsAuditReport: { old: true }, weightMatchResult: { old: true }, batchRunResult: { old: true } };
  const file = { name: 'Mode-B-combined.xml' }, combined = '<PipeStressExport/>';
  const next = singleXmlCiiSourceState(original, file, combined, 'xml');
  assert.equal(next.sourceText, combined);
  assert.equal(next.sourceFile, file);
  assert.equal(next.xmlProcessingMode, 'single');
  assert.equal(next.sourceBatch, null);
  for (const field of ['result', 'batchRunResult', 'previewDiagnosticsAuditReport', 'weightMatchResult']) assert.equal(next[field], null);
  assert.equal(next.stagedJsonText, '');
  const retained = JSON.parse(next.supportConfigJson);
  assert.deepEqual(retained.rating, config.rating);
  assert.deepEqual(retained.weight.masterRows, config.weight.masterRows);
  assert.equal(retained.overrides, undefined);
  assert.equal(retained.linelist.branchLineKeyMap, undefined);
  assert.equal(retained.weight.finalizedMatches, undefined);
  assert.deepEqual(next.masterContext.datasetRefs, masterContext.datasetRefs);
  assert.deepEqual(next.masterContext.config, retained);
  assert.equal(next.options, original.options);
  assert.equal(next.regexTesterConfig, original.regexTesterConfig);
  assert.equal(original.result.ciiText, 'OLD CII');
});
