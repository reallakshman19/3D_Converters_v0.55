import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = path.resolve(process.env.XML_CII_41_BRANCH_FIXTURE
  || path.join(root, 'Benchmarks', 'EF-05-PRO.TEST.xml'));
const playwrightModule = process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightModule);

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') return 'text/html';
  if (extension === '.js' || extension === '.mjs') return 'text/javascript';
  if (extension === '.xml') return 'application/xml';
  return 'application/octet-stream';
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = pathname === '/Benchmarks/EF-05-PRO.TEST.xml'
      ? fixture : path.resolve(root, `.${pathname}`);
    if (file !== fixture && !file.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
      throw new Error('Request is outside the repository root.');
    }
    const contents = await readFile(file);
    response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
    response.end(contents);
  } catch (error) {
    response.writeHead(404);
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.XML_CII_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}),
  });
  const page = await browser.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(String(error)));
  const url = `http://127.0.0.1:${server.address().port}/tests/browser/xml-cii-issue-781-live-regex-acceptance.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__XML_CII_LIVE_REGEX_DONE__ === true, null, { timeout: 60_000 });
  const result = await page.evaluate(() => globalThis.__XML_CII_LIVE_REGEX_RESULT__);
  console.log(JSON.stringify({ result, runtimeErrors }, null, 2));
  if (!result?.ok || runtimeErrors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
