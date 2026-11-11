import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.VIBRATION_ROADMAP_BROWSER_URL || 'http://127.0.0.1:4173';
const pageUrl = `${baseUrl}/tests/browser/vibration-roadmap-viewport-audit.html`;
const outputDir = path.resolve(process.env.VIBRATION_UI012_OUTPUT_DIR || 'audit-output/vibration-ui-012');
const axePath = path.resolve('node_modules/axe-core/axe.min.js');

const viewports = [
  { width: 1440, height: 900, label: 'desktop-large' },
  { width: 1280, height: 720, label: 'desktop-standard' },
  { width: 1280, height: 550, label: 'desktop-short' },
  { width: 1181, height: 640, label: 'desktop-breakpoint-plus-one' },
  { width: 1179, height: 640, label: 'two-column-responsive' },
  { width: 899, height: 700, label: 'single-column-responsive' },
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

async function focusWithKeyboard(page, selector) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press('Tab');
    const matched = await page.evaluate((targetSelector) => document.activeElement?.matches?.(targetSelector) === true, selector);
    if (matched) return true;
  }
  return false;
}

async function focusIndicator(page, selector) {
  const reached = await focusWithKeyboard(page, selector);
  if (!reached) return { reached: false, visible: false };
  return page.locator(selector).evaluate((node) => {
    const style = getComputedStyle(node);
    const width = Number.parseFloat(style.outlineWidth || '0');
    const visible = (style.outlineStyle !== 'none' && width >= 1) || style.boxShadow !== 'none';
    return {
      reached: true,
      visible,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });
}

async function focusableVisibilityAudit(page) {
  const selectors = [
    '[data-roadmap-resize]',
    '[data-roadmap-collapse]',
    '[data-roadmap-action]',
    '[data-roadmap-assessment-select]',
    '[data-roadmap-node-id]:not(.is-informational)',
  ];
  let tested = 0;
  const failures = [];
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    for (let index = 0; index < count; index += 1) {
      const locator = page.locator(selector).nth(index);
      if (!(await locator.isVisible())) continue;
      tested += 1;
      await locator.scrollIntoViewIfNeeded();
      await locator.focus();
      const geometry = await locator.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const scroll = node.closest('.vibration-roadmap-scroll');
        const scrollRect = scroll?.getBoundingClientRect() ?? null;
        return {
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          scrollRect: scrollRect ? { top: scrollRect.top, bottom: scrollRect.bottom, left: scrollRect.left, right: scrollRect.right } : null,
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      const viewportVisible = geometry.rect.top >= -1
        && geometry.rect.bottom <= geometry.viewport.height + 1
        && geometry.rect.left >= -1
        && geometry.rect.right <= geometry.viewport.width + 1;
      const scrollVisible = !geometry.scrollRect || (
        geometry.rect.top >= geometry.scrollRect.top - 1
        && geometry.rect.bottom <= geometry.scrollRect.bottom + 1
        && geometry.rect.left >= geometry.scrollRect.left - 1
        && geometry.rect.right <= geometry.scrollRect.right + 1
      );
      if (!viewportVisible || !scrollVisible) failures.push({ selector, index, geometry, viewportVisible, scrollVisible });
    }
  }
  return { tested, failures };
}

async function viewportMetrics(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-vibration-roadmap-panel]');
    const scroll = document.querySelector('.vibration-roadmap-scroll');
    const layout = document.querySelector('.engineering-console-layout');
    const panelRect = panel?.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    const panelStyle = panel ? getComputedStyle(panel) : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      },
      layoutColumns: layout ? getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean).length : null,
      panel: panelRect ? {
        top: panelRect.top,
        bottom: panelRect.bottom,
        left: panelRect.left,
        right: panelRect.right,
        width: panelRect.width,
        height: panelRect.height,
        position: panelStyle?.position ?? null,
        maxHeight: panelStyle?.maxHeight ?? null,
      } : null,
      scroll: scrollRect ? {
        top: scrollRect.top,
        bottom: scrollRect.bottom,
        height: scrollRect.height,
        clientHeight: scroll.clientHeight,
        scrollHeight: scroll.scrollHeight,
        scrollTop: scroll.scrollTop,
        overflowY: getComputedStyle(scroll).overflowY,
      } : null,
    };
  });
}

async function scrollHandoffAudit(page) {
  await page.setViewportSize({ width: 1280, height: 550 });
  await page.goto(`${pageUrl}?ui012=handoff`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_UI012_READY__ === true);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#host').offsetTop + 60));
  const sticky = await page.locator('[data-vibration-roadmap-panel]').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, position: getComputedStyle(panel).position };
  });

  const scroll = page.locator('.vibration-roadmap-scroll');
  await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await scroll.hover();
  const outerBeforeDown = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(120);
  const outerAfterDown = await page.evaluate(() => scrollY);

  await scroll.evaluate((node) => { node.scrollTop = 0; });
  await scroll.hover();
  const outerBeforeUp = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(120);
  const outerAfterUp = await page.evaluate(() => scrollY);

  await scroll.evaluate((node) => { node.scrollTop = 0; });
  const lastFocusable = page.locator('.vibration-roadmap-scroll button:not(:disabled), .vibration-roadmap-scroll select').last();
  await lastFocusable.focus();
  const focusGeometry = await lastFocusable.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const scrollRect = node.closest('.vibration-roadmap-scroll').getBoundingClientRect();
    return {
      node: { top: rect.top, bottom: rect.bottom },
      scroll: { top: scrollRect.top, bottom: scrollRect.bottom },
      scrollTop: node.closest('.vibration-roadmap-scroll').scrollTop,
    };
  });

  return {
    sticky,
    wheelDownHandsOffToPage: outerAfterDown > outerBeforeDown,
    wheelUpHandsOffToPage: outerAfterUp < outerBeforeUp,
    outerBeforeDown,
    outerAfterDown,
    outerBeforeUp,
    outerAfterUp,
    focusScroll: {
      ...focusGeometry,
      visible: focusGeometry.node.top >= focusGeometry.scroll.top - 1 && focusGeometry.node.bottom <= focusGeometry.scroll.bottom + 1,
    },
  };
}

await mkdir(outputDir, { recursive: true });
await waitForServer(pageUrl);
const browser = await chromium.launch({ headless: true });
const report = {
  schema: 'VibrationRoadmapViewportAudit.v1',
  authority: {
    purpose: 'PRESENTATION_ACCESSIBILITY_BROWSER_EVIDENCE_ONLY',
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
  viewports: [],
  scrollHandoff: null,
};

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on('pageerror', (error) => console.error(`[browser:${viewport.label}:pageerror] ${error.stack || error}`));
    await page.goto(`${pageUrl}?ui012=${viewport.label}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_UI012_READY__ === true);
    await page.addScriptTag({ path: axePath });

    const metrics = await viewportMetrics(page);
    const focusableVisibility = await focusableVisibilityAudit(page);
    const collapseFocus = await focusIndicator(page, '[data-roadmap-collapse]');
    const resizeFocus = (await page.locator('[data-roadmap-resize]').count()) > 0
      ? await focusIndicator(page, '[data-roadmap-resize]')
      : { reached: false, visible: null, notApplicable: true };
    const contrast = await page.evaluate(async () => {
      const panel = document.querySelector('[data-vibration-roadmap-panel]');
      const result = await axe.run(panel, { runOnly: { type: 'rule', values: ['color-contrast'] } });
      return result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })),
      }));
    });

    const screenshot = path.join(outputDir, `${viewport.label}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.viewports.push({
      ...viewport,
      metrics,
      focusableVisibility,
      focusIndicators: { collapse: collapseFocus, resize: resizeFocus },
      contrastViolations: contrast,
      screenshot: path.basename(screenshot),
    });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 550 } });
  report.scrollHandoff = await scrollHandoffAudit(page);
  await page.screenshot({ path: path.join(outputDir, 'desktop-short-scroll-handoff.png'), fullPage: true });
  await page.close();

  report.summary = {
    viewportCount: report.viewports.length,
    horizontalOverflowViewports: report.viewports.filter((item) => item.metrics.document.horizontalOverflowPx > 1).map((item) => item.label),
    focusableClippingViewports: report.viewports.filter((item) => item.focusableVisibility.failures.length > 0).map((item) => item.label),
    contrastViolationViewports: report.viewports.filter((item) => item.contrastViolations.length > 0).map((item) => item.label),
    collapseFocusIndicatorFailures: report.viewports.filter((item) => item.focusIndicators.collapse.reached && !item.focusIndicators.collapse.visible).map((item) => item.label),
    resizeFocusIndicatorFailures: report.viewports.filter((item) => item.focusIndicators.resize.reached && item.focusIndicators.resize.visible === false).map((item) => item.label),
    stickyContainedAtShortDesktop: report.scrollHandoff.sticky.top >= -1 && report.scrollHandoff.sticky.bottom <= report.scrollHandoff.sticky.viewportHeight + 1,
    wheelDownHandsOffToPage: report.scrollHandoff.wheelDownHandsOffToPage,
    wheelUpHandsOffToPage: report.scrollHandoff.wheelUpHandsOffToPage,
    focusedControlScrolledIntoView: report.scrollHandoff.focusScroll.visible,
  };

  await writeFile(path.join(outputDir, 'ui012-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`VIBRATION_ROADMAP_UI012_SUMMARY=${JSON.stringify(report.summary)}`);
  console.log('VIBRATION_ROADMAP_UI012_AUDIT=COMPLETE');

  assert.equal(report.viewports.length, viewports.length);
} finally {
  await browser.close();
}
