// R03 RED-first memory residency constraints (not populated source benchmarks).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from './source-snapshot.mjs';
const code=(fn)=>{try{fn();return 'NO_ERROR';}catch(e){return e.code||'UNTYPED';}};

test('resident in-memory builder rejects a huge source; large files use Blob-backed port',()=>{
  assert.equal(code(()=>createSourceSnapshotBuilder({
    byteLength:16*1024*1024+1,revision:'huge-memory-resident',
  })),'SOURCE_RESIDENCY_LIMIT');
  const allowed=createSourceSnapshotBuilder({byteLength:16*1024*1024,revision:'small'});
  allowed.abort();
  assert.equal(code(()=>allowed.finalize()),'SOURCE_ABORTED');
});

test('adversarial one-byte fragmentation hits a segment budget instead of unlimited JS objects',()=>{
  const limit=4096,bytes=new Uint8Array(limit+2);
  const builder=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'fragmented'});
  for(let i=0;i<limit;i++)builder.append(bytes.subarray(i,i+1),i);
  assert.equal(code(()=>builder.append(bytes.subarray(limit,limit+1),limit)),
    'SEGMENT_LIMIT');
  builder.abort();
  assert.equal(code(()=>builder.finalize()),'SOURCE_ABORTED');
});

test('partial builder abort is terminal; complete snapshot is disposed with close()',()=>{
  const b=createSourceSnapshotBuilder({byteLength:1,revision:'closed'});
  b.append(Uint8Array.of(99),0);
  const source=b.finalize();
  assert.equal(code(()=>b.abort()),'SNAPSHOT_FINALIZED',
    'calling abort after commit must not ambiguously revoke a returned snapshot');
  assert.equal(source.readRange(0,1,source.revision)[0],99);
  source.close();
  assert.equal(code(()=>source.readRange(0,1,source.revision)),'SOURCE_CLOSED');
});
