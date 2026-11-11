import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../scripts/validate-hp-piping-class-product-matrix-browser.mjs', import.meta.url), 'utf8');

test('companion runner uses Chromium CDP without browser-test dependencies', () => {
  for (const token of ['--remote-debugging-port=0', 'DevToolsActivePort', 'new WebSocket(url)', 'Runtime.evaluate']) assert.ok(source.includes(token));
  assert.doesNotMatch(source, /playwright|puppeteer/);
});

test('source gate proves the real HP product-bulk route and composition', () => {
  for (const token of ['hp-piping-class-product-bulk-workbench-tab.js', 'hp-piping-class-product-bulk-input.js', 'hp-piping-class-kd-bulk-workbench-tab', 'previewHpPipingClassProductBulkInput', 'applyHpPipingClassProductBulkInput']) assert.ok(source.includes(token));
});

test('full-app journey contains exact two-product intake and preview hand checks', () => {
  for (const token of ['NPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0', 'NPS6-XXS,NPS 6,168.3,138,18.26,12.5,3,0', '11.80375', '8.80375', '15.97750', '12.97750', 'Product matrix valid.', 'Product matrix applied.']) assert.ok(source.includes(token));
});

test('project custody checks preserve NPS4 fatigue and review-only authority', () => {
  for (const token of ['format-converters.hpPipingClass.project.v2', "project.fatigueEvidence.some", 'nativeCoreKd3Qualified,false', 'codeCompliance,false', 'canUseForDesignAuthority,false']) assert.ok(source.replaceAll(' ', '').includes(token.replaceAll(' ', '')));
});

test('full-app result chain verifies NPS6 pressure rating and two rows', () => {
  for (const token of ['23.08612', '23.11423', '0.050000', '63.299496', "querySelectorAll('.hpwb-class-result-table tbody tr').length", 'NO DESIGN AUTHORITY']) assert.ok(source.includes(token));
});

test('result roundtrip and both exports are exercised', () => {
  for (const token of ['verify-roundtrip', 'export-csv', 'export-json', '.hp-review-results.csv', '.hp-review-results.json']) assert.ok(source.includes(token));
});

test('stale-result falsifier edits the second imported product', () => {
  assert.ok(source.includes('products.1.calculationBasis.nominalWallMm'));
  assert.ok(source.includes("[data-hpwb-production-results]"));
  assert.ok(source.includes('18.27'));
  assert.ok(source.includes('18.26'));
});

test('mobile qualification checks result and product matrix tables independently', () => {
  for (const token of ['width:375,height:900', '.hpwb-class-result-table', '.hpwb-product-bulk-preview-table', 'overflow<=2', 'local,true']) assert.ok(source.replaceAll(' ', '').includes(token.replaceAll(' ', '')));
});

test('receipt cannot promote engineering authority and only FULL_APP sets qualified true', () => {
  assert.ok(source.includes('HpPipingClassProductMatrixBrowserReceipt.v1'));
  assert.ok(source.includes("productMatrixFullAppQualified:false"));
  assert.ok(source.includes('receipt.productMatrixFullAppQualified=true'));
  assert.ok(source.includes("numericalAuthority:'UNCHANGED'"));
});
