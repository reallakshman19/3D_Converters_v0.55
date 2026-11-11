// R04/U04 independent global-resource/cancellation RED corpus.
// Expected behavior is specified before production resource options are implemented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {openAsBlob} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createSourceSnapshotBuilder,openBlobSourceSnapshot} from '../source/source-snapshot.mjs';
import {scanJsonDocument} from './json-tokenizer.mjs';

const bytes=text=>new TextEncoder().encode(text);
function source(text,chunkBytes=1){
  const raw=bytes(text),builder=createSourceSnapshotBuilder({byteLength:raw.length,revision:'r04-u04'});
  for(let i=0;i<raw.length;i+=chunkBytes)builder.append(raw.subarray(i,i+chunkBytes),i);
  return builder.finalize();
}
const reject=code=>error=>{assert.equal(error?.code,code);return true;};

test('U04 source total-byte ceiling rejects before full scan',async()=>{
  const s=source('{"hierarchy":[1,2,3,4]}',2);
  await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1,maxByteLength:10}),reject('BYTE_LIMIT'));
  s.close();
});

test('U04 token-count and nested-depth limits are caller-bounded and never bypass hard caps',async()=>{
  const a=source('{"hierarchy":[1,2,3,4,5]}',3);
  await assert.rejects(()=>scanJsonDocument(a,{pageBytes:1,maxTokens:5}),reject('TOKEN_COUNT_LIMIT'));
  a.close();
  const b=source('[[[["nested"]]]]',2);
  await assert.rejects(()=>scanJsonDocument(b,{pageBytes:1,maxDepth:2}),reject('DEPTH_LIMIT'));
  b.close();
  const c=source('["12345678901234567890"]',2);
  await assert.rejects(()=>scanJsonDocument(c,{pageBytes:1,maxTokenBytes:8}),reject('TOKEN_LIMIT'));
  c.close();
  for(const invalid of [{maxTokens:600*1024*1024},{maxDepth:300},{maxByteLength:1024**4}]){
    const s=source('[]',2);
    await assert.rejects(()=>scanJsonDocument(s,invalid),reject('INVALID_RESOURCE_LIMIT'));
    s.close();
  }
});

test('U04 admissible 90MB-class scan token budgets exceed the 2M-token tiny-source ceiling',async()=>{
  const s=source('[1,2,3]',2);
  const r=await scanJsonDocument(s,{maxTokens:20_000_000,maxByteLength:128*1024*1024});
  assert.equal(r.rootFacts.rootCount,3);
  s.close();
});

test('U04 already-cancelled byte scan cannot publish complete facts',async()=>{
  const s=source('{"hierarchy":[1,2,3]}',4),controller=new AbortController();
  controller.abort();
  await assert.rejects(()=>scanJsonDocument(s,{signal:controller.signal,pageBytes:1}),reject('SCAN_ABORTED'));
  s.close();
});

test('U04 cancellation during async token events suppresses all future complete facts',async()=>{
  const s=source('{"hierarchy":[1,2,3,4,5,6,7,8,9]}',3),controller=new AbortController();
  let seen=0;
  await assert.rejects(()=>scanJsonDocument(s,{signal:controller.signal,pageBytes:1,onToken:async()=>{
    if(++seen===4)controller.abort();
  }}),reject('SCAN_ABORTED'));
  assert.equal(seen,4,'no token event accepted after cancellation');
  s.close();
});

test('U04 source closed during scan fails rather than returning stale results',async()=>{
  const s=source('{"hierarchy":[1,2,3]}',4);
  await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1,onToken:token=>{
    if(token.type==='start-array')s.close();
  }}),reject('SOURCE_CLOSED'));
});

test('U04 1-byte reads retain complete root and bounded final source facts',async()=>{
  const raw='{"branches":['+Array.from({length:40},(_,i)=>i).join(',')+']}';
  const s=source(raw,1);
  const result=await scanJsonDocument(s,{pageBytes:1,maxByteLength:1000,maxTokens:256,maxDepth:10});
  assert.equal(result.complete,true);
  assert.equal(result.rootFacts.rootType,'object');
  assert.equal(result.rootFacts.fields.branches.count,40);
  assert.equal(result.endByteExclusive,bytes(raw).length);
  s.close();
});

test('U04 REAL original ATTRIBUTE managed-stage 10.54 MB source without padding',{
  skip:process.env.LFJ_R04_REAL_SOURCE!=='1'?'separate exact-head real-source gate':false
},async()=>{
  const path='Benchmarks/Managejson to Input XML/ATTRIBUTE_managed_stage.json';
  const original=await openAsBlob(path);
  assert.equal(original.size,10539386);
  const expected='e465fa696c80516868349032af6cf1976d9a180c86ea2a7b9eab28c6436fa92a';
  const start=performance.now();
  const snapshot=await openBlobSourceSnapshot(original,{
    revision:'r04-real-owner-original',chunkBytes:65536,expectedSha256:expected
  });
  const before=process.memoryUsage().heapUsed;
  const result=await scanJsonDocument(snapshot,{
    pageBytes:65536,maxByteLength:64*1024*1024,maxTokens:2000000,maxDepth:256
  });
  const elapsed=performance.now()-start;
  const heapDelta=process.memoryUsage().heapUsed-before;
  assert.equal(snapshot.sha256,expected);
  assert.equal(result.sourceSha256,expected);
  assert.equal(result.endByteExclusive,10539386);
  assert.equal(result.rootFacts.rootType,'array');
  assert.equal(result.rootFacts.rootCount,270);
  assert.equal(result.complete,true);
  console.log('LFJ_R04_REAL_MEASUREMENT',JSON.stringify({
    sha256:expected,bytes:original.size,rootCount:result.rootFacts.rootCount,
    tokens:result.tokenCount,elapsedMs:Math.round(elapsed),
    heapDeltaBytes:heapDelta,referenceHardware:process.platform+' '+process.arch,
    node:process.version,quality:'MEASURED_NOT_OWNER_APPROVED_SLO'
  }));
  snapshot.close();
});
