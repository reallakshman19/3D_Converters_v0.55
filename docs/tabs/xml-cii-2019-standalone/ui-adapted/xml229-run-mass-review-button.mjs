/** Run-stage automatic unresolved Final review offer, never automatic acceptance. */
import {openXml229RunUnresolvedMassPopup} from './xml229-run-unresolved-mass-popup.mjs';
import {getXml229CurrentWorkerHeldReview} from './xml-cii-adapted-p4-verified-weight-panel.js';

// One automatic offer per source-verified Worker across Run re-renders.
const offered=new WeakSet();
export function shouldAutoOfferXml229RunMassReview(report,approved=false){
 return !approved&&report?.raw?.xml229VerifiedEngineering===true&&
   report?.runHoldAudit?.diagnosisCode==='UNRESOLVED_PHYSICAL_MASS'&&
   report?.checklistRows?.some(r=>r.id==='weight-match'&&
     r.status==='pending')===true;
}
export function createXml229RunMassReviewButton({
 stateRef,render,approved,report,createElement,updateWorkflowState,noteDiv,
}={}){
 const button=createElement('button',
   approved?'Run - Review Weight Matches':'Review unresolved physicals (0 kg defaults)',
   'model-converters-run-btn');
 if(button.style)Object.assign(button.style,{width:'100%',padding:'12px'});
 const navigate=()=>{
   stateRef.current=updateWorkflowState(stateRef.current,{activePhaseId:'weight-match'});
   if(typeof render==='function')render();
 };
 const open=()=>void openXml229RunUnresolvedMassPopup({
   stateRef,render,onNavigate:navigate,
 }).catch(error=>{
   noteDiv.textContent='Unresolved mass review could not open ['+
     String(error?.code||'RUN_ZERO_REVIEW_UNAVAILABLE')+
     ']. The existing Final decisions were not modified; retry this button.';
 });
 button.addEventListener('click',open);
 // Initial Run paints can have no live completion. Offer only after the
 // source-bound Worker has independently refreshed the real HOLD audit.
 const xmlReview=!approved&&getXml229CurrentWorkerHeldReview(stateRef)?.receipt?.reviewSourceKind==='XML_ONLY';
 if(stateRef?.current?.activePhaseId==='run'&&
    (shouldAutoOfferXml229RunMassReview(report,approved)||xmlReview))queueMicrotask(async()=>{
   const session=getXml229CurrentWorkerHeldReview(stateRef);
   if(stateRef?.current?.activePhaseId!=='run'||
      button.isConnected!==true||!session||session.closed||offered.has(session))
     return;
   if(xmlReview){
     try{if(!((await session.readCompletion())?.counts?.unresolved>0))return;}
     catch{return;}
     if(stateRef?.current?.activePhaseId!=='run'||
       getXml229CurrentWorkerHeldReview(stateRef)!==session||!button.isConnected)return;
   }
   offered.add(session);
   open();
 });
 return button;
}
