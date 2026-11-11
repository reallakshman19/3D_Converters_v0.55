import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_ISSUE_830_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_ISSUE_830_OUTPUT || 'ValidationRecords/xml-cii-issue-830-p2810042-bore-wall.json';

async function waitForServer(url, timeoutMs = 30_000) {
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

const url = `${baseUrl}/tests/browser/xml-cii-issue-830-p2810042-bore-wall-e2e.html`;
await waitForServer(url);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__XML_CII_ISSUE_830_DONE__ === true, null, { timeout: 120_000 });
  const result = await page.evaluate(() => globalThis.__XML_CII_ISSUE_830_RESULT__);
  await fs.mkdir('ValidationRecords', { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log('XML_CII_ISSUE_830_P2810042_BORE_WALL_RESULT');
  console.log(JSON.stringify(result, null, 2));
  if (!result?.ok) throw new Error(result?.error || 'P2810042 bore/wall ledger returned no result');
} finally {
  await browser.close();
}
