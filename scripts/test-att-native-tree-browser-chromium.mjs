#!/usr/bin/env node
/**
 * Independent browser interaction oracle for native TXT hierarchy UX.
 * Generates only synthetic TXT data. Never claims to replay Owner's private AML.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { join, resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.cwd());
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main id="app">TXT selector browser test</main></body></html>');
      return;
    }
    const filename = resolve(root, '.' + pathname);
    if (!filename.startsWith(root + sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const s = await stat(filename);
    if (!s.isFile()) throw new Error('not a file');
    const body = await readFile(filename);
    res.writeHead(200, {
      'content-type': extname(filename) === '.js' ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(404); res.end('Not found: ' + error.message);
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const input = [];
function record(type, name, owner) {
  input.push('NEW ' + name, 'NAME:= ' + name, 'TYPE:= ' + type, 'OWNER:= ' + owner, 'END');
}
for (let site = 0; site < 18; site++) {
  const name = '/SITE-' + site;
  record('SITE', name, '/*');
  for (let zone = 0; zone < (site < 12 ? 11 : 10); zone++) {
    record('ZONE', name + '/ZONE-' + zone, name);
  }
}
for (let n = 0; n < 105000; n++) {
  record('EQUI', '/SITE-0/ZONE-0/E' + n, '/SITE-0/ZONE-0');
}
record('PIPE', '/ASIM-1885-PL-PIPE-7', '/SITE-0/ZONE-0');
record('BRAN', '/ASIM-1885-PL-PIPE-7/B1', '/ASIM-1885-PL-PIPE-7');
record('SPINE', '/ORPHAN', '/MISSING-OWNER');
const text = input.join('\n');
assert.ok(text.length > 7_000_000, '105k-record synthetic text unexpectedly short');
const jsErrors = [];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1250, height: 850 } });
  page.on('pageerror', error => jsErrors.push(error.message));
  await page.goto('http://127.0.0.1:' + port + '/');
  const start = performance.now();
  await page.evaluate(async sourceText => {
    const module = await import('/tabs/model-converters/att-native-scope-popup.js');
    window.__popupDone = null;
    module.openAttNativeScopePopup('synthetic-only.txt', new TextEncoder().encode(sourceText))
      .then(value => { window.__popupDone = value; })
      .catch(error => { window.__popupError = error.message; });
  }, text);
  await page.locator('[data-native-rows] [data-row]').first().waitFor({ state: 'visible', timeout: 120000 });
  const firstTreeMs = Math.round(performance.now() - start);
  const stats = await page.locator('[data-native-stats]').textContent();
  assert.match(stats, /105,213 native TXT records/);
  assert.match(stats, /18 Sites/);
  assert.match(stats, /192 Zones/);
  assert.equal(await page.locator('[data-row="/SITE-0"]').count(), 1);
  assert.equal(await page.locator('[data-row="/SITE-0/ZONE-0"]').count(), 1);
  assert.equal(await page.locator('[data-reveal]').count(), 0);
  assert.equal(await page.locator('[data-native-prev]').count(), 0);
  assert.equal(await page.locator('[data-native-next]').count(), 0);
  let maxRows = await page.locator('[data-native-rows] [data-row]').count();
  assert.ok(maxRows <= 120);
  await page.locator('[data-check="/SITE-0/ZONE-0"]').check();
  assert.match(await page.locator('[data-native-selection]').textContent(), /1 Zones/);
  assert.match(await page.locator('[data-native-chips]').textContent(), /\/SITE-0\/ZONE-0/);
  await page.locator('[data-native-search]').fill('/SITE-0/ZONE-0/E99999');
  await page.waitForFunction(() => document.querySelector('[data-native-matches]')?.textContent?.includes('1 matches'));
  const contextualRows = await page.locator('[data-native-rows] [data-row]').evaluateAll(all =>
    all.map(row => row.getAttribute('data-row')));
  assert.deepEqual(contextualRows, ['/SITE-0', '/SITE-0/ZONE-0', '/SITE-0/ZONE-0/E99999']);
  assert.match(await page.locator('[data-native-chips]').textContent(), /\/SITE-0\/ZONE-0/);
  maxRows = Math.max(maxRows, contextualRows.length);
  await page.locator('[data-native-search]').fill('/ASIM-1885-CU-PL');
  await page.waitForFunction(() => document.querySelector('[data-native-matches]')?.textContent?.includes('0 matches'));
  assert.match(await page.locator('[data-native-rows]').textContent(), /No matching Site, Zone or component in this loaded TXT/);
  await page.locator('[data-native-search]').fill('');
  await page.waitForFunction(() => document.querySelector('[data-native-matches]')?.textContent?.includes('tree rows'));
  await page.locator('[data-expand="/SITE-0/ZONE-0"]').click();
  const viewport = page.locator('[data-native-rows]');
  await viewport.evaluate(element => {
    element.scrollTop = 100001 * 32;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.locator('[data-row="/SITE-0/ZONE-0/E99999"]').waitFor({ state:'attached', timeout:30000 });
  maxRows = Math.max(maxRows, await page.locator('[data-native-rows] [data-row]').count());
  assert.ok(maxRows <= 120, 'Never mount all records or truncate underlying source');
  await page.locator('[data-check="/SITE-0/ZONE-0/E99999"]').uncheck();
  assert.match(await page.locator('[data-native-chips]').textContent(), /E99999/);
  assert.match(await page.locator('[data-native-selection]').textContent(), /TXT objects selected/);
  await page.locator('[data-native-clear]').click();
  assert.match(await page.locator('[data-native-selection]').textContent(), /0 TXT objects selected/);
  assert.equal(await page.locator('[data-native-confirm]').isDisabled(), true);
  await page.locator('[data-native-cancel]').click();
  assert.equal(await page.locator('[data-native-rows]').count(), 0);
  const finished = await page.evaluate(() => ({ done: window.__popupDone, error: window.__popupError }));
  assert.deepEqual(finished.done, { cancelled: true });
  assert.equal(finished.error, undefined);
  assert.deepEqual(jsErrors,[]);
  // Independent full-scope action oracle: first dismissal keeps the popup,
  // explicit acceptance converts the entire loaded TXT without selected scope.
  await page.evaluate(async sourceText => {
    const module = await import('/tabs/model-converters/att-native-scope-popup.js');
    window.__popupDone = null;
    module.openAttNativeScopePopup('synthetic-only.txt', new TextEncoder().encode(sourceText))
      .then(value => { window.__popupDone = value; })
      .catch(error => { window.__popupError = error.message; });
  }, text);
  await page.locator('[data-native-full]').waitFor({ state:'visible', timeout:120000 });
  page.once('dialog', dialog => {
    assert.match(dialog.message(), /ENTIRE loaded TXT\/ATT file/);
    return dialog.dismiss();
  });
  await page.locator('[data-native-full]').click();
  assert.equal(await page.locator('[data-native-rows]').count(), 1,
    'Dismissing full-file confirmation must keep selection dialog open');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-native-full]').click();
  await page.waitForFunction(() => window.__popupDone?.nativeScope?.mode === 'FULL');
  const fullAction = await page.evaluate(() => window.__popupDone);
  assert.deepEqual(fullAction.selectedIds, []);
  assert.equal(fullAction.nativeScope.mode, 'FULL');
  assert.equal(await page.locator('[data-native-rows]').count(), 0);
  const heapUsed = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
  console.log('TXT_CHROMIUM_UX_PASS ' + JSON.stringify({
    indexedSourceRecords: 105213, sites: 18, zones: 192, renderedRowMaximum: maxRows,
    firstTreeMs, chromiumHeapBytes: heapUsed,
    searchInContext: true, missingSourceIdNoFabrication: true, stableSelection: true,
    browserScriptErrors: jsErrors.length, fullFileConfirmGuard: true,
    evidenceScope: 'SYNTHETIC_CHROMIUM_ONLY_REAL_OWNER_90MB_FILE_NOT_REPLAYED',
  }));
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
