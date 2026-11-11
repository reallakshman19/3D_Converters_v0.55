/** Real Chrome + vendored WASM, exact native-engine output and UI heartbeat. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const base=process.env.XML229_BROWSER_URL||'http://127.0.0.1:8080';
assert(new URL(base).hostname==='127.0.0.1'||new URL(base).hostname==='localhost');
const browser=await chromium.launch({channel:process.env.XML229_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage();
 const workers=[];page.on('worker',worker=>workers.push(worker.url()));
 await page.goto(base,{waitUntil:'load'});
 const proof=await page.evaluate(async()=>{
  const {runXmlCii2019StandaloneEngineJob:run}=await import(
   '/tabs/xml-cii-2019-standalone/xml-cii-workflow-engine-client.js');
  const sourceText=await(await fetch('/Benchmarks/EF-05-PRO.TEST.xml')).text();
  const job={sourceKind:'xml',sourceName:'EF05.xml',sourceText,supportConfigJson:'{}',
   options:{outputMode:'cii-only',splitCondensedValveFlange:false}};
  let last=performance.now(),maxGapMs=0,ticks=0;
  const timer=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},20);
  const start=performance.now();
  const output=await run(job);
  await new Promise(resolve=>setTimeout(resolve,40));clearInterval(timer);
  const durationMs=performance.now()-start;
  if(!output.ok)throw new Error(output.error);
  // Independent transport comparison: same unchanged converter, called
  // directly only AFTER recording the responsive UI Worker measurement.
  const {runXmlCii2019StandaloneEngine:original}=await import(
   '/converters/xml-cii-2019-standalone/engine.js?v=20261001-single-weight-owners-1');
  const control=await original(job);
  if(!control.ok)throw new Error(control.error);
  const small='<PipeStressExport><Pipe><Branch><Branchname>TEST</Branchname>'+
   '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node>'+
   '<Node><NodeNumber>20</NodeNumber><ComponentType>RIGID</ComponentType><Rigid>2</Rigid>'+
   '<Position>100 0 0</Position><Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>';
  const sifJob={sourceKind:'xml',sourceName:'SIF.xml',sourceText:small,
   supportConfigJson:'{}',options:{outputMode:'enriched-only'},
   sifFacts:[{nodeNumber:20,dtxr:'SIF-TEST',teeDescription:'TEE-TEST'}]};
  const sifWorker=await run(sifJob),sifControl=await original(sifJob);
  const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest(
   'SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const nativeSource=small.replace('<Rigid>2</Rigid>',
   '<ComponentRefNo>REF</ComponentRefNo><Endpoint>2</Endpoint><Rigid>2</Rigid>');
  const sourceSha=await digest(nativeSource),basisId='a'.repeat(64);
  const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',sourceId:'BROWSER-TEST',
   sourceGenerationId:'SYNTHETIC-NATIVE-TEST',basisId,sourceXmlSha256:sourceSha,
   finalIntentSha256:'b'.repeat(64),physicalCount:1,nativeCiiReleaseAuthorized:false,
   components:[{occurrenceId:JSON.stringify(['BROWSER-TEST',0,1,
    JSON.stringify(['RIGID','REF','2',''])]),effectiveKg:4.5}],
   finalizedGeometry:{schema:'XML229.FinalizedWeightGeometry.v1',basisId,
    sourceXmlSha256:sourceSha,xmlText:nativeSource,sha256:sourceSha,
    originalNodeCount:2,
    retainedSourceOrdinalsByBranch:[[0,1]],assignedNodeNumbers:[],
    rigidEdgePromotions:[],instrumentModelingSuggestions:[]}};
  const nativePhases=[];
  const native=await run({...job,sourceName:'NATIVE.xml',sourceText:nativeSource,
   xml229NativeFinalPacket:packet},{onProgress:phase=>nativePhases.push(phase)});
  if(!native.ok)throw new Error(native.error);
  const {reconcileXml229ActualCiiAgainstFinal}=await import(
   '/converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs');
  const nativeCheck=await reconcileXml229ActualCiiAgainstFinal({
   originalXmlText:nativeSource,packet,ciiText:native.ciiText,
   writerDiagnostic:native.xml229NativeMassDiagnostic});
  return {durationMs,maxGapMs,ticks,ok:output.ok,ciiBytes:output.ciiText.length,
   ciiByteIdentical:output.ciiText===control.ciiText,ciiSha256:await digest(output.ciiText),
   sifWorkerOk:sifWorker.ok,sifControlOk:sifControl.ok,
   sifError:sifWorker.error||sifControl.error,
   sifByteIdentical:sifWorker.enrichedText===sifControl.enrichedText,
   sifFieldPresent:sifWorker.enrichedText.includes('<DTXR>SIF-TEST</DTXR>'),
   sifDiagnosticsIdentical:JSON.stringify(sifWorker.diagnostics?.postprocess)===
    JSON.stringify(sifControl.diagnostics?.postprocess),
   nativeMassVerified:nativeCheck.massConsumptionVerified,
   nativeOwnerCount:nativeCheck.physicalCount,
   nativeKg:native.xml229NativeMassDiagnostic.claims[0].massKg,
   nativeForceN:native.xml229NativeMassDiagnostic.claims[0].emittedForceN,nativePhases};
 });
 proof.converterWorkers=workers.filter(url=>url.includes('/engine-worker.mjs')).length;
 await mkdir('output/playwright',{recursive:true});
 await writeFile('output/playwright/xml229-responsive-run.json',JSON.stringify(proof,null,2));
 console.log(JSON.stringify(proof));
 assert.equal(proof.ok,true);assert(proof.ticks>20);
 assert(proof.maxGapMs<500,'UI timer must continue during native conversion');
 assert.equal(proof.ciiByteIdentical,true);
 assert.equal(proof.converterWorkers,1,'repeat jobs reuse one isolated converter');
 assert.equal(proof.sifWorkerOk,true,proof.sifError);
 assert.equal(proof.sifControlOk,true,proof.sifError);
 assert.equal(proof.sifByteIdentical,true);
 assert.equal(proof.sifFieldPresent,true);
 assert.equal(proof.sifDiagnosticsIdentical,true);
 assert.equal(proof.nativeMassVerified,true);assert.equal(proof.nativeOwnerCount,1);
 assert.equal(proof.nativeKg,4.5);assert.equal(proof.nativeForceN,45);
 for(const phase of ['ENGINE_QUEUED','WORKER_STARTED','SCRIPT_LOAD','ORIGINAL_LINEAGE_STAGE',
  'FINAL_MASS_BINDING','MODEL_PARSE','CII_SERIALIZE','EMITTED_MASS_VERIFY','OUTPUT_WRITE'])
  assert(proof.nativePhases.includes(phase),'Missing real converter phase '+phase);
}finally{await browser.close();}
