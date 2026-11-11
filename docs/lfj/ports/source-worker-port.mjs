/**
 * R10: worker-side original-byte R03/R04/R05 source facts only.
 *
 * Only invoked by a concrete native Worker entrypoint. A returned R05 summary
 * is NOT R07 SOURCE_INDEX_COMPLETE and cannot authorize query/store/export.
 */
import {openBlobSourceSnapshot} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../index/source-occurrence-index.mjs';

export const SOURCE_WORKER_SCHEMA='LFJ.CrossRuntimeSourcePort.v1';
// Owner D-AIM-2 Option A (2026-10-12): both byte and original-value caps apply.
// The Worker must enforce the byte fence independently of untrusted UI checks.
export const O1_SOURCE_MAX_BYTES=100*1024*1024;

export async function scanSourceInsideWorker(message,{publishPage}={}) {
  if(message?.schema!==SOURCE_WORKER_SCHEMA||message.kind!=='SCAN'||
      typeof message.jobId!=='string'||!message.jobId||
      message.jobId.length>1024||
      typeof message.sourceRefId!=='string'||!message.sourceRefId||
      message.sourceRefId.length>512||
      typeof message.revision!=='string'||!message.revision||
      !(message.blob instanceof Blob)||
      typeof publishPage!=='function') {
    const error=new Error('invalid Worker source scan request');
    error.code='SOURCE_PORT_INVALID';
    throw error;
  }
  // Reject oversized original Blob before hashing, parsing, or provisional pages.
  // No page, source commit, matching or CSV right can follow this exception.
  if(message.blob.size>O1_SOURCE_MAX_BYTES){
    const error=new Error('O1_SOURCE_BYTE_LIMIT');
    error.code='O1_SOURCE_BYTE_LIMIT';
    throw error;
  }
  const limit=message.pageEvents??256;
  if(!Number.isSafeInteger(limit)||limit<1||limit>4096){
    const error=new Error('event page limit outside supported range');
    error.code='PAGE_LIMIT';throw error;
  }
  const source=await openBlobSourceSnapshot(message.blob,{
    revision:message.revision,expectedSha256:message.expectedSha256
  });
  try {
    const encoder=new TextEncoder();
    const MAX_WIRE_BYTES=1048576;
    // A Worker message is {schema,kind,jobId,sourceRefId,sequence,rows}.
    // Reserve its EXACT JSON envelope at the maximum safe sequence integer.
    // R05's event-page JSON array then fills only the proven remaining bytes.
    const worstEnvelope=encoder.encode(JSON.stringify({
      schema:SOURCE_WORKER_SCHEMA,kind:'PROVISIONAL_PAGE',
      jobId:message.jobId,sourceRefId:message.sourceRefId,
      sequence:Number.MAX_SAFE_INTEGER,rows:[]
    })).byteLength;
    const pageBytes=MAX_WIRE_BYTES-worstEnvelope+2;
    if(pageBytes<2){
      const error=new Error('original Worker source identity exceeds page wire budget');
      error.code='SOURCE_EVENT_WIRE_LIMIT';throw error;
    }
    const publishBounded=async events=>{
      if(!Array.isArray(events)||events.length<1||events.length>limit){
        const error=new Error('R05 source page exceeded negotiated event count');
        error.code='SOURCE_PAGE_LIMIT';throw error;
      }
      // Revalidate the actual full postMessage shape before any ACK.
      // R05 has already admitted this page within the exact pageBytes cap;
      // no second buffering or after-the-fact transport fragmentation.
      const wire={
        schema:SOURCE_WORKER_SCHEMA,kind:'PROVISIONAL_PAGE',
        jobId:message.jobId,sourceRefId:message.sourceRefId,
        sequence:Number.MAX_SAFE_INTEGER,rows:events
      };
      if(encoder.encode(JSON.stringify(wire)).byteLength>MAX_WIRE_BYTES){
        const error=new Error('original R05 page exceeds whole Worker wire budget');
        error.code='SOURCE_PAGE_WIRE_LIMIT';throw error;
      }
      await publishPage(events);
    };
    const summary=await streamJsonOccurrenceEvents(source,{
      sourceRefId:message.sourceRefId,pageEvents:limit,pageBytes,
      sourceReadPageBytes:65536,
      onEventPage:publishBounded
    });
    return Object.freeze(summary);
  }finally{source.close();}
}


/**
 * One outstanding provisional event page maximum. Receiver ACK is an
 * application-store staging acknowledgment, NOT source-index commit.
 * Without ACK, scanning stalls and eventually fails closed.
 */
export function createSourcePageAckGate(post,{timeoutMs=5000}={}) {
  if(typeof post!=='function'||!Number.isSafeInteger(timeoutMs)||
      timeoutMs<100||timeoutMs>30000) {
    const error=new Error('invalid bounded page transport');
    error.code='PAGE_PORT_INVALID';throw error;
  }
  let pending=null,sequence=0;
  const reject=(code,detail)=>{
    const e=new Error(detail);e.code=code;return e;
  };
  return Object.freeze({
    async publish(rows,{jobId,sourceRefId}) {
      if(pending)throw reject('PAGE_BACKPRESSURE','prior source page has not been staged');
      const n=sequence++;
      return new Promise((resolve,rejectPromise)=>{
        const timer=setTimeout(()=>{
          pending=null;
          rejectPromise(reject('PAGE_ACK_TIMEOUT','source event page not acknowledged'));
        },timeoutMs);
        pending={n,jobId,sourceRefId,resolve,rejectPromise,timer};
        try {
          const wire={schema:SOURCE_WORKER_SCHEMA,kind:'PROVISIONAL_PAGE',
            jobId,sourceRefId,sequence:n,rows};
          if(new TextEncoder().encode(JSON.stringify(wire)).byteLength>1048576)
            throw reject('PAGE_WIRE_LIMIT','entire Worker message exceeded 1MiB');
          post(wire);
        }catch(e){
          clearTimeout(timer);pending=null;
          rejectPromise(reject('PAGE_POST_FAILED','native Worker could not post source page'));
        }
      });
    },
    receive(message) {
      if(message?.kind!=='PAGE_ACK')return false;
      const p=pending;
      if(!p)return true; // late ACK never resurrects a completed/failed page
      clearTimeout(p.timer);pending=null;
      if(message.schema!==SOURCE_WORKER_SCHEMA||
         message.jobId!==p.jobId||message.sourceRefId!==p.sourceRefId||
         message.sequence!==p.n){
        p.rejectPromise(reject('PAGE_ACK_MISMATCH','receiver ACK belongs to wrong source or page'));
      }else{
        p.resolve();
      }
      return true;
    }
  });
}


/** R06 genuine byte-consumption receiver inside the SAME source-scanning Worker.
 * Consumed source bytes are separately checked against R03 SHA by the R05
 * Worker scan, and R07 will verify the complete R06 receipt before commit.
 */
export function receiveVerifiedSourceBytes(message,post){
  if(message?.schema!=='LFJ.WorkerExecution.v1'||typeof post!=='function')return false;
  const {kind,jobId,sourceRefId,sourceSha256,sourceRevision}=message;
  if(typeof jobId!=='string'||!jobId||typeof sourceRefId!=='string'||!sourceRefId||
     typeof sourceSha256!=='string'||!sourceSha256||typeof sourceRevision!=='string'||!sourceRevision)
    return true;
  if(kind==='START'){
    post({...message,kind:'READY'});
    return true;
  }
  if(kind!=='SOURCE_PAGE')return true;
  const {startByte,endByteExclusive,bytes}=message;
  if(!(bytes instanceof Uint8Array)||
     !Number.isSafeInteger(startByte)||startByte<0||
     !Number.isSafeInteger(endByteExclusive)||endByteExclusive<=startByte||
     endByteExclusive-startByte!==bytes.length)return true;
  let checksum=0;
  for(const byte of bytes)checksum=(checksum+byte)>>>0;
  const {bytes:discard,...basis}=message;
  post({...basis,kind:'SOURCE_ACK',receivedBytes:bytes.length});
  post({...basis,kind:'SOURCE_CONSUMED',consumedBytes:endByteExclusive,pageChecksum:checksum});
  return true;
}
