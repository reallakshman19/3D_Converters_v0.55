import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {xmlCiiDryRunPreview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {projectXmlCiiOccurrences} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {createPreviewBasis} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {openXml229EngineeringFactModel,XML229_ENGINEERING_FIELDS}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs';
import {createGcPwPreviewWorkerFactPort}
 from '../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-worker-fact-port.js';
import {openGcPwPreviewWeightSession}
 from '../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);
const SOURCE_ID='ORIGINAL-P4';
const XML=`<?xml version="1.0"?>
<PipeStressExport><Pipe><Branch><Branchname>/ASIM-1836-8"-P8810021-31441C4-PP/B4</Branchname>
<Node><NodeNumber>280</NodeNumber><ComponentType>GASK</ComponentType>
<ElementLengthMm>2</ElementLengthMm><Position>0 0 0</Position></Node>
<Node><NodeNumber>300</NodeNumber><ComponentType>RIGID</ComponentType>
<ComponentRefNo>1006649732/119364</ComponentRefNo><Endpoint>2</Endpoint>
<BoreMm>200</BoreMm><Rigid>2</Rigid><ElementLengthMm>112</ElementLengthMm>
<Position>112 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>309</NodeNumber><ComponentType>VALV</ComponentType>
<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>
<BoreMm>200</BoreMm><ElementLengthMm>419</ElementLengthMm>
<Position>531 0 0</Position><Weight>0</Weight></Node>
<Node><NodeNumber>320</NodeNumber><ComponentType>INST</ComponentType>
<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>2</Endpoint>
<Position>650 0 0</Position><Weight>0</Weight></Node>
</Branch></Pipe></PipeStressExport>`;
const masters={weight:{datasetId:'valve-master',revision:'v1',
 rows:[{Rating:'300',Bore:200,Length:112,'RF/RTJ KG':35}],
 mapping:{weight:'RF/RTJ KG'}}};
const config={weight:{masterRows:masters.weight.rows},overrides:{}};
const selection=[{sourceId:SOURCE_ID,selectionRef:'all'}];
const live={sources:{[SOURCE_ID]:XML},masters,selection,stagedSource:null,config,overrides:{}};
const source=()=>projectXmlCiiOccurrences({xmlText:XML,sourceId:SOURCE_ID});
async function fixture(previewOverride=null,liveOverride={}){
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
   sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:XML}],
   masters,selection,config,overrides:{},sha256:digestUtf8});
 const real=xmlCiiDryRunPreview(XML,config,'');
 const original=source();
 const preview=previewOverride?previewOverride(real,original):real;
 const result={...preview,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false};
 return {basis,result,original,live:{...live,...liveOverride}};
}
const getCode=(code)=>err=>(assert.equal(err?.code,code,err?.stack),true);
test('actual XML Preview computation is independently assessed into COMPLETE source-bound facts',async()=>{
 const f=await fixture();
 const positive=await openXml229EngineeringFactModel({
  basis:f.basis,live:f.live,xmlText:XML,sourceId:SOURCE_ID,previewResult:f.result,
  expectedOriginalCount:f.original.branchCount+f.original.nodeCount});
 assert.equal(positive.workerResult.engineeringAcceptance,'VERIFIED');
 assert.equal(positive.workerResult.fullFactPopulationAccepted,true);
 assert.equal(positive.model.info.engineeringReady,true);
 assert.equal(positive.model.info.computationStage,'engineering-verified');
 assert.equal(positive.workerOriginalCount,5); // 1 branch + 4 original nodes, including dropped GASK
 assert.equal(positive.expectedOriginalCount,4);
 assert.equal(positive.physicalOccurrences.length,3); // GASK is not a physical weight owner
 assert.equal(positive.expectedPhysicalFactCount,3*XML229_ENGINEERING_FIELDS.length);
 assert.equal(positive.physicalOccurrences[0].nodeOrdinal,1);
 assert.equal(positive.physicalOccurrences[1].nodeOrdinal,2);
 assert.equal(positive.physicalOccurrences[2].nodeOrdinal,3);
 const all=await positive.model.getFacts({basisId:f.basis.basisId,subjectType:'physical-component',limit:100});
 assert.equal(all.totalCount,positive.expectedPhysicalFactCount);
 assert.equal(all.items.length,all.totalCount);
 const byId=new Map();
 for(const item of all.items){
  if(!byId.has(item.occurrenceId))byId.set(item.occurrenceId,[]);
  byId.get(item.occurrenceId).push(item);
 }
 assert.equal(byId.size,3);
 for(const items of byId.values()){
  assert.deepEqual(new Set(items.map(i=>i.fieldId)),new Set(XML229_ENGINEERING_FIELDS));
  assert(items.every(i=>i.provenance?.[0]?.sourceRef===SOURCE_ID));
 }
 const row300=byId.get(positive.physicalOccurrences[0].occurrenceId);
 assert.equal(row300.find(x=>x.fieldId==='length.mm').value,112);
 assert.equal(row300.find(x=>x.fieldId==='mass.kg').authority,'unresolved');
 assert.equal(row300.find(x=>x.fieldId==='mass.kg').value,null);
 assert.equal(positive.workerResult.branchRows.length,1);
});
test('actual verified Preview result enters GC-PW Weight session via the EXISTING strict port',async()=>{
 const f=await fixture();
 const prepared=await openXml229EngineeringFactModel({
  basis:f.basis,live:f.live,xmlText:XML,sourceId:SOURCE_ID,previewResult:f.result,
  expectedOriginalCount:f.original.branchCount+f.original.nodeCount});
 const bridge=createGcPwPreviewWorkerFactPort({
  startJob:({basis,requestId})=>({basisId:basis.basisId,requestId,
    promise:Promise.resolve(prepared.workerResult),cancel:()=>true}),
  openFactModel:()=>prepared.model,
  expectedOriginalOccurrences:prepared.sourceOccurrenceCensus,
  expectedOriginalCount:prepared.workerOriginalCount,
  expectedModelOccurrenceCount:prepared.expectedModelOccurrenceCount,
  expectedPhysicalFactCount:prepared.expectedPhysicalFactCount,pageSize:4,
 });
 const session=await openGcPwPreviewWeightSession({
  sources:[{sourceId:SOURCE_ID,text:XML,mediaType:'application/xml'}],
  masters,selection,config,overrides:{},
  originalOccurrences:prepared.originalOccurrences,
  expectedOriginalCount:prepared.expectedOriginalCount,
  physicalOccurrences:prepared.physicalOccurrences,
  requiredFieldIds:prepared.requiredFieldIds,requestId:'P4-real-original-preview',
  loadFactPages:bridge,
 });
 const ready=await session.awaitReady();
 assert.equal(ready.openedFacts,3*XML229_ENGINEERING_FIELDS.length);
 assert.equal(ready.review.getDecisionState({basisId:ready.basis.basisId,scopeId:SOURCE_ID,
  stage:'RigidMatch1'}).decisionRevision,null);
 assert.equal(ready.review.getDecisionState({basisId:ready.basis.basisId,scopeId:SOURCE_ID,
  stage:'Rigidmatch2'}).decisionRevision,null);
});
test('no fact population promotion if original source branch/node identities drift',async()=>{
 const f=await fixture();
 const wrong=structuredClone(f.result);wrong.sourceOccurrences.nodes[1].occurrenceId='fake-node';
 await assert.rejects(openXml229EngineeringFactModel({basis:f.basis,live:f.live,
  xmlText:XML,sourceId:SOURCE_ID,previewResult:wrong,expectedOriginalCount:5}),
  getCode('ORIGINAL_OCCURRENCE_ID_DRIFT'));
});
test('changed master bytes with same cardinality cannot claim VERIFIED',async()=>{
 const f=await fixture();
 const changed=structuredClone(masters);changed.weight.rows[0]['RF/RTJ KG']=88;
 await assert.rejects(openXml229EngineeringFactModel({basis:f.basis,
  live:{...f.live,masters:changed},xmlText:XML,sourceId:SOURCE_ID,
  previewResult:f.result,expectedOriginalCount:5}));
});
test('wrong original selection, out-of-scope source and omitted physical node fail closed',async()=>{
 const f=await fixture();
 const input={basis:f.basis,live:f.live,xmlText:XML,sourceId:SOURCE_ID,
  previewResult:f.result,expectedOriginalCount:5};
 await assert.rejects(openXml229EngineeringFactModel({...input,expectedOriginalCount:4}),
  getCode('INDEPENDENT_CENSUS_MISMATCH'));
 await assert.rejects(openXml229EngineeringFactModel({...input,maxPhysical:2}),
  getCode('PHYSICAL_POPULATION_LIMIT'));
 const bad=structuredClone(f.result);bad.branchRows=[];
 await assert.rejects(openXml229EngineeringFactModel({...input,previewResult:bad}),
  getCode('PREVIEW_COMPUTATION_INCOMPLETE'));
 const bad2=structuredClone(f.result);bad2.nodeRows.push({...bad2.nodeRows[0],sourceNodeOrdinal:3,
  componentType:'GASK'});
 await assert.rejects(openXml229EngineeringFactModel({...input,previewResult:bad2}));
});
test('source-only status remains unverified if purported Preview is already promoted without custody',async()=>{
 const f=await fixture();
 await assert.rejects(openXml229EngineeringFactModel({basis:f.basis,live:f.live,xmlText:XML,
  sourceId:SOURCE_ID,expectedOriginalCount:5,
  previewResult:{...f.result,engineeringAcceptance:'VERIFIED'}}),
 getCode('PREVIEW_INPUT_AUTHORITY_DRIFT'));
});
test('authentic repository Firstpass XML + staged JSON retains all original physical occurrences without inventing accepted mass',async()=>{
 const xmlText=await readFile(new URL('../Benchmarks/1885Sjson/FirstpassXML',import.meta.url),'utf8');
 const stagedSource=await readFile(new URL('../Benchmarks/1885Sjson/Sjson.json',import.meta.url),'utf8');
 assert(xmlText.length>100000);
 assert(stagedSource.length>500000);
 const sourceId='FIRSTPASS-AUTHENTIC';
 const selection=[{sourceId,selectionRef:'all'}];
 const actualMasters=structuredClone(masters);
 const actualConfig=structuredClone(config);
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
  sources:[{sourceId,mediaType:'application/xml',text:xmlText}],
  masters:actualMasters,selection,stagedSource,
  config:actualConfig,overrides:{},sha256:digestUtf8});
 const projection=projectXmlCiiOccurrences({xmlText,sourceId});
 const derived=xmlCiiDryRunPreview(xmlText,actualConfig,stagedSource);
 const result={...derived,sourceOccurrences:projection,
  engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false};
 const opened=await openXml229EngineeringFactModel({
  basis,live:{sources:{[sourceId]:xmlText},masters:actualMasters,
   selection,stagedSource,config:actualConfig,overrides:{}},
  xmlText,sourceId,previewResult:result,
  expectedOriginalCount:projection.branchCount+projection.nodeCount,
 });
 assert.equal(opened.workerResult.engineeringAcceptance,'VERIFIED');
 assert.equal(opened.expectedOriginalCount,projection.nodeCount);
 assert(opened.physicalOccurrences.length>0);
 assert.equal(opened.expectedPhysicalFactCount,
  opened.physicalOccurrences.length*XML229_ENGINEERING_FIELDS.length);
 const snap=await opened.model.getFacts({basisId:basis.basisId,
  subjectType:'physical-component',limit:100});
 assert.equal(snap.complete,true);
 assert.equal(snap.totalCount,opened.expectedPhysicalFactCount);
 assert(snap.items.every(item=>item.sourceId===sourceId));
});

test('root and served docs producer are byte-for-byte identical',async()=>{
 const p='tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs';
 assert.deepEqual(await readFile(new URL('../'+p,import.meta.url)),
   await readFile(new URL('../docs/'+p,import.meta.url)));
});
