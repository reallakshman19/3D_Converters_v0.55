import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegexTesterConfig } from '../../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixturePath = process.env.XML_CII_41_BRANCH_FIXTURE || path.join(root, 'Benchmarks', 'EF-05-PRO.TEST.xml');
const fixture = await readFile(fixturePath, 'utf8');
assert.equal((fixture.match(/<Branch(?:\s|>)/gi) || []).length, 41);
assert.equal((fixture.match(/<Node(?:\s|>)/gi) || []).length, 1654);
const release = '20261001-weight-output-2';
const activated = JSON.parse(await readFile(path.join(root,
  'agents/evidence/WIP-781-SINGLE-COMBINE-OWNERS-20261001/runtime-activation-ledger.json'), 'utf8'));
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${route.endsWith('/') ? `${route}index.html` : route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch (error) { response.writeHead(404); response.end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [], modules = [], timings = [], failedRequests = [], badResponses = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => { if (/\.js(?:\?|$)/.test(request.url())) modules.push(request.url()); });
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), reason: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
  });
  const seed = createDefaultRegexTesterConfig();
  for (const format of seed.formats) {
    format.lineKey.tokenPosition = '4'; format.pipingClass.tokenPosition = '5'; format.bore.tokenPosition = '3';
  }
  await page.addInitScript((json) => {
    // Persist the actual XML→CII tab before application startup. Otherwise
    // the default heavyweight Model Converters import may still be pending
    // while this test switches tabs, leaving a non-ready loading surface.
    localStorage.setItem('format-converters.activeTabId', 'xml-cii-2019-standalone');
    if (!localStorage.getItem('xml-cii-regex-config-v1')) localStorage.setItem('xml-cii-regex-config-v1', json);
  }, JSON.stringify(seed));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  // The tab can reopen on a remembered phase/subtab. Navigate explicitly
  // to the actual Source loader before selecting the original XML.
  try {
    await page.locator('[data-phase="source"]').waitFor({ state: 'attached', timeout: 45000 });
  } catch (error) {
    const domDiagnostic = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      appHTML: document.querySelector('#app-layout')?.innerHTML?.slice(0, 2500) || '',
      navButtons: [...document.querySelectorAll('button')].slice(0, 35).map((button) => button.textContent.trim()),
      sourceInputCount: document.querySelectorAll('input[data-field="source-file"]').length,
      contentState: document.querySelector('.app-content')?.textContent?.slice(0, 1300) || '',
      errorPanel: document.querySelector('.tab-error')?.textContent || '',
    }));
    console.error('ISSUE_781_SOURCE_UI_MOUNT_DIAGNOSTIC',
      JSON.stringify({ ...domDiagnostic, pageErrors: errors.slice(0, 12), failedRequests: failedRequests.slice(0, 25), badResponses: badResponses.slice(0, 50), moduleRequests: modules.slice(-25) }, null, 2));
    throw error;
  }
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-sub-tab="loader"]').click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  await page.getByRole('button', { name: /Valve Weights/ }).click();
  await page.locator('input[data-master-file="weight"]').setInputFiles(path.join(root, 'docs', 'Masters', 'wtValveweights.xlsx'));
  await page.locator('[data-master-mapping-status="weight"]').filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /2 Regex Tester/ }).click();
  let mapping = page.locator('.xml-cii-regex-rule-card').filter({ has: page.getByRole('heading', { name: 'Rating prefix mapping', exact: true }) });
  await mapping.locator('tbody tr').filter({ has: page.locator('td').filter({ hasText: /^3$/ }) }).getByRole('button').click();
  mapping = page.locator('.xml-cii-regex-rule-card').filter({ has: page.getByRole('heading', { name: 'Rating prefix mapping', exact: true }) });
  await mapping.getByPlaceholder('Prefix', { exact: true }).fill('3');
  await mapping.getByPlaceholder('Rating', { exact: true }).fill('600');
  await mapping.getByRole('button', { name: 'Add', exact: true }).click();
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-regex-config-v1')).ratingSequence.some(([p, r]) => p === '3' && r === '600')));
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-import-masters-v1')).config.rating.ratingSequence.some(([p, r]) => p === '3' && r === '600')));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  // The tab can reopen on a remembered phase/subtab. Navigate explicitly
  // to the actual Source loader before selecting the original XML.
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-sub-tab="loader"]').click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').waitFor();

  async function measure(action, label) {
    await page.evaluate(() => {
      let last = performance.now(), max = 0, running = true;
      const tick = (now) => { max = Math.max(max, now - last); last = now; if (running) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      window.__ratingTiming = () => { running = false; return Math.round(max); };
    });
    await action();
    await page.waitForFunction(() => document.querySelector('#mc-wm-refresh')?.dataset.wmBusy !== 'true'
      && /shown|Error/.test(document.querySelector('#mc-wm-status')?.textContent || ''));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const gap = await page.evaluate(() => window.__ratingTiming());
    timings.push({ label, maxFrameGapMs: gap });
    assert.ok(gap <= 250, `${label} blocked frame heartbeat: ${gap}ms`);
    assert.match(await page.locator('#mc-wm-status').innerText(), /shown/, `${label} build failed`);
  }
  const rows = () => page.locator('#mc-wm-content tbody tr');
  const readRows = () => rows().evaluateAll((nodes) => nodes.map((node) => ({
    branch: node.children[1].textContent, line: node.children[2].textContent,
    pipingClass: node.querySelector('.mc-wm-rating-input')?.closest('td')?.querySelector('small')?.textContent,
    rating: node.querySelector('.mc-wm-rating-input')?.value,
    key: node.querySelector('.mc-rigid-review-input')?.dataset.wmKey,
    accepted: node.querySelector('.mc-rigid-review-input')?.dataset.wmAccepted,
  })));
  await measure(() => page.locator('#mc-wm-refresh').click(), 'prefix build without Preview');
  const initial = await readRows();
  assert.ok(initial.length > 0);
  const sourceIndex = initial.findIndex((row) => row.pipingClass.startsWith('3') && row.accepted !== 'true');
  assert.ok(sourceIndex >= 0, 'Need an unresolved mapped-prefix row');
  const source = initial[sourceIndex];
  assert.equal(source.rating, '600', 'User-edited prefix mapping must reach Weight without Build Preview');
  const otherIndex = initial.findIndex((row) => row.pipingClass === source.pipingClass && row.line !== source.line);
  assert.ok(otherIndex >= 0, 'Real fixture must contain another line of the same class');
  const savedConfig = () => page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-import-masters-v1')).config);

  await measure(async () => { await rows().nth(sourceIndex).locator('.mc-wm-rating-input').fill('900');
    await rows().nth(sourceIndex).locator('.mc-wm-rating-input').dispatchEvent('change'); }, 'manual Rating 900');
  assert.equal((await readRows())[sourceIndex].rating, '900');
  let persisted = await savedConfig();
  assert.equal(persisted.overrides.rating[source.line || source.branch], '900');
  await measure(async () => { await rows().nth(otherIndex).locator('.mc-wm-rating-input').fill('450');
    await rows().nth(otherIndex).locator('.mc-wm-rating-input').dispatchEvent('change'); }, 'second manual Rating');
  persisted = await savedConfig();
  assert.equal(persisted.overrides.rating[source.line || source.branch], '900', 'A second save must preserve the first');
  const input = rows().nth(sourceIndex).locator('.mc-rigid-review-input');
  await input.fill('10.5'); await input.dispatchEvent('change');
  const typedWeightConfig = await savedConfig();
  assert.equal(typedWeightConfig.overrides.rigidWeightMatch1?.[source.key], 10.5,
    'Typed weight must be an explicitly accepted manual Match-1 decision');
  assert.equal(typedWeightConfig.overrides.rigidWeightMatch1Provenance?.[source.key]?.acceptanceMethod, 'manual',
    'Manual input must retain manual provenance, never be mislabeled as candidate');
  assert.equal(typedWeightConfig.overrides.rigidWeightFinal?.[source.key], undefined,
    'Typing a Weight Match value must not silently authorize separate Final Match-2');

  await measure(async () => { await rows().nth(sourceIndex).locator('.mc-wm-rating-input').fill('300');
    await rows().nth(sourceIndex).locator('[data-wm-rating-fill-class]').click(); }, 'class fill Rating 300');
  const filled = await readRows();
  for (let index = 0; index < filled.length; index += 1) {
    if (initial[index].pipingClass === source.pipingClass) assert.equal(filled[index].rating, '300');
    else assert.equal(filled[index].rating, initial[index].rating, 'Class fill changed another class');
  }
  // The accepted value remains recorded for audit, but changed Rating must
  // require fresh source-bound Match-1 validation instead of silent Final.
  assert.equal((await savedConfig()).overrides.rigidWeightMatch1?.[source.key], 10.5);
  assert.equal((await savedConfig()).overrides.rigidWeightFinal?.[source.key], undefined);
  const filledCount = filled.filter((row) => row.pipingClass === source.pipingClass).length;
  await measure(() => page.locator('#mc-wm-refresh').click(), 'repeat Build after class fill');
  assert.equal((await readRows())[sourceIndex].rating, '300');
  await page.getByRole('button', { name: /2 Regex Tester/ }).click();
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').waitFor();
  await measure(() => page.locator('#mc-wm-refresh').click(), 'reopen persisted Rating');
  assert.equal((await readRows())[sourceIndex].rating, '300');
  assert.equal((await readRows())[otherIndex].rating, '300');
  for (const file of ['weight-match-renderer', 'xml-cii-adapted-regex-rating', 'xml-cii-adapted-weight-match-v2', 'master-dataset-worker']) {
    const currentC05Consumer = file === 'master-dataset-worker' || file === 'xml-cii-adapted-weight-match-v2';
    const expectedRelease = currentC05Consumer
      ? '20261007-c05-6-2-consumer-authority-1'
      : (activated.activatedModules.some((module) => module.endsWith(`/${file}.js`))
        ? activated.release : release);
    assert.ok(modules.some((url) => url.includes(`${file}.js?v=${expectedRelease}`)), `Missing active release ${file}`);
  }
  assert.deepEqual(errors, []);
  const evidence = { status: 'PASS', fixture: '41 branches / 1654 nodes', rows: filled.length,
    editedPrefix: ['3', '600'], manual: ['900', '450'], classFill: { pipingClass: source.pipingClass, rating: '300', rows: filledCount },
    manualMatch1RecordedForAudit: 10.5, typedManualProvenance: true,
    noImplicitFinalMatch2: true,
    repeatBuild: true, reopen: true, timings, errors };
  if (process.env.XML_CII_RATING_EVIDENCE_DIR) {
    const dir = process.env.XML_CII_RATING_EVIDENCE_DIR;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'weight-rating-browser.json'), JSON.stringify(evidence, null, 2));
    await page.locator('#mc-wm-content').screenshot({ path: path.join(dir, 'weight-rating-class-fill.png') });
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
