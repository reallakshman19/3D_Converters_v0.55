/** Explicit L3 operator UX, isolated from the legacy P4 panel size ratchet.
 * Requires fresh source selection and genuine O1 indexing before Worker start.
 */
import {startXml229TopoFixFreshWeightSession}
 from '../integration/xml229-topofix-fresh-worker-handoff.mjs';
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export function installXml229TopoFixFreshStartControl({
 build,root,stateRef,resolveInputs,getPreviousSession,isBusy,setBusy,say,
 openSession,activateSession,
}={}){
 if(!root||typeof activateSession!=='function'||typeof openSession!=='function')
   fail('TOPOFIX_HANDOFF_UI_AUTHORITY_REQUIRED');
 const details=document.createElement('details');
 details.dataset.xml229TopofixFresh='true';
 details.style.cssText='margin:12px 0;padding:8px;border:1px solid #64748b;border-radius:6px';
 const summary=document.createElement('summary');
 summary.textContent='TopoFix → new GC-PW Worker (pre-Final only)';
 details.append(summary);
 const info=document.createElement('p');
 info.textContent='First load the committed TopoFix XML as the current Source, re-index O1 JSON, and select every branch. Attach the original PSI116 XML, committed lineage, and pre-Final handoff receipts. No Final decisions transfer.';
 details.append(info);
 const files={};
 for(const [key,label,accept] of [
   ['original','Original PSI116 XML','.xml,text/xml,application/xml'],
   ['lineage','Committed TopoFix source-lineage JSON','.json,application/json'],
   ['handoff','Verified pre-Final handoff JSON','.json,application/json'],
 ]){
   const row=document.createElement('label');
   row.textContent=label+' ';
   row.style.cssText='display:block;margin:6px 0';
   const input=document.createElement('input');
   input.type='file';input.accept=accept;
   input.dataset.xml229TopofixFile=key;row.append(input);
   details.append(row);files[key]=input;
 }
 const start=document.createElement('button');
 start.type='button';start.textContent='Verify and start NEW GC-PW Worker';
 start.dataset.action='xml229-topofix-fresh-worker';
 const status=document.createElement('p');
 status.setAttribute('role','status');details.append(start,status);
 root.append(details); // Existing-workflow Weight has no Build button.
 start.addEventListener('click',async()=>{
   if(isBusy())return;
   setBusy(true);start.disabled=true;
   root.dataset.p4ReadReady='false';
   try{
     const selected=['original','lineage','handoff'].map(key=>files[key].files?.[0]);
     if(selected.some(file=>!file||!file.size||file.size>24*1024*1024))
       fail('TOPOFIX_HANDOFF_FILES_REQUIRED');
     const [originalXmlText,lineageText,handoffText]=await Promise.all(
       selected.map(file=>file.text()));
     const proof=await startXml229TopoFixFreshWeightSession({
       stateRef,originalXmlText,
       lineageReceipt:JSON.parse(lineageText),
       handoffReceipt:JSON.parse(handoffText),
       previousSession:getPreviousSession(),resolveInputs,
       openSession:({resolveInputs:verified})=>openSession(verified),
       explicitUserAction:true,isCurrent:()=>root.isConnected!==false,
     });
     await activateSession(proof.session);
     status.textContent='Fresh Worker attested. No prior Final review or backup migrated.';
     say('New TopoFix source Worker ready. Weight/Final review remains required.');
   }catch(e){
     const code=String(e?.code||'TOPOFIX_HANDOFF_FAILED');
     status.textContent='HOLD ['+code+']: fresh source evidence was not accepted.';
     say('TopoFix Worker handoff held ['+code+']. No prior Final was migrated.',true);
   }finally{setBusy(false);start.disabled=false;}
 });
 return details;
}
