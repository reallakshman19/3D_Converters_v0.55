// R07/U01 independent native-Worker lifecycle acceptance contract.
// RED-first: a listener/START result is NOT a terminal cancellation outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createWorkerLifecycleSession} from './lifecycle-session.mjs';

const input=Object.freeze({
 jobId:'R07-native-cancel',sourceRefId:'PL01',
 sourceSha256:'a'.repeat(64),sourceRevision:'sha256-source-revision',
 byteLength:24583,selectionDigest:'scope-all:exact-revision',
});
const workerFor=mode=>new Worker(new URL('./lifecycle-worker-fixture.mjs',import.meta.url),
 {type:'module',workerData:{mode}});
function open(mode='ready'){
 let created=0,worker;
 const terminal=[];
 const session=createWorkerLifecycleSession({
  ...input,trustedWorkerCtor:Worker,
  createWorker:()=>{created++;worker=workerFor(mode);return worker;},
 });
 session.subscribe(x=>terminal.push(x));
 return {session,terminal,get worker(){return worker;},get created(){return created;}};
}
const assertTerminal=(result,kind)=>{
 assert.equal(result.kind,kind);
 assert.equal(result.terminal,true);
 assert.equal(result.jobId,input.jobId);
 assert.equal(result.sourceRefId,input.sourceRefId);
 assert.equal(result.sourceRevision,input.sourceRevision);
 assert.equal(result.selectionDigest,input.selectionDigest);
};
test('U01 RED: cancel before START creates no Worker and publishes one terminal outcome',async()=>{
 const j=open('delayed');
 try{
 const cancelled=await j.session.cancel();
 assertTerminal(cancelled,'CANCELLED');
 assertTerminal(await j.session.start(),'CANCELLED');
 assert.strictEqual(await j.session.cancel(),cancelled,'cancel is idempotent');
 assert.equal(j.created,0);
 assert.deepEqual(j.terminal,[cancelled]);
 }finally{await j.worker?.terminate();}
});
test('U01 RED: cancel during pending native Worker READY closes native thread',async()=>{
 const j=open('delayed');
 try{
 const pending=j.session.start();
 assert.equal(j.created,1,'START creates exactly one platform Worker');
 const cancelled=await j.session.cancel();
 assertTerminal(cancelled,'CANCELLED');
 assertTerminal(await pending,'CANCELLED');
 assert.equal(j.worker.threadId,-1,'cancel awaits actual Worker termination');
 assert.strictEqual(await j.session.cancel(),cancelled);
 assert.deepEqual(j.terminal,[cancelled],'late READY or exit cannot publish twice');
 }finally{await j.worker?.terminate();}
});
test('U01 RED: cancel after real isolated READY terminates while preserving terminal once',async()=>{
 const j=open('ready');
 try{
  const admission=await j.session.start();
  assert.equal(admission.kind,'ADMITTED');
  assert.equal(admission.terminal,false);
  const result=await j.session.cancel();
  assertTerminal(result,'CANCELLED');
  assert.equal(j.worker.threadId,-1);
  assert.deepEqual(j.terminal,[result]);
  assert.strictEqual(await j.session.cancel(),result);
  assert.strictEqual(await j.session.start(),result,'no re-starting completed cancellation');
 }finally{await j.worker?.terminate();}
});
test('U01 RED: native Worker exits before READY cannot publish a successful job',async()=>{
 const j=open('exit');
 try{
  const terminal=await j.session.start();
  assertTerminal(terminal,'FAILED');
  assert.equal(j.worker.threadId,-1);
  assert.deepEqual(j.terminal,[terminal]);
  assert.strictEqual(await j.session.cancel(),terminal);
 }finally{await j.worker?.terminate();}
});
