import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sourcePath = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js', import.meta.url);

test('Output/Run readiness is metadata-only for dataset-backed masters', async () => {
  const source = await fs.readFile(sourcePath, 'utf8');
  assert.equal(source.includes('xmlCiiEnrichedConfigFromState'), false);
  assert.ok(source.includes("masterRowCount(state, 'lineList', 'lineRows'"));
  assert.ok(source.includes("masterRowCount(state, 'pipingClass', 'pipingClassRows'"));
  assert.ok(source.includes("masterRowCount(state, 'materialMap', 'materialMapRows'"));
  assert.ok(source.includes("masterRowCount(state, 'weight', 'weightMasterRows'"));
  assert.ok(source.includes("if (ref?.datasetId && Number.isFinite(datasetCount) && datasetCount >= 0) return datasetCount;"));
  assert.ok(source.includes('const config = supportConfigForReadiness(state);'));
});
