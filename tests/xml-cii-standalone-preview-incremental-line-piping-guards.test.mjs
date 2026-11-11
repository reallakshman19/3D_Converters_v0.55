import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildIncrementalPreview,
  resetIncrementalPreviewRuntime,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-incremental.js';

function baseConfig() {
  return {
    linelist: {
      fieldMap: { lineKey1: 'Service', lineKey2: 'Line Number' },
      masterRows: [{ Service: 'P', 'Line Number': '1001', P1: '100' }],
    },
    pipingClass: {
      fieldMap: { pipingClass: 'Class', convertedBore: 'DN' },
      masterRows: [{ Class: 'A1', DN: 100, rating: '150', wallThickness: 6.0 }],
    },
    material: { mapRows: [{ code: '001', material: 'A106-B' }] },
    weight: { masterRows: [{ id: 'V1', weight: 10 }] },
    stable: true,
  };
}

function fullResult(config) {
  return {
    branchRows: [{
      branchName: 'B1',
      lineKey: 'P1001',
      p1: String(config.linelist.masterRows[0].P1 || ''),
      pipingClass: String(config.pipingClass.masterRows[0].Class || ''),
      rating: String(config.pipingClass.masterRows[0].rating || ''),
      materialCode: String(config.material.mapRows[0].code || ''),
    }],
    nodeRows: [{ branchName: 'B1', nodeNumber: '10', selectedWeight: config.weight.masterRows[0].weight }],
  };
}

function build(config, callbacks = {}) {
  return buildIncrementalPreview({
    xmlText: '<Root><Branch/></Root>',
    stagedJsonText: '{}',
    config,
    fullBuild: () => fullResult(config),
    rerankWeight: callbacks.rerankWeight || ((nodeRows) => nodeRows),
    reapplyMaterial: callbacks.reapplyMaterial || ((previous) => ({
      ...previous,
      branchRows: previous.branchRows.map((row) => ({ ...row, materialCode: config.material.mapRows[0].code })),
      nodeRows: previous.nodeRows,
    })),
  });
}

function mutate(config, path, value) {
  const next = structuredClone(config);
  let cursor = next;
  for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
  cursor[path.at(-1)] = value;
  return next;
}

for (const scenario of [
  {
    name: 'Line List masterRows change',
    change: (cfg) => mutate(cfg, ['linelist', 'masterRows'], [{ Service: 'P', 'Line Number': '1001', P1: '250' }]),
  },
  {
    name: 'Line List fieldMap change',
    change: (cfg) => mutate(cfg, ['linelist', 'fieldMap'], { lineKey1: 'Fluid', lineKey2: 'Line No' }),
  },
  {
    name: 'Piping Class masterRows change',
    change: (cfg) => mutate(cfg, ['pipingClass', 'masterRows'], [{ Class: 'A1', DN: 100, rating: '300', wallThickness: 8.0 }]),
  },
  {
    name: 'Piping Class fieldMap change',
    change: (cfg) => mutate(cfg, ['pipingClass', 'fieldMap'], { pipingClass: 'Spec', convertedBore: 'Bore' }),
  },
]) {
  test(`${scenario.name} fails closed to full Preview`, () => {
    resetIncrementalPreviewRuntime();
    const initial = baseConfig();
    assert.equal(build(initial).mode, 'full');
    const changed = scenario.change(initial);
    const next = build(changed);
    assert.equal(next.mode, 'full');
  });
}

test('Material mapRows plus Line List change is not admitted as material-only', () => {
  resetIncrementalPreviewRuntime();
  const initial = baseConfig();
  assert.equal(build(initial).mode, 'full');
  const changed = structuredClone(initial);
  changed.material.mapRows = [{ code: '002', material: 'A106-B' }];
  changed.linelist.masterRows = [{ Service: 'P', 'Line Number': '1001', P1: '275' }];
  const next = build(changed);
  assert.equal(next.mode, 'full');
});

test('Piping Class change cannot be misclassified as Weight-only when Weight is unchanged', () => {
  resetIncrementalPreviewRuntime();
  const initial = baseConfig();
  assert.equal(build(initial).mode, 'full');
  const changed = structuredClone(initial);
  changed.pipingClass.masterRows = [{ Class: 'A1', DN: 100, rating: '600', wallThickness: 10.0 }];
  const next = build(changed);
  assert.equal(next.mode, 'full');
  assert.equal(next.result.branchRows[0].rating, '600');
});
