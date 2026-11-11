import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.VIBRATION_ROADMAP_BROWSER_URL || 'http://127.0.0.1:4173';
const pageUrl = `${baseUrl}/tests/browser/vibration-roadmap-interaction.html`;
const presentationPreferenceKey = '3D_Converters.vibrationRoadmapPresentationPreference.v1';

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

async function roadmapWidth(page) {
  return Number(await page.locator('[data-vibration-roadmap-panel]').getAttribute('data-roadmap-width'));
}

await waitForServer(pageUrl);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.stack || error}`));

  await page.goto(`${pageUrl}?run=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_BROWSER_READY__ === true);

  const panel = page.locator('[data-vibration-roadmap-panel]');
  const handle = page.locator('[data-roadmap-resize]');
  await assert.doesNotReject(() => panel.waitFor({ state: 'visible' }));
  assert.equal(await panel.getAttribute('aria-labelledby'), 'vibration-roadmap-heading');
  assert.equal(await handle.getAttribute('aria-valuemin'), '260');
  assert.equal(await handle.getAttribute('aria-valuemax'), '520');
  assert.equal(await handle.getAttribute('aria-valuenow'), '320');

  const box = await handle.boundingBox();
  assert.ok(box, 'resize handle must have a browser bounding box');
  await page.mouse.move(box.x + (box.width / 2), box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + 40, { steps: 8 });
  await page.mouse.up();
  assert.ok((await roadmapWidth(page)) >= 410 && (await roadmapWidth(page)) <= 430, 'pointer resize should reach about 420 px');

  await handle.focus();
  await page.keyboard.press('End');
  assert.equal(await roadmapWidth(page), 520);
  assert.equal(await handle.getAttribute('aria-valuenow'), '520');
  assert.equal(await handle.getAttribute('aria-valuetext'), '520 pixels');

  const focusTarget = page.locator('button[data-roadmap-node-id]').last();
  await focusTarget.scrollIntoViewIfNeeded();
  await focusTarget.focus();
  const before = await page.evaluate(() => {
    const scroll = document.querySelector('.vibration-roadmap-scroll');
    const active = document.activeElement;
    scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight - 40);
    return {
      scrollTop: scroll.scrollTop,
      nodeId: active?.dataset?.roadmapNodeId ?? null,
    };
  });
  assert.ok(before.nodeId, 'expected a focusable roadmap node');
  await page.evaluate(() => globalThis.__VIBRATION_ROADMAP_BROWSER__.dispatchState({ mechanismStates: {} }));
  const after = await page.evaluate(() => ({
    scrollTop: document.querySelector('.vibration-roadmap-scroll')?.scrollTop ?? -1,
    nodeId: document.activeElement?.dataset?.roadmapNodeId ?? null,
  }));
  assert.equal(after.nodeId, before.nodeId, 'state refresh must restore semantic rail focus');
  assert.ok(Math.abs(after.scrollTop - before.scrollTop) <= 2, 'state refresh must preserve rail scroll position');

  const collapse = page.locator('[data-roadmap-collapse]');
  assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
  await collapse.click();
  assert.equal(await page.locator('[data-roadmap-collapse]').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('[data-roadmap-resize]').count(), 0);
  await page.locator('[data-roadmap-collapse]').click();
  assert.equal(await roadmapWidth(page), 520);
  assert.equal(await page.locator('[data-roadmap-resize]').getAttribute('aria-valuenow'), '520');

  await page.getByRole('button', { name: 'Open case task' }).click();
  assert.equal(await page.evaluate(() => globalThis.__VIBRATION_ROADMAP_BROWSER__.counters.workspace), 1);
  await page.evaluate(() => globalThis.__VIBRATION_ROADMAP_BROWSER__.removeWorkspaceTarget());
  await page.getByRole('button', { name: 'Open case task' }).click();
  const navDiagnostic = page.locator('[data-roadmap-navigation-message]');
  await navDiagnostic.waitFor({ state: 'visible' });
  assert.equal(await navDiagnostic.getAttribute('data-roadmap-navigation-code'), 'VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND');
  assert.equal(await navDiagnostic.getAttribute('role'), 'alert');

  const scope = page.locator('[data-roadmap-assessment-select]');
  await scope.selectOption('row-b');
  assert.equal(await page.evaluate(() => globalThis.__VIBRATION_ROADMAP_BROWSER__.counters.rowB), 1);
  await page.evaluate(() => globalThis.__VIBRATION_ROADMAP_BROWSER__.removeAssessmentTarget('row-a'));
  await scope.selectOption('row-a');
  const assessmentDiagnostic = page.locator('[data-roadmap-navigation-code="VIBRATION_ROADMAP_ASSESSMENT_TARGET_NOT_FOUND"]');
  await assessmentDiagnostic.waitFor({ state: 'visible' });

  const input = page.locator('[data-roadmap-project-file]');
  await input.setInputFiles({ name: 'invalid.vibproj', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  const projectAlert = page.locator('.vibration-roadmap-project [role="alert"]');
  await projectAlert.waitFor({ state: 'visible' });
  assert.equal(await projectAlert.getAttribute('aria-live'), 'assertive');

  await page.setViewportSize({ width: 1179, height: 900 });
  const columns1179 = await page.locator('.engineering-console-layout').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
  assert.equal(columns1179, 2);
  await page.setViewportSize({ width: 899, height: 900 });
  const columns899 = await page.locator('.engineering-console-layout').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
  assert.equal(columns899, 1);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-roadmap-collapse]').click();
  const storedPreference = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), presentationPreferenceKey);
  assert.deepEqual(storedPreference, {
    schema: 'VibrationRoadmapPresentationPreference.v1',
    roadmapWidth: 520,
    collapsed: true,
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_BROWSER_READY__ === true);
  assert.equal(await roadmapWidth(page), 520, 'stored roadmap width must survive controller recreation');
  assert.equal(await page.locator('[data-roadmap-collapse]').getAttribute('aria-expanded'), 'false', 'stored collapsed state must survive controller recreation');
  assert.equal(await page.locator('[data-roadmap-resize]').count(), 0);
  await page.locator('[data-roadmap-collapse]').click();
  assert.equal(await roadmapWidth(page), 520);

  console.log('VIBRATION_ROADMAP_BROWSER_REGRESSION=PASS');
} finally {
  await browser.close();
}
