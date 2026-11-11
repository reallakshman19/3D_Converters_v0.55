import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const SCALE_FIXTURE = 'tests/browser/xml-cii-master-dataset-scale-e2e.html';

test('C05.6.3 locks the inherited 10k/50k/100k scale oracle and thresholds unchanged', async () => {
  const source = await fs.readFile(new URL('../' + SCALE_FIXTURE, import.meta.url), 'utf8');

  assert.match(source, /const SIZES = \[10000, 50000, 100000\];/);
  assert.match(source, /const MAX_FRAME_GAP_MS = 250;/);
  assert.match(source, /const SAMPLE_LIMIT = 150;/);
  assert.match(source, /fixturePreparationExcludedFromProductTiming:\s*true/);
  assert.match(source, /workerImportMaxFrameGapMs/);
  assert.match(source, /metadataOnlyCommitMaxFrameGapMs/);
  assert.match(source, /transientOperationMaterializationMaxFrameGapMs/);
  assert.match(source, /workerSearchMaxFrameGapMs/);
  assert.match(source, /\.every\(\(value\) => value <= MAX_FRAME_GAP_MS\)/);
});

test('C05.6.3 scale oracle keeps full normalized/raw rows out of retained application state', async () => {
  const source = await fs.readFile(new URL('../' + SCALE_FIXTURE, import.meta.url), 'utf8');

  assert.match(source, /resident normalized rows retained/);
  assert.match(source, /resident raw rows retained/);
  assert.match(source, /retainedNormalizedRows:\s*context\.materialMapRows\.length/);
  assert.match(source, /retainedRawRows:\s*context\.rawRows\.materialMap\.length/);
  assert.match(source, /retainedPreviewRows:\s*context\.previewRows\.materialMap\.length/);
  assert.match(source, /retainedMappingRows:\s*context\.mappingRows\.materialMap\.length/);
  assert.match(source, /metadataOnlyCustody/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(materialMap|masterRows|rawRows)/);
});

test('C05.6.3 scale oracle requires exact transient row counts and unique terminal search match', async () => {
  const source = await fs.readFile(new URL('../' + SCALE_FIXTURE, import.meta.url), 'utf8');

  assert.match(source, /transient\.value\.rows\.length !== count/);
  assert.match(source, /coordinator\.search\('materialMap', `needle-\$\{count\}`\)/);
  assert.match(source, /searched\.value\?\.matchCount !== 1/);
  assert.match(source, /indexes\[0\] !== count - 1/);
});

test('C05.6.3 #893 runtime source/docs mirrors remain byte-identical', async () => {
  const paths = [
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/xml-cii-dataset-backed-config.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
    'tabs/xml-cii-2019-standalone-tab.js',
    'tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js',
  ];

  for (const sourcePath of paths) {
    const [source, docs] = await Promise.all([
      fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
      fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
    ]);
    assert.equal(source, docs, sourcePath);
  }
});
