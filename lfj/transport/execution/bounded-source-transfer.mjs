/**
 * LFJ R06/U02 — one outstanding original-source byte page per isolated Worker.
 * A transfer/ACK proves only byte delivery; it is not index completion or an
 * engineering-ready source, and U03 owns independently verified progress.
 */
import {WorkerExecutionError} from './required-worker.mjs';
const fail=(code,detail,options)=>{throw new WorkerExecutionError(code,detail,options);};
const valid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=1024;
const SCHEMA='LFJ.WorkerExecution.v1';
const MAX_PAGE_BYTES=65536;

export async function transferBoundedSourcePages({
  worker,trustedWorkerCtor,snapshot,jobId,sourceRefId,
  pageBytes=65536,ackTimeoutMs=5000,onConsumed=null,
}={}) {
  if(!snapshot||typeof snapshot.readRange!=='function'||
     !Number.isSafeInteger(snapshot.byteLength)||snapshot.byteLength<0||
     !valid(snapshot.revision)||!valid(snapshot.sha256)||
     !valid(jobId)||!valid(sourceRefId))
    fail('INVALID_SOURCE_JOB','R03 exact source and caller job identity required');
  if(!Number.isSafeInteger(pageBytes)||pageBytes<1||pageBytes>MAX_PAGE_BYTES||
     !Number.isSafeInteger(ackTimeoutMs)||ackTimeoutMs<1||ackTimeoutMs>30000)
    fail('TRANSFER_LIMIT','page and acknowledgement budgets invalid');
  if(onConsumed!==null&&typeof onConsumed!=='function')
    fail('INVALID_CONSUMPTION_SINK','onConsumed must be a synchronous callback when enabled');
  const trusted=trustedWorkerCtor??globalThis.Worker;
  if(typeof trusted!=='function')
    fail('WORKER_UNAVAILABLE','trusted isolated Worker constructor required');
  if(!(worker instanceof trusted)||
     typeof trusted.prototype?.postMessage!=='function'||
     typeof trusted.prototype?.terminate!=='function')
    fail('INVALID_WORKER_PORT','trusted native source Worker methods required');
  // Do not dispatch original bytes through overridable worker.postMessage:
  // an Object.create(Worker.prototype) imposter passes instanceof.
  const nativePost=trusted.prototype.postMessage;
  const nativeTerminate=trusted.prototype.terminate;
  const browser=typeof worker.addEventListener==='function'&&
    typeof worker.removeEventListener==='function';
  const node=typeof worker.on==='function'&&typeof worker.off==='function';
  if(!browser&&!node)fail('INVALID_WORKER_PORT','Worker message lifecycle unavailable');
  const subscribe=(kind,fn)=>browser?worker.addEventListener(kind,fn):worker.on(kind,fn);
  const unsubscribe=(kind,fn)=>browser?worker.removeEventListener(kind,fn):worker.off(kind,fn);
  const revision=snapshot.revision,sha=snapshot.sha256;
  let acknowledgedBytes=0,pages=0,maxUnacknowledgedBytes=0,workerConsumedBytes=0;
  try {
  for(let start=0;start<snapshot.byteLength;){
    const end=Math.min(snapshot.byteLength,start+pageBytes);
    const original=await snapshot.readRange(start,end,revision,pageBytes);
    if(!(original instanceof Uint8Array)||original.byteLength!==end-start)
      fail('SOURCE_BYTE_MISMATCH','source read did not match declared exact byte range');
    // This is the only in-flight source payload. Ownership of the ArrayBuffer
    // is transferred to the Worker; the next read waits for exact ACK.
    const pendingBytes=original.byteLength;
    maxUnacknowledgedBytes=Math.max(maxUnacknowledgedBytes,pendingBytes);
    await new Promise((resolve,reject)=>{
      let settled=false,acked=false,timer=null;
      const cleanup=()=>{
        clearTimeout(timer);
        unsubscribe('message',onMessage);
        unsubscribe('error',onError);
        if(node)unsubscribe('exit',onExit);
      };
      const finish=(error)=>{
        if(settled)return;
        settled=true;cleanup();
        if(error)reject(error);else resolve();
      };
      const onError=error=>finish(new WorkerExecutionError('WORKER_FAILED',
        'isolated source receiver reported failure',{cause:error?.error??error}));
      const onExit=()=>finish(new WorkerExecutionError('WORKER_FAILED',
        'isolated receiver exited before acknowledging original bytes'));
      const onMessage=event=>{
        const msg=browser?event?.data:event;
        const exact=msg&&msg.schema===SCHEMA&&
          msg.jobId===jobId&&msg.sourceRefId===sourceRefId&&
          msg.sourceRevision===revision&&msg.sourceSha256===sha&&
          msg.startByte===start&&msg.endByteExclusive===end;
        if(!exact){
          finish(new WorkerExecutionError('WORKER_PROTOCOL',
            'Worker report does not match exact original source page'));
          return;
        }
        if(msg.kind==='SOURCE_ACK'&&!acked&&msg.receivedBytes===pendingBytes){
          acked=true;
          if(!onConsumed){finish(null);return;}
          // Transport ACK is not proof of source-byte consumption. Retain
          // exactly this page in flight until the trusted Worker processes it.
          clearTimeout(timer);
          timer=setTimeout(()=>finish(new WorkerExecutionError('WORKER_CONSUME_TIMEOUT',
            'Worker acknowledged transport but never reported consumed source bytes')),
            ackTimeoutMs);
          return;
        }
        if(msg.kind==='SOURCE_CONSUMED'&&onConsumed&&acked&&
           msg.consumedBytes===end&&Number.isSafeInteger(msg.pageChecksum)&&
           msg.pageChecksum>=0&&msg.pageChecksum<=0xffffffff){
          const report=Object.freeze({
            schema:'LFJ.WorkerConsumedSourceProgress.v1',
            jobId,sourceRefId,sourceRevision:revision,sourceSha256:sha,
            byteLength:snapshot.byteLength,consumedBytes:end,
            pageChecksum:msg.pageChecksum,complete:false,engineeringReady:false,
          });
          try {
            const callbackResult=onConsumed(report);
            if(callbackResult&&typeof callbackResult.then==='function')
              fail('CONSUMPTION_CALLBACK_ASYNC','progress callback must be synchronous');
          }catch(error){
            finish(new WorkerExecutionError('CONSUMPTION_CALLBACK_FAILED',
              'Worker-consumption progress observer failed',{cause:error}));
            return;
          }
          workerConsumedBytes=end;
          finish(null);
          return;
        }
        finish(new WorkerExecutionError('WORKER_PROTOCOL',
          'Worker ACK/consumption sequence or consumed byte offset was invalid'));
      };
      subscribe('message',onMessage);
      subscribe('error',onError);
      if(node)subscribe('exit',onExit);
      timer=setTimeout(()=>finish(new WorkerExecutionError('WORKER_ACK_TIMEOUT',
        'source page was not acknowledged before deadline')),ackTimeoutMs);
      try{
        nativePost.call(worker,{
          schema:SCHEMA,kind:'SOURCE_PAGE',jobId,sourceRefId,
          sourceRevision:revision,sourceSha256:sha,startByte:start,
          endByteExclusive:end,bytes:original,
        },[original.buffer]);
      }catch(error){
        finish(new WorkerExecutionError(error instanceof TypeError?
          'INVALID_WORKER_PORT':'WORKER_FAILED',
          'trusted native source Worker rejected byte transfer',{cause:error}));
      }
    });
    acknowledgedBytes=end;start=end;pages++;
  }
  } catch(error) {
    // Any source/ACK/protocol/consumer failure invalidates the entire
    // transport job; no stale Worker can receive another page or be reused.
    // Native terminate() returns a Promise; browser terminate() is void.
    try{await nativeTerminate.call(worker);}catch { /* Preserve original typed cause. */ }
    throw error;
  }
  return Object.freeze({
    schema:'LFJ.SourceTransferReceipt.v1',jobId,sourceRefId,
    sourceSha256:sha,sourceRevision:revision,
    byteLength:snapshot.byteLength,acknowledgedBytes,pages,
    maxUnacknowledgedBytes,
    ...(onConsumed?{workerConsumedBytes}:{}),
    complete:false,engineeringReady:false,
    rightsBasis:'SOURCE_TRANSPORT_ONLY',
  });
}
