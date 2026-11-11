import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.XML_CII_BASE_URL || 'http://127.0.0.1:4173';
const fixturePath = process.env.XML_CII_WEIGHT_XML_PATH
  || fileURLToPath(new URL('../../Benchmarks/EF-05-PRO.TEST.xml', import.meta.url));
const masterPath = process.env.XML_CII_WEIGHT_MASTER_PATH || '';
const injectStaleRating = process.env.XML_CII_TEST_STALE_RATING === '1';
const repeatBuild = process.env.XML_CII_REPEAT_BUILD === '1';
const toggleRebuild = process.env.XML_CII_TOGGLE_REBUILD === '1';
const maxWallMs = 15000;
const maxFrameGapMs = 250;

const fixture = await readFile(fixturePath, 'utf8');
assert.equal((fixture.match(/<Branch(?:\s|>)/gi) || []).length, 41, 'acceptance source must contain 41 branches');
assert.equal((fixture.match(/<Node(?:\s|>)/gi) || []).length, 1654, 'acceptance source must contain 1,654 nodes');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(maxWallMs);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: maxWallMs });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  const sourceInput = page.locator('input[data-field="source-file"]');
  await sourceInput.waitFor();
  await sourceInput.setInputFiles(fixturePath);
  if (masterPath) {
    await page.getByRole('button', { name: /Valve Weights/ }).click();
    await page.locator('input[data-master-file="weight"]').setInputFiles(masterPath);
    await page.getByText(/Mapping status: APPLIED/).first().waitFor();
  }
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').waitFor();
  await page.waitForTimeout(1000);
  assert.match(await page.locator('body').innerText(), /Branches:\s*41\/41/);

  await page.evaluate((injectStaleRating) => {
    const button = document.querySelector('#mc-wm-refresh');
    const status = document.querySelector('#mc-wm-status');
    const started = performance.now();
    const evidence = { started, statusHistory: [], frameGaps: [], longTasks: [], xmlParses: 0, xmlParseMs: 0, workerCommands: [] };
    const originalParse = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (input, ...args) {
      if (typeof input !== 'string' || input.length < 500000) return originalParse.call(this, input, ...args);
      const began = performance.now();
      try { return originalParse.call(this, input, ...args); }
      finally {
        evidence.xmlParses += 1;
        evidence.xmlParseMs += performance.now() - began;
      }
    };
    const originalPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      evidence.workerCommands.push(message?.type || 'UNKNOWN');
      if (injectStaleRating && message?.type === 'PREPARE_WEIGHT_BASIS') {
        setTimeout(() => {
          globalThis.__xmlCiiPreviewRatingSnapshotV2 = {
            schema: 'xml-cii-preview-rating-snapshot/v2',
            records: [{ branchName: 'STALE-RATING-WITNESS', rating: '900' }],
          };
        }, 0);
      }
      return originalPost.call(this, message, ...args);
    };
    let running = true;
    let lastFrame = started;
    const tick = (now) => {
      evidence.frameGaps.push(now - lastFrame);
      lastFrame = now;
      if (running) requestAnimationFrame(tick);
    };
    const observer = new MutationObserver(() => {
      const value = status.textContent || '';
      if (value !== evidence.statusHistory.at(-1)?.value) {
        evidence.statusHistory.push({ ms: Math.round(performance.now() - started), value });
      }
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    const longTaskObserver = new PerformanceObserver((list) => {
      evidence.longTasks.push(...list.getEntries().map((entry) => ({
        ms: Math.round(entry.startTime - started),
        durationMs: Math.round(entry.duration),
      })));
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
    evidence.finish = () => {
      running = false;
      observer.disconnect();
      longTaskObserver.disconnect();
      DOMParser.prototype.parseFromString = originalParse;
      Worker.prototype.postMessage = originalPost;
    };
    window.__xmlCiiLiveWeightEvidence = evidence;
    requestAnimationFrame(tick);
    setTimeout(() => button.click(), 0);
  }, injectStaleRating);

  await page.waitForFunction(() => {
    const button = document.querySelector('#mc-wm-refresh');
    return button?.dataset.wmBusy !== 'true'
      && /shown|Error/.test(document.querySelector('#mc-wm-status')?.textContent || '');
  }, null, { timeout: maxWallMs });

  const result = await page.evaluate(() => {
    const evidence = window.__xmlCiiLiveWeightEvidence;
    evidence.finish();
    const button = document.querySelector('#mc-wm-refresh');
    const rows = document.querySelectorAll('#mc-wm-content tbody tr').length;
    return {
      elapsedMs: Math.round(performance.now() - evidence.started),
      maxFrameGapMs: Math.round(Math.max(0, ...evidence.frameGaps)),
      status: document.querySelector('#mc-wm-status')?.textContent || '',
      errorText: document.querySelector('#mc-wm-content')?.textContent?.slice(0, 250) || '',
      busy: button.dataset.wmBusy === 'true',
      rows,
      decoratedRows: document.querySelectorAll('#mc-wm-content tbody tr [data-wm-authority-state]').length,
      xmlParses: evidence.xmlParses,
      xmlParseMs: Math.round(evidence.xmlParseMs),
      workerCommands: evidence.workerCommands,
      statusHistory: evidence.statusHistory,
      longTasks: evidence.longTasks,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.busy, false, 'Weight Build must leave its busy state');
  if (injectStaleRating) {
    assert.equal(result.status, 'Error', 'changed Preview Rating must fail closed');
    assert.match(result.errorText, /authority changed during this build/);
    assert.equal(result.rows, 0, 'stale Weight results must not be published');
  } else {
    assert.ok(result.rows > 0, 'real 41-branch source must produce review rows');
    assert.equal(result.decoratedRows, result.rows, 'authority presentation must decorate every review row');
    assert.ok(result.elapsedMs < maxWallMs, 'Weight Build must finish within the wall-time budget');
    assert.ok(result.maxFrameGapMs <= maxFrameGapMs, 'Weight Build must keep the browser frame heartbeat responsive');
    if (masterPath) assert.ok(result.workerCommands.includes('RANK_WEIGHT_ISSUES'), 'imported 1,595-row master must rank in the dataset worker');
    if (repeatBuild) {
      await page.locator('#mc-wm-refresh').click();
      await page.waitForFunction(() => {
        const button = document.querySelector('#mc-wm-refresh');
        return button?.dataset.wmBusy !== 'true'
          && /shown|Error/.test(document.querySelector('#mc-wm-status')?.textContent || '');
      });
      const secondStatus = await page.locator('#mc-wm-status').innerText();
      assert.match(secondStatus, /shown/, 'second Build must use a fresh current snapshot');
      assert.equal(await page.locator('#mc-wm-content tbody tr').count(), result.rows);
      console.log(JSON.stringify({ secondBuildStatus: secondStatus }));
    }
    if (toggleRebuild) {
      await page.locator('#mc-wm-length-toggle').click();
      await page.locator('#mc-wm-refresh').click();
      await page.waitForFunction(() => {
        const button = document.querySelector('#mc-wm-refresh');
        return button?.dataset.wmBusy !== 'true'
          && /shown|Error/.test(document.querySelector('#mc-wm-status')?.textContent || '');
      });
      const rebuiltStatus = await page.locator('#mc-wm-status').innerText();
      assert.match(rebuiltStatus, /shown/, 'a local Weight rule save must allow the next Build');
      assert.equal(await page.locator('#mc-wm-content tbody tr').count(), result.rows);
      console.log(JSON.stringify({ localSaveRebuildStatus: rebuiltStatus }));
    }
  }
} finally {
  await browser.close();
}
