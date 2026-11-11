// LFJ R06/U03 independent RED: transport ACK != Worker byte consumption.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {transferBoundedSourcePages} from './bounded-source-transfer.mjs';
const SCHEMA='LFJ.WorkerExecution.v1';
function makeSource(size=24583){
 const raw=new Uint8Array(size);
 for(let i=0;i<size;i++)raw[i]=(i*13+7)%251;
 const builder=createSourceSnapshotBuilder({byteLength:size,revision:'u03-source-bytes'});
 builder.append(raw,0);const snapshot=builder.finalize();
 const reads=[];
 return {raw,snapshot,reads,port:Object.freeze({...snapshot,
   readRange(start,end,revision,cap){
     reads.push([start,end]);
     return snapshot.readRange(start,end,revision,cap);
   },
 })};
}
const run=(worker,source,onConsumed)=>transferBoundedSourcePages({
 worker,trustedWorkerCtor:Worker,snapshot:source.port,
 jobId:'R06-U03',sourceRefId:'PL01',pageBytes:8192,ackTimeoutMs:300,
 onConsumed,
});
test('U03 RED: ACK does not move progress; actual isolated Worker consumption does',async()=>{
 const source=makeSource(),seen=[],acks=[];
 const worker=new Worker(new URL('./consumed-source-fixture.mjs',import.meta.url),
   {type:'module',workerData:{mode:'release'}});
 try{
   worker.on('message',msg=>{
     if(msg?.schema===SCHEMA&&msg.kind==='SOURCE_ACK'){
       assert.equal(seen.length,acks.length,
         'every ACK must precede consumption and NOT advance progress');
       acks.push(msg.endByteExclusive);
       worker.postMessage({schema:SCHEMA,kind:'CONSUME_NOW',startByte:msg.startByte});
     }
   });
   const result=await run(worker,source,report=>{
     const prev=seen.at(-1)?.consumedBytes??0;
     assert.ok(report.consumedBytes>prev,'consumed-byte progress strictly monotonic');
     assert.equal(report.sourceSha256,source.snapshot.sha256);
     assert.equal(report.sourceRevision,source.snapshot.revision);
     assert.equal(report.sourceRefId,'PL01');
     // Independent calculation from ORIGINAL input, not Worker output oracle.
     const start=prev,end=report.consumedBytes;
     let sum=0;
     for(const b of source.raw.subarray(start,end))sum=(sum+b)>>>0;
     assert.equal(report.pageChecksum,sum,'real worker scanned exact original page');
     seen.push(report);
   });
   assert.deepEqual(acks,[8192,16384,24576,24583]);
   assert.deepEqual(seen.map(x=>x.consumedBytes),acks);
   assert.equal(result.workerConsumedBytes,source.snapshot.byteLength);
   assert.equal(result.acknowledgedBytes,source.snapshot.byteLength);
   assert.equal(result.complete,false);
   assert.equal(result.engineeringReady,false);
   assert.deepEqual(source.reads,[[0,8192],[8192,16384],[16384,24576],[24576,24583]]);
 }finally{await worker.terminate();source.snapshot.close();}
});
test('U03 RED: Worker ACK without consumption leaves progress at zero and cannot read next page',async()=>{
 const source=makeSource(),seen=[];
 const worker=new Worker(new URL('./consumed-source-fixture.mjs',import.meta.url),
   {type:'module',workerData:{mode:'ack-only'}});
 try{
   await assert.rejects(()=>run(worker,source,r=>seen.push(r)),
     e=>e?.code==='WORKER_CONSUME_TIMEOUT');
   assert.deepEqual(seen,[]);
   assert.deepEqual(source.reads,[[0,8192]]);
 }finally{await worker.terminate();source.snapshot.close();}
});
test('U03 RED: bogus Worker consumed offset never moves progress',async()=>{
 const source=makeSource(),seen=[];
 const worker=new Worker(new URL('./consumed-source-fixture.mjs',import.meta.url),
   {type:'module',workerData:{mode:'bad-range'}});
 try{
   await assert.rejects(()=>run(worker,source,r=>seen.push(r)),
     e=>e?.code==='WORKER_PROTOCOL');
   assert.deepEqual(seen,[]);
   assert.deepEqual(source.reads,[[0,8192]]);
 }finally{await worker.terminate();source.snapshot.close();}
});
