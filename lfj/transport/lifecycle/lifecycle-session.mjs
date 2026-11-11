/** LFJ R07/U01: single-winner Worker admission/cancellation lifecycle.
 * Reuses R06 native Worker admission. No application/engineering interpretation
 * and no completed source/index/output authority is granted by READY.
 */
import {runRequiredWorkerJob,WorkerExecutionError} from '../execution/required-worker.mjs';

const valid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=1024;
const fail=(code,msg)=>{throw new WorkerExecutionError(code,msg);};

export function createWorkerLifecycleSession({
 jobId,sourceRefId,sourceSha256,sourceRevision,byteLength,selectionDigest,
 dependencyRevision,getCurrentBasis,createWorker,trustedWorkerCtor,
}={}){
 if(![jobId,sourceRefId,sourceSha256,sourceRevision,selectionDigest].every(valid)||
    !Number.isSafeInteger(byteLength)||byteLength<0||
    (dependencyRevision!==undefined&&!valid(dependencyRevision))||
    (getCurrentBasis!==undefined&&typeof getCurrentBasis!=='function'))
   fail('INVALID_LIFECYCLE_JOB','source/job and selection basis must be explicit');
 const basis=Object.freeze({jobId,sourceRefId,sourceSha256,sourceRevision,byteLength,
   selectionDigest,...(dependencyRevision===undefined?{}:{dependencyRevision})});
 // LFJ never infers XML/configuration semantics. The adapter supplies one
 // opaque effective dependency revision, plus the current source/selection.
 // Existing callers may omit getCurrentBasis but then MUST explicitly call
 // supersede() on edits; READY is not an accepted result or index commit.
 const REVISION_FIELDS=Object.freeze(['sourceRefId','sourceSha256','sourceRevision',
   'byteLength','selectionDigest','dependencyRevision']);
 const sameBasis=candidate=>candidate!==null&&typeof candidate==='object'&&
   REVISION_FIELDS.every(key=>candidate[key]===basis[key])&&
   // Older source callbacks omit run identity, but a supplied jobId is binding.
   (!Object.hasOwn(candidate,'jobId')||candidate.jobId===basis.jobId);
 const isCurrent=()=>{
   if(!getCurrentBasis)return true;
   try{return sameBasis(getCurrentBasis());}catch{return false;}
 };
 const listeners=new Set();
 const trusted=trustedWorkerCtor??globalThis.Worker;
 let worker=null,starting=null,terminal=null,termination=null,state='NEW',indexTx=null;
 let releaseWorkerWatch=()=>{};
 function notify(event){
   for(const listener of [...listeners]) {
     try{listener(event);}
     catch { /* Observer cannot change terminal truth or Worker cleanup. */ }
   }
   listeners.clear();
 }
 function finish(kind,errorCode){
   if(terminal)return terminal;
   state=kind;
   terminal=Object.freeze({
     schema:'LFJ.WorkerLifecycle.v1',...basis,kind,terminal:true,
     ...(errorCode?{errorCode}:{}),
     complete:kind==='SOURCE_INDEX_COMPLETE',engineeringReady:false,
     sourceIndexReady:kind==='SOURCE_INDEX_COMPLETE',rightsBasis:'SOURCE_FACTS_ONLY',
   });
   releaseWorkerWatch();
   if(kind!=='SOURCE_INDEX_COMPLETE')indexTx?.abort();
   notify(terminal);
   return terminal;
 }
 async function stopWorker(){
   if(!worker)return;
   if(!termination){
     termination=Promise.resolve().then(()=>{
       // Only the trusted native platform method can terminate a genuine
       // Worker; a same-thread Worker-shaped object may spoof terminate().
       if(typeof trusted!=='function'||typeof trusted.prototype?.terminate!=='function')
         fail('INVALID_WORKER_PORT','native Worker termination unavailable');
       return trusted.prototype.terminate.call(worker);
     });
   }
   try{await termination;}catch { /* Preserve already selected terminal state. */ }
 }
 // No provisional page/result is accepted from a stale source session.
 // A stale Worker is torn down; callbacks and late READY can never restore it.
 function markStale(){
   const result=finish('STALE','SOURCE_STALE');
   void stopWorker();
   return result;
 }
 // R06 observes START->READY only; R07 must continue watching the
 // actual Worker AFTER READY. A provisional page is never a commit.
 function watchWorker(){
   const onFailure=()=>{
     if(terminal)return;
     finish('FAILED','WORKER_FAILED');
     void stopWorker();
   };
   const browser=typeof worker?.addEventListener==='function'&&
     typeof worker?.removeEventListener==='function';
   const node=typeof worker?.on==='function'&&typeof worker?.off==='function';
   if(browser){
     worker.addEventListener('error',onFailure);
     worker.addEventListener('messageerror',onFailure);
     releaseWorkerWatch=()=>{
       worker.removeEventListener('error',onFailure);
       worker.removeEventListener('messageerror',onFailure);
     };
   }else if(node){
     worker.on('error',onFailure);
     worker.on('exit',onFailure);
     releaseWorkerWatch=()=>{
       worker.off('error',onFailure);
       worker.off('exit',onFailure);
     };
   }
 }
 function start(){
   if(terminal)return Promise.resolve(terminal);
   if(!isCurrent())return Promise.resolve(markStale());
   if(starting)return starting;
   if(state!=='NEW')return Promise.resolve(Object.freeze({...basis,kind:'ADMITTED',terminal:false}));
   if(typeof trusted!=='function'||typeof createWorker!=='function'){
     return Promise.resolve(finish('FAILED','WORKER_UNAVAILABLE'));
   }
   try{worker=createWorker();watchWorker();}
   catch{return Promise.resolve(finish('FAILED','WORKER_UNAVAILABLE'));}
   state='ADMITTING';
   starting=(async()=>{
     try{
       await runRequiredWorkerJob({
         ...basis,trustedWorkerCtor:trusted,createWorker:()=>worker,
       });
       if(terminal)return terminal; // e.g. cancel raced with READY
       // Admission can take hundreds of milliseconds; recheck the original
       // source, selection and caller-owned XML/config dependency at READY.
       if(!isCurrent()){
         const stale=markStale();
         await stopWorker();
         return stale;
       }
       state='ADMITTED';
       return Object.freeze({schema:'LFJ.WorkerLifecycle.v1',...basis,
         kind:'ADMITTED',terminal:false,complete:false,engineeringReady:false});
     }catch(error){
       if(terminal)return terminal;
       const result=finish('FAILED',error?.code||'WORKER_FAILED');
       await stopWorker();
       return result;
     }
   })();
   return starting;
 }
 async function cancel(){
   if(!terminal&&!isCurrent())markStale();
   const result=terminal||finish('CANCELLED');
   await stopWorker();
   return result;
 }
 function subscribe(listener){
   if(typeof listener!=='function')fail('INVALID_LIFECYCLE_SINK','listener must be a function');
   if(!terminal&&!isCurrent())markStale();
   if(terminal){listener(terminal);return ()=>{};}
   listeners.add(listener);
   return ()=>listeners.delete(listener);
 }
 function snapshot(){
   if(!terminal&&!isCurrent())markStale();
   return terminal||Object.freeze({schema:'LFJ.WorkerLifecycle.v1',...basis,
     kind:state,terminal:false,complete:false,engineeringReady:false});
 }
 // Explicit app-input replacement is the trusted fallback when the caller
 // cannot expose a getCurrentBasis() closure. It settles native termination
 // before returning the stale terminal, including while READY is pending.
 async function supersede(nextBasis){
   if(terminal)return terminal;
   if(!sameBasis(nextBasis)||!isCurrent()){
     const result=markStale();
     await stopWorker();
     return result;
   }
   return snapshot();
 }

 // An R05 page sink is PROVISIONAL until both genuine complete R05 summary
 // and complete R06 Worker-consumed byte receipt authorize the same transaction.
 // Storage commits are synchronous so a caller edit cannot interleave acceptance.
 function beginIndexTransaction({stagePage,commit,commitDurably,abort}={}){
   if(typeof stagePage!=='function'||typeof commit!=='function'||typeof abort!=='function')
     fail('INVALID_INDEX_STAGER','transaction requires stagePage, atomic commit and abort');
   if(indexTx)fail('INDEX_TRANSACTION_EXISTS','one staging transaction per job');
   if(snapshot().kind!=='ADMITTED')fail('INDEX_NOT_ADMITTED','trusted Worker admission required');
   let aborted=false,committed=false,committing=false,pending=0,events=0,opens=0,seals=0;
   const abortWaiters=[];
   const rollback=()=>{if(committed)return;aborted=true;
     // Re-abort after a pending async sink settles: it may have written AFTER
     // cancellation already cleared staging. Every abort must be idempotent.
     try{
       const pendingAbort=abort();
       if(pendingAbort&&typeof pendingAbort.then==='function'){
         const waiter=Promise.resolve(pendingAbort).catch(()=>{});
         abortWaiters.push(waiter);
       }
     }catch{/* never accept failed rollback */}};
   indexTx={abort:rollback};
   const rejectIndex=(code,reason)=>{
     rollback();
     if(!terminal){finish('FAILED',code);void stopWorker();}
     fail(code,reason);
   };
   const live=()=>{
     if(aborted||committed)fail('INDEX_ALREADY_TERMINAL','index transaction was settled');
     if(snapshot().kind!=='ADMITTED')fail('INDEX_JOB_STALE','source job no longer active');
   };
   async function onEventPage(page){
     live();
     if(committing)fail('INDEX_COMMITTING','no R05 event pages after beginning durable commit');
     if(!Array.isArray(page)||!page.length||page.length>4096||
       page.some(e=>e?.schema!=='LFJ.JSON.OccurrenceEvent.v1'||
         e.sourceRefId!==basis.sourceRefId||e.sourceSha256!==basis.sourceSha256||
         e.sourceRevision!==basis.sourceRevision||!['OPEN','SEAL'].includes(e.kind)))
       rejectIndex('INDEX_PAGE_INVALID','provisional original source occurrence page is invalid');
     pending++;
     try{
       await stagePage(page);
       live();
       events+=page.length;
       for(const event of page){if(event.kind==='OPEN')opens++;else seals++;}
     }catch(error){rollback();if(!terminal){finish('FAILED','INDEX_STAGING_FAILED');void stopWorker();}throw error;}
     finally{pending--;}
   }
   function verifyCompletion(summary,receipt){
     live();
     if(pending)fail('INDEX_STAGING_BUSY','source event sink has not settled');
     if(summary?.schema!=='LFJ.JSON.OccurrenceIndexSummary.v1'||summary.complete!==true)
       rejectIndex('INDEX_SUMMARY_INCOMPLETE','complete R05 source index summary required');
     if(summary.sourceRefId!==basis.sourceRefId||
       summary.sourceSha256!==basis.sourceSha256||summary.sourceRevision!==basis.sourceRevision||
       summary.byteLength!==basis.byteLength||summary.eventCount!==events||
       summary.occurrenceCount!==opens||opens!==seals)
       rejectIndex('INDEX_SOURCE_MISMATCH','complete source count and original identity differ');
     if(receipt?.schema!=='LFJ.SourceTransferReceipt.v1'||
       receipt.jobId!==basis.jobId||receipt.sourceRefId!==basis.sourceRefId||
       receipt.sourceSha256!==basis.sourceSha256||
       receipt.sourceRevision!==basis.sourceRevision||receipt.byteLength!==basis.byteLength||
       receipt.acknowledgedBytes!==basis.byteLength||
       receipt.workerConsumedBytes!==basis.byteLength)
       rejectIndex('INDEX_TRANSPORT_UNVERIFIED','native Worker-consumed original bytes not attested');
   }
   function commitIndex(summary,receipt){
     if(committing)fail('INDEX_COMMITTING','durable commit already in progress');
     verifyCompletion(summary,receipt);
     try{
       const result=commit(summary);
       if(result&&typeof result.then==='function')
         fail('INDEX_COMMIT_ASYNC','atomic final publish must be synchronous');
     }catch(error){
       rollback();finish('FAILED','INDEX_COMMIT_FAILED');void stopWorker();throw error;
     }
     committed=true;
     const complete=finish('SOURCE_INDEX_COMPLETE');
     void stopWorker();
     return complete;
   }
   // Opt-in durable acceptance: unlike commitIndex, the IDB head write must
   // settle its transaction.complete Promise BEFORE R07 grants read authority.
   async function commitIndexDurably(summary,receipt){
     if(typeof commitDurably!=='function')
       fail('INDEX_DURABLE_COMMIT_REQUIRED','explicit async durable store commit required');
     if(committing)fail('INDEX_COMMITTING','one durable commit admission per job');
     verifyCompletion(summary,receipt); // reject forged R05/R06 BEFORE DB publish
     committing=true;
     try{
       const durablyCommitted=commitDurably(summary);
       if(!durablyCommitted||typeof durablyCommitted.then!=='function')
         fail('INDEX_DURABILITY_REQUIRED','durable transaction must expose completion Promise');
       await durablyCommitted;
       live(); // cancellation, source edits or Worker exit can supersede the wait
       committed=true;
       const accepted=finish('SOURCE_INDEX_COMPLETE');
       void stopWorker();
       return accepted;
     }catch(error){
       if(!committed){
         rollback();
         // Async IDB rollback must settle before a durable failure is reported.
         await Promise.all(abortWaiters);
         if(!terminal){finish('FAILED','INDEX_DURABLE_COMMIT_FAILED');void stopWorker();}
       }
       throw error;
     }finally{committing=false;}
   }
   const abortIndex=()=>{rollback();if(!terminal){finish('FAILED','INDEX_ABORTED');void stopWorker();}};
   return Object.freeze({onEventPage,commit:commitIndex,commitDurably:commitIndexDurably,abort:abortIndex});
 }
 async function retry(next){
   if(!terminal||!['CANCELLED','FAILED','STALE'].includes(terminal.kind))
     fail('RETRY_NOT_TERMINAL','only a settled rejected job may be retried');
   if(!next||!valid(next.jobId)||next.jobId===jobId)
     fail('RETRY_EPOCH_REQUIRED','retry needs a new unique job identity');
   if(typeof next.createWorker!=='function')
     fail('WORKER_UNAVAILABLE','retry requires fresh native Worker factory');
   await stopWorker();
   return createWorkerLifecycleSession({...next,
     trustedWorkerCtor:next.trustedWorkerCtor??trusted,
     createWorker:()=>{const fresh=next.createWorker();
       if(fresh===worker)fail('RETRY_WORKER_REUSED','old Worker handle cannot be retried');
       return fresh;},
   });
 }

 return Object.freeze({start,cancel,subscribe,snapshot,supersede,retry,beginIndexTransaction,dispose:cancel});
}
