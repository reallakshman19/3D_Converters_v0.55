// LFJ R06/U01 independent RED: real isolated Worker, never same-thread fallback.
// Node WorkerThreads is the hosted isolation oracle; browser Chromium belongs
// to further direct acceptance, not an implicit product privilege.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker,threadId,isMainThread} from 'node:worker_threads';
import {runRequiredWorkerJob} from './required-worker.mjs';
const rejectCode=c=>e=>{assert.equal(e.code,c);return true;};
const input=Object.freeze({jobId:'R06-original-job',sourceRefId:'PL01',
  sourceRevision:'rev1:sha256:abc',sourceSha256:'abc',byteLength:32});
test('U01 RED: absent or failing Worker factory refuses without fallback',async()=>{
 for(const factory of [undefined,null,()=>null,()=>{throw new Error('Worker disabled by CSP');}]){
  await assert.rejects(()=>runRequiredWorkerJob({...input,createWorker:factory}),
    rejectCode('WORKER_UNAVAILABLE'));
 }
});
test('U01 RED: a synchronous callback masquerading as a Worker cannot authorize a result',async()=>{
 let inlineCalls=0;
 await assert.rejects(()=>runRequiredWorkerJob({...input,
  createWorker:()=>({postMessage:()=>{inlineCalls++;return {kind:'READY',success:true};}}),
 }),rejectCode('INVALID_WORKER_PORT'));
 assert.equal(inlineCalls,0,'never invoke unqualified postMessage fallback');
});
test('U01 RED: actual native WorkerThreads receives START and replies from non-main thread',async()=>{
 assert.equal(isMainThread,true);
 let worker;
 try{
  const reply=await runRequiredWorkerJob({...input,
   trustedWorkerCtor:Worker,
   createWorker:()=>{
    worker=new Worker(new URL('./required-worker-fixture.mjs',import.meta.url),{type:'module'});
    return worker;
   },
  });
  assert.equal(reply.jobId,input.jobId);
  assert.equal(reply.kind,'READY');
  assert.equal(reply.sourceRefId,input.sourceRefId);
  assert.equal(reply.sourceRevision,input.sourceRevision);
  assert.equal(reply.byteLength,input.byteLength);
  assert.equal(reply.isMainThread,false);
  assert.ok(reply.threadId>0&&reply.threadId!==threadId);
 }finally{await worker?.terminate();}
});
test('U01 RED: invalid job metadata is refused before any worker construction',async()=>{
 let created=0;
 await assert.rejects(()=>runRequiredWorkerJob({...input,sourceRevision:'',
  createWorker:()=>{created++;return {};} }),rejectCode('INVALID_SOURCE_JOB'));
 assert.equal(created,0);
});
