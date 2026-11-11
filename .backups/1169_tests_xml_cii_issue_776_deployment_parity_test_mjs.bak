import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const release = '20260930-issue781-weight-no-staged-rewrite-1';
const screenshotRepairRelease = '20261001-weight-output-2';
const liveAcceptanceRelease = '20261001-weight-output-2';
const activation = JSON.parse(await readFile(new URL('../agents/evidence/WIP-781-SINGLE-COMBINE-OWNERS-20261001/runtime-activation-ledger.json', import.meta.url), 'utf8'));
const activated = new Set([...activation.activatedModules, 'index.html']);
const moduleRelease = (filename, fallback) => activation.activatedModules.some(path => path.endsWith('/' + filename)) ? activation.release : fallback;
const regexEvidenceRelease = '20261001-weight-rating-1';
const pairs = [["converters/xml-cii2019-core/b313-preview-wall-update.js","docs/converters/xml-cii2019-core/b313-preview-wall-update.js"],["core/app-standalone-runtime.js","docs/core/app-standalone-runtime.js"],["core/app.js","docs/core/app.js"],["index.html","docs/index.html"],["main-rhbg-fitguard.js","docs/main-rhbg-fitguard.js"],["tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js","docs/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js"],["tabs/xml-cii-2019-standalone-tab.js","docs/tabs/xml-cii-2019-standalone-tab.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-dtxr.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-dtxr.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-ui-hook.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-ui-hook.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-propagation.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-propagation.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-render-scope.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-render-scope.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js"],["tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js","docs/tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js"]];

const boundedUiPairs = [
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-client.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-client.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-service.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-service.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js'],
  ['tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js', 'docs/tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js'],
  ['tabs/xml-cii-2019-standalone/workers/weight-basis-service.js', 'docs/tabs/xml-cii-2019-standalone/workers/weight-basis-service.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-smart.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-smart.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-cii-zip.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-cii-zip.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js'],
];

for (const [sourcePath, docsPath] of [...pairs, ...boundedUiPairs]) {
  const [source, docs] = await Promise.all([
    readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    readFile(new URL('../' + docsPath, import.meta.url), 'utf8'),
  ]);
  assert.equal(docs, source, `docs mirror drift: ${sourcePath}`);
}

const branchScopeRelease = '20260930-issue781-branch-scope-1';
const branchRoot = 'tabs/xml-cii-2019-standalone/';
const branchUi = `${branchRoot}ui-adapted/`;
const branchScopeCacheEdges = new Map([
  [`${branchRoot}xml-cii-mode-a-batch-core.js`, ['xml-cii-branch-scope.js']],
  [`${branchRoot}xml-cii-mode-a-batch.js`, ['xml-cii-mode-a-batch-core.js']],
  [`${branchRoot}xml-cii-workflow-ui-adapter.js`, ['xml-cii-branch-scope.js']],
  [`${branchUi}xml-cii-adapted-branch-scope.js`, ['xml-cii-branch-scope.js']],
  [`${branchUi}xml-cii-adapted-branch-scope-state.js`, ['xml-cii-adapted-branch-scope.js', 'xml-cii-branch-scope.js']],
  [`${branchUi}xml-cii-adapted-branch-scope-panel-v2.js`, ['xml-cii-branch-scope.js', 'xml-cii-adapted-branch-scope-state.js']],
  [`${branchUi}xml-cii-adapted-mode-a-state.js`, ['xml-cii-mode-a-batch.js']],
  [`${branchUi}xml-cii-adapted-mode-a-propagation.js`, ['xml-cii-mode-a-batch.js', 'xml-cii-adapted-mode-a-state.js']],
  [`${branchUi}xml-cii-adapted-mode-a-panel-core.js`, ['xml-cii-mode-a-batch.js']],
  [`${branchUi}xml-cii-adapted-mode-a-batch-scope-panel.js`, ['xml-cii-mode-a-batch.js', 'xml-cii-adapted-mode-a-state.js']],
  [`${branchUi}xml-cii-adapted-mode-a-panel.js`, ['xml-cii-mode-a-batch.js', 'xml-cii-adapted-mode-a-panel-core.js', 'xml-cii-adapted-mode-a-batch-scope-panel.js']],
  [`${branchUi}xml-cii-adapted-controls.js`, ['xml-cii-workflow-ui-adapter.js']],
  [`${branchUi}xml-cii-adapted-source-mode.js`, ['xml-cii-adapted-controls.js']],
  [`${branchUi}xml-cii-adapted-phase-panels.js`, ['xml-cii-workflow-ui-adapter.js', 'xml-cii-adapted-controls.js', 'xml-cii-adapted-source-mode.js']],
  [`${branchUi}xml-cii-adapted-phase-panels-smart.js`, ['xml-cii-adapted-phase-panels.js']],
  [`${branchUi}xml-cii-adapted-phase-panels-branch-scope.js`, ['xml-cii-adapted-branch-scope-state.js', 'xml-cii-adapted-branch-scope.js', 'xml-cii-adapted-branch-scope-panel-v2.js', 'xml-cii-adapted-phase-panels-smart.js']],
  [`${branchUi}xml-cii-adapted-phase-panels-mode-a.js`, ['xml-cii-adapted-phase-panels-branch-scope.js', 'xml-cii-adapted-phase-panels-smart.js', 'xml-cii-adapted-mode-a-panel.js', 'xml-cii-adapted-mode-a-propagation.js']],
  [`${branchUi}xml-cii-adapted-workflow-shell-mode-a-core.js`, ['xml-cii-adapted-branch-scope-state.js', 'xml-cii-branch-scope.js', 'xml-cii-mode-a-batch.js', 'xml-cii-adapted-mode-a-state.js', 'xml-cii-adapted-phase-panels-mode-a.js']],
  [`${branchUi}xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js`, ['xml-cii-adapted-workflow-shell-mode-a-core.js', 'xml-cii-adapted-branch-scope-state.js', 'xml-cii-adapted-mode-a-state.js']],
]);
for (const sourcePath of [`${branchRoot}xml-cii-branch-scope.js`, ...branchScopeCacheEdges.keys()]) {
  const [source, docs] = await Promise.all([
    readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(docs, source, `branch-scope cache docs mirror drift: ${sourcePath}`);
  for (const importedFile of branchScopeCacheEdges.get(sourcePath) || []) {
    const outputCacheModules = new Set(['xml-cii-adapted-mode-a-state.js', 'xml-cii-adapted-mode-a-panel-core.js', 'xml-cii-adapted-mode-a-batch-scope-panel.js', 'xml-cii-adapted-mode-a-panel.js', 'xml-cii-workflow-ui-adapter.js', 'xml-cii-adapted-controls.js', 'xml-cii-adapted-source-mode.js', 'xml-cii-adapted-phase-panels.js', 'xml-cii-adapted-phase-panels-smart.js', 'xml-cii-adapted-phase-panels-branch-scope.js', 'xml-cii-adapted-mode-a-propagation.js', 'xml-cii-adapted-phase-panels-mode-a.js', 'xml-cii-adapted-workflow-shell-mode-a-core.js']);
    const expectedRelease = moduleRelease(importedFile, outputCacheModules.has(importedFile) ? liveAcceptanceRelease : branchScopeRelease);
    assert.ok(source.includes(`${importedFile}?v=${expectedRelease}`),
      `branch-scope cache release edge missing: ${sourcePath} -> ${importedFile}`);
  }
}

const screenshotRepairPaths = [
  'index.html',
  'main-rhbg-fitguard.js',
  'core/app.js',
  'tabs/xml-cii-2019-standalone-tab.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
  'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
  'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
  'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
  'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
];
for (const path of screenshotRepairPaths) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  const expectedRelease = activated.has(path) ? activation.release : (path.includes('master-dataset') || path.includes('/workers/') ? screenshotRepairRelease : liveAcceptanceRelease);
  assert.ok(source.includes(expectedRelease), `live acceptance cache chain missing ${expectedRelease}: ${path}`);
}

const appSource = await readFile(new URL('../core/app.js', import.meta.url), 'utf8');
assert.ok(appSource.includes('XML_CII_STANDALONE_MODULE'));
assert.ok(appSource.includes('xmlCii.load = loadLiveXmlCiiStandalone'));

const legacyWeightReleasePaths = [
  'core/app-standalone-runtime.js',
  'tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js',
  'tabs/xml-cii-2019-standalone/workers/weight-basis-service.js',
];
for (const path of legacyWeightReleasePaths) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  // The renderer is a changed leaf. Its incoming URL is activated; its
  // unchanged geometry dependencies retain their inherited release.
  const expected = activated.has(path) && !activation.seeds.includes(path) ? activation.release : release;
  assert.ok(source.includes(expected), `Issue 781 Weight release missing ${expected}: ${path}`);
}

const regexUi = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', import.meta.url), 'utf8');
const regexEvidence = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js', import.meta.url), 'utf8');
assert.ok(regexUi.includes(`xml-cii-regex-smart-suggestions.js?v=${regexEvidenceRelease}`));
assert.ok(regexUi.includes(`xml-cii-adapted-regex-smart-evidence.js?v=${moduleRelease('xml-cii-adapted-regex-smart-evidence.js', liveAcceptanceRelease)}`));
assert.ok(regexEvidence.includes(`xml-cii-regex-smart-suggestions.js?v=${regexEvidenceRelease}`));
assert.ok(regexEvidence.includes(`xml-cii-adapted-master-dataset-runtime.js?v=${moduleRelease('xml-cii-adapted-master-dataset-runtime.js', screenshotRepairRelease)}`));

console.log('Issue #776 deployment mirror/cache chain verified.');
