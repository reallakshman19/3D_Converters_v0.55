// R06/U04 RED: real Worker crash/protocol refusal + terminal resource hygiene.
// No fake method-shaped worker; every case creates actual node:worker_threads.Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {runRequiredWorkerJob} from './required-worker.mjs';
import {transferBoundedSourcePages} from './bounded-source-transfer.mjs';

const workerFor=mode=>new Worker(new URL('./worker-failure-fixture.mjs',import.meta.url),
  {type:'module',workerData:{mode}});
const job={jobId:'R06-U04',sourceRefId:'PL01',
  sourceSha256:'a'.repeat(64),sourceRevision:'R06-U04:sha256:'+'a'.repeat(64),
  byteLength:8193};
function source(){
 const input=new Uint8Array(8193);
 for(let i=0;i<input.length;i++)input[i]=i%251;
 const b=createSourceSnapshotBuilder({byteLength:input.length,revision:'r06-u04'});
 b.append(input,0);const snapshot=b.finalize(),reads=[];
 return {snapshot,reads,port:Object.freeze({...snapshot,readRange(...args){
   reads.push([args[0],args[1]]);return snapshot.readRange(...args);
 }})};
}
const transfer=(worker,s,onConsumed=null)=>transferBoundedSourcePages({
 worker,trustedWorkerCtor:Worker,snapshot:s.port,
 jobId:job.jobId,sourceRefId:job.sourceRefId,
 pageBytes:4096,ackTimeoutMs:300,onConsumed,
});
async function gone(worker){
 // Native Worker's threadId becomes -1 when the Worker was terminated or
 // exited. The producer must await cleanup before resolving the rejection.
 assert.equal(worker.threadId,-1,'failed transport must leave no Worker running');
}
test('U04 RED: Worker exits before READY; typed immediate failure and no hung admission',async()=>{
 const worker=workerFor('exit-on-start'),t=Date.now();
 try{
  await assert.rejects(()=>runRequiredWorkerJob({
   ...job,createWorker:()=>worker,trustedWorkerCtor:Worker,
  }),e=>e?.code==='WORKER_FAILED');
  assert.ok(Date.now()-t<1500,'crash detection must not wait the 5s admission timeout');
  await gone(worker);
 }finally{await worker.terminate();}
});
test('U04 RED: Worker responds READY for wrong original source revision; refuse and terminate',async()=>{
 const worker=workerFor('ready-mismatch');
 try{
  await assert.rejects(()=>runRequiredWorkerJob({
   ...job,createWorker:()=>worker,trustedWorkerCtor:Worker,
  }),e=>e?.code==='WORKER_PROTOCOL');
  await gone(worker);
 }finally{await worker.terminate();}
});
for(const mode of ['wrong-ack','stale-ack','exit-on-page']){
 test('U04 RED: '+mode+' rejects exact source transfer and terminates Worker',async()=>{
  const s=source(),worker=workerFor(mode);
  try{
   await assert.rejects(()=>transfer(worker,s),e=>
     e?.code===(mode==='exit-on-page'?'WORKER_FAILED':'WORKER_PROTOCOL'));
   assert.deepEqual(s.reads,[[0,4096]],'never read a second page after failed Worker');
   await gone(worker);
  }finally{await worker.terminate();s.snapshot.close();}
 });
}
test('U04 RED: Worker exit after ACK but before source consumption must fail closed',async()=>{
 const s=source(),worker=workerFor('ack-then-error'),reports=[];
 try{
  await assert.rejects(()=>transfer(worker,s,r=>reports.push(r)),
    e=>e?.code==='WORKER_FAILED');
  assert.deepEqual(reports,[]);
  assert.deepEqual(s.reads,[[0,4096]]);
  await gone(worker);
 }finally{await worker.terminate();s.snapshot.close();}
});
test('U04 RED: throwing progress observer refuses completed receipt and cleans Worker',async()=>{
 const s=source(),worker=workerFor('ack-then-consume');
 try{
  await assert.rejects(()=>transfer(worker,s,()=>{
   throw new Error('consumer refused');
  }),e=>e?.code==='CONSUMPTION_CALLBACK_FAILED');
  assert.deepEqual(s.reads,[[0,4096]]);
  await gone(worker);
 }finally{await worker.terminate();s.snapshot.close();}
});


for(const [mode,expected] of [
 ['no-ack','WORKER_ACK_TIMEOUT'],
 ['double-ack','WORKER_PROTOCOL'],
 ['consumed-before-ack','WORKER_PROTOCOL'],
]){
 test('U04 terminal: '+mode+' never permits consumption and kills Worker',async()=>{
  const s=source(),worker=workerFor(mode),progress=[];
  try{
   await assert.rejects(()=>transfer(worker,s,r=>progress.push(r)),
     e=>e?.code===expected);
   assert.deepEqual(progress,[],'no consumed progress before exact ACK+consume');
   assert.deepEqual(s.reads,[[0,4096]],'no subsequent source range read');
   await gone(worker);
  }finally{await worker.terminate();s.snapshot.close();}
 });
}

test('U04 RED: forged Worker prototype must not inline-ACK original source transfer',async()=>{
 const s=source(),handlers=new Map();
 let inlineCalls=0;
 const fake=Object.create(Worker.prototype);
 fake.on=(kind,fn)=>{handlers.set(kind,fn);return fake;};
 fake.off=(kind,fn)=>{if(handlers.get(kind)===fn)handlers.delete(kind);return fake;};
 fake.terminate=()=>Promise.resolve(0);
 fake.postMessage=msg=>{
   inlineCalls++;
   queueMicrotask(()=>handlers.get('message')?.({
     ...msg,kind:'SOURCE_ACK',receivedBytes:msg.bytes.byteLength,
   }));
 };
 try{
   assert.equal(fake instanceof Worker,true);
   await assert.rejects(()=>transfer(fake,s),e=>e?.code==='INVALID_WORKER_PORT');
   assert.equal(inlineCalls,0,'source bytes must not be delivered to spoofed inline receiver');
   assert.equal(handlers.size,0,'reject and clean all source listeners');
 }finally{s.snapshot.close();}
});
