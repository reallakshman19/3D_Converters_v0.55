import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sourcePath = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js', import.meta.url);

test('Preview uses transient dataset-backed config and compacts every config write-back', async () => {
  const source = await fs.readFile(sourcePath, 'utf8');
  assert.ok(source.includes('export async function previewConfigFromState'));
  assert.ok(source.includes('materializeXmlCiiDatasetBackedConfig('));
  assert.ok(source.includes('const config = await previewConfigFromState(state);'));
  assert.ok(source.includes('const compactConfig = compactDatasetBackedConfig(newCfg, currentContext);'));
  assert.ok(source.includes('supportConfigJson: JSON.stringify(compactConfig, null, 2)'));
  assert.ok(source.includes('masterContext: { ...currentContext, config: compactConfig }'));
  assert.equal(source.includes('supportConfigJson: nextJson'), false);
});
