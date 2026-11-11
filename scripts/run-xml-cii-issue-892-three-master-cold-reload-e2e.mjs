import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_ISSUE_892_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_ISSUE_892_OUTPUT || 'ValidationRecords/xml-cii-issue-892-three-master-cold-reload.json';

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error('HTTP ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('server unavailable at ' + url + ': ' + lastError);
}

const url = baseUrl + '/tests/browser/xml-cii-issue-892-three-master-cold-reload-e2e.html';
await waitForServer(url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log('[browser:' + message.type() + '] ' + message.text()));
  page.on('pageerror', (error) => console.error('[browser:pageerror] ' + (error.stack || error)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__XML_CII_ISSUE_892_DONE__ === true, null, { timeout: 300_000 });
  const result = await page.evaluate(() => globalThis.__XML_CII_ISSUE_892_RESULT__);
  await fs.mkdir('ValidationRecords', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('XML_CII_ISSUE_892_THREE_MASTER_COLD_RELOAD_RESULT');
  console.log(JSON.stringify(result, null, 2));
  if (!result?.ok) throw new Error(result?.error || 'C05.6.1 combined cold-reload lifecycle returned no result');
} finally {
  await browser.close();
}
