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
const release = '20261001-weight-output-2';
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
  const coreResult=await page.evaluate(async()=>{
    const {combineXmlWithNodeOffsets}=await import('/docs/converters/xml-cii2019-core/xml-node-offset-combine.js?v=20261001-weight-output-2');
    const xml=(unit='MM')=>`<PipeStressExport><Units><DistanceUnits>${unit}</DistanceUnits></Units><Pipe><Branch><Branchname>B1</Branchname><Node><NodeNumber>10</NodeNumber><Position>0 0 0</Position><Weight>17.75</Weight></Node><Node><NodeNumber>20</NodeNumber><Position>100 0 0</Position></Node><Node><NodeNumber>-1</NodeNumber><Position>105 0 0</Position></Node></Branch><Branch><Branchname>B2</Branchname><Node><NodeNumber>20</NodeNumber><Position>100 0 0</Position></Node></Branch></Pipe></PipeStressExport>`;
    const sources=[{fileName:'a.xml',xmlText:xml()},{fileName:'b.xml',xmlText:xml()}];
    const result=combineXmlWithNodeOffsets(sources,{offsetStep:100});
    const doc=new DOMParser().parseFromString(result.xmlText,'application/xml');
    const ids=[...doc.querySelectorAll('NodeNumber')].map(n=>Number(n.textContent));
    const failures=[];
    for(const input of [sources.map((s,i)=>i?{...s,xmlText:xml('IN')}:s),sources.map((s,i)=>i?{...s,xmlText:'<broken'}:s),sources.map(s=>({...s,xmlText:s.xmlText.replace('<NodeNumber>10','<NodeNumber>1.5')}))]) {
      try{combineXmlWithNodeOffsets(input);failures.push('accepted invalid input');}catch{}
    }
    try{combineXmlWithNodeOffsets(sources,{offsetStep:0});failures.push('accepted zero step');}catch{}
    try{combineXmlWithNodeOffsets(sources.map(s=>({...s,xmlText:s.xmlText.replace('<NodeNumber>20','<NodeNumber>9007199254740991')})),{offsetStep:100});failures.push('accepted overflow');}catch{}
    return {ids,failures,offsets:result.manifest.sourceOrder.map(row=>row.offset),weights:[...doc.querySelectorAll('Weight')].map(n=>Number(n.textContent))};
  });
  assert.deepEqual(coreResult.ids,[10,20,-1,20,110,120,-1,120]);
  assert.deepEqual(coreResult.offsets,[0,100]);assert.deepEqual(coreResult.weights,[17.75,17.75]);assert.deepEqual(coreResult.failures,[]);
  const second=fixture.replace(/(<ProjectName>)[^<]*/, '$1Mode B second source');
  await page.getByRole('button',{name:'Mode B — Combine XML (node offsets)',exact:true}).click();
  await page.locator('input[data-field="source-file"]').setInputFiles([
    {name:'source-one.xml',mimeType:'application/xml',buffer:Buffer.from(fixture)},
    {name:'source-two.xml',mimeType:'application/xml',buffer:Buffer.from(second)},
  ]);
  await page.getByRole('button',{name:'Mode B — Combine XML (node offsets)',exact:true}).click();
  await page.getByRole('button',{name:'Combine XML',exact:true}).click();
  await page.locator('[data-mode-b-status]').filter({hasText:'Combined 2 XML files'}).waitFor();
  assert.match(await page.locator('[data-mode-b-offsets]').innerText(),/source-two.xml: offset \+100000/);
  const evidenceDir=process.env.XML_CII_MODE_B_EVIDENCE_DIR || 'agents/evidence/WIP-781-OUTPUT-CUSTODY-20261001';
  await mkdir(evidenceDir,{recursive:true});
  const [xmlDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save Combined XML',exact:true}).click()]);
  await xmlDownload.saveAs(path.join(evidenceDir,'mode-b-combined.xml'));
  const [mapDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save Node Offset Map',exact:true}).click()]);
  await mapDownload.saveAs(path.join(evidenceDir,'mode-b-node-offset-map.json'));
  const output=await readFile(path.join(evidenceDir,'mode-b-combined.xml'),'utf8');
  const observation=await page.evaluate(({output,fixture,second})=>{
    const parse=xml=>new DOMParser().parseFromString(xml,'application/xml');
    const result=parse(output),sourceDocs=[parse(fixture),parse(second)];
    const pipes=[...result.getElementsByTagName('Pipe')];
    const differences=[];
    for(let i=0;i<pipes.length;i++) {
      const actual=[...pipes[i].getElementsByTagName('Node')];
      const expected=[...sourceDocs[i].getElementsByTagName('Node')];
      if(actual.length!==expected.length)differences.push('node count');
      for(let j=0;j<expected.length;j++) {
        const old=Number(expected[j].querySelector('NodeNumber').textContent);
        const next=Number(actual[j].querySelector('NodeNumber').textContent);
        if(next!==(old>0?old+i*100000:old))differences.push(`number ${i}/${j}`);
        const fields=node=>[...node.children].filter(n=>n.localName!=='NodeNumber').map(n=>[n.localName,n.textContent]);
        if(JSON.stringify(fields(actual[j]))!==JSON.stringify(fields(expected[j])))differences.push(`engineering fields ${i}/${j}`);
      }
    }
    return {pipeCount:pipes.length,branchCount:result.getElementsByTagName('Branch').length,nodeCount:result.getElementsByTagName('Node').length,differences};
  },{output,fixture,second});
  assert.equal(observation.pipeCount,2);assert.equal(observation.branchCount,82);assert.equal(observation.nodeCount,3308);assert.deepEqual(observation.differences,[]);
  await page.locator('[data-mode-b-xml-panel]').screenshot({path:path.join(evidenceDir,'mode-b-sources-ui.png')});
  await page.locator('[data-mode-b-offset]').fill('0');
  assert.ok(await page.getByRole('button',{name:'Save Combined XML',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Combine XML',exact:true}).click();
  assert.match(await page.locator('[data-mode-b-status]').innerText(),/positive integer/);
  await writeFile(path.join(evidenceDir,'mode-b-runtime-modules.json'),JSON.stringify(modules,null,2));
  assert.deepEqual(errors,[]);
  const evidence={status:'PASS',observation:'LOCAL_EXECUTION',oracle:'INDEPENDENT_REPRODUCTION',coreResult,...observation,errors};
  await writeFile(path.join(evidenceDir,'mode-b-acceptance.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
