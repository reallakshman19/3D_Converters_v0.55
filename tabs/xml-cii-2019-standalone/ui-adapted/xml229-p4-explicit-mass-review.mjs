/**
 * Explicit single-owner review boundary for XML229's simplified Weight panel.
 * Preparing is read-only. Only confirmation writes through the existing
 * Worker-held CAS service, never directly to Final, XML or native CII.
 */
import {choiceForXml229WeightRow} from './xml229-p4-weight-review-presentation.mjs';
import {auditXml229AcceptedMatch1Row}
 from '../integration/xml229-accepted-match1-family-audit.mjs';

const deny=(code,message=code)=>{const e=new Error(message);e.code=code;throw e;};
const snapshot=draft=>JSON.stringify(draft||null);

/** Read the DOM itself: code which sets input.value without dispatching events
 * must not bypass second-click confirmation. */
export function xml229VisibleSingleReviewSnapshot(tr){
 if(!tr?.dataset?.p4Occurrence)deny('WEIGHT_REVIEW_VISIBLE_ROW_REQUIRED');
 return JSON.stringify({
  occurrenceId:tr.dataset.p4Occurrence,
  value:tr.querySelector('[data-p4-proposal]')?.value??null,
  reason:tr.querySelector('[data-p4-reason]')?.value?.trim()??null,
  proposalId:tr.dataset.p4PickedProposal||'',
 });
}
export async function prepareXml229ExplicitMassReview({
 session,row,stage,draft,typed,reason,isCurrent=()=>true,
 readVisible=()=>null,
}={}){
 if(!session?.receipt||typeof session.readIndividual!=='function'||
    !row?.occurrenceId||!['match1','final'].includes(stage))
   deny('WEIGHT_REVIEW_VERIFIED_SESSION_REQUIRED');
 const before=snapshot(draft),visible=readVisible();
 if(draft?.skippedWeight||typed==='0')
   deny('SKIPPED_OR_ZERO_WEIGHT_REQUIRES_DISPOSITION',
     'A 0 kg Skip draft is not an accepted zero or reviewed mass');
 if(stage==='match1'&&row.match1View?.stageDecision)
   deny('MATCH1_ALREADY_HAS_DECISION');
 if(stage==='final'&&row.finalView?.stageDecision)
   deny('FINAL_ALREADY_HAS_DECISION');
 if(stage==='final'&&!(Number(row.match1Kg)>0||Number(row.sourceKg)>0))
   deny('FINAL_PRECURSOR_REQUIRED',
     'Review a positive source or Match-1 mass before independent Final acceptance');
 const family=auditXml229AcceptedMatch1Row(row);
 if(stage==='final'&&family&&family.code!=='FAMILY_COMPATIBLE_ONLY')
   deny('FAMILY_ENGINEERING_HOLD',
     'Historical Match-1 family requires independent engineering disposition before Final');
 const value=typed||(stage==='final'&&Number(row.match1Kg)>0
   ?String(row.match1Kg):stage==='final'&&Number(row.sourceKg)>0
   ?String(row.sourceKg):'');
 if(!reason?.trim())
   deny('WEIGHT_REVIEW_REASON_REQUIRED','Supply an independent engineering reason');
 const {choice}=choiceForXml229WeightRow(row,{stage,value,reason,
  proposalId:stage==='match1'?(draft?.proposalId||''):''});
 const workerStage=stage==='final'?'Rigidmatch2':'RigidMatch1';
 if(!isCurrent())deny('WEIGHT_REVIEW_SOURCE_STALE');
 const view=await session.readIndividual({occurrenceId:row.occurrenceId,stage:workerStage});
 if(!isCurrent()||view?.basisId!==session.receipt.basisId||
    view?.sourceId!==session.receipt.sourceId||
    view?.stage!==workerStage||view?.occurrenceId!==row.occurrenceId)
   deny('WEIGHT_REVIEW_VIEW_STALE');
 // The caller must supply the live draft at this point, and DOM values must
 // not change during this asynchronous read. This view is CAS, not a grant.
 if(readVisible()!==visible)
   deny('WEIGHT_REVIEW_VISIBLE_EDIT_DURING_PREPARE');
 return Object.freeze({session,view,choice,occurrenceId:row.occurrenceId,
  stageLabel:stage==='final'?'Final Match-2':'Match-1',
  value,reason,draftJson:before,visibleJson:visible,
  reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false});
}
export async function commitXml229ExplicitMassReview({
 prepared,session,draft,isCurrent=()=>true,readVisible=()=>null,
}={}){
 if(!prepared||prepared.session!==session||typeof session?.review!=='function'||
    !isCurrent())deny('WEIGHT_REVIEW_PREPARE_STALE');
 if(snapshot(draft)!==prepared.draftJson||
    readVisible()!==prepared.visibleJson)
   deny('WEIGHT_REVIEW_DRAFT_CHANGED');
 const reviewed=await session.review({view:prepared.view,choice:prepared.choice});
 if(!isCurrent())deny('WEIGHT_REVIEW_SOURCE_STALE');
 if(!reviewed?.decisionRevision)deny('WEIGHT_REVIEW_DECISION_UNATTESTED');
 return reviewed;
}
