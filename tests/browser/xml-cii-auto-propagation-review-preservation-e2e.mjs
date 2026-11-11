import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixture = await readFile(process.env.XML_CII_41_BRANCH_FIXTURE || path.join(root, 'Benchmarks/EF-05-PRO.TEST.xml'), 'utf8');
const baseline = process.argv.includes('--observe-baseline');
const folder = 'agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001';
const server = createServer(async (request, response) => {
  try {
    const route = new URL(request.url, 'http://localhost').pathname;
    if (route === '/harness.html') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><body></body></html>'); return; }
    const target = path.resolve(root, `.${route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    response.setHeader('Content-Type', path.extname(target) === '.js' ? 'text/javascript' : 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store'); response.end(await readFile(target));
  } catch (error) { response.writeHead(404); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/harness.html`);
  const regex = await page.evaluate(async fixture => {
    const { createXmlCiiAdaptedWorkflowState } = await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js');
    const { createDefaultRegexTesterConfig } = await import('/docs/tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js');
    const { renderStandaloneRegexTesterPanel } = await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-tester.js');
    const { enhanceRegexSmartWorkbench } = await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js');
    const state = createXmlCiiAdaptedWorkflowState();
    state.sourceText = fixture; state.sourceKind = 'xml';
    state.supportConfigJson = JSON.stringify({ linelist: { lineTokenIndex: '9' }, rating: { pipingClassTokenIndex: '9' }, weight: { boreTokenIndex: '9' } });
    state.regexTesterConfig = createDefaultRegexTesterConfig();
    for (const format of state.regexTesterConfig.formats) {
      format.lineKey.tokenPosition = '4'; format.pipingClass.tokenPosition = '5'; format.bore.tokenPosition = '3';
    }
    state.regexSmartManualLocks = { lineKey: true, pipingClass: true, bore: true, rating: true };
    const ref = { current: state }, card = document.createElement('div'); document.body.appendChild(card);
    let renders = 0;
    renderStandaloneRegexTesterPanel(card, state, ref, () => renders++);
    enhanceRegexSmartWorkbench(card, ref.current, ref, () => renders++);
    await Promise.resolve();
    const automatic = JSON.parse(ref.current.supportConfigJson);
    const input = card.querySelector('[data-field="regex-piping-class-token"]');
    input.value = '6'; input.dispatchEvent(new Event('change', { bubbles: true }));
    const edited = JSON.parse(ref.current.supportConfigJson);
    return { automaticPipingClass: automatic.rating.pipingClassTokenIndex,
      automaticBore: automatic.weight.boreTokenIndex, editedPipingClass: edited.rating.pipingClassTokenIndex, renders };
  }, fixture);
  await page.evaluate(async () => {
    document.body.innerHTML = '';
    const { openModeAConsolidatedRigidWeightReviewPopup } = await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js');
    const { installModeAConsolidatedRigidReviewTools } = await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-rigid-review-tools.js');
    const issue = (key, acceptedWeight, proposed) => ({ key, branchName: '/B1', nodeNumber: key.split('::')[1],
      acceptedWeight, acceptedWeightSource: acceptedWeight == null ? '' : 'Saved weight',
      candidates: [{ suggestedWeight: proposed, preferred: true, weightMethod: 'master' }] });
    // Explicit UI fixtures: differing saved values, a blank, and the same key in another source.
    window.__reviewResult = openModeAConsolidatedRigidWeightReviewPopup([
      { sourceId: 'A', fileName: 'A.xml', issues: [issue('/B1::20',57.25,10), issue('/B1::21',13.5,20), issue('/B1::22',null,30)] },
      { sourceId: 'B', fileName: 'B.xml', issues: [issue('/B1::20',91.25,99)] },
    ]);
    installModeAConsolidatedRigidReviewTools();
  });
  const modal = page.getByRole('dialog', { name: 'Consolidated rigid zero weight review' });
  const values = () => modal.locator('.mc-rigid-review-input').evaluateAll(nodes => nodes.map(node => Number(node.value)));
  const initial = await values();
  await modal.getByRole('button', { name: 'Use All Exact Suggestions', exact: true }).click();
  const afterExact = await values();
  await modal.getByRole('button', { name: 'Use All Suggestions', exact: true }).click();
  const afterAll = await values();
  await modal.locator('.mc-rigid-review-input').nth(2).fill('');
  await modal.getByRole('button', { name: 'Use All Exact Suggestions', exact: true }).click();
  const afterBlankFill = await values();
  await modal.locator('.mc-rigid-review-input').nth(0).fill('58.75');
  await modal.getByRole('button', { name: 'Use All Suggestions', exact: true }).click();
  const afterManual = await values();
  await modal.locator('[data-mode-a-rigid-candidate]').nth(1).click();
  const afterExplicit = await values();
  await modal.getByRole('button', { name: 'Apply Weights and Run All Models', exact: true }).click();
  const accepted = await page.evaluate(() => window.__reviewResult);
  const observation = { regex, initial, afterExact, afterAll, afterBlankFill, afterManual, afterExplicit, accepted, errors };
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, baseline ? 'auto-propagation-baseline.json' : 'auto-propagation-repaired.json'), JSON.stringify(observation,null,2));
  console.log(JSON.stringify(observation,null,2));
  if (!baseline) {
    assert.equal(String(regex.automaticPipingClass),'5'); assert.equal(String(regex.automaticBore),'3');
    assert.equal(String(regex.editedPipingClass),'6');
    assert.deepEqual(initial,[57.25,13.5,30,91.25]);
    for (const stage of [afterExact,afterAll,afterBlankFill]) assert.deepEqual(stage,initial);
    assert.deepEqual(afterManual,[58.75,13.5,30,91.25]);
    assert.deepEqual(afterExplicit,[58.75,20,30,91.25]);
    assert.deepEqual(accepted.updates.A.weightsByKey,{'/B1::20':58.75,'/B1::21':20,'/B1::22':30});
    assert.equal(accepted.updates.B.weightsByKey['/B1::20'],91.25);
    assert.deepEqual(errors,[]);
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
