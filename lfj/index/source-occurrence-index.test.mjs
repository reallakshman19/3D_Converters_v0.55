// LFJ R05/U01 independent RED: enumerate *every* JSON value from original R04 bytes.
// No full-file JSON.parse, no shortcut to selected top-5, no self-derived golden output.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';

const input='{"hierarchy":[{"name":"/B","children":[{"name":"/V","children":[]},null]},{"name":"/B","children":[]}],"flag":false}';
const goldenPointers=[
  '', '/hierarchy', '/hierarchy/0', '/hierarchy/0/name',
  '/hierarchy/0/children','/hierarchy/0/children/0',
  '/hierarchy/0/children/0/name','/hierarchy/0/children/0/children',
  '/hierarchy/0/children/1','/hierarchy/1','/hierarchy/1/name',
  '/hierarchy/1/children','/flag',
]; // Hand enumerated: all original JSON value occurrences, including null and empty arrays.

function snap(text,chunkSize=2){
  const raw=new TextEncoder().encode(text);
  const b=createSourceSnapshotBuilder({byteLength:raw.length,revision:'real-source-occurrence-u01'});
  for(let i=0;i<raw.length;i+=chunkSize)b.append(raw.subarray(i,i+chunkSize),i);
  return b.finalize();
}
test('U01 RED: complete source-order OPEN census, including descendants and unselected scalars',async()=>{
  const s=snap(input,1),pages=[];
  const summary=await streamJsonOccurrenceEvents(s,{
    sourceRefId:'PL01',pageEvents:3,
    onEventPage:async page=>pages.push(page),
    // This test checks byte-truth and occurrence ordering, not an impossible
    // one-byte JSON event page. R05 now enforces independent input/output
    // page budgets, preserving original 1-byte R04 reads.
    pageBytes:65536,sourceReadPageBytes:1,
  });
  const all=pages.flat(),opens=all.filter(e=>e.kind==='OPEN'),seals=all.filter(e=>e.kind==='SEAL');
  assert.deepEqual(opens.map(e=>e.path),goldenPointers);
  assert.equal(opens.length,13);
  assert.equal(seals.length,13);
  assert.equal(summary.occurrenceCount,13);
  assert.equal(summary.complete,true);
  assert.equal(summary.sourceSha256,s.sha256);
  assert.equal(summary.sourceRevision,s.revision);
  assert.equal(summary.endByteExclusive,new TextEncoder().encode(input).length);
  assert.ok(pages.length>1);
  assert.ok(pages.every(p=>p.length>0&&p.length<=3&&Object.isFrozen(p)));
  assert.equal(new Set(opens.map(x=>x.occurrenceId)).size,13);
  assert.ok(opens.every(x=>x.sourceRefId==='PL01'&&x.sourceRevision===s.revision));
  assert.equal(opens.find(x=>x.path==='/hierarchy/0/children/0/name').parentId,
    opens.find(x=>x.path==='/hierarchy/0/children/0').occurrenceId);
  s.close();
});

test('U01 RED: invalid JSON never returns a completed occurrence index',async()=>{
  const s=snap('{"hierarchy":[{"name":"/A"}');
  let complete=false;
  await assert.rejects(async()=>{
    const result=await streamJsonOccurrenceEvents(s,{
      sourceRefId:'PL01',onEventPage:async()=>{},pageEvents:2,
    });
    complete=result.complete;
  });
  assert.equal(complete,false);
  s.close();
});

test('U01 RED: async page sink rejection must fail instead of returning an accepted complete index',async()=>{
  const s=snap(input,5);
  const expected=new Error('sink refused storage transaction');
  await assert.rejects(()=>streamJsonOccurrenceEvents(s,{
    sourceRefId:'PL01',pageEvents:1,onEventPage:async()=>{throw expected;},
  }),e=>e===expected);
  s.close();
});


test('R05 source byte budget refuses an unfit original row without staged output',async()=>{
  const s=snap('{"original":"long value"}',2),pages=[];
  try{
    await assert.rejects(()=>streamJsonOccurrenceEvents(s,{
      sourceRefId:'R05-BUDGET-NEGATIVE',pageEvents:4096,pageBytes:1,
      onEventPage:async p=>pages.push(p),
    }),e=>e?.code==='SOURCE_EVENT_PAGE_LIMIT');
    assert.equal(pages.length,0,'no incomplete or oversized source page was acknowledged');
  }finally{s.close();}
});
