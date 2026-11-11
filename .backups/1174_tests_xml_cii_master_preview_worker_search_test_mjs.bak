import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const pairs = [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
  'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
];
test('dataset-backed Preview search is worker-owned and fail-closed', async () => {
  const source = await read(pairs[0]);
  assert.match(source, /datasetRefs\?\.\[masterKey\]\?\.datasetId/);
  assert.match(source, /await searchMasterDatasetRows\(masterKey, datasetId, query\)/);
  assert.match(source, /await getMasterDatasetRows\(masterKey, datasetId/);
  assert.match(source, /await getMasterDatasetRowsByIndexes\(masterKey, datasetId/);
  assert.match(source, /masterContext\?\.mappingRows\?\.\[masterKey\]/);
  assert.match(source, /if \(!datasetId\)[\s\S]*buildMatchingRowIndexes\(allRows, query, previewSearchText\)/);
  const failure = source.split('catch (error) {', 2)[1] || '';
  assert.doesNotMatch(failure, /buildMatchingRowIndexes/);
  assert.match(source, /requestGeneration !== generation/);
});
test('Preview and import share one coordinator singleton including persisted dataset ids', async () => {
  const [events, runtime, coordinator] = await Promise.all([read(pairs[1]), read(pairs[2]), read(pairs[3])]);
  assert.match(events, /masterDatasetCoordinator as coordinator/);
  assert.match(runtime, /export const masterDatasetCoordinator = createMasterDatasetImportCoordinator\(\)/);
  assert.match(runtime, /masterDatasetCoordinator\.search\(masterKey, query, datasetId\)/);
  assert.match(runtime, /masterDatasetCoordinator\.getRows\(masterKey, offset, limit, datasetId\)/);
  assert.match(runtime, /masterDatasetCoordinator\.getRowsByIndexes\(masterKey, indexes, datasetId\)/);
  assert.match(coordinator, /function search\(masterKey, query, datasetIdOverride = ''\)/);
  assert.match(coordinator, /datasetIdOverride \|\| activeDatasets\.get\(masterKey\)/);
  assert.match(coordinator, /function getRowsByIndexes\(masterKey, indexes = \[\], datasetIdOverride = ''\)/);
});
test('worker-search runtime mirrors are byte-identical in docs deployment', async () => {
  for (const path of pairs) assert.equal(await read('docs/' + path), await read(path), `docs mirror drift: ${path}`);
});
