import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const cachePaths = new Map([
  ['index.html', 'main-rhbg-fitguard.js?v=20260928-issue776-authority-2-regex1-tabperf1'],
  ['main-rhbg-fitguard.js', 'core/app.js?v=20260928-issue776-authority-2-regex1-tabperf1'],
  ['core/app.js', 'app-standalone-runtime.js?v=20260928-issue776-authority-2-regex1-tabperf1'],
  ['core/app-standalone-runtime.js', 'model-converters-tab.js?v=20260928-rvm-full-scope-core-1-tabperf1'],
  ['tabs/model-converters-tab.js', 'model-converters/index.js?v=20260928-rvm-full-scope-core-1-tabperf1'],
  ['tabs/model-converters/index.js', 'ModelConvertersTab-fbx2-managed-reference.js?v=20260928-rvm-full-scope-core-1-tabperf1'],
  ['tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js', 'ModelConvertersTab.js?v=20260928-rvm-full-scope-core-1-tabperf1'],
  ['tabs/model-converters/ModelConvertersTab.js', 'inputxml-property-transfer-popup-ui-v4.js?v=20260615-inputxml-property-transfer-popup-host-hide-1-tabperf1'],
  ['tabs/model-converters/inputxml-property-transfer-popup-ui-v4.js', 'inputxml-property-transfer-popup-ui-v3.js?v=20260615-inputxml-property-transfer-popup-guarded-mock-1-tabperf1'],
]);

test('tab lifecycle code is reachable through fresh deployment URLs and mirrors', async () => {
  for (const [path, required] of cachePaths) {
    const [source, mirror] = await Promise.all([read(path), read(`docs/${path}`)]);
    assert.equal(source, mirror, `${path} differs from its Pages mirror`);
    assert.ok(source.includes(required), `${path} lacks ${required}`);
  }
  const [app, runtime, legacy, base] = await Promise.all([
    read('core/app.js'), read('core/app-standalone-runtime.js'),
    read('tabs/model-converters/legacy-adapter.js'), read('tabs/model-converters/ModelConvertersTab.js'),
  ]);
  assert.match(app, /engineering-tabs-extension\.js\?v=[^'\n]+-tabperf1/u);
  assert.match(runtime, /const maybeDestroy = await renderer\(content,/u);
  assert.match(runtime, /generation !== renderGeneration/u);
  assert.match(base, /return \(\) => \{\s*stopInstallers\(\)/u);
  assert.match(legacy, /model-conv-preview-renderer\.js\?v=[^'\n]+-tabperf1/u);
});
