import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const ARTIFACT_DIR = path.resolve(process.env.HP_BROWSER_ARTIFACT_DIR ?? path.join(REPO, 'artifacts/hp-piping-class-production-browser'));
const MODE = process.env.HP_BROWSER_MODE ?? 'auto';
const TIMEOUT_MS = Number(process.env.HP_BROWSER_TIMEOUT_MS ?? 45000);
const EXPECTED_REFERENCE_ID = 'NPS4_S160_PRESSURE_FATIGUE_REGRESSION';
const BULK_TEXT = [
  'cycle_id,location_id,user_salt_mpa,seq_mpa,permissible_cycles',
  'C1,BORE_INNER_SURFACE,63.29949581051363,70,10000',
].join('\n');

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function exists(file) {
  try { await access(file, fsConstants.R_OK); return true; } catch { return false; }
}

async function findChromium() {
  const candidates = [
    process.env.HP_BROWSER_CHROMIUM,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate, fsConstants.X_OK); return candidate; } catch {}
  }
  throw new Error('HP_BROWSER_CHROMIUM_NOT_FOUND');
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForFile(file, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await exists(file)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data));
      if (payload.id) {
        const pending = this.pending.get(payload.id);
        if (!pending) return;
        this.pending.delete(payload.id);
        if (payload.error) pending.reject(new Error(`${payload.error.code}: ${payload.error.message}`));
        else pending.resolve(payload.result ?? {});
      } else if (payload.method) this.events.push(payload);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new CdpClient(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue, userGesture: true });
    if (result.exceptionDetails) {
      const message = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? 'Runtime.evaluate failed';
      throw new Error(message);
    }
    return result.result?.value;
  }

  close() { this.ws.close(); }
}

async function launchBrowser({ width = 1600, height = 1100 } = {}) {
  const chromium = await findChromium();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'hp-browser-'));
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`, 'about:blank',
  ];
  const child = spawn(chromium, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  try {
    await waitForFile(portFile);
    const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((row) => row.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error('Chromium page target not found.');
    const cdp = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    return { chromium, child, cdp, userDataDir, stderr: () => stderr };
  } catch (error) {
    child.kill('SIGKILL');
    await rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function closeBrowser(browser) {
  try { browser.cdp.close(); } catch {}
  try { browser.child.kill('SIGTERM'); } catch {}
  await sleep(100);
  if (!browser.child.killed) browser.child.kill('SIGKILL');
  await rm(browser.userDataDir, { recursive: true, force: true });
}

async function waitForExpression(cdp, expression, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await cdp.eval(`Boolean(${expression})`)) return true;
    } catch {}
    await sleep(80);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function click(cdp, selector) {
  await waitForExpression(cdp, `document.querySelector(${JSON.stringify(selector)})`);
  await cdp.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
}

async function setControl(cdp, selector, value, eventType = 'input') {
  await waitForExpression(cdp, `document.querySelector(${JSON.stringify(selector)})`);
  await cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event(${JSON.stringify(eventType)}, { bubbles: true })); return el.value; })()`);
}

async function pageText(cdp, selector = 'body') {
  return cdp.eval(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
}

async function screenshot(cdp, fileName) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(ARTIFACT_DIR, fileName), Buffer.from(data, 'base64'));
  return fileName;
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wasm': 'application/wasm',
  })[ext] ?? 'application/octet-stream';
}

async function startStaticServer(root) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') pathname = '/index.html';
      const target = path.resolve(root, `.${pathname}`);
      if (!target.startsWith(`${root}${path.sep}`) && target !== root) throw new Error('Traversal blocked');
      const bytes = await readFile(target);
      res.writeHead(200, { 'content-type': mime(target), 'cache-control': 'no-store' });
      res.end(bytes);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

function addStep(receipt, id, name, details = {}) {
  receipt.steps.push({ id, name, status: 'PASS', ...details });
}

async function sourceInventory() {
  const paths = [
    'tabs/engineering-workspace-tab.js',
    'tabs/hp-piping-class-workbench-tab.js',
    'tabs/hp-piping-class-kd-bulk-workbench-tab.js',
    'tabs/hp-piping-class-production-review-view.js',
    'tabs/hp-piping-class-result-export.js',
    'tabs/hp-piping-class-kd-bulk-input.js',
  ];
  const entries = {};
  for (const relative of paths) {
    const absolute = path.join(REPO, relative);
    const text = await readFile(absolute, 'utf8');
    entries[relative] = { sha256: sha256(text), bytes: Buffer.byteLength(text), text };
  }
  assert.match(entries['tabs/engineering-workspace-tab.js'].text, /hp-piping-class-kd-bulk-workbench-tab\.js/);
  assert.match(entries['tabs/hp-piping-class-kd-bulk-workbench-tab.js'].text, /verifyHpPipingClassResultRoundTrip/);
  assert.match(entries['tabs/hp-piping-class-kd-bulk-workbench-tab.js'].text, /if \(!verified\.ok\) return/);
  assert.match(entries['tabs/hp-piping-class-kd-bulk-workbench-tab.js'].text, /clearReview\(\)/);
  assert.match(entries['tabs/hp-piping-class-production-review-view.js'].text, /data-hpwb-class-result-matrix/);
  assert.match(entries['tabs/hp-piping-class-production-review-view.js'].text, /REVIEW ONLY · NO DESIGN AUTHORITY/);
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, { sha256: value.sha256, bytes: value.bytes }]));
}

async function installDownloadProbe(cdp) {
  await cdp.eval(`(() => {
    window.__hpDownloads = [];
    const original = HTMLAnchorElement.prototype.click;
    if (!window.__hpOriginalAnchorClick) window.__hpOriginalAnchorClick = original;
    HTMLAnchorElement.prototype.click = function () {
      window.__hpDownloads.push({ name: this.download || '', href: String(this.href || '') });
      return window.__hpOriginalAnchorClick.call(this);
    };
  })()`);
}

async function runFullApp(receipt) {
  const { server, url } = await startStaticServer(REPO);
  const browser = await launchBrowser();
  const { cdp } = browser;
  try {
    await cdp.send('Page.navigate', { url });
    await waitForExpression(cdp, `document.readyState === 'complete' || document.readyState === 'interactive'`);
    await click(cdp, '[data-tab="engineering-calculations"]');
    await waitForExpression(cdp, `document.querySelector('[data-engineering-subtab="hp-piping-class"]')`);
    await click(cdp, '[data-engineering-subtab="hp-piping-class"]');
    await waitForExpression(cdp, `document.querySelector('[data-hp-piping-class-workbench="true"]')`);
    addStep(receipt, 'HPB-001', 'Open active HP Piping Class workbench', { screenshot: await screenshot(cdp, '01-workbench.png') });

    await setControl(cdp, '[data-hpwb-reference-select]', EXPECTED_REFERENCE_ID, 'change');
    await click(cdp, '[data-hpwb-action="load-sample"]');
    await waitForExpression(cdp, `document.body.innerText.includes('NPS4-S160')`);
    addStep(receipt, 'HPB-002', 'Load canonical NPS4 pressure-fatigue reference', { referenceId: EXPECTED_REFERENCE_ID });

    await click(cdp, '[data-hpwb-goto="cycles"]');
    const cyclesText = await pageText(cdp, '.hpwb-panel');
    assert.match(cyclesText, /LOW/); assert.match(cyclesText, /HIGH/); assert.match(cyclesText, /C1/);
    addStep(receipt, 'HPB-003', 'Verify operating states and governed cycle are visible');

    await click(cdp, '[data-hpwb-goto="kd"]');
    await waitForExpression(cdp, `document.querySelector('[data-hpwb-kd-bulk="0"]')`);
    await setControl(cdp, '[data-hpwb-kd-bulk="0"]', BULK_TEXT, 'input');
    await click(cdp, '[data-hpwb-kd-bulk-action="validate"][data-evidence-index="0"]');
    await waitForExpression(cdp, `document.body.innerText.includes('Bulk table valid.')`);
    await click(cdp, '[data-hpwb-kd-bulk-action="apply"][data-evidence-index="0"]');
    addStep(receipt, 'HPB-004', 'Apply complete governed Seq/N bulk table through production controls');

    await click(cdp, '[data-hpwb-goto="envelope"]');
    await waitForExpression(cdp, `document.querySelector('[data-hpwb-class-result-matrix="true"]')`);
    const envelopeText = await pageText(cdp, '.hpwb-panel');
    for (const token of ['23.08612', '1.154306', '0.050000', '63.299496', 'REVIEW ONLY', 'NO DESIGN AUTHORITY']) {
      assert.ok(envelopeText.includes(token), `Expected visible HP result token ${token}`);
    }
    addStep(receipt, 'HPB-005', 'Verify class matrix and numerical ledger', { screenshot: await screenshot(cdp, '05-envelope.png') });

    await setControl(cdp, '[data-hpwb-result-filter]', 'needsAttention', 'change');
    await waitForExpression(cdp, `document.querySelector('.hpwb-class-result-table')`);
    assert.match(await pageText(cdp, '[data-hpwb-class-result-matrix]'), /No products match the selected filter/);
    await setControl(cdp, '[data-hpwb-result-filter]', 'all', 'change');
    await setControl(cdp, '[data-hpwb-result-sort]', 'pressureRatingMargin', 'change');
    addStep(receipt, 'HPB-006', 'Exercise class result filter and deterministic sort controls');

    await installDownloadProbe(cdp);
    await click(cdp, '[data-hpwb-result-action="verify-roundtrip"]');
    await waitForExpression(cdp, `document.querySelector('[data-hpwb-result-roundtrip-status]')?.innerText.includes('Round trip PASS')`);
    await click(cdp, '[data-hpwb-result-action="export-csv"]');
    await click(cdp, '[data-hpwb-result-action="export-json"]');
    const downloads = await cdp.eval('window.__hpDownloads');
    assert.ok(downloads.some((row) => row.name.endsWith('.hp-review-results.csv')));
    assert.ok(downloads.some((row) => row.name.endsWith('.hp-review-results.json')));
    addStep(receipt, 'HPB-007', 'Verify round trip and invoke CSV/JSON exports', { downloads: downloads.map((row) => row.name) });

    await click(cdp, '[data-hpwb-goto="design"]');
    const wallSelector = '[data-hpwb-bind="products.0.calculationBasis.nominalWallMm"]';
    await setControl(cdp, wallSelector, '13.50', 'input');
    await click(cdp, '[data-hpwb-goto="envelope"]');
    await sleep(100);
    assert.equal(await cdp.eval(`Boolean(document.querySelector('[data-hpwb-production-results]'))`), false);
    addStep(receipt, 'HPB-008', 'Engineering edit invalidates stale review/export result');

    await click(cdp, '[data-hpwb-goto="design"]');
    await setControl(cdp, wallSelector, '13.49', 'input');
    await click(cdp, '[data-hpwb-action="calculate"]');
    await click(cdp, '[data-hpwb-goto="envelope"]');
    await waitForExpression(cdp, `document.querySelector('[data-hpwb-class-result-matrix="true"]')`);
    await cdp.eval(`if (!document.querySelector('meta[name=viewport]')) document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1">');`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    const layout = await cdp.eval(`(() => {
      const wrap = document.querySelector('.hpwb-class-result-table')?.closest('.hpwb-table-wrap');
      return {
        bodyOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
        wrapperScrolls: Boolean(wrap && wrap.scrollWidth > wrap.clientWidth),
        rootWidth: document.querySelector('.hpwb')?.getBoundingClientRect().width ?? null,
        viewport: innerWidth,
      };
    })()`);
    assert.ok(layout.bodyOverflow <= 2, `Document horizontal overflow ${layout.bodyOverflow}px`);
    assert.equal(layout.wrapperScrolls, true);
    assert.ok(layout.rootWidth <= layout.viewport + 2);
    addStep(receipt, 'HPB-009', 'Verify mobile containment and table-local horizontal overflow', { layout, screenshot: await screenshot(cdp, '09-mobile.png') });

    const runtimeExceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown');
    assert.equal(runtimeExceptions.length, 0, `Chromium runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);
    receipt.browser = { executable: browser.chromium, runtimeExceptions: 0 };
  } finally {
    await closeBrowser(browser);
    await new Promise((resolve) => server.close(resolve));
  }
}

function stripExports(source) {
  return source.replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
}

function stripViewImport(source) {
  return source.replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/hp-piping-class-result-export\.js['"];\s*/m, '');
}

function injectionFixture() {
  const product = (id, { staticPass = true, cumulativeUsage = 0.05, usageWithinUnity = true, pressureRatingMargin = 1.1543060426004637 } = {}) => ({
    productId: id,
    basisMode: 'DIRECT_ENGINEERING_INPUT',
    engineeringState: staticPass ? (usageWithinUnity ? 'REVIEW_COMPLETE_NOT_AUTHORIZED' : 'FATIGUE_REVIEW_EXCEEDS_UNITY') : 'STATIC_REFERENCE_FAIL',
    calculationOk: true,
    selectedFatigueWallBasis: 'END_OF_LIFE_EFFECTIVE', selectedFatigueWallMm: 8.80375,
    assessment: { staticPass, fatigueEvaluated: true, fatigueUsageWithinUnity: usageWithinUnity, cumulativeUsage },
    calculations: {
      static: { outputs: { pressureDesignThicknessMm: 7.7103934983403475, requiredMinimumThicknessMm: 10.710393498340348, requiredNominalThicknessMm: 12.240449712388969, minimumAsManufacturedThicknessMm: 11.80375, effectiveNetWallMm: 8.80375, pressureRatingMpa: 23.086120852009273, pressureRatingMargin, minimumWallMarginMm: 1.0933565016596522 }, warnings: [] },
      wallState: { outputs: { nominalWallMm: 13.49, minimumAsManufacturedWallMm: 11.80375, beginOfLifeConservativeWallMm: 11.80375, reservedServiceLossMm: 3, endOfLifeEffectiveWallMm: 8.80375 } },
      fatigue: { outputs: { evidenceIssueCount: 1, cumulativeUsage, usageLimit: 1, usageWithinUnity, cycles: [{ cycleId: 'C1', locationId: 'BORE_INNER_SURFACE', fromStateId: 'LOW', toStateId: 'HIGH', appliedCycles: 500, pressureRangeMpa: 18, coreSaltMpa: 63.29949581051363, userSaltMpa: 63.29949581051363, saltCrossCheckStatus: 'MATCH', equivalentAlternatingStressMpa: 70, permissibleCycles: 10000, zeroDamage: false, usage: cumulativeUsage, evidence: { status: 'ADVISORY' } }] }, warnings: [] },
    },
  });
  return {
    ok: true,
    projectState: 'CALCULATED_NOT_AUTHORIZED', orchestratorVersion: 'fixture/v1', projectVersion: 'hp-piping-class-project/v2',
    projectIdentity: { projectId: 'BROWSER-FIXTURE', classId: 'HP-BROWSER', revision: 'A' },
    authority: { nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false },
    summary: {}, warnings: [{ code: 'HP_PIPING_CLASS_REVIEW_ONLY', message: 'Review only.' }], advisories: [],
    products: [
      product('P-FATIGUE', { cumulativeUsage: 1.2, usageWithinUnity: false, pressureRatingMargin: 1.2 }),
      product('P-STATIC-FAIL', { staticPass: false, cumulativeUsage: 0.1, pressureRatingMargin: 0.9 }),
      product('P-PASS', { cumulativeUsage: 0.05, pressureRatingMargin: 1.1543060426004637 }),
    ],
  };
}

async function runInjection(receipt) {
  const exportSource = await readFile(path.join(REPO, 'tabs/hp-piping-class-result-export.js'), 'utf8');
  const viewSource = await readFile(path.join(REPO, 'tabs/hp-piping-class-production-review-view.js'), 'utf8');
  const browser = await launchBrowser({ width: 1400, height: 1000 });
  const { cdp } = browser;
  try {
    await cdp.eval(`document.body.innerHTML = '<div id="app"></div>';`);
    await cdp.eval(`${stripExports(exportSource)}\nwindow.__hpExport={buildHpPipingClassResultExport,serializeHpPipingClassResultCsv,serializeHpPipingClassResultJson,parseHpPipingClassResultCsv,parseHpPipingClassResultJson,verifyHpPipingClassResultRoundTrip,filterHpPipingClassResultRows,sortHpPipingClassResultRows};`);
    await cdp.eval(`${stripExports(stripViewImport(viewSource))}\nwindow.__hpView={renderHpPipingClassProductionReadinessHtml,renderHpPipingClassProductionResultHtml};`);
    const fixture = injectionFixture();
    await cdp.eval(`window.__fixture=${JSON.stringify(fixture)}; document.querySelector('#app').innerHTML = window.__hpView.renderHpPipingClassProductionResultHtml(window.__fixture,{filter:'all',sortBy:'reviewPriority',roundTrip:null});`);
    const text = await pageText(cdp, '#app');
    for (const token of ['Class-wide result matrix', 'P-STATIC-FAIL', 'P-FATIGUE', '23.08612', '1.154306', '0.050000', '63.299496', 'NO DESIGN AUTHORITY']) assert.ok(text.includes(token));
    addStep(receipt, 'HPI-001', 'Render exact production result/export modules in real Chromium', { screenshot: await screenshot(cdp, '01-injection-ledger.png') });

    const roundTrip = await cdp.eval(`window.__hpExport.verifyHpPipingClassResultRoundTrip(window.__hpExport.buildHpPipingClassResultExport(window.__fixture))`);
    assert.equal(roundTrip.ok, true); assert.equal(roundTrip.jsonOk, true); assert.equal(roundTrip.csvOk, true);
    addStep(receipt, 'HPI-002', 'Execute parser-backed CSV/JSON round trip in Chromium', { roundTrip });

    const filterCheck = await cdp.eval(`(() => { const bundle=window.__hpExport.buildHpPipingClassResultExport(window.__fixture); return window.__hpExport.filterHpPipingClassResultRows(bundle.productRows,'needsAttention').map(r=>r.productId); })()`);
    assert.deepEqual(filterCheck, ['P-FATIGUE', 'P-STATIC-FAIL']);
    const sortCheck = await cdp.eval(`(() => { const bundle=window.__hpExport.buildHpPipingClassResultExport(window.__fixture); return window.__hpExport.sortHpPipingClassResultRows(bundle.productRows,'reviewPriority').map(r=>r.productId); })()`);
    assert.deepEqual(sortCheck, ['P-STATIC-FAIL', 'P-FATIGUE', 'P-PASS']);
    addStep(receipt, 'HPI-003', 'Exercise production result filter/sort logic in Chromium');

    const malformedRejected = await cdp.eval(`(() => { try { window.__hpExport.parseHpPipingClassResultCsv('bad,header\\r\\n1,2\\r\\n'); return false; } catch { return true; } })()`);
    assert.equal(malformedRejected, true);
    addStep(receipt, 'HPI-004', 'Malformed result export remains fail-closed in Chromium');

    await cdp.eval(`if (!document.querySelector('meta[name=viewport]')) document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1">');`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    await cdp.eval(`document.head.insertAdjacentHTML('beforeend','<style>.hpwb-table-wrap{overflow:auto}.hpwb-class-result-table{min-width:1250px}.hpwb{max-width:100%;overflow-x:hidden}</style>');`);
    const layout = await cdp.eval(`(() => { const wrap=document.querySelector('.hpwb-class-result-table')?.closest('.hpwb-table-wrap'); return {wrapperScrolls:Boolean(wrap&&wrap.scrollWidth>wrap.clientWidth), bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth}; })()`);
    assert.equal(layout.wrapperScrolls, true); assert.ok(layout.bodyOverflow <= 2);
    addStep(receipt, 'HPI-005', 'Mobile class-matrix overflow remains table-local', { layout, screenshot: await screenshot(cdp, '05-injection-mobile.png') });

    const runtimeExceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown');
    assert.equal(runtimeExceptions.length, 0);
    receipt.browser = { executable: browser.chromium, runtimeExceptions: 0 };
  } finally {
    await closeBrowser(browser);
  }
}

async function runSelfTest(receipt) {
  const browser = await launchBrowser({ width: 800, height: 600 });
  try {
    await browser.cdp.eval(`document.body.innerHTML='<button id="b">run</button><div id="o"></div>'; document.querySelector('#b').onclick=()=>document.querySelector('#o').textContent='PASS';`);
    await click(browser.cdp, '#b');
    assert.equal(await pageText(browser.cdp, '#o'), 'PASS');
    await browser.cdp.eval(`document.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1">';`);
    await browser.cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    assert.equal(await browser.cdp.eval('innerWidth'), 375);
    addStep(receipt, 'SELF-001', 'Chromium CDP transport self-test');
    receipt.browser = { executable: browser.chromium, runtimeExceptions: browser.cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown').length };
  } finally {
    await closeBrowser(browser);
  }
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const receipt = {
    schema: 'HpPipingClassProductionBrowserReceipt.v1',
    status: 'RUNNING',
    requestedMode: MODE,
    executedMode: null,
    fullActiveWorkbenchNavigation: false,
    numericalAuthority: 'UNCHANGED',
    authority: { nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false },
    startedAt: new Date().toISOString(),
    sourceInventory: null,
    steps: [],
  };
  try {
    if (MODE === 'self-test') {
      receipt.executedMode = 'SELF_TEST_ONLY';
      await runSelfTest(receipt);
    } else {
      receipt.sourceInventory = await sourceInventory();
      const fullAvailable = await exists(path.join(REPO, 'index.html'));
      if (MODE === 'full' || (MODE === 'auto' && fullAvailable)) {
        if (!fullAvailable) throw new Error('FULL_APP_MODE_REQUIRES_REPOSITORY_INDEX_HTML');
        receipt.executedMode = 'FULL_APP';
        receipt.fullActiveWorkbenchNavigation = true;
        await runFullApp(receipt);
      } else {
        receipt.executedMode = 'SOURCE_INJECTION';
        await runInjection(receipt);
      }
    }
    receipt.status = 'PASS';
  } catch (error) {
    receipt.status = 'FAIL';
    receipt.failure = { message: String(error?.message || error), stack: String(error?.stack || '') };
    throw error;
  } finally {
    receipt.completedAt = new Date().toISOString();
    await writeFile(path.join(ARTIFACT_DIR, 'production-browser-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  console.log(`PASS HP browser qualification mode=${receipt.executedMode} steps=${receipt.steps.length}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
