import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../scripts/validate-hp-piping-class-production-browser.mjs', import.meta.url), 'utf8');

test('browser runner is dependency-free and drives Chromium through CDP', () => {
  assert.match(source, /--remote-debugging-port=0/);
  assert.match(source, /DevToolsActivePort/);
  assert.match(source, /new WebSocket\(url\)/);
  assert.match(source, /Runtime\.evaluate/);
  assert.doesNotMatch(source, /from ['"]playwright['"]/);
  assert.doesNotMatch(source, /from ['"]puppeteer['"]/);
});

test('full-app mode opens the routed HP production surface', () => {
  assert.ok(source.includes('[data-tab="engineering-calculations"]'));
  assert.ok(source.includes('[data-engineering-subtab="hp-piping-class"]'));
  assert.ok(source.includes('[data-hp-piping-class-workbench="true"]'));
  assert.match(source, /NPS4_S160_PRESSURE_FATIGUE_REGRESSION/);
});

test('full-app journey covers states cycles and governed Seq-N bulk application', () => {
  assert.ok(source.includes('[data-hpwb-goto="cycles"]'));
  assert.ok(source.includes('[data-hpwb-goto="kd"]'));
  assert.match(source, /cycle_id,location_id,user_salt_mpa,seq_mpa,permissible_cycles/);
  assert.ok(source.includes('[data-hpwb-kd-bulk-action="validate"]'));
  assert.ok(source.includes('[data-hpwb-kd-bulk-action="apply"]'));
});

test('result qualification checks numerical ledger filter sort roundtrip and export', () => {
  for (const token of [
    '23.08612', '1.154306', '0.050000', '63.299496',
    'data-hpwb-result-filter', 'data-hpwb-result-sort',
    'verify-roundtrip', 'export-csv', 'export-json',
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('stale result invalidation is a first-class browser assertion', () => {
  assert.match(source, /Engineering edit invalidates stale review\/export result/);
  assert.match(source, /products\.0\.calculationBasis\.nominalWallMm/);
  assert.match(source, /Boolean\(document\.querySelector\('\[data-hpwb-production-results\]'\)\)/);
});

test('mobile qualification requires document containment and table-local horizontal scroll', () => {
  assert.match(source, /Emulation\.setDeviceMetricsOverride/);
  assert.match(source, /width: 375, height: 900/);
  assert.match(source, /bodyOverflow <= 2/);
  assert.match(source, /wrapperScrolls/);
});

test('receipt distinguishes full app, source injection and transport self-test', () => {
  assert.match(source, /executedMode = 'FULL_APP'/);
  assert.match(source, /executedMode = 'SOURCE_INJECTION'/);
  assert.match(source, /executedMode = 'SELF_TEST_ONLY'/);
  assert.match(source, /fullActiveWorkbenchNavigation: false/);
});

test('browser receipt cannot promote engineering authority', () => {
  assert.match(source, /nativeCoreKd3Qualified: false/);
  assert.match(source, /codeCompliance: false/);
  assert.match(source, /canUseForDesignAuthority: false/);
  assert.match(source, /numericalAuthority: 'UNCHANGED'/);
});
