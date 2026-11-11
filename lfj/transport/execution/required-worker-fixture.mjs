// TEST-ONLY native thread oracle. The production R06 port remains browser/API agnostic.
import {parentPort,threadId,isMainThread} from 'node:worker_threads';
if(!parentPort||isMainThread)throw new Error('fixture must execute outside parent main thread');
parentPort.on('message',message=>{
  if(message?.schema!=='LFJ.WorkerExecution.v1'||message?.kind!=='START')return;
  parentPort.postMessage({
    schema:'LFJ.WorkerExecution.v1',kind:'READY',
    jobId:message.jobId,sourceRefId:message.sourceRefId,
    sourceRevision:message.sourceRevision,sourceSha256:message.sourceSha256,
    byteLength:message.byteLength,isMainThread,threadId,
  });
});
