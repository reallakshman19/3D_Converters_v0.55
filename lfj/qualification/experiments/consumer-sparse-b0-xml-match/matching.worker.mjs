/** #1147 B0-07 native module Worker, research-only, no UI export right. */
import {compareSourceProjectionToXml} from './xml-csv-parity.mjs';
let active=false,resume=null;
self.addEventListener('message',async({data})=>{
  if(data?.type==='RESUME'&&resume){
    const release=resume;resume=null;release();
    return;
  }
  if(active){self.postMessage({type:'ERROR',code:'BUSY'});return;}
  active=true;
  try{
    if(data?.type!=='MATCH'||(data.testBarrier&&
       data.testBarrier!=='BEFORE_RESOLVE'))
      throw Object.assign(new Error('MATCH expected / invalid barrier'),{code:'PROTOCOL'});
    // Research-only deterministic pause. The browser controls the gap AFTER
    // page and HEAD validation but BEFORE actual XML/CSV execution, so a
    // superseding HEAD cannot hide behind a successful initial read.
    const onBeforeResolve=data.testBarrier==='BEFORE_RESOLVE'
      ?()=>new Promise(resolve=>{
        resume=resolve;
        self.postMessage({type:'PAUSED',stage:'BEFORE_RESOLVE'});
      }):undefined;
    const result=await compareSourceProjectionToXml({...data,onBeforeResolve});
    self.postMessage({type:'DONE',result});
  }catch(e){
    self.postMessage({type:'ERROR',code:e?.code||'XML_CSV_RESEARCH_FAILED',
      message:String(e?.message||e)});
  }finally{
    resume=null;active=false;
  }
});
