// R07/U04 independent native Worker fresh retry and run-epoch refusal (RED before production).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createWorkerLifecycleSession} from './lifecycle-session.mjs';
const basis={sourceRefId:'S',sourceSha256:'a'.repeat(64),sourceRevision:'s1',
 byteLength:31,selectionDigest:'scope-A',dependencyRevision:'xml-A'};
function open(jobId='J1',opts={}){
 const workers=[];
 const createWorker=()=>{const mode=(opts.mode==='exit'&&workers.length)?'ready':(opts.mode||'ready');
  const w=new Worker(new URL('./lifecycle-worker-fixture.mjs',import.meta.url),
  {type:'module',workerData:{mode}});workers.push(w);return w;};
 const session=createWorkerLifecycleSession({jobId,...basis,createWorker,trustedWorkerCtor:Worker});
 return {session,createWorker,workers,async stop(){await Promise.all(workers.map(w=>w.terminate()));}};
}
test('U04 RED: a job-ID-only supersede fences old admitted run epoch',async()=>{
 const j=open();
 try{
  assert.equal((await j.session.start()).kind,'ADMITTED');
  const old=await j.session.supersede({...basis,jobId:'J2'});
  assert.equal(old.kind,'STALE');
  assert.equal(j.workers[0].threadId,-1);
  assert.equal((await j.session.start()).kind,'STALE');
 }finally{await j.stop();}
});
for(const ending of ['CANCELLED','FAILED','STALE']){
 test('U04 RED: '+ending+' retry requires fresh job, Worker, selection and epoch',async()=>{
  const j=open('J1',{mode:ending==='FAILED'?'exit':'ready'});
  try{
   const started=await j.session.start();
   if(ending==='CANCELLED')await j.session.cancel();
   else if(ending==='STALE')await j.session.supersede({...basis,jobId:'J2',selectionDigest:'scope-B'});
   else assert.equal(started.kind,'FAILED');
   await assert.rejects(()=>j.session.retry({jobId:'J1',...basis,createWorker:j.createWorker,trustedWorkerCtor:Worker}),
    e=>e?.code==='RETRY_EPOCH_REQUIRED');
   const next=await j.session.retry({jobId:'J2',...basis,selectionDigest:'scope-B',
     dependencyRevision:'xml-B',createWorker:j.createWorker,trustedWorkerCtor:Worker});
   assert.equal((await next.start()).kind,'ADMITTED');
   assert.equal(j.workers.length,2,'fresh Worker allocated, not previous native handle');
   assert.notStrictEqual(j.workers[0],j.workers[1]);
   assert.equal(j.workers[0].threadId,-1,'first Worker fully terminated');
   assert.equal((await j.session.start()).terminal,true,'old session cannot revive');
   assert.equal(next.snapshot().selectionDigest,'scope-B');
   assert.equal(next.snapshot().dependencyRevision,'xml-B');
   await next.cancel();
  }finally{await j.stop();}
 });
}
test('U04 RED: an unfinished Worker may not create overlapping retry',async()=>{
 const j=open();
 try{
  assert.equal((await j.session.start()).kind,'ADMITTED');
  await assert.rejects(()=>j.session.retry({jobId:'J2',...basis,
    createWorker:j.createWorker,trustedWorkerCtor:Worker}),e=>e?.code==='RETRY_NOT_TERMINAL');
  assert.equal(j.workers.length,1);
 }finally{await j.session.cancel();await j.stop();}
});
