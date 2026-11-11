import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('engineering console passes project lifecycle custody into FIT and persists emitted lifecycle changes', async () => {
  const text = await source('tabs/engineering-calculations-tab.js');
  assert.match(text, /createVibrationProjectLifecycleHandoff\(\{ project: initialProject \}\)/u);
  assert.match(text, /projectLifecycleHandoff:\s*state\.projectLifecycleHandoff/u);
  assert.match(text, /VIBRATION_PROJECT_LIFECYCLE_CHANGED_EVENT/u);
  assert.match(text, /roadmapController\.applyLifecycleHandoff\(event\.detail\?\.handoff \?\? null\)/u);
  assert.match(text, /dispatchProjectEvidenceHandoff\(\);\s*dispatchProjectLifecycleHandoff\(\);/u);
});

test('vibration workspace restores project lifecycle custody and publishes only changed ledgers', async () => {
  const text = await source('tabs/vibration-integrity-tab.js');
  assert.match(text, /projectLifecycleHandoff = null/u);
  assert.match(text, /applyLifecycleHandoffToState\(state, projectLifecycleHandoff\)/u);
  assert.match(text, /resetLifecycleStateForProject\(state, projectId\)/u);
  assert.match(text, /lifecycleRefsChanged\(before, state\)/u);
  assert.match(text, /VIBRATION_PROJECT_LIFECYCLE_CHANGED_EVENT/u);
  assert.match(text, /bubbles:\s*true/u);
  assert.match(text, /VIBRATION_PROJECT_LIFECYCLE_HANDOFF_EVENT/u);
});

test('roadmap project controller persists lifecycle custody without resetting selected line', async () => {
  const text = await source('tabs/vibration-roadmap-controller.js');
  assert.match(text, /attachVibrationProjectLifecycleLedgers\(currentProject, handoff\)/u);
  assert.match(text, /VIBRATION_PROJECT_LIFECYCLE_PROJECT_MISMATCH/u);
  assert.match(text, /applyLifecycleHandoff,/u);
  const lifecycleFunction = text.slice(
    text.indexOf('function applyLifecycleHandoff'),
    text.indexOf('function clearNavigationDiagnostic'),
  );
  assert.doesNotMatch(lifecycleFunction, /selectedLineId\s*=\s*currentProject\.subjects\.lines\[0\]/u);
  assert.match(lifecycleFunction, /screening|engineering calculation authority is unchanged/iu);
});
