/**
 * O1 W03: actual branch docs mirror parity after running the canonical
 * builder. Root Actions Pages deploys "."; this additionally certifies the
 * docs-sourced runtime graph without claiming a production deploy.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const required=[
 'index.html',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-intake.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-domain-ui.js',
 'tabs/xml-cii-2019-standalone/workers/lfj-o1-resolver-domain-worker.mjs',
 'lfj/ports/source-browser-worker.mjs',
 'lfj/ports/source-worker-port.mjs',
 'lfj/index/source-occurrence-index.mjs',
 'lfj/source/source-snapshot.mjs',
 'lfj/storage/browser/indexed-page-record-store.mjs',
 'lfj/storage/browser/indexed-record-store.mjs',
 'tabs/xml-cii-2019-standalone/xml-cii-resolver-json-trace.js',
 'tabs/xml-cii-2019-standalone/xml-cii-trace-export.js'
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const out={schema:'LFJ226.O1.DocsParity.v1',files:[],browser:{},pass:false,
  note:'test builds docs/ from root source; not live GitHub Pages deployment'};
try{
 for(const file of required){
  const root=await readFile(file),mirror=await readFile('docs/'+file);
  const a=sha(root),b=sha(mirror);out.files.push({path:file,root:a,docs:b,pass:a===b});
 }
 assert.ok(out.files.every(x=>x.pass),'docs mirror has missing or nonidentical LFJ source modules');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4173/docs/index.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  const responses=await page.evaluate(async()=>{
   const docs='/docs/';
   // Browser's module resolver follows the real docs relative dependency graph.
   const main=await import(docs+'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-intake.js');
   return {intakeExport:typeof main.installLfjO1SourceIntake==='function'};
  });
  out.browser.intakeExport=responses.intakeExport;
  async function negative(workerUrl,msg){
   return page.evaluate(({workerUrl,msg})=>new Promise((resolve,reject)=>{
    const w=new Worker(workerUrl,{type:'module'});
    const timer=setTimeout(()=>{w.terminate();reject(new Error('DOCS_WORKER_TIMEOUT'));},15000);
    w.onerror=e=>{clearTimeout(timer);w.terminate();reject(new Error(e.message));};
    w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data);};
    w.postMessage(msg);
   }),{workerUrl,msg});
  }
  const source=await negative('/docs/lfj/ports/source-browser-worker.mjs',{
    schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'SCAN',jobId:'docs-probe',
    sourceRefId:'docs-ref',revision:'rev-docs'
  });
  const domain=await negative('/docs/tabs/xml-cii-2019-standalone/workers/lfj-o1-resolver-domain-worker.mjs',{
    schema:'LFJ.O1.DomainWorker.v1',kind:'RUN',jobId:'docs-probe'
  });
  out.browser.sourceWorker={kind:source?.kind,code:source?.code};
  out.browser.domainWorker={kind:domain?.kind,code:domain?.code};
  assert.equal(source?.code,'SOURCE_PORT_INVALID');
  assert.equal(domain?.code,'DOMAIN_BASIS');
  assert.ok(responses.intakeExport);
 }finally{await browser.close();}
 out.pass=true;
 console.log('LFJ226_DOCS_PARITY '+JSON.stringify(out));
}finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-docs-parity.json',
   JSON.stringify(out,null,2)+'\n');
}
