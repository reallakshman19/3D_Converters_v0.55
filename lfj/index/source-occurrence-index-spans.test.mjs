// R05/U03 independent original-source byte-span and direct OWN-node metadata oracle.
// The fixture/fragment boundaries are explicitly authored; no LFJ index output
// is used to derive expected start/end offsets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {resolveSourceOwners} from '../adapters/ownership/source-ownership.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';

const child='{"type":"VALVE","name":"V","attributes":{"OWNER_ZONE":"/Z-CHILD"}}';
const branch='{"type":"BRANCH","name":"β💡","attributes":{},"children":['+child+']}';
const input='{"hierarchy":['+branch+'],"tail":1.20e+03}';
const encoder=new TextEncoder(),original=encoder.encode(input);
const snap=()=>{
  const b=createSourceSnapshotBuilder({byteLength:original.length,revision:'U03-unaltered-original'});
  for(let i=0;i<original.length;i++)b.append(original.subarray(i,i+1),i);
  return b.finalize();
};
function expectedSpan(fragment) {
  const p=input.indexOf(fragment);
  assert.ok(p>=0,'independently authored fragment exists in original source');
  assert.equal(input.indexOf(fragment,p+1),-1,'oracle fragment is unambiguous');
  return [encoder.encode(input.slice(0,p)).length,encoder.encode(input.slice(0,p+fragment.length)).length];
}
async function events(snapshot,options={}) {
 const pages=[];
 const summary=await streamJsonOccurrenceEvents(snapshot,{
  sourceRefId:'REAL-PL01',pageBytes:65536,sourceReadPageBytes:1,pageEvents:2,
  onEventPage:async p=>pages.push(p),...options,
 });
 return {summary,open:pages.flat().filter(e=>e.kind==='OPEN'),
  seal:pages.flat().filter(e=>e.kind==='SEAL'),pages};
}
const at=(rows,path)=>{const r=rows.find(x=>x.path===path);assert.ok(r,'missing '+path);return r;};

test('U03 original UTF8 half-open byte spans for nested composites, Unicode, scalar and lexical number',async()=>{
 const source=snap(),{summary,open,seal}=await events(source);
 const cases=[
  ['',input],['/hierarchy','['+branch+']'],['/hierarchy/0',branch],
  ['/hierarchy/0/name','"β💡"'],['/hierarchy/0/children/0',child],
  ['/hierarchy/0/children/0/attributes/OWNER_ZONE','"/Z-CHILD"'],
  ['/tail','1.20e+03'],
 ];
 for(const [path,fragment] of cases){
  const o=at(open,path),z=seal.find(e=>e.occurrenceId===o.occurrenceId);
  assert.ok(z,'missing SEAL '+path);
  assert.deepEqual([o.startByte,z.endByteExclusive],expectedSpan(fragment),path);
  assert.deepEqual(original.subarray(o.startByte,z.endByteExclusive),encoder.encode(fragment));
 }
 assert.equal(at(open,'/hierarchy/0/children/0').parentId,at(open,'/hierarchy/0/children').occurrenceId);
 assert.equal(at(open,'/hierarchy/0/name').parentId,at(open,'/hierarchy/0').occurrenceId);
 assert.equal(summary.endByteExclusive,original.length);
 source.close();
});

test('U03 source-local ownAttributes SEAL byte proof never attaches child owner to ancestor',async()=>{
 const source=snap(),{open,seal}=await events(source);
 const parent=at(open,'/hierarchy/0'),child=at(open,'/hierarchy/0/children/0');
 const pAttrs=at(open,'/hierarchy/0/attributes');
 const cAttrs=at(open,'/hierarchy/0/children/0/attributes');
 const byOpen=x=>seal.find(e=>e.occurrenceId===x.occurrenceId);
 const pSeal=byOpen(pAttrs),cSeal=byOpen(cAttrs);
 assert.deepEqual(pSeal.ownAttributes,{
   ownerOccurrenceId:parent.occurrenceId,startByte:pAttrs.startByte,
   endByteExclusive:pSeal.endByteExclusive,
 });
 assert.deepEqual(cSeal.ownAttributes,{
   ownerOccurrenceId:child.occurrenceId,startByte:cAttrs.startByte,
   endByteExclusive:cSeal.endByteExclusive,
 });
 assert.equal(byOpen(at(open,'/hierarchy/0/children')).ownAttributes,undefined);
 const directOwn=async ref=>{
   assert.ok(ref.endByteExclusive-ref.startByte<=4096,
     'this test attests only a small bounded OWN-attribute object');
   const sourceBytes=await source.readRange(ref.startByte,ref.endByteExclusive,source.revision);
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes));
 };
 const parentOwn=await directOwn(pSeal.ownAttributes);
 const childOwn=await directOwn(cSeal.ownAttributes);
 assert.deepEqual(parentOwn,{});
 assert.deepEqual(childOwn,{OWNER_ZONE:'/Z-CHILD'});
 // Type and name are independent pinned source fixture facts, not inferred
 // from descendant strings or guessed by an engineering identity mapper.
 const facts=[
   {sourceId:'REAL-PL01',occurrenceId:parent.occurrenceId,parentOccurrenceId:null,
     type:'BRANCH',name:'β💡',attributes:parentOwn},
   {sourceId:'REAL-PL01',occurrenceId:child.occurrenceId,
     parentOccurrenceId:parent.occurrenceId,type:'VALVE',name:'V',attributes:childOwn},
 ];
 const owned=resolveSourceOwners(facts);
 assert.equal(owned[0].ownerZone,null,'child must not contaminate parent');
 assert.equal(owned[1].ownerZone,'/Z-CHILD');
 assert.equal(owned[1].ownerZoneSource,child.occurrenceId);
 assert.equal(owned[0].engineeringReady,false);
 source.close();
});

test('U03 index events never disclose arbitrary scalar payloads',async()=>{
 const source=snap(),{open}=await events(source);
 for(const row of open) assert.equal(Object.hasOwn(row,'value'),false);
 source.close();
});
