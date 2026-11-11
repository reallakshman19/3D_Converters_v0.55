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
  const expected = [{ branchName: 'A-10"-CS-S80-96620/B1', rating: '900' }];
  let receivedOptions = null;
  const actual = xmlCiiParentRunParityBranchRows({
    preview: (xmlText, seenConfig, stagedJsonText, options) => {
      assert.equal(xmlText, '<xml/>');
      assert.equal(stagedJsonText, '{"ok":true}');
      assert.equal(seenConfig, config, 'must preserve config object identity');
      assert.equal(seenConfig.weight.masterRows, originalRows, 'must expose the original Weight Master by identity');
      assert.equal(seenConfig.weight.masterRows.length, 100_000, 'must not hide Weight Master rows');
      assert.deepEqual(seenConfig.weight.npsToDn, { 10: 250 });
      assert.equal(seenConfig.weight.boreTokenIndex, 4);
      receivedOptions = options;
      seenConfig.overrides.createdByPreview = 'retained';
      return { branchRows: expected, nodeRows: [{ wouldBeDiscarded: true }] };
    },
    sourceXmlText: '<xml/>',
    config,
    stagedJsonText: '{"ok":true}',
  });
  assert.equal(actual, expected, 'must return the Preview branchRows by identity');
  assert.deepEqual(receivedOptions, { branchRowsOnly: true }, 'parent parity must explicitly request branch-only Preview execution');
  assert.equal(config.weight.masterRows, originalRows, 'must never replace the Weight Master array');
  assert.equal(config.overrides.createdByPreview, 'retained', 'must retain same-config Preview mutations');
}

{
  const config = configured(3);
  const originalRows = config.weight.masterRows;
  assert.throws(() => xmlCiiParentRunParityBranchRows({
    preview: (_xml, seenConfig, _staged, options) => {
      assert.equal(seenConfig.weight.masterRows, originalRows);
      assert.deepEqual(options, { branchRowsOnly: true });
      throw new Error('preview failure');
    },
    sourceXmlText: '<xml/>',
    config,
    stagedJsonText: '{}',
  }), /preview failure/);
  assert.equal(config.weight.masterRows, originalRows, 'must remain untouched after exceptions');
}

{
  const rows = xmlCiiParentRunParityBranchRows({
    preview: (_xml, _config, _staged, options) => {
      assert.deepEqual(options, { branchRowsOnly: true });
      return { nodeRows: [{ discarded: true }] };
    },
    sourceXmlText: '', config: {}, stagedJsonText: '',
  });
  assert.deepEqual(rows, []);
}

{
  const previewSource = readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js', import.meta.url), 'utf8');
  const branchPush = previewSource.indexOf('branchRows.push({');
  const branchOnlySkip = previewSource.indexOf('if (branchRowsOnly) continue;', branchPush);
  const nodeTraversal = previewSource.indexOf("let previousPosition = null; const branchNodes = _xmlChildrenByName(branch, 'Node');", branchPush);
  assert.match(previewSource, /xmlCiiDryRunPreview\(xmlText, config, stagedJsonText, options\)/);
  assert.match(previewSource, /const branchRowsOnly = options\?\.branchRowsOnly === true;/);
  assert.ok(branchPush >= 0, 'branch row append must remain present');
  assert.ok(branchOnlySkip > branchPush, 'branch-only skip must happen after the complete branch row is built');
  assert.ok(nodeTraversal > branchOnlySkip, 'branch-only skip must happen before node-row traversal/ranking');
  assert.match(previewSource.slice(nodeTraversal), /rankXmlCiiWeightCandidates/);
}

{
  const helperSource = readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/xml-cii-parent-run-parity-weight-scope.js', import.meta.url), 'utf8');
  assert.match(helperSource, /branchRowsOnly:\s*true/);
  assert.doesNotMatch(helperSource, /masterRows\s*=\s*\[\]/, 'successor helper must not mutate Weight Master visibility');
}

{
  const source = readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js', import.meta.url), 'utf8');
  assert.match(source, /preview-renderer\.js\?v=/);
  assert.match(source, /xml-cii-parent-run-parity-weight-scope\.js\?v=/);
  assert.match(source, /xmlCiiParentRunParityBranchRows/);
  assert.match(source, /preview:\s*xmlCiiDryRunPreview/);
  assert.doesNotMatch(source, /xmlCiiDryRunPreview\(sourceXmlText, enriched\.config, stagedJsonText\)\.branchRows/);
}

console.log('XML CII parent Run-parity branch-only Preview checks passed.');
