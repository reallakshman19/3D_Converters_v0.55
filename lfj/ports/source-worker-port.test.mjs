// LFJ R10/U01-U02 independent REAL native Worker, RED before product.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {createSourcePageAckGate} from './source-worker-port.mjs';
const original='[{"label":"A","a/b~":"μ","children":[{"label":"A"}]}]';
const expectedPaths=['','/0','/0/label','/0/a~1b~0','/0/children','/0/children/0','/0/children/0/label'];
async function inNativeWorker(json=original){
  const raw=new TextEncoder().encode(json);
  const blob=new Blob([raw],{type:'application/json'});
  const expectedSha256=createHash('sha256').update(raw).digest('hex');
  const worker=new Worker(new URL('./source-node-worker.mjs',import.meta.url),{type:'module'});
  let done=false,pages=[];
  try{
    assert.ok(worker.threadId>0,'a real native worker thread, not a foreground callback');
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('native Worker source scan timed out')),15000);
      worker.on('message',message=>{
        if(message?.kind==='PROVISIONAL_PAGE'){
          if(message.schema!=='LFJ.CrossRuntimeSourcePort.v1'||message.rows?.length>2){
            clearTimeout(timer);reject(new Error('invalid original-source page'));return;
          }
          pages.push(...message.rows);
          worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',
            kind:'PAGE_ACK',jobId:'R10-NODE-JOB',
            sourceRefId:'SOURCE-ORIGINAL',sequence:message.sequence});
          return;
        }
        if(message?.kind==='SCAN_DONE'||message?.kind==='FAILED'){
          done=true;clearTimeout(timer);resolve(message);
        }
      });
      worker.on('error',e=>{clearTimeout(timer);reject(e);});
      worker.on('exit',code=>{if(!done){clearTimeout(timer);reject(new Error('worker exited '+code));}});
      worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',
        kind:'SCAN',jobId:'R10-NODE-JOB',sourceRefId:'SOURCE-ORIGINAL',
        revision:'source-one',blob,expectedSha256,pageEvents:2});
    });
    return {result,pages,expectedSha256};
  }finally{await worker.terminate();}
}
test('R10/U01 RED: exact original Blob digest in a genuine Node Worker equals independent SHA256',async()=>{
 const {result,pages,expectedSha256}=await inNativeWorker();
 assert.equal(result.kind,'SCAN_DONE');
 assert.equal(result.summary.sourceSha256,expectedSha256);
 assert.equal(result.summary.rightsBasis,'SOURCE_FACTS_ONLY');
 assert.equal(result.summary.engineeringReady,false);
 assert.equal(result.summary.complete,true);
 assert.ok(pages.length>0);
});
test('R10/U02 RED: all nested source occurrences and escaped RFC6901 pointers come from worker, no clipping',async()=>{
 const {result,pages}=await inNativeWorker();
 assert.equal(result.kind,'SCAN_DONE');
 const opens=pages.filter(e=>e.kind==='OPEN');
 assert.deepEqual(opens.map(x=>x.path),expectedPaths);
 assert.equal(result.summary.occurrenceCount,expectedPaths.length);
 assert.equal(pages.filter(x=>x.kind==='SEAL').length,expectedPaths.length);
 assert.equal(pages.length,result.summary.eventCount);
 assert.equal(result.summary.engineeringReady,false);
});
test('R10/U01 RED: equal-length changed original Blob content gives different source identity',async()=>{
 const x=original.replace('"label":"A"','"label":"B"');
 assert.equal(new TextEncoder().encode(x).length,new TextEncoder().encode(original).length);
 const a=await inNativeWorker(),b=await inNativeWorker(x);
 assert.equal(a.result.kind,'SCAN_DONE');
 assert.equal(b.result.kind,'SCAN_DONE');
 assert.notEqual(a.result.summary.sourceSha256,b.result.summary.sourceSha256);
 assert.notEqual(a.result.summary.sourceRevision,b.result.summary.sourceRevision);
});
test('R10/U04 RED: invalid JSON cannot become a complete source-index receipt',async()=>{
 const {result}=await inNativeWorker('[{"x":}');
 assert.equal(result.kind,'FAILED');
 assert.notEqual(result.summary?.complete,true);
 assert.ok(result.code);
});

test('R10/U04 semantic RED: native Worker pauses with ONE unacknowledged source event page',async()=>{
 const worker=new Worker(new URL('./source-node-worker.mjs',import.meta.url),{type:'module'});
 let pages=0,completed=false,resolvePage;
 const firstPage=new Promise(resolve=>{resolvePage=resolve;});
 try{
   worker.on('message',m=>{
     if(m?.kind==='PROVISIONAL_PAGE'){
       pages++;
       if(pages===1)resolvePage();
     }
     if(m?.kind==='SCAN_DONE')completed=true;
   });
   worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'SCAN',
     jobId:'R10-NO-ACK',sourceRefId:'SOURCE-ORIGINAL',revision:'source-one',
     blob:new Blob([new TextEncoder().encode(original)]),pageEvents:2});
   await Promise.race([firstPage,new Promise((_,reject)=>
     setTimeout(()=>reject(new Error('real Worker never emitted first page')),5000))]);
   await new Promise(resolve=>setTimeout(resolve,250));
   assert.equal(pages,1,'bounded batches alone are insufficient: Worker must await PAGE_ACK');
   assert.equal(completed,false,'no complete source claim before receiver has staged all pages');
 }finally{await worker.terminate();}
});

test('R10/U04 semantic RED: a large valid R05 event batch is split into <=1MiB native Worker wire pages',async()=>{
 const suffix='K'.repeat(14000);
 const obj=Object.fromEntries(Array.from({length:32},(_,i)=>['key'+i+'_'+suffix,'v']));
 const raw=new TextEncoder().encode(JSON.stringify(obj));
 const expectedSha256=createHash('sha256').update(raw).digest('hex');
 const worker=new Worker(new URL('./source-node-worker.mjs',import.meta.url),{type:'module'});
 let pages=0,events=0,largestWire=0;
 try{
   const result=await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(new Error('long-key native Worker scan timed out')),60000);
     worker.on('error',e=>{clearTimeout(timer);reject(e);});
     worker.on('message',message=>{
       if(message?.kind==='PROVISIONAL_PAGE'){
         pages++;
         events+=message.rows.length;
         const wireBytes=new TextEncoder().encode(JSON.stringify(message)).byteLength;
         largestWire=Math.max(largestWire,wireBytes);
         worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'PAGE_ACK',
           jobId:'R10-LONG-KEY',sourceRefId:'LONG-SOURCE',sequence:message.sequence});
       }else if(message?.kind==='SCAN_DONE'||message?.kind==='FAILED'){
         clearTimeout(timer);resolve(message);
       }
     });
     worker.postMessage({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'SCAN',
       jobId:'R10-LONG-KEY',sourceRefId:'LONG-SOURCE',revision:'long-source',
       blob:new Blob([raw]),expectedSha256,pageEvents:4096});
   });
   assert.equal(result.kind,'SCAN_DONE');
   assert.equal(result.summary.sourceSha256,expectedSha256);
   assert.equal(result.summary.occurrenceCount,33);
   assert.equal(events,66,'no OPEN/SEAL facts silently clipped by transport');
   assert.ok(pages>=2,'one large valid source event batch needs multiple bounded wire messages');
   assert.ok(largestWire<=1048576,'entire serialized Worker message must be bounded');
 }finally{await worker.terminate();}
});

test('R10/U04: wrong-source ACK cannot release a pending native Worker page',async()=>{
 let wire;
 const gate=createSourcePageAckGate(x=>{wire=x;},{timeoutMs:1000});
 const pending=gate.publish([{kind:'OPEN'}],{jobId:'R10-JOB',sourceRefId:'R10-FILE'});
 assert.equal(wire.sequence,0);
 gate.receive({schema:'LFJ.CrossRuntimeSourcePort.v1',kind:'PAGE_ACK',
   jobId:'OTHER-JOB',sourceRefId:'R10-FILE',sequence:0});
 await assert.rejects(pending,e=>e?.code==='PAGE_ACK_MISMATCH');
});
