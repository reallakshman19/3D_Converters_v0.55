/** XML229 P3B.3 — one-job verified original Blob transport for existing B1 UI.
 * No staged JSON text is supplied to the main thread. The existing Preview
 * algorithm executes only inside a fresh dedicated Worker on the O1 File.
 */
export function executeXml229OriginalPreview({
  requestId,basisId,xmlText,config,scope,
  originalSourceSession,onProgress=()=>{},
  createWorker=()=>new Worker(
    new URL('./xml229-preview-original-blob-worker.mjs',import.meta.url),{type:'module'})
}={}){
  const fail=(code)=>Object.assign(new Error(code),{code});
  const r=originalSourceSession?.receipt;
  if(typeof requestId!=='string'||!requestId||
    typeof basisId!=='string'||!/^[a-f0-9]{64}$/.test(basisId)||
    typeof xmlText!=='string'||!xmlText.trim()||
    !config||typeof config!=='object'||Array.isArray(config)||
    scope?.mode==='B'||scope?.selection!=null||
    !(originalSourceSession?.blob instanceof Blob)||
    r?.phase!=='INDEX_COMMITTED'||r?.engineeringReady!==false||
    r?.rightsBasis!=='SOURCE_FACTS_ONLY'||
    originalSourceSession.isCurrent?.()!==true)
    throw fail('XML229_PREVIEW_SOURCE_NOT_READY');
  const worker=createWorker();
  if(!worker||typeof worker.postMessage!=='function'||
     typeof worker.terminate!=='function')
    throw fail('XML229_PREVIEW_WORKER_UNAVAILABLE');
  let resolved=false,resolveJob,rejectJob;
  const promise=new Promise((resolve,reject)=>{resolveJob=resolve;rejectJob=reject;});
  const cleanup=(err,value)=>{
    if(resolved)return;
    resolved=true;
    worker.removeEventListener?.('message',onMessage);
    worker.removeEventListener?.('error',onError);
    worker.terminate();
    if(err)rejectJob(err);else resolveJob(value);
  };
  function onError(){cleanup(fail('XML229_PREVIEW_WORKER_CRASH'));}
  function onMessage({data:m}){
    if(m?.protocol!=='xml-cii-preview-local/1'||
      m.requestId!==requestId||m.basisId!==basisId)
      return cleanup(fail('XML229_PREVIEW_WORKER_IDENTITY'));
    if(originalSourceSession.isCurrent()!==true)
      return cleanup(fail('XML229_PREVIEW_SOURCE_STALE'));
    if(m.state==='running'){
      if(!Number.isSafeInteger(m.completed)||m.completed<0||m.completed>3||
         m.total!==3)return cleanup(fail('XML229_PREVIEW_WORKER_PROGRESS'));
      try{onProgress({requestId,basisId,state:'running',stage:m.stage,
        completed:m.completed,total:3});}catch(e){cleanup(e);}
    }else if(m.state==='failed'){
      const e=fail(String(m.error?.code||'XML229_PREVIEW_WORKER_FAILED'));
      e.stage=String(m.error?.stage||'compute');
      // Keep the Worker diagnostic; previously the adapter discarded it and
      // showed only the generic fallback code twice. Bound visible text.
      const detail=String(m.error?.message||'').replace(/\s+/g,' ').slice(0,360);
      if(detail)e.message=detail;
      cleanup(e);
    }else if(m.state==='completed'){
      const x=m.result;
      if(!x||x.originalStagedSourceSha256!==r.sha256||
         x.originalStagedSourceGeneration!==r.generationId||
         !Array.isArray(x.branchRows)||!Array.isArray(x.nodeRows)||
         x.fullFactPopulationAccepted!==false||
         x.engineeringAcceptance!=='NOT_ASSESSED')
        return cleanup(fail('XML229_PREVIEW_WORKER_RESULT_INVALID'));
      cleanup(null,x);
    }else cleanup(fail('XML229_PREVIEW_WORKER_STATE'));
  }
  worker.addEventListener('message',onMessage);
  worker.addEventListener('error',onError);
  try{
    if(originalSourceSession.isCurrent()!==true)
      throw fail('XML229_PREVIEW_SOURCE_STALE');
    worker.postMessage({
      protocol:'xml-cii-preview-local/1',kind:'execute',requestId,basisId,
      xmlText,config,scope,originalSourceReceipt:r,
      originalStagedBlob:originalSourceSession.blob,
    });
  }catch(e){cleanup(e);}
  return {requestId,basisId,promise,release:()=>
    cleanup(fail('XML229_PREVIEW_WORKER_RELEASED'))};
}
