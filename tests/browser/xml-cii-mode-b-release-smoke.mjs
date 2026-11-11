import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidence = path.join(root, 'agents/evidence/WIP-781-MAIN-INTEGRATION-20261001');
const fixture = await readFile(process.env.XML_CII_41_BRANCH_FIXTURE, 'utf8');
const { chromium } = createRequire(import.meta.url)(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--observe-absence');
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${route.endsWith('/') ? `${route}index.html` : route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json' };
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch (error) { response.writeHead(404); response.end(String(error)); }
});
const externalUrl = process.env.XML_CII_MODE_B_BASE_URL;
if (!externalUrl) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = externalUrl || `http://127.0.0.1:${server.address().port}/docs/`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
try {
  await mkdir(evidence, { recursive: true });
  const page = await browser.newPage();
  const modules = [], errors = [];
  page.on('request', request => { if (/\.js(?:\?|$)/.test(request.url())) modules.push(request.url()); });
  page.on('pageerror', error => errors.push(String(error)));
  page.setDefaultTimeout(30000);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  await page.locator('input[data-field="source-file"]').setInputFiles([
    { name: 'release-source-one.xml', mimeType: 'application/xml', buffer: Buffer.from(fixture) },
    { name: 'release-source-two.xml', mimeType: 'application/xml',
      buffer: Buffer.from(fixture.replace(/(<ProjectName>)[^<]*/, '$1Mode B second source')) },
  ]);
  await page.getByText('release-source-two.xml', { exact: false }).first().waitFor();
  const modeB = page.getByRole('button', { name: 'Mode B — Combine XML (node offsets)', exact: true });
  const count = await modeB.count();
  if (baseline) assert.equal(count, 0, 'Live baseline unexpectedly contains Mode B');
  else {
    assert.equal(count, 1);
    assert.ok(await modeB.isVisible());
    await modeB.click();
    await page.getByRole('button', { name: 'Combine XML', exact: true }).click();
    const combineStatus = await page.locator('[data-mode-b-status]').innerText();
    console.log('Combine status:', combineStatus);
    assert.match(combineStatus, /Combined 2 XML files/);
    assert.match(await page.locator('[data-mode-b-offsets]').innerText(), /release-source-two.xml: offset \+100000/);
    for (const [label, filename] of [['Save Combined XML', 'release-combined.xml'], ['Save Node Offset Map', 'release-offset-map.json']]) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: label, exact: true }).click()]);
      await download.saveAs(path.join(evidence, filename));
    }
    const result = await readFile(path.join(evidence, 'release-combined.xml'), 'utf8');
    assert.equal((result.match(/<Branch(?:\s|>)/g) || []).length, 82);
    assert.equal((result.match(/<Node(?:\s|>)/g) || []).length, 3308);
    const map = JSON.parse(await readFile(path.join(evidence, 'release-offset-map.json'), 'utf8'));
    assert.deepEqual(map.sourceOrder.map(row => row.offset), [0, 100000]);
    assert.equal(map.sourceCount, 2);
    assert.deepEqual(errors, []);
  }
  const prefix = baseline ? 'live-baseline' : 'main-integrated';
  await page.screenshot({ path: path.join(evidence, `${prefix}.png`), fullPage: true });
  const observation = { status: baseline ? 'FAIL' : 'PASS', observation: externalUrl ? 'REMOTE_EXECUTION' : 'LOCAL_EXECUTION',
    oracle: 'INDEPENDENT_REPRODUCTION', url, twoFilesLoaded: true, modeBControlCount: count,
    combinedBranches: baseline ? null : 82, combinedNodes: baseline ? null : 3308, errors, modules };
  await writeFile(path.join(evidence, `${prefix}.json`), JSON.stringify(observation, null, 2));
  console.log(JSON.stringify({ ...observation, modules: modules.length }, null, 2));
} finally {
  await browser.close();
  if (!externalUrl) await new Promise(resolve => server.close(resolve));
}
