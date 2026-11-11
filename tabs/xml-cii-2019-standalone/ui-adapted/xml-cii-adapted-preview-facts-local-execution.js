// Preview-only replaceable local execution transport. No URL/API backend.
// P2.2-B will add queue, cancellation/retry and generation fencing.
export const PREVIEW_LOCAL_PROTOCOL='xml-cii-preview-local/1';
export class PreviewLocalExecutionError extends Error {
  constructor(code,message,stage='transport') {
    super(message);this.name='PreviewLocalExecutionError';
    this.code=code;this.stage=stage;
  }
}
export function executeXmlCiiPreviewLocally({
  requestId,basisId,xmlText,config,stagedJsonText='',scope={},
  createWorker=()=>new Worker(new URL('./xml-cii-adapted-preview-facts-worker-entry.js',import.meta.url),{type:'module'}),
  onProgress=()=>{},
}={}) {
  if(typeof requestId!=='string'||!requestId.trim()||
    typeof basisId!=='string'||!/^[a-f0-9]{64}$/.test(basisId))
    throw new PreviewLocalExecutionError('INVALID_JOB_KEY','A requestId and exact SHA256 InputBasis are required');
  if(typeof xmlText!=='string'||!xmlText.trim()||
    !config||typeof config!=='object'||Array.isArray(config)||
    typeof stagedJsonText!=='string')
    throw new PreviewLocalExecutionError('INVALID_INPUT','Serializable XML, config and staged text are required');
  if(typeof createWorker!=='function'||typeof onProgress!=='function')
    throw new PreviewLocalExecutionError('INVALID_PORT','Worker and observer ports must be functions');
  const worker=createWorker();
  if(!worker||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function')
    throw new PreviewLocalExecutionError('INVALID_WORKER_PORT','Local execution adapter did not provide a Worker');
  let settled=false;
  let resolveJob,rejectJob;
  const promise=new Promise((resolve,reject)=>{resolveJob=resolve;rejectJob=reject;});
  function complete(err,value) {
    if(settled)return;
    settled=true;
    worker.removeEventListener?.('message',onMessage);
    worker.removeEventListener?.('error',onError);
    worker.terminate();
    if(err) rejectJob(err);else resolveJob(value);
  }
  function onError(event) {
    complete(new PreviewLocalExecutionError('WORKER_BOOT_FAILURE',
      String(event?.message||'Worker failed before a classified response'),'worker-start'));
  }
  function onMessage(event) {
    const m=event?.data;
    if(m?.protocol!==PREVIEW_LOCAL_PROTOCOL||m?.requestId!==requestId||m?.basisId!==basisId)
      return complete(new PreviewLocalExecutionError('CORRUPT_WORKER_RESPONSE',
        'Worker event does not match request and basis','transport'));
    if(m.state==='running') {
      if(!Number.isSafeInteger(m.completed)||!Number.isSafeInteger(m.total)
        ||m.completed<0||m.completed>m.total||m.total!==3)
        return complete(new PreviewLocalExecutionError('INVALID_WORKER_PROGRESS',
          'Worker reported inconsistent progress',m.stage));
      try{onProgress(Object.freeze({requestId,basisId,state:'running',
        stage:String(m.stage),completed:m.completed,total:m.total}));}
      catch(e){return complete(new PreviewLocalExecutionError('OBSERVER_FAILURE',String(e),'observer'));}
    } else if(m.state==='failed') {
      const code=String(m.error?.code||'WORKER_COMPUTE_FAILED');
      complete(new PreviewLocalExecutionError(code,
        String(m.error?.message||'Preview worker failed'),String(m.error?.stage||'compute')));
    } else if(m.state==='completed') {
      if(!m.result||!Array.isArray(m.result.branchRows)
        ||!Array.isArray(m.result.nodeRows)
        ||!m.result.sourceOccurrences||m.result.fullFactPopulationAccepted!==false)
        return complete(new PreviewLocalExecutionError('INCOMPLETE_WORKER_RESULT',
          'Worker skipped original source occurrences or falsely asserted acceptance'));
      complete(null,m.result);
    } else complete(new PreviewLocalExecutionError('INVALID_WORKER_STATE',
      'Unknown local Preview worker state'));
  }
  worker.addEventListener('message',onMessage);
  worker.addEventListener('error',onError);
  try{
    worker.postMessage({protocol:PREVIEW_LOCAL_PROTOCOL,kind:'execute',
      requestId,basisId,xmlText,config,stagedJsonText,scope});
  }catch(error){
    complete(new PreviewLocalExecutionError('WORKER_DISPATCH_FAILURE',String(error),'dispatch'));
  }
  return {requestId,basisId,promise,
    // This is a local worker release only. Cross-job cancellation semantics
    // and stale-generation rejection remain explicit P2.2-B.
    release:()=>complete(new PreviewLocalExecutionError('RELEASED','Local worker released','transport'))};
}
