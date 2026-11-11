import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_WEIGHT_BASIS_FASTPATH_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_WEIGHT_BASIS_FASTPATH_OUTPUT || 'ValidationRecords/xml-cii-issue-781-weight-basis-fastpath-e2e.json';

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

const url = `${baseUrl}/tests/browser/xml-cii-weight-basis-fastpath-e2e.html`;
await waitForServer(url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => globalThis.__XML_CII_WEIGHT_BASIS_FASTPATH_DONE__ === true, null, { timeout: 60000 });
  const result = await page.evaluate(() => globalThis.__XML_CII_WEIGHT_BASIS_FASTPATH_RESULT__);
  await fs.mkdir('ValidationRecords', { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log('XML_CII_ISSUE_781_WEIGHT_BASIS_FASTPATH_E2E_RESULT');
  console.log(JSON.stringify(result, null, 2));
  if (!result?.ok) throw new Error(result?.error || 'Weight basis fast-path E2E returned no result');
} finally {
  await browser.close();
}

// Exercise persisted prefix/manual/class-fill controls with the real 41-branch source.
await import('../tests/browser/xml-cii-weight-rating-input-e2e.mjs');
