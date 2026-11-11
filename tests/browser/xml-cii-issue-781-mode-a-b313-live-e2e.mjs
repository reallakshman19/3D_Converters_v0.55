import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixturePath = path.resolve(process.env.XML_CII_41_BRANCH_FIXTURE
  || path.join(root, 'Benchmarks', 'EF-05-PRO.TEST.xml'));
const fixture = await readFile(fixturePath, 'utf8');
assert.equal((fixture.match(/<Branch(?:\s|>)/gi) || []).length, 41);
assert.equal((fixture.match(/<Node(?:\s|>)/gi) || []).length, 1654);

const mime = (file) => ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream';
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${route.endsWith('/') ? `${route}index.html` : route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    response.writeHead(200, { 'Content-Type': mime(target), 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
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
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  assert.match(await page.locator('body').innerText(), /Branches:\s*41\/41/);

  await page.getByRole('button', { name: /Piping Class/ }).last().click();
  await page.locator('input[data-master-file="pipingClass"]').setInputFiles({
    name: 'issue781-b313-piping.csv', mimeType: 'text/csv',
    buffer: Buffer.from('PipingClass,Material\n31441C4,ASTM A106-B\n'),
  });
  await page.getByRole('button', { name: /Line List/ }).last().click();
  await page.locator('input[data-master-file="lineList"]').setInputFiles({
    name: 'issue781-b313-lines.csv', mimeType: 'text/csv',
    buffer: Buffer.from('lineKey1,lineKey2\nP,8810021\n'),
  });

  await page.getByRole('button', { name: /4 Preview/ }).click();
  await page.locator('[data-mc-preview-build]').click();
  await page.waitForFunction(() => document.querySelector('#mc-preview-table-host')
    ?.__xmlCiiPreviewResult?.branchRows?.length === 41);
  const blank = await page.evaluate(() => {
    const host = document.querySelector('#mc-preview-table-host');
    const rows = host.__xmlCiiPreviewResult.branchRows;
    const a106 = rows.find((row) => String(row.material || '').includes('A106'));
    const panel = host.querySelector('[data-mc-b313-auto-basis-panel]');
    return { lineKey: a106?.lineKey || '', material: a106?.material || '',
      status: panel?.querySelector('[data-b313-auto-status]')?.textContent || '',
      refreshDisabled: [...(panel?.querySelectorAll('[data-b313-auto-refresh]') || [])]
        .every((button) => button.disabled) };
  });
  assert.equal(blank.material, 'ASTM A106-B');
  assert.ok(blank.lineKey);
  assert.equal(blank.status, 'T1 REQUIRED');
  assert.equal(blank.refreshDisabled, true, 'Blank Preview T1 must fail closed');

  const t1 = page.locator(`input[data-mc-pd-field="t1"][data-mc-pd-linekey="${blank.lineKey}"]`).first();
  await t1.fill('82');
  await t1.dispatchEvent('change');
  await page.locator('[data-mc-preview-build]').click();
  await page.waitForFunction((lineKey) => {
    const result = document.querySelector('#mc-preview-table-host')?.__xmlCiiPreviewResult;
    return result?.branchRows?.length === 41
      && result.branchRows.some((row) => row.lineKey === lineKey && row.t1 === '82');
  }, blank.lineKey);
  await page.locator('[data-b313-auto-key$="T1=82"]').waitFor();

  const seeded = await page.evaluate(() => {
    const host = document.querySelector('#mc-preview-table-host');
    const panel = host.querySelector('[data-mc-b313-auto-basis-panel]');
    const row = panel?.querySelector('[data-b313-auto-key$="T1=82"]');
    const fields = [...(row?.querySelectorAll('[data-b313-auto-field]') || [])]
      .map((field) => ({ name: field.dataset.b313AutoField, value: field.value }));
    const legacy = host.querySelector('[data-mc-b313-basis-editor]');
    return { panelVisible: !!panel?.getClientRects().length,
      seedText: row?.textContent || '', fields,
      infoCount: row?.querySelectorAll('[data-b313-factor-info-button]').length || 0,
      refreshEnabled: row?.querySelector('[data-b313-auto-refresh]')?.disabled === false,
      legacyHidden: !legacy || legacy.hidden || legacy.style.display === 'none' };
  });
  assert.equal(seeded.panelVisible, true);
  assert.match(seeded.seedText, /Seed 120 °C/);
  assert.equal(seeded.fields.length, 5, 'S/unit/E/W/Y controls must all render');
  for (const field of seeded.fields.filter((item) => item.name !== 'stressUnit')) {
    assert.ok(Number.isFinite(Number(field.value)) && Number(field.value) > 0,
      `${field.name} fallback seed must be populated`);
  }
  assert.ok(seeded.fields.find((item) => item.name === 'stressUnit')?.value);
  assert.equal(seeded.infoCount, 4);
  assert.equal(seeded.refreshEnabled, true);
  assert.equal(seeded.legacyHidden, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, source: 'docs Mode A / 41 branches / 1654 nodes', blank, seeded, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
