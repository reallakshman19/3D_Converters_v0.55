/** #1147 native Worker-only packed-page experiment; no product imports. */
import {runPagedCompactResearch} from './compact-paged-research.mjs';
let used=false;
self.addEventListener('message',async ({data})=>{
  if(used){self.postMessage({type:'ERROR',code:'WORKER_BUSY'});return;}
  used=true;
  try{
    if(data?.type!=='START')throw Object.assign(new Error('START required'),{code:'PROTOCOL'});
    const result=await runPagedCompactResearch({
      blob:data.blob,expectedSha256:data.expectedSha256,
      databaseName:data.databaseName,generation:data.generation,
      revision:data.revision
    });
    self.postMessage({type:'DONE',result});
  }catch(e){
    self.postMessage({type:'ERROR',code:e?.code||'PAGED_RESEARCH_FAILED',
      message:String(e?.message||e)});
  }
});
