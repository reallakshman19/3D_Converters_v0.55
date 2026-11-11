/** #1147 B0-02 native Worker-only experiment. Never imported by production app. */
import {runCompactResearch} from './compact-research.mjs';
let used=false;
self.addEventListener('message',async event=>{
  const input=event.data;
  if(used){
    self.postMessage({type:'ERROR',code:'WORKER_BUSY',message:'one research job per worker'});
    return;
  }
  used=true;
  try{
    if(input?.type!=='START')throw Object.assign(new Error('START required'),{code:'PROTOCOL'});
    const result=await runCompactResearch({
      blob:input.blob,expectedSha256:input.expectedSha256,
      databaseName:input.databaseName,generation:input.generation,
      revision:input.revision
    });
    self.postMessage({type:'DONE',result});
  }catch(e){
    self.postMessage({type:'ERROR',code:e?.code||'RESEARCH_FAILED',
      message:String(e?.message||e)});
  }
});
