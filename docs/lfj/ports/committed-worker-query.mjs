/**
 * R10 U03: cross-runtime R06/R07 source-index admission to R08/R09 paging.
 * The caller MUST inject independently qualified atomic index/selected stores.
 * No default in-memory fallback, no durable-browser-store or export assertion.
 */
import {openBlobSourceSnapshot} from '../source/source-snapshot.mjs';
import {createWorkerLifecycleSession} from '../transport/lifecycle/lifecycle-session.mjs';
import {transferBoundedSourcePages} from '../transport/execution/bounded-source-transfer.mjs';
import {selectCommittedOccurrences} from '../query/selection/exact-occurrence-selection.mjs';
import {createCommittedSelectionPager} from '../query/pages/committed-selection-pages.mjs';
import {SOURCE_WORKER_SCHEMA} from './source-worker-port.mjs';

const fail=(code,detail)=>{const e=new Error(detail);e.code=code;throw e;};
const hasMethods=(x,names)=>x&&names.every(k=>typeof x[k]==='function');

/** Attested scanner listens to the SAME genuine native Worker as R06/R07. */
async function receiveWorkerScan(worker,trusted,job,blob,sha,tx,pageEvents,timeoutMs){
 const browser=typeof worker.addEventListener==='function';
 if(!browser&&!(typeof worker.on==='function'&&typeof worker.off==='function'))
   fail('WORKER_PORT_REQUIRED','native worker event subscription required');
 return new Promise((resolve,reject)=>{
  let ended=false,sequence=0;
  const remove=(name,fn)=>browser?worker.removeEventListener(name,fn):worker.off(name,fn);
  const add=(name,fn)=>browser?worker.addEventListener(name,fn):worker.on(name,fn);
  const close=(error,summary)=>{
   if(ended)return;
   ended=true;clearTimeout(timer);
   remove('message',onMessage);remove('error',onError);
   if(!browser)remove('exit',onExit);
   if(error)reject(error);else resolve(summary);
  };
  const timer=setTimeout(()=>close(Object.assign(new Error('Worker original scan not complete'),{
   code:'WORKER_SCAN_TIMEOUT'
  })),timeoutMs);
  const onError=()=>close(Object.assign(new Error('native Worker source scan failed'),{code:'WORKER_FAILED'}));
  const onExit=()=>close(Object.assign(new Error('Worker exited before source scan completion'),{code:'WORKER_FAILED'}));
  const onMessage=event=>{
   if(ended)return;
   const msg=browser?event?.data:event;
   if(!msg||msg.schema!==SOURCE_WORKER_SCHEMA)return;
   if(msg.jobId!==job.jobId||msg.sourceRefId!==job.sourceRefId)
    return close(Object.assign(new Error('wrong source Worker job identity'),{code:'WORKER_SCAN_IDENTITY'}));
   if(msg.kind==='PROVISIONAL_PAGE'){
    if(msg.sequence!==sequence++||!Array.isArray(msg.rows)||!msg.rows.length||
       msg.rows.length>pageEvents)
     return close(Object.assign(new Error('out-of-order source page'),{code:'WORKER_SCAN_ORDER'}));
    Promise.resolve().then(()=>tx.onEventPage(msg.rows)).then(()=>{
      if(ended)return;
      trusted.prototype.postMessage.call(worker,{
       schema:SOURCE_WORKER_SCHEMA,kind:'PAGE_ACK',
       jobId:job.jobId,sourceRefId:job.sourceRefId,sequence:msg.sequence
      });
    }).catch(e=>close(e));
   }else if(msg.kind==='FAILED'){
    close(Object.assign(new Error('Worker original scan refused: '+msg.code),{
      code:msg.code||'WORKER_SCAN_FAILED'
    }));
   }else if(msg.kind==='SCAN_DONE'){
    if(msg.summary?.sourceSha256!==sha||msg.summary?.sourceRefId!==job.sourceRefId||
       msg.summary?.sourceRevision!==job.sourceRevision)
      return close(Object.assign(new Error('Worker scan summary source mismatch'),{
       code:'WORKER_SCAN_IDENTITY'
      }));
    close(null,msg.summary);
   }
  };
  add('message',onMessage);add('error',onError);
  if(!browser)add('exit',onExit);
  try{trusted.prototype.postMessage.call(worker,{
    schema:SOURCE_WORKER_SCHEMA,kind:'SCAN',
    jobId:job.jobId,sourceRefId:job.sourceRefId,revision:job.revision,
    expectedSha256:sha,blob,pageEvents
  });}catch(e){close(Object.assign(e,{code:'WORKER_SCAN_DISPATCH'}));}
 });
}

/** No claim that a caller-provided storage port is persisted or crash-safe. */
export async function runCommittedSourceQuery({
 blob,revision,expectedSha256,sourceRefId,jobId,selectionDigest,
 selection,trustedWorkerCtor,createWorker,indexStore,selectedStore,
 getCurrentBasis,pageEvents=64,scanTimeoutMs=120000
}={}){
 if(typeof createWorker!=='function'||typeof trustedWorkerCtor!=='function'||
   !hasMethods(indexStore,['stagePage','commit','abort','readOrdered'])||
   !hasMethods(selectedStore,['stagePage','commit','abort','readRange'])||
   typeof jobId!=='string'||!jobId||typeof sourceRefId!=='string'||!sourceRefId||
   typeof selectionDigest!=='string'||!selectionDigest||
   !Number.isSafeInteger(pageEvents)||pageEvents<1||pageEvents>4096||
   !Number.isSafeInteger(scanTimeoutMs)||scanTimeoutMs<1000||scanTimeoutMs>300000)
   fail('SOURCE_PORT_REQUIRED','explicit Worker and two committed indexed store ports required');
 const source=await openBlobSourceSnapshot(blob,{revision,expectedSha256});
 const sourceBasis=Object.freeze({
  sourceRefId,sourceSha256:source.sha256,sourceRevision:source.revision
 });
 const job={...sourceBasis,jobId,byteLength:source.byteLength,selectionDigest,revision};
 if(typeof getCurrentBasis!=='function')fail('SOURCE_BASIS_ATTESTATION_REQUIRED','live source and selection basis callback required');
 const current=getCurrentBasis;
 let worker,session,tx,pager;
 try{
  session=createWorkerLifecycleSession({
   ...job, getCurrentBasis:current,trustedWorkerCtor,
   createWorker:()=>{worker=createWorker();return worker;}
  });
  const start=await session.start();
  if(start.kind!=='ADMITTED')fail(start.errorCode??'WORKER_UNAVAILABLE','native source Worker not admitted');
  const durableIndex=typeof indexStore.commitDurably==='function';
  tx=session.beginIndexTransaction({
   stagePage:p=>indexStore.stagePage(p),
   commit:summary=>indexStore.commit(summary),
   ...(durableIndex?{commitDurably:summary=>indexStore.commitDurably(summary)}:{}),
   abort:()=>indexStore.abort()
  });
  // Real original-byte transfer and consumption by the SAME Worker that parses.
  const receipt=await transferBoundedSourcePages({
   worker,trustedWorkerCtor,snapshot:source,jobId,sourceRefId,
   pageBytes:32768,onConsumed:()=>{}
  });
  const summary=await receiveWorkerScan(worker,trustedWorkerCtor,job,blob,source.sha256,
    tx,pageEvents,scanTimeoutMs);
  // Real IndexedDB is asynchronous: R07 may publish SOURCE_INDEX_COMPLETE
  // only AFTER transaction.complete. Existing synchronous stores retain their
  // independently qualified legacy R07 path unchanged.
  const completion=durableIndex
    ? await tx.commitDurably(summary,receipt)
    : tx.commit(summary,receipt);
  if(completion.kind!=='SOURCE_INDEX_COMPLETE')
   fail('SOURCE_INDEX_UNCOMMITTED','Worker source was not fully committed');
  const view={manifest:summary,completion,
   readOrdered:()=>indexStore.readOrdered()};
  pager=createCommittedSelectionPager({store:selectedStore,sourceBasis,
    selectionDigest,jobEpoch:jobId,getCurrentBasis:()=>current()});
  const selectionSummary=await selectCommittedOccurrences(view,{
   ...selection,sourceBasis,getCurrentBasis:()=>current()
  },{onSelectedPage:pager.stageSelectedPage,pageRows:64,maxPageBytes:1048576});
  const pageManifest=await pager.commitSelection(selectionSummary);
  const readPage=({cursor=null,maxRows=256,maxBytes=65536}={})=>
   pager.readPage({cursor,maxRows,maxBytes,sourceBasis,selectionDigest,jobEpoch:jobId});
  source.close();
  return Object.freeze({sourceBasis,summary,receipt,completion,selectionSummary,
    pageManifest,readPage,close:()=>session.dispose()});
 }catch(error){
  try{tx?.abort();}catch{}
  try{await pager?.abort();}catch{}
  try{await session?.cancel();}catch{}
  source.close();
  throw error;
 }
}
