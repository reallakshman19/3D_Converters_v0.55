import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const release = '20260930-issue781-worker-weight-api-1';
const regexEvidenceRelease = '20260930-issue781-auto-authority-1';
const pairs = [["converters/xml-cii2019-core/b313-preview-wall-update.js","docs/converters/xml-cii2019-core/b313-preview-wall-update.js"],["core/app-standalone-runtime.js","docs/core/app-standalone-runtime.js"],["core/app.js","docs/core/app.js"],["index.html","docs/index.html"],["main-rhbg-fitguard.js","docs/main-rhbg-fitguard.js"],["tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js","docs/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js"],["tabs/xml-cii-2019-standalone-tab.js","docs/tabs/xml-cii-2019-standalone-tab.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events-mode-a-consolidated-review-v2.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-dtxr.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-dtxr.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-ui-hook.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-ui-hook.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-propagation.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-propagation.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-audit-controller.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-wall-update.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-render-scope.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-render-scope.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js"],["tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js","docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js"],["tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js","docs/tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js"],["tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js","docs/tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js"]];

const boundedUiPairs = [
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-client.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-client.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-service.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-service.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js'],
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

for (const path of [
  'index.html',
  'main-rhbg-fitguard.js',
  'core/app.js',
  'core/app-standalone-runtime.js',
  'tabs/xml-cii-2019-standalone-tab.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js',
]) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  assert.ok(source.includes(release), `cache chain missing ${release}: ${path}`);
}

const regexUi = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', import.meta.url), 'utf8');
const regexEvidence = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js', import.meta.url), 'utf8');
assert.ok(regexUi.includes(`xml-cii-regex-smart-suggestions.js?v=${regexEvidenceRelease}`));
assert.ok(regexUi.includes(`xml-cii-adapted-regex-smart-evidence.js?v=${regexEvidenceRelease}`));
assert.ok(regexEvidence.includes(`xml-cii-regex-smart-suggestions.js?v=${regexEvidenceRelease}`));

console.log('Issue #776 deployment mirror/cache chain verified.');
