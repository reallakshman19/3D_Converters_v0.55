import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const lines = (text) => text.split(/\r?\n/).length;

test('master event facade contains no main-thread workbook parser', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js');
  assert.doesNotMatch(source, /XLSX\.read|sheet_to_json|getXlsxModule|parseMasterFileData/);
  assert.match(source, /bindMasterWorkerImportEvents/);
  assert.match(source, /bindMasterMappingEvents/);
  assert(lines(source) < 60);
});

test('worker import binding preserves atomic dataset commit and sheet selection', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js');
  assert.match(source, /createMasterDatasetImportCoordinator/);
  assert.match(source, /datasetMetadata:\s*metadata/);
  assert.match(source, /if \(!isCurrent\(key, generation\)\) return false/);
  assert.match(source, /coordinator\.selectSheet/);
  assert.match(source, /coordinator\.openBuffer/);
  assert(lines(source) < 300);
});

test('mapping authority remains separated from worker I/O', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js');
  assert.match(source, /export function autoMapStandaloneMasterFields/);
  assert.match(source, /stageMasterMappingDraft/);
  assert.match(source, /Applied calculation basis is unchanged/);
  assert.doesNotMatch(source, /new Worker|XLSX\.read|sheet_to_json/);
  assert(lines(source) < 300);
});

test('worker uses a pinned SheetJS ESM release', async () => {
  const source = await read('tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js');
  assert.match(source, /xlsx-0\.20\.3\/package\/xlsx\.mjs/);
  assert.doesNotMatch(source, /xlsx-latest/);
});
