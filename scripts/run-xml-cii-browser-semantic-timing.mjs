import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.XML_CII_BENCHMARK_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.XML_CII_BENCHMARK_OUTPUT || 'ValidationRecords/xml-cii-browser-semantic-core-timing.json';

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

await waitForServer(`${baseUrl}/tests/browser/xml-cii-semantic-core-timing.html`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));

  await page.goto(`${baseUrl}/tests/browser/xml-cii-semantic-core-timing.html?run=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForFunction(() => globalThis.__XML_CII_BROWSER_PERF_DONE__ === true, null, {
    timeout: 240_000,
  });
  const result = await page.evaluate(() => globalThis.__XML_CII_BROWSER_PERF_RESULT__);
  if (!result || result.error) throw new Error(result?.error || 'browser timing returned no result');

  await fs.mkdir(new URL('../ValidationRecords/', import.meta.url), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log('XML_CII_BROWSER_TIMING_RESULT');
  console.log(JSON.stringify(result, null, 2));
  console.log(`WORKER_DECISION=${result.worker?.decision || 'UNKNOWN'}`);
  for (const item of result.cases || []) {
    console.log([
      `CASE=${item.name}`,
      `branches=${item.xmlCounts?.branches}`,
      `nodes=${item.xmlCounts?.nodes}`,
      `masters=${item.masterRows}`,
      `semanticMedianMs=${item.semanticDomReuse?.medianMs}`,
      `semanticP95Ms=${item.semanticDomReuse?.p95Ms}`,
      `materialMedianMs=${item.materialOnly?.medianMs}`,
      `weightMedianMs=${item.weightOnly?.medianMs}`,
    ].join(' '));
  }
} finally {
  await browser.close();
}
