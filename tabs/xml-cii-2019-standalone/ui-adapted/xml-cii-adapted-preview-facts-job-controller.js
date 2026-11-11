// Preview P2.2-B — replaceable, DOM-independent local job lifecycle.
// A terminal "completed" event means local execution finished; it does NOT
// assert engineering acceptance or a complete GC-PW FactRecord population.
import {executeXmlCiiPreviewLocally} from './xml-cii-adapted-preview-facts-local-execution.js';

export class PreviewJobError extends Error {
  constructor(code,message,stage='controller') {
    super(String(message));this.name='PreviewJobError';this.code=code;this.stage=stage;
  }
}
const assert=(ok,code,message)=>{if(!ok)throw new PreviewJobError(code,message);};
const hex=/^[a-f0-9]{64}$/;
const terminal=new Set(['completed','failed','cancelled']);
const active=new Set(['queued','running']);
function normalizeError(error) {
  return {code:String(error?.code||'PREVIEW_JOB_FAILED'),
    message:String(error?.message||error),stage:String(error?.stage||'execute')};
}
function completeResult(result) {
  const c=result?.coverage,source=result?.sourceOccurrences;
  return result&&Array.isArray(result.branchRows)&&Array.isArray(result.nodeRows)
    &&source&&Array.isArray(source.branches)&&Array.isArray(source.nodes)
    &&Number.isSafeInteger(c?.sourceBranchCount)&&Number.isSafeInteger(c?.originalNodeCount)
    &&c.sourceBranchCount===source.branches.length
    &&c.originalNodeCount===source.nodes.length
    &&c.engineeringBranchCount===result.branchRows.length
    &&c.sourceBranchCount===c.engineeringBranchCount
    &&result.fullFactPopulationAccepted===false
    &&result.engineeringAcceptance==='NOT_ASSESSED';
}
export function createXmlCiiPreviewJobController({
  execute=executeXmlCiiPreviewLocally,
  verifyBasis,
  maxRetries=1,
}={}) {
  assert(typeof execute==='function','INVALID_EXECUTOR','An execution port is required');
  assert(typeof verifyBasis==='function','BASIS_VERIFIER_REQUIRED',
    'Full InputBasis validation port required; synthetic basis strings alone are not authority');
  assert(Number.isSafeInteger(maxRetries)&&maxRetries>=0&&maxRetries<=3,
    'INVALID_RETRY_POLICY','Only 0..3 explicit retries are supported');
  let epoch=0,current=null,closed=false;
  let snapshot=Object.freeze({state:'idle',generation:0,requestId:null,basisId:null,
    stage:null,completed:0,total:0,attempt:0,engineeringAccepted:false,error:null});
  const listeners=new Set(),usedIds=new Set();
  let lastSpec=null,lastAttempt=0;
  function publish(next) {
    snapshot=Object.freeze({...snapshot,...next,engineeringAccepted:false});
    for(const fn of [...listeners]) {
      try{fn(snapshot);}catch{/* Observer cannot decide engineering result. */}
    }
  }
  function settle(job,error,result) {
    if(job.settled)return;
    job.settled=true;
    if(error)job.reject(error);else job.resolve(result);
  }
  function currentJob(job) {return !closed&&current===job&&job.generation===epoch&&!job.settled;}
  function fail(job,error) {
    if(!currentJob(job))return;
    const normalized=normalizeError(error);
    try{job.transport?.release?.();}catch{}
    publish({state:'failed',stage:normalized.stage,error:normalized,
      completed:snapshot.completed});
    settle(job,new PreviewJobError(normalized.code,normalized.message,normalized.stage));
  }
  function cancel(reason='User cancelled') {
    if(!current||!active.has(snapshot.state)||current.settled)return false;
    const job=current;
    ++epoch; // Fence all late messages even if the transport refuses to terminate.
    try{job.transport?.release?.();}catch{}
    publish({state:'cancelled',stage:'cancel',error:{
      code:'CANCELLED',message:String(reason),stage:'cancel'}});
    settle(job,new PreviewJobError('CANCELLED',reason,'cancel'));
    return true;
  }
  function start(spec,{supersede=false,attempt=0}={}) {
    assert(!closed,'CONTROLLER_CLOSED','Cannot start after dispose');
    assert(spec&&typeof spec==='object','INVALID_JOB','Job descriptor required');
    const {requestId,basis}=spec;
    assert(typeof requestId==='string'&&requestId.trim(),'INVALID_REQUEST_ID','requestId required');
    assert(basis&&typeof basis==='object'&&hex.test(basis.basisId),
      'INVALID_BASIS_ID','Full InputBasis object and SHA256 required');
    if(active.has(snapshot.state)&&current&&!current.settled) {
      assert(supersede===true,'ACTIVE_JOB','Active job requires explicit supersede');
      cancel('Superseded by '+requestId);
    }
    assert(!usedIds.has(requestId),'DUPLICATE_REQUEST_ID','A requestId cannot be replayed');
    usedIds.add(requestId);
    const generation=++epoch;
    let resolve,reject;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
    const job={generation,requestId,basisId:basis.basisId,spec,attempt,
      resolve,reject,promise,transport:null,settled:false};
    current=job;lastSpec=spec;lastAttempt=attempt;
    publish({state:'queued',generation,requestId,basisId:basis.basisId,
      stage:'basis-attestation',completed:0,total:3,attempt,error:null});
    // Microtask allows the queued state to be observed and cancelled before
    // loading source/master data into the worker.
    queueMicrotask(async()=>{
      if(!currentJob(job))return;
      try {
        const attested=await verifyBasis(spec.basis,spec);
        if(!currentJob(job))return;
        assert(attested===true,'BASIS_NOT_VERIFIED','Full source/master/overrides basis was not verified');
        publish({state:'running',stage:'dispatch',completed:0,total:3});
        const transport=execute({
          ...(spec.input||{}),
          requestId:job.requestId,basisId:job.basisId,
          onProgress:(event)=>{
            if(!currentJob(job))return;
            if(event?.requestId!==job.requestId||event?.basisId!==job.basisId
              ||!Number.isSafeInteger(event.completed)
              ||event.completed<snapshot.completed
              ||event.total!==3||event.completed>event.total) {
              fail(job,new PreviewJobError('STALE_OR_INVALID_PROGRESS',
                'Wrong basis/request or nonmonotonic worker progress','progress'));
              return;
            }
            publish({state:'running',stage:String(event.stage||'compute'),
              completed:event.completed,total:event.total});
          },
        });
        if(!transport||typeof transport.promise?.then!=='function'
          ||typeof transport.release!=='function')
          throw new PreviewJobError('INVALID_TRANSPORT','Executor must expose promise and release()');
        job.transport=transport;
        if(!currentJob(job)) {
          try{transport.release();}catch{}
          Promise.resolve(transport.promise).catch(()=>{});
          return;
        }
        Promise.resolve(transport.promise).then(result=>{
          if(!currentJob(job))return;
          if(!completeResult(result))
            return fail(job,new PreviewJobError('INCOMPLETE_OR_UNVERIFIED_RESULT',
              'Worker did not return full original source custody and explicitly unaccepted engineering','coverage'));
          publish({state:'completed',stage:'local-engineering',completed:3,total:3,error:null});
          settle(job,null,result);
        },error=>fail(job,error));
      }catch(error){fail(job,error);}
    });
    return {requestId,basisId:job.basisId,generation,promise,
      cancel:()=>currentJob(job)&&cancel('User cancelled')};
  }
  function retry() {
    assert(!closed,'CONTROLLER_CLOSED','Controller disposed');
    assert(terminal.has(snapshot.state)&&snapshot.state!=='completed'&&lastSpec,
      'RETRY_NOT_AVAILABLE','Retry requires a failed or cancelled job');
    assert(lastAttempt<maxRetries,'RETRY_LIMIT','Explicit retry limit reached');
    const attempt=lastAttempt+1;
    return start({...lastSpec,requestId:lastSpec.requestId+':retry'+attempt},{attempt});
  }
  function dispose() {
    if(closed)return;
    cancel('Controller disposed');
    closed=true;listeners.clear();usedIds.clear();
  }
  function subscribe(listener) {
    assert(typeof listener==='function','INVALID_OBSERVER','Listener required');
    listeners.add(listener);
    try{listener(snapshot);}catch{/* Initial subscription cannot alter job outcome. */}
    return ()=>listeners.delete(listener);
  }
  return Object.freeze({start,cancel,retry,dispose,subscribe,
    getSnapshot:()=>snapshot});
}
