// R07/U02 positive complete R05 index commit and partial abort RED; independent original bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../../index/source-occurrence-index.mjs';
import {transferBoundedSourcePages} from '../execution/bounded-source-transfer.mjs';
import {createWorkerLifecycleSession} from './lifecycle-session.mjs';
function open(mode='ready'){
 const raw=new TextEncoder().encode('[{"type":"BRANCH","children":[{"type":"VALVE","name":"Ä"}]}]');
 const b=createSourceSnapshotBuilder({byteLength:raw.length,revision:'source-one'});
 b.append(raw,0);const source=b.finalize();let worker;
 const s=createWorkerLifecycleSession({jobId:'IDX-ONE',sourceRefId:'S',sourceSha256:source.sha256,
   sourceRevision:source.revision,byteLength:source.byteLength,selectionDigest:'all',
   trustedWorkerCtor:Worker,createWorker:()=>{worker=new Worker(
    new URL('./lifecycle-worker-fixture.mjs',import.meta.url),{type:'module',workerData:{mode}});return worker;}});
 const history={staged:[],committed:[],aborts:0};
 const stager={stagePage:async p=>{history.staged.push(...p);},
  commit:summary=>{history.committed.push(summary);},abort:()=>{history.aborts++;history.staged=[];}};
 return {source,s,history,stager,get worker(){return worker;},async close(){await worker?.terminate();source.close();}};
}
test('U02 RED: genuine complete R05 events + independently Worker-consumed R06 receipt commit ONCE',async()=>{
 const j=open();
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  const tx=j.s.beginIndexTransaction(j.stager);
  const summary=await streamJsonOccurrenceEvents(j.source,{sourceRefId:'S',onEventPage:tx.onEventPage,pageEvents:3});
  const receipt=await transferBoundedSourcePages({worker:j.worker,trustedWorkerCtor:Worker,
   snapshot:j.source,jobId:'IDX-ONE',sourceRefId:'S',pageBytes:16,onConsumed:()=>{}});
  assert.equal(receipt.workerConsumedBytes,j.source.byteLength);
  const accepted=tx.commit(summary,receipt);
  assert.equal(accepted.kind,'SOURCE_INDEX_COMPLETE');
  assert.equal(accepted.complete,true);
  assert.equal(accepted.engineeringReady,false);
  assert.equal(j.history.committed.length,1);
  assert.equal(j.history.committed[0].occurrenceCount,summary.occurrenceCount);
  assert.equal(j.history.staged.length,summary.eventCount);
  assert.equal(j.s.snapshot(),accepted);
  assert.throws(()=>tx.commit(summary,receipt),e=>e?.code==='INDEX_ALREADY_TERMINAL');
 }finally{await j.close();}
});
test('U02 RED: cancel after provisional R05 page aborts without index commit',async()=>{
 const j=open();
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  j.stager.stagePage=async p=>{j.history.staged.push(...p);await j.s.cancel();};
  const tx=j.s.beginIndexTransaction(j.stager);
  await assert.rejects(()=>streamJsonOccurrenceEvents(j.source,
   {sourceRefId:'S',onEventPage:tx.onEventPage,pageEvents:2}));
  assert.equal(j.s.snapshot().kind,'CANCELLED');
  assert.equal(j.history.committed.length,0);
  assert.ok(j.history.aborts>=1);
 }finally{await j.close();}
});
test('U02 RED: cancel during awaited page staging rolls back late provisional write',async()=>{
 const j=open();
 let entered,release;
 const inStage=new Promise(r=>entered=r),resume=new Promise(r=>release=r);
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  j.stager.stagePage=async p=>{entered();await resume;j.history.staged.push(...p);};
  const tx=j.s.beginIndexTransaction(j.stager);
  const scan=streamJsonOccurrenceEvents(j.source,{sourceRefId:'S',
    onEventPage:tx.onEventPage,pageEvents:1});
  await inStage;
  await j.s.cancel();
  release();
  await assert.rejects(scan);
  assert.deepEqual(j.history.staged,[],'late page cannot be left in provisional store after abort');
  assert.equal(j.history.committed.length,0);
 }finally{release?.();await j.close();}
});
test('U02 RED: native Worker crash after genuine provisional R05 pages aborts the index store',async()=>{
 const j=open('after-ready-exit');
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  const tx=j.s.beginIndexTransaction(j.stager);
  const complete=await streamJsonOccurrenceEvents(j.source,
   {sourceRefId:'S',onEventPage:tx.onEventPage,pageEvents:2});
  await new Promise(resolve=>j.worker.once('exit',resolve));
  assert.equal(j.s.snapshot().kind,'FAILED');
  assert.equal(j.history.committed.length,0);
  assert.ok(j.history.aborts>0);
  assert.deepEqual(j.history.staged,[]);
  assert.throws(()=>tx.commit(complete,{}),e=>e?.code==='INDEX_ALREADY_TERMINAL');
 }finally{await j.close();}
});
test('U02 RED: async index sink error permanently fails Worker job and aborts provisional store',async()=>{
 const j=open();
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  j.stager.stagePage=async p=>{j.history.staged.push(...p);throw new Error('storage rejected page');};
  const tx=j.s.beginIndexTransaction(j.stager);
  await assert.rejects(()=>streamJsonOccurrenceEvents(j.source,
    {sourceRefId:'S',onEventPage:tx.onEventPage,pageEvents:2}),/storage rejected page/);
  assert.equal(j.s.snapshot().kind,'FAILED','sink rejection cannot leave admitted job alive');
  assert.equal(j.s.snapshot().engineeringReady,false);
  assert.equal(j.history.committed.length,0);
  assert.deepEqual(j.history.staged,[]);
  assert.ok(j.history.aborts>0);
 }finally{await j.close();}
});
test('U02 RED: malformed event page is a terminal protocol failure, never retry on same job',async()=>{
 const j=open();
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  const tx=j.s.beginIndexTransaction(j.stager);
  await assert.rejects(()=>tx.onEventPage([{kind:'OPEN',schema:'wrong'}]),
    e=>e?.code==='INDEX_PAGE_INVALID');
  assert.equal(j.s.snapshot().kind,'FAILED');
  assert.equal(j.history.committed.length,0);
  assert.ok(j.history.aborts>0);
 }finally{await j.close();}
});
test('U02 RED: rejected/incomplete source summary and ACK-only cannot commit',async()=>{
 const j=open();
 try{
  assert.equal((await j.s.start()).kind,'ADMITTED');
  const tx=j.s.beginIndexTransaction(j.stager);
  const summary=await streamJsonOccurrenceEvents(j.source,
   {sourceRefId:'S',onEventPage:tx.onEventPage,pageEvents:3});
  const bogus={schema:'LFJ.SourceTransferReceipt.v1',jobId:'IDX-ONE',sourceRefId:'S',
   sourceSha256:j.source.sha256,sourceRevision:j.source.revision,byteLength:j.source.byteLength,
   acknowledgedBytes:j.source.byteLength,pages:1,complete:false};
  assert.throws(()=>tx.commit(summary,bogus),e=>e?.code==='INDEX_TRANSPORT_UNVERIFIED');
  assert.equal(j.s.snapshot().kind,'FAILED','bad Worker receipt aborts this transaction permanently');
  assert.throws(()=>tx.commit({...summary,complete:false},bogus),e=>e?.code==='INDEX_ALREADY_TERMINAL');
  const completedReceipt={...bogus,workerConsumedBytes:j.source.byteLength};
  assert.throws(()=>tx.commit({...summary,eventCount:summary.eventCount-1},completedReceipt),
   e=>e?.code==='INDEX_ALREADY_TERMINAL');
  assert.equal(j.history.committed.length,0);
  await j.s.cancel();
  assert.ok(j.history.aborts>=1);
 }finally{await j.close();}
});
