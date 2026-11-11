import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function source(path) {
  return readFile(resolve(ROOT, path), 'utf8');
}

test('production freeze Chromium journey is benchmarked step-by-step and records screenshots', async () => {
  const browser = await source('scripts/validate-vibration-production-freeze-browser.mjs');
  assert.match(browser, /VibrationProductionFreezeReceipt\.v1/u);
  assert.match(browser, /EI-D2-FIT-RECYCLE-SUCTION-6IN/u);
  assert.match(browser, /expectedStandardLof/u);
  assert.match(browser, /standardLofTolerance/u);
  assert.match(browser, /EI-D2\.4-MECHANICAL-EXCITATION/u);
  assert.match(browser, /VIB-MECH-PROC-ORACLE-01/u);
  assert.match(browser, /mechanical-t23-direct-screening-qualification-v1\.json/u);
  assert.match(browser, /expectedGoverningLof/u);
  assert.match(browser, /mechanicalScreeningAuthority:\s*MECHANICAL_SCREENING_AUTHORITY/u);
  assert.match(browser, /mechanicalAuthorityScope:\s*MECHANICAL_AUTHORITY_SCOPE/u);
  assert.match(browser, /sharedSupportTransferAuthorized:\s*false/u);
  assert.match(browser, /dynamicReductionAuthorized:\s*false/u);
  assert.match(browser, /designAuthority:\s*false/u);
  assert.doesNotMatch(browser, /candidateMayReplaceScreeningGoverning/u);
  assert.match(browser, /auditTrailIdentity/u);
  assert.match(browser, /event\.eventType === 'RUN_EVIDENCE_EXPORT_STARTED'/u);
  for (const screenshot of [
    '01-workspace.png',
    '02-benchmark-loaded.png',
    '03-readiness.png',
    '04-fit-result.png',
    '05-mechanical-result.png',
    '06-governing-matrix.png',
    '07-evidence-exported.png',
    '99-failure.png',
  ]) assert.match(browser, new RegExp(screenshot.replaceAll('.', '\\.'), 'u'));
});

test('CI uploads Chromium screenshots and production-freeze receipt even when validation fails', async () => {
  const workflow = await source('.github/workflows/vibration-mechanical-stage4-validation.yml');
  assert.match(workflow, /validate-vibration-production-freeze-browser\.mjs/u);
  assert.match(workflow, /VIBRATION_FREEZE_ARTIFACT_DIR/u);
  assert.match(workflow, /actions\/upload-artifact@v4/u);
  assert.match(workflow, /artifacts\/vibration-production-freeze/u);
  assert.match(workflow, /if:\s*always\(\)/u);
});

test('CI has a qualification-branch push fallback when pull-request event delivery is unavailable', async () => {
  const workflow = await source('.github/workflows/vibration-mechanical-stage4-validation.yml');
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*qual\/vibration-stage4-\*/u);
  assert.match(workflow, /push:[\s\S]*paths:[\s\S]*tests\/vibration-\*\*/u);
  assert.match(workflow, /workflow_dispatch:/u);
});
