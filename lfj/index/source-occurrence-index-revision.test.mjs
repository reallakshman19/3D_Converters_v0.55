// LFJ R05/U04 independently authored RED source-fingerprint / stale output oracle.
// Same sourceRefId+revision+path with changed original bytes MUST NOT reuse ID.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';
const encode=s=>new TextEncoder().encode(s);
function source(json,revision='R05-preserved-revision'){
 const bytes=encode(json),b=createSourceSnapshotBuilder({byteLength:bytes.length,revision});
 for(let i=0;i<bytes.length;i+=2)b.append(bytes.subarray(i,i+2),i);
 return b.finalize();
}
async function scan(snapshot,overrides={}){
 const pages=[];
 const result=await streamJsonOccurrenceEvents(snapshot,{
  sourceRefId:'PL01',pageEvents:1,pageBytes:65536,sourceReadPageBytes:3,
  onEventPage:async page=>pages.push(page),...overrides,
 });
 const all=pages.flat();
 return {result,all,roots:all.filter(e=>e.kind==='OPEN'&&e.path==='')};
}
test('U04 R03 snapshots bind digest to revision, so same-length edits change occurrence identity',async()=>{
 const first=source('{"a":1}'),changed=source('{"a":2}');
 assert.equal(first.byteLength,changed.byteLength);
 assert.notEqual(first.revision,changed.revision,
   'R03 finalizes revisions with the exact SHA, even for an unchanged caller revision');
 assert.notEqual(first.sha256,changed.sha256);
 const a=await scan(first),b=await scan(changed);
 assert.equal(a.roots.length,1);assert.equal(b.roots.length,1);
 assert.notEqual(a.roots[0].occurrenceId,b.roots[0].occurrenceId,
   'original byte digest must be a dimension of canonical revision-bound ID');
 assert.notEqual(a.result.sourceSha256,b.result.sourceSha256);
 assert.equal(a.result.occurrenceCount,b.result.occurrenceCount);
 first.close();changed.close();
});

test('U04 already-cancelled scan emits no complete index or provisional owner grant',async()=>{
 const s=source('{"a":[1,2,3]}'),controller=new AbortController();
 controller.abort();
 let invoked=0;
 await assert.rejects(()=>scan(s,{
  signal:controller.signal,onEventPage:async()=>{invoked++;},
 }),e=>e?.code==='SCAN_ABORTED');
 assert.equal(invoked,0);
 s.close();
});
test('U04 source closed inside sink fails even if scanner holds cached page',async()=>{
 const s=source('{"a":[1,2,3]}');
 let emitted=0;
 await assert.rejects(()=>scan(s,{
  pageBytes:65536,sourceReadPageBytes:64,onEventPage:async page=>{
   emitted+=page.length;
   if(emitted===1)s.close();
  },
 }),e=>e?.code==='SOURCE_CLOSED'||e?.code==='INVALID_BYTE_SOURCE');
 assert.equal(emitted,1);
});
test('U04 abort mid-page/sink never publishes a completed original source summary',async()=>{
 const s=source('{"a":[1,2,3]}'),controller=new AbortController();
 let emitted=0;
 await assert.rejects(()=>scan(s,{
  pageEvents:1,signal:controller.signal,
  onEventPage:async page=>{
   emitted+=page.length;
   if(emitted===2)controller.abort();
  },
 }),e=>e?.code==='SCAN_ABORTED');
 assert.equal(emitted,2);
 s.close();
});
test('U04 source-specific path remains unique but does not overwrite a GC-PW physicalOccurrenceId',async()=>{
 const s=source('{"name":"PIPE"}');
 const {all,result}=await scan(s);
 const id=all.find(e=>e.kind==='OPEN'&&e.path==='/name').occurrenceId;
 assert.ok(id.includes(s.sha256),'original source SHA must be included');
 assert.equal(result.rightsBasis,'SOURCE_FACTS_ONLY');
 assert.equal(result.engineeringReady,false);
 assert.equal(Object.hasOwn(result,'physicalOccurrenceId'),false);
 s.close();
});
