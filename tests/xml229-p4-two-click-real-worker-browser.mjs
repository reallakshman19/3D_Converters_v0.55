/** Real served Chromium two-click workflow against a synthetic original XML Worker. */
import assert from 'node:assert/strict';
import {runXml229InstrumentActiveSourceBrowserCases} from './xml229-instrument-active-source-browser-cases.mjs';
import {handleXml229InstrumentNativeRequest} from './xml229-instrument-native-browser-transport.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {reconcileXml229ActualCiiAgainstFinal}
 from '../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/native-instrument-control'){
   await handleXml229InstrumentNativeRequest(req,res);return;
  }
  if(pathname==='/test.html'){
   res.writeHead(200,{'content-type':'text/html'});
   res.end('<!doctype html><html><body><div id="preview"></div><div id="weight"></div></body></html>');
   return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(root+path.sep))throw Error('Invalid file path');
  const bytes=await readFile(file);
  res.writeHead(200,{'content-type':['.js','.mjs'].includes(path.extname(file))
   ?'text/javascript':'application/json'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
 await page.evaluate(async()=>{
  const {installXml229P4PreviewBridge}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-preview-bridge.js');
  const {installXml229WorkerHeldWeightPanel}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const original='{"synthetic":"two-click-source-bound","components":[1,2]}';
  const blob=new Blob([original],{type:'application/json'});
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest(
    'SHA-256',await blob.arrayBuffer())),
    x=>x.toString(16).padStart(2,'0')).join('');
  const sourceId='P1-CHROMIUM-TWO-CLICK';
  const xml='<PipeStressExport><Pipe><Branch>'+
   '<Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>'+
   '<Node><NodeNumber>100</NodeNumber><ComponentType>GASK</ComponentType>'+
   '<ElementLengthMm>2</ElementLengthMm><Position>0 0 0</Position></Node>'+
   // Keep a real pre-finalized predecessor so the native CII contains
   // one physical element after Worker removes the GASK.
   '<Node><NodeNumber>150</NodeNumber><ComponentType>PIPE</ComponentType>'+
   '<Position>0 0 0</Position></Node>'+
   '<Node><NodeNumber>200</NodeNumber><ComponentType>RIGID</ComponentType>'+
   '<NodeName>88-VGT-25202</NodeName><BoreMm>200</BoreMm>'+
   '<ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint>'+
   '<ElementLengthMm>112</ElementLengthMm><Position>112 0 0</Position>'+
   '<Rigid>2</Rigid><Weight>0</Weight></Node></Branch></Pipe></PipeStressExport>';
  const master=[{Rating:'300',Bore:200,Length:112,'RF/RTJ KG':35,TypeDesc:'Gate Valve'}];
  const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',
   phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
   sha256:sha,sourceRevision:'o1:sha256:'+sha,
   generationId:'xml229-p1-test-generation-1',sourceRefId:'p1-worker-source',
   byteLength:blob.size,occurrenceCount:2,pageCount:1};
  // Synthetic manual Preview rating, source-bound by the XML branch Line Key.
  const overrides={rating:{P8810021:'300'},processData:{P8810021:{rating:'300'}}};
  const options={
   xmlText:xml,sourceId,
   masters:{weight:{datasetId:'P1-test-master',revision:'v1',
    rows:master,mapping:{weight:'RF/RTJ KG'}}},
   config:{weight:{masterRows:master},overrides},overrides,
   selection:[{sourceId,selectionRef:'all'}],
   originalStagedBlob:blob,originalStagedSourceReceipt:receipt,
   requestId:'xml229-p1-two-click-chromium',isCurrent:()=>true,
  };
  const stateRef={current:{}};
  window.__stateRef=stateRef;window.__options=options;
  installXml229P4PreviewBridge(document.querySelector('#preview'),stateRef,
   {resolveInputs:async()=>options});
  installXml229WorkerHeldWeightPanel(document.querySelector('#weight'),stateRef,
   {resolveInputs:async()=>options});
 });
 await page.locator('[data-p4-preview-build]').click();
 try{
  await page.waitForFunction(()=>
   document.querySelector('[data-p4-preview-status]')?.textContent.includes(
    'Preview engineering facts VERIFIED')===true,null,{timeout:45000});
 }catch(error){
  const snapshot=await page.evaluate(()=>({
   status:document.querySelector('[data-p4-preview-status]')?.textContent,
   buildDisabled:document.querySelector('[data-p4-preview-build]')?.disabled,
   weightStatus:document.querySelector('[data-p4-weight-status]')?.textContent,
  }));
  throw new Error('Synthetic Preview authority was not verified: '+
   JSON.stringify(snapshot)+' | '+String(error?.message||error));
 }
 await page.evaluate(async()=>{
  const {installXml229WorkerHeldWeightPanel}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  installXml229WorkerHeldWeightPanel(document.querySelector('#weight'),
    window.__stateRef,{resolveInputs:async()=>window.__options});
 });
 await page.waitForFunction(()=>document.querySelectorAll('tr[data-p4-row]').length===1,
  null,{timeout:20000});
 await page.waitForFunction(async()=>{
   const {getXml229CurrentWorkerHeldReview}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   return (await getXml229CurrentWorkerHeldReview(window.__stateRef)?.readCompletion())?.counts?.final===1;
 },null,{timeout:30000});
 const before=await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const session=getXml229CurrentWorkerHeldReview(window.__stateRef);
  const page=await session.readPage({offset:0,limit:25,filter:'all',query:''});
  const proof=await session.readCompletion();
  return {counts:proof.counts,population:proof.verifiedPhysicalCount,
   rows:page.rows.map(r=>({nodeName:r.nodeName,componentType:r.componentType,
    rating:r.rating,bore:r.boreMm,length:r.lengthMm,
    proposals:r.proposals.map(p=>({kg:p.value,qualified:p.qualified,
      reasons:p.eligibilityReasons}))}))};
 });
 assert.equal(before.population,1); // GASK is in original XML, not a GC-PW physical weight owner
 assert.equal(before.counts.match1,0);
 assert.equal(before.counts.final,1,'automatic Applied Weight prefill must directly commit Worker Final');
 const eligible=before.rows.flatMap(r=>r.proposals).filter(p=>p.qualified===true);
 assert.equal(eligible.length,1,'Expected exact source family-qualified gate candidate: '+JSON.stringify(before));
 assert.equal(await page.locator('[data-p4-applied-weight]').count(),1);
 const headers=(await page.locator('.mc-rigid-review-table th').allTextContents()).map(s=>s.trim());
 assert.equal(headers.length,13,'the table must have one mass column, not separate recorded and applied fields');
 assert.equal(headers.includes('Recorded Weight'),false);
 assert.equal(headers[12],'Applied Weight');
 assert.equal(await page.locator('[data-p4-skip-weight],[data-p4-reason],[data-p4-review-match1],[data-p4-review-final],[data-p4-confirm-single]').count(),0,
  'the simplified Weight panel exposes one editable kg field only');
 assert.equal(await page.locator('tr[data-p4-row] [data-p4-applied-weight]').count(),1);
 assert.equal(await page.locator('[data-p4-bulk-confirm],[data-p4-candidate],[data-p4-accept-match1],[data-p4-accept-final]').count(),0);
 const input=page.locator('tr[data-p4-row] [data-p4-applied-weight]').first();
 await page.waitForFunction(()=>document.querySelector(
   'tr[data-p4-row] [data-p4-applied-weight]')?.value==='35',null,{timeout:30000});
 assert.equal(await input.inputValue(),'35',
  'real Worker rank-1 candidate should automatically prefill the one kg input');
 const proposed=await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const s=getXml229CurrentWorkerHeldReview(window.__stateRef);
  const evidence=(await s.readCompletion()).counts;
  const rows=(await s.readPage({offset:0,limit:25,filter:'all'})).rows;
  return {counts:evidence,proposals:rows.map(r=>r.proposals.map(p=>p.value))};
 });
 assert.equal(proposed.counts.match1,0);
 assert.equal(proposed.counts.final,1);
 assert.deepEqual(proposed.proposals,[[35]],'prefill must be traceable to real Worker proposal');
 await input.fill('35.5');
 await input.press('Tab'); // one-step direct Worker Final on edit completion
 await page.waitForFunction(async()=>{
   const {getXml229CurrentWorkerHeldReview}=await import(
    '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
   const s=getXml229CurrentWorkerHeldReview(window.__stateRef);
   const rows=(await s.readPage({offset:0,limit:25,filter:'all'})).rows;
   return rows[0]?.finalKg===35.5;
 },null,{timeout:30000});
 await page.locator('[data-p4-scope="all"]').click();
 await page.waitForFunction(()=>document.querySelector(
   'tr[data-p4-row] [data-p4-applied-weight]')?.value==='35.5',null,{timeout:30000});
 await page.locator('[data-p4-scope="rigid"]').click();
 assert.equal(await page.locator('tr[data-p4-row] [data-p4-applied-weight]').first().inputValue(),'35.5');
 const after=await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const s=getXml229CurrentWorkerHeldReview(window.__stateRef);
  const proof=await s.readCompletion();
  return {counts:proof.counts,nativeRelease:proof.ciiReleaseAuthorized};
 });
 assert.equal(after.counts.match1,0,'prefill and edit never accept Match-1');
 assert.equal(after.counts.final,1,'selected positive Applied Weight is accepted as owner-designated Worker Final');
 assert.equal(after.nativeRelease,false,'prefill and edit never authorize native CII');
 // Browser -> actual Worker acceptance packet -> real Python native CII
 // -> independent actual emitted-byte mass proof. Synthetic source only:
 // does not authorize any Owner 423-physical engineering output.
 const sourceAndFinal=await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  const session=getXml229CurrentWorkerHeldReview(window.__stateRef);
  const packet=await session.readNativeFinalPacket();
  const handoff=await session.readNativeOriginalJsonForEngine({packet});
  const autoJsonVerified=handoff.sha256===packet.originalJsonSha256&&
    await handoff.file.text()===await window.__options.originalStagedBlob.text();
  const page=await session.readPage({offset:0,limit:25,filter:'all',query:''});
  const displayedBasis=page.rows[0]?.proposals?.[0]?.candidateBasis;
  const optionalAdvice=await session.readInstrumentModelingSuggestions();
  const backup=await session.exportReviewBackup();
  let wrongGeometryRejected=null;
  try{
    await session.restoreReviewBackup({backup:{
      ...backup,finalizedGeometrySha256:'0'.repeat(64)}});
  }catch(error){wrongGeometryRejected=error?.code||String(error);}
  return {originalXmlText:window.__options.xmlText,
   packet,backup,wrongGeometryRejected,optionalAdvice,autoJsonVerified,displayedBasis,
   stagedJsonText:await handoff.file.text(),supportConfigJson:JSON.stringify(window.__options.config)};
 });
 const {originalXmlText,packet,backup,wrongGeometryRejected,optionalAdvice,autoJsonVerified,displayedBasis,
  stagedJsonText,supportConfigJson}=sourceAndFinal;
 assert.equal(displayedBasis.rowBore,200);
 assert.equal(displayedBasis.rowLength,112);
 assert.equal(displayedBasis.masterWeight,35);
 assert.equal(displayedBasis.masterRowOrdinal,0);
 assert(!Object.hasOwn(displayedBasis,'rowData'),'full master row must remain in Worker');
 assert.equal(autoJsonVerified,true,'native Run reuses exact O1 JSON without re-upload');
 assert.equal(optionalAdvice.schema,'XML229.OptionalInstrumentModelSuggestions.v1');
 assert.equal(optionalAdvice.approvalRequired,false);
 assert.equal(optionalAdvice.readOnly,true);
 assert.equal(optionalAdvice.sourceGeometryChanged,false);
 assert.equal(optionalAdvice.weightsAcceptedBySuggestions,false);
 assert(Array.isArray(optionalAdvice.items));
 assert.equal(backup.finalizedGeometrySha256,
              packet.finalizedGeometry.sha256);
 assert.equal(backup.physicalOwnerSchema,
              'XML229.PreAcceptancePhysicalPartCardinality.v2');
 assert.equal(wrongGeometryRejected,'REVIEW_BACKUP_FINAL_GEOMETRY_MISMATCH');
 assert.equal(packet.physicalCount,1);
 assert.equal(packet.components[0].effectiveKg,35.5);
 assert.equal(packet.finalizedGeometry.schema,'XML229.FinalizedWeightGeometry.v1');
 assert.equal(packet.finalizedGeometry.physicalLineage.schema,'XML229.SourcePhysicalLineage.v1');
 assert.equal(packet.finalizedGeometry.physicalLineage.counts.physicalOwners,1);
 assert.deepEqual(packet.finalizedGeometry.physicalLineage.branchConnectionAliases,[]);
 assert.equal(packet.finalizedGeometry.physicalLineage.nativeCiiReleaseAuthorized,false);
 assert.equal(packet.finalizedGeometry.originalNodeCount,3);
 assert.deepEqual(packet.finalizedGeometry.retainedSourceOrdinalsByBranch,[[1,2]]);
 assert.ok(!packet.finalizedGeometry.xmlText.includes('<ComponentType>GASK</ComponentType>'));
 const work=await mkdtemp(join(tmpdir(),'xml229-browser-final-native-'));
 let nativeProof,ciiText;
 try{
  const originalPath=join(work,'original.xml');
  const packetPath=join(work,'accepted.json');
  const stagedPath=join(work,'original-staged.json');
  const outputPath=join(work,'actual.cii');
  const proofPath=join(work,'native-proof.json');
  await writeFile(originalPath,originalXmlText);
  await writeFile(packetPath,JSON.stringify(packet));
  await writeFile(stagedPath,stagedJsonText);
  execFileSync('python3',[
   join(root,'converters/scripts/xml_to_cii2019_runtime_custody.py'),
   '--input',originalPath,'--output',outputPath,'--weight-scale','10',
   '--xml229-native-final-packet',packetPath,
   '--xml229-native-mass-proof',proofPath,
   '--staged-json',stagedPath,'--support-config-json',supportConfigJson,
  ],{encoding:'utf8',timeout:120000});
  ciiText=await readFile(outputPath,'utf8');
  nativeProof=JSON.parse(await readFile(proofPath,'utf8'));
 }finally{
  await rm(work,{recursive:true,force:true});
 }
 assert.equal(nativeProof.actualCiiSha256,createHash('sha256').update(ciiText).digest('hex'));
 assert.equal(nativeProof.finalizedGeometrySha256,packet.finalizedGeometry.sha256);
 assert.equal(nativeProof.claims[0].massKg,35.5);
 const independent=await reconcileXml229ActualCiiAgainstFinal({
  originalXmlText,packet,ciiText,writerDiagnostic:nativeProof,
 });
 assert.equal(independent.massConsumptionVerified,true,
  'independent emitted-byte oracle must reconcile real Worker Final');
 assert.equal(independent.strictOneToOneOwnerMatch,true);
 assert.equal(independent.physicalCount,1);
 assert.equal(independent.actualCiiSha256,nativeProof.actualCiiSha256);
 assert.equal(await page.locator('[data-p4-reason],[data-p4-review-match1],[data-p4-review-final],[data-p4-confirm-single]').count(),0);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({schema:'XML229.SimpleAppliedWeightChromium.v1',
  before,after,suggestionPrefilled:true,oneKgInput:true,appliedWeightEditedAndCommitted:true,
  match1NotNeeded:after.counts.match1===0,ownerSelectedFinalAccepted:after.counts.final===1,
  nativeCiiReleaseAuthorized:false}));
 await page.evaluate(async()=>{
  const {getXml229CurrentWorkerHeldReview}=await import(
   '/docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js');
  getXml229CurrentWorkerHeldReview(window.__stateRef)?.cancel();
 });
 await runXml229InstrumentActiveSourceBrowserCases(browser,'http://127.0.0.1:'+server.address().port);
}finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
}
