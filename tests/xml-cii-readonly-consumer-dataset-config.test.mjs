import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Weight Match builds its calculation basis through generic dataset materialization', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js');
  assert.ok(source.includes('materializeXmlCiiDatasetBackedConfig('));
  assert.ok(source.includes('xmlCiiEnrichedConfigFromState(state)'));
  assert.ok(source.includes('!residentRows && !hasWeightRows(out)'));
});

for (const path of [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js',
]) {
  test(`${path} materializes dataset-backed masters before rigid-weight review`, async () => {
    const source = await read(path);
    assert.ok(source.includes('const reviewConfig = await materializeXmlCiiDatasetBackedConfig('));
    assert.ok(source.includes('xmlCiiEnrichedConfigFromState(stateRef.current)'));
    assert.ok(source.includes('reviewRigidWeights(stateRef, reviewConfig)'));
  });
}
