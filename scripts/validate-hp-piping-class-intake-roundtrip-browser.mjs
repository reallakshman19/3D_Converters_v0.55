import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as F } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.HP_BROWSER_ARTIFACT_DIR ?? path.join(REPO, 'artifacts/hp-piping-class-production-browser'));
const MODE = process.env.HP_BROWSER_MODE ?? 'full';
const TIMEOUT = Number(process.env.HP_BROWSER_TIMEOUT_MS ?? 45000);
const STORAGE = 'format-converters.hpPipingClass.project.v2';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function readable(p) { try { await access(p, F.R_OK); return true; } catch { return false; } }

class CDP {
  constructor(ws) {
    this.ws = ws; this.i = 1; this.p = new Map(); this.events = [];
    ws.onmessage = (event) => {
      const value = JSON.parse(String(event.data));
      if (value.id) {
        const pending = this.p.get(value.id); if (!pending) return;
        this.p.delete(value.id); value.error ? pending.reject(new Error(value.error.message)) : pending.resolve(value.result ?? {});
      } else if (value.method) this.events.push(value);
    };
  }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }); return new CDP(ws); }
  send(method, params = {}) { const id = this.i++; return new Promise((resolve, reject) => { this.p.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const value = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text); return value.result?.value; }
  close() { this.ws.close(); }
}

async function chromium() {
  for (const candidate of [process.env.HP_BROWSER_CHROMIUM, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean)) {
    try { await access(candidate, F.X_OK); return candidate; } catch {}
  }
  throw new Error('HP_BROWSER_CHROMIUM_NOT_FOUND');
}
async function launch() {
  const exe = await chromium(); const dir = await mkdtemp(path.join(os.tmpdir(), 'hp-intake-browser-'));
  const child = spawn(exe, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--window-size=1600,1100', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const portFile = path.join(dir, 'DevToolsActivePort'); const end = Date.now() + TIMEOUT;
  while (Date.now() < end && !(await readable(portFile))) await sleep(50);
  if (!(await readable(portFile))) throw new Error('CHROMIUM_DEVTOOLS_TIMEOUT');
  const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/); const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((row) => row.type === 'page'); if (!target?.webSocketDebuggerUrl) throw new Error('CHROMIUM_PAGE_TARGET_NOT_FOUND');
  const cdp = await CDP.connect(target.webSocketDebuggerUrl); await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  return { exe, dir, child, cdp };
}
async function close(browser) { try { browser.cdp.close(); } catch {} try { browser.child.kill('SIGTERM'); } catch {} await sleep(100); try { browser.child.kill('SIGKILL'); } catch {} await rm(browser.dir, { recursive: true, force: true }); }
async function wait(cdp, expression) { const end = Date.now() + TIMEOUT; while (Date.now() < end) { try { if (await cdp.eval(`Boolean(${expression})`)) return; } catch {} await sleep(80); } throw new Error(`WAIT_TIMEOUT ${expression}`); }
async function click(cdp, selector) { await wait(cdp, `document.querySelector(${JSON.stringify(selector)})`); await cdp.eval(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function set(cdp, selector, value, event = 'input') { await wait(cdp, `document.querySelector(${JSON.stringify(selector)})`); await cdp.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`); }
async function text(cdp, selector = 'body') { return cdp.eval(`document.querySelector(${JSON.stringify(selector)})?.innerText??''`); }
async function shot(cdp, name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(OUT, name), Buffer.from(data, 'base64')); return name; }
function mime(p) { return p.endsWith('.html') ? 'text/html' : p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.png') ? 'image/png' : 'text/javascript'; }
async function serve() { const server = http.createServer(async (req, res) => { try { let name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); if (name === '/') name = '/index.html'; const p = path.resolve(REPO, `.${name}`); if (!p.startsWith(`${REPO}${path.sep}`)) throw 0; res.writeHead(200, { 'content-type': mime(p), 'cache-control': 'no-store' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end('Not found'); } }); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); return { server, url: `http://127.0.0.1:${server.address().port}/` }; }
function pass(receipt, id, name, details = {}) { receipt.steps.push({ id, name, status: 'PASS', ...details }); }

async function sourceGate() {
  const [route, enhancer, roundtrip] = await Promise.all([
    readFile(path.join(REPO, 'tabs/engineering-workspace-tab.js'), 'utf8'),
    readFile(path.join(REPO, 'tabs/hp-piping-class-intake-package-enhancer.js'), 'utf8'),
    readFile(path.join(REPO, 'tabs/hp-piping-class-intake-package-roundtrip.js'), 'utf8'),
  ]);
  assert.match(route, /hp-piping-class-intake-package-enhancer\.js/);
  assert.match(enhancer, /Export editable package/); assert.match(enhancer, /Validate \+ compare/); assert.match(enhancer, /INTAKE_PACKAGE_REVALIDATION_REQUIRED/);
  assert.match(roundtrip, /buildHpPipingClassIntakePackageExport/); assert.match(roundtrip, /compareHpPipingClassIntakeReplacement/); assert.match(roundtrip, /INTAKE_PACKAGE_EXPORT_KD_STATE_BINDING_MISMATCH/);
}

async function runFull(receipt) {
  if (!(await readable(path.join(REPO, 'index.html')))) throw new Error('FULL_APP_MODE_REQUIRES_REPOSITORY_INDEX_HTML');
  await sourceGate();
  const example = JSON.parse(await readFile(path.join(REPO, 'docs/hp-piping-class-intake-package-v1.example.json'), 'utf8'));
  const { server, url } = await serve(); const browser = await launch(); const { cdp } = browser;
  try {
    await cdp.send('Page.navigate', { url }); await wait(cdp, `document.readyState==='complete'||document.readyState==='interactive'`);
    await click(cdp, '[data-tab="engineering-calculations"]'); await click(cdp, '[data-engineering-subtab="hp-piping-class"]'); await wait(cdp, `document.querySelector('[data-hp-piping-class-workbench="true"]')`); await wait(cdp, `document.querySelector('[data-hpwb-intake-package-editor]')`);
    pass(receipt, 'HPI-001', 'Open real routed HP workbench with class-package enhancer', { screenshot: await shot(cdp, 'intake-01-workbench.png') });

    const originalText = `${JSON.stringify(example, null, 2)}\n`;
    await set(cdp, '[data-hpwb-intake-package-text]', originalText); await click(cdp, '[data-hpwb-intake-package-action="validate"]'); await wait(cdp, `document.querySelector('[data-hpwb-intake-package-preview]')?.innerText.includes('Class package valid against the current workspace snapshot.')`);
    await click(cdp, '[data-hpwb-intake-package-action="apply"]'); await wait(cdp, `document.querySelector('[data-hpwb-intake-package-preview]')?.innerText.includes('Class package applied.')`); await wait(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))?.metadata?.classId==='HP-A'`);
    const admitted = await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))`); assert.equal(admitted.products.length, 2); assert.equal(admitted.methodManifest.nativeCoreKd3Qualified, false); assert.equal(admitted.methodManifest.codeCompliance, false); assert.equal(admitted.methodManifest.canUseForDesignAuthority, false);
    pass(receipt, 'HPI-002', 'Admit v1 package through existing controller and canonical calculation',{ screenshot: await shot(cdp, 'intake-02-applied.png') });

    await cdp.eval(`(()=>{window.__hpPackageDownloads=[];HTMLAnchorElement.prototype.click=function(){window.__hpPackageDownloads.push(this.download||'');};})()`);
    await click(cdp, '[data-hpwb-intake-package-action="export"]'); await wait(cdp, `document.querySelector('[data-hpwb-intake-package-preview]')?.innerText.includes('no package-owned engineering-input changes')`);
    const exportedText = await cdp.eval(`document.querySelector('[data-hpwb-intake-package-text]').value`); const exported = JSON.parse(exportedText);
    assert.equal(exported.schemaVersion, 'hp-piping-class-intake-package/v1'); for (const forbidden of ['calculationMode','nativeCoreKd3Qualified','codeCompliance','canUseForDesignAuthority']) assert.equal(exportedText.includes(`"${forbidden}"`), false);
    const downloads = await cdp.eval('window.__hpPackageDownloads'); assert.ok(downloads.some((name) => name.endsWith('.hp-intake-package.json')));
    pass(receipt, 'HPI-003', 'Export same v1 schema, canonical re-import and zero replacement diff', { downloads, screenshot: await shot(cdp, 'intake-03-zero-diff.png') });

    const candidate = structuredClone(exported); candidate.metadata.revision = 'B'; candidate.method.b313Edition = '2025'; candidate.spectrum.designLifeYears = 25; candidate.tables.products.rows[1][4] = 18.27; candidate.tables.kd[0].rows[0][3] = 75;
    const candidateText = `${JSON.stringify(candidate, null, 2)}\n`; await set(cdp, '[data-hpwb-intake-package-text]', candidateText); await click(cdp, '[data-hpwb-intake-package-action="validate"]'); await wait(cdp, `document.querySelector('.hpwb-intake-impact-table')`);
    const impact = await text(cdp, '[data-hpwb-intake-package-preview]'); for (const expected of ['method basis 1','stress basis 1','fatigue basis 1','damage basis 1','identity 1']) assert.ok(impact.toLowerCase().includes(expected), `missing impact ${expected}`);
    for (const expected of ['b313Edition','wall','designLifeYears','equivalentAlternatingStressMpa']) assert.ok(impact.includes(expected), `missing impact field ${expected}`);
    pass(receipt, 'HPI-004', 'Expose method/stress/damage/fatigue/identity replacement impacts', { screenshot: await shot(cdp, 'intake-04-impact.png') });

    await click(cdp, '[data-hpwb-goto="design"]'); const wall = '[data-hpwb-bind="products.1.calculationBasis.nominalWallMm"]'; await set(cdp, wall, '18.25');
    await click(cdp, '[data-hpwb-intake-package-action="apply"]'); await wait(cdp, `document.querySelector('[data-hpwb-intake-package-preview]')?.innerText.includes('INTAKE_PACKAGE_REVALIDATION_REQUIRED')`);
    let stored = await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))`); assert.equal(stored.products[1].calculationBasis.nominalWallMm, 18.25); assert.equal(stored.metadata.revision, 'A');
    pass(receipt, 'HPI-005', 'Workspace mutation invalidates comparison and blocks stale Apply');

    await set(cdp, wall, '18.26'); await set(cdp, '[data-hpwb-intake-package-text]', candidateText); await click(cdp, '[data-hpwb-intake-package-action="validate"]'); await wait(cdp, `document.querySelector('.hpwb-intake-impact-table')`); await click(cdp, '[data-hpwb-intake-package-action="apply"]'); await wait(cdp, `JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))?.metadata?.revision==='B'`);
    stored = await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE)}))`); assert.equal(stored.methodManifest.b313Edition, '2025'); assert.equal(stored.transient.spectrum.designLifeYears, 25); assert.equal(stored.products[1].calculationBasis.nominalWallMm, 18.27); assert.equal(stored.fatigueEvidence[0].externalResults[0].equivalentAlternatingStressMpa, 75); assert.equal(stored.methodManifest.nativeCoreKd3Qualified, false); assert.equal(stored.methodManifest.codeCompliance, false); assert.equal(stored.methodManifest.canUseForDesignAuthority, false);
    await click(cdp, '[data-hpwb-goto="envelope"]'); await wait(cdp, `document.querySelector('[data-hpwb-class-result-matrix="true"]')`);
    pass(receipt, 'HPI-006', 'Revalidation admits candidate and canonical results return with authority unchanged', { screenshot: await shot(cdp, 'intake-06-reapplied.png') });

    const next = structuredClone(candidate); next.metadata.revision = 'C'; await set(cdp, '[data-hpwb-intake-package-text]', `${JSON.stringify(next, null, 2)}\n`); await click(cdp, '[data-hpwb-intake-package-action="validate"]'); await wait(cdp, `document.querySelector('.hpwb-intake-impact-table')`);
    await cdp.eval(`if(!document.querySelector('meta[name=viewport]'))document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1">')`); await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    const layout = await cdp.eval(`(()=>{const t=document.querySelector('.hpwb-intake-impact-table'),w=t?.closest('.hpwb-table-wrap');return{overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,local:Boolean(w&&w.scrollWidth>w.clientWidth)}})()`); assert.ok(layout.overflow <= 2); assert.equal(layout.local, true);
    pass(receipt, 'HPI-007', '375x900 keeps replacement-impact overflow table-local', { layout, screenshot: await shot(cdp, 'intake-07-mobile.png') });

    const exceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown'); assert.equal(exceptions.length, 0, JSON.stringify(exceptions)); receipt.browser = { executable: browser.exe, runtimeExceptions: 0 }; receipt.fullActiveWorkbenchNavigation = true; receipt.intakeRoundTripFullAppQualified = true;
  } finally { await close(browser); await new Promise((resolve) => server.close(resolve)); }
}

async function selfTest(receipt) { const browser = await launch(); try { await browser.cdp.eval(`document.body.innerHTML='<button id=b>go</button><div id=o></div>';b.onclick=()=>o.textContent='PASS'`); await click(browser.cdp, '#b'); assert.equal(await text(browser.cdp, '#o'), 'PASS'); receipt.browser = { executable: browser.exe, runtimeExceptions: 0 }; pass(receipt, 'SELF-001', 'Chromium CDP intake-roundtrip runner self-test'); } finally { await close(browser); } }

async function main() {
  await mkdir(OUT, { recursive: true }); const receipt = { schema: 'HpPipingClassIntakeRoundTripBrowserReceipt.v1', status: 'RUNNING', requestedMode: MODE, fullActiveWorkbenchNavigation: false, intakeRoundTripFullAppQualified: false, numericalAuthority: 'UNCHANGED', authority: { nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false }, steps: [], startedAt: new Date().toISOString() };
  try { if (MODE === 'self-test') await selfTest(receipt); else await runFull(receipt); receipt.status = 'PASS'; }
  catch (error) { receipt.status = 'FAIL'; receipt.failure = { message: String(error?.message || error), stack: String(error?.stack || '') }; throw error; }
  finally { receipt.completedAt = new Date().toISOString(); await writeFile(path.join(OUT, 'intake-roundtrip-browser-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`); }
  console.log(`PASS HP intake round-trip browser fullApp=${receipt.intakeRoundTripFullAppQualified} steps=${receipt.steps.length}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
