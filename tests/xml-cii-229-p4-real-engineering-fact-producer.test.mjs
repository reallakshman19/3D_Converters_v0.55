import './xml229-g3-candidate-readiness-reconciliation.test.mjs';
import './xml229-cross-worker-flow-trace.test.mjs';
import './xml229-cross-worker-flow-audit.test.mjs';
import './xml229-g3g4-local-aggregate-export.test.mjs';
import './xml229-g3-candidate-coverage.test.mjs';
import './xml-cii-preview-strict-line-authority.test.mjs';
import './xml-cii-229-independent-preview-worker.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {registerXml229ProducerIntegrityTests} from './xml229-p4-producer-integrity-cases.mjs';
import {registerXml229PythonWorkerRevisionTests} from './xml229-instrument-python-worker-cases.mjs';
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
 // Native must consume this exact finalized PRE-acceptance geometry.
 assert.equal(positive.finalizedGeometry.schema,'XML229.FinalizedWeightGeometry.v1');
 assert.equal(positive.finalizedGeometry.basisId,f.basis.basisId);
 assert.equal(positive.finalizedGeometry.sourceXmlSha256,f.basis.sourceRefs[0].sha256);
 assert.equal(positive.finalizedGeometry.sha256,
   await digestUtf8(positive.finalizedGeometry.xmlText));
 assert.deepEqual(positive.finalizedGeometry.retainedSourceOrdinalsByBranch,
   [[1,2,3]],'Worker removes original GASK but retains physical source ordinals');
 assert.equal(positive.finalizedGeometry.originalNodeCount,4);
 assert.ok(!positive.finalizedGeometry.xmlText.includes('<ComponentType>GASK</ComponentType>'));
 assert.ok(positive.finalizedGeometry.xmlText.includes('<ComponentType>RIGID</ComponentType>'));
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
test('nonpositive original node IDs receive source-ordinal-attested positive IDs before Final',async()=>{
 const xml=XML.replace('<NodeNumber>309</NodeNumber>','<NodeNumber>-1</NodeNumber>');
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
  sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
  masters,selection,config,overrides:{},sha256:digestUtf8});
 const orig=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
 const preview=xmlCiiDryRunPreview(xml,config,'');
 const open=await openXml229EngineeringFactModel({
  basis,live:{...live,sources:{[SOURCE_ID]:xml}},
  xmlText:xml,sourceId:SOURCE_ID,
  previewResult:{...preview,sourceOccurrences:orig,
    engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
  expectedOriginalCount:orig.branchCount+orig.nodeCount,
 });
 assert.deepEqual(open.finalizedGeometry.assignedNodeNumbers,[{
   branchOccurrenceIndex:0,sourceNodeOrdinal:2,
   sourceNodeNumber:'-1',finalNodeNumber:330,
 }]);
 assert.match(open.finalizedGeometry.xmlText,/<NodeNumber>330<\/NodeNumber>/);
 assert.equal(open.physicalOccurrences[1].nodeOrdinal,2,
   'mass owner retains the ORIGINAL ordinal, not the new engine NodeNumber');
 assert.equal(open.finalizedGeometry.sha256,
   await digestUtf8(open.finalizedGeometry.xmlText));
});

test('physical endpoint pairs are identified before accepting weights, without merging facts',async()=>{
 const pairedXml=XML
  .replace('<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>',
           '<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>1</Endpoint>')
  .replace('<ComponentType>INST</ComponentType>',
           '<ComponentType>VALV</ComponentType>')
  .replace('<ComponentRefNo>1006649732/119369</ComponentRefNo>',
           '<ComponentRefNo>1006649732/119367</ComponentRefNo>');
 assert.notEqual(pairedXml,XML);
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
   sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:pairedXml}],
   masters,selection,config,overrides:{},sha256:digestUtf8});
 const original=projectXmlCiiOccurrences({xmlText:pairedXml,sourceId:SOURCE_ID});
 const preview=xmlCiiDryRunPreview(pairedXml,config,'');
 const opened=await openXml229EngineeringFactModel({
  basis,live:{...live,sources:{[SOURCE_ID]:pairedXml}},
  xmlText:pairedXml,sourceId:SOURCE_ID,
  previewResult:{...preview,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
  expectedOriginalCount:original.branchCount+original.nodeCount,
 });
 const topology=opened.finalizedGeometry.physicalOwnerCardinality;
 assert.equal(topology.weightsAccepted,false);
 assert.equal(topology.sourcePhysicalNodeOccurrences,3);
 assert.equal(topology.reviewedPhysicalNodeOccurrences,2);
 assert.equal(opened.physicalOccurrences.length,2);
 assert.equal(topology.pairedEndpointPhysicalParts,1);
 assert.equal(topology.distinctPhysicalPartCandidates,2);
 assert.equal(topology.endpointPairs[0].firstIsWeightOwner,false);
 assert.equal(topology.endpointPairs[0].secondIsWeightOwner,true);
 assert.equal(topology.endpointPairs[0].componentType,'VALV');
 assert.equal(opened.finalizedGeometry.rigidEdgePromotions.length,1);
 assert.equal(opened.finalizedGeometry.rigidEdgePromotions[0].componentType,'VALV');
 assert(opened.finalizedGeometry.rigidEdgePromotions[0].distanceMm>6);
 assert.equal(topology.endpointPairs[0].componentRefNo,'1006649732/119367');
 assert.notEqual(topology.endpointPairs[0].firstOccurrenceId,
                 topology.endpointPairs[0].secondOccurrenceId);
 assert.equal(opened.finalizedGeometry.sha256,
              await digestUtf8(opened.finalizedGeometry.xmlText));
});

test('instrument pair is classified rigid before Final without accepting kg',async()=>{
 const xml=XML.replace('<ComponentType>VALV</ComponentType>',
                       '<ComponentType>INST</ComponentType>')
  .replace('<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>',
           '<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>1</Endpoint>');
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
  sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
  masters,selection,config,overrides:{},sha256:digestUtf8});
 const original=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
 const preview=xmlCiiDryRunPreview(xml,config,'');
 const opened=await openXml229EngineeringFactModel({
  basis,live:{...live,sources:{[SOURCE_ID]:xml}},xmlText:xml,
  sourceId:SOURCE_ID,
  previewResult:{...preview,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
  expectedOriginalCount:original.branchCount+original.nodeCount,
 });
 const final=opened.finalizedGeometry;
 assert.equal(final.instrumentModelingSuggestions.length,0);
 assert.deepEqual(final.rigidEdgePromotions,[{
  branchOccurrenceIndex:0,firstSourceNodeOrdinal:2,secondSourceNodeOrdinal:3,
  componentType:'INST',componentRefNo:'1006649732/119369',distanceMm:119,
 }]);
 assert.equal(final.physicalOwnerCardinality.weightsAccepted,false);
 assert.match(final.xmlText,/<Rigid>2<\/Rigid>/);
 assert.equal((xml.match(/<Rigid>2<\/Rigid>/g)||[]).length,1,
  'original source retains only its original rigid marker');
 assert.equal(final.physicalOwnerCardinality.distinctPhysicalPartCandidates,2);
 assert.equal(opened.physicalOccurrences.length,2);
 assert.match(final.xmlText,/<ComponentType>INST<\/ComponentType>/);
 assert.equal(await digestUtf8(final.xmlText),final.sha256);
});

test('FLAN/VALV first-end witness delegates to existing same-ref RIGID mass owner before review',async()=>{
 const xml=XML.replace(
  '<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>',
  '<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>1</Endpoint>')
  .replace('<ComponentType>INST</ComponentType>','<ComponentType>RIGID</ComponentType>')
  .replace('<ComponentRefNo>1006649732/119369</ComponentRefNo>',
   '<ComponentRefNo>1006649732/119367</ComponentRefNo>')
  .replace('<Position>650 0 0</Position><Weight>0</Weight>',
   '<Position>650 0 0</Position><Rigid>2</Rigid><Weight>0</Weight>');
 const basis=await createPreviewBasis({domainId:'xml-cii/2019',
   sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
   masters,selection,config,overrides:{},sha256:digestUtf8});
 const original=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
 const preview=xmlCiiDryRunPreview(xml,config,'');
 const opened=await openXml229EngineeringFactModel({
  basis,live:{...live,sources:{[SOURCE_ID]:xml}},xmlText:xml,
  sourceId:SOURCE_ID,previewResult:{...preview,sourceOccurrences:original,
   engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
  expectedOriginalCount:original.branchCount+original.nodeCount,
 });
 const card=opened.finalizedGeometry.physicalOwnerCardinality;
 assert.equal(card.sourcePhysicalNodeOccurrences,3);
 assert.equal(card.reviewedPhysicalNodeOccurrences,2);
 assert.equal(card.pairedEndpointPhysicalParts,1);
 assert.equal(card.endpointPairs[0].componentType,'VALV');
 assert.equal(card.endpointPairs[0].firstIsWeightOwner,false);
 assert.equal(card.endpointPairs[0].secondIsWeightOwner,true);
 assert.equal(opened.physicalOccurrences.length,2);
 assert.deepEqual(opened.physicalOccurrences.map(x=>x.nodeOrdinal),[1,3]);
 assert.equal(opened.finalizedGeometry.rigidEdgePromotions.length,0,
   'the source RIGID is already the mass-bearing CII edge; no new marker');
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
registerXml229ProducerIntegrityTests({XML,SOURCE_ID,masters,selection,config,live,fixture,projectXmlCiiOccurrences,createPreviewBasis,digestUtf8,xmlCiiDryRunPreview,openXml229EngineeringFactModel,getCode,XML229_ENGINEERING_FIELDS});
registerXml229PythonWorkerRevisionTests({XML,SOURCE_ID,masters,selection,config,live,fixture,projectXmlCiiOccurrences,createPreviewBasis,digestUtf8,xmlCiiDryRunPreview,openXml229EngineeringFactModel});

test('root and served docs producer are byte-for-byte identical',async()=>{
 const p='tabs/xml-cii-2019-standalone/integration/xml229-preview-engineering-fact-producer.mjs';
 assert.deepEqual(await readFile(new URL('../'+p,import.meta.url)),
   await readFile(new URL('../docs/'+p,import.meta.url)));
});
