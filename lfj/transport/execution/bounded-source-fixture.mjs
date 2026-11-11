// TEST-ONLY R06/U02 native isolated source transport ACK oracle.
import {parentPort,workerData,isMainThread} from 'node:worker_threads';
if(!parentPort||isMainThread)throw new Error('fixture must be a real Worker');
parentPort.on('message',message=>{
  if(message?.schema!=='LFJ.WorkerExecution.v1')return;
  if(message.kind==='START'){
    parentPort.postMessage({...message,kind:'READY',isMainThread:false});return;
  }
  if(message.kind!=='SOURCE_PAGE')return;
  const {jobId,sourceRefId,sourceRevision,sourceSha256,startByte,endByteExclusive,bytes}=message;
  if(workerData?.mode==='no-ack')return;
  const send=()=>parentPort.postMessage({
    schema:'LFJ.WorkerExecution.v1',kind:'SOURCE_ACK',
    jobId,sourceRefId,sourceRevision,sourceSha256,startByte,endByteExclusive,
    receivedBytes:bytes?.byteLength,
  });
  if(workerData?.delayMs)setTimeout(send,workerData.delayMs);
  else send();
});
