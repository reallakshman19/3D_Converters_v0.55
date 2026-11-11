import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_WORKER_WEIGHT_SCALE_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_WORKER_WEIGHT_SCALE_OUTPUT || 'ValidationRecords/xml-cii-issue-781-worker-weight-scale-e2e.json';

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server unavailable at ${url}: ${lastError}`);
}

const url = `${baseUrl}/tests/browser/xml-cii-worker-weight-scale-e2e.html`;
await waitForServer(url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => globalThis.__XML_CII_WORKER_WEIGHT_SCALE_DONE__ === true, null, { timeout: 300000 });
  const result = await page.evaluate(() => globalThis.__XML_CII_WORKER_WEIGHT_SCALE_RESULT__);
  await fs.mkdir('ValidationRecords', { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log('XML_CII_ISSUE_781_WORKER_WEIGHT_SCALE_E2E_RESULT');
  console.log(JSON.stringify(result, null, 2));
  if (!result?.ok) throw new Error(result?.error || 'Worker Weight scale E2E returned no result');
} finally {
  await browser.close();
}
