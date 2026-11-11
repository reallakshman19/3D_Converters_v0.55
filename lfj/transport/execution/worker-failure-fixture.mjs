// R06/U04 test-only native Worker: malicious, failed, and stale source ports.
// This fixture is not a production worker and never interprets CII/engineering facts.
import {parentPort,workerData} from 'node:worker_threads';
const schema='LFJ.WorkerExecution.v1';
const mode=workerData?.mode;
parentPort.on('message',message=>{
  if(message?.schema!==schema)return;
  if(message.kind==='START'){
    if(mode==='exit-on-start'){process.exit(7);return;}
    if(mode==='ready-mismatch'){
      parentPort.postMessage({...message,kind:'READY',
        sourceRevision:'different:sha256:revision'});return;
    }
    parentPort.postMessage({...message,kind:'READY'});return;
  }
  if(message.kind!=='SOURCE_PAGE')return;
  if(mode==='no-ack')return;
  if(mode==='double-ack'){
    const ack={...message,kind:'SOURCE_ACK',receivedBytes:message.bytes.byteLength};
    parentPort.postMessage(ack);
    parentPort.postMessage(ack);
    return;
  }
  if(mode==='consumed-before-ack'){
    parentPort.postMessage({...message,kind:'SOURCE_CONSUMED',
      consumedBytes:message.endByteExclusive,pageChecksum:0});
    return;
  }
  if(mode==='exit-on-page'){process.exit(9);return;}
  if(mode==='wrong-ack'){
    parentPort.postMessage({...message,kind:'SOURCE_ACK',
      sourceSha256:'0'.repeat(64),receivedBytes:message.bytes.byteLength});return;
  }
  if(mode==='stale-ack'){
    parentPort.postMessage({...message,kind:'SOURCE_ACK',
      startByte:message.startByte+1,
      receivedBytes:message.bytes.byteLength});return;
  }
  if(mode==='ack-then-error'){
    parentPort.postMessage({...message,kind:'SOURCE_ACK',
      receivedBytes:message.bytes.byteLength});
    // Unexpected worker exit after transport receipt but before consumption.
    process.exit(11);return;
  }
  if(mode==='ack-then-consume'){
    parentPort.postMessage({...message,kind:'SOURCE_ACK',
      receivedBytes:message.bytes.byteLength});
    parentPort.postMessage({...message,kind:'SOURCE_CONSUMED',
      consumedBytes:message.endByteExclusive,pageChecksum:0});return;
  }
});
