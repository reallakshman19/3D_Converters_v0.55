// R06 U02 independent RED before bounded source-transfer implementation.
// Node-only oracle uses a real Worker, not shape-only stubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {runRequiredWorkerJob} from './required-worker.mjs';
import {transferBoundedSourcePages} from './bounded-source-transfer.mjs';

function source(length=130071){
 const bytes=new Uint8Array(length);
 for(let i=0;i<length;i++)bytes[i]=i%251;
 const builder=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'R06-u02-original'});
 builder.append(bytes,0);
 const snapshot=builder.finalize(),reads=[];
 return {bytes,snapshot,reads,port:Object.freeze({
   ...snapshot,
   readRange(start,end,revision,cap){
     reads.push(Object.freeze({start,end,length:end-start}));
     return snapshot.readRange(start,end,revision,cap);
   },
 })};
}
async function openWorker(snapshot,mode='ack',delayMs=0){
 const worker=new Worker(new URL('./bounded-source-fixture.mjs',import.meta.url),{
   type:'module',workerData:{mode,delayMs},
 });
 await runRequiredWorkerJob({
   createWorker:()=>worker,trustedWorkerCtor:Worker,
   jobId:'R06-U02',sourceRefId:'PL01',
   sourceRevision:snapshot.revision,sourceSha256:snapshot.sha256,
   byteLength:snapshot.byteLength,
 });
 return worker;
}

test('U02 RED: true Worker ACK gates each original byte page with one page maximum in flight',async()=>{
 const {snapshot,port,reads}=source(130071);
 let worker;
 try{
  worker=await openWorker(snapshot,'ack',25);
  const result=await transferBoundedSourcePages({
    worker,trustedWorkerCtor:Worker,snapshot:port,jobId:'R06-U02',sourceRefId:'PL01',
    pageBytes:16384,ackTimeoutMs:2500,
  });
  assert.equal(result.schema,'LFJ.SourceTransferReceipt.v1');
  assert.equal(result.complete,false,'transfer is not an accepted source index');
  assert.equal(result.engineeringReady,false);
  assert.equal(result.sourceSha256,snapshot.sha256);
  assert.equal(result.sourceRevision,snapshot.revision);
  assert.equal(result.acknowledgedBytes,snapshot.byteLength);
  assert.equal(result.pages,8);
  assert.ok(result.maxUnacknowledgedBytes<=16384);
  assert.equal(reads.length,8);
  assert.ok(reads.every(r=>r.length>0&&r.length<=16384));
  assert.deepEqual(reads.map(r=>r.start),[0,16384,32768,49152,65536,81920,98304,114688]);
  assert.equal(reads.at(-1).end,130071);
 }finally{await worker?.terminate();snapshot.close();}
});

test('U02 RED: slow/no-ACK Worker may receive ONE original page, not unlimited queued pages',async()=>{
 const {snapshot,port,reads}=source(130071);
 let worker;
 try{
  worker=await openWorker(snapshot,'no-ack');
  await assert.rejects(()=>transferBoundedSourcePages({
    worker,trustedWorkerCtor:Worker,snapshot:port,jobId:'R06-U02',sourceRefId:'PL01',
    pageBytes:16384,ackTimeoutMs:200,
  }),e=>e?.code==='WORKER_ACK_TIMEOUT');
  assert.equal(reads.length,1,'do not read the second page before first ACK');
  assert.deepEqual(reads[0],{start:0,end:16384,length:16384});
 }finally{await worker?.terminate();snapshot.close();}
});
