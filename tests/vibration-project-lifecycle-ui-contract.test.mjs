import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as projectSchema from '../converters/vibration/project/schema.js';
import { resolveVibrationProjectSchemaApi } from '../tabs/vibration-project-schema-compat.js';

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
  assert.match(text, /attachVibrationProjectLifecycleLedgersCompat\(currentProject, handoff\)/u);
  assert.doesNotMatch(text, /from ['"]\.\.\/converters\/vibration\/project\/schema\.js['"]/u);
  assert.match(text, /VIBRATION_PROJECT_LIFECYCLE_PROJECT_MISMATCH/u);
  assert.match(text, /applyLifecycleHandoff,/u);
  const lifecycleFunction = text.slice(
    text.indexOf('function applyLifecycleHandoff'),
    text.indexOf('function clearNavigationDiagnostic'),
  );
  assert.doesNotMatch(lifecycleFunction, /selectedLineId\s*=\s*currentProject\.subjects\.lines\[0\]/u);
  assert.match(lifecycleFunction, /screening|engineering calculation authority is unchanged/iu);
});

test('lifecycle schema compatibility adapter resolves current APIs and fails closed for stale surfaces', async () => {
  assert.equal(
    resolveVibrationProjectSchemaApi(projectSchema, 'vibrationProjectLifecycleLedgers'),
    projectSchema.vibrationProjectLifecycleLedgers,
  );
  assert.equal(
    resolveVibrationProjectSchemaApi(projectSchema, 'attachVibrationProjectLifecycleLedgers'),
    projectSchema.attachVibrationProjectLifecycleLedgers,
  );
  assert.throws(
    () => resolveVibrationProjectSchemaApi({}, 'vibrationProjectLifecycleLedgers'),
    (error) => error?.code === 'VIBRATION_PROJECT_SCHEMA_LIFECYCLE_API_UNAVAILABLE'
      && error?.details?.apiName === 'vibrationProjectLifecycleLedgers',
  );
  const adapter = await source('tabs/vibration-project-schema-compat.js');
  assert.match(adapter, /import \* as projectSchema from ['"]\.\.\/converters\/vibration\/project\/schema\.js\?v=20260903-pr720-lifecycle-schema-1['"]/u);
});

test('lifecycle handoff no longer named-imports post-PR720 lifecycle APIs from project schema', async () => {
  const text = await source('tabs/vibration-project-lifecycle-handoff.js');
  assert.match(text, /vibrationProjectLifecycleLedgersCompat\(validated\)/u);
  assert.doesNotMatch(text, /from ['"]\.\.\/converters\/vibration\/project\/schema\.js['"]/u);
});
