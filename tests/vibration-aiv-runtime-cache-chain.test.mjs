import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
// Per-module cache keys matching current production imports
const canvasReleaseKey = '20260816-aiv-canvas-release-1';  // unchanged canvas leaf modules
const editorKey = '20260816-aiv-526-editor-3';               // canvas labels / execution / dataset
const canvasHardeningKey = '20260818-aiv-canvas-hardening-1'; // canvas author-view, unified-canvas-author, controller
const canvasEvidenceKey = '20260818-aiv-canvas-evidence-1';   // unified-canvas-inspector in canvas-view
const spatialKey = '20260816-aiv-canvas-spatial-1';
const fieldsKey = '20260816-aiv-canvas-fields-1';
const supersededCanvasUiKey = '20260816-aiv-canvas-ui-1';
// Top-level entrypoint chain key (sbc-connection-authoring release)
const connectionKey = '20260819-sbc-connection-authoring-1';
// Product-surface module keys (updated when product surfaces were released)
const fitKey = '20260821-m14-verification-authoring-1';
const aivFacilityKey = '20260820-aiv-facility-scenario-1';
// index.html entrypoint (most recently bumped by vib-pages-crypto release)
const rootBundleKey = '20260902-vib-pages-crypto-1';
const read = (path) => readFile(new URL(path, root), 'utf8');

const paths = [
  'index.html',
  'main-rhbg-fitguard.js',
  'core/app.js',
  'core/engineering-tabs-extension.js',
  'tabs/engineering-workspace-tab.js',
  'tabs/engineering-calculations-tab.js',
  'tabs/vibration-aiv-qualification-tab.js',
  'tabs/vibration-aiv-qualification-view.js',
  'tabs/vibration-aiv-input-view.js',
  'tabs/vibration-aiv-unified-canvas-controller.js',
  'tabs/vibration-aiv-unified-canvas-view.js',
  'tabs/vibration-aiv-unified-canvas-author-view.js',
  'tabs/vibration-aiv-unified-canvas-inspector.js',
  'tabs/vibration-aiv-unified-canvas-editor-controller.js',
  'tabs/vibration-aiv-unified-canvas-editor-view.js',
  'tabs/vibration-aiv-unified-canvas-workflow.js',
  'tabs/vibration-aiv-unified-canvas-labels.js',
  'tabs/vibration-aiv-canvas-export-controller.js',
  'tabs/vibration-aiv-canvas-field-controller.js',
  'tabs/vibration-aiv-canvas-field-link.js',
  'tabs/vibration-aiv-canvas-field.js',
  'tabs/vibration-aiv-canvas-selection.js',
  'tabs/vibration-aiv-canvas-presentation.js',
  'tabs/vibration-aiv-canvas-spatial-dom.js',
  'tabs/vibration-aiv-workspace-browser.js',
  'tabs/vibration-aiv-qualification.css',
];

const files = Object.fromEntries(await Promise.all(
  paths.map(async (path) => [path, await read(path)]),
));

function requires(path, fragment) {
  assert.equal(files[path].includes(fragment), true, `${path} lacks ${fragment}`);
}
function forbids(path, fragment) {
  assert.equal(files[path].includes(fragment), false, `${path} still exposes ${fragment}`);
}

test('fresh AIV canvas release identity reaches the merged unified renderer', () => {
  requires('index.html', `main-rhbg-fitguard.js?v=${rootBundleKey}`);
  requires('main-rhbg-fitguard.js', `core/app.js?v=${connectionKey}`);
  requires('core/app.js', `engineering-tabs-extension.js?v=${connectionKey}`);
  requires('core/engineering-tabs-extension.js', `engineering-workspace-tab.js?v=${connectionKey}`);
  requires('tabs/engineering-workspace-tab.js', `engineering-calculations-tab.js?v=${connectionKey}`);
  requires('tabs/engineering-calculations-tab.js', `vibration-aiv-qualification-tab.js?v=${aivFacilityKey}`);
  requires('tabs/vibration-aiv-qualification-tab.js', `vibration-aiv-qualification-view.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-qualification-view.js', `vibration-aiv-input-view.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-input-view.js', `vibration-aiv-unified-canvas-view.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-qualification-tab.js', `vibration-aiv-unified-canvas-controller.js?v=${canvasHardeningKey}`);
  requires('tabs/vibration-aiv-qualification-tab.js', `vibration-aiv-unified-canvas-inspector.js?v=${canvasReleaseKey}`);
});

test('all #534/#537 changed leaves reachable through the canvas are cache-addressed', () => {
  requires('tabs/vibration-aiv-qualification-tab.js', `vibration-aiv-canvas-export-controller.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-input-view.js', `vibration-aiv-canvas-field.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-canvas-selection.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-unified-canvas-view.js', `vibration-aiv-unified-canvas-inspector.js?v=${canvasEvidenceKey}`);
  requires('tabs/vibration-aiv-unified-canvas-view.js', `vibration-aiv-canvas-field-link.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-unified-canvas-inspector.js', `vibration-aiv-canvas-field.js?v=${canvasReleaseKey}`);
  requires('tabs/vibration-aiv-canvas-field-link.js', `vibration-aiv-canvas-field.js?v=${canvasReleaseKey}`);
});

test('unchanged leaf generations retain their qualified cache identities', () => {
  requires('tabs/vibration-aiv-unified-canvas-view.js', `vibration-aiv-unified-canvas-author-view.js?v=${canvasHardeningKey}`);
  requires('tabs/vibration-aiv-unified-canvas-view.js', `vibration-aiv-unified-canvas-labels.js?v=${editorKey}`);
  requires('tabs/vibration-aiv-unified-canvas-view.js', `vibration-aiv-canvas-presentation.js?v=${spatialKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-canvas-field-controller.js?v=${fieldsKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-unified-canvas-author.js?v=${canvasHardeningKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-unified-canvas-editor-controller.js?v=${canvasHardeningKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-unified-canvas-labels.js?v=${editorKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-canvas-presentation.js?v=${spatialKey}`);
  requires('tabs/vibration-aiv-unified-canvas-controller.js', `vibration-aiv-canvas-spatial-dom.js?v=${spatialKey}`);
  requires('tabs/vibration-aiv-unified-canvas-inspector.js', `vibration-aiv-unified-canvas-editor-view.js?v=${fieldsKey}`);
  requires('tabs/vibration-aiv-unified-canvas-editor-view.js', `vibration-aiv-canvas-field.js?v=${fieldsKey}`);
  requires('tabs/vibration-aiv-canvas-export-controller.js', `vibration-aiv-canvas-presentation.js?v=${spatialKey}`);
  forbids('tabs/vibration-aiv-canvas-export-controller.js', supersededCanvasUiKey);
});

test('warm Stage-8 browser cannot remain on an older parent route', () => {
  forbids('index.html', `main-rhbg-fitguard.js?v=${canvasReleaseKey}`);
  forbids('main-rhbg-fitguard.js', `core/app.js?v=${canvasReleaseKey}`);
  forbids('core/app.js', `engineering-tabs-extension.js?v=${canvasReleaseKey}`);
  forbids('core/engineering-tabs-extension.js', `engineering-workspace-tab.js?v=${canvasReleaseKey}`);
  forbids('tabs/engineering-workspace-tab.js', `engineering-calculations-tab.js?v=${canvasReleaseKey}`);
  forbids('tabs/engineering-calculations-tab.js', `vibration-aiv-qualification-tab.js?v=${canvasReleaseKey}`);
  forbids('tabs/vibration-aiv-qualification-tab.js', `vibration-aiv-qualification-view.js?v=${editorKey}`);
  forbids('tabs/vibration-aiv-qualification-view.js', `vibration-aiv-input-view.js?v=${editorKey}`);
  forbids('tabs/vibration-aiv-input-view.js', `vibration-aiv-unified-canvas-view.js?v=${editorKey}`);
});

test('active qualification source exposes the post-#534/#537 canvas surface', () => {
  requires('tabs/vibration-aiv-qualification-tab.js', 'createAivUnifiedCanvasController');
  requires('tabs/vibration-aiv-input-view.js', 'renderAivUnifiedCanvasWorkspaceHtml');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-unified-canvas-svg="true"');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'AIV Network Canvas Editor');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-canvas-icon-only="true"');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-canvas-action="fit-network"');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-canvas-action="auto-tidy"');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-canvas-inspector-dock="true"');
  requires('tabs/vibration-aiv-unified-canvas-view.js', 'Field integration:');
  assert.equal((files['tabs/vibration-aiv-unified-canvas-view.js'].match(/data-aiv-unified-canvas-svg=/gu) ?? []).length, 1);
});

test('scratch-network and five label-mode contracts remain visible', () => {
  requires('tabs/vibration-aiv-unified-canvas-editor-controller.js', 'New flare network');
  requires('tabs/vibration-aiv-unified-canvas-editor-controller.js', 'Add RV + branch');
  requires('tabs/vibration-aiv-unified-canvas-editor-controller.js', 'Subheader junction');
  requires('tabs/vibration-aiv-unified-canvas-workflow.js', "source: 'AIV_FLARE_NETWORK_UI'");
  for (const mode of ['NORMAL', 'PROCESS', 'GEOMETRY', 'RESULTS', 'COMPLETENESS']) {
    requires('tabs/vibration-aiv-unified-canvas-labels.js', `${mode}: '${mode}'`);
    requires('tabs/vibration-aiv-unified-canvas-view.js', 'data-aiv-canvas-label-mode');
  }
  requires('tabs/vibration-aiv-unified-canvas-labels.js', 'Mass Flow');
  requires('tabs/vibration-aiv-unified-canvas-labels.js', 'Main Outside Diameter');
  requires('tabs/vibration-aiv-unified-canvas-labels.js', 'Results stale · rerun screening');
  assert.equal(files['tabs/vibration-aiv-unified-canvas-labels.js'].includes('Math.log'), false);
  assert.equal(files['tabs/vibration-aiv-unified-canvas-labels.js'].includes('Math.log10'), false);
});

test('shared engineering entrypoint preserves FIV and HP product identities', () => {
  requires('tabs/engineering-calculations-tab.js', `vibration-integrity-tab.js?v=${fitKey}`);
  requires('tabs/engineering-workspace-tab.js', 'hp-piping-class-product-bulk-workbench-tab.js?v=20260820-hp-product-bulk-1');
});

test('stylesheet and filter contracts remain unchanged by cache custody repair', async () => {
  requires('tabs/vibration-aiv-workspace-browser.js', 'vibration-aiv-qualification.css?v=aiv-qualification-15');
  requires('tabs/vibration-aiv-qualification.css', 'vibration-aiv-unified-canvas-editor.css?v=1');
  const filter = await read('tabs/vibration-aiv-canvas-filter.js');
  requires('tabs/vibration-aiv-unified-canvas-controller.js', "from './vibration-aiv-canvas-filter.js'");
  assert.equal(filter.includes('input = input ?? {};'), true);
});
