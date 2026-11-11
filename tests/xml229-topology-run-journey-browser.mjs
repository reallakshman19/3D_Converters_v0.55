/** Actual Chromium, O1 + IDB, four small fixture masters, engineering Workers,
 * WASM Python topology/native engine and independent emitted-CII verification.
 * Explicit fixture Final edits are test input; no private Owner proof is claimed. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export const xml229TopologyRunJourneyResults=[];
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/journey.html'){
   res.setHeader('content-type','text/html');
   res.end('<!doctype html><html><body><div id="source"><label>Original JSON <input type="file" data-field="staged-json-file"></label></div><div id="run"></div><div id="weight"></div></body></html>');return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep))throw Error('Outside checkout');
  const types={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.zip':'application/zip'};
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch(error){res.writeHead(404);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
async function completion(page){return page.evaluate(async()=>
 (await window.journey.panel.getSession?.()?.readCompletion())||
 (await window.journey.worker().readCompletion()));}
async function enterMass(page,value){
 // A visible suggestion can already equal value. Clear/blur first so this is
 // an explicit edit, then wait for the UI's completed authoritative write.
 await page.locator('[data-p4-applied-weight]').fill('');
 await page.locator('[data-p4-applied-weight]').press('Tab');
 await page.locator('[data-p4-applied-weight]').fill(String(value));
 await page.locator('[data-p4-applied-weight]').press('Tab');
 await page.waitForFunction(()=>/Applied Weight recorded in the verified Worker/.test(
  document.querySelector('[data-p4-weight-status]')?.textContent||''),null,{timeout:120000});
 const proof=await completion(page);
 assert.equal(proof.counts.final,1);assert.equal(proof.counts.unresolved,0);
}
try{
 browser=await chromium.launch({headless:true});
 for(const [prefix,inputFormat] of [['','LF'],['/docs','LF'],['','CRLF'],['/docs','CRLF']]){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/journey.html');
  await page.evaluate(async({prefix,inputFormat})=>{
   const {xml229TopologyJourneyState}=await import('/tests/helpers/xml229-topology-journey-fixture.mjs');
   const base=prefix+'/tabs/xml-cii-2019-standalone/ui-adapted/';
   const intake=await import(base+'xml-cii-adapted-lfj-o1-intake.js');
   const p4=await import(base+'xml-cii-adapted-p4-verified-weight-panel.js');
   const ui=await import(base+'xml-cii-adapted-output-run.js');
   const ref={current:xml229TopologyJourneyState()};
   if(inputFormat==='CRLF')ref.current.sourceText=ref.current.sourceText.replace(/></g,'>\r\n<')+'\r\n';
   ref.current.sourceFile=new File([ref.current.sourceText],'synthetic.xml',{type:'application/xml'});
   const run=document.querySelector('#run'),weight=document.querySelector('#weight');
   const j=window.journey={ref,p4,base,panel:null,worker:()=>p4.getXml229CurrentWorkerHeldReview(ref)};
   j.originalText=ref.current.sourceText;
   j.originalSha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(j.originalText))),n=>n.toString(16).padStart(2,'0')).join('');
   j.draw=()=>{
    j.panel?.dispose();j.panel=null;run.replaceChildren();weight.replaceChildren();
    if(ref.current.activePhaseId==='weight-match')
     j.panel=p4.installXml229WorkerHeldWeightPanel(weight,ref,{existingWorkflow:true});
    else ui.renderStandaloneOutputRunPanel(run,ref,j.draw);
   };
   intake.installLfjO1SourceIntake(document.querySelector('#source'),ref);
  },{prefix,inputFormat});
  await page.locator('[data-field="staged-json-file"]').setInputFiles({
   name:'synthetic-original.json',mimeType:'application/json',
   buffer:Buffer.from('{"name":"synthetic-original","children":[{"name":"TEST-1","attributes":{"TYPE":"RIGID","POS":"0 500 0"}}]}'),
  });
  await page.waitForFunction(()=>window.journey.ref.current.xml229StagedSourceReceipt?.phase==='INDEX_COMMITTED',null,{timeout:120000});
  await page.evaluate(async()=>{
   const j=window.journey;await j.p4.openXml229P4VerifiedSession(j.ref);
   j.old=j.worker();j.oldReceipt={...j.old.receipt};
   j.ref.current={...j.ref.current,activePhaseId:'weight-match'};j.draw();
  });
  await page.waitForFunction(()=>document.querySelector('[data-p4-weight-root]')?.dataset.p4ReadReady==='true');
  await enterMass(page,7); // Deliberately different original fixture Final.
  await page.evaluate(()=>{const j=window.journey;j.ref.current={...j.ref.current,activePhaseId:'run'};j.draw();});
  await page.waitForFunction(()=>!!document.querySelector('[data-action="xml229-topology-analyze"]'));
  assert.equal(await page.locator('[data-action="xml229-native-run"]').isDisabled(),true);
  await page.locator('[data-action="xml229-topology-analyze"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-topofix-action-id]').length>0,null,{timeout:120000});
  assert.equal(await page.locator('[data-topofix-action-id]:checked').count(),0);
  assert.equal(await page.locator('[data-action="xml229-topology-commit"]').isDisabled(),true);
  const plan=await page.evaluate(async()=>{
   const {getXml229TopologyReview}=await import(window.journey.base+'xml229-topology-review-controller.mjs');
   const plan=JSON.parse(getXml229TopologyReview(window.journey.ref).result.topologyFixPlanText);
   return {actionId:plan.actions.find(a=>a.disposition==='SAFE_DROP_PIPE_GEOMETRY').action_id,
    planSha:plan.source.sha256,originalSha:window.journey.originalSha};
  });
  assert.equal(plan.planSha,plan.originalSha,'plan must bind exact input UTF-8 bytes');
  await page.locator('[data-topofix-action-id="'+plan.actionId+'"]').check();
  await page.locator('[data-action="xml229-topology-commit"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-action="xml229-topology-fresh-weight"]')?.disabled===false,null,{timeout:120000});
  const committedSource=await page.evaluate(async()=>{
   const j=window.journey,{getXml229TopologyReview}=await import(j.base+'xml229-topology-review-controller.mjs');
   const result=getXml229TopologyReview(j.ref).result;
   return {sourceUnchanged:j.ref.current.sourceText===j.originalText,
    lineageSha:JSON.parse(result.topoFixLineageText).sourceXmlSha256,
    handoffSha:JSON.parse(result.topoFixPreFinalHandoffText).originalSourceXmlSha256};
  });
  assert(committedSource.sourceUnchanged);assert.equal(committedSource.lineageSha,plan.originalSha);
  assert.equal(committedSource.handoffSha,plan.originalSha);
  await page.locator('[data-action="xml229-topology-fresh-weight"]').click();
  await page.waitForFunction(()=>window.journey.ref.current.activePhaseId==='weight-match'&&
   document.querySelector('[data-p4-weight-root]')?.dataset.p4ReadReady==='true',null,{timeout:120000});
  const fresh=await page.evaluate(async()=>{
   const j=window.journey,s=j.worker(),counts=(await s.readCompletion()).counts;
   const {canXml229AutoCommitSuggestedFinal,getXml229TopoFixFreshWorkerProvenance}=await import(
    j.base.replace('ui-adapted/','integration/')+'xml229-topofix-fresh-worker-handoff.mjs');
   return {oldClosed:j.old.closed,newGeneration:s.receipt.sourceGenerationId!==j.oldReceipt.sourceGenerationId,
    newBasis:s.receipt.basisId!==j.oldReceipt.basisId,counts,
    manualOnly:!canXml229AutoCommitSuggestedFinal(s),provenance:!!getXml229TopoFixFreshWorkerProvenance(s),
    oldFinalCleared:j.ref.current.xml229FinalReviewBackup===null,hasCii:!!j.ref.current.result?.ciiText};
  });
  assert(fresh.oldClosed&&fresh.newGeneration&&fresh.newBasis&&fresh.manualOnly&&fresh.provenance);
  assert.equal(fresh.counts.final,0);assert.equal(fresh.counts.unresolved,1);
  assert(fresh.oldFinalCleared);assert.equal(fresh.hasCii,false);
  console.log(JSON.stringify({stage:'fresh-topofix-weight',route:prefix||'root',inputFormat,...fresh}));
  await page.evaluate(()=>window.journey.draw());
  await page.waitForFunction(()=>document.querySelector('[data-p4-weight-root]')?.dataset.p4ReadReady==='true');
  assert.equal((await completion(page)).counts.final,0,'panel recreation must not accept Final');
  await enterMass(page,12.5); // Explicit synthetic new-basis Final via the actual UI.
  // Attach rejection immediately so timeout cannot hide the actual Run error.
  const download=page.waitForEvent('download',{timeout:195000}).then(
   event=>({event}),error=>({error:String(error)}));
  await page.evaluate(()=>{const j=window.journey;j.ref.current={...j.ref.current,activePhaseId:'run'};j.draw();});
  try{
   await page.waitForFunction(()=>window.journey.ref.current.running===true||!!window.journey.ref.current.result,
    null,{timeout:15000});
   await page.waitForFunction(()=>!!window.journey.ref.current.result,
    null,{timeout:180000});
   const result=await page.evaluate(()=>window.journey.ref.current.result);
   assert.equal(result?.xml229NativeOutput?.nativeCiiReleaseAuthorized,true,JSON.stringify(result));
  }catch(error){
   const diagnostic=await page.evaluate(async()=>{
    const j=window.journey,s=j.worker(),proof=await s.readCompletion();
    const {buildStandaloneOutputRunReadiness}=await import(j.base.replace('ui-adapted/','')+'xml-cii-output-run-readiness.js');
    const report=buildStandaloneOutputRunReadiness(j.ref.current,{
     verifiedEngineering:{sessionReceipt:s.receipt,proof,finalIntent:await s.readNativeFinalIntent()}});
    return {running:j.ref.current.running,result:j.ref.current.result,
     counts:proof.counts,blocks:report.checklistRows.filter(r=>r.blocking),
     runAction:document.querySelector('[data-action="xml229-native-run"]')?.disabled,
     topologyPending:!!j.ref.current.xml229TopoFixFreshReviewPending};
   });
   throw Error('Native journey failed: '+JSON.stringify({route:prefix||'root',diagnostic,errors})+' | '+String(error));
  }
  const received=await download;assert.equal(received.error,undefined,received.error);
  assert.match(received.event.suggestedFilename(),/\.cii$/);
  const emitted=await page.evaluate(()=>{
   const result=window.journey.ref.current.result,proof=result.xml229NativeOutput;
   return {ok:result.ok,hasCii:!!result.ciiText,physicalCount:proof.physicalCount,
    exact:proof.strictOneToOneOwnerMatch,massVerified:proof.massConsumptionVerified,
    ciiSha256:proof.actualCiiSha256};
  });
  assert(emitted.ok&&emitted.hasCii&&emitted.exact&&emitted.massVerified);assert.equal(emitted.physicalCount,1);
  assert.deepEqual(errors,[]);
  xml229TopologyRunJourneyResults.push({route:prefix||'root',inputFormat,status:'PASS'});
  console.log(JSON.stringify({schema:'XML229.TopoFixToNativeBrowserJourney.v1',route:prefix||'root',
   inputFormat,sourceHashBinding:'EXACT_INPUT_UTF8',status:'PASS',realChromium:true,realO1:true,realEngineeringWorkers:true,realWasmPython:true,
   originalFixtureKg:7,freshFinalBeforeExplicitSelection:0,finalFixtureKg:12.5,...emitted}));
  await page.evaluate(()=>window.journey.worker()?.cancel());await page.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
