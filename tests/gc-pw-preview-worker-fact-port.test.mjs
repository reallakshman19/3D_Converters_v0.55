import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPreviewBasis } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import { createXmlCiiPreviewJobController } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-job-controller.js';
import { openPreviewFactReadModel } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-read-model.js';
import { openGcPwPreviewWeightSession } from '../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js';
import { createGcPwPreviewWorkerFactPort } from '../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-worker-fact-port.js';
import { createGcPwPreviewWorkerFactPort as docsPort } from '../docs/tabs/xml-cii-2019-standalone/integration/gc-pw-preview-worker-fact-port.js';
import { assertBasisDigest, canonicalJson, digestCanonical, digestUtf8, validateFactRecord, validatePage } from '../contracts/gc-pw-v1/contract.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const SOURCE_ID = 'PL01', SRC = '<PipeStressExport><Pipe><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></Pipe></PipeStressExport>';
const FIELDS = ['source.occurrence', 'bore.mm', 'length.mm', 'rating', 'mass.kg', 'component.type', 'component.ref'];
const point = {sourceId:SOURCE_ID,branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:'V1'};
const physId = JSON.stringify([SOURCE_ID,0,0,'V1']);
const original = [{sourceId:SOURCE_ID,branchOccurrenceIndex:0,nodeOrdinal:0}];
const originalCensus = [
 {sourceId:SOURCE_ID,occurrenceId:JSON.stringify([SOURCE_ID,0,null,'']),subjectType:'branch'},
 {sourceId:SOURCE_ID,occurrenceId:JSON.stringify([SOURCE_ID,0,0,'']),subjectType:'node'},
];
const expected = [...originalCensus,{sourceId:SOURCE_ID,occurrenceId:physId,subjectType:'physical-component'}];
const ports = {assertBasisDigest,canonicalJson,digestCanonical,validateFactRecord,validatePage};
const getCode = c => e => { assert.equal(e?.code,c); return true; };
const clone = x => structuredClone(x);
const worker = () => ({sourceOccurrences:{branches:[{sourceId:SOURCE_ID,occurrenceId:originalCensus[0].occurrenceId}],nodes:[{sourceId:SOURCE_ID,occurrenceId:originalCensus[1].occurrenceId}]},
 coverage:{sourceBranchCount:1,originalNodeCount:1,engineeringBranchCount:1,legacyReviewNodeCount:0},branchRows:[{}],nodeRows:[],
 engineeringAcceptance:'VERIFIED',fullFactPopulationAccepted:true});

function fact(basis, owner, fieldId, value) {
 return {schemaVersion:'gc-pw/1.0',domainId:'xml-cii/2019',basisId:basis.basisId,
 sourceId:SOURCE_ID,occurrenceId:owner.occurrenceId,subjectType:owner.subjectType,fieldId,
 value,unit:fieldId==='mass.kg'?'kg':fieldId.endsWith('.mm')?'mm':null,
 authority:'source',provenance:[{sourceRef:SOURCE_ID,locator:'original pipe/branch/node'}],diagnostics:[]};
}
async function fixture() {
 const args={sources:[{sourceId:SOURCE_ID,mediaType:'application/xml',text:SRC}],
 selection:[{sourceId:SOURCE_ID,selectionRef:'all'}],
 masters:{weight:{datasetId:'w',revision:1,rows:[{'RF/RTJ KG':15,Rating:'150',bore:50}],
 mapping:{Weight:'RF/RTJ KG'}}},
 stagedSource:null,config:{weight:{masterRows:[]}},overrides:{},
 originalOccurrences:clone(original),expectedOriginalCount:1,
 physicalOccurrences:[clone(point)],requiredFieldIds:FIELDS.slice(),requestId:'A3U31'};
 const basis = await createPreviewBasis({...args,domainId:'xml-cii/2019',sha256:digestUtf8});
 const values={'source.occurrence':true,'bore.mm':50,'length.mm':110,rating:'150',
 'mass.kg':59,'component.type':'VALVE','component.ref':'V1'};
 const records=[
 fact(basis,expected[0],'source.occurrence',true),fact(basis,expected[0],'branch.engineering',true),
 fact(basis,expected[1],'source.occurrence',true),fact(basis,expected[1],'node.engineering',true),
 ...FIELDS.map(f=>fact(basis,expected[2],f,values[f])),
 ];
 const model=await openPreviewFactReadModel({
 basis,expectedOccurrences:expected,records,ports,
 requiredEngineeringFields:{
  branch:['branch.engineering'],node:['node.engineering'],
  'physical-component':['bore.mm','mass.kg']},
 // Fixture-only oracle: live owner workers do not yet meet this positive gate.
 verifyEngineeringComplete:({records})=>records.length===11,
 });
 assert.equal(model.info.engineeringReady,true);
 return {args,basis,model};
}
function makePort(model,custom={}) {
 const incoming=custom.result||worker();
 return createGcPwPreviewWorkerFactPort({
 startJob:custom.startJob||(({basis,requestId})=>({
  basisId:basis.basisId,requestId,promise:Promise.resolve(incoming),cancel:()=>true})),
 openFactModel:custom.openFactModel||(()=>model),
 expectedOriginalOccurrences:custom.expectedOriginalOccurrences??clone(originalCensus),
 expectedOriginalCount:custom.expectedOriginalCount??2,
 expectedModelOccurrenceCount:custom.expectedModelOccurrenceCount??3,
 expectedPhysicalFactCount:custom.expectedPhysicalFactCount??FIELDS.length,
 pageSize:custom.pageSize??2,
 });
}
const direct=(port,basis,{isCancelled=()=>false,requestId='A3U31',report=()=>{}}={})=>
 port({basis,requestId,isCancelled,report});

test('real Preview FactReadModel pages open real attested Weight session only after positive worker custody',async()=>{
 const {args,basis,model}=await fixture();
 let read=0,progress=[];
 const loadFactPages=makePort(model,{startJob:({basis,requestId})=>({
  basisId:basis.basisId,requestId,promise:Promise.resolve(worker()),cancel:()=>true})});
 const session=await openGcPwPreviewWeightSession({...args,loadFactPages:
  async input=>{read++;return loadFactPages({...input,report:(a,b)=>{progress.push([a,b]);input.report(a,b);}});}});
 assert.equal(session.basisId,basis.basisId);
 const ready=await session.awaitReady();
 assert.equal(read,1);
 assert.equal(ready.openedFacts,FIELDS.length);
 assert.deepEqual(progress.at(-1),[FIELDS.length,FIELDS.length]);
 assert.equal(ready.review.getDecisionState({basisId:basis.basisId,scopeId:SOURCE_ID}).decisionRevision,null);
 assert.equal(ready.review.getFacts({basisId:basis.basisId,limit:50}).items.length,FIELDS.length);
});

test('current merged Preview job controller reports source-only completion but cannot open Weight',async()=>{
 const {basis,model}=await fixture();
 const pending=worker();pending.engineeringAcceptance='NOT_ASSESSED';pending.fullFactPopulationAccepted=false;
 const controller=createXmlCiiPreviewJobController({
  verifyBasis:async()=>true,
  execute:()=>({promise:Promise.resolve(pending),release:()=>{}}),
 });
 const port=makePort(model,{startJob:({basis,requestId})=>controller.start({
  basis,requestId,input:{xmlText:SRC,config:{},stagedJsonText:'',scope:{}}
 })});
 await assert.rejects(direct(port,basis),getCode('ENGINEERING_NOT_VERIFIED'));
 assert.equal(controller.getSnapshot().engineeringAccepted,false);
 controller.dispose();
});

test('source-only Preview inspector cannot masquerade as full engineering fact producer',async()=>{
 const {basis}=await fixture();
 const sourceOnly=await openPreviewFactReadModel({basis,expectedOccurrences:originalCensus,
  records:originalCensus.map(o=>fact(basis,o,'source.occurrence',true)),ports});
 assert.equal(sourceOnly.info.engineeringReady,false);
 const port=makePort(sourceOnly);
 await assert.rejects(direct(port,basis),getCode('ENGINEERING_MODEL_NOT_VERIFIED'));
});

test('a wrong request/basis worker handle is rejected without reading a single fact',async()=>{
 const {basis,model}=await fixture();
 for (const mismatch of ['request','basis']) {
  let invoked=false;
  const port=makePort(model,{startJob:({basis,requestId})=>{
   return {requestId:mismatch==='request'?'OLD':requestId,
    basisId:mismatch==='basis'?'f'.repeat(64):basis.basisId,
    promise:Promise.resolve(worker()),cancel:()=>true};},
   openFactModel:()=>{invoked=true;return model;}});
  await assert.rejects(direct(port,basis),getCode('UNBOUND_WORKER_JOB'));
  assert.equal(invoked,false);
 }
});

test('Worker original-branch+node census must agree with independently declared original count',async()=>{
 const {basis,model}=await fixture();
 const broken=worker();broken.sourceOccurrences.nodes=[];
 await assert.rejects(direct(makePort(model,{result:broken}),basis),
  getCode('WORKER_ORIGINAL_CENSUS_MISMATCH'));
 const port=makePort(model,{expectedOriginalCount:3,expectedModelOccurrenceCount:3,
  expectedOriginalOccurrences:[...clone(originalCensus),
   {sourceId:SOURCE_ID,subjectType:'node',occurrenceId:JSON.stringify([SOURCE_ID,0,2,''])}]});
 await assert.rejects(direct(port,basis),getCode('WORKER_ORIGINAL_CENSUS_MISMATCH'));
});

test('same-count worker source identity alias fails against independent original XML census',async()=>{
 const {basis,model}=await fixture();
 const changed=worker();
 changed.sourceOccurrences.nodes[0].occurrenceId=JSON.stringify([SOURCE_ID,0,1,'']);
 await assert.rejects(direct(makePort(model,{result:changed}),basis),
  getCode('WORKER_ORIGINAL_ID_MISMATCH'));
 const dup=worker();
 dup.sourceOccurrences.nodes[0].occurrenceId=dup.sourceOccurrences.branches[0].occurrenceId;
 await assert.rejects(direct(makePort(model,{result:dup}),basis),
  getCode('WORKER_ORIGINAL_ID_MISMATCH'));
});

test('worker fact pages reject missing field population independently of self-declared total',async()=>{
 const {basis,model}=await fixture();
 await assert.rejects(direct(makePort(model,{expectedPhysicalFactCount:FIELDS.length+1}),basis),
  getCode('PHYSICAL_FIELD_POPULATION_MISMATCH'));
});

test('cancelled before launch cannot start Worker; cancelled after completion cannot publish pages',async()=>{
 const {basis,model}=await fixture();
 let called=false;
 const port=makePort(model,{startJob:()=>{called=true;throw Error('should not run')}});
 await assert.rejects(direct(port,basis,{isCancelled:()=>true}),getCode('CANCELLED'));
 assert.equal(called,false);
 let cancel=false,wasCancelled=false;
 const aborted=makePort(model,{startJob:({basis,requestId})=>({
  requestId,basisId:basis.basisId,promise:Promise.resolve().then(()=>{cancel=true;return worker();}),
  cancel:()=>{wasCancelled=true;}})});
 await assert.rejects(direct(aborted,basis,{isCancelled:()=>cancel}),getCode('CANCELLED'));
 assert.equal(wasCancelled,true);
});

test('source-only page completeness false fails even with engineered-model metadata',async()=>{
 const {basis,model}=await fixture();
 const wrapped={info:model.info,getFacts:async args=>{
  const page=clone(await model.getFacts(args));page.complete=false;return page;}};
 await assert.rejects(direct(makePort(wrapped),basis),getCode('INCOMPLETE_ENGINEERING_PAGE'));
});

test('fact reader does not cross wrong source basis even if job claims engineering verified',async()=>{
 const {basis,model}=await fixture();
 const wrapped={info:{...model.info,basisId:'f'.repeat(64)},getFacts:model.getFacts};
 await assert.rejects(direct(makePort(wrapped),basis),getCode('ENGINEERING_MODEL_NOT_VERIFIED'));
});

test('a fact reader cannot loop cursors, silently truncate pages or add empty progress',async()=>{
 const {basis,model}=await fixture();
 const first=await model.getFacts({basisId:basis.basisId,subjectType:'physical-component',limit:2});
 const wrapper={info:model.info,getFacts:async()=>first};
 await assert.rejects(direct(makePort(wrapper),basis),getCode('REPEATED_FACT_CURSOR'));
 const trunc={info:model.info,getFacts:async()=>({
  ...first,nextCursor:null,items:first.items,totalCount:first.totalCount})};
 await assert.rejects(direct(makePort(trunc),basis),getCode('TRUNCATED_ENGINEERING_FACTS'));
});

test('same source Worker returned without complete physical FactRecords is never silently filled from nodeRows',async()=>{
 const {basis,model}=await fixture();
 const result=worker();result.fullFactPopulationAccepted=false;result.nodeRows=[{weightKg:59}];
 await assert.rejects(direct(makePort(model,{result}),basis),getCode('ENGINEERING_NOT_VERIFIED'));
});

test('deployed docs mirror is byte-identical and executes the same trusted fact port',async()=>{
 const path='../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-worker-fact-port.js';
 const root=await readFile(new URL(path,import.meta.url),'utf8');
 const docs=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/integration/gc-pw-preview-worker-fact-port.js',import.meta.url),'utf8');
 assert.equal(root,docs);
 const {basis,model}=await fixture();
 const port=docsPort({
 startJob:({basis,requestId})=>({requestId,basisId:basis.basisId,
  promise:Promise.resolve(worker()),cancel:()=>true}),
 openFactModel:()=>model,expectedOriginalOccurrences:clone(originalCensus),expectedOriginalCount:2,
 expectedModelOccurrenceCount:3,expectedPhysicalFactCount:FIELDS.length,pageSize:3});
 assert.equal((await direct(port,basis)).flatMap(p=>p.items).length,FIELDS.length);
});
