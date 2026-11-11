import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/test.html'){
   res.writeHead(200,{'content-type':'text/html'});
   res.end('<!doctype html><html><body><div id="test">P4 original Blob</div></body></html>');
   return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep))throw Error('path');
  const data=await readFile(file);
  res.writeHead(200,{'content-type':['.js','.mjs'].includes(path.extname(file))?
   'text/javascript':'application/json'});res.end(data);
 }catch(e){res.writeHead(404);res.end(String(e))}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port+'/test.html';
 await page.goto(url);
 const data=await page.evaluate(async()=>{
   const {openXml229WorkerHeldOriginalWeightReview}=await import(
    '/docs/tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs');
   const xml=`<PipeStressExport><Pipe><Branch><Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>
<Node><NodeNumber>280</NodeNumber><ComponentType>GASK</ComponentType><ElementLengthMm>2</ElementLengthMm><Position>0 0 0</Position></Node>
<Node><NodeNumber>300</NodeNumber><ComponentType>RIGID</ComponentType><Rigid>2</Rigid><BoreMm>200</BoreMm>
<ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint>
<ElementLengthMm>112</ElementLengthMm><Position>112 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>309</NodeNumber><ComponentType>VALV</ComponentType><BoreMm>200</BoreMm>
<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>
<ElementLengthMm>419</ElementLengthMm><Position>531 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>320</NodeNumber><ComponentType>INST</ComponentType>
<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>2</Endpoint>
<Position>650 0 0</Position><Weight>0</Weight></Node>
</Branch></Pipe></PipeStressExport>`;
   const sourceId='ORIGINAL-P4-BLOB';
   const raw='{"source":"P4-original-json","data":[{"id":1},{"id":2}]}';
   const blob=new Blob([raw],{type:'application/json'});
   const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
   const sha=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
   const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
     rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
     sha256:sha,sourceRevision:'owner:index:sha256:'+sha,
     generationId:'owner-generation-1',sourceRefId:'owner-original-blob',
     byteLength:blob.size,occurrenceCount:2,pageCount:1};
   const rows=[{Rating:'300',Bore:200,Length:112,'RF/RTJ KG':35}];
   const masters={weight:{datasetId:'owner-master',revision:'v1',
     rows,mapping:{weight:'RF/RTJ KG'}}};
   const config={weight:{masterRows:rows},overrides:{}};
   let current=true;
   const progress=[];
   const inputs={xmlText:xml,sourceId,masters,config,overrides:{},
     selection:[{sourceId,selectionRef:'all'}],
     originalStagedBlob:blob,originalStagedSourceReceipt:receipt,
     requestId:'owner-p4-authentic-source-one',
     isCurrent:()=>current,onProgress:s=>progress.push(s)};
   const remote=await openXml229WorkerHeldOriginalWeightReview(inputs);
   const intentBefore=await remote.readNativeFinalIntent();
   const owner=remote.originalPhysicalOccurrences[0];
   const match1=await remote.readIndividual({
     occurrenceId:owner.occurrenceId,stage:'RigidMatch1'});
   const facts=await remote.readFacts({limit:100});
   const initialFinal=await remote.readIndividual({
     occurrenceId:owner.occurrenceId,stage:'Rigidmatch2'});
   const acceptedMatch1=await remote.review({view:match1,choice:{
      action:'enter-manual',value:35,unit:'kg',
      reason:'Engineer verified original physical component and valve master',
   }});
   const postMatch1=await remote.readIndividual({
     occurrenceId:owner.occurrenceId,stage:'Rigidmatch2'});
   const badReason=await remote.review({view:postMatch1,choice:{
      action:'final-override',value:40,unit:'kg',reason:'',
   }}).then(()=>null,e=>e.code);
   const final=await remote.review({view:postMatch1,choice:{
     action:'final-override',value:40,unit:'kg',
     reason:'Separate approved Final review of physical component source',
   }});
   const postFinal=await remote.readIndividual({
     occurrenceId:owner.occurrenceId,stage:'RigidMatch1'});
   const intentAfter=await remote.readNativeFinalIntent();
   for(const [n,entry] of remote.originalPhysicalOccurrences.slice(1).entries()){
     const view=await remote.readIndividual({occurrenceId:entry.occurrenceId,stage:'Rigidmatch2'});
     await remote.review({view,choice:{action:'final-override',value:50+n,unit:'kg',
       reason:'Independent Final engineering approval of original occurrence '+n}});
   }
   const completeIntent=await remote.readNativeFinalIntent();
   const enriched=xml.replace('<Weight>0</Weight>','<Weight>40</Weight>')
     .replace('<Weight>0</Weight>','<Weight>50</Weight>')
     .replace('<Weight>0</Weight>','<Weight>51</Weight>');
   const attested=await remote.attestEngineInput({engineInputXmlText:enriched});
   const badMass=await remote.attestEngineInput({
     engineInputXmlText:enriched.replace('<Weight>40</Weight>','<Weight>41</Weight>'),
   }).then(()=>null,e=>e.code);
   const duplicate=await remote.attestEngineInput({
     engineInputXmlText:enriched.replace('</Branch>',
       '<Node><NodeNumber>300</NodeNumber><ComponentType>RIGID</ComponentType><Rigid>2</Rigid><BoreMm>200</BoreMm><ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint><ElementLengthMm>112</ElementLengthMm><Position>112 0 0</Position><Weight>40</Weight></Node></Branch>'),
   }).then(()=>null,e=>e.code);

   const extra=await remote.attestEngineInput({
     engineInputXmlText:enriched.replace('</Branch>',
       '<Node><NodeNumber>330</NodeNumber><ComponentType>INST</ComponentType><ComponentRefNo>extra-unclaimed</ComponentRefNo><Endpoint>2</Endpoint><Position>750 0 0</Position><Weight>44</Weight></Node></Branch>'),
   }).then(()=>null,e=>e.code);
   const stale=await remote.review({view:match1,choice:{
     action:'enter-manual',value:45,unit:'kg',reason:'Stale earlier review',
   }}).then(()=>null,e=>e.code);
   current=false;
   const changed=await remote.readFacts({limit:100}).then(()=>null,e=>e.code);
   const outcome={receipt:remote.receipt,physCount:remote.originalPhysicalOccurrences.length,
     factsCount:facts.totalCount,match1Before:match1.match1Kg,
     finalBefore:initialFinal.finalKg,
     acceptedMatch1:acceptedMatch1.view.match1Kg,
     subsequentFinalMatch1:postMatch1.match1Kg,
     finalAccepted:final.view.finalKg,
     finalMatch1Remains:postFinal.match1Kg,
     badReason,stale,changed,progress,intentBefore,intentAfter,completeIntent,attested,badMass,duplicate,extra};
   remote.cancel();
   const badBlob=new Blob([raw.slice(0,-1)+' '],{type:'application/json'});
   const bad=await openXml229WorkerHeldOriginalWeightReview({
     ...inputs,requestId:'owner-p4-source-bad-blob',
     originalStagedBlob:badBlob,isCurrent:()=>true,
   }).then(()=>null,e=>e.code);
   return {...outcome,badBlob:bad};
 });
 assert.match(data.receipt.basisId,/^[0-9a-f]{64}$/);
 assert.equal(data.receipt.originalJsonSha256?.length,64);
 assert.equal(data.receipt.engineeringFactsVerified,true);
 assert.equal(data.receipt.weightEngineeringAccepted,false);
 assert.equal(data.receipt.finalEngineeringAccepted,false);
 assert.equal(data.physCount,3);
 assert.equal(data.factsCount,21);
 assert.equal(data.match1Before,null);
 assert.equal(data.finalBefore,null);
 assert.equal(data.acceptedMatch1,35);
 assert.equal(data.subsequentFinalMatch1,35);
 assert.equal(data.finalAccepted,40);
 assert.equal(data.finalMatch1Remains,35);
 assert.equal(data.intentBefore.physicalCount,3);
 assert.equal(data.intentBefore.verifiedFactCount,21);
 assert.equal(data.intentBefore.unresolvedCount,3);
 assert.equal(data.intentBefore.nativeCiiReleaseAuthorized,false);
 assert.equal(data.intentAfter.acceptedFinalCount,1);
 assert.equal(data.intentAfter.unresolvedCount,2);
 assert.notEqual(data.intentBefore.intentSha256,data.intentAfter.intentSha256);
 assert.equal(data.intentAfter.nativeCiiReleaseAuthorized,false);
 assert.equal(data.completeIntent.acceptedFinalCount,3);
 assert.equal(data.completeIntent.unresolvedCount,0);
 assert.equal(data.completeIntent.match1OnlyCount,0);
 assert.equal(data.completeIntent.eligibleForEngineBinding,true);
 assert.equal(data.completeIntent.nativeCiiReleaseAuthorized,false);
 assert.equal(data.attested.complete,true);
 assert.equal(data.attested.originalPhysicalCount,3);
 assert.equal(data.attested.verifiedEnginePhysicalCount,3);
 assert.equal(data.attested.matches.length,3);
 assert.equal(data.attested.nativeCiiPhysicalSlotVerified,false);
 assert.equal(data.attested.nativeCiiReleaseAuthorized,false);
 assert.equal(data.attested.finalIntentSha256,data.completeIntent.intentSha256);
 assert.equal(data.badMass,'FINAL_WEIGHT_NOT_IN_ENGINE_INPUT');
 assert.equal(data.duplicate,'ENRICHED_COMPONENT_LINEAGE_AMBIGUOUS');
 assert.equal(data.extra,'EXTRA_ENRICHED_PHYSICAL_OWNER');
 assert.equal(data.completeIntent.physicalEngineConsumptionVerified,false);
 assert.notEqual(data.intentAfter.intentSha256,data.completeIntent.intentSha256);
 assert.match(data.intentAfter.intentSha256,/^[0-9a-f]{64}$/);
 assert.equal(data.badReason,'ENGINEERING_REASON_REQUIRED');
 assert.equal(data.stale,'STALE_INDIVIDUAL_REVIEW');
 assert.equal(data.changed,'STALE_INPUT');
 assert.equal(data.badBlob,'ORIGINAL_JSON_SHA256_DRIFT');
 assert(data.progress.includes('original-json-blob-sha256'));
 assert(data.progress.includes('gc-pw-one-basis-source-bound-weight-review'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({schema:'XML229_P4_WORKER_HELD_ORIGINAL_BLOB_V1',
   passed:true,output:data,errors},null,2));
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
