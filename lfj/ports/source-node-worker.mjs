/** R10 native WorkerThreads entry: never run source scan in caller thread. */
import {isMainThread,parentPort} from 'node:worker_threads';
import {scanSourceInsideWorker,SOURCE_WORKER_SCHEMA,createSourcePageAckGate,receiveVerifiedSourceBytes} from './source-worker-port.mjs';

if(isMainThread||!parentPort)throw new Error('SOURCE_WORKER_REQUIRED');

let claimed=false;
const pageGate=createSourcePageAckGate(message=>parentPort.postMessage(message));
parentPort.on('message',async message=>{
  if(pageGate.receive(message))return;
  if(receiveVerifiedSourceBytes(message,value=>parentPort.postMessage(value)))return;
  if(claimed){
    parentPort.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'FAILED',
      jobId:message?.jobId,code:'WORKER_BUSY'});
    return;
  }
  claimed=true;
  try{
    const summary=await scanSourceInsideWorker(message,{
      publishPage:async rows=>pageGate.publish(rows,{jobId:message.jobId,sourceRefId:message.sourceRefId})
    });
    parentPort.postMessage({
      schema:SOURCE_WORKER_SCHEMA,kind:'SCAN_DONE',
      jobId:message.jobId,sourceRefId:message.sourceRefId,
      summary,workerThread:true
    });
  }catch(error){
    parentPort.postMessage({
      schema:SOURCE_WORKER_SCHEMA,kind:'FAILED',
      jobId:message?.jobId,sourceRefId:message?.sourceRefId,
      code:error?.code??'SOURCE_SCAN_FAILED'
    });
  }
});