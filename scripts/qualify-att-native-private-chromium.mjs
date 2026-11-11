#!/usr/bin/env node
/**
 * Local-only Chromium source-reality qualification for the loaded TXT/ATT file.
 * No Navisworks/NWD or binary RVM file is needed. Never commits/uploads source.
 *
 * node scripts/qualify-att-native-private-chromium.mjs /private/AML_2026Oct06-1417.txt
 * node scripts/qualify-att-native-private-chromium.mjs --synthetic  # CI smoke; NOT real acceptance
 *
 * From the checked-out 3D_Converters repo; requires local "playwright" and Chromium.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const EXPECTED = Object.freeze({
  sha256: '1c1702d3a352c9f62f0b85f41c8185d2a64501e75fcd85c94a0662efad1853f5',
  bytes: 90852184, typed: 105601, sites: 18, zones: 192,
  zone: '/ASIM-1835-CU-CI-FDNS',
  search: 'FDNS',
});
const synthetic = process.argv.length === 3 && process.argv[2] === '--synthetic';
const inputPath = !synthetic && process.argv.length === 3 ? resolve(process.argv[2]) : null;
if (!synthetic && !inputPath) {
  console.error('Usage: node scripts/qualify-att-native-private-chromium.mjs /private/AML.txt | --synthetic');
  process.exit(2);
}
const root = resolve(process.cwd());
const sourceFiles = new Map([
  ['/tabs/model-converters/att-native-scope-popup.js', 'tabs/model-converters/att-native-scope-popup.js'],
  ['/tabs/model-converters/att-native-hierarchy-index.js', 'tabs/model-converters/att-native-hierarchy-index.js'],
  ['/tabs/model-converters/att-native-scope-selection.js', 'tabs/model-converters/att-native-scope-selection.js'],
  ['/tabs/model-converters/att-native-tree-browser.js', 'tabs/model-converters/att-native-tree-browser.js'],
]);
const mock = [];
if (synthetic) {
  const add = (type, name, owner) => mock.push(
    'NEW ' + name, 'NAME:= ' + name, 'TYPE:= ' + type, 'OWNER:= ' + owner, 'END',
  );
  add('SITE', '/SYNTH-SITE-A', '/*');
  add('ZONE', '/SYNTH-SITE-A/Z1', '/SYNTH-SITE-A');
  add('ZONE', '/SYNTH-SITE-A/Z2', '/SYNTH-SITE-A');
  add('SITE', '/SYNTH-SITE-B', '/*');
  add('ZONE', '/SYNTH-SITE-B/Z3', '/SYNTH-SITE-B');
  for (let i = 0; i < 2400; ++i) add('EQUI', '/SYNTH-SITE-A/Z1/E' + i, '/SYNTH-SITE-A/Z1');
}
const report = {
  evidenceScope: synthetic ? 'SYNTHETIC_CI_ONLY_NOT_REAL_AML' : 'HASH_VERIFIED_OWNER_REAL_TXT_IN_CHROMIUM',
  fileSha256: null, bytes: null, totalIndexed: null, siteCount: null, zoneCount: null,
  firstTreeMs: null, maxMountedRows: 0, heapBytes: null,
  searchAncestry: false, selectedHiddenDescendants: false, noBrowserErrors: false,
};
if (!synthetic) {
  const size = (await stat(inputPath)).size;
  assert.equal(size, EXPECTED.bytes, 'The fixture is not the frozen owner TXT (size mismatch).');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(inputPath)) hash.update(chunk);
  const sha = hash.digest('hex');
  assert.equal(sha, EXPECTED.sha256, 'The fixture is not the frozen owner TXT (SHA mismatch).');
  report.fileSha256 = sha;
  report.bytes = size;
}
const sample = Buffer.from(mock.join('\n'), 'utf8');
if (synthetic) {
  report.fileSha256 = createHash('sha256').update(sample).digest('hex');
  report.bytes = sample.byteLength;
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>');
  } else if (url.pathname === '/input.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    if (synthetic) res.end(sample);
    else createReadStream(inputPath).pipe(res);
  } else if (sourceFiles.has(url.pathname)) {
    try {
      const body = await readFile(join(root, sourceFiles.get(url.pathname)));
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Required exact-checkout source module unavailable.');
    }
  } else {
    res.writeHead(404);
    res.end('Not found.');
  }
});
let browser;
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
try {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const base = 'http://127.0.0.1:' + server.address().port;
  await page.goto(base);
  const t0 = performance.now();
  await page.evaluate(async () => {
    const [module, response] = await Promise.all([
      import('/tabs/model-converters/att-native-scope-popup.js'),
      fetch('/input.txt', { cache: 'no-store' }),
    ]);
    if (!response.ok) throw new Error('Failed to load source TXT.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    window.__nativeDone = null;
    window.__nativeError = null;
    module.openAttNativeScopePopup('Loaded TXT source', bytes)
      .then(result => { window.__nativeDone = result; })
      .catch(err => { window.__nativeError = err.message; });
  });
  await page.locator('[data-native-rows] [data-row]').first().waitFor({ state: 'visible', timeout: 180000 });
  report.firstTreeMs = Math.round(performance.now() - t0);
  const stats = await page.locator('[data-native-stats]').innerText();
  if (synthetic) {
    assert.match(stats, /2 Sites/); assert.match(stats, /3 Zones/);
    report.totalIndexed = 2405; report.siteCount = 2; report.zoneCount = 3;
  } else {
    assert.match(stats, /105,601 native TXT records/);
    assert.match(stats, /18 Sites/); assert.match(stats, /192 Zones/);
    report.totalIndexed = EXPECTED.typed;
    report.siteCount = EXPECTED.sites; report.zoneCount = EXPECTED.zones;
  }
  const limit = 120;
  const rows = page.locator('[data-native-rows] [data-row]');
  report.maxMountedRows = await rows.count();
  assert.ok(report.maxMountedRows <= limit);
  assert.equal(await page.locator('[data-reveal], [data-native-prev], [data-native-next]').count(), 0);
  const zoneId = synthetic ? '/SYNTH-SITE-A/Z1' : EXPECTED.zone;
  const term = synthetic ? 'E2399' : EXPECTED.search;
  await page.locator('[data-native-search]').fill(term);
  await page.waitForFunction(() => {
    const matches = document.querySelector('[data-native-matches]')?.textContent || '';
    return matches.includes('matches') && !matches.includes('0 matches');
  }, null, { timeout: 180000 });
  const context = await rows.evaluateAll(nodes => nodes.map(n => ({
    name: n.getAttribute('data-row'), level: Number(n.getAttribute('aria-level')),
  })));
  assert.ok(context.some(x => x.name === zoneId), 'Actual searched child must be shown under real native zone.');
  assert.ok(context.some(x => x.level > 1), 'Search must preserve ancestor hierarchy.');
  report.searchAncestry = true;
  await page.locator('[data-native-search]').fill('');
  await page.waitForFunction(() => document.querySelector('[data-native-matches]')?.textContent?.includes('tree rows'));
  await page.locator('[data-check="' + zoneId + '"]').check();
  const summary = await page.locator('[data-native-selection]').innerText();
  assert.match(summary, /TXT objects selected/);
  assert.match(await page.locator('[data-native-chips]').innerText(), /ZONE/);
  report.selectedHiddenDescendants = true;
  await page.locator('[data-expand="' + zoneId + '"]').click();
  const viewport = page.locator('[data-native-rows]');
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight * 0.75; el.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(250);
  report.maxMountedRows = Math.max(report.maxMountedRows, await rows.count());
  assert.ok(report.maxMountedRows <= limit, 'DOM row limit is a rendering bound, never a source bound.');
  await page.locator('[data-native-cancel]').click();
  await page.waitForFunction(() => window.__nativeDone?.cancelled === true || window.__nativeError);
  const result = await page.evaluate(() => ({ result: window.__nativeDone, error: window.__nativeError,
    heap: performance.memory?.usedJSHeapSize ?? null }));
  assert.equal(result.error, null);
  assert.equal(result.result?.cancelled, true);
  assert.deepEqual(errors, []);
  report.noBrowserErrors = true;
  report.heapBytes = result.heap;
  const label = synthetic ? 'ATT_NATIVE_SYNTHETIC_BROWSER_PASS' : 'ATT_NATIVE_REAL_AML_BROWSER_PASS';
  console.log(label + ' ' + JSON.stringify(report));
  await page.close();
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
