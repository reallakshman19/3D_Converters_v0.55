// TEST-ONLY native R06/U03 consumer separates receipt of a page from
// actual Worker-side byte processing. No production parsing claim.
import {parentPort,workerData,isMainThread} from 'node:worker_threads';
if(!parentPort||isMainThread)throw new Error('Worker-only consumption fixture');
const pending=new Map();
const schema='LFJ.WorkerExecution.v1';
const consume=message=>{
  const {bytes,startByte,endByteExclusive,jobId,sourceRefId,sourceSha256,sourceRevision}=message;
  // Actually read every original byte in this real Worker before reporting
  // consumed progress. Test independently calculates the checksum.
  let pageChecksum=0;
  for(const b of bytes)pageChecksum=(pageChecksum+b)>>>0;
  parentPort.postMessage({
    schema,kind:'SOURCE_CONSUMED',jobId,sourceRefId,sourceSha256,sourceRevision,
    startByte,endByteExclusive,consumedBytes:
      workerData?.mode==='bad-range'?endByteExclusive+1:endByteExclusive,
    pageChecksum,
  });
};
parentPort.on('message',message=>{
  if(message?.schema!==schema)return;
  if(message.kind==='SOURCE_PAGE'){
    const {jobId,sourceRefId,sourceSha256,sourceRevision,startByte,endByteExclusive,bytes}=message;
    // ACK proves only transport delivery; bytes have NOT been examined yet.
    parentPort.postMessage({
      schema,kind:'SOURCE_ACK',jobId,sourceRefId,sourceSha256,sourceRevision,
      startByte,endByteExclusive,receivedBytes:bytes.byteLength,
    });
    if(workerData?.mode==='ack-only')return;
    if(workerData?.mode==='release'){
      pending.set(startByte,message);return;
    }
    setImmediate(()=>consume(message));
  }else if(message.kind==='CONSUME_NOW'){
    const page=pending.get(message.startByte);
    if(page){pending.delete(message.startByte);consume(page);}
  }
});
