/** Actual Pyodide converter + independent CII check with synthetic spatial load. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const baseline=process.env.XML229_LINEAGE_BASELINE==='1';
const ef05=process.env.XML229_LINEAGE_EF05==='1';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8080/');
 const proof=await page.evaluate(async ({baseline,ef05})=>{
  const {createStandaloneEngineWorkerClient}=await import(
   '/converters/xml-cii-2019-standalone/engine-worker-client.mjs');
  const {reconcileXml229ActualCiiAgainstFinal}=await import(
   '/converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs');
  const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest(
   'SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
  const nodes='<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node>'+
   '<Node><NodeNumber>20</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>R</ComponentRefNo>'+
   '<Endpoint>2</Endpoint><Position>100 0 0</Position><Rigid>2</Rigid><Weight>0</Weight></Node>';
  let sourceText='<PipeStressExport><Pipe><Branch><Branchname>TEST</Branchname>'+nodes+'</Branch></Pipe></PipeStressExport>';
  // Deliberate scale load, not Owner engineering inputs or accepted masses.
  const stagedJsonText=JSON.stringify([{type:'BRANCH',name:'TEST',children:Array.from(
   {length:3000},(_,i)=>({type:'SUPPORT',name:'SYNTHETIC-'+i,position:[i*100,1000000,1000000],
    attributes:{DTXR:'GUIDE',MDSSUPPTYPE:'GT500'}}))}]);
  let sourceSha=await digest(sourceText),basisId='a'.repeat(64);
  const jsonSha=await digest(stagedJsonText);
  let packet={schema:'XML229.NativeFinalPhysicalPacket.v1',sourceId:'SCALE',
   originalJsonSha256:jsonSha,sourceGenerationId:'SYNTHETIC-SCALE-TEST',basisId,
   sourceXmlSha256:sourceSha,finalIntentSha256:'b'.repeat(64),physicalCount:1,
   nativeCiiReleaseAuthorized:false,components:[{effectiveKg:4.5,
    occurrenceId:JSON.stringify(['SCALE',0,1,JSON.stringify(['RIGID','R','2',''])])}],
   finalizedGeometry:{schema:'XML229.FinalizedWeightGeometry.v1',basisId,sourceXmlSha256:sourceSha,
    xmlText:sourceText,sha256:sourceSha,originalNodeCount:2,retainedSourceOrdinalsByBranch:[[0,1]],
    assignedNodeNumbers:[],rigidEdgePromotions:[],instrumentModelingSuggestions:[],
    prefinalRestraints:{schema:'XML229.PrefinalRestraints.v1',originalJsonSha256:jsonSha}}};
  if(ef05){
   sourceText=await(await fetch('/Benchmarks/EF-05-PRO.TEST.xml')).text();
   const {createPreviewBasis}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js');
   const {projectXmlCiiOccurrences}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js');
   const {xmlCiiDryRunPreview}=await import('/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js');
   const {openXml229EngineeringFactModel}=await import('/tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs');
   const sourceId='PUBLIC-EF05-SYNTHETIC-MASSES',masters={},config={},overrides={};
   const selection=[{sourceId,selectionRef:'all'}];
   const basis=await createPreviewBasis({domainId:'xml-cii/2019',sources:[{sourceId,mediaType:'application/xml',text:sourceText}],
    masters,selection,stagedSource:stagedJsonText,config,overrides,sha256:digest});
   const projection=projectXmlCiiOccurrences({xmlText:sourceText,sourceId});
   const preview=xmlCiiDryRunPreview(sourceText,config,stagedJsonText);
   const opened=await openXml229EngineeringFactModel({basis,
    live:{sources:{[sourceId]:sourceText},masters,selection,stagedSource:stagedJsonText,config,overrides},
    xmlText:sourceText,sourceId,previewResult:{...preview,sourceOccurrences:projection,
     engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
    expectedOriginalCount:projection.branchCount+projection.nodeCount});
   packet={...packet,sourceId,basisId:basis.basisId,sourceXmlSha256:await digest(sourceText),
    finalizedGeometry:opened.finalizedGeometry,physicalCount:opened.physicalOccurrences.length,
    components:opened.physicalOccurrences.map(o=>({occurrenceId:o.occurrenceId,effectiveKg:4.5}))};
  }
  const client=createStandaloneEngineWorkerClient({timeoutMs:20000}),phases=[];
  const start=performance.now();
  try{
   const result=await client.run({sourceKind:'xml',sourceName:'SYNTHETIC-SCALE.xml',sourceText,
    stagedJsonText,supportConfigJson:'{}',options:{outputMode:'cii-only',splitCondensedValveFlange:false},
    xml229NativeFinalPacket:packet},{onProgress:phase=>phases.push({phase,elapsedMs:performance.now()-start})});
   if(!result.ok)throw Error(result.error);
   const check=await reconcileXml229ActualCiiAgainstFinal({originalXmlText:sourceText,packet,
    ciiText:result.ciiText,writerDiagnostic:result.xml229NativeMassDiagnostic});
   return {basis:ef05?'REAL_PUBLIC_EF05_SYNTHETIC_MASSES_3000_GROUPS':'SYNTHETIC_3000_GROUPS_REAL_PYODIDE',baseline,ok:true,
    durationMs:performance.now()-start,phases,massVerified:check.massConsumptionVerified,
    owners:check.physicalCount,
    nativeKg:result.xml229NativeMassDiagnostic.claims[0].massKg};
  }catch(error){return {baseline,ok:false,code:error.code||null,message:error.message,
    phase:error.phase||phases.at(-1)?.phase,durationMs:performance.now()-start,phases};}
  finally{client.dispose();}
 },{baseline,ef05});
 await mkdir('output/playwright',{recursive:true});
 await writeFile('output/playwright/xml229-lineage-scale-'+(ef05?'ef05':baseline?'before':'after')+'.json',JSON.stringify(proof,null,2));
 console.log(JSON.stringify(proof));
 if(baseline){assert.equal(proof.code,'STANDALONE_ENGINE_TIMEOUT');assert.equal(proof.phase,'ORIGINAL_LINEAGE_STAGE');}
 else{assert.equal(proof.ok,true,proof.message);assert.equal(proof.massVerified,true);assert.equal(proof.nativeKg,4.5);}
}finally{await browser.close();}
