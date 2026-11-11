// V4.2 async durable R07 acceptance: REAL native R06 and R05 receipts, RED first.
// The original beginIndexTransaction().commit() synchronous API must remain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../../index/source-occurrence-index.mjs';
import {transferBoundedSourcePages} from '../execution/bounded-source-transfer.mjs';
import {createWorkerLifecycleSession} from './lifecycle-session.mjs';

function fixture(){
 const raw=new TextEncoder().encode('[{"type":"BRANCH","name":"A"},{"type":"BRANCH","name":"B"}]');
 const builder=createSourceSnapshotBuilder({byteLength:raw.length,revision:'V42-ORIGINAL'});
 builder.append(raw,0);const source=builder.finalize();
 let worker,stage=[],rollbacks=0,commits=0,release,reject;
 const gate=new Promise((yes,no)=>{release=yes;reject=no;});
 const session=createWorkerLifecycleSession({
  jobId:'V42-NATIVE',sourceRefId:'V42-SRC',sourceSha256:source.sha256,
  sourceRevision:source.revision,byteLength:source.byteLength,selectionDigest:'all',
  trustedWorkerCtor:Worker,
  createWorker:()=>{worker=new Worker(new URL('./lifecycle-worker-fixture.mjs',import.meta.url),
    {type:'module',workerData:{mode:'ready'}});return worker;}
 });
 const stager={
  stagePage:async rows=>{stage.push(...rows);},
  commit:()=>{throw Error('old sync path cannot be used for durable storage');},
  commitDurably:async manifest=>{commits++;await gate;return manifest;},
  abort:()=>{rollbacks++;stage=[];}
 };
 async function prepare(){
  assert.equal((await session.start()).kind,'ADMITTED');
  const tx=session.beginIndexTransaction(stager);
  const summary=await streamJsonOccurrenceEvents(source,{
   sourceRefId:'V42-SRC',pageEvents:2,onEventPage:tx.onEventPage
  });
  const receipt=await transferBoundedSourcePages({
   worker,trustedWorkerCtor:Worker,snapshot:source,
   jobId:'V42-NATIVE',sourceRefId:'V42-SRC',pageBytes:10,onConsumed:()=>{}
  });
  assert.equal(receipt.workerConsumedBytes,source.byteLength);
  return{tx,summary,receipt};
 }
 return{source,session,stager,prepare,get commits(){return commits;},
  get rollbacks(){return rollbacks;},release,reject,
  close:async()=>{release();await worker?.terminate();source.close();}};
}

test('V4.2/U01 RED: SOURCE_INDEX_COMPLETE waits for real asynchronous durable storage commit',async()=>{
 const j=fixture();
 try{
  const {tx,summary,receipt}=await j.prepare();
  const promise=tx.commitDurably(summary,receipt);
  assert.equal(j.session.snapshot().kind,'ADMITTED',
    'R07 cannot authorize source index before IDB transaction complete');
  assert.equal(j.commits,1);
  j.release();
  const done=await promise;
  assert.equal(done.kind,'SOURCE_INDEX_COMPLETE');
  assert.equal(done.sourceIndexReady,true);
  assert.equal(done.engineeringReady,false);
 }finally{await j.close();}
});

test('V4.2/U02 RED: cancel while durable commit pending never resurrects terminal',async()=>{
 const j=fixture();
 try{
  const {tx,summary,receipt}=await j.prepare();
  const promise=tx.commitDurably(summary,receipt);
  assert.equal(j.session.snapshot().kind,'ADMITTED');
  await j.session.cancel();
  assert.equal(j.session.snapshot().kind,'CANCELLED');
  j.release();
  await assert.rejects(promise,e=>e?.code==='INDEX_JOB_STALE'||e?.code==='INDEX_ALREADY_TERMINAL');
  assert.equal(j.session.snapshot().kind,'CANCELLED');
  assert.ok(j.rollbacks>0);
 }finally{await j.close();}
});

test('V4.2/U02 RED: invalid R06 receipt must fail before durable backend publishes any head',async()=>{
 const j=fixture();
 try{
  const {tx,summary,receipt}=await j.prepare();
  await assert.rejects(()=>tx.commitDurably(summary,{...receipt,workerConsumedBytes:0}),
    e=>e?.code==='INDEX_TRANSPORT_UNVERIFIED');
  assert.equal(j.commits,0);
  assert.equal(j.session.snapshot().kind,'FAILED');
  assert.ok(j.rollbacks>0);
 }finally{await j.close();}
});

test('V4.2/U02 RED: rejected async IndexedDB commit never emits complete source index',async()=>{
 const j=fixture();
 try{
  const {tx,summary,receipt}=await j.prepare();
  const promise=tx.commitDurably(summary,receipt);
  j.reject(new Error('simulated IndexedDB transaction abort after request success'));
  await assert.rejects(promise);
  assert.equal(j.session.snapshot().kind,'FAILED');
  assert.equal(j.session.snapshot().sourceIndexReady,false);
  assert.ok(j.rollbacks>0);
 }finally{await j.close();}
});
