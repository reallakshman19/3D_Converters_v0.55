// Genuine Node Worker fixture; one native thread per independently-owned R07 job.
import {parentPort,workerData} from 'node:worker_threads';
parentPort.on('message',message=>{
 if(message?.schema==='LFJ.WorkerExecution.v1'&&message.kind==='SOURCE_PAGE'){
   const {bytes,...source}=message;
   if(!(bytes instanceof Uint8Array))return;
   let checksum=0;for(const byte of bytes)checksum=(checksum+byte)>>>0;
   parentPort.postMessage({...source,kind:'SOURCE_ACK',receivedBytes:bytes.length});
   parentPort.postMessage({...source,kind:'SOURCE_CONSUMED',
     consumedBytes:source.endByteExclusive,pageChecksum:checksum});
   return;
 }
 if(message?.schema!=='LFJ.WorkerExecution.v1'||message.kind!=='START')return;
 if(workerData?.mode==='exit'){process.exit(13);return;}
 const ready=()=>{
   parentPort.postMessage({...message,kind:'READY',
     isMainThread:false});
 };
 if(workerData?.mode==='delayed')setTimeout(ready,400);
 else if(workerData?.mode==='after-ready-exit'){
   ready();
   parentPort.postMessage({...message,kind:'PROVISIONAL_SOURCE_PAGE',
     pageOrdinal:0,complete:false,engineeringReady:false});
   setTimeout(()=>process.exit(17),110);
 } else if(workerData?.mode==='after-ready-error'){
   ready();
   parentPort.postMessage({...message,kind:'PROVISIONAL_SOURCE_PAGE',
     pageOrdinal:0,complete:false,engineeringReady:false});
   setTimeout(()=>{throw new Error('R07 native worker crashed after provisional page');},110);
 } else if(workerData?.mode==='forged-complete'){
   ready();
   parentPort.postMessage({...message,kind:'PROVISIONAL_SOURCE_PAGE',
     pageOrdinal:0,complete:false,engineeringReady:false});
   parentPort.postMessage({...message,kind:'INDEX_COMPLETE',complete:true,engineeringReady:true});
 } else ready();
});
