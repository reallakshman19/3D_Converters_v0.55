/** Recoverable browser drafts have no authority over Worker Final. */
export function showXml229DraftRecoveryNotice(root,workspace,download){
 root?.querySelector?.('[data-xml229-draft-recovery]')?.remove();
 const recovery=workspace?.recovery;
 if(!root||!recovery?.rejectedCount)return;
 const aside=document.createElement('aside');
 aside.dataset.xml229DraftRecovery='true';
 aside.setAttribute('role','status');
 aside.style.cssText='margin:10px 0;padding:10px;border:1px solid #d97706;border-radius:7px;background:#37270f;color:#fef3c7';
 const p=document.createElement('p');
 p.textContent=recovery.rejectedCount+' previously saved Applied Weight draft(s) referenced unknown original physical occurrences and were excluded. '+recovery.retainedCount+' compatible draft(s) retained. Existing accepted Final masses are unchanged. '+(recovery.backupStored?'Private backup preserved in browser storage.':'Browser backup was unavailable; download your private copy before leaving.');
 const button=document.createElement('button');
 button.type='button';button.textContent='Download excluded draft backup (private)';
 button.dataset.xml229DraftRecoveryDownload='true';
 button.addEventListener('click',()=>{
   const snapshot=workspace.exportQuarantinedBackup();
   if(snapshot)download('xml229-excluded-applied-weight-drafts.json',
     JSON.stringify(snapshot,null,2),'application/json;charset=utf-8');
 });
 aside.append(p,button);root.appendChild(aside);
}
/** Never overwrite the only local old-draft checkpoint if quarantine failed. */
export function saveXml229RecoveryDrafts(workspace){
 try{return workspace.save();}
 catch(error){
   if(error?.code==='WEIGHT_DRAFT_QUARANTINE_SAVE_REQUIRED')return 0;
   throw error;
 }
}
