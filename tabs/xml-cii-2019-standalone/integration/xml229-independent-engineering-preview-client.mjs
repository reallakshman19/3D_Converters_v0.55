/**
 * GC-PW worker owns a read-only port to a separate Preview process.
 * Original Blob stays in Workers; no native CII or decision authority.
 */
const P='XML229.P4.IndependentEngineeringPreview.v1';
const error=code=>Object.assign(new Error(code),{code,retryable:false});
const has=x=>typeof x==='string'&&x.length>0;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function runXml229IndependentEngineeringPreview({
  requestId,sourceId,basisId,sourceGenerationId,originalJsonSha256,
  originalStagedBlob,xmlText,config,signal,onProgress=()=>{},
  reviewSourceKind,sourceXmlSha256,
  deadlineMs=180000,
  workerFactory=()=>new Worker(new URL('./xml229-independent-engineering-preview-worker.mjs',import.meta.url),
    {type:'module'}),
}={}){
 const xmlOnly=reviewSourceKind==='XML_ONLY';
 const sourceValid=xmlOnly
   ? originalJsonSha256===null&&originalStagedBlob==null&&sha(sourceXmlSha256)&&
     sourceGenerationId==='xml-only:sha256:'+sourceXmlSha256
   : sha(originalJsonSha256)&&originalStagedBlob instanceof Blob&&
     originalStagedBlob.size>0&&originalStagedBlob.size<=100*1024*1024;
 if(!has(requestId)||!has(sourceId)||!has(sourceGenerationId)||
    !sha(basisId)||!sourceValid||
    typeof xmlText!=='string'||!xmlText.trim()||
    !Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>720000)
   return Promise.reject(error('PREVIEW_WORKER_INPUT_INVALID'));
 if(signal?.aborted)return Promise.reject(error('CANCELLED'));
 let worker;
 try{worker=workerFactory();}catch{return Promise.reject(error('PREVIEW_WORKER_UNAVAILABLE'));}
 if(!worker||typeof worker.postMessage!=='function'||
    typeof worker.addEventListener!=='function'||typeof worker.terminate!=='function')
   return Promise.reject(error('PREVIEW_WORKER_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
   let settled=false,timer=null;
   const dispose=()=>{
     clearTimeout(timer);signal?.removeEventListener('abort',abort);
     try{worker.terminate();}catch{}
   };
   const finish=(err,result)=>{
     if(settled)return;settled=true;dispose();
     if(err)reject(err);else resolve(result);
   };
   const abort=()=>finish(error('CANCELLED'));
   worker.addEventListener('error',()=>finish(error('PREVIEW_WORKER_CRASH')));
   worker.addEventListener('messageerror',()=>finish(error('PREVIEW_WORKER_MESSAGE_FAILED')));
   worker.addEventListener('message',({data:m})=>{
     if(settled||m?.protocol!==P||m.requestId!==requestId)return;
     if(m.sourceId!==sourceId||m.basisId!==basisId||
        m.sourceGenerationId!==sourceGenerationId||
        m.originalJsonSha256!==originalJsonSha256||
        xmlOnly&&(m.reviewSourceKind!=='XML_ONLY'||m.sourceXmlSha256!==sourceXmlSha256)){
       finish(error('PREVIEW_WORKER_BASIS_DRIFT'));return;
     }
     if(m.state==='progress'){
       if(typeof m.stage==='string'&&/^[a-z0-9-]{3,79}$/.test(m.stage))onProgress(m.stage);
     }else if(m.state==='failed')finish(error('PREVIEW_WORKER_FAILED'));
     else if(m.state==='completed'){
       if(!Array.isArray(m.result?.branchRows)||!Array.isArray(m.result?.nodeRows))
         finish(error('PREVIEW_RESULT_INVALID'));
       else finish(null,m.result);
     }
   });
   signal?.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>finish(error('PREVIEW_WORKER_DEADLINE')),deadlineMs);
   if(signal?.aborted){abort();return;}
   try{worker.postMessage({protocol:P,kind:'start',requestId,sourceId,
     basisId,sourceGenerationId,originalJsonSha256,originalStagedBlob,xmlText,config,
     reviewSourceKind,sourceXmlSha256});}
   catch{finish(error('PREVIEW_WORKER_POST_FAILED'));}
 });
}
