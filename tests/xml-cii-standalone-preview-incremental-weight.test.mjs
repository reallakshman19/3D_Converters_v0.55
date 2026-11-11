import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildIncrementalPreview,
  previewNonWeightConfigSignature,
  resetIncrementalPreviewRuntime,
  snapshotIncrementalPreviewRuntime,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js';

function config(weight = 10, extra = {}) {
  return { linelist: { masterRows: [{ lineKey: 'L1' }] }, supportPositionMatch: { toleranceMm: 20 }, weight: { masterRows: [{ id: 'V1', weight }] }, ...extra };
}

function fullResult(cfg) {
  const branchRows = [{ branchName: 'B1', p1: '100', rating: '150' }];
  const nodeRows = [{ branchName: 'B1', node: '10', selectedWeight: cfg.weight.masterRows[0].weight }];
  return { branchRows, nodeRows, marker: 'full' };
}

function rerank(nodeRows, branchRows, cfg) {
  return nodeRows.map((row) => ({ ...row, selectedWeight: cfg.weight.masterRows[0].weight, rating: branchRows[0].rating }));
}

test('first build is full and establishes runtime-only basis', () => {
  resetIncrementalPreviewRuntime();
  const cfg = config(10);
  const built = buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: cfg, fullBuild: () => fullResult(cfg), rerankWeight: rerank });
  assert.equal(built.mode, 'full');
  assert.deepEqual(snapshotIncrementalPreviewRuntime(), { fullBuilds: 1, weightOnlyBuilds: 0, branchRowsReused: 0, nodeRowsRecomputed: 0, hasCachedPreview: true });
});

test('Weight-only change reuses branch rows and deep-equals a fresh full result under new Weight config', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config(10);
  const first = buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig, fullBuild: () => fullResult(oldConfig), rerankWeight: rerank });
  const newConfig = config(25);
  const second = buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: newConfig, fullBuild: () => fullResult(newConfig), rerankWeight: rerank });
  const expected = { ...fullResult(newConfig), branchRows: first.result.branchRows, nodeRows: rerank(first.result.nodeRows, first.result.branchRows, newConfig) };
  assert.equal(second.mode, 'weight-only');
  assert.equal(second.result.branchRows, first.result.branchRows);
  assert.deepEqual(second.result, expected);
  const metrics = snapshotIncrementalPreviewRuntime();
  assert.equal(metrics.fullBuilds, 1);
  assert.equal(metrics.weightOnlyBuilds, 1);
  assert.equal(metrics.branchRowsReused, 1);
  assert.equal(metrics.nodeRowsRecomputed, 1);
});

test('source or staged JSON change fails closed to full build', () => {
  for (const [xmlText, stagedJsonText] of [['<R2/>', '{}'], ['<R/>', '{"changed":true}']]) {
    resetIncrementalPreviewRuntime();
    const oldConfig = config(10);
    buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig, fullBuild: () => fullResult(oldConfig), rerankWeight: rerank });
    const nextConfig = config(25);
    const next = buildIncrementalPreview({ xmlText, stagedJsonText, config: nextConfig, fullBuild: () => fullResult(nextConfig), rerankWeight: rerank });
    assert.equal(next.mode, 'full');
  }
});

test('any non-Weight config change fails closed while Weight section is excluded from branch basis', () => {
  const base = config(10);
  assert.equal(previewNonWeightConfigSignature(base), previewNonWeightConfigSignature(config(99)));
  resetIncrementalPreviewRuntime();
  buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: base, fullBuild: () => fullResult(base), rerankWeight: rerank });
  const changed = config(25, { supportPositionMatch: { toleranceMm: 25 } });
  const next = buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: changed, fullBuild: () => fullResult(changed), rerankWeight: rerank });
  assert.equal(next.mode, 'full');
});

test('rerank failure fails closed to full build', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config(10);
  buildIncrementalPreview({ xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig, fullBuild: () => fullResult(oldConfig), rerankWeight: rerank });
  const newConfig = config(20);
  let fullCalls = 0;
  const next = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: newConfig,
    fullBuild: () => { fullCalls += 1; return fullResult(newConfig); },
    rerankWeight: () => { throw new Error('synthetic rerank failure'); },
  });
  assert.equal(next.mode, 'full');
  assert.equal(fullCalls, 1);
});
