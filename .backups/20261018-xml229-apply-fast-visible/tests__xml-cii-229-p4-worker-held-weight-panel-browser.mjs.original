import assert from 'node:assert/strict';
import {exerciseXml229WorkerFixtureReview} from '../scripts/xml229-browser-ci-engineering-review.mjs';
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
 const page=await browser.newPage({acceptDownloads:true});
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
 // Owner regression: real numeric DOM input values on two 25-row pages,
 // source-pinned proposal selection, independent acceptance unchanged.
 const populated=await page.evaluate(async()=>{
   const {planXml229RigidWeightDrafts,hydrateXml229WeightDraftInputs}=await import(
     '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs');
   const {renderXml229WeightReviewPage}=await import(
     '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs');
   const basisId='b'.repeat(64),sourceId='SOURCE',writes=[],offsets=[];
   const rows=Array.from({length:27},(_,i)=>{
     const p={proposalId:'master-'+i,ranking:1,value:100+i/10,
       unit:'kg',qualified:true,score:.95};
     return {sourceId,occurrenceId:'occ-'+i,componentType:'VALV',
       nodeName:'VGT-'+i,shortName:'Gate Valve',dtxr:'GATE VALVE 300#',
       sourceKg:null,match1Kg:null,finalKg:null,proposals:[p],
       match1View:{match1Revision:'m1',stageDecision:null,proposals:[p]},
       finalView:{finalRevision:'f1',stageDecision:null}};
   });
   const qualifiedSuggestions=rows.map(r=>({
     occurrenceId:r.occurrenceId,proposalId:r.proposals[0].proposalId,
     value:r.proposals[0].value,unit:'kg',qualified:true,
   }));
   const session={receipt:{basisId,sourceId},async readPage(args){
     offsets.push(args.offset);
     return {basisId,offset:args.offset,totalCount:rows.length,complete:true,
       rows:rows.slice(args.offset,args.offset+args.limit)};
   },review(){writes.push('write');}};
   const prepared=await planXml229RigidWeightDrafts(session,{
     minScorePercent:80,qualifiedSuggestions});
   const host=document.createElement('div');
   const renderPage=(start,end)=>{
     const subset=rows.slice(start,end);
     host.innerHTML=renderXml229WeightReviewPage({
       totalCount:rows.length,rows:subset},start,{filter:'blank-rigid'});
     const count=hydrateXml229WeightDraftInputs(host,subset,prepared.drafts);
     const entries=[...host.querySelectorAll('tr[data-p4-row]')].map(tr=>({
       value:tr.querySelector('[data-p4-proposal]').value,
       selected:tr.dataset.p4PickedProposal,
       filled:tr.dataset.p4DraftFilled,
       accepted:tr.querySelector('[data-p4-match1-mass]').textContent,
     }));
     return {count,entries};
   };
   const first=renderPage(0,25),second=renderPage(25,27);
   let drift='';
   try{await planXml229RigidWeightDrafts(session,{
     minScorePercent:80,qualifiedSuggestions:[{...qualifiedSuggestions[0],value:999}],
   });}catch(e){drift=e.code||e.message;}
   return {prepared:prepared.counts.prepared,qualified:prepared.counts.workerQualified,
     firstPreparedIndex:prepared.firstPreparedIndex,first,second,
     offsets,writes,drift,
     title:host.textContent.includes('Applied Weight')};
 });
 assert.equal(populated.prepared,27);
 assert.equal(populated.qualified,27);
 assert.equal(populated.firstPreparedIndex,0);
 assert.equal(populated.first.count,25);
 assert.equal(populated.second.count,2);
 assert(populated.first.entries.every((p,i)=>p.value===String(100+i/10)&&
   p.selected==='master-'+i&&p.filled==='true'&&p.accepted==='—'));
 assert(populated.second.entries.every((p,i)=>p.value===String(102.5+i/10)&&
   p.selected==='master-'+(25+i)&&p.filled==='true'));
 assert.equal(populated.title,true);
 assert.equal(populated.drift,'SUGGESTION_WORKER_PLAN_PROPOSAL_DRIFT');
 assert.deepEqual(populated.writes,[]);
 assert.deepEqual(populated.offsets,[0,25,0]);

 // Neither proposed nor source-null value may be mistaken for accepted mass.
 assert.match(await page.locator('[data-p4-weight-status]').textContent(),/Existing verified Preview facts/);
 const flowButton=page.locator('[data-p4-export-flow-trace]');
 const [flowDownload]=await Promise.all([
   page.waitForEvent('download'),flowButton.click(),
 ]);
 assert.equal(flowDownload.suggestedFilename(),'xml229-cross-worker-flow-trace.json');
 const trace=JSON.parse(await readFile(await flowDownload.path(),'utf8'));
 assert.equal(trace.schema,'XML229.CrossWorkerFlowTrace.v1');
 assert.equal(trace.nativeCiiReleaseAuthorized,false);
 for(const kind of ['BUILD_REQUESTED','CENSUS_REQUESTED','CENSUS_VERIFIED',
   'GC_PW_WORKER_STARTED','PREVIEW_CHILD_REQUESTED','PREVIEW_CHILD_COMPLETED',
   'FACTS_OPENED','GC_PW_READY','RPC_REQUESTED','RPC_COMPLETED',
   'WEIGHT_UI_RENDERED'])
   assert(trace.events.some(e=>e.kind===kind),'missing causal edge '+kind);
 assert(trace.events.some(e=>e.counts?.physical===2&&e.counts?.facts===14));
 assert(!JSON.stringify(trace).includes('Engineer verified physical master'));
 assert(!JSON.stringify(trace).includes('real-blob-in-worker'));
 const aggregateButton=page.locator('[data-p4-export-candidate-readiness]');
 const [aggregateDownload]=await Promise.all([
   page.waitForEvent('download'),aggregateButton.click(),
 ]);
 assert.equal(aggregateDownload.suggestedFilename(),
   'xml229-g3-g4-source-bound-aggregate.json');
 const evidence=JSON.parse(await readFile(await aggregateDownload.path(),'utf8'));
 assert.equal(evidence.schema,'XML229.G3G4.LocalAggregateEvidenceExport.v1');
 assert.equal(evidence.structuralStatus,'CONSISTENT');
 assert.equal(evidence.coverage.physicalCount,2);
 assert.equal(evidence.coverage.verifiedFactCount,14);
 assert.equal(evidence.coverage.counts.acceptedFinalCount,0);
 assert.equal(evidence.nativeCiiReleaseAuthorized,false);
 assert.equal(evidence.reviewDecisionsAuthorized,false);
 assert(!JSON.stringify(evidence).includes('real-blob-in-worker'));
 assert(!JSON.stringify(evidence).includes('Engineer verified physical master'));
 const first=page.locator('tr[data-p4-row]').first();
  const occurrenceId=await first.getAttribute('data-p4-occurrence');
  assert.equal(await first.locator('[data-p4-accept-match1],[data-p4-accept-final],[data-p4-reason]').count(),0);
  const reviewed=await exerciseXml229WorkerFixtureReview(page,{occurrenceId});
  assert.equal(reviewed.counts.match1,0);
  assert.equal(reviewed.counts.final,1);
  assert.equal(reviewed.nativeCiiReleaseAuthorized,false);
  await page.locator('[data-p4-scope="rigid"]').click();
  const after=await page.evaluate(()=>({
    rows:[...document.querySelectorAll('tr[data-p4-row]')].map(tr=>tr.textContent),
    status:document.querySelector('[data-p4-weight-status]').textContent,
  }));
  assert.match(after.rows[0],/35 kg/);
  assert.match(after.rows[0],/40 kg/);
  assert.doesNotMatch(after.rows[1],/40 kg/);
  const [afterDownload]=await Promise.all([
   page.waitForEvent('download'),aggregateButton.click(),
 ]);
 const afterEvidence=JSON.parse(await readFile(await afterDownload.path(),'utf8'));
 assert.equal(afterEvidence.coverage.basisId,evidence.coverage.basisId);
 assert.equal(afterEvidence.coverage.counts.acceptedMatch1Count,1);
 assert.equal(afterEvidence.coverage.counts.acceptedFinalCount,1);
 assert.equal(afterEvidence.readiness.counts.final,1);
 assert.equal(afterEvidence.nativeCiiReleaseAuthorized,false);
 assert(!Object.hasOwn(afterEvidence.coverage,'candidateRows'));
 assert(!Object.hasOwn(afterEvidence.coverage,'originalPhysicalOccurrences'));
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
 // The SAME active GC-PW session must flow into canonical Output/Run,
 // with a separate typed intentional native-consumption HOLD, not an RPC fault.
 await page.evaluate(async()=>{
   const {renderStandaloneOutputRunPanel}=await import(
     '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js');
   const o=window.__p4Options;
   window.__p4StateRef.current={
     sourceText:o.xmlText,sourceKind:'xml',
     xml229StagedSourceReceipt:o.originalStagedSourceReceipt,
     modeASourceId:o.sourceId,supportConfigJson:'{}',
     options:{outputMode:'both'},masterContext:{},
   };
   renderStandaloneOutputRunPanel(
     document.querySelector('#run-panel'),window.__p4StateRef,()=>{});
   const {getXml229FlowTrace}=await import(
     '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs');
   window.__p4TracePeek=()=>getXml229FlowTrace(window.__p4StateRef)?.snapshot();
 });
 await page.waitForFunction(()=>
   window.__p4TracePeek?.()?.events?.some(e=>e.kind==='RUN_GATE_HELD')===true,
   null,{timeout:120000});
 const outputTrace=await page.evaluate(()=>window.__p4TracePeek());
 const audited=outputTrace.events.map(e=>e.kind);
 assert(audited.includes('OUTPUT_READ_REQUESTED'));
 assert(audited.includes('OUTPUT_READ_VERIFIED'));
 assert(audited.includes('RUN_GATE_HELD'));
 assert(outputTrace.findings.includes('NATIVE_RELEASE_HOLD_EXPECTED'));
 assert.equal(outputTrace.nativeCiiReleaseAuthorized,false);
 assert(!audited.includes('OUTPUT_READ_FAILED'));

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
