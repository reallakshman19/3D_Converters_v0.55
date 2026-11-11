// R05 independent RED for unbounded caller revision copied into every value ID.
// R03 correctly appends source SHA to an input revision; that alone does NOT bound
// the user-supplied prefix's resident memory amplification in R05 occurrence IDs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';

test('R05 RED: enormous original source revision prefix cannot amplify source occurrence IDs',async()=>{
 const json='{"a":1}',bytes=new TextEncoder().encode(json);
 const builder=createSourceSnapshotBuilder({
   byteLength:bytes.length,revision:'R'.repeat(100000),
 });
 builder.append(bytes,0);
 const snapshot=builder.finalize();
 assert.ok(snapshot.revision.length>100000);
 let emittedPages=0;
 try {
  await assert.rejects(()=>streamJsonOccurrenceEvents(snapshot,{
   sourceRefId:'ORIGINAL-PL01',pageEvents:1,onEventPage:async()=>{emittedPages++;},
  }),e=>e?.code==='INVALID_SOURCE_SNAPSHOT'||e?.code==='POINTER_LIMIT');
  assert.equal(emittedPages,0,'invalid source revision must reject before event/page emission');
 }finally{snapshot.close();}
});
