/**
 * XML229 P4 — read-only 4 Preview status and an explicit action to build the
 * SAME independently source-attested engineering GC-PW Worker review used by
 * Weight Match. Never patches legacy Preview rows/cache or CII output.
 */
import {getXml229CurrentWorkerHeldReview,openXml229P4VerifiedSession,
 resolveXml229P4ProductionInputs}
 from './xml-cii-adapted-p4-verified-weight-panel.js';

export function installXml229P4PreviewBridge(container,stateRef,{
 resolveInputs=()=>resolveXml229P4ProductionInputs(stateRef),
}={}){
 if(!container)throw new Error('Preview evidence host required');
 const root=document.createElement('section');
 root.setAttribute('data-xml229-p4-preview-bridge','');
 root.style.cssText='border:1px solid #64748b;border-radius:8px;padding:12px;margin:12px 0';
 root.innerHTML=`<strong>Original JSON → engineering Preview physical facts (source-bound)</strong>
 <p>Runs current original JSON Blob and full selected original XML in isolated Workers,
   checks complete original physical FactRecords and opens the same canonical Weight/Final
   review. This is separate from the legacy 4 Preview cache.</p>
 <button type="button" data-p4-preview-build>Build verified physical Preview → Weight review</button>
 <p role="status" data-p4-preview-status>Not yet verified. O1 source indexing is not engineering Preview.</p>
 <div data-p4-preview-facts></div>
 <p>Run remains HELD until an independent native CII Final/output consumption proof exists.</p>`;
 container.replaceChildren(root);
 const build=root.querySelector('[data-p4-preview-build]');
 const status=root.querySelector('[data-p4-preview-status]');
 const facts=root.querySelector('[data-p4-preview-facts]');
 let busy=false,disposed=false;
 const say=(message,bad=false)=>{if(disposed)return;status.textContent=message;
   status.style.color=bad?'#ef4444':'#10b981';};
 const show=async session=>{
   const proof=await session.readCompletion();
   if(disposed)return;
   if(proof?.schema!=='XML229.P4.RunAdvisory.v1'||
     proof.engineeringFactsVerified!==true||
     proof.previewStatus!=='FULL_SOURCE_FACTS_VERIFIED'||
     proof.basisId!==session.receipt.basisId||
     proof.originalJsonSha256!==session.receipt.originalJsonSha256||
     proof.verifiedPhysicalCount!==session.receipt.physicalCount||
     proof.ciiReleaseAuthorized!==false)
     throw new Error('Current original-source Preview population cannot be verified');
   const lines=[
    ['Original physical components',proof.verifiedPhysicalCount],
    ['Verified engineering FactRecords',proof.verifiedFactCount],
    ['Accepted Match-1',proof.counts?.match1],
    ['Accepted Final',proof.counts?.final],
    ['Unresolved / proposed',proof.counts?.unresolved],
   ];
   facts.replaceChildren();
   const list=document.createElement('dl');
   for(const [label,value] of lines){
     const dt=document.createElement('dt'),dd=document.createElement('dd');
     dt.textContent=label;dd.textContent=String(value??'unknown');
     list.append(dt,dd);
   }
   facts.append(list);
   say('Source-bound Preview engineering facts VERIFIED. Match-1/Final are separate; CII release HELD.');
 };
 build.addEventListener('click',async()=>{
   if(busy||disposed)return;busy=true;build.disabled=true;
   facts.replaceChildren();
   // The previous green VERIFIED label belongs to the old Worker. Clear it
   // immediately, before async master hydration or source attestation begins.
   say('Reverifying original XML, staged JSON Blob and four masters in isolated '+
     'Workers. Prior Preview proof cannot be reused while this build runs.',true);
   try{
     const session=await openXml229P4VerifiedSession(stateRef,{
       resolveInputs,onProgress:stage=>say('Engineering Preview Worker: '+stage),
     });
     await show(session);
   }catch(error){say('Engineering Preview HELD: '+String(error?.message||error)+
      (error?.code?' ['+error.code+']':''),true);}
   finally{busy=false;build.disabled=false;}
 });
 const existing=getXml229CurrentWorkerHeldReview(stateRef);
 if(existing)void show(existing).catch(error=>say('Existing Preview source is stale: '+
   String(error?.message||error),true));
 return {dispose(){disposed=true;}};
}
