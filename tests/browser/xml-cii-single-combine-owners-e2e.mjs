import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegexTesterConfig } from '../../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidence = path.join(root, 'agents/evidence/WIP-781-SINGLE-COMBINE-OWNERS-20261001/three-source-browser');
const fixtureRoot = process.env.XML_CII_THREE_SOURCE_ROOT || path.join(root, 'Benchmarks/XML-CII-2019');
const names = ['SYS-6-S8810010-01.xml', 'SYS-6-S8810011-01.xml', 'SYS-S8811956-01.xml'];
const fixtures = await Promise.all(names.map(name => readFile(path.join(fixtureRoot, name), 'utf8')));
const { chromium } = createRequire(import.meta.url)(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${route.endsWith('/') ? `${route}index.html` : route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch (error) { response.writeHead(404); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
const page = await browser.newPage();
page.setDefaultTimeout(30000);
const errors = [], modules = [], requests = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('request', request => { requests.push(request.url()); if (/\.js(?:\?|$)/.test(request.url())) modules.push(request.url()); });
try {
  await mkdir(evidence, { recursive: true });
  const seed = createDefaultRegexTesterConfig();
  for (const format of seed.formats) {
    format.lineKey.tokenPosition = '4'; format.pipingClass.tokenPosition = '5'; format.bore.tokenPosition = '3';
  }
  await page.addInitScript(json => localStorage.setItem('xml-cii-regex-config-v1', json), JSON.stringify(seed));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  const mode = action => page.locator(`[data-mode-b-action="${action}"]`);
  assert.equal(await mode('select-single').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.xml-cii-standalone-header').innerText(), /Single processes one XML/);
  assert.equal(await page.locator('input[data-field="source-file"]').evaluate(input => input.multiple), false);
  await mode('select-a').click();
  assert.equal(await page.locator('input[data-field="source-file"]').evaluate(input => input.multiple), true);
  await page.getByRole('button', { name: /10 Output \/ Run/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Run Separate Models', exact: true }).count(), 1);
  await page.getByRole('button', { name: /1 Source & Masters/ }).click();
  await mode('select-b').click();
  assert.equal(await mode('select-b').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.xml-cii-standalone-header').innerText(), /Mode B combines multiple XML/);
  assert.ok(await page.getByRole('button', { name: /10 Output \/ Run/ }).isDisabled());
  await page.locator('input[data-field="source-file"]').setInputFiles(names.map((name, index) =>
    ({ name, mimeType: 'application/xml', buffer: Buffer.from(fixtures[index]) })));
  await page.getByText(names[2], { exact: false }).first().waitFor();
  await mode('combine').click();
  assert.match(await page.locator('[data-mode-b-status]').innerText(), /Combined 3 XML files/);
  const [download] = await Promise.all([page.waitForEvent('download'), mode('save-xml').click()]);
  await download.saveAs(path.join(evidence, 'combined.xml'));
  const [mapDownload] = await Promise.all([page.waitForEvent('download'), mode('save-map').click()]);
  await mapDownload.saveAs(path.join(evidence, 'offset-map.json'));
  const map = JSON.parse(await readFile(path.join(evidence, 'offset-map.json'), 'utf8'));
  assert.deepEqual(map.sourceOrder.map(row => row.offset), [0, 100000, 200000]);
  const output = await readFile(path.join(evidence, 'combined.xml'), 'utf8');
  const preservation = await page.evaluate(({ fixtures, output }) => {
    const parse = xml => new DOMParser().parseFromString(xml, 'application/xml');
    const sourceNodes = fixtures.flatMap((xml, index) => [...parse(xml).getElementsByTagName('Node')].map(node => ({ node, index })));
    const actual = [...parse(output).getElementsByTagName('Node')];
    const failures = [];
    for (const [i, { node, index }] of sourceNodes.entries()) {
      const number = Number(node.querySelector('NodeNumber').textContent);
      if (Number(actual[i].querySelector('NodeNumber').textContent) !== (number > 0 ? number + index * 100000 : number)) failures.push(`ID ${i}`);
      const fields = n => [...n.children].filter(child => child.localName !== 'NodeNumber').map(child => [child.localName, child.textContent]);
      if (JSON.stringify(fields(node)) !== JSON.stringify(fields(actual[i]))) failures.push(`fields ${i}`);
    }
    return { failures, sourceNodes: sourceNodes.length, combinedNodes: actual.length, branches: parse(output).getElementsByTagName('Branch').length };
  }, { fixtures, output });
  assert.deepEqual(preservation.failures, []);
  assert.equal(preservation.combinedNodes, preservation.sourceNodes);
  await page.screenshot({ path: path.join(evidence, 'mode-b-ready.png'), fullPage: true });
  await mode('use-single').click();
  assert.equal(await mode('select-single').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('input[data-field="source-file"]').evaluate(input => input.multiple), false);
  assert.equal(await page.locator('[data-mode-a-source]').count(), 0);
  await page.getByRole('button', { name: /Valve Weights/ }).click();
  await page.locator('input[data-master-file="weight"]').setInputFiles(path.join(root, 'docs/Masters/wtValveweights.xlsx'));
  await page.locator('[data-master-mapping-status="weight"]').filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /2 Regex Tester/ }).click();
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').click();
  await page.waitForFunction(() => document.querySelector('#mc-wm-refresh')?.dataset.wmBusy !== 'true' && /shown/.test(document.querySelector('#mc-wm-status')?.textContent || ''));
  const inputs = page.locator('#mc-wm-content .mc-rigid-review-input');
  const savedKey = await inputs.first().getAttribute('data-wm-key');
  const candidateValue = Number(await inputs.first().inputValue());
  assert.ok(candidateValue > 0);
  await inputs.first().fill(String(candidateValue)); await inputs.first().dispatchEvent('change');
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem('xml-cii-import-masters-v1')).config.overrides.rigidWeightFinal[key], savedKey), candidateValue,
    'Typing a value equal to a suggestion must still be manual authority');
  await inputs.first().fill('57.25'); await inputs.first().dispatchEvent('change');
  await page.locator('#mc-wm-fill-best').click();
  assert.equal(Number(await inputs.first().inputValue()), 57.25);
  await page.getByRole('button', { name: /10 Output \/ Run/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Run Separate Models', exact: true }).count(), 0);
  await page.locator('[data-action="run"]').click();
  const modal = page.getByRole('dialog', { name: 'Rigid zero weight review' });
  await modal.waitFor({ timeout: 60000 });
  const review = modal.locator('.mc-rigid-review-input');
  const initial = await review.evaluateAll(nodes => nodes.map(n => ({ key: n.dataset.rigidReviewKey, weight: Number(n.value) })));
  const savedInReview = initial.find(item => item.key === savedKey);
  if (savedInReview) assert.equal(savedInReview.weight, 57.25, 'Single review replaced the saved manual weight');
  assert.ok(initial.some(item => item.weight > 0), 'Suggestions must remain populated without a per-row click');
  for (let i = 0; i < await review.count(); i++) if (!Number(await review.nth(i).inputValue())) await review.nth(i).fill('17.75');
  const accepted = await review.evaluateAll(nodes => nodes.map(n => ({ key: n.dataset.rigidReviewKey, weight: Number(n.value) })));
  await writeFile(path.join(evidence, 'review-accepted.json'), JSON.stringify([{ key: savedKey, weight: 57.25 }, ...accepted], null, 2));
  await modal.screenshot({ path: path.join(evidence, 'weight-review.png') });
  await modal.locator('[data-rigid-review-apply]').click();
  await page.locator('[data-action="download-cii"]').first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-action="download-cii"]')].some(button => !button.disabled), null, { timeout: 60000 });
  for (const [action, name] of [['download-enriched', 'ui-run.xml'], ['download-cii', 'ui-run.cii']]) {
    const [artifact] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-action="${action}"]`).first().click()]);
    await artifact.saveAs(path.join(evidence, name));
  }
  await page.waitForFunction(() => document.querySelector('.xml-cii-adapted-geometry-host')?.__xmlCiiGeometryRenderer);
  assert.equal(await page.locator('.xml-cii-adapted-geometry-host').getAttribute('data-geometry-basis'), 'latest-output');
  await page.getByRole('button', { name: 'Refresh geometry', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.xml-cii-adapted-geometry-host')?.__xmlCiiGeometryRenderer);
  await page.screenshot({ path: path.join(evidence, 'single-converted.png'), fullPage: true });
  assert.ok(requests.some(url => url.includes('/xml_cii_weighted_geometry.py')));
  assert.ok(modules.some(url => url.includes('weight-match-renderer.js?v=20261001-single-weight-owners-1')));
  assert.deepEqual(errors, []);
  await writeFile(path.join(evidence, 'acceptance.json'), JSON.stringify({ status: 'PASS', observation: 'NATIVE_BROWSER_EXECUTION',
    oracle: 'INDEPENDENT_REPRODUCTION', defaultSingle: true, separateModeA: true, combineThenSingle: true,
    preservation, offsets: map.sourceOrder.map(row => row.offset), savedKey, initial, accepted: accepted.length, errors, modules }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', preservation, accepted: accepted.length, errors }));
} catch (error) {
  await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true });
  await writeFile(path.join(evidence, 'failure.txt'), `${error.stack}\n${await page.locator('body').innerText()}\nErrors: ${errors.join('\n')}`);
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
