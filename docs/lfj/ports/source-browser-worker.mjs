/** Actual browser Worker module. This file MUST run in WorkerGlobalScope. */
import {scanSourceInsideWorker,SOURCE_WORKER_SCHEMA,createSourcePageAckGate,receiveVerifiedSourceBytes} from './source-worker-port.mjs';
if(typeof WorkerGlobalScope==='undefined'||!(self instanceof WorkerGlobalScope))
  throw new Error('SOURCE_WORKER_REQUIRED');
let claimed=false;
const pageGate=createSourcePageAckGate(message=>self.postMessage(message));
self.addEventListener('message',async event=>{
  const message=event.data;
  if(pageGate.receive(message))return;
  if(receiveVerifiedSourceBytes(message,value=>self.postMessage(value)))return;
  if(claimed){
    self.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'FAILED',
      jobId:message?.jobId,code:'WORKER_BUSY'});
    return;
  }
  claimed=true;
  try{
    const summary=await scanSourceInsideWorker(message,{
      publishPage:async rows=>pageGate.publish(rows,{jobId:message.jobId,sourceRefId:message.sourceRefId})
    });
    self.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'SCAN_DONE',
      jobId:message.jobId,sourceRefId:message.sourceRefId,
      summary,workerGlobal:true});
  }catch(error){
    self.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'FAILED',
      jobId:message?.jobId,sourceRefId:message?.sourceRefId,
      code:error?.code??'SOURCE_SCAN_FAILED'});
  }
});