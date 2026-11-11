import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.VIBRATION_ROADMAP_BROWSER_URL || 'http://127.0.0.1:4173';
const pageUrl = `${baseUrl}/tests/browser/vibration-roadmap-viewport-audit.html`;
const outputDir = path.resolve(process.env.VIBRATION_UI012_OUTPUT_DIR || 'audit-output/vibration-ui-012');

function parseColor(value) {
  const match = String(value || '').match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)$/u);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] == null ? 1 : Number(match[4]) };
}

function composite(foreground, background) {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / a,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / a,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / a,
    a,
  };
}

function linearChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server unavailable at ${url}`);
}

async function focusByKeyboard(page, selector) {
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((value) => document.activeElement?.matches?.(value) === true, selector)) return true;
  }
  return false;
}

async function focusEvidence(page, target) {
  const reached = await focusByKeyboard(page, target.selector);
  if (!reached) return { id: target.id, selector: target.selector, reached: false };
  const styleEvidence = await page.locator(target.selector).first().evaluate((node) => {
    function parse(value) {
      const match = String(value || '').match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)$/u);
      if (!match) return null;
      return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] == null ? 1 : Number(match[4]) };
    }
    function over(fg, bg) {
      const a = fg.a + bg.a * (1 - fg.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
        g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
        b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
        a,
      };
    }
    const ancestors = [];
    let cursor = node.parentElement;
    while (cursor) {
      ancestors.unshift(cursor);
      cursor = cursor.parentElement;
    }
    let background = { r: 255, g: 255, b: 255, a: 1 };
    for (const ancestor of ancestors) {
      const parsed = parse(getComputedStyle(ancestor).backgroundColor);
      if (parsed && parsed.a > 0) background = over(parsed, background);
    }
    const style = getComputedStyle(node);
    return {
      tag: node.tagName,
      text: node.textContent?.trim().replace(/\s+/gu, ' ').slice(0, 100) ?? '',
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
      backdrop: background,
    };
  });

  const outline = parseColor(styleEvidence.outlineColor);
  const effectiveOutline = outline ? composite(outline, styleEvidence.backdrop) : null;
  const ratio = effectiveOutline ? contrastRatio(effectiveOutline, styleEvidence.backdrop) : null;
  const computedStyleContrastCheckApplicable = styleEvidence.outlineStyle !== 'auto';
  const screenshot = `focus-${target.id}.png`;
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
  return {
    id: target.id,
    selector: target.selector,
    reached: true,
    ...styleEvidence,
    effectiveOutline,
    outlineAdjacentContrastRatio: ratio,
    computedStyleContrastCheckApplicable,
    meetsThreeToOneContrast: computedStyleContrastCheckApplicable && ratio != null ? ratio >= 3 : null,
    screenshotVerificationRequired: !computedStyleContrastCheckApplicable,
    screenshot,
  };
}

await mkdir(outputDir, { recursive: true });
await waitForServer(pageUrl);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 550 } });
  await page.goto(`${pageUrl}?ui012=focus-appearance`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => globalThis.__VIBRATION_ROADMAP_UI012_READY__ === true);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#host').offsetTop + 60));

  const targets = [
    { id: 'resize', selector: '[data-roadmap-resize]' },
    { id: 'collapse', selector: '[data-roadmap-collapse]' },
    { id: 'import-eit', selector: '[data-roadmap-action="import-eit"]' },
    { id: 'open-case-task', selector: '[data-vibration-workspace-id]' },
    { id: 'assessment-select', selector: '[data-roadmap-assessment-select]' },
  ];

  const controls = [];
  for (const target of targets) controls.push(await focusEvidence(page, target));
  const report = {
    schema: 'VibrationRoadmapFocusAppearanceAudit.v1',
    viewport: { width: 1280, height: 550 },
    authority: {
      purpose: 'PRESENTATION_ACCESSIBILITY_BROWSER_EVIDENCE_ONLY',
      engineeringAuthority: 'NONE',
      screeningAuthority: 'NOT_AUTHORIZED',
      designAuthority: false,
      blocking: false,
    },
    interpretation: 'CSS_OUTLINE_AUTO_PAINTING_IS_BROWSER_THEME_DEPENDENT; COMPUTED_OUTLINE_COLOR_IS_NOT_AUTHORITATIVE_FOR_THE_PAINTED_FOCUS_RING. AUTO_OUTLINE_CONTROLS REQUIRE_SCREENSHOT_REVIEW.',
    controls,
    computedStyleFailures: controls.filter((control) => control.computedStyleContrastCheckApplicable && control.meetsThreeToOneContrast === false).map((control) => control.id),
    autoOutlineRequiresScreenshotReview: controls.filter((control) => control.screenshotVerificationRequired).map((control) => control.id),
  };
  await writeFile(path.join(outputDir, 'focus-appearance-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`VIBRATION_ROADMAP_UI012_FOCUS_SUMMARY=${JSON.stringify({ computedStyleFailures: report.computedStyleFailures, autoOutlineRequiresScreenshotReview: report.autoOutlineRequiresScreenshotReview, controls: controls.map(({ id, outlineStyle, outlineAdjacentContrastRatio }) => ({ id, outlineStyle, outlineAdjacentContrastRatio })) })}`);
  console.log('VIBRATION_ROADMAP_UI012_FOCUS_AUDIT=COMPLETE');
} finally {
  await browser.close();
}
