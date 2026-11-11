// LFJ R05/U02 independently authored identity cases — strings/names are NOT IDs.
// One original byte stream may be bound to different engineering source references.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';
const utf8=text=>new TextEncoder().encode(text);
function source(text,revision='identity-test'){
  const raw=utf8(text),b=createSourceSnapshotBuilder({byteLength:raw.length,revision});
  for(let i=0;i<raw.length;i+=5)b.append(raw.subarray(i,i+5),i);
  return b.finalize();
}
async function read(snapshot,sourceRefId){
  const pages=[];
  const result=await streamJsonOccurrenceEvents(snapshot,{
    sourceRefId,pageEvents:2,pageBytes:65536,sourceReadPageBytes:1,onEventPage:async p=>pages.push(p)
  });
  return {result,open:pages.flat().filter(e=>e.kind==='OPEN'),seal:pages.flat().filter(e=>e.kind==='SEAL')};
}
const find=(events,path)=>events.find(x=>x.path===path);
test('U02 identical name under separate same-source parent/branch paths never coalesces',async()=>{
  const s=source('{"hierarchy":[{"name":"DUP"},{"name":"DUP"}],"nested":{"name":"DUP"}}');
  const {open,seal,result}=await read(s,'OWNER-PL01');
  const a=find(open,'/hierarchy/0'),b=find(open,'/hierarchy/1'),c=find(open,'/nested');
  assert.ok(a&&b&&c);
  assert.equal(new Set([a.occurrenceId,b.occurrenceId,c.occurrenceId]).size,3);
  assert.equal(a.parentId,find(open,'/hierarchy').occurrenceId);
  assert.equal(b.parentId,a.parentId);
  assert.equal(c.parentId,find(open,'').occurrenceId);
  assert.equal(new Set(open.map(e=>e.occurrenceId)).size,open.length);
  assert.equal(open.length,seal.length);
  assert.equal(result.complete,true);
  s.close();
});
test('U02 RFC6901 escape ordering for slash, tilde and Unicode own keys',async()=>{
  const s=source('{"~/":{"~":{"x/y":"inside"}},"/":1,"~":2,"β💡":true}');
  const {open}=await read(s,'OWNER-PL01');
  for(const ptr of ['/','/~0~1','/~0~1/~0','/~0~1/~0/x~1y','/~1','/~0','/β💡']){
    if(ptr==='/')continue;
    assert.ok(find(open,ptr),ptr);
  }
  assert.equal(find(open,'/~1').parentId,find(open,'').occurrenceId);
  assert.notEqual(find(open,'/~0').occurrenceId,find(open,'/~1').occurrenceId);
  s.close();
});
test('U02 two sourceRefIds with identical bytes and byte revision never share an index identity',async()=>{
  const raw='{"hierarchy":[{"type":"BRANCH","name":"/SAME"}]}';
  const a=source(raw,'same-gen'),b=source(raw,'same-gen');
  assert.equal(a.sha256,b.sha256);
  assert.equal(a.revision,b.revision);
  const A=await read(a,'PIPE-A'),B=await read(b,'PIPE-B');
  assert.deepEqual(A.open.map(x=>x.path),B.open.map(x=>x.path));
  assert.equal(A.open.length,B.open.length);
  for(let i=0;i<A.open.length;i++)
    assert.notEqual(A.open[i].occurrenceId,B.open[i].occurrenceId);
  assert.equal(A.result.sourceSha256,B.result.sourceSha256);
  a.close();b.close();
});
test('U02 duplicate decoded JSON object key aliases fail before index COMPLETE',async()=>{
  const s=source(String.raw`{"name":"A","n\u0061me":"B"}`);
  await assert.rejects(()=>streamJsonOccurrenceEvents(s,{
    sourceRefId:'PL01',onEventPage:async()=>{},pageEvents:1,
  }),e=>e?.code==='DUPLICATE_JSON_KEY');
  s.close();
});
