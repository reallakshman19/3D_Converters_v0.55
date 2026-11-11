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
  const persistence = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-persistence-retry.js');
  assert.match(source, /masterDatasetCoordinator as coordinator/);
  assert.match(source, /commitDatasetReadyMaster/);
  assert.doesNotMatch(source, /coordinator\.materialize\(ready\)/);
  assert.match(source, /if \(!isCurrent\(key, generation\)\) return false/);
  assert.match(source, /coordinator\.selectSheet/);
  assert.match(source, /coordinator\.openBuffer/);
  assert.match(source, /xml-cii-adapted-master-persistence-retry\.js/);
  assert.match(source, /nextPersistenceFailures,[\s\S]*persistenceFailureRecord,/);
  assert.match(persistence, /import \\{ masterPersistenceStatus \\} from '\\.\\/xml-cii-adapted-master-mapping-events\\.js\\?v=20261001-weight-output-2';/);
  assert.match(source, /xml-cii-adapted-master-persistence-retry\\.js\\?v=20261007-integration-b2-dataset-compat-2/);
  assert.doesNotMatch(source, /masterConfigForState, masterPersistenceStatus/);
  assert.match(persistence, /export function nextPersistenceFailures/);
  assert.match(persistence, /export function persistenceFailureRecord/);
  assert.match(persistence, /export async function retryCurrentMasterPersistence/);
  assert.match(persistence, /export function bindRetryPersistenceEvents/);
  assert(lines(source) < 300);
  assert(lines(persistence) < 300);
});

test('worker persistence split mirrors docs deployment', async () => {
  const path = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-persistence-retry.js';
  assert.equal(await read('docs/' + path), await read(path));
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