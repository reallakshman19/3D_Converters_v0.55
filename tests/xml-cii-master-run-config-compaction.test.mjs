import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const paths = [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js',
];

for (const path of paths) {
  test(`${path} persists rigid-review config through dataset compaction`, async () => {
    const source = await fs.readFile(new URL('../' + path, import.meta.url), 'utf8');
    assert.ok(source.includes("compactDatasetBackedConfig(config, current.masterContext || {})"));
    assert.ok(source.includes("supportConfigJson: JSON.stringify(compactConfig, null, 2)"));
    assert.ok((source.match(/persistRunConfig\(stateRef, config\)/g) || []).length >= 1);
    assert.ok((source.match(/persistRunConfig\(stateRef, finalConfig\)/g) || []).length >= 1);
    assert.equal(source.includes('supportConfigJson = JSON.stringify(config, null, 2)'), false);
    assert.equal(source.includes('supportConfigJson = JSON.stringify(finalConfig, null, 2)'), false);
    assert.equal(source.includes('supportConfigJson: JSON.stringify(config, null, 2)'), false);
    assert.equal(source.includes('supportConfigJson: JSON.stringify(finalConfig, null, 2)'), false);
  });
}
