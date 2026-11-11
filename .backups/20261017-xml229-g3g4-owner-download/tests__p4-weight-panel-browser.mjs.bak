import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/test.html'){
   res.writeHead(200,{'content-type':'text/html'});
   res.end('<!doctype html><html><body><div id="preview-panel"></div><div id="weight-panel"></div><div id="run-panel"></div></body></html>');return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(p));
  if(!file.startsWith(root+path.sep))throw Error('bad path');
  const bytes=await readFile(file);
  res.writeHead(200,{'content-type':['.js','.mjs'].includes(path.extname(file))?
    'text/javascript':'application/json'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
 await page.evaluate(async()=>{
   const {installXml229WorkerHeldWeightPanel}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   const raw='{"owner":"real-blob-in-worker","items":[{"id":1},{"id":2}]}';
   const blob=new Blob([raw],{type:'application/json'});
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest(
      'SHA-256',await blob.arrayBuffer())),
      v=>v.toString(16).padStart(2,'0')).join('');
   const r={schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
     rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,sha256:sha,
     sourceRevision:'o1:sha256:'+sha,generationId:'p4-ui-generation-1',
     sourceRefId:'owner-blob',byteLength:blob.size,occurrenceCount:2,pageCount:1};
   const xml=`<PipeStressExport><Pipe><Branch><Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>
<Node><NodeNumber>280</NodeNumber><ComponentType>GASK</ComponentType><ElementLengthMm>2</ElementLengthMm><Position>0 0 0</Position></Node>
<Node><NodeNumber>300</NodeNumber><ComponentType>RIGID</ComponentType><Rigid>2</Rigid><BoreMm>200</BoreMm>
<ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint>
<ElementLengthMm>112</ElementLengthMm><Position>112 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>309</NodeNumber><ComponentType>VALV</ComponentType><BoreMm>200</BoreMm>
<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>
<ElementLengthMm>419</ElementLengthMm><Position>531 0 0</Position><Weight>0</Weight></Node>
</Branch></Pipe></PipeStressExport>`;
   const sourceId='P4-OWNER-WEIGHT-UI';
   const weightRows=[{Rating:'300',Bore:200,Length:112,'RF/RTJ KG':35}];
   const options={
     xmlText:xml,sourceId,
     masters:{weight:{datasetId:'owner-master',revision:'v1',
       rows:weightRows,mapping:{weight:'RF/RTJ KG'}}},
     config:{weight:{masterRows:weightRows},overrides:{}},overrides:{},
     selection:[{sourceId,selectionRef:'all'}],
     originalStagedBlob:blob,originalStagedSourceReceipt:r,
     requestId:'p4-actual-worker-held-UI-review',isCurrent:()=>true,
   };
   const stateRef={current:{}};
   window.__p4StateRef=stateRef;
   window.__p4Options=options;
   const {installXml229P4PreviewBridge}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-preview-bridge.js');
   window.__p4Preview=installXml229P4PreviewBridge(
     document.querySelector('#preview-panel'),stateRef,
     {resolveInputs:async()=>options});
   const panel=installXml229WorkerHeldWeightPanel(
     document.querySelector('#weight-panel'),stateRef, {resolveInputs:async()=>options});
   window.__p4Panel=panel;
 });
 // First build verified engineering facts using the actual 4 Preview bridge.
 await page.locator('[data-p4-preview-build]').click();
 await page.waitForFunction(()=>
   document.querySelector('[data-p4-preview-status]')?.textContent.includes('Preview engineering facts VERIFIED'),
   {timeout:120000});
 const previewReceipt=await page.evaluate(async()=>{
   const {getXml229CurrentWorkerHeldReview}=await import(
      '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   const review=getXml229CurrentWorkerHeldReview(window.__p4StateRef);
   const completion=await review.readCompletion();
   return {basisId:review.receipt.basisId,physicalCount:completion.verifiedPhysicalCount,
     factCount:completion.verifiedFactCount,release:completion.ciiReleaseAuthorized};
 });
 assert.equal(previewReceipt.physicalCount,2);
 assert.equal(previewReceipt.factCount,14);
 assert.equal(previewReceipt.release,false);
 // Switching to Weight Match reconnects to SAME reviewed InputBasis/session;
 // it must not create another competing Weight/Final population.
 await page.evaluate(async()=>{
   const {installXml229WorkerHeldWeightPanel}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   window.__p4Panel=installXml229WorkerHeldWeightPanel(
     document.querySelector('#weight-panel'),window.__p4StateRef,
     {resolveInputs:async()=>window.__p4Options});
 });
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-p4-row]').length===2,
   {timeout:120000});
 const original=await page.evaluate(()=>[...document.querySelectorAll('tr[data-p4-row]')].map(tr=>({
  label:tr.textContent,weight:tr.querySelector('[data-p4-proposal]').value,
 })));
 assert.equal(original.length,2);
 // Neither proposed nor source-null value may be mistaken for accepted mass.
 assert.match(await page.locator('[data-p4-weight-status]').textContent(),/Existing verified Preview facts/);
 const first=page.locator('tr[data-p4-row]').first();
 await first.locator('[data-p4-proposal]').fill('35');
 await first.locator('[data-p4-reason]').fill('Engineer verified physical master 35 kg');
 await first.locator('[data-p4-accept-match1]').click();
 await page.waitForFunction(()=>document.querySelector('tr[data-p4-row]')?.textContent.includes('35 kg'),
   {timeout:120000});
 let rowText=await page.locator('tr[data-p4-row]').first().textContent();
 assert.match(rowText,/35 kg/);
 assert.match(await page.locator('[data-p4-weight-status]').textContent(),/Match-1 explicitly accepted/);
 const refreshed=page.locator('tr[data-p4-row]').first();
 await refreshed.locator('[data-p4-proposal]').fill('40');
 await refreshed.locator('[data-p4-reason]').fill('Independent Final Match-2 approval of 40kg physical mass');
 await refreshed.locator('[data-p4-accept-final]').click();
 await page.waitForFunction(()=>document.querySelector('[data-p4-weight-status]')?.textContent.includes('Final Match-2 explicitly accepted'),
   {timeout:120000});
 const after=await page.evaluate(()=>({
   rows:[...document.querySelectorAll('tr[data-p4-row]')].map(tr=>tr.textContent),
   status:document.querySelector('[data-p4-weight-status]').textContent,
 }));
 assert.match(after.rows[0],/35 kg/);
 assert.match(after.rows[0],/40 kg/);
 assert.doesNotMatch(after.rows[1],/40 kg/);
 // Run stage sees full source-bound review state, not old v1 cache.
 await page.evaluate(async()=>{
   const {installXml229P4RunAdvisory}=await import(
     '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-run-advisory.js');
   installXml229P4RunAdvisory(document.querySelector('#run-panel'),window.__p4StateRef);
 });
 await page.waitForFunction(()=>document.querySelector('[data-p4-run-status]')?.textContent.includes('CII release HELD'),
   {timeout:120000});
 const runAdvisory=await page.locator('[data-xml229-p4-run-advisory]').textContent();
 assert.match(runAdvisory,/2 original physical|Original physical components2/);
 assert.match(runAdvisory,/Accepted Final Match-2/);
 assert.match(runAdvisory,/1/);
 assert.match(runAdvisory,/Unresolved \/ proposed/);
 assert.match(runAdvisory,/CII output remains unauthorized/);
 assert.match(runAdvisory,/The legacy Pre-run Summary/);

 const shared=await page.evaluate(async()=>{
   const {getXml229CurrentWorkerHeldReview}=await import(
      '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   return getXml229CurrentWorkerHeldReview(window.__p4StateRef).receipt.basisId;
 });
 assert.equal(shared,previewReceipt.basisId);
 assert.deepEqual(errors,[]);
 // Reproduce production symptom: an existing reviewed Worker closes while
 // panel ownership remains in the browser. The next Weight tab render MUST
 // not query a terminated Worker or retain its old Match-1/Final rows.
 await page.evaluate(async()=>{
   const {getXml229CurrentWorkerHeldReview}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   // Deliberate crash/cancellation without registry revoke: old production
   // failure left this dead object published and Weight tried to read it.
   getXml229CurrentWorkerHeldReview(window.__p4StateRef).cancel();
 });
 const closed=await page.evaluate(async()=>{
   const {getXml229CurrentWorkerHeldReview,installXml229WorkerHeldWeightPanel}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   const stale=getXml229CurrentWorkerHeldReview(window.__p4StateRef);
   window.__p4Panel=installXml229WorkerHeldWeightPanel(
     document.querySelector('#weight-panel'),window.__p4StateRef,
     {resolveInputs:async()=>window.__p4Options,existingWorkflow:true});
   return {registryEmpty:stale===null};
 });
 assert.equal(closed.registryEmpty,true,
   'dead verified session must be removed before Weight Match renders');
 await page.waitForFunction(()=>/Build 4 Preview/.test(
   document.querySelector('[data-p4-weight-status]')?.textContent||''));
 assert.equal(await page.locator('tr[data-p4-row]').count(),0);
 assert.doesNotMatch(await page.locator('[data-p4-weight-status]').textContent(),
   /Existing source review is stale: Worker closed/);
 // Explicit Preview rebuild re-attests same original Blob and masters.
 // An old accepted Match-1/Final cannot silently reappear: backups need
 // separate Owner-controlled file restore on an identical InputBasis.
 await page.locator('[data-p4-preview-build]').click();
 // Use a synchronous polling predicate. An async function returns a
 // Promise object, which some waitForFunction observers treat as truthy before
 // its resolved value; that previously navigated to Weight prematurely.
 await page.waitForFunction(()=>
   document.querySelector('[data-p4-preview-status]')?.textContent
     .includes('Preview engineering facts VERIFIED') &&
   document.querySelector('[data-p4-preview-build]')?.disabled===false,
   null,{timeout:120000});
 const reattached=await page.evaluate(async()=>{
   const {getXml229CurrentWorkerHeldReview,installXml229WorkerHeldWeightPanel}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   const before=getXml229CurrentWorkerHeldReview(window.__p4StateRef);
   window.__p4Panel=installXml229WorkerHeldWeightPanel(
     document.querySelector('#weight-panel'),window.__p4StateRef,
     {resolveInputs:async()=>window.__p4Options,existingWorkflow:true});
   const after=getXml229CurrentWorkerHeldReview(window.__p4StateRef);
   const observed=window.__p4RebuiltSession;
   return {hadLiveBefore:!!before,hadLiveAfter:!!after,
     closedBefore:before?.closed,closedAfter:after?.closed,
     basisBefore:before?.receipt?.basisId,basisAfter:after?.receipt?.basisId,
     observedClosed:observed?.closed,observedClosureCode:observed?.closureCode,
     observedBasis:observed?.receipt?.basisId,
     weightInitial:document.querySelector('[data-p4-weight-status]')?.textContent};
 });
 assert.equal(reattached.hadLiveBefore,true,
   'Preview reported VERIFIED but no live engineering Worker was held at Weight render: '+JSON.stringify(reattached));
 try{
   await page.waitForFunction(()=>
     document.querySelectorAll('tr[data-p4-row]').length===2 &&
     /0 accepted Match-1, 0 accepted Final/.test(
       document.querySelector('[data-p4-weight-status]')?.textContent||''),
     null,{timeout:120000});
 }catch(error){
   const snapshot=await page.evaluate(()=>({
     weightStatus:document.querySelector('[data-p4-weight-status]')?.textContent,
     rows:document.querySelectorAll('tr[data-p4-row]').length,
     previewStatus:document.querySelector('[data-p4-preview-status]')?.textContent,
     connected:!!document.querySelector('[data-p4-weight-root]')?.isConnected,
     errors:window.__p4Errors||[],
   }));
   snapshot.reattached=reattached;
   throw new Error('Reattached Worker physical review did not render: '+
     JSON.stringify(snapshot)+' | '+String(error?.message||error));
 }
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>window.__p4Panel.cancel());
 console.log(JSON.stringify({schema:'XML229_P4_WORKER_HELD_UI_CHROMIUM_V2',
   passed:true,closed,original,after,errors},null,2));
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
