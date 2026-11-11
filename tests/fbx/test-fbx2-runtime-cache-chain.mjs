import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeSelectedZonePreviewDetail,
} from '../../tabs/model-converters/fbx-selected-zone-preview-bridge.js';

const root = new URL('../../', import.meta.url);
const appShellKey = '20260929-pr780-metadata-1';
const modelConvertersKey = '20260928-rvm-full-scope-core-1';
const key = '20260804-fbx-multifamily-release-1';
const obsoleteKeys = [
  '20260802-fbx-live-ui-3',
  '20260804-fbx-secondary-preview-1',
];
const read = (path) => readFile(new URL(path, root), 'utf8');
const paths = [
  'index.html',
  'main-rhbg-fitguard.js',
  'core/app.js',
  'tabs/model-converters-tab.js',
  'tabs/model-converters/index.js',
  'tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js',
  'tabs/model-converters/fbx-review-ui-addon.js',
  'tabs/model-converters/fbx-live-runner-addon.js',
  'tabs/model-converters/fbx-multifamily-release-addon.js',
  'tabs/model-converters/fbx-selected-zone-preview-bridge.js',
  'tabs/model-converters/fbx-preview-zone-selector.js',
  'tabs/model-converters/fbx-staged-json-zone-export.js',
  'tabs/model-converters/converters/fbx/zone-geometry/mapped-stage-output.js',
  'tabs/model-converters/converters/fbx/zone-geometry/mapped-stage-capture.js',
  'tabs/model-converters/converters/fbx/zone-geometry/zone-downloads.js',
  'tabs/model-converters/converters/fbx/zone-geometry/zone-review-panels.js',
  'tabs/model-converters/converters/fbx/zone-geometry/zone-toolbar.js',
];
const files = Object.fromEntries(await Promise.all(
  paths.map(async (path) => [path, await read(path)]),
));

function requires(path, fragment) {
  assert.equal(files[path].includes(fragment), true, `${path} lacks ${fragment}`);
}

requires('index.html', `main-rhbg-fitguard.js?v=${appShellKey}`);
requires('main-rhbg-fitguard.js', `core/app.js?v=${appShellKey}`);
requires('core/app.js', `app-standalone-runtime.js?v=${appShellKey}`);
requires('core/app.js', `model-converters-tab.js?v=${modelConvertersKey}`);
requires('tabs/model-converters-tab.js', `model-converters/index.js?v=${modelConvertersKey}`);
requires('tabs/model-converters/index.js', `ModelConvertersTab-fbx2-managed-reference.js?v=${modelConvertersKey}`);

const wrapper = files['tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js'];
for (const dependency of [
  'fbx-review-ui-addon.js',
  'fbx-live-runner-addon.js',
  'fbx-multifamily-release-addon.js',
  'fbx-preview-zone-selector.js',
  'fbx-selected-zone-preview-bridge.js',
  'zone-toolbar.js',
]) assert.equal(wrapper.includes(`${dependency}?v=${key}`), true, `wrapper lacks live ${dependency}`);

assert.equal(
  wrapper.includes('import { renderModelConvertersTab as renderBaseModelConvertersTab }'),
  false,
  'base renderer must not be statically imported before the FBX input contract is installed',
);
const installerFragments = [
  'installFbxReviewUiAddon();',
  'installFbxLiveRunnerAddon();',
  'installFbxMultiFamilyReleaseAddon();',
  'installFbxPreviewZoneSelector(container);',
  'installFbxSelectedZonePreviewBridge();',
  'installFbxZoneGeometryToolbar(container);',
];
const installerIndexes = installerFragments.map((fragment) => wrapper.indexOf(fragment));
assert.equal(installerIndexes.every((index) => index >= 0), true, 'live installer call is missing');
assert.deepEqual(
  [...installerIndexes].sort((a, b) => a - b),
  installerIndexes,
  'live installers are out of order',
);
requires(
  'tabs/model-converters/ModelConvertersTab-fbx2-managed-reference.js',
  `import('./ModelConvertersTab.js?v=${modelConvertersKey}')`,
);
const renderFunctionStart = wrapper.indexOf('export function renderModelConvertersTab(container, ctx)');
const installCallIndex = wrapper.indexOf('installFbxLiveUi(container);', renderFunctionStart);
const loadCallIndex = wrapper.indexOf('return loadBaseModelConvertersTab()', renderFunctionStart);
const renderCallIndex = wrapper.indexOf('renderBaseModelConvertersTab(container, ctx)', loadCallIndex);
assert.ok(renderFunctionStart >= 0, 'exported renderer is missing');
assert.ok(installCallIndex > renderFunctionStart, 'FBX live UI installation is missing from renderer');
assert.ok(loadCallIndex > installCallIndex, 'base module is requested before FBX input installation');
assert.ok(renderCallIndex > loadCallIndex, 'base renderer invocation precedes module loading');

requires('tabs/model-converters/fbx-review-ui-addon.js', 'synchronizeInput');
requires('tabs/model-converters/fbx-review-ui-addon.js', "const SECONDARY_ACCEPT = '.fbxmap.json,.json,.JSON,.zip,.ZIP'");
requires('tabs/model-converters/fbx-review-ui-addon.js', "synchronizeInput(converter, 'secondary'");
requires('tabs/model-converters/fbx-live-runner-addon.js', `FBX_LIVE_UI_ACTIVE:${key}`);
requires('tabs/model-converters/fbx-live-runner-addon.js', 'FBX_SECONDARY_INPUT:');
requires('tabs/model-converters/fbx-live-runner-addon.js', 'FBX_PREVIEW_AUTHORITY:');
requires('tabs/model-converters/fbx-multifamily-release-addon.js', 'SELECTED_ZONE_RELEASE:MANAGED_MULTI_FAMILY');
requires('tabs/model-converters/fbx-multifamily-release-addon.js', 'APPROVED_MANAGED_STAGE');

for (const obsolete of obsoleteKeys) {
  for (const [path, source] of Object.entries(files)) {
    assert.equal(source.includes(obsolete), false, `${path} retains obsolete cache key ${obsolete}`);
  }
}

const normalized = normalizeSelectedZonePreviewDetail({
  result: {
    selectedZoneIds: ['ZONE-A'],
    selectionProvenance: { selector: 'explicit-zone-id' },
    selectedZoneArtifacts: [{ zoneId: 'ZONE-A', stagedJson: { nodes: [1] } }],
    selectedZoneDiagnostics: [{ zoneId: 'ZONE-A', status: 'ready' }],
    selectedZoneMappings: [{ zoneId: 'ZONE-A', mapping: { node: 1 } }],
  },
});
assert.deepEqual(normalized.selectedZoneIds, ['ZONE-A']);
assert.equal(normalized.selectionProvenance.selector, 'explicit-zone-id');
assert.equal(normalized.selectedZoneArtifacts.length, 1);
assert.equal(normalized.selectedZoneDiagnostics.length, 1);
assert.equal(normalized.selectedZoneMappings.length, 1);

console.log('test-fbx2-runtime-cache-chain: PASS');