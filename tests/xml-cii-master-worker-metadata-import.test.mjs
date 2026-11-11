import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8');

test('worker import commits DATASET_READY metadata without full materialization', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js');
  assert.match(source, /commitDatasetReadyMaster/);
  assert.doesNotMatch(source, /coordinator\.materialize\(ready\)/);
  assert.doesNotMatch(source, /hydrated\.rawRows|hydrated\.rows/);
  assert.match(source, /masterWorkerMetadataOnlyCommitCount/);
});

test('dataset-backed mapping apply routes through worker remap rather than resident full raw rows', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js');
  assert.match(source, /remapDatasetBackedMasterDraft/);
  assert.match(source, /context\.datasetRefs\?\.\[key\]\?\.datasetId/);
  assert.match(source, /context\.mappingRows\?\.\[key\]/);
});
