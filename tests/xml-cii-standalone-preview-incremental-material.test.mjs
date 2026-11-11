import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildIncrementalPreview,
  previewMaterialInvariantConfigSignature,
  previewMaterialMapRowsSignature,
  resetIncrementalPreviewRuntime,
  snapshotIncrementalPreviewRuntime,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js';
import {
  applyPreviewMaterialCodeAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js';

const MATERIAL = 'ASTM A312-TP316';

function materialRows(code) {
  return [
    { code: String(code), material: 'A312-TP316' },
    { code: '338', material: 'A790-S32803' },
  ];
}

function config(code = '163', extra = {}) {
  return {
    linelist: { masterRows: [{ lineKey: 'L1', material: MATERIAL }] },
    pipingClass: { masterRows: [{ pipingClass: 'P1', materialCode: '777' }] },
    material: {
      mapRows: materialRows(code),
      fuzzy: { threshold: 0.84 },
      fieldMap: { code: 'code', material: 'material' },
    },
    weight: { masterRows: [{ id: 'V1', weight: 10 }] },
    supportPositionMatch: { toleranceMm: 20 },
    ...extra,
  };
}

function rawResult() {
  return {
    branchRows: [{
      branchName: 'B1',
      lineKey: 'L1',
      pipingClass: 'P1',
      sizeMm: 50,
      material: MATERIAL,
      materialSource: 'process-linelist-material',
      rating: '150',
    }],
    nodeRows: [{ branchName: 'B1', nodeNumber: '10', selectedWeight: 10 }],
    marker: 'full',
  };
}

function fullResult(cfg) {
  return applyPreviewMaterialCodeAuthority({ config: cfg, result: rawResult() });
}

function reapplyMaterial(result, cfg) {
  return applyPreviewMaterialCodeAuthority({ config: cfg, result });
}

test('Material basis excludes only material.mapRows and keeps every other config field authoritative', () => {
  const base = config('163');
  const rowsChanged = config('999');
  assert.notEqual(previewMaterialMapRowsSignature(base), previewMaterialMapRowsSignature(rowsChanged));
  assert.equal(previewMaterialInvariantConfigSignature(base), previewMaterialInvariantConfigSignature(rowsChanged));

  const fuzzyChanged = config('999');
  fuzzyChanged.material.fuzzy.threshold = 0.91;
  assert.notEqual(
    previewMaterialInvariantConfigSignature(base),
    previewMaterialInvariantConfigSignature(fuzzyChanged),
  );

  const weightChanged = config('999');
  weightChanged.weight.masterRows[0].weight = 25;
  assert.equal(
    previewMaterialInvariantConfigSignature(base),
    previewMaterialInvariantConfigSignature(weightChanged),
    'Weight is separately versioned and must be checked independently by the Material basis',
  );
});

test('Material-map-only change recomputes branch material authority and preserves nodeRows by identity', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config('163');
  const first = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
    fullBuild: () => fullResult(oldConfig),
    reapplyMaterial,
  });
  assert.equal(first.mode, 'full');
  assert.equal(first.result.branchRows[0].materialCode, '163');

  const newConfig = config('999');
  let fullCalls = 0;
  const second = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: newConfig,
    fullBuild: () => { fullCalls += 1; return fullResult(newConfig); },
    reapplyMaterial,
  });

  assert.equal(second.mode, 'material-only');
  assert.equal(fullCalls, 0);
  assert.equal(second.result.branchRows[0].materialCode, '999');
  assert.equal(second.result.nodeRows, first.result.nodeRows);
  assert.deepEqual(second.result, fullResult(newConfig));

  const metrics = snapshotIncrementalPreviewRuntime();
  assert.equal(metrics.fullBuilds, 1);
  assert.equal(metrics.materialOnlyBuilds, 1);
  assert.equal(metrics.branchRowsRecomputed, 1);
  assert.equal(metrics.nodeRowsReused, 1);
});

test('Material fuzzy-policy change fails closed to full Preview', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config('163');
  buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
    fullBuild: () => fullResult(oldConfig), reapplyMaterial,
  });
  const changed = config('999');
  changed.material.fuzzy.threshold = 0.91;
  const next = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: changed,
    fullBuild: () => fullResult(changed), reapplyMaterial,
  });
  assert.equal(next.mode, 'full');
});

test('simultaneous Weight and Material-map change fails closed to full Preview', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config('163');
  buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
    fullBuild: () => fullResult(oldConfig), reapplyMaterial,
  });
  const changed = config('999');
  changed.weight.masterRows[0].weight = 25;
  const next = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: changed,
    fullBuild: () => fullResult(changed), reapplyMaterial,
  });
  assert.equal(next.mode, 'full');
});

test('source XML or StagedJson change fails closed to full Preview', () => {
  for (const [xmlText, stagedJsonText] of [['<R2/>', '{}'], ['<R/>', '{"changed":true}']]) {
    resetIncrementalPreviewRuntime();
    const oldConfig = config('163');
    buildIncrementalPreview({
      xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
      fullBuild: () => fullResult(oldConfig), reapplyMaterial,
    });
    const changed = config('999');
    const next = buildIncrementalPreview({
      xmlText, stagedJsonText, config: changed,
      fullBuild: () => fullResult(changed), reapplyMaterial,
    });
    assert.equal(next.mode, 'full');
  }
});

test('Material callback failure fails closed to full Preview', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config('163');
  buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
    fullBuild: () => fullResult(oldConfig), reapplyMaterial,
  });
  const changed = config('999');
  let fullCalls = 0;
  const next = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: changed,
    fullBuild: () => { fullCalls += 1; return fullResult(changed); },
    reapplyMaterial: () => { throw new Error('synthetic Material rerank failure'); },
  });
  assert.equal(next.mode, 'full');
  assert.equal(fullCalls, 1);
});

test('Material callback that replaces nodeRows is rejected and falls back to full Preview', () => {
  resetIncrementalPreviewRuntime();
  const oldConfig = config('163');
  buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: oldConfig,
    fullBuild: () => fullResult(oldConfig), reapplyMaterial,
  });
  const changed = config('999');
  let fullCalls = 0;
  const next = buildIncrementalPreview({
    xmlText: '<R/>', stagedJsonText: '{}', config: changed,
    fullBuild: () => { fullCalls += 1; return fullResult(changed); },
    reapplyMaterial: (result, cfg) => {
      const reapplied = reapplyMaterial(result, cfg);
      return { ...reapplied, nodeRows: reapplied.nodeRows.map((row) => ({ ...row })) };
    },
  });
  assert.equal(next.mode, 'full');
  assert.equal(fullCalls, 1);
});
