/** Research-only native Worker: source catalog → consumer projection. */
import {createSourceBackedResolverProjection} from './branch-sliced-projection.mjs';
let used=false;
self.addEventListener('message',async({data})=>{
  if(used){self.postMessage({type:'ERROR',code:'WORKER_BUSY'});return;}
  used=true;
  try{
    if(data?.type!=='PROJECT')throw Object.assign(new Error('PROJECT required'),{code:'PROTOCOL'});
    const result=await createSourceBackedResolverProjection(data);
    self.postMessage({type:'DONE',result});
  }catch(error){
    self.postMessage({type:'ERROR',code:error?.code||'PROJECTION_FAILURE',
      message:String(error?.message||error)});
  }
});
