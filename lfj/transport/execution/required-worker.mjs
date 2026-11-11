/** LFJ R06/U01: strict Worker execution admission. No inline fallback.
 * Browser Worker and Node WorkerThreads injection are supported at a narrow
 * asynchronous message-port seam. Worker lifecycle/cancel/retry belongs to R07.
 */
export class WorkerExecutionError extends Error {
  constructor(code,detail,{cause}={}){
    super(code+': '+detail,{cause});this.name='WorkerExecutionError';this.code=code;
  }
}
const fail=(code,detail,options)=>{throw new WorkerExecutionError(code,detail,options);};
const valid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=1024;
const SCHEMA='LFJ.WorkerExecution.v1';

/**
 * One verified START → READY message exchange with an injected isolated Worker.
 * It never executes a local parse or calls an inline callback when a Worker
 * cannot be created. No SHA, Preview Basis or engineering rights are invented.
 */
export async function runRequiredWorkerJob({
  createWorker,trustedWorkerCtor,jobId,sourceRefId,sourceRevision,sourceSha256,byteLength,
}={}) {
  if(!valid(jobId)||!valid(sourceRefId)||!valid(sourceRevision)||
     !valid(sourceSha256)||!Number.isSafeInteger(byteLength)||byteLength<0)
    fail('INVALID_SOURCE_JOB','explicit bounded source-ref, revision, SHA and byte length required');
  if(typeof createWorker!=='function')
    fail('WORKER_UNAVAILABLE','isolated execution Worker factory is mandatory');
  let worker;
  try{worker=createWorker();}
  catch(e){fail('WORKER_UNAVAILABLE','Worker construction was refused',{cause:e});}
  if(!worker)fail('WORKER_UNAVAILABLE','isolated Worker could not be created');
  const browser=typeof worker.addEventListener==='function'&&typeof worker.removeEventListener==='function';
  const node=typeof worker.on==='function'&&typeof worker.off==='function';
  if(typeof worker.postMessage!=='function'||typeof worker.terminate!=='function'||
     (!browser&&!node))
    fail('INVALID_WORKER_PORT','real Worker-shaped asynchronous message and termination port required');
  // U01 provenance is trusted at the application composition root, not from
  // a fake Worker-shaped object or its self-asserted READY fields. Native
  // browser Workers use the platform Worker constructor; Node WorkerThreads
  // callers must explicitly inject node:worker_threads.Worker.
  const platformWorkerCtor=trustedWorkerCtor??globalThis.Worker;
  if(typeof platformWorkerCtor!=='function')
    fail('WORKER_UNAVAILABLE','trusted platform Worker constructor is required');
  if(!(worker instanceof platformWorkerCtor)||
     typeof platformWorkerCtor.prototype?.postMessage!=='function'||
     typeof platformWorkerCtor.prototype?.terminate!=='function')
    fail('INVALID_WORKER_PORT','native Worker method provenance is required');
  // A forged plain object can inherit Worker.prototype and pass instanceof.
  // Only the trusted platform native method checks the Worker's internal slots.
  const nativePost=platformWorkerCtor.prototype.postMessage;
  const nativeTerminate=platformWorkerCtor.prototype.terminate;

  const source={jobId,sourceRefId,sourceRevision,sourceSha256,byteLength};
  return new Promise((resolve,reject)=>{
    let ended=false;
    let timer;
    const cleanup=()=>{
      clearTimeout(timer);
      if(browser){
        worker.removeEventListener('message',message);
        worker.removeEventListener('error',onError);
      }else{
        worker.off('message',message);worker.off('error',onError);
        worker.off('exit',onExit);
      }
    };
    const stop=(error,result)=>{
      if(ended)return;
      ended=true;cleanup();
      if(!error){resolve(Object.freeze(result));return;}
      // Failed admission owns this Worker: terminate and await native exit
      // before reporting the failure. A later job must use a fresh Worker.
      Promise.resolve().then(()=>nativeTerminate.call(worker)).catch(()=>{}).then(()=>reject(error));
    };
    const onError=e=>stop(new WorkerExecutionError('WORKER_FAILED',
      'isolated Worker reported an execution error',{cause:e?.error??e}));
    const onExit=code=>stop(new WorkerExecutionError('WORKER_FAILED',
      'isolated Worker exited before READY (code '+code+')'));
    const message=event=>{
      const data=browser?event?.data:event;
      if(!data||data.schema!==SCHEMA||data.kind!=='READY'||
         data.jobId!==jobId||data.sourceRefId!==sourceRefId||
         data.sourceRevision!==sourceRevision||
         data.sourceSha256!==sourceSha256||data.byteLength!==byteLength){
        stop(new WorkerExecutionError('WORKER_PROTOCOL',
          'Worker response did not attest the exact START job and source basis'));
        return;
      }
      stop(null,data);
    };
    if(browser){
      worker.addEventListener('message',message);
      worker.addEventListener('error',onError);
    }else{
      worker.on('message',message);
      worker.on('error',onError);
      worker.on('exit',onExit);
    }
    // A hung Worker never turns into a synchronous fallback or a successful
    // job. Later R07 owns terminal lifecycle/retry orchestration.
    timer=setTimeout(()=>stop(new WorkerExecutionError('WORKER_UNAVAILABLE',
      'isolated Worker did not acknowledge admission')),5000);
    try{nativePost.call(worker,{schema:SCHEMA,kind:'START',...source});}
    catch(e){stop(new WorkerExecutionError('INVALID_WORKER_PORT',
      'trusted native Worker rejected the START receiver or envelope',{cause:e}));}
  });
}
