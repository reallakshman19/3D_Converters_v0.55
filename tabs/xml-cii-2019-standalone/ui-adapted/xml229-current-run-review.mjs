/** Single-source Run review routing only; never releases native CII or writes legacy kg maps. */
import {getXml229CurrentWorkerHeldReview,openXml229P4VerifiedSession} from './xml-cii-adapted-p4-verified-weight-panel.js';
import {openXml229RunUnresolvedMassPopup} from './xml229-run-unresolved-mass-popup.mjs';
import {isXml229XmlOnlyApproved} from '../integration/xml229-output-participation.mjs';
import {isXml229VerifiedReviewCompletionForInput} from '../integration/xml229-live-preview-restoration.mjs';
export async function handleXml229CurrentRunReview(stateRef,render,ports={}){
 const state=stateRef.current;
 if(state.xmlProcessingMode==='mode-b'||!/<PipeStressExport(?:\s|>)/.test(state.sourceText||'')||
   isXml229XmlOnlyApproved(state))return false;
 try{
   const get=ports.getReview||getXml229CurrentWorkerHeldReview;
   const session=get(stateRef)||await (ports.openSession||openXml229P4VerifiedSession)(stateRef);
   const proof=await session.readCompletion();
   if(!await isXml229VerifiedReviewCompletionForInput(
     (stateRef.modeABaseRef||stateRef).current,session.receipt,proof))
     throw Object.assign(new Error('Current source review could not be verified'),{code:'RUN_REVIEW_SOURCE_UNVERIFIED'});
   if(proof.counts.unresolved>0){
     await (ports.openPopup||openXml229RunUnresolvedMassPopup)({stateRef,render});
     return true;
   }
   stateRef.current={...stateRef.current,xml229CurrentRunReviewStatus:
     'Final mass review is complete. Checking current Run eligibility and native output reconciliation.'};
 }catch(error){stateRef.current={...stateRef.current,xml229CurrentRunReviewStatus:
   'Run review HELD ['+String(error?.code||'CURRENT_REVIEW_UNAVAILABLE')+']. Build 4 Preview on the current source and masters.'};}
 render?.();return true;
}
