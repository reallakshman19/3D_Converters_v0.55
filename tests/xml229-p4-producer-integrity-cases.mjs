/** Worker fidelity: source, master and original-occurrence drift must fail closed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export function registerXml229ProducerIntegrityTests({XML,SOURCE_ID,masters,selection,config,live,fixture,projectXmlCiiOccurrences,createPreviewBasis,digestUtf8,xmlCiiDryRunPreview,openXml229EngineeringFactModel,getCode,XML229_ENGINEERING_FIELDS}){
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


test('INST promotion preserves a pre-rigid first endpoint in actual producer',async()=>{
 const pair=XML.replace(
  '<Node><NodeNumber>320</NodeNumber><ComponentType>INST</ComponentType>',
  '<Node><NodeNumber>319</NodeNumber><ComponentType>INST</ComponentType>'+
  '<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>1</Endpoint>'+
  '<Position>550 0 0</Position><Weight>0</Weight></Node>\n'+
  '<Node><NodeNumber>320</NodeNumber><ComponentType>INST</ComponentType>');
 assert.notEqual(pair,XML);
 for(const preRigid of [false,true]){
  const xml=preRigid?pair.replace(
   '<Endpoint>1</Endpoint><Position>550 0 0</Position>',
   '<Endpoint>1</Endpoint><Rigid>2</Rigid><Position>550 0 0</Position>'):pair;
  const basis=await createPreviewBasis({domainId:'xml-cii/2019',
   sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
   masters,selection,config,overrides:{},sha256:digestUtf8});
  const original=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
  const preview=xmlCiiDryRunPreview(xml,config,'');
  const opened=await openXml229EngineeringFactModel({
   basis,live:{...live,sources:{[SOURCE_ID]:xml}},
   xmlText:xml,sourceId:SOURCE_ID,
   previewResult:{...preview,sourceOccurrences:original,
    engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
   expectedOriginalCount:original.branchCount+original.nodeCount,
  });
  assert.equal(opened.finalizedGeometry.instrumentModelingSuggestions.length,0);
  assert.equal(opened.finalizedGeometry.rigidEdgePromotions.length,
   preRigid?0:1,'Only fully unclassified instrument pairs are promoted');
  assert.equal(opened.finalizedGeometry.physicalOwnerCardinality.weightsAccepted,false);
 }
});

test('INST rigid classification requires an existing eligible same-ref span',async()=>{
 const pair=XML.replace('<ComponentType>VALV</ComponentType>',
  '<ComponentType>INST</ComponentType>')
  .replace('<ComponentRefNo>1006649732/119367</ComponentRefNo><Endpoint>2</Endpoint>',
   '<ComponentRefNo>1006649732/119369</ComponentRefNo><Endpoint>1</Endpoint>');
 const variants=[
  pair.replace('<Endpoint>1</Endpoint>','<Endpoint>2</Endpoint>'),
  pair.replace('<Endpoint>1</Endpoint>','<Endpoint>1</Endpoint><Rigid>0</Rigid>'),
  pair.replace('<Position>650 0 0</Position>','<Position>537 0 0</Position>'),
  pair.replace('<ComponentRefNo>1006649732/119369</ComponentRefNo>',
   '<ComponentRefNo>OTHER</ComponentRefNo>'),
  pair.replace('<Position>650 0 0</Position>',
   '<Rigid>0</Rigid><Position>650 0 0</Position>'),
 ];
 for(const xml of variants){
  const basis=await createPreviewBasis({domainId:'xml-cii/2019',
   sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:xml}],
   masters,selection,config,overrides:{},sha256:digestUtf8});
  const original=projectXmlCiiOccurrences({xmlText:xml,sourceId:SOURCE_ID});
  const preview=xmlCiiDryRunPreview(xml,config,'');
  const opened=await openXml229EngineeringFactModel({
   basis,live:{...live,sources:{[SOURCE_ID]:xml}},xmlText:xml,sourceId:SOURCE_ID,
   previewResult:{...preview,sourceOccurrences:original,
    engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false},
   expectedOriginalCount:original.branchCount+original.nodeCount});
  assert.equal(opened.finalizedGeometry.rigidEdgePromotions.length,0);
  assert.equal(opened.finalizedGeometry.physicalOwnerCardinality.weightsAccepted,false);
 }
});


}
