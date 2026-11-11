// R07/U02 independently falsifying native Worker crash vs provisional acceptance.
// RED against working U01 session: admission is not durable source/index completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createWorkerLifecycleSession} from './lifecycle-session.mjs';

const job={jobId:'R07-U02',sourceRefId:'PL01',sourceRevision:'rev:sha256:original',
 sourceSha256:'b'.repeat(64),byteLength:32771,selectionDigest:'all:sha256:scope'};
function make(mode){
 let worker;
 const terminal=[];
 const session=createWorkerLifecycleSession({...job,trustedWorkerCtor:Worker,
  createWorker:()=>{worker=new Worker(new URL('./lifecycle-worker-fixture.mjs',import.meta.url),
    {type:'module',workerData:{mode}});return worker;},
 });
 session.subscribe(event=>terminal.push(event));
 return {session,terminal,get worker(){return worker;}};
}
for(const mode of ['after-ready-exit','after-ready-error']){
 test('U02 RED: '+mode+' cannot leave admitted partial source as live job',async()=>{
  const j=make(mode);
  try{
   const pending=j.session.start();
   const exits=new Promise(resolve=>j.worker.once('exit',resolve));
   if(mode==='after-ready-error')j.worker.on('error',()=>{});
   const admitted=await pending;
   assert.equal(admitted.kind,'ADMITTED','source is not complete on READY');
   assert.equal(admitted.complete,false);
   await exits;
   const result=j.session.snapshot();
   assert.equal(result.kind,'FAILED','Worker crash must terminally reject provisional state');
   assert.equal(result.terminal,true);
   assert.equal(result.complete,false);
   assert.equal(result.engineeringReady,false);
   assert.equal(result.errorCode,'WORKER_FAILED');
   assert.deepEqual(j.terminal,[result],'error and exit compete for one terminal winner');
   assert.equal(j.worker.threadId,-1);
   assert.strictEqual(await j.session.cancel(),result,'late cancel cannot turn crash into success');
  }finally{await j.worker?.terminate();}
 });
}
test('U02: a Worker-asserted INDEX_COMPLETE without R05 source proof never commits',async()=>{
 const j=make('forged-complete');
 try{
  const pending=j.session.start();
  const fakeCompletion=new Promise(resolve=>j.worker.on('message',m=>{
   if(m?.kind==='INDEX_COMPLETE')resolve(m);
  }));
  assert.equal((await pending).kind,'ADMITTED');
  const msg=await fakeCompletion;
  assert.equal(msg.complete,true,'fixture actually asserted fraudulent completion');
  assert.equal(j.session.snapshot().kind,'ADMITTED',
    'unverified Worker completion message grants no index acceptance');
  assert.equal(j.session.snapshot().engineeringReady,false);
  assert.deepEqual(j.terminal,[]);
  assert.equal((await j.session.cancel()).kind,'CANCELLED');
 }finally{await j.worker?.terminate();}
});
