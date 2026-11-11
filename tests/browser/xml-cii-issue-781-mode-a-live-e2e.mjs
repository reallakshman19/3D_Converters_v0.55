import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegexTesterConfig } from '../../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixturePath = path.resolve(process.env.XML_CII_41_BRANCH_FIXTURE
  || path.join(root, 'Benchmarks', 'EF-05-PRO.TEST.xml'));
const weightMasterPath = path.join(root, 'docs', 'Masters', 'wtValveweights.xlsx');
const release = '20261001-weight-rating-1';
const fixture = await readFile(fixturePath, 'utf8');
assert.equal((fixture.match(/<Branch(?:\s|>)/gi) || []).length, 41);
assert.equal((fixture.match(/<Node(?:\s|>)/gi) || []).length, 1654);

function contentType(file) {
  return ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = route.endsWith('/') ? `${route}index.html` : route;
    const target = path.resolve(root, `.${relative}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(404);
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const modules = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => { if (request.url().includes('/docs/tabs/')) modules.push(request.url()); });

  const stale = createDefaultRegexTesterConfig();
  stale.formats[0].lineKey.tokenPosition = '3';
  stale.formats[0].bore.tokenPosition = '3';
  await page.addInitScript((json) => localStorage.setItem('xml-cii-regex-config-v1', json), JSON.stringify(stale));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/`, { waitUntil: 'domcontentloaded' });
  const seeded = await page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-regex-config-v1')));
  assert.equal(seeded.formats[0].lineKey.tokenPosition, '3', 'The stale Line Key fixture was not seeded');
  assert.equal(seeded.formats[0].bore.tokenPosition, '3', 'The Bore fixture was not seeded');
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  assert.match(await page.locator('body').innerText(), /Branches:\s*41\/41/);

  await page.getByRole('button', { name: /Piping Class/ }).last().click();
  await page.locator('input[data-master-file="pipingClass"]').setInputFiles({
    name: 'issue781-acceptance-piping.csv', mimeType: 'text/csv',
    buffer: Buffer.from('PipingClass,Material\n31441C4,ASTM A106-B\n'),
  });
  await page.locator('[data-master-mapping-status="pipingClass"]')
    .filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /Line List/ }).last().click();
  await page.locator('input[data-master-file="lineList"]').setInputFiles({
    name: 'issue781-acceptance-lines.csv', mimeType: 'text/csv',
    buffer: Buffer.from('lineKey1,lineKey2\nP,8810021\n'),
  });
  await page.locator('[data-master-mapping-status="lineList"]')
    .filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /Valve Weights/ }).click();
  await page.locator('input[data-master-file="weight"]').setInputFiles(weightMasterPath);
  await page.locator('[data-master-mapping-status="weight"]')
    .filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /2 Regex Tester/ }).click();
  const builder = page.locator('.xml-cii-regex-rule-card').first();
  const line = builder.locator('button[title="Toggle in Line Key"]').nth(2);
  const bore = builder.locator('button[title="Set as Bore"]').nth(2);
  assert.equal(await line.count(), 1, 'Token #3 Line Key control is missing');
  assert.equal(await bore.count(), 1, 'Token #3 Bore control is missing');
  assert.equal(await line.evaluate((node) => node.parentElement?.querySelector('strong')?.textContent), '8"');
  await page.waitForFunction(() => {
    const card = document.querySelector('.xml-cii-regex-rule-card');
    const line = card?.querySelectorAll('button[title="Toggle in Line Key"]')[2];
    const bore = card?.querySelectorAll('button[title="Set as Bore"]')[2];
    return line?.style.background === 'rgba(255, 255, 255, 0.06)'
      && bore?.style.background === 'rgb(249, 115, 22)';
  });
  const regex = { line: await line.evaluate((node) => node.style.background),
    bore: await bore.evaluate((node) => node.style.background),
    status: (await builder.innerText()).match(/Auto-(?:analyzed|selected)[^\n]*/)?.[0] || '' };
  assert.ok(regex.status, 'Regex Analyze status was absent');

  await page.getByRole('button', { name: /4 Preview/ }).click();
  await page.locator('[data-mc-preview-build]').click();
  await page.waitForFunction(() => document.querySelector('#mc-preview-table-host')
    ?.__xmlCiiPreviewResult?.branchRows?.length === 41);
  const auto = page.locator('[data-mc-b313-auto-basis-panel]');
  await auto.waitFor();
  const preview = {
    visible: await auto.evaluate((node) => node.getClientRects().length > 0),
    text: (await auto.innerText()).slice(0, 900),
    legacyHidden: await page.locator('[data-mc-b313-basis-editor]').evaluateAll(
      (nodes) => nodes.every((node) => node.hidden || node.style.display === 'none')),
  };
  assert.equal(preview.visible, true);
  assert.equal(preview.legacyHidden, true);
  assert.match(preview.text, /ASTM A106-B/);
  assert.match(preview.text, /T1 REQUIRED/);

  await page.evaluate(() => {
    const started = performance.now();
    let previous = started;
    let maxGap = 0;
    let running = true;
    const tick = (now) => {
      maxGap = Math.max(maxGap, now - previous);
      previous = now;
      if (running) requestAnimationFrame(tick);
    };
    window.__xmlCiiWeightEntryEvidence = { measure: () => ({
      elapsedMs: Math.round(performance.now() - started), maxFrameGapMs: Math.round(maxGap),
    }), stop: () => { running = false; } };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const entry = await page.evaluate(() => {
    const evidence = window.__xmlCiiWeightEntryEvidence;
    const result = evidence.measure();
    evidence.stop();
    return result;
  });
  console.log('Weight entry evidence', JSON.stringify(entry));
  assert.ok(entry.maxFrameGapMs <= 250, 'Entering Weight Match blocked the frame heartbeat');
  await page.evaluate(() => {
    const started = performance.now();
    const button = document.querySelector('#mc-wm-refresh');
    let previous = started;
    let maxGap = 0;
    let ticking = true;
    const tick = (now) => {
      maxGap = Math.max(maxGap, now - previous);
      previous = now;
      if (ticking) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__xmlCiiModeAWeightEvidence = { started, measure: () => ({
      elapsedMs: Math.round(performance.now() - started), maxFrameGapMs: Math.round(maxGap),
      rows: document.querySelectorAll('#mc-wm-content tbody tr').length,
      decoratedRows: document.querySelectorAll('#mc-wm-content tbody tr [data-wm-authority-state]').length,
    }), stop: () => { ticking = false; } };
    setTimeout(() => button.click(), 0);
  });
  await page.waitForFunction(() => {
    const button = document.querySelector('#mc-wm-refresh');
    return button?.dataset.wmBusy !== 'true'
      && /shown/.test(document.querySelector('#mc-wm-status')?.textContent || '');
  }, null, { timeout: 15000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const weight = await page.evaluate(() => {
    const evidence = window.__xmlCiiModeAWeightEvidence;
    const result = evidence.measure();
    evidence.stop();
    return result;
  });
  console.log('Weight click evidence', JSON.stringify(weight));
  assert.ok(weight.rows > 0 && weight.decoratedRows === weight.rows);
  assert.ok(weight.maxFrameGapMs <= 250, 'Full Mode-A Weight click blocked the frame heartbeat');
  for (const name of ['xml-cii-adapted-regex-tester', 'xml-cii-adapted-regex-smart-ui',
    'xml-cii-adapted-preview-diagnostics-audit-v7', 'xml-cii-adapted-preview-b313-auto-basis',
    'xml-cii-adapted-weight-match-v2', 'xml-cii-adapted-weight-match-authority-ui']) {
    assert.ok(modules.some((url) => url.includes(`${name}.js?v=${release}`)), `Live docs path missed ${name}`);
  }
  const branchScopeRequests = modules.filter((url) => url.includes('/xml-cii-branch-scope.js'));
  assert.ok(branchScopeRequests.length > 0, 'Live docs path missed the branch occurrence module');
  assert.ok(branchScopeRequests.every((url) => url.includes(
    '/docs/tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js?v=20260930-issue781-branch-scope-1')),
  `Live docs path requested a stale branch occurrence module: ${branchScopeRequests.join(', ')}`);
  assert.deepEqual(errors, [], 'Full Mode-A page had runtime errors');
  console.log(JSON.stringify({ ok: true, source: '41 branches / 1654 nodes / APPLIED piping, line, weight masters', regex, preview, entry, weight,
    changedModuleRequests: modules.filter((url) => url.includes(release)), errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
