import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyRegexSuggestions } from '../tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js';

const release = '20260930-issue781-screenshot-repair-1';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function regexConfig() {
  return {
    activeFormatIndex: 0,
    formats: [{
      lineKey: { tokenPosition: '3', regex: '' },
      pipingClass: { tokenPosition: '4', regex: '' },
      rating: { tokenPosition: '5', regex: '' },
      bore: { tokenPosition: '', regex: '' },
    }],
  };
}

const boreReceipt = {
  formatIndex: 0,
  suggestions: [{ role: 'bore', tokenPositions: [3], safe: true, conflict: false }],
};

const repaired = applyRegexSuggestions(regexConfig(), boreReceipt, { safeOnly: true, manualLocks: {} });
assert.equal(repaired.formats[0].bore.tokenPosition, '3', '8-inch token must become Bore');
assert.equal(repaired.formats[0].lineKey.tokenPosition, '', 'stale unlocked Line Key claim must be cleared');
assert.equal(repaired.formats[0].pipingClass.tokenPosition, '4', 'unrelated Piping Class mapping must survive');
assert.equal(repaired.formats[0].rating.tokenPosition, '5', 'core smart apply must not infer or rewrite Rating');

const locked = applyRegexSuggestions(regexConfig(), boreReceipt, { safeOnly: true, manualLocks: { lineKey: true } });
assert.equal(locked.formats[0].lineKey.tokenPosition, '3', 'explicit Line Key lock remains authoritative');
assert.equal(locked.formats[0].bore.tokenPosition, '3', 'Bore evidence remains visible beside an explicit manual lock');

const suggestionsSource = await read('tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js');
const regexUiSource = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js');
assert.match(suggestionsSource, /const ROLE_ORDER = \['lineKey', 'pipingClass', 'bore'\]/);
assert.match(regexUiSource, /const SMART_AUTO_ROLES = Object\.freeze\(\['lineKey', 'pipingClass', 'bore'\]\)/);
assert.ok(!suggestionsSource.includes("ROLE_ORDER = ['lineKey', 'pipingClass', 'rating'"), 'Rating must not re-enter smart role logic');

const previewSource = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js');
const autoBasisSource = await read('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js');
const auditAt = previewSource.indexOf('installPreviewB313WallUpdateAuditController({');
const autoAt = previewSource.indexOf('queueMicrotask(() => installPreviewB313AutoBasisPanel({');
assert.ok(auditAt >= 0 && autoAt > auditAt, 'automatic B31.3 basis must run after legacy controller microtask is scheduled');
assert.ok(autoBasisSource.includes('B31.3 automatic basis'));
assert.ok(autoBasisSource.includes('data-b313-auto-refresh'));
assert.ok(autoBasisSource.includes('data-b313-factor-info-button'));
assert.ok(autoBasisSource.includes('[data-mc-b313-basis-editor]'));
assert.ok(autoBasisSource.includes('legacy.hidden = true'));
assert.ok(autoBasisSource.includes("legacy.style.display = 'none'"));

const weightService = await read('tabs/xml-cii-2019-standalone/workers/weight-basis-service.js');
const installAt = weightService.indexOf('installWeightBasisXmlDom(globalThis);');
const modulesAt = weightService.indexOf('const modulesPromise = Promise.all([');
assert.ok(installAt >= 0 && modulesAt > installAt, 'Weight runtime modules must start loading when worker module initializes');
assert.ok(weightService.includes('async function basisModules() {\n  return modulesPromise;\n}'));
assert.ok(!weightService.includes('if (!modulesPromise)'), 'Weight click path must not lazily create the module-import promise');

const releasePaths = [
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
for (const path of releasePaths) {
  assert.ok((await read(path)).includes(release), `screenshot repair cache release missing from ${path}`);
}

const mirrorPairs = [
  ['main-rhbg-fitguard.js', 'docs/main-rhbg-fitguard.js'],
  ['core/app.js', 'docs/core/app.js'],
  ['tabs/xml-cii-2019-standalone-tab.js', 'docs/tabs/xml-cii-2019-standalone-tab.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-client.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-client.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js'],
  ['tabs/xml-cii-2019-standalone/workers/master-dataset-service.js', 'docs/tabs/xml-cii-2019-standalone/workers/master-dataset-service.js'],
  ['tabs/xml-cii-2019-standalone/workers/weight-basis-service.js', 'docs/tabs/xml-cii-2019-standalone/workers/weight-basis-service.js'],
];
for (const [runtimePath, docsPath] of mirrorPairs) {
  assert.equal(await read(docsPath), await read(runtimePath), `docs mirror drift: ${runtimePath}`);
}

console.log('Issue #781 post-merge screenshot acceptance regressions verified.');
