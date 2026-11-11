import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtureRoot = path.resolve(process.env.XML_CII_FIXTURE_ROOT || root);
const playwrightModule = process.env.XML_CII_PLAYWRIGHT_IMPORT || 'playwright';
const { chromium } = await import(playwrightModule);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.xml': 'application/xml', '.json': 'application/json', '.css': 'text/css' })[ext] || 'application/octet-stream';
}

async function serve(request, response) {
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
  const source = relative.startsWith('Benchmarks/') ? fixtureRoot : root;
  const target = path.resolve(source, relative);
  if (!target.startsWith(`${source}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' }).end(body);
  } catch {
    response.writeHead(404).end(`Missing ${relative}`);
  }
}

const server = createServer((request, response) => { void serve(request, response); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE || undefined,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || String(error)));
  const address = `http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-b313-live-preview-e2e.html`;
  await page.goto(address, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__B313_LIVE_PREVIEW_RESULT__, null, { timeout: 60000 });
  const result = await page.evaluate(() => globalThis.__B313_LIVE_PREVIEW_RESULT__);
  if (process.env.XML_CII_B313_SCREENSHOT) {
    const screenshotPath = path.resolve(process.env.XML_CII_B313_SCREENSHOT);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  console.log(JSON.stringify({ ...result, pageErrors: errors }, null, 2));
  if (!result?.ok || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
