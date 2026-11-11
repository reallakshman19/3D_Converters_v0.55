import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const baseUrl = process.env.VIBRATION_ROADMAP_BROWSER_URL || 'http://127.0.0.1:4173';
const pageUrl = `${baseUrl}/tests/browser/vibration-roadmap-viewport-audit.html`;
const outputDir = path.resolve(process.env.VIBRATION_UI_PORTABILITY_OUTPUT_DIR || 'audit-output/vibration-ui-portability');
const axePath = path.resolve('node_modules/axe-core/axe.min.js');

const engineMatrix = [
  { name: 'firefox', launcher: firefox },
  { name: 'webkit', launcher: webkit },
];

const viewports = [
  { width: 1280, height: 550, label: 'desktop-short' },
  { width: 768, height: 640, label: 'narrow-single-column' },
];

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

async function getBasicMetrics(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-vibration-roadmap-panel]');
    const scroll = document.querySelector('.vibration-roadmap-scroll');
    const layout = document.querySelector('.engineering-console-layout');
    const panelRect = panel?.getBoundingClientRect() ?? null;
    return {
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      layoutColumns: layout ? getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean).length : null,
      panel: panelRect ? {
        top: panelRect.top,
        bottom: panelRect.bottom,
        left: panelRect.left,
        right: panelRect.right,
        width: panelRect.width,
        height: panelRect.height,
        position: getComputedStyle(panel).position,
      } : null,
      scroll: scroll ? {
        clientHeight: scroll.clientHeight,
        scrollHeight: scroll.scrollHeight,
        overflowY: getComputedStyle(scroll).overflowY,
      } : null,
    };
  });
}

async function auditFocusableVisibility(page) {
  const selectors = [
    '[data-roadmap-resize]',
    '[data-roadmap-collapse]',
    '[data-roadmap-action]',
    '[data-roadmap-assessment-select]',
    '[data-roadmap-node-id]:not(.is-informational)',
  ];
  const failures = [];
  let tested = 0;
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    for (let index = 0; index < count; index += 1) {
      const locator = page.locator(selector).nth(index);
      if (!(await locator.isVisible())) continue;
      tested += 1;
      await locator.scrollIntoViewIfNeeded();
      await locator.focus();
      const visible = await locator.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const scroll = node.closest('.vibration-roadmap-scroll');
        const scrollRect = scroll?.getBoundingClientRect() ?? null;
        const viewportVisible = rect.top >= -1 && rect.bottom <= innerHeight + 1 && rect.left >= -1 && rect.right <= innerWidth + 1;
        const scrollVisible = !scrollRect || (rect.top >= scrollRect.top - 1 && rect.bottom <= scrollRect.bottom + 1 && rect.left >= scrollRect.left - 1 && rect.right <= scrollRect.right + 1);
        return { viewportVisible, scrollVisible };
      });
      if (!visible.viewportVisible || !visible.scrollVisible) failures.push({ selector, index, ...visible });
    }
  }
  return { tested, failures };
}

async function auditCoreInteraction(page, viewport) {
  const collapse = page.locator('[data-roadmap-collapse]');
  const before = await collapse.getAttribute('aria-expanded');
  await collapse.click();
  const collapsed = await collapse.getAttribute('aria-expanded');
  await collapse.click();
  const expanded = await collapse.getAttribute('aria-expanded');

  const handle = page.locator('[data-roadmap-resize]').first();
  const resizeCount = await handle.count();
  const resizeVisible = resizeCount > 0 && await handle.isVisible();
  let resize = { present: resizeVisible, keyboardEndValue: null };
  if (resizeVisible) {
    await handle.focus();
    await page.keyboard.press('End');
    resize.keyboardEndValue = await handle.getAttribute('aria-valuenow');
  }

  return {
    collapse: { before, collapsed, expanded },
    resize,
    expectedResizePresent: viewport.width > 1180,
  };
}

async function axeContrast(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const panel = document.querySelector('[data-vibration-roadmap-panel]');
    const result = await axe.run(panel, { runOnly: { type: 'rule', values: ['color-contrast'] } });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
    }));
  });
}

async function runEngine(engine) {
  const browser = await engine.launcher.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
      await page.goto(`${pageUrl}?portability=${engine.name}-${viewport.label}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_UI012_READY__ === true);
      const metrics = await getBasicMetrics(page);
      const focusableVisibility = await auditFocusableVisibility(page);
      const interaction = await auditCoreInteraction(page, viewport);
      const contrastViolations = await axeContrast(page);
      const screenshot = `${engine.name}-${viewport.label}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
      results.push({ ...viewport, pageErrors, metrics, focusableVisibility, interaction, contrastViolations, screenshot });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function runForcedColors() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 550 } });
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(`${pageUrl}?portability=chromium-forced-colors`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_UI012_READY__ === true);

    const selectors = [
      '[data-roadmap-resize]',
      '[data-roadmap-collapse]',
      '[data-roadmap-action="import-eit"]',
      '[data-vibration-workspace-id]',
      '[data-roadmap-assessment-select]',
    ];
    const controls = [];
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0 || !(await locator.isVisible())) continue;
      await locator.scrollIntoViewIfNeeded();
      await locator.focus();
      const evidence = await locator.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          color: style.color,
          backgroundColor: style.backgroundColor,
          visibleInViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1 && rect.left >= -1 && rect.right <= innerWidth + 1,
        };
      });
      controls.push({ selector, ...evidence });
    }

    const metrics = await getBasicMetrics(page);
    const screenshot = 'chromium-forced-colors-1280x550.png';
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
    return { metrics, controls, screenshot };
  } finally {
    await browser.close();
  }
}

await mkdir(outputDir, { recursive: true });
await waitForServer(pageUrl);

const report = {
  schema: 'VibrationRoadmapPortabilityAudit.v1',
  authority: {
    purpose: 'PRESENTATION_ACCESSIBILITY_BROWSER_PORTABILITY_EVIDENCE_ONLY',
    engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    projectPersistenceAuthority: 'NONE',
    calculationExecutionAuthority: 'NONE',
    determinesApplicability: false,
    determinesCompleteness: false,
    blocking: false,
  },
  generatedAt: new Date().toISOString(),
  engines: {},
  forcedColors: null,
};

for (const engine of engineMatrix) report.engines[engine.name] = await runEngine(engine);
report.forcedColors = await runForcedColors();

const engineFindings = [];
for (const [engine, results] of Object.entries(report.engines)) {
  for (const result of results) {
    if (result.pageErrors.length) engineFindings.push({ engine, viewport: result.label, code: 'PAGE_ERROR', detail: result.pageErrors });
    if (result.metrics.horizontalOverflowPx > 1) engineFindings.push({ engine, viewport: result.label, code: 'HORIZONTAL_OVERFLOW', detail: result.metrics.horizontalOverflowPx });
    if (result.focusableVisibility.failures.length) engineFindings.push({ engine, viewport: result.label, code: 'FOCUSABLE_CLIPPING', detail: result.focusableVisibility.failures });
    if (result.contrastViolations.length) engineFindings.push({ engine, viewport: result.label, code: 'COLOR_CONTRAST', detail: result.contrastViolations });
    if (result.interaction.collapse.before !== 'true' || result.interaction.collapse.collapsed !== 'false' || result.interaction.collapse.expanded !== 'true') {
      engineFindings.push({ engine, viewport: result.label, code: 'COLLAPSE_INTERACTION_MISMATCH', detail: result.interaction.collapse });
    }
    if (result.interaction.resize.present !== result.interaction.expectedResizePresent) {
      engineFindings.push({ engine, viewport: result.label, code: 'RESIZE_RESPONSIVE_MISMATCH', detail: result.interaction });
    }
    if (result.interaction.resize.present && result.interaction.resize.keyboardEndValue !== '520') {
      engineFindings.push({ engine, viewport: result.label, code: 'RESIZE_KEYBOARD_MISMATCH', detail: result.interaction.resize });
    }
  }
}

const forcedColorFindings = [];
if (report.forcedColors.metrics.horizontalOverflowPx > 1) forcedColorFindings.push({ code: 'HORIZONTAL_OVERFLOW', detail: report.forcedColors.metrics.horizontalOverflowPx });
for (const control of report.forcedColors.controls) {
  const outlineWidth = Number.parseFloat(control.outlineWidth || '0');
  const hasFocusIndicator = (control.outlineStyle !== 'none' && outlineWidth >= 1) || control.boxShadow !== 'none';
  if (!hasFocusIndicator || !control.visibleInViewport) forcedColorFindings.push({ code: 'FOCUS_INDICATOR_OR_VISIBILITY', detail: control });
}

report.summary = {
  engineFindingCount: engineFindings.length,
  engineFindings,
  forcedColorFindingCount: forcedColorFindings.length,
  forcedColorFindings,
};

await writeFile(path.join(outputDir, 'portability-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`VIBRATION_ROADMAP_PORTABILITY_SUMMARY=${JSON.stringify(report.summary)}`);
console.log('VIBRATION_ROADMAP_PORTABILITY_AUDIT=COMPLETE');

assert.equal(Object.keys(report.engines).length, 2);
assert.ok(report.forcedColors);
