/**
 * XML229 P4-D browser facade. One original staged JSON Blob stays in the
 * isolated engineering/GC-PW Worker for its whole lifetime. Only source-
 * canonical page/query and explicit CAS-reviewed actions enter/leave it.
 *
 * isCurrent() MUST re-check active original File/Blob generation, original
 * XML selection and master/config revision before every read or decision.
 * Fail closed if UI changed: no stale Weight/Final action or Run receipt.
 */
import {physicalOccurrenceId}
 from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';

const PROTOCOL='XML229.P4.WorkerHeldOriginalJsonGC-PW.v1';
const CENSUS='XML229.P4.OriginalWeightCensus.v1';
const err=(code,message)=>{
 const e=new Error(message||code);e.code=code;e.retryable=false;return e;
};
function independentCensus({xmlText,sourceId,config,requestId,workerFactory,
 signal,timeoutMs}){
 const worker=workerFactory();
 if(!worker||typeof worker.postMessage!=='function')
   return Promise.reject(err('INDEPENDENT_WORKER_REQUIRED','Native original census Worker required'));
 return new Promise((resolve,reject)=>{
   let done=false,timer=null;
   const abort=()=>finish(err('CANCELLED','Preview cancelled during independent original XML census'));
   const finish=(error,value)=>{
     if(done)return;done=true;
     clearTimeout(timer);signal?.removeEventListener?.('abort',abort);
     try{worker.terminate()}catch{}
     if(error)reject(error);else resolve(value);
   };
   if(signal?.aborted){abort();return;}
   signal?.addEventListener?.('abort',abort,{once:true});
   timer=setTimeout(()=>finish(err('ORIGINAL_CENSUS_TIMEOUT',
     'Independent original XML census did not respond within the bounded Worker deadline')),timeoutMs);
   worker.addEventListener('message',({data:m})=>{
     if(m?.protocol!==CENSUS||m.requestId!==requestId)return;
     if(m.state==='completed')finish(null,m);
     else if(m.state==='failed')finish(err(m.error?.code||'ORIGINAL_CENSUS_FAILED',
       m.error?.message));
   });
   worker.addEventListener('error',e=>finish(err('ORIGINAL_CENSUS_WORKER_CRASH',
     String(e?.message||e))));
   try{worker.postMessage({protocol:CENSUS,requestId,kind:'start',xmlText,sourceId,config});}
   catch(error){finish(err('ORIGINAL_CENSUS_DISPATCH_FAILED',String(error?.message||error)));}
 });
}
export async function openXml229WorkerHeldOriginalWeightReview({
 xmlText,sourceId,masters,selection,config,overrides={},
 originalStagedBlob,originalStagedSourceReceipt,requestId,maxPhysical=10000,
 isCurrent,onProgress=()=>{},signal=null,
 censusTimeoutMs=120000,phaseTimeoutMs=180000,startupTimeoutMs=720000,
 censusWorkerFactory=()=>new Worker(new URL('./xml229-original-physical-census-worker.mjs',import.meta.url),
  {type:'module'}),
 weightWorkerFactory=()=>new Worker(new URL('./xml229-original-blob-gcpw-worker.mjs',import.meta.url),
  {type:'module'}),
}={}){
 if(signal?.aborted)throw err('CANCELLED','Preview cancelled before source verification');
 if(typeof isCurrent!=='function')
   throw err('LIVE_SOURCE_REVISION_PORT_REQUIRED',
     'A real source/file/master/config staleness port is mandatory');
 if(!requestId||typeof requestId!=='string'||typeof xmlText!=='string'||
    !sourceId||!masters||!config||!Array.isArray(selection)||
    selection.length!==1||selection[0].sourceId!==sourceId||
    selection[0].selectionRef!=='all')
   throw err('ORIGINAL_SOURCE_SCOPE_REQUIRED',
     'Original XML, one full source selection, masters and config required');
 if(!isCurrent())throw err('STALE_INPUT','Original source changed before Worker start');
 const census=await independentCensus({xmlText,sourceId,config,requestId,
   workerFactory:censusWorkerFactory,signal,
   timeoutMs:censusTimeoutMs});
 if(signal?.aborted)throw err('CANCELLED','Preview cancelled during source verification');
 if(!isCurrent())throw err('STALE_INPUT','Original source changed during census');
 const worker=weightWorkerFactory();
 if(!worker||typeof worker.postMessage!=='function'||
    typeof worker.addEventListener!=='function')
   throw err('ENGINEERING_WORKER_REQUIRED','Native original JSON source Worker required');
 let disposed=false,counter=0,ready=null,settle,closureCode=null;
 let phaseTimer=null,deadlineTimer=null,lastStage='engineering-worker-start';
 const outstanding=new Map();
 const abort=()=>stop(err('CANCELLED','Preview cancelled during engineering Worker startup'));
 const stop=error=>{
   if(disposed)return;disposed=true;ready=null;
   closureCode=String(error?.code||'WORKER_TERMINATED').slice(0,80);
   clearTimeout(phaseTimer);clearTimeout(deadlineTimer);
   signal?.removeEventListener?.('abort',abort);
   try{worker.terminate()}catch{}
   for(const {reject} of outstanding.values())reject(error);
   outstanding.clear();
   settle?.reject(error);
 };
 const armStageTimeout=()=>{
   clearTimeout(phaseTimer);
   phaseTimer=setTimeout(()=>stop(err('ENGINEERING_PREVIEW_WORKER_STALLED',
     'Engineering Preview did not advance beyond '+lastStage+
     ' within '+Math.round(phaseTimeoutMs/1000)+' seconds. Source remains HELD; retry after verifying current inputs.')),
     phaseTimeoutMs);
 };
 const send=payload=>{
   if(disposed)throw err('CANCELLED','Worker is closed');
   worker.postMessage({...payload,protocol:PROTOCOL,requestId});
 };
 const current=()=>{
   if(disposed)throw err('CANCELLED','Worker closed');
   if(!isCurrent()){
     const changed=err('STALE_INPUT','Source Blob, Owner selection or masters changed; rebuild and review');
     stop(changed);throw changed;
   }
 };
 const started=new Promise((resolve,reject)=>{settle={resolve,reject}});
 worker.addEventListener('message',({data:m})=>{
   if(m?.protocol!==PROTOCOL||m.requestId!==requestId||disposed)return;
   if(m.state==='progress'){
     lastStage=String(m.stage||'engineering-worker-progress').slice(0,96);
     armStageTimeout();onProgress(lastStage);return;
   }
   if(m.state==='ready'){
     if(!m.engineeringFactsVerified||m.weightEngineeringAccepted!==false||
        m.finalEngineeringAccepted!==false||
        m.originalJsonSha256!==originalStagedSourceReceipt?.sha256||
        m.sourceGenerationId!==originalStagedSourceReceipt?.generationId||
        m.sourceId!==sourceId||m.physicalCount!==census.counts.physical){
       stop(err('UNVERIFIED_WEIGHT_RESPONSE','Worker asserted wrong original source/fact population'));return;
     }
     ready=Object.freeze(m);
     clearTimeout(phaseTimer);clearTimeout(deadlineTimer);
     signal?.removeEventListener?.('abort',abort);
     settle.resolve(ready);settle=null;return;
   }
   if(m.state==='failed'||m.state==='cancelled'){
     stop(err(m.error?.code||'ENGINEERING_WORKER_FAILED',
       m.error?.message||'Original staged source Worker failed'));return;
   }
   if(m.state==='rpc-result'||m.state==='rpc-failed'){
     const request=outstanding.get(m.rpcId);
     if(!request)return;
     outstanding.delete(m.rpcId);
     if(m.state==='rpc-failed')request.reject(err(m.error?.code||'GC_PW_RPC_FAILED',m.error?.message));
     else request.resolve(m.value);
   }
 });
 worker.addEventListener('error',e=>stop(err('ENGINEERING_WORKER_CRASH',String(e?.message||e))));
 worker.addEventListener('messageerror',()=>stop(err('WORKER_SERIALIZATION_FAILED','Source review result cannot cross Worker')));
 try{
   if(signal?.aborted)throw err('CANCELLED','Preview cancelled before engineering Worker start');
   signal?.addEventListener?.('abort',abort,{once:true});
   armStageTimeout();
   deadlineTimer=setTimeout(()=>stop(err('ENGINEERING_PREVIEW_STARTUP_TIMEOUT',
     'Engineering Preview did not finish source/master/JSON verification within the startup deadline. Source remains HELD.')),
     startupTimeoutMs);
   send({kind:'start',xmlText,sourceId,masters,selection,config,overrides,
     originalStagedBlob,originalStagedSourceReceipt,
     independentSourceOccurrences:census.independentSourceOccurrences,
     independentPhysicalOccurrences:census.independentPhysicalOccurrences,
     expectedOriginalCount:census.counts.original,maxPhysical});
   await started;current();
 }catch(error){stop(error);throw error;}
 const rpc=(payload)=>{
   current();
   if(!ready)throw err('REVIEW_SESSION_NOT_READY','Original JSON Weight review not verified');
   const rpcId='source-review-'+(++counter);
   return new Promise((resolve,reject)=>{
     outstanding.set(rpcId,{resolve,reject});
     try{send({...payload,kind:payload.kind,rpcId,basisId:ready.basisId,
       sourceGenerationId:ready.sourceGenerationId});}
     catch(error){outstanding.delete(rpcId);reject(error);}
   }).then(value=>{current();return value;});
 };
 return Object.freeze({
   receipt:ready,
   // Read-only liveness; disposing a Worker must invalidate its registry
   // authority even when navigation leaves the original entry reachable.
   get closed(){return disposed;},
   // Expose only a bounded lifecycle error code, never original source data.
   get closureCode(){return closureCode;},
   originalPhysicalOccurrences:Object.freeze(census.independentPhysicalOccurrences.map(row=>({
     ...row,occurrenceId:physicalOccurrenceId(row),
   }))),
   async readCompletion(){
     return rpc({kind:'read',what:'completion',sourceId});
   },
   // Aggregate-only source-bound review evidence; no raw physical owners.
   async readCandidateCoverage(){
     return rpc({kind:'read',what:'candidate-coverage',sourceId});
   },
   // Single synchronous Worker turn: G3 and G4 may not straddle a review edit.
   async readCandidateReadinessPair(){
     return rpc({kind:'read',what:'candidate-readiness-pair',sourceId});
   },
   async readPreviewResult(){
     const result=await rpc({kind:'read',what:'preview',sourceId});
     if(result?.engineeringAcceptance!=='NOT_ASSESSED'||
       result?.fullFactPopulationAccepted!==false||
       result?.originalStagedSourceSha256!==originalStagedSourceReceipt.sha256||
       result?.originalStagedSourceGeneration!==originalStagedSourceReceipt.generationId||
       !Array.isArray(result?.branchRows)||!Array.isArray(result?.nodeRows)||
       result?.sourceOccurrences?.branches?.length!==result?.coverage?.sourceBranchCount)
       throw err('VERIFIED_PREVIEW_PRESENTATION_DRIFT',
         'Preview rows do not belong to current original engineering session');
     return result;
   },
   async readNativeFinalIntent(){
     return rpc({kind:'read',what:'native-final-intent',sourceId});
   },
   async attestEngineInput({engineInputXmlText}={}){
     return rpc({kind:'read',what:'attest-engine-input',sourceId,engineInputXmlText});
   },
   async readPage({offset=0,limit=25,filter='all',query=''}={}){
     return rpc({kind:'read',what:'page',sourceId,offset,limit,filter,query});
   },
   async planQualifiedBlankFill(){
     return rpc({kind:'read',what:'bulk-plan',sourceId});
   },
   async commitQualifiedBlankFill({planId}={}){
     if(typeof planId!=='string'||!planId)
       throw err('BULK_PLAN_REQUIRED','Review current source-bound Match-1 bulk plan first');
     return rpc({kind:'bulk-commit',sourceId,planId});
   },
   async readIndividual({occurrenceId,stage='RigidMatch1'}={}){
     return rpc({kind:'read',what:'individual',sourceId,occurrenceId,stage});
   },
   async readFacts({cursor=null,limit=100}={}){
     return rpc({kind:'read',what:'facts',sourceId,cursor,limit});
   },
   async readProposals({occurrenceIds,cursor=null,limit=100}={}){
     return rpc({kind:'read',what:'proposals',sourceId,occurrenceIds,cursor,limit});
   },
   async readDecisions({stage='RigidMatch1'}={}){
     return rpc({kind:'read',what:'decisions',sourceId,stage});
   },
   async readDecisionProvenance(){
     return rpc({kind:'read',what:'decision-provenance',sourceId});
   },
   async exportReviewBackup(){
     return rpc({kind:'read',what:'review-backup',sourceId});
   },
   async restoreReviewBackup({backup}={}){
     if(!backup||typeof backup!=='object'||Array.isArray(backup))
       throw err('REVIEW_BACKUP_REQUIRED','Explicit Owner-chosen review file required');
     return rpc({kind:'restore-review',sourceId,backup});
   },
   async review({view,choice}={}){
     if(!view||!choice)
       throw err('EXPLICIT_REVIEW_REQUIRED','A current original physical view and explicit engineering decision required');
     return rpc({kind:'decision',sourceId,occurrenceId:view.occurrenceId,stage:view.stage,view,choice});
   },
   cancel(){
     if(disposed)return;
     try{send({kind:'cancel'});}catch{}
     stop(err('CANCELLED','User cancelled original JSON Weight review'));
   },
 });
}
