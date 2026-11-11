import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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
   // Monotonic, non-authorizing stage timings for the actual Worker-held
   // original JSON path. Do not collect raw source/master data or infer RAM.
   const stageTimings=[];
   const coldStartedMs=performance.now();
   const inputs={xmlText:xml,sourceId,masters,config,overrides:{},
     selection:[{sourceId,selectionRef:'all'}],
     originalStagedBlob:blob,originalStagedSourceReceipt:receipt,
     requestId:'owner-p4-authentic-source-one',
     isCurrent:()=>current,onProgress:s=>{
       progress.push(s);
       stageTimings.push({stage:s,elapsedMs:Math.round(performance.now()-coldStartedMs)});
     }};
   const remote=await openXml229WorkerHeldOriginalWeightReview(inputs);
   const previewReadyElapsedMs=Math.round(performance.now()-coldStartedMs);
   // Freeze the Preview-only window. Subsequent review/transfer RPCs may
   // report later progress and must not distort cold Preview readiness.
   const previewStageTimings=stageTimings.slice();
   const coverageBefore=await remote.readCandidateCoverage();
   const pairBefore=await remote.readCandidateReadinessPair();
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
   const coverageAfter=await remote.readCandidateCoverage();
   const pairAfter=await remote.readCandidateReadinessPair();
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
     badReason,stale,changed,progress,previewReadyElapsedMs,stageTimings:previewStageTimings,
     intentBefore,intentAfter,completeIntent,coverageBefore,coverageAfter,
     pairBefore,pairAfter,attested,badMass,duplicate,extra};
   remote.cancel();
   const badBlob=new Blob([raw.slice(0,-1)+' '],{type:'application/json'});
   const bad=await openXml229WorkerHeldOriginalWeightReview({
     ...inputs,requestId:'owner-p4-source-bad-blob',
     originalStagedBlob:badBlob,isCurrent:()=>true,
   }).then(()=>null,e=>e.code);
   return {...outcome,badBlob:bad,controlledEngineXml:enriched};
 });
 assert.match(data.receipt.basisId,/^[0-9a-f]{64}$/);
 assert.equal(data.receipt.originalJsonSha256?.length,64);
 assert.equal(data.receipt.engineeringFactsVerified,true);
 assert.equal(data.receipt.weightEngineeringAccepted,false);
 assert.equal(data.receipt.finalEngineeringAccepted,false);
 assert.equal(data.physCount,3);
 assert.equal(data.factsCount,21);
 for(const pair of [data.pairBefore,data.pairAfter]){
   assert.equal(pair.schema,'XML229.G3G4.SourceBoundAggregatePair.v1');
   assert.equal(pair.reconciliation.status,'CONSISTENT');
   assert.equal(pair.reconciliation.authoritative,false);
   assert.equal(pair.reconciliation.nativeCiiReleaseAuthorized,false);
   assert.equal(pair.nativeCiiReleaseAuthorized,false);
   assert.equal(pair.reviewDecisionsAuthorized,false);
   assert.equal(pair.coverage.basisId,pair.readiness.basisId);
   assert.equal(pair.coverage.sourceGenerationId,pair.readiness.sourceGenerationId);
   assert.equal(pair.coverage.verifiedFactCount,pair.readiness.verifiedFactCount);
   assert.equal(pair.coverage.physicalCount,pair.readiness.verifiedPhysicalCount);
 }
 assert.equal(data.pairBefore.coverage.counts.acceptedFinalCount,0);
 assert.equal(data.pairAfter.coverage.counts.acceptedFinalCount,3);
 assert.equal(data.pairAfter.readiness.counts.final,3);
 assert(!Object.hasOwn(data.pairAfter,'occurrenceIds'));
 assert(!Object.hasOwn(data.pairAfter,'candidates'));
 assert.equal(data.coverageBefore.schema,'XML229.G3.CandidateCoverageReport.v1');
 assert.equal(data.coverageBefore.physicalCount,3);
 assert.equal(data.coverageBefore.verifiedFactCount,21);
 assert.equal(data.coverageBefore.counts.acceptedFinalCount,0);
 assert.equal(data.coverageBefore.counts.acceptedMatch1Count,0);
 assert.equal(data.coverageBefore.nativeCiiReleaseAuthorized,false);
 assert.equal(data.coverageAfter.counts.acceptedFinalCount,3);
 assert.equal(data.coverageAfter.counts.acceptedMatch1Count,1);
 assert.equal(data.coverageAfter.nativeCiiReleaseAuthorized,false);
 assert.equal(data.coverageAfter.proposalCount,
   data.coverageAfter.counts.qualifiedCandidateCount+
   data.coverageAfter.counts.unqualifiedCandidateCount);
 assert(!Object.hasOwn(data.coverageBefore,'occurrenceIds'));
 assert(!Object.hasOwn(data.coverageAfter,'candidates'));
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
 const acceptedXml=data.controlledEngineXml; // Synthetic, public test only.
 assert.equal(createHash('sha256').update(acceptedXml).digest('hex'),
   data.attested.engineInputSha256,
   'Exact source-bound Final engine-input digest must match native CLI bytes');
 const tmp=await mkdtemp(path.join(tmpdir(),'xml229-native-final-consumer-'));
 let consumer;
 try{
   const nativeIn=path.join(tmp,'attested-engine.xml');
   const nativeOut=path.join(tmp,'emitted-native.cii');
   await writeFile(nativeIn,acceptedXml,'utf8');
   execFileSync('python3',[
     path.join(root,'converters/scripts/xml_to_cii2019_runtime_custody.py'),
     '--input',nativeIn,'--output',nativeOut,'--weight-scale','10',
   ],{timeout:30000,stdio:'pipe'});
   const cii=await readFile(nativeOut,'utf8');
   const rSection=cii.split('#$ RIGID\n')[1]?.split('#$ ')[0]?.trim()||'';
   const nativeWeights=rSection.split('\n').filter(Boolean)
     .map(line=>Number(line.trim().split(/\s+/)[0]));
   assert(nativeWeights.every(v=>Number.isFinite(v)&&v>=0));
   consumer={
     schema:'XML229.SyntheticFinalToActualNativeCiiWitness.v1',
     exactEngineInputDigestVerified:true,
     sourceBoundFinalCount:data.completeIntent.acceptedFinalCount,
     engineInputPhysicalCount:data.attested.verifiedEnginePhysicalCount,
     nativeRigidCount:nativeWeights.length,
     nativePositiveRigidCount:nativeWeights.filter(v=>v>0).length,
     originalFinalToRigidLineageComplete:false,
     nativeCiiReleaseAuthorized:false,
   };
 }finally{await rm(tmp,{recursive:true,force:true});}
 assert.equal(consumer.exactEngineInputDigestVerified,true);
 assert.equal(consumer.nativeCiiReleaseAuthorized,false);
 console.log('XML229_SYNTHETIC_FINAL_NATIVE_BOUNDARY '+JSON.stringify(consumer));

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
 // This stage exists only in the independent child Preview Worker. It is
 // source-bound evidence of actual child execution, not a mass/Run approval.
 assert(data.progress.includes('preview-json-byte-sha256'),
   'No independent Preview Worker JSON SHA stage was observed');
 assert(Number.isSafeInteger(data.previewReadyElapsedMs)&&data.previewReadyElapsedMs>=0);
 assert(Array.isArray(data.stageTimings)&&data.stageTimings.length>0);
 assert(data.stageTimings.every((entry,index,array)=>
   typeof entry.stage==='string'&&Number.isSafeInteger(entry.elapsedMs)&&
   entry.elapsedMs>=0&&entry.elapsedMs<=data.previewReadyElapsedMs&&
   (index===0||entry.elapsedMs>=array[index-1].elapsedMs)),
   'Stage durations must be ordered and bounded by cold Preview readiness');
 assert(data.stageTimings.some(entry=>entry.stage==='preview-json-byte-sha256'));
 assert(data.progress.includes('gc-pw-one-basis-source-bound-weight-review'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({schema:'XML229_P4_WORKER_HELD_ORIGINAL_BLOB_V1',
   passed:true,output:data,errors},null,2));
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
