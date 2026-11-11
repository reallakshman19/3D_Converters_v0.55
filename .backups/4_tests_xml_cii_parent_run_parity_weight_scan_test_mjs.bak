import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { xmlCiiParentRunParityBranchRows } from '../tabs/model-converters/converters/xmltocii2019_helper/xml-cii-parent-run-parity-weight-scope.js';

function configured(rowCount = 1000) {
  return {
    weight: {
      masterRows: Array.from({ length: rowCount }, (_, index) => ({ index })),
      npsToDn: { 10: 250 },
      boreTokenIndex: 4,
    },
    overrides: {},
  };
}

{
  const config = configured(100_000);
  const originalRows = config.weight.masterRows;
  let rowsExamined = 0;
  const expected = [{ branchName: 'A-10"-CS-S80-96620/B1', rating: '900' }];
  const actual = xmlCiiParentRunParityBranchRows({
    preview: (xmlText, seenConfig, stagedJsonText) => {
      assert.equal(xmlText, '<xml/>');
      assert.equal(stagedJsonText, '{"ok":true}');
      assert.equal(seenConfig, config, 'must preserve config object identity');
      assert.deepEqual(seenConfig.weight.npsToDn, { 10: 250 });
      assert.equal(seenConfig.weight.boreTokenIndex, 4);
      for (const row of seenConfig.weight.masterRows) rowsExamined += row ? 1 : 0;
      seenConfig.overrides.createdByPreview = 'retained';
      return { branchRows: expected, nodeRows: [{ discarded: true }] };
    },
    sourceXmlText: '<xml/>',
    config,
    stagedJsonText: '{"ok":true}',
  });
  assert.equal(actual, expected, 'must return the Preview branchRows by identity');
  assert.equal(rowsExamined, 0, 'parent parity must expose zero Weight Master rows to discarded node ranking');
  assert.equal(config.weight.masterRows, originalRows, 'must restore exact Weight Master array identity');
  assert.equal(config.weight.masterRows.length, 100_000);
  assert.equal(config.overrides.createdByPreview, 'retained', 'must retain same-config Preview mutations');
}

{
  const config = configured(3);
  const originalRows = config.weight.masterRows;
  assert.throws(() => xmlCiiParentRunParityBranchRows({
    preview: () => { throw new Error('preview failure'); },
    sourceXmlText: '<xml/>',
    config,
    stagedJsonText: '{}',
  }), /preview failure/);
  assert.equal(config.weight.masterRows, originalRows, 'must restore Weight Master rows after exceptions');
}

{
  const config = { weight: { masterRows: [], npsToDn: { 2: 50 } } };
  let calls = 0;
  const rows = xmlCiiParentRunParityBranchRows({
    preview: (_xml, seenConfig) => {
      calls += 1;
      assert.equal(seenConfig, config);
      return { branchRows: [{ branchName: 'B1' }] };
    },
    sourceXmlText: '<xml/>', config, stagedJsonText: '',
  });
  assert.equal(calls, 1);
  assert.deepEqual(rows, [{ branchName: 'B1' }]);
}

{
  const rows = xmlCiiParentRunParityBranchRows({
    preview: () => ({ nodeRows: [{ discarded: true }] }),
    sourceXmlText: '', config: {}, stagedJsonText: '',
  });
  assert.deepEqual(rows, []);
}

{
  const source = readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js', import.meta.url), 'utf8');
  assert.match(source, /xmlCiiParentRunParityBranchRows/);
  assert.match(source, /preview:\s*xmlCiiDryRunPreview/);
  assert.doesNotMatch(source, /xmlCiiDryRunPreview\(sourceXmlText, enriched\.config, stagedJsonText\)\.branchRows/);
}

console.log('XML CII parent Run-parity Weight scan suppression checks passed.');
