import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML_CII_PLAYWRIGHT_MODULE || 'playwright');
const server=createServer(async(req,res)=>{
  try{
    const targetPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(targetPath==='/xml229-master-probe.html'){
      res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
      res.end('<!doctype html><meta charset="utf-8"><base href="/docs/"><title>XML229 Piping Class real browser probe</title>');
      return;
    }
    const file=path.resolve(root,'.'+targetPath);
    if(!file.startsWith(root+path.sep))throw Error('outside root');
    const body=await readFile(file);
    const mime=({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(body);
  }catch(error){res.writeHead(404);res.end(String(error));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  const errors=[], failures=[], sources=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)failures.push({status:r.status(),url:r.url()})});
  page.on('request',r=>{if(/Piping_class_master\.json|SpecwisePipingClass\/index\.json/.test(r.url()))sources.push(r.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/xml229-master-probe.html');
  const observation=await page.evaluate(async()=>{
    const {prepareStandaloneImportMasters,summarizeStandaloneImportMasters}=await import('/docs/tabs/xml-cii-2019-standalone/xml-cii-master-context.js');
    const hydrated=await prepareStandaloneImportMasters({supportConfigJson:'{}'});
    const piping=summarizeStandaloneImportMasters(hydrated).find(row=>row.key==='pipingClass');
    const anyClass=hydrated.pipingClassRows.every(row=>String(row?.['Piping Class']||'').trim().length>0);
    return {rowCount:piping?.rowCount,status:piping?.sourceMetadata?.status,
      source:piping?.sourceMetadata?.source,rowsWithPipingClass:anyClass,
      configRows:hydrated.config.pipingClass?.masterRows?.length,
      serializedCount:JSON.parse(hydrated.supportConfigJson)?.pipingClass?.masterRows?.length};
  });
  assert.equal(observation.rowCount,10699);
  assert.equal(observation.configRows,10699);
  assert.equal(observation.serializedCount,10699);
  assert.equal(observation.rowsWithPipingClass,true);
  assert.equal(observation.status,'loaded');
  assert.match(String(observation.source),/Piping_class_master\.json$/);
  assert(sources.some(s=>s.endsWith('/docs/Masters/Piping_class_master.json')),'real network fetch must obtain row source');
  assert(!sources.some(s=>s.endsWith('/SpecwisePipingClass/index.json')),'manifest must not be used as a master');
  assert.deepEqual(errors,[]);
  // Material defaults may separately return 404 on some hosted routes; forbid errors for the Piping Class source.
  assert(!failures.some(f=>f.url.includes('Piping_class_master.json')),'row-bearing source HTTP failure');
  // Fresh standalone UI mount: the real shell must auto-hydrate the default
  // only after persisted-dataset restoration, without asking for an upload.
  const boot=await browser.newPage();
  const bootErrors=[],bootMasters=[];
  boot.on('pageerror',error=>bootErrors.push(String(error)));
  boot.on('request',req=>{if(req.url().endsWith('/docs/Masters/Piping_class_master.json'))bootMasters.push(req.url())});
  await boot.goto('http://127.0.0.1:'+server.address().port+'/xml229-master-probe.html');
  await boot.evaluate(async()=>{
    const module=await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell.js');
    const container=document.createElement('div');
    container.id='xml229-real-standalone-app';
    document.body.appendChild(container);
    module.renderXmlCiiAdaptedWorkflowShell(container);
  });
  await boot.waitForFunction(()=>{
    const root=document.querySelector('#xml229-real-standalone-app');
    return root && /Masters: [2-4]\/4 loaded/.test(root.querySelector('.xml-cii-standalone-header')?.textContent || '');
  },null,{timeout:30000});
  const bootText=await boot.locator('#xml229-real-standalone-app .xml-cii-standalone-header').textContent();
  const bootBadge=await boot.locator('#xml229-real-standalone-app .xml-cii-standalone-badge').allTextContents();
  assert(/Masters: [2-4]\/4 loaded/.test(bootText),'Header must include the newly applied default master without assuming all other masters start absent');
  assert.equal(bootMasters.length,1,'Cold start must fetch exactly one actual master');
  assert.deepEqual(bootErrors,[],'Fresh standalone UI boot errors');
  console.log(JSON.stringify({schema:'XML229_REAL_BROWSER_MASTER_V1',ok:true,observation,pipingMasterRequests:sources.length,errors,unrelatedFailures:failures.map(f=>f.status),coldStandalone:{masterBadge:bootBadge.find(x=>x.startsWith('Masters: ')),actualRowFileRequests:bootMasters.length,runtimeErrors:bootErrors}},null,2));
} finally {
  await browser?.close();
  await new Promise(ok=>server.close(ok));
}
