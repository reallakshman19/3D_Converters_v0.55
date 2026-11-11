/** Explicit orchestration-port tests. Real O1/Worker/native is a separate browser proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {createXml229InstrumentSourceRevision}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-instrument-source-review.mjs';
import {startXml229InstrumentFreshReview}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-instrument-fresh-review.mjs';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
installWeightBasisXmlDom(globalThis);
const node=(ep,x)=>'<Node><ComponentType>INST</ComponentType><ComponentRefNo>A</ComponentRefNo>'+
 '<Endpoint>'+ep+'</Endpoint><Position>'+x+' 0 0</Position></Node>';
const sourceText='<PipeStressExport><Branch>'+node(1,0)+node(2,305)+'</Branch></PipeStressExport>';

async function fixture(){
 const report={sourceXmlSha256:await digestUtf8(sourceText),unsupportedOwners:[{
  branchOccurrenceIndex:0,sourceNodeOrdinal:1,componentType:'INST',componentRefNo:'A',
  spanMm:305,reason:'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE'}]};
 const revision=await createXml229InstrumentSourceRevision({sourceText,report,selectedOwners:['[0,1]']});
 const old={receipt:{basisId:'old',sourceGenerationId:'g1',sourceId:'S'},closed:false,cancel(){this.closed=true;}};
 const config='{"defaultGap":7,"defaultFriction":0}';
 const stateRef={current:{sourceText,modeASourceId:'S',activePhaseId:'run',supportConfigJson:config,
  masterContext:{weightMasterRows:[{kg:123}]},xml229StagedSourceReceipt:{generationId:'g1',sha256:'JSON'},
  xml229AcceptedFinalIntent:{oldKg:123},xml229FinalReviewBackup:{oldKg:123},
  weightMatchResult:{old:true},result:{xml229NativeOwnerPreflight:report},
  options:{kgToNewton:true}}};
 let active=old,cancelled=0,rendered=0,opened=0;
 const capture=s=>JSON.stringify([s.sourceText,s.supportConfigJson,s.modeASourceId]);
 const ports={getWorker:()=>active,revoke:(_r,{expectedSession})=>{
  if(active===expectedSession){cancelled++;active.cancel();active=null;}
 },capture,compare:(a,b)=>a===capture(b),fullSelection:()=>{},resolveBlob:()=>({isCurrent:()=>true}),
  reset:(s,file,text)=>({...s,sourceFile:file,sourceText:text,sourceBatch:null,
   stagedJsonText:'',supportConfigJson:'{}'}),
  makeFile:(text,name)=>({text,name}),selection:()=>({}),update:(s,patch)=>({...s,...patch}),clearCaches:()=>{},
  reindex:async r=>{r.current={...r.current,xml229StagedSourceReceipt:{generationId:'g2',sha256:'JSON'}};},
  open:async()=>{opened++;active={receipt:{basisId:'new',sourceId:'S',sourceGenerationId:'g2',
   originalJsonSha256:'JSON',finalEngineeringAccepted:false},closed:false,cancel(){this.closed=true;},
   readCompletion:async()=>({basisId:'new',verifiedPhysicalCount:1,counts:{final:0}}),
   readInstrumentModelingSuggestions:async()=>({basisId:'new',sourceXmlSha256:revision.receipt.newSourceXmlSha256,items:[]})};return active;}};
 return {stateRef,sourceText,report,revision,ports,sourceIsCurrent:()=>true,
  render:()=>rendered++,old,config,counts:()=>({cancelled,rendered,opened}),active:()=>active};
}

test('explicit activation replaces source and old Worker, retains committed config and carries no old Final',async()=>{
 const f=await fixture(),original=f.stateRef.current;
 const proof=await startXml229InstrumentFreshReview(f),s=f.stateRef.current;
 assert.equal(s.sourceText,f.revision.revisedXml);assert.equal(s.xml229AcceptedFinalIntent,null);
 assert.equal(s.xml229FinalReviewBackup,null);assert.equal(s.weightMatchResult,null);assert.equal(s.result,null);
 assert.equal(s.running,false);assert.equal(s.supportConfigJson,f.config);
 assert.equal(s.masterContext,original.masterContext);assert.deepEqual(s.options,original.options);
 assert.equal(original.sourceText,sourceText);assert.equal(original.xml229AcceptedFinalIntent.oldKg,123);
 assert(f.old.closed);assert.notEqual(proof.basisId,f.old.receipt.basisId);
 assert.equal(proof.priorFinalDecisionsTransferred,false);assert.equal(proof.nativeCiiReleaseAuthorized,false);
 assert.deepEqual(f.counts(),{cancelled:1,rendered:1,opened:1});
});

test('stale source and tampered revised bytes are refused before replacing the current review',async()=>{
 for(const kind of ['stale','tampered','selection','partial','multi']){
  const f=await fixture(),old=f.stateRef.current;
  if(kind==='stale')f.sourceIsCurrent=()=>false;
  if(kind==='tampered')f.revision={...f.revision,revisedXml:f.revision.revisedXml.replace('305','306')};
  if(kind==='selection')f.revision={...f.revision,receipt:{...f.revision.receipt,classificationSelections:[]}};
  if(kind==='partial')f.ports.fullSelection=()=>{throw Error('PARTIAL');};
  if(kind==='multi')old.sourceBatch={sources:[{},{}]};
  await assert.rejects(()=>startXml229InstrumentFreshReview(f));
  assert.equal(f.stateRef.current,old);assert.equal(f.old.closed,false);assert.equal(f.counts().opened,0);
 }
});

test('fresh generation, source hash, identity and empty Final ledger are all challenged',async()=>{
 for(const kind of ['old-generation','old-basis','wrong-json','wrong-source','old-final','old-advice','selected-advice']){
  const f=await fixture(),open=f.ports.open;
  f.ports.open=async(...a)=>{
   const s=await open(...a);
   if(kind==='old-generation')s.receipt.sourceGenerationId='g1';
   if(kind==='old-basis')s.receipt.basisId='old';
   if(kind==='wrong-json')s.receipt.originalJsonSha256='OTHER';
   if(kind==='wrong-source')s.receipt.sourceId='OTHER';
   if(kind==='old-final')s.readCompletion=async()=>({basisId:'new',verifiedPhysicalCount:1,counts:{final:1}});
   if(kind==='old-advice')s.readInstrumentModelingSuggestions=async()=>({basisId:'new',sourceXmlSha256:f.report.sourceXmlSha256,items:[]});
   if(kind==='selected-advice')s.readInstrumentModelingSuggestions=async()=>({basisId:'new',sourceXmlSha256:f.revision.receipt.newSourceXmlSha256,
    items:[{branchOccurrenceIndex:0,secondSourceNodeOrdinal:1}]});
   return s;
  };
  await assert.rejects(()=>startXml229InstrumentFreshReview(f),/INSTRUMENT_FRESH_WORKER_NOT_VERIFIED/);
  assert.equal(f.active(),null);assert.equal(f.stateRef.current.running,false);
 }
});

test('source changes or failed genuine re-index never publish a fresh reviewed basis',async()=>{
 for(const change of [async r=>{r.current={...r.current,sourceText:'other'};},
  async()=>{throw Error('INDEX_FAILED');}]){
  const f=await fixture();f.ports.reindex=change;
  await assert.rejects(()=>startXml229InstrumentFreshReview(f));
  assert.equal(f.counts().opened,0);assert.equal(f.stateRef.current.running,false);
 }
});

test('readiness-only state replacement keeps the source lease, while changed config is rejected',async()=>{
 for(const changed of [false,true]){
  const f=await fixture();
  f.ports.resolveBlob=()=>{
   f.stateRef.current={...f.stateRef.current,outputRunReadinessReport:{refreshed:true},
    ...(changed?{supportConfigJson:'{"defaultGap":99}'}:{})};
   return {isCurrent:()=>true};
  };
  if(changed){await assert.rejects(()=>startXml229InstrumentFreshReview(f),/INSTRUMENT_FRESH_SOURCE_STALE/);
   assert.equal(f.old.closed,false);}
  else {const proof=await startXml229InstrumentFreshReview(f);assert.equal(proof.basisId,'new');}
 }
});

test('served activation module matches source and Run wires the real action',async()=>{
 const path='tabs/xml-cii-2019-standalone/ui-adapted/xml229-instrument-fresh-review.mjs';
 assert.deepEqual(await readFile(new URL('../'+path,import.meta.url)),
  await readFile(new URL('../docs/'+path,import.meta.url)));
 const ui=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(ui,/activate:args=>startXml229InstrumentFreshReview/);
});
