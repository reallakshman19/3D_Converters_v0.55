// R03 RED-first storage-port tests. No synthetic source is an owner-real 30/90MB acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openBlobSourceSnapshot,createSourceSnapshotBuilder} from './source-snapshot.mjs';
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const code=fn=>{try{fn();return 'NO_ERROR';}catch(e){return e.code||'UNTYPED';}};

test('U01 immutable Blob source is hashed in bounded chunks and pages exact original bytes',async()=>{
  const source=new Uint8Array(2*1024*1024+27);
  source.fill(65);
  source.set(new TextEncoder().encode('β💡'),1024*1024-2);
  const original=Uint8Array.from(source),blob=new Blob([source],{type:'application/json'});
  const originalSha=hash(original);
  source.fill(0); // Blob must retain original bytes rather than caller's mutable Uint8Array
  const snap=await openBlobSourceSnapshot(blob,{revision:'native-blob-a',
    expectedSha256:originalSha,chunkBytes:65536});
  assert.equal(snap.byteLength,original.length);
  assert.equal(snap.sha256,originalSha);
  assert.equal(snap.backing,'immutable-blob');
  assert.notEqual(snap.revision,'native-blob-a');
  assert.deepEqual(await snap.readRange(1024*1024-4,1024*1024+8,snap.revision),
    original.subarray(1024*1024-4,1024*1024+8));
  assert.equal((await snap.readRange(0,1,snap.revision))[0],65);
  let count=0,total=0;
  for await(const chunk of snap.readChunks(snap.revision,80000)){
    count++;total+=chunk.length;
    assert.ok(chunk.length<=80000);
  }
  assert.ok(count>2);assert.equal(total,original.length);
  await assert.rejects(()=>snap.readRange(0,2,'stale'),e=>e.code==='STALE_REVISION');
  await assert.rejects(()=>snap.readRange(0,1048577,snap.revision,1048577),
    e=>e.code==='RANGE_LIMIT');
  snap.close();
  await assert.rejects(()=>snap.readRange(0,1,snap.revision),e=>e.code==='SOURCE_CLOSED');
});

test('U04 abort before opening or during byte ingestion and digest mismatch fail closed',async()=>{
  const input=new Blob([new TextEncoder().encode('{"objects":[]}')]);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(()=>openBlobSourceSnapshot(input,{revision:'c',signal:cancelled.signal}),
    e=>e.code==='SOURCE_ABORTED');
  await assert.rejects(()=>openBlobSourceSnapshot(input,{revision:'notmatching',
    expectedSha256:'0'.repeat(64)}),e=>e.code==='SOURCE_HASH_MISMATCH');
  const b=createSourceSnapshotBuilder({byteLength:16,revision:'cancel-incomplete'});
  b.append(new Uint8Array([1,2]),0);
  assert.equal(typeof b.abort,'function','partial builder must provide terminal dispose');
  b.abort();
  assert.equal(code(()=>b.append(new Uint8Array([3]),2)),'SOURCE_ABORTED');
  assert.equal(code(()=>b.finalize()),'SOURCE_ABORTED');
});

test('U02 adversarial fine chunk boundaries never change source range and content',()=>{
  const bytes=new TextEncoder().encode('{"hierarchy":[{"name":"/z💡","children":[]}]}');
  const b=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'one-byte'});
  for(let i=0;i<bytes.length;i++)b.append(bytes.subarray(i,i+1),i);
  const snap=b.finalize();
  for(let i=0;i<bytes.length;i++)
    assert.equal(snap.readRange(i,i+1,snap.revision)[0],bytes[i]);
  snap.close();
});
