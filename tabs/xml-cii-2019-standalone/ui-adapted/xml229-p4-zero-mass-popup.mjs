/** Nonmodal, once-per-Worker 0 kg owner-confirmation notice. */
import {visitXml229UnassignedZero,applyXml229OwnerConfirmedZero}
 from './xml229-p4-confirmed-zero-source-wide.mjs';

// Phase navigation remounts the panel. Keep the offer dismissible for the
// lifetime of its one verified Worker, not per tab visit.
const offeredSessions=new WeakSet();
export function createXml229ZeroMassPopup({
 root,live,getDrafts,saveDrafts,render,say,
}={}){
 if(!root||typeof live!=='function'||typeof getDrafts!=='function'||
    typeof saveDrafts!=='function'||typeof render!=='function'||
    typeof say!=='function')
  throw new Error('ZERO_MASS_UI_AUTHORITY_REQUIRED');
 const notice=root.querySelector('[data-p4-confirm-zero-notice]');
 const message=root.querySelector('[data-p4-confirm-zero-text]');
 const current=session=>!!session&&live()===session&&root.isConnected!==false;
 const dismiss=()=>{if(notice)notice.hidden=true;};
 return Object.freeze({
  dismiss,
  async offer(session){
   if(!current(session)||offeredSessions.has(session))return;
   offeredSessions.add(session);
   try{
    const census=await visitXml229UnassignedZero({
     session,drafts:getDrafts(),isCurrent:()=>current(session),
    });
    if(!current(session)||!notice||!message||!census.eligible)return;
    message.textContent=census.eligible+
     ' unresolved original physical(s) have no selected weight. Apply 0 kg to these blanks? '+
     'This is an explicit Owner-confirmed mass decision, not an inferred positive mass.';
    notice.hidden=false;
   }catch(error){
    say('Blank weight check unavailable ['+
     String(error?.code||'ZERO_SOURCE_READ_FAILED')+']. No zeros applied.',true);
   }
  },
  async handle(action,session){
   if(action==='dismiss'){dismiss();return;}
   if(action!=='apply'||!current(session))
    throw Object.assign(new Error('Current GC-PW Worker required'),{
     code:'ZERO_MASS_UI_STALE'});
   dismiss();
   const result=await applyXml229OwnerConfirmedZero({
    session,drafts:getDrafts(),isCurrent:()=>current(session),
    saveDrafts,
    onProgress:({accepted,scanned,total})=>
     say('Recording confirmed 0 kg: '+accepted+' assigned; checked '+
       scanned+'/'+total+' physicals.'),
   });
   await render();
   say('Explicit 0 kg recorded as Final on '+result.accepted+
    ' blank physical(s). Existing weights and qualified suggestions retained. '+
    'Native CII output still requires independent verification.');
   return result;
  },
 });
}
