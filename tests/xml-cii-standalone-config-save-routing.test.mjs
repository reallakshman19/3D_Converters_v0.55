import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/', import.meta.url);
const ACTIVE_SAVE_FILES = [
  'xml-cii-adapted-config.js',
  'xml-cii-adapted-bend-radius-toggle.js',
  'xml-cii-adapted-preview-diagnostics-audit-v7.js',
  'xml-cii-adapted-weight-match-v2.js',
  'xml-cii-adapted-support-type-mapper.js',
  'xml-cii-adapted-run-workflow-atta-default.js',
];

async function source(name) {
  return readFile(new URL(name, ROOT), 'utf8');
}

test('all active authoritative config-save surfaces route through updateWorkflowState', async () => {
  for (const name of ACTIVE_SAVE_FILES) {
    const text = await source(name);
    assert.match(text, /updateWorkflowState/, `${name} must reference the central workflow-state boundary`);
    assert.doesNotMatch(text, /stateRef\.current\.supportConfigJson\s*=/, `${name} must not assign supportConfigJson directly`);
    assert.doesNotMatch(text, /stateRef\.current\s*=\s*\{[^\n]*supportConfigJson/, `${name} must not replace state with inline supportConfigJson`);
    assert.match(text, /JSON\.stringify\([^\n]*null, 2\)/, `${name} must preserve pretty-printed config serialization`);
    assert.match(text, /saveMasterContextToLocalStorage/, `${name} must preserve master-context persistence`);
  }
});

test('active run review routes both rating-refresh and rigid-weight saves', async () => {
  const text = await source('xml-cii-adapted-run-workflow-atta-default.js');
  const configRoutes = [...text.matchAll(/updateWorkflowState\(current, \{\s*supportConfigJson:/g)];
  assert.equal(configRoutes.length, 2, 'Run review has two independent authoritative config-save points');
  assert.match(text, /config\.overrides\.rating/);
  assert.match(text, /rigidWeight/);
});

test('preview report-only state update remains separate from config authority', async () => {
  const text = await source('xml-cii-adapted-preview-diagnostics-audit-v7.js');
  assert.match(text, /b313WallUpdateReport: report/);
  assert.match(text, /const routed = updateWorkflowState\(stateRef\.current, \{/);
});


test('active Mode-A state boundary routes replacement payloads through central dependency custody', async () => {
  const text = await source('xml-cii-adapted-mode-a-state.js');
  assert.match(text, /routeModeADependencyState/);
  assert.match(text, /updateWorkflowState\(previous, replacement\)/);
  assert.match(text, /dependencyRevisions: routed\.dependencyRevisions/);
  assert.match(text, /dependencyRevisionBasis: routed\.dependencyRevisionBasis/);
  assert.match(text, /const replacement = next\?\.__modeAReplace === true/);
});
