/** Owner-selected reattachment of exact original O1 JSON for native restraints.
 * Raw bytes never come from a guessed cache and do not replace GC-PW Worker custody.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {getXml229CurrentWorkerHeldReview}
 from './xml-cii-adapted-p4-verified-weight-panel.js';

const bound=new WeakMap();
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x);

export function getXml229NativeJsonReattachment(session){
 if(!session||session.closed)return null;
 const saved=bound.get(session);
 if(!saved||saved.basisId!==session.receipt?.basisId||
    saved.sourceGenerationId!==session.receipt?.sourceGenerationId||
    saved.sha256!==session.receipt?.originalJsonSha256)return null;
 return saved;
}
export async function attachXml229NativeJson({session,file,isCurrent=()=>true}={}){
 if(!session||session.closed||typeof file?.text!=='function'||!isCurrent())
   fail('NATIVE_JSON_ATTACH_CURRENT_WORKER_REQUIRED');
 const before=await session.readCompletion();
 if(!isCurrent()||!sha(before?.originalJsonSha256)||
    before.originalJsonSha256!==session.receipt?.originalJsonSha256||
    before.sourceGenerationId!==session.receipt?.sourceGenerationId||
    before.basisId!==session.receipt?.basisId)
   fail('NATIVE_JSON_ATTACH_WORKER_BASIS_DRIFT');
 const bytes=await file.text();
 if(!isCurrent()||!bytes)fail('NATIVE_JSON_ATTACH_BYTES_MISSING');
 const hash=await digestUtf8(bytes);
 if(hash!==before.originalJsonSha256)fail('NATIVE_JSON_ATTACH_SHA_MISMATCH');
 const after=await session.readCompletion();
 if(!isCurrent()||after?.basisId!==before.basisId||
    after?.sourceGenerationId!==before.sourceGenerationId||
    after?.originalJsonSha256!==before.originalJsonSha256)
   fail('NATIVE_JSON_ATTACH_WORKER_CHANGED');
 const saved=Object.freeze({file,sha256:hash,basisId:before.basisId,
   sourceGenerationId:before.sourceGenerationId});
 bound.set(session,saved);return saved;
}
export function createXml229NativeJsonReattachControl({stateRef,createElement}={}){
 const host=createElement('div','','model-converters-workflow-detail-note');
 const label=document.createElement('label');
 label.textContent='Reattach original staged JSON for native Run (exact SHA required)';
 label.style.cssText='display:block;margin-top:8px;font-weight:600';
 const input=document.createElement('input');
 input.type='file';input.accept='.json,application/json';
 input.dataset.action='xml229-reattach-native-json';
 input.style.cssText='display:block;width:100%;margin:5px 0;padding:8px';
 const feedback=document.createElement('p');
 feedback.setAttribute('role','status');
 const live=getXml229CurrentWorkerHeldReview(stateRef);
 feedback.textContent=getXml229NativeJsonReattachment(live)
   ?'Exact original JSON attached for this Worker; native verification still required.'
   :'Use the original JSON matching your O1 indexed receipt. Existing Final weights stay unchanged.';
 input.addEventListener('change',async()=>{
   const session=getXml229CurrentWorkerHeldReview(stateRef),file=input.files?.[0];
   input.disabled=true;
   try{
     await attachXml229NativeJson({session,file,
       isCurrent:()=>getXml229CurrentWorkerHeldReview(stateRef)===session&&
         !session.closed});
     feedback.textContent='SHA verified. Original JSON is attached for native Run only; GC-PW Final unchanged.';
   }catch(e){
     feedback.textContent='Reattachment held ['+String(e.code||'NATIVE_JSON_ATTACH_FAILED')+
       ']. No source or Final was changed.';
   }finally{input.disabled=false;}
 });
 label.appendChild(input);host.append(label,feedback);return host;
}
