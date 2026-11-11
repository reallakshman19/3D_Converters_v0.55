import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegexTesterConfig } from '../../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixturePath = process.env.XML_CII_41_BRANCH_FIXTURE || path.join(root, 'Benchmarks', 'EF-05-PRO.TEST.xml');
const fixture = await readFile(fixturePath, 'utf8');
assert.equal((fixture.match(/<Branch(?:\s|>)/gi) || []).length, 41);
assert.equal((fixture.match(/<Node(?:\s|>)/gi) || []).length, 1654);
const release = '20261001-single-weight-owners-1';
const expectOwnerBlock = process.argv.includes('--expect-weight-owner-block');
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${route.endsWith('/') ? `${route}index.html` : route}`);
    if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error('Outside root');
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch (error) { response.writeHead(404); response.end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.XML_CII_CHROMIUM_EXECUTABLE ? { executablePath: process.env.XML_CII_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [], modules = [], timings = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') console.log('Browser console',message.text().slice(0,350));});
  page.on('requestfailed',request=>console.log('Request failed',request.url(),request.failure()?.errorText));
  page.on('request', (request) => { if (/\.js(?:\?|$)/.test(request.url())) modules.push(request.url()); });
  const seed = createDefaultRegexTesterConfig();
  for (const format of seed.formats) {
    format.lineKey.tokenPosition = '4'; format.pipingClass.tokenPosition = '5'; format.bore.tokenPosition = '3';
  }
  await page.addInitScript((json) => {
    if (!localStorage.getItem('xml-cii-regex-config-v1')) localStorage.setItem('xml-cii-regex-config-v1', json);
  }, JSON.stringify(seed));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  await page.locator('[data-mode-b-action="select-a"]').click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  await page.getByRole('button', { name: /Valve Weights/ }).click();
  await page.locator('input[data-master-file="weight"]').setInputFiles(path.join(root, 'docs', 'Masters', 'wtValveweights.xlsx'));
  await page.locator('[data-master-mapping-status="weight"]').filter({ hasText: 'Mapping status: APPLIED' }).waitFor();
  await page.getByRole('button', { name: /2 Regex Tester/ }).click();
  let mapping = page.locator('.xml-cii-regex-rule-card').filter({ has: page.getByRole('heading', { name: 'Rating prefix mapping', exact: true }) });
  await mapping.locator('tbody tr').filter({ has: page.locator('td').filter({ hasText: /^3$/ }) }).getByRole('button').click();
  mapping = page.locator('.xml-cii-regex-rule-card').filter({ has: page.getByRole('heading', { name: 'Rating prefix mapping', exact: true }) });
  await mapping.getByPlaceholder('Prefix', { exact: true }).fill('3');
  await mapping.getByPlaceholder('Rating', { exact: true }).fill('600');
  await mapping.getByRole('button', { name: 'Add', exact: true }).click();
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-regex-config-v1')).ratingSequence.some(([p, r]) => p === '3' && r === '600')));
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('xml-cii-import-masters-v1')).config.rating.ratingSequence.some(([p, r]) => p === '3' && r === '600')));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'XML→CII 2019 Standalone' }).click();
  await page.locator('[data-mode-b-action="select-a"]').click();
  await page.locator('input[data-field="source-file"]').setInputFiles(fixturePath);
  await page.getByRole('button', { name: /^6 Weight Match/ }).click();
  await page.locator('#mc-wm-refresh').waitFor();


  const evidenceDir=process.env.XML_CII_WEIGHT_OUTPUT_EVIDENCE_DIR || `agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001${expectOwnerBlock ? '/guard-e2e' : ''}`;
  await mkdir(evidenceDir,{recursive:true});
  await page.locator('#mc-wm-refresh').click();
  await page.waitForFunction(() => document.querySelector('#mc-wm-refresh')?.dataset.wmBusy !== 'true' && /shown/.test(document.querySelector('#mc-wm-status')?.textContent || ''));
  const rows=page.locator('#mc-wm-content tbody tr');
  const entered=[];
  for(const [i,weight] of [[0,57.25],[1,13.5]]) {
    const input=rows.nth(i).locator('.mc-rigid-review-input');
    entered.push({key:await input.getAttribute('data-wm-key'),weight});
    await input.fill(String(weight)); await input.dispatchEvent('change');
  }
  await page.locator('#mc-wm-fill-best').click();
  for (const item of entered) assert.equal(Number(await rows.locator(`.mc-rigid-review-input[data-wm-key=${JSON.stringify(item.key)}]`).inputValue()),item.weight,'Preferred bulk fill replaced a saved Weight Match value');
  await page.getByRole('button',{name:/10 Output \/ Run/}).click();
  await page.getByRole('button',{name:'Run Separate Models',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Consolidated rigid zero weight review'});
  await modal.waitFor({timeout:60000});
  for(const item of entered) {
    const input=modal.locator('.mc-rigid-review-input').filter({visible:true});
    const saved=await input.evaluateAll((nodes,key)=>nodes.find(n=>n.dataset.issueKey===key)?.value,item.key);
    if(Number(saved)!==item.weight) console.log('Manual review mismatch',await modal.locator('.mc-rigid-review-input').evaluateAll((nodes,key)=>nodes.find(n=>n.dataset.issueKey===key)?.closest('tr')?.innerText,item.key),JSON.stringify(await page.evaluate(()=>JSON.parse(localStorage.getItem('xml-cii-import-masters-v1')).config.overrides)));
    assert.equal(Number(saved),item.weight,'Saved UI weight did not populate run review');
  }
  for (const label of ['Use All Exact Suggestions','Use All Suggestions']) {
    await modal.getByRole('button',{name:label,exact:true}).click();
    for (const item of entered) assert.equal(Number(await modal.locator('.mc-rigid-review-input').evaluateAll((nodes,key)=>nodes.find(n=>n.dataset.issueKey===key)?.value,item.key)),item.weight,'Review bulk fill replaced saved weight');
  }
  const reviewRows=modal.locator('.mc-rigid-review-input');
  for(let i=0;i<await reviewRows.count();i++) {
    if(!Number(await reviewRows.nth(i).inputValue())) await reviewRows.nth(i).fill('17.75');
  }
  const accepted=await reviewRows.evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.issueKey,weight:Number(n.value)})));
  await writeFile(path.join(evidenceDir,'review-accepted.json'),JSON.stringify(accepted,null,2));
  await modal.screenshot({path:path.join(evidenceDir,'run-weight-review.png')});
  await modal.getByRole('button',{name:'Apply Weights and Run All Models'}).click();
  try { await page.locator('[data-mode-a-panel="batch-results"]').waitFor({timeout:45000}); } catch(error) { await page.screenshot({path:path.join(evidenceDir,'run-stall.png'),fullPage:true}); const state=await page.locator('body').innerText(); await writeFile(path.join(evidenceDir,'run-stall.txt'),state); console.log('Run stalled',state.slice(-9000),errors); throw error; }
  const result=await page.locator('[data-mode-a-panel="batch-results"]').innerText();
  console.log('Batch result',result);
  if (expectOwnerBlock) {
    assert.match(result,/FAILED/);
    assert.match(result,/CII_WEIGHT_OWNER_UNRESOLVED: 16/);
    assert.ok(await page.locator('[data-mode-a-artifact="cii"]').isDisabled());
    await writeFile(path.join(evidenceDir,'export-blocked.txt'),result);
    await page.locator('[data-mode-a-panel="batch-results"]').screenshot({path:path.join(evidenceDir,'export-blocked.png')});
  } else assert.match(result,/SUCCEEDED/);
  for(const kind of expectOwnerBlock ? ['enriched'] : ['enriched','cii','diagnostics']) {
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator(`[data-mode-a-artifact="${kind}"]`).click()]);
    await download.saveAs(path.join(evidenceDir,`ui-run.${kind==='enriched'?'xml':kind==='cii'?'cii':'json'}`));
  }
  const output=await readFile(path.join(evidenceDir,'ui-run.xml'),'utf8');
  const observations=await page.evaluate(({output,accepted})=>{
    const doc=new DOMParser().parseFromString(output,'application/xml');
    const values=new Map();
    for(const branch of doc.querySelectorAll('Branch')) for(const node of branch.querySelectorAll('Node')) {
      const number=node.querySelector('NodeNumber')?.textContent?.trim();
      const identity=Number(number)>0 ? number : ['ComponentRefNo','Endpoint','Position','ComponentType'].map(tag=>node.querySelector(tag)?.textContent?.trim()).filter(Boolean).join('|');
      values.set(`${branch.querySelector('Branchname').textContent}::${identity}`,Number(node.querySelector('Weight')?.textContent));
      const descriptor=['ComponentRefNo','Endpoint','Position','ComponentType'].map(tag=>node.querySelector(tag)?.textContent?.trim()).filter(Boolean).join('|');
      values.set(`${branch.querySelector('Branchname').textContent}::${descriptor}`,Number(node.querySelector('Weight')?.textContent));
    }
    return accepted.map(item=>({...item,actual:values.get(item.key)}));
  },{output,accepted});
  await writeFile(path.join(evidenceDir,'ui-run-weights.json'),JSON.stringify({entered,observations,errors},null,2));
  for(const item of observations) assert.equal(item.actual,item.weight,`Accepted weight omitted from XML: ${item.key}`);
  const geometry=page.locator('.xml-cii-adapted-geometry-host');
  await page.waitForFunction(()=>document.querySelector('.xml-cii-adapted-geometry-host')?.__xmlCiiGeometryRenderer);
  assert.equal(await geometry.getAttribute('data-geometry-basis'),'latest-output');
  await geometry.evaluate(host=>{window.__previousGeometryRenderer=host.__xmlCiiGeometryRenderer;});
  await page.getByRole('button',{name:'Refresh geometry',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.xml-cii-adapted-geometry-host')?.__xmlCiiGeometryRenderer);
  assert.ok(await geometry.evaluate(host=>host.__xmlCiiGeometryRenderer!==window.__previousGeometryRenderer));
  await geometry.screenshot({path:path.join(evidenceDir,'cii-current-geometry.png')});
  const canvasMeta=await page.locator('.model-converters-preview-meta').filter({hasText:/Geometry preview:/}).innerText();
  console.log('Canvas current output',canvasMeta);
  await page.getByRole('button',{name:/1 Source & Masters/}).click();
  const replacement=fixture.replace(/(<Position>)[^<]+/, '$10 0 0');
  await page.locator('input[data-field="source-file"]').setInputFiles({name:'EF-05-PRO.changed.xml',mimeType:'application/xml',buffer:Buffer.from(replacement)});
  await page.getByRole('button',{name:/10 Output \/ Run/}).click();
  await page.waitForFunction(()=>document.querySelector('.xml-cii-adapted-geometry-host')?.__xmlCiiGeometryRenderer);
  assert.equal(await page.locator('.xml-cii-adapted-geometry-host').getAttribute('data-geometry-basis'),'current-source','New source must replace old output geometry');
  const afterMeta=await page.locator('.model-converters-preview-meta').filter({hasText:/Geometry preview:/}).innerText();
  assert.notEqual(afterMeta,canvasMeta);
  await writeFile(path.join(evidenceDir,'canvas-refresh.json'),JSON.stringify({status:'PASS',canvasMeta,afterMeta,sourceReplacement:true},null,2));
  for(const file of ['main-rhbg-fitguard','xml-cii-2019-standalone-tab','xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6','xml-cii-adapted-processing-mode','xml-cii-workflow-engine-client','engine']) assert.ok(modules.some(url=>url.includes(`${file}.js?v=${release}`)),`Missing live release module ${file}`);
  await writeFile(path.join(evidenceDir,'output-runtime-modules.json'),JSON.stringify(modules,null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',scope:expectOwnerBlock ? 'CII withheld for16 unresolved owners; XML/canvas preserved. Full CII acceptance remains FAIL.' : 'Reviewed XML weights and canvas; audit full CII ownership separately',fixture:'41 branches',accepted:accepted.length,entered,errors},null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
