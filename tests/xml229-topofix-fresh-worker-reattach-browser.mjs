/** Real Chromium + production GC-PW Worker: TopoFix manual Final guard must
 * survive Weight-panel destruction/reinstallation with an eligible proposal.
 * Synthetic L2 receipts exercise the importing browser boundary ONLY, not
 * Python transaction replay or private Owner source authorization.
 */
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
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/test.html'){
   res.writeHead(200,{'content-type':'text/html'});
   res.end('<!doctype html><html><body><div id="weight"></div></body></html>');
   return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep))throw Error('Outside checkout');
  const bytes=await readFile(file);
  res.writeHead(200,{'content-type':['.js','.mjs'].includes(path.extname(file))
   ?'text/javascript':'application/json'});res.end(bytes);
 }catch(error){res.writeHead(404);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
 const files=await page.evaluate(async()=>{
  const {installXml229WorkerHeldWeightPanel}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const {digestUtf8}=await import('/docs/contracts/gc-pw-v1/contract.mjs');
  const {psi116TopoFixBranchNodes,psi116TopoFixNodeSha256}=await import(
   '/docs/tabs/xml-cii-2019-standalone/integration/xml229-topofix-node-semantic-digest.mjs');
  const original='<PipeStressExport><Pipe><Branch>'+
   '<Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>'+
   '<Node><NodeNumber>100</NodeNumber><ComponentType>GASK</ComponentType>'+
   '<ElementLengthMm>2</ElementLengthMm><Position>0 0 0</Position></Node>'+
   '<Node><NodeNumber>150</NodeNumber><ComponentType>PIPE</ComponentType>'+
   '<Position>0 0 0</Position></Node>'+
   '<Node><NodeNumber>200</NodeNumber><ComponentType>RIGID</ComponentType>'+
   '<NodeName>88-VGT-25202</NodeName><BoreMm>200</BoreMm>'+
   '<ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint>'+
   '<ElementLengthMm>112</ElementLengthMm><Position>112 0 0</Position>'+
   '<Rigid>2</Rigid><Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>';
  const fixed=original.replace('<NodeNumber>100</NodeNumber>',
   '<NodeNumber>101</NodeNumber>');
  const sourceSha=await digestUtf8(original),fixedSha=await digestUtf8(fixed);
  const origNodes=psi116TopoFixBranchNodes(original)[0];
  const fixedNodes=psi116TopoFixBranchNodes(fixed)[0];
  const originals=await Promise.all(origNodes.map(psi116TopoFixNodeSha256));
  const finals=await Promise.all(fixedNodes.map(psi116TopoFixNodeSha256));
  const transactionSha='a'.repeat(64),reviewedActionIds=['ACT-BROWSER-SYNTHETIC'];
  const sourceOccurrenceMap=originals.map((sourceNodeSha256,i)=>({
   branchOccurrenceIndex:0,sourceNodeOrdinal:i,
   sourceNodeKey:'B0:N'+[100,150,200][i]+':S'+i,
   sourceNodeSha256,status:i===0?'RENUMBERED_CONNECTION':'RETAINED',
   fixedNodeOrdinal:i,fixedNodeSha256:finals[i],
   operationId:i===0?'OP-BROWSER-SYNTHETIC':null,
  }));
  const lineage={
   schema:'psi116-topofix-source-lineage/v1',
   sourceXmlSha256:sourceSha,fixedXmlSha256:fixedSha,
   transactionSha256:transactionSha,reviewedActionIds,sourceXmlMutated:false,
   state:'PRE_FINAL_ONLY',acceptedFinalTransferred:false,
   nativeCiiReleaseAuthorized:false,requiresFreshWorkerBasis:true,
   counts:{sourceNodeOccurrences:3,fixedNodeOccurrences:3,
    retainedNodeOccurrences:3,removedPlainPipeOccurrences:0,
    changedRetainedOccurrences:1},sourceOccurrenceMap,
  };
  const handoff={
   schema:'psi116-topofix-prefinal-handoff/v1',
   originalSourceXmlSha256:sourceSha,newSourceXmlSha256:fixedSha,
   transactionSha256:transactionSha,sourceNodeOccurrenceCount:3,
   fixedNodeOccurrenceCount:3,reviewedActionIds,
   requiresFreshWorkerBasis:true,acceptedFinalTransferred:false,
   nativeCiiReleaseAuthorized:false,
  };
  const raw='{"source":"synthetic-fresh-topofix-browser","components":[1,2]}';
  const blob=new Blob([raw],{type:'application/json'});
  const jsonSha=Array.from(new Uint8Array(await crypto.subtle.digest(
   'SHA-256',await blob.arrayBuffer())),
   n=>n.toString(16).padStart(2,'0')).join('');
  const sourceId='TOPOFIX-SYNTHETIC-BROWSER';
  const rows=[{Rating:'300',Bore:200,Length:112,'RF/RTJ KG':35,
   TypeDesc:'Gate Valve'}];
  const overrides={rating:{P8810021:'300'},
   processData:{P8810021:{rating:'300'}}};
  const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',
   phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',
   engineeringReady:false,sha256:jsonSha,
   sourceRevision:'o1:sha256:'+jsonSha,
   generationId:'topofix-browser-new-o1',sourceRefId:'synthetic-original-blob',
   byteLength:blob.size,occurrenceCount:2,pageCount:1};
  const inputs={xmlText:fixed,sourceId,
   masters:{weight:{datasetId:'browser-master',revision:'v1',
    rows,mapping:{weight:'RF/RTJ KG'}}},
   config:{weight:{masterRows:rows},overrides},overrides,
   selection:[{sourceId,selectionRef:'all'}],originalStagedBlob:blob,
   originalStagedSourceReceipt:receipt,
   requestId:'topofix-fresh-real-worker-browser',
   inputLease:'topofix-browser-lease-1',isCurrent:()=>true};
  const stateRef={current:{sourceText:fixed,sourceKind:'xml'}};
  window.__topofixState=stateRef;window.__topofixInputs=inputs;
  window.__topofixFirstPanel=installXml229WorkerHeldWeightPanel(
   document.querySelector('#weight'),stateRef,
   {resolveInputs:async()=>inputs,existingWorkflow:true});
  return {original,lineage:JSON.stringify(lineage),handoff:JSON.stringify(handoff)};
 });
 await page.locator('details[data-xml229-topofix-fresh] summary').click();
 for(const [key,name,mimeType,value] of [
  ['original','original.xml','text/xml',files.original],
  ['lineage','lineage.json','application/json',files.lineage],
  ['handoff','handoff.json','application/json',files.handoff],
 ]){
  await page.locator('[data-xml229-topofix-file="'+key+'"]').setInputFiles({
   name,mimeType,buffer:Buffer.from(value,'utf8'),
  });
 }
 await page.locator('[data-action="xml229-topofix-fresh-worker"]').click();
 try{
  await page.waitForFunction(()=>
   document.querySelector('[data-p4-weight-root]')?.dataset.p4ReadReady==='true'
   &&document.querySelectorAll('tr[data-p4-row]').length===1,null,{timeout:120000});
 }catch(error){
  const detail=await page.evaluate(()=>({
   status:document.querySelector('[data-p4-weight-status]')?.textContent,
   handoff:document.querySelector('details[data-xml229-topofix-fresh] [role=status]')?.textContent,
   errors:window.__topofixErrors||[],
  }));
  throw new Error('TopoFix fresh UI/Worker did not become ready: '+
   JSON.stringify(detail)+' | '+String(error));
 }
 const before=await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const {getXml229TopoFixFreshWorkerProvenance}=await import(
   '/docs/tabs/xml-cii-2019-standalone/integration/xml229-topofix-fresh-worker-handoff.mjs');
  const session=getXml229CurrentWorkerHeldReview(window.__topofixState);
  window.__topofixSession=session;
  const page=await session.readPage({offset:0,limit:25,filter:'all'});
  const counts=(await session.readCompletion()).counts;
  return {basisId:session.receipt.basisId,
   hasProvenance:!!getXml229TopoFixFreshWorkerProvenance(session),
   closed:session.closed,counts,
   proposals:page.rows.flatMap(r=>r.proposals||[]).map(p=>({
    value:p.value,qualified:p.qualified,ranking:p.ranking,score:p.score}))};
 });
 assert.equal(before.closed,false);
 assert.equal(before.hasProvenance,true);
 assert.equal(before.counts.final,0,'new TopoFix Worker must begin with no Final');
 assert(before.proposals.some(p=>p.value===35&&p.qualified===true&&
   (p.score<=1?p.score*100:p.score)>=80),
   'real Worker must contain an eligible >=80% rank-1 35 kg proposal: '+JSON.stringify(before));
 // Destroy the actual panel DOM (not the Worker) and install a new one.
 const identity=await page.evaluate(async()=>{
  const {installXml229WorkerHeldWeightPanel,getXml229CurrentWorkerHeldReview}=
   await import('/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  window.__topofixFirstPanel.dispose();
  const container=document.querySelector('#weight');
  container.replaceChildren();
  window.__topofixSecondPanel=installXml229WorkerHeldWeightPanel(
   container,window.__topofixState,
   {resolveInputs:async()=>window.__topofixInputs,existingWorkflow:true});
  return getXml229CurrentWorkerHeldReview(window.__topofixState)===
   window.__topofixSession;
 });
 assert.equal(identity,true,'panel recreation must retain same live Worker');
 await page.waitForFunction(()=>
  /Existing verified Preview facts loaded/.test(
   document.querySelector('[data-p4-weight-status]')?.textContent||'')
  &&document.querySelectorAll('tr[data-p4-row]').length===1,
  null,{timeout:120000});
 const after=await page.evaluate(async()=>{
  const s=window.__topofixSession;
  const page=await s.readPage({offset:0,limit:25,filter:'all'});
  const completion=await s.readCompletion();
  return {basisId:s.receipt.basisId,closed:s.closed,
   counts:completion.counts,
   proposalValue:page.rows[0]?.proposals?.[0]?.value,
   nativeCiiReleaseAuthorized:completion.ciiReleaseAuthorized,
   displayedKg:document.querySelector('[data-p4-applied-weight]')?.value};
 });
 assert.equal(after.closed,false);
 assert.equal(after.basisId,before.basisId);
 assert.equal(after.counts.final,0,
  'reinstall must not silently accept eligible rank-1 Final 35 kg');
 assert.equal(after.proposalValue,35);
 assert.equal(after.nativeCiiReleaseAuthorized,false);
 assert.equal(after.displayedKg,'35',
  'proposal remains visible as editable draft without Final authority');
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>window.__topofixSecondPanel.cancel());
 console.log(JSON.stringify({schema:'XML229.TopoFixBrowserReattachManualOnly.v1',
  status:'PASS',realChromium:true,realWorker:true,
  beforeFinal:before.counts.final,afterFinal:after.counts.final,
  sameBasisId:true,proposalKg:35,nativeCiiReleaseAuthorized:false}));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
// Require both source byte forms on each served route, not only the LF fixture.
const {xml229TopologyRunJourneyResults}=await import('./xml229-topology-run-journey-browser.mjs');
assert.deepEqual(xml229TopologyRunJourneyResults,[
 {route:'root',inputFormat:'LF',status:'PASS'},{route:'/docs',inputFormat:'LF',status:'PASS'},
 {route:'root',inputFormat:'CRLF',status:'PASS'},{route:'/docs',inputFormat:'CRLF',status:'PASS'},
]);
