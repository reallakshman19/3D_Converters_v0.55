/** Actual served Run auto-offer browser proof with source-scoped Worker fixture.
 * This exercises DOM timing/visibility/dismiss/reopen, not native release.
 */
import assert from 'node:assert/strict';
import {runXml229InstrumentSourceBrowserCases} from './xml229-instrument-source-review-browser-cases.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/test.html'){
   res.writeHead(200,{'content-type':'text/html'});
   res.end('<!doctype html><html><body><div id="run"></div></body></html>');
   return;
  }
  const path=resolve(root,'.'+decodeURIComponent(pathname));
  if(!path.startsWith(root+sep))throw Error('Invalid source path');
  res.writeHead(200,{'content-type':['.js','.mjs'].includes(extname(path))
   ?'text/javascript':'text/plain'});
  res.end(await readFile(path));
 }catch(error){res.writeHead(404);res.end(String(error));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 // The UI uses the actual shipped button, popup, Final commit and source
 // participation modules. Only the authenticated source Worker is stubbed.
 await page.route('**/xml-cii-adapted-p4-verified-weight-panel.js',route=>
  route.fulfill({contentType:'text/javascript',body:
   'export const getXml229CurrentWorkerHeldReview=()=>window.__worker;'}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
 await page.evaluate(async()=>{
  const {createXml229RunMassReviewButton}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-mass-review-button.mjs');
  const basisId='b'.repeat(64),sourceId='EF05';
  const rows=Array.from({length:100},(_,i)=>({
   occurrenceId:'original-'+i,sourceId,nodeName:'Physical '+i,
   componentType:'VALV',branchName:'EF-05/1',lineKey:'EF-05',
   sourceKg:null,match1Kg:null,finalKg:i<85?i+1:null,
   proposals:i===90?[{value:5,unit:'kg',qualified:true},
    {value:17,unit:'kg',qualified:false},
    {value:3,unit:'kg',qualified:true},
    {value:80,unit:'kg',qualified:false}]:[],
  }));
  // Explicit synthetic display evidence; this browser harness does not score
  // engineering data. The separate tooltip unit invokes the real scorer.
  rows[90].componentType='INST';rows[90].boreMm=100;
  rows[90].rating='300';rows[90].lengthMm=305;
  rows[90].proposals=rows[90].proposals.map((p,i)=>({...p,method:'master',
   score:p.qualified?1:.45,candidateBasis:{masterRowOrdinal:i,type:'CONTROL',
    rowBore:100,rowRating:'300',rowLength:305,masterWeight:p.value,
    weightMethod:'master',lengthDelta:0}}));
  const decisions=[];
  window.__rows=rows;window.__decisions=decisions;
  window.__worker={
   receipt:{basisId,sourceId},closed:false,
   readCompletion:async()=>({basisId,verifiedPhysicalCount:100,
    counts:{final:rows.filter(x=>x.finalKg!==null).length,
     unresolved:rows.filter(x=>x.finalKg===null).length}}),
   readPage:async({offset,limit,filter,query})=>{
    if(filter!=='all'||query!=='')throw Error('Unexpected filter');
    return {basisId,offset,totalCount:100,complete:true,
     rows:rows.slice(offset,offset+limit)};
   },
   readIndividual:async({occurrenceId,stage})=>{
    const r=rows.find(x=>x.occurrenceId===occurrenceId);
    return {...r,basisId,stage,stageDecision:r.finalKg!==null
     ?{state:'accepted',value:r.finalKg}:null};
   },
   review:async({view,choice})=>{
    decisions.push({id:view.occurrenceId,choice});
    rows.find(x=>x.occurrenceId===view.occurrenceId).finalKg=choice.value;
    return {decisionRevision:'revision-'+decisions.length};
   },
  };
  const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',sourceId};
  const stateRef={current:{activePhaseId:'preview',xml229StagedSourceReceipt:receipt,
   sourceBatch:{activeSourceId:sourceId,sources:[{
    sourceId,xml229StagedSourceReceipt:receipt}]},sourceText:'<PipeStressExport/>',
   supportConfigJson:'{}'}};
  window.__stateRef=stateRef;window.__buttonFactory=createXml229RunMassReviewButton;
  window.__renderCount=0;
  const report={raw:{xml229VerifiedEngineering:true},
   runHoldAudit:{diagnosisCode:'UNRESOLVED_PHYSICAL_MASS'},
   checklistRows:[{id:'weight-match',status:'pending'}]};
  window.__report=report;
  const host=document.querySelector('#run');
  const createElement=(kind,label,css)=>{const e=document.createElement(kind);
   e.textContent=label||'';if(css)e.className=css;return e;};
  window.__addRunButton=()=>{
   const note=document.createElement('div');
   const btn=createXml229RunMassReviewButton({
    stateRef,report,approved:false,createElement,noteDiv:note,
    updateWorkflowState:(s,update)=>({...s,...update}),
    render:()=>{window.__renderCount++;},
   });
   host.append(btn,note);
   return btn;
  };
  window.__firstButton=window.__addRunButton();
 });
 // A verified Worker may be available while the Owner is still editing 4 Preview.
 // The automatic modal must not intercept source/Preview controls.
 assert.equal(await page.locator('[data-xml229-run-unresolved-dialog]').count(),0);
 await page.evaluate(()=>{
  window.__stateRef.current.activePhaseId='run';
  window.__firstButton=window.__addRunButton();
 });
 await page.locator('[data-xml229-run-unresolved-dialog]').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-run-zero-occurrence]').count(),15);
 assert.equal(await page.locator('[data-run-zero-kg]').count(),15);
 assert.deepEqual(await page.locator('[data-run-zero-kg]').evaluateAll(
  nodes=>nodes.map(n=>n.value)),Array(15).fill('0'));
 assert.equal(await page.evaluate(()=>window.__decisions.length),0,
  'automatic open cannot commit a zero');
 const chips=page.locator('[data-run-zero-occurrence="original-90"] [data-run-zero-suggestion]');
 assert.equal(await chips.count(),4);
 for(const chip of await chips.all()){
  const tip=await chip.getAttribute('title');
  assert.match(tip,/Weight master lookup/);assert.match(tip,/DN100/);
  assert.match(tip,/Length 305 mm/);assert.match(tip,/Weight master: record/);
  assert.match(tip,/selecting kg does not establish RIGID classification/);
  assert.equal(await chip.getAttribute('aria-description'),tip);
 }
 await chips.first().hover();await chips.first().focus();
 assert.equal(await page.evaluate(()=>window.__decisions.length),0);
 assert.equal(await page.locator('[data-run-zero-kg="original-90"]').inputValue(),'0');
 await page.locator('[data-run-zero-action="cancel"]').click();
 assert.equal(await page.locator('[data-xml229-run-unresolved-dialog]').count(),0);
 await page.evaluate(()=>window.__addRunButton());
 await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-xml229-run-unresolved-dialog]').count(),0,
  'dismissal is respected on a rerender of the same Worker');
 await page.locator('button.model-converters-run-btn').last().click();
 await page.locator('[data-xml229-run-unresolved-dialog]').waitFor();
 await page.locator('[data-run-zero-action="apply-max"]').click();
 assert.equal(await page.locator('[data-run-zero-kg="original-90"]').inputValue(),'80');
 assert.equal(await page.locator('[data-run-zero-kg="original-91"]').inputValue(),'0');
 assert.equal(await page.evaluate(()=>window.__decisions.length),0);
 assert.equal(await page.locator('[data-run-zero-occurrence="original-90"] td').first().evaluate(
  node=>getComputedStyle(node).whiteSpace),'normal');
 await page.locator('[data-run-zero-occurrence="original-90"] [data-run-zero-suggestion]').first().click();
 assert.equal(await page.locator('[data-run-zero-kg="original-90"]').inputValue(),'5');
 await page.locator('[data-run-zero-kg="original-90"]').fill('12.5');
 await page.locator('[data-run-zero-action="confirm"]').click();
 await page.waitForFunction(()=>window.__decisions.length===15);
 assert.equal(await page.locator('[data-xml229-run-unresolved-dialog]').count(),0);
 const outcome=await page.evaluate(()=>({
  accepted:window.__decisions.length,
  zero:window.__decisions.filter(x=>x.choice.action==='set-zero-mass').length,
  positive:window.__decisions.filter(x=>x.choice.action==='final-override').length,
  final:window.__rows.filter(x=>x.finalKg!==null).length,
  preserved:window.__rows.slice(0,85).every((x,i)=>x.finalKg===i+1),
  nativeResult:window.__stateRef.current.result||null,
 }));
 assert.deepEqual(outcome,{accepted:15,zero:14,positive:1,
  final:100,preserved:true,nativeResult:null});
 const auto=await page.evaluate(async()=>{
  const {offerXml229AutomaticNativeRun}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-auto-native.mjs');
  const worker=window.__worker,ref=window.__stateRef;
  const sha='a'.repeat(64),generationId='source-generation';
  worker.readNativeFinalPacket=async()=>({nativeCiiReleaseAuthorized:false});
  worker.receipt.originalJsonSha256=sha;
  worker.receipt.sourceGenerationId=generationId;
  ref.current.xml229StagedSourceReceipt={
   schema:'XML229.OriginalStagedSourceReceipt.v1',sha256:sha,generationId};
  const btn=document.createElement('button');
  btn.dataset.action='xml229-native-run';
  document.querySelector('#run').append(btn);
  let clicks=0;btn.addEventListener('click',()=>{clicks++;});
  const report={raw:{xml229VerifiedEngineering:true},checklistRows:[
   {id:'weight-match',status:'ready',blocking:false},
   {id:'xml229-original-json-engineering-authority',status:'held',blocking:true},
   {id:'run-result',status:'pending',blocking:false},
  ]};
  const invoke=()=>offerXml229AutomaticNativeRun({
   stateRef:ref,session:worker,report,button:btn,
   liveWorker:()=>window.__worker,
  });
  ref.current.activePhaseId='preview';const hidden=invoke();
  await Promise.resolve();
  const before=clicks;
  ref.current.activePhaseId='run';
  const scheduled=invoke(),concurrent=invoke();
  await Promise.resolve();
  const one=clicks;
  invoke();await Promise.resolve();
  const after=clicks;
  ref.current.result={ok:false,error:'NATIVE_CONVERSION_HELD'};
  const failedRun=invoke();await Promise.resolve();
  return {hidden,before,scheduled,concurrent,one,after,failedRun,
    resultUnchanged:ref.current.result.error==='NATIVE_CONVERSION_HELD',
    acceptedCount:window.__decisions.length};
 });
 assert.deepEqual(auto,{hidden:false,before:0,scheduled:true,
  concurrent:true,one:1,after:1,failedRun:false,
  resultUnchanged:true,acceptedCount:15},
  'automatic native launch only on active ready Run; one attempt and no Final writes');
 await runXml229InstrumentSourceBrowserCases(page);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({schema:'XML229.RunAutoPopupBrowser.v1',
  initiallyAutomatic:true,requiresExplicitConfirmation:true,basisTooltipsVerified:true,
  dismissedOncePerWorker:true,manuallyReopenable:true,
  existing85FinalPreserved:true,nativeReleaseAuthorized:false}));
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
