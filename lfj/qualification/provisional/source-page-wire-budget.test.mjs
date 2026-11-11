// #1128 source-contract RED: no production/source module edits in this PR.
// Falsify hidden 64-event Worker throttle AND advertised but ignored R05
// serialized source-event page byte limit with independent original-source facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../../index/source-occurrence-index.mjs';

const encode=x=>new TextEncoder().encode(x);
const original=JSON.stringify(Array.from({length:300},(_,i)=>i));
const data=encode(original);
const sha=createHash('sha256').update(data).digest('hex');
function snapshot(raw=data){
  const builder=createSourceSnapshotBuilder({byteLength:raw.length,
    revision:'R05-R10-SOURCE-WIRE-RED'});
  for(let i=0;i<raw.length;i+=8192)
    builder.append(raw.subarray(i,i+8192),i);
  return builder.finalize();
}

test('R10 requested 512 tiny source events must not secretly throttle to 64',async()=>{
  const worker=new Worker(new URL('../../ports/source-node-worker.mjs',import.meta.url),
    {type:'module'});
  const counts=[],events=[];
  try{
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('R10_RED_NATIVE_TIMEOUT')),15000);
      worker.on('error',error=>{clearTimeout(timer);reject(error);});
      worker.on('message',msg=>{
        if(msg?.kind==='PROVISIONAL_PAGE'){
          counts.push(msg.rows.length);
          events.push(...msg.rows);
          const wire=encode(JSON.stringify(msg)).length;
          if(wire>1048576){clearTimeout(timer);reject(Error('R10_UNBOUNDED_WIRE'));return;}
          worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',
            kind:'PAGE_ACK',jobId:'R10-1128-WIRE',
            sourceRefId:'R05-R10-ORIGINAL',sequence:msg.sequence});
        }else if(msg?.kind==='SCAN_DONE'||msg?.kind==='FAILED'){
          clearTimeout(timer);resolve(msg);
        }
      });
      worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',
        kind:'SCAN',jobId:'R10-1128-WIRE',sourceRefId:'R05-R10-ORIGINAL',
        revision:'R05-R10-SOURCE-WIRE-RED',blob:new Blob([data]),
        expectedSha256:sha,pageEvents:512});
    });
    assert.equal(result.kind,'SCAN_DONE');
    assert.equal(result.summary.sourceSha256,sha);
    assert.equal(result.summary.occurrenceCount,301);
    assert.equal(events.length,602);
    assert.equal(events.filter(e=>e.kind==='OPEN').length,301);
    assert.ok(counts.some(n=>n>64),
      'caller requested 512 small events; hidden 64-event throttle defeats credit batching');
    assert.ok(counts.length<=3,'small source should need <=3 acknowledged batches');
  }finally{await worker.terminate();}
});

test('R05 pageBytes must bound the actual UTF8 serialized original source event page',async()=>{
  const source=snapshot(encode(JSON.stringify(
    Array.from({length:600},(_,i)=>({['key'+i]:i})))));
  const pages=[];
  const maxWire=65536;
  try{
    const summary=await streamJsonOccurrenceEvents(source,{
      sourceRefId:'R05-1128-BOUNDED',
      pageEvents:4096,pageBytes:maxWire,
      onEventPage:async page=>pages.push(page)
    });
    assert.equal(summary.complete,true);
    assert.equal(summary.occurrenceCount,1201);
    assert.ok(pages.length>1,'source event byte cap must split even when under 4096 events');
    for(const page of pages){
      assert.ok(page.length>=1&&page.length<=4096);
      assert.ok(encode(JSON.stringify(page)).length<=maxWire,
        'advertised pageBytes=65536 must be enforced on the actual JSON page');
    }
    assert.equal(pages.reduce((n,p)=>n+p.length,0),2402);
  }finally{source.close();}
});


test('R05 input one-byte UTF8 slicing remains independent from serialized event-page budget',async()=>{
  const json='{"β💡":[{"~/x":"🤖"},{"slash/key":3}]}';
  const raw=encode(json),source=snapshot(raw),pages=[];
  const measured={largestRead:0,reads:0};
  const instrumented={...source,async readRange(start,end,...args){
    measured.reads++;measured.largestRead=Math.max(measured.largestRead,end-start);
    return source.readRange(start,end,...args);
  }};
  try{
    const summary=await streamJsonOccurrenceEvents(instrumented,{
      sourceRefId:'R05-UFT8-BYTE-SPLITS',
      pageEvents:256,pageBytes:4096,sourceReadPageBytes:1,
      onEventPage:async page=>pages.push(page)
    });
    const all=pages.flat(),opens=all.filter(e=>e.kind==='OPEN');
    assert.equal(summary.complete,true);
    assert.equal(summary.occurrenceCount,6);
    assert.equal(summary.eventCount,12);
    assert.equal(measured.largestRead,1,
      'R04 input one-byte UTF8 reads must remain enforceable');
    assert.ok(pages.every(p=>encode(JSON.stringify(p)).length<=4096));
    const robot=opens.find(x=>x.path==='/β💡/0/~0~1x');
    assert.ok(robot,'original Unicode/RFC6901 path remains source owned');
    const seal=all.find(e=>e.kind==='SEAL'&&e.occurrenceId===robot.occurrenceId);
    assert.ok(seal);
    assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(
      raw.subarray(robot.startByte,seal.endByteExclusive)),JSON.stringify('🤖'));
  }finally{source.close();}
});

test('R10 native Worker splits very long UTF8 source facts by entire postMessage bytes',async()=>{
  const original=JSON.stringify(Object.fromEntries(
    Array.from({length:32},(_,i)=>['key'+i+'_'+'K'.repeat(14000),'v'])));
  const originalBytes=encode(original),digest=createHash('sha256').update(originalBytes).digest('hex');
  const worker=new Worker(new URL('../../ports/source-node-worker.mjs',import.meta.url),
    {type:'module'});
  const sizes=[],counts=[];
  try{
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('R10_LONG_WIRE_TIMEOUT')),30000);
      worker.on('error',err=>{clearTimeout(timer);reject(err);});
      worker.on('message',msg=>{
        if(msg?.kind==='PROVISIONAL_PAGE'){
          sizes.push(encode(JSON.stringify(msg)).length);
          counts.push(msg.rows.length);
          if(sizes.at(-1)>1048576){clearTimeout(timer);reject(Error('R10_FULL_WIRE_OVERLIMIT'));return;}
          worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'PAGE_ACK',
            jobId:'R10-1128-LONG',sourceRefId:'LONG-ORIGINAL',sequence:msg.sequence});
        }else if(msg?.kind==='SCAN_DONE'||msg?.kind==='FAILED'){
          clearTimeout(timer);resolve(msg);
        }
      });
      worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'SCAN',
        jobId:'R10-1128-LONG',sourceRefId:'LONG-ORIGINAL',
        revision:'R10-1128-LONG-REV',expectedSha256:digest,
        blob:new Blob([originalBytes]),pageEvents:4096});
    });
    assert.equal(result.kind,'SCAN_DONE');
    assert.equal(result.summary.sourceSha256,digest);
    assert.equal(result.summary.occurrenceCount,33);
    assert.equal(result.summary.eventCount,66);
    assert.equal(counts.reduce((a,b)=>a+b,0),66);
    assert.ok(counts.length>=2,'full Worker byte budget must split a small count of giant events');
    assert.ok(sizes.every(n=>n<=1048576));
  }finally{await worker.terminate();}
});
