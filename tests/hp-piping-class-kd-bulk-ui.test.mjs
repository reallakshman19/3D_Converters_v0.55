import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../tabs/hp-piping-class-kd-bulk-workbench-tab.js', import.meta.url), 'utf8');

test('wrapper injects one collapsed bulk Seq-N editor into existing KD product cards', () => {
  assert.match(source, /renderBaseWorkbench/);
  assert.match(source, /Paste \/ import Seq-N table/);
  assert.match(source, /data-hpwb-kd-bulk=/);
  assert.match(source, /data-hpwb-kd-bulk-file=/);
  assert.match(source, /Load CSV \/ TSV/);
  assert.match(source, /Validate table/);
  assert.match(source, /Apply \+ calculate/);
  assert.match(source, /HP_PIPING_CLASS_KD_BULK_HEADERS\.join\(','\)/);
});

test('wrapper validates before touching existing row bindings and calculates through the base UI', () => {
  assert.match(source, /previewHpPipingClassKdBulkInput\(project, evidenceIndex, text\)/);
  assert.match(source, /if \(!preview\.ok\).*return/s);
  assert.match(source, /assignmentsForRows/);
  assert.match(source, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(source, /data-hpwb-action="calculate"/);
});

test('wrapper preserves explicit project context until the base project is actually mutated', () => {
  assert.match(source, /contextProject = options\?\.context\?\.hpPipingClassProject/);
  assert.match(source, /function currentProject\(\)/);
  assert.match(source, /contextProject\s*=\s*null/);
});

test('wrapper preserves audit separation and does not replace the existing workbench controller', () => {
  assert.match(source, /Audit basis stays separate/);
  assert.doesNotMatch(source, /createHpPipingClassWorkspaceController/);
  assert.doesNotMatch(source, /nativeCoreKd3Qualified\s*=\s*true/);
  assert.doesNotMatch(source, /codeCompliance\s*=\s*true/);
});

test('active wrapper adds production-review readiness without converting advisories into blockers', () => {
  assert.match(source, /validateHpPipingClassProject\(project, \{ validationPolicy: 'PRODUCTION_REVIEW' \}\)/);
  assert.match(source, /renderHpPipingClassProductionReadinessHtml/);
  assert.match(source, /hpwbProductionReadiness/);
  assert.match(source, /injectProductionReview/);
});

test('detailed result ledger is refreshed only from the canonical evaluator after explicit calculation actions', () => {
  assert.match(source, /evaluateHpPipingClassProject\(project, \{ includeEvidence: true \}\)/);
  assert.match(source, /baseAction === 'calculate'/);
  assert.match(source, /refreshLatestReview\(\)/);
  assert.match(source, /renderHpPipingClassProductionResultHtml\(latestReview, resultView\)/);
  assert.match(source, /hpwbProductionResults/);
  assert.match(source, /clearReview\(\)/);
});

test('result export is generated from the same latest review and is round-trip verified before download', () => {
  assert.match(source, /buildHpPipingClassResultExport\(latestReview\)/);
  assert.match(source, /verifyHpPipingClassResultRoundTrip\(bundle\)/);
  assert.match(source, /if \(!verified\.ok\) return/);
  assert.match(source, /serializeHpPipingClassResultCsv\(bundle\)/);
  assert.match(source, /serializeHpPipingClassResultJson\(bundle\)/);
  assert.match(source, /data-hpwb-result-action/);
});

test('matrix filter and sort state do not mutate project engineering state', () => {
  assert.match(source, /resultView = \{ filter: 'all', sortBy: 'reviewPriority', roundTrip: null \}/);
  assert.match(source, /data-hpwb-result-filter/);
  assert.match(source, /data-hpwb-result-sort/);
  assert.match(source, /resultView\.filter = event\.target\.value/);
  assert.match(source, /resultView\.sortBy = event\.target\.value/);
  assert.doesNotMatch(source, /methodManifest\.codeCompliance\s*=\s*true/);
});
