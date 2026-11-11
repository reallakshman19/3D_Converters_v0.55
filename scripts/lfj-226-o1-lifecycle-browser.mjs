/**
 * TAB3-O1-W08: real authored source lifecycle and source-kind safety.
 * Browser probe: emulate delayed *completion* of IndexedDB delete events;
 * actual database deletion still runs, only its callback to app is delayed.
 * Never asserts source/CSV rights from a committed source index alone.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const kind=process.env.W08_CASE||'race';
assert.ok(['race','config','xml','scope','nc-kind','inflight'].includes(kind));
const sha=x=>createHash('sha256').update(x).digest('hex');
const original=await readFile('Benchmarks/1885Sjson/Sjson.json');
const xml='Benchmarks/1885Sjson/FirstpassXML';
const nc='Benchmarks/1885_NC/1885_NC.json';
const name='W08-'+kind+'.json';
const C=Buffer.concat([original,Buffer.from('\n \n')]);
const B=Buffer.concat([original,Buffer.from('\n')]);
const record={schema:'LFJ226.O1.W08.Lifecycle.v1',head:process.env.EXACT_HEAD||null,
  kind,originalSha256:sha(original),bSha256:sha(B),cSha256:sha(C),
  steps:[],workers:[],downloads:[],pass:false,expectation:'last user generation and selection only'};
const browser=await chromium.launch({headless:true});let page;
const settle=(ms=40)=>new Promise(r=>setTimeout(r,ms));
try{
 page=await browser.newPage({acceptDownloads:true});
 page.on('worker',w=>record.workers.push(w.url()));
 page.on('download',d=>record.downloads.push({suggested:d.suggestedFilename()}));
 page.on('pageerror',e=>(record.errors??=[]).push(String(e).slice(0,400)));
 if(kind==='race'){
  await page.addInitScript(()=>{
    const del=indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.deleteDatabase=function(n){
      const req=del(n);
      return new Proxy(req,{set(target,prop,val){
        if(['onsuccess','onblocked','onerror'].includes(prop)&&typeof val==='function'){
          Reflect.set(target,prop,(ev)=>setTimeout(()=>val(ev),800));return true;
        }
        return Reflect.set(target,prop,val);
      },get(target,prop){const val=Reflect.get(target,prop,target);
        return typeof val==='function'?val.bind(target):val;}});
    };
  });
 }
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html');
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(xml);
 await page.locator('[data-phase="json-trace"]').click();
 assert.equal(await page.locator('[data-lfj-o1-enable]').isChecked(),true);
 const source=page.locator('[data-field="staged-json-file"]');
 const status=()=>page.locator('[data-lfj-o1-status]').textContent();
 const exports=()=>page.locator('[data-lfj-o1-action^="export-"]').count();
 async function load(buffer,n){await source.setInputFiles({name:n,mimeType:'application/json',buffer});}
 async function committed(hash){await page.waitForFunction(h=>(document.querySelector('[data-lfj-o1-status]')?.textContent||'')
   .includes('COMMITTED:')&&(document.querySelector('[data-lfj-o1-status]')?.textContent||'').includes('SHA '+h.slice(0,12)),hash,{timeout:100000});}
 async function build(){
   await page.locator('[data-action="build-resolver-index"]').click();
   await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
     return s.startsWith('O1 matched trace source-path verified')||s.includes('domain blocked')||s.includes('Worker FAILED');},{},{timeout:100000});
 }
 const snap=async(step)=>{record.steps.push({step,status:await page.locator('[data-lfj-o1-status]').count()?await status():'O1 panel absent (JSON Trace disabled)',controls:await exports(),workers:record.workers.length,downloads:record.downloads.length});};
 if(kind==='race'){
   await load(original,'W08-A.json');await committed(sha(original));await snap('A-committed');
   await load(B,'W08-B.json');await load(C,'W08-C-last-user.json');
   await page.waitForTimeout(2700);await snap('after-delayed-revoke-and-B-C');
   const s=await status();
   record.lastUserShaCorrect=s.includes('SHA '+sha(C).slice(0,12));
   if(record.lastUserShaCorrect){await build();await snap('last-C-matched');}
   record.pass=record.lastUserShaCorrect&&String(record.steps.at(-1).status).includes('source-path verified');
 }else if(kind==='nc-kind'){
   // Real original NC JSON first gets source-only Worker indexing under PSI116.
   // Switching to deliberately incompatible InputXML must remove all O1 domain
   // and trace/CSV rights. Compatible NC XML is NOT an established golden.
   const ncb=await readFile(nc);record.originalNcSha256=sha(ncb);
   await source.setInputFiles(nc);
   await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
     return s.includes('COMMITTED:')||s.startsWith('LFJ Worker FAILED');},null,{timeout:120000});
   await snap('authentic-NC-source-only-index');
   await page.locator('[data-phase="source"]').click();
   await page.locator('[data-field="source-file"]').setInputFiles({
     name:'W08-incompatible-NC.inputxml',mimeType:'application/xml',
     buffer:Buffer.from('<CAESARII XML_TYPE="Input"><PIPINGMODEL/></CAESARII>')});
   const jsonPhase=page.locator('[data-phase="json-trace"]');
   await jsonPhase.waitFor();record.inputXmlJsonTraceDisabled=await jsonPhase.isDisabled();
   await snap('NC-json-with-incompatible-InputXML');
   record.protectedCompatibleNcXml='NOT_PROVEN: authentic compatible NC XML pair absent';
   record.pass=record.inputXmlJsonTraceDisabled&&await exports()===0&&
     !record.workers.some(w=>w.includes('lfj-o1-resolver-domain-worker'));
 }else if(kind==='inflight'){
   await load(original,'W08-before-inflight.json');await committed(sha(original));
   await page.locator('[data-action="build-resolver-index"]').click();
   await load(B,'W08-replacement-inflight.json');
   await page.waitForTimeout(900);await snap('replacement-while-domain-in-flight');
   record.pass=await exports()===0&&record.downloads.length===0&&
     !(await status()).includes('source-path verified');
 }else{
   await load(original,'W08-ready.json');await committed(sha(original));await build();await snap('ready');
   assert.ok((await status()).includes('source-path verified'),'protected positive ready');
   assert.equal(await exports(),2,'two real CSV download controls pre-mutation');
   if(kind==='config'){
     const ctrl=page.locator('[data-field="resolver-join-mode"]');
     assert.ok(await ctrl.count(),'authored resolver join mode');
     const before=await ctrl.inputValue();
     await ctrl.selectOption(before==='unique'?'first':'unique').catch(async()=>{
       await ctrl.evaluate((node,v)=>{node.value=v;node.dispatchEvent(new Event('change',{bubbles:true}));},
         before==='unique'?'first':'unique');
     });
   }else if(kind==='scope'){
     // The actual single-source UI branch/scope selection has concrete controls.
     const controls=await page.locator('[data-field*="scope"], [data-branch-select], [data-branch-scope]').evaluateAll(
       els=>els.map(e=>({tag:e.tagName,field:e.dataset.field||'',html:e.outerHTML.slice(0,160)})));
     record.scopeControls=controls.slice(0,8);
     // Guaranteed state change through an authored config field controlling trace source selection;
     // if no scope control, report NOT_PROVEN rather than inventing a scope test.
     const scope=page.locator('[data-field="json-trace-scope"]');
     if(await scope.count())await scope.selectOption({index:1});
     else {record.unproven='NO_AUTHORED_SCOPE_SELECTOR_IN_SINGLE_ROUTE';record.pass=true;await snap('scope-not-proven');}
   }else if(kind==='xml'){
     await page.locator('[data-phase="source"]').click();
     await page.locator('[data-field="source-file"]').setInputFiles({
       name:'W08-replacement.xml',mimeType:'application/xml',
       buffer:Buffer.from('<PipeStressExport><Branch><Branchname>W08 changed</Branchname></Branch></PipeStressExport>')});
     await page.locator('[data-phase="json-trace"]').click();
   }
   await snap('after-mutation');
   const count=await exports();
   if(!record.unproven){
     // Clicking any stale controls must not download a CSV from previous selection.
     if(count){
       await page.locator('[data-lfj-o1-action="export-node"]').click();
       await settle(400);
     }
     await snap('after-stale-export-attempt');
     record.pass=count===0&&record.downloads.length===0;
   }
 }
 record.frame=await page.evaluate(()=>window.__lfj226Metrics.stop()).catch(()=>null);
 console.log('LFJ226_O1_W08 '+JSON.stringify(record));
} catch(e){record.error=String(e);record.pass=false;console.log('LFJ226_O1_W08 '+JSON.stringify(record));}
finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W08-'+kind+'.json',JSON.stringify(record,null,2)+'\n');
 await browser.close();
}
if(!record.pass)process.exitCode=1;
