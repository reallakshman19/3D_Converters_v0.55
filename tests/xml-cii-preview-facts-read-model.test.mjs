import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {makeBasisRef, digestUtf8, digestCanonical, canonicalJson,
  assertBasisDigest, validateFactRecord, validatePage, assertCompletePopulation} from
  '../contracts/gc-pw-v1/contract.mjs';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {buildXmlCiiSourceFactRecords, openPreviewFactReadModel} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-read-model.js';
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
const ports={assertBasisDigest,validateFactRecord,validatePage,canonicalJson,digestCanonical};
const S='SRC01';
const ids=['B0','N0','B1','N1'];
const provenance=(locator)=>[{sourceRef:S,locator}];
const originalSelection=Object.freeze([
  {subjectType:'branch',sourceId:S,occurrenceId:'B0'},
  {subjectType:'node',sourceId:S,occurrenceId:'N0'},
  {subjectType:'branch',sourceId:S,occurrenceId:'B1'},
  {subjectType:'node',sourceId:S,occurrenceId:'N1'},
]);
const projection=()=>{
  const branch=(id,ordinal)=>({subjectType:'branch',sourceId:S,occurrenceId:id,
    branchName:'/REPEATED/BRANCH',branchOrdinal:ordinal,provenance:provenance('Branch['+ordinal+']')});
  const node=(id,branchOrdinal)=>({subjectType:'node',sourceId:S,occurrenceId:id,
    nodeNumber:'-1',componentType:'VALV',componentRefNo:'SAME',endpoint:'1',
    branchOrdinal,nodeOrdinal:0,provenance:provenance('Branch['+branchOrdinal+']/Node[0]')});
  return {schemaVersion:'gc-pw/1.0',domainId:'xml-cii/2019',branchCount:2,nodeCount:2,
    branches:[branch('B0',0),branch('B1',1)],nodes:[node('N0',0),node('N1',1)]};
};
const basis=async()=>{
  const digest=await digestUtf8('source bytes v1');
  return makeBasisRef({
    domainId:'xml-cii/2019',
    sourceRefs:[{sourceId:S,sha256:digest,mediaType:'application/xml'}],
    selectionSha256:await digestCanonical(['Branch0','Branch1']),
    stagedSourceSha256:null,
    masters:{line:{datasetId:'LL',revision:'r1',rowCount:1,
      sha256:await digestUtf8('one row'),mappingSha256:await digestUtf8('mapped')}},
    configSha256:await digestUtf8('config'),overridesSha256:await digestUtf8('{}'),
    scope:[{sourceId:S,selectionRef:'ALL'}],
  });
};
const open=async(records,extras={})=>openPreviewFactReadModel({
  basis:await basis(),expectedOccurrences:originalSelection,records,ports,...extras,
});
const source=(basisId)=>buildXmlCiiSourceFactRecords({basisId,projection:projection()});
const allPages=async(model,args={})=>{
  const pages=[];let cursor=null;
  do{
    const page=await model.getFacts({basisId:model.info.basisId,limit:3,cursor,...args});
    pages.push(page);cursor=page.nextCursor;
  }while(cursor!==null);
  return pages;
};
test('source producer carries exact duplicate-number occurrences and individual field provenance',async()=>{
  const b=await basis(),rows=source(b.basisId);
  assert.equal(rows.length,14); // 2 branches*2 source fields + 2 nodes*5
  rows.forEach(x=>validateFactRecord(x,b.basisId));
  assert.equal(rows.filter(x=>x.fieldId==='source.occurrence').length,4);
  assert.deepEqual(rows.filter(x=>x.fieldId==='source.nodeNumber').map(x=>x.value),['-1','-1']);
  assert.ok(rows.every(x=>x.provenance[0].sourceRef===S));
  assert.ok(rows.every(x=>x.authority==='source'||x.authority==='unresolved'));
  assert.ok(rows.every(x=>x.extensions.valueKind==='source'));
});
test('partial source-only FactRecords paginate without dropping a selected occurrence',async()=>{
  const b=await basis(),model=await openPreviewFactReadModel({
    basis:b,expectedOccurrences:originalSelection,records:source(b.basisId),ports});
  assert.equal(model.info.engineeringReady,false);
  assert.equal(model.info.computationStage,'source-custody-only');
  assert.equal(model.info.expectedOccurrenceCount,4);
  const pages=await allPages(model);
  assert.equal(pages.length,5);
  assert.equal(pages.flatMap(p=>p.items).length,14);
  assert.deepEqual(new Set(pages.flatMap(p=>p.items)
    .filter(x=>x.fieldId==='source.occurrence').map(x=>x.occurrenceId)),new Set(ids));
  assert.ok(pages.every(p=>p.complete===false && p.totalCount===14));
  assert.equal(pages.at(-1).nextCursor,null);
  assert.throws(()=>assertCompletePopulation(pages,b.basisId,
    item=>item.occurrenceId+':'+item.fieldId,14),{code:'INCOMPLETE_BASIS'});
});
test('wrong-basis facts and original source occurrence omissions are refused',async()=>{
  const b=await basis(),rows=source(b.basisId);
  const foreign=[{...rows[0],basisId:'f'.repeat(64)},...rows.slice(1)];
  await assert.rejects(open(foreign),{code:'CROSS_BASIS_FACT'});
  await assert.rejects(open(rows.filter(x=>x.occurrenceId!=='N1')),
    {code:'INCOMPLETE_SELECTED_POPULATION'});
  await assert.rejects(open(rows,{expectedOccurrences:[...originalSelection,
    {subjectType:'node',sourceId:S,occurrenceId:'N2'}]}),
    {code:'INCOMPLETE_SELECTED_POPULATION'});
  await assert.rejects(open([...rows,rows[0]]),{code:'DUPLICATE_FIELD_FACT'});
  await assert.rejects(open([...rows,{...rows[0],occurrenceId:'UNKNOWN'}]),
    {code:'UNSELECTED_OCCURRENCE'});
});
test('a proposed occurrence marker cannot fabricate selected source population',async()=>{
  const b=await basis(),rows=source(b.basisId);
  rows[0]={...rows[0],authority:'proposed'};
  await assert.rejects(open(rows),{code:'INVALID_OCCURRENCE_MARKER'});
  const changed={...await basis(),basisId:'a'.repeat(64)};
  await assert.rejects(openPreviewFactReadModel({
    basis:changed,expectedOccurrences:originalSelection,records:source(changed.basisId),ports,
  }),{code:'STALE_BASIS'});
});
test('engineering-complete claim requires explicit verified port and per-occurrence engineering fields',async()=>{
  const b=await basis(),rows=source(b.basisId);
  const numerical=originalSelection.map(item=>({
    schemaVersion:'gc-pw/1.0',domainId:'xml-cii/2019',basisId:b.basisId,
    sourceId:item.sourceId,occurrenceId:item.occurrenceId,subjectType:item.subjectType,
    fieldId:item.subjectType==='branch'?'engineering.rating':'engineering.bore',
    value: item.subjectType==='branch'?'150':50,unit:item.subjectType==='node'?'mm':null,
    authority:'derived',provenance:provenance('independent-test-only-oracle'),diagnostics:[],
  }));
  const required={branch:['engineering.rating'],node:['engineering.bore']};
  await assert.rejects(open([...rows,...numerical.slice(0,3)],{
    requiredEngineeringFields:required,verifyEngineeringComplete:async()=>true,
  }),{code:'REQUIRED_ENGINEERING_FACT_MISSING'});
  await assert.rejects(open(rows,{
    requiredEngineeringFields:{branch:['source.branchName'],node:['source.nodeNumber']},
    verifyEngineeringComplete:async()=>true,
  }),{code:'ENGINEERING_FIELDS_REQUIRED'});
  const pending=await open([...rows,...numerical],{
    requiredEngineeringFields:required,verifyEngineeringComplete:async()=>false,
  });
  assert.equal(pending.info.engineeringReady,false);
  const complete=await open([...rows,...numerical],{
    requiredEngineeringFields:required,
    verifyEngineeringComplete:async context=>
      context.records.filter(x=>x.fieldId.startsWith('engineering.')).length===4,
  });
  assert.equal(complete.info.engineeringReady,true);
  const pages=await allPages(complete);
  const census=assertCompletePopulation(pages,b.basisId,
    item=>item.sourceId+':'+item.occurrenceId+':'+item.fieldId,18);
  assert.equal(census.verifiedCount,18);
  assert.equal(pages.at(-1).nextCursor,null);
});
test('stable cursor is fenced to revision and query; can read all filtered rows',async()=>{
  const b=await basis(),model=await openPreviewFactReadModel({
    basis:b,expectedOccurrences:originalSelection,records:source(b.basisId),ports});
  const first=await model.getFacts({basisId:b.basisId,limit:1,fieldId:'source.nodeNumber'});
  assert.equal(first.totalCount,2);
  assert.ok(first.nextCursor);
  const last=await model.getFacts({basisId:b.basisId,limit:1,
    fieldId:'source.nodeNumber',cursor:first.nextCursor});
  assert.equal(last.items.length,1);assert.equal(last.nextCursor,null);
  await assert.rejects(model.getFacts({basisId:b.basisId,limit:1,
    fieldId:'source.branchName',cursor:first.nextCursor}),{code:'STALE_OR_WRONG_CURSOR'});
  const damaged=JSON.parse(first.nextCursor);damaged.offset=999;
  await assert.rejects(model.getFacts({basisId:b.basisId,cursor:JSON.stringify(damaged)}),
    {code:'STALE_OR_WRONG_CURSOR'});
  await assert.rejects(model.getFacts({basisId:'f'.repeat(64)}),{code:'CROSS_BASIS_QUERY'});
  await assert.rejects(model.getFacts({basisId:b.basisId,limit:201}),{code:'INVALID_PAGE_SIZE'});
  await assert.rejects(model.getFacts({basisId:b.basisId,cursor:'nonsense'}),{code:'INVALID_CURSOR'});
});
test('no input or published fact can mutate a snapshot after it is opened',async()=>{
  const b=await basis(),records=source(b.basisId);
  const model=await open(b && records);const initial=await allPages(model);
  records[0].value=false;records.push(records[0]);
  assert.deepEqual(await allPages(model),initial);
  assert.throws(()=>{initial[0].items[0].value=false;},TypeError);
});
test('portable non-XML FactRecords use the same immutable paginated core',async()=>{
  const old=await basis();
  const b=await makeBasisRef({...old,basisId:undefined,domainId:'beam/loadcase'});
  const expected=[{subjectType:'beam',sourceId:S,occurrenceId:'beam1'}];
  const record={schemaVersion:'gc-pw/1.0',domainId:'beam/loadcase',basisId:b.basisId,
    sourceId:S,occurrenceId:'beam1',subjectType:'beam',fieldId:'source.occurrence',
    value:true,authority:'source',provenance:provenance('beam#1'),diagnostics:[]};
  const model=await openPreviewFactReadModel({basis:b,expectedOccurrences:expected,
    records:[record],ports});
  const first=await model.getFacts({basisId:b.basisId});
  assert.equal(first.items.length,1);
  assert.equal(first.items[0].subjectType,'beam');
  assert.equal(model.info.engineeringReady,false);
  assert.equal(first.complete,false);
});
test('public SYS-001 raw XML has all its original branches/nodes across every read page',async()=>{
  installWeightBasisXmlDom(globalThis);
  const xmlText=await readFile(new URL('../Benchmarks/XML-CII-2019/SYS-001_Single.xml',import.meta.url),'utf8');
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  const rawBranches=[...xml.getElementsByTagName('Branch')];
  const expected=[];
  for(const [bi,branch] of rawBranches.entries()){
    expected.push({subjectType:'branch',sourceId:S,occurrenceId:JSON.stringify([S,bi,null,''])});
    const nodeChildren=[...branch.childNodes].filter(n=>n.nodeType===1 && n.localName==='Node');
    for(let ni=0;ni<nodeChildren.length;ni++)
      expected.push({subjectType:'node',sourceId:S,occurrenceId:JSON.stringify([S,bi,ni,''])});
  }
  assert.equal(rawBranches.length,9);
  assert.equal(expected.filter(x=>x.subjectType==='node').length,541);
  const parsed=projectXmlCiiOccurrences({xmlText,mode:'A',sourceId:S});
  const base=await basis();
  const b=await makeBasisRef({...base,basisId:undefined,
    sourceRefs:[{sourceId:S,mediaType:'application/xml',sha256:await digestUtf8(xmlText)}]});
  const model=await openPreviewFactReadModel({basis:b,expectedOccurrences:expected,
    records:buildXmlCiiSourceFactRecords({basisId:b.basisId,projection:parsed}),ports});
  let cursor=null,read=0;const distinct=new Set();
  do{
    const page=await model.getFacts({basisId:b.basisId,cursor,limit:200});
    read+=page.items.length;cursor=page.nextCursor;
    for(const row of page.items)distinct.add(row.subjectType+':'+row.occurrenceId);
    assert.equal(page.complete,false); // no full engineering verification yet
  }while(cursor!==null);
  assert.equal(read,9*2+541*5);
  assert.equal(distinct.size,550);
});
test('source and deployed docs read-model are byte identical',async()=>{
  const file='xml-cii-adapted-preview-facts-read-model.js';
  const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
  const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
  assert.equal(a,b);
});
