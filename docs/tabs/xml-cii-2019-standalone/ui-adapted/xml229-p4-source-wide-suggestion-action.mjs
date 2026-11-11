/** Source-wide suggestion scan; drafts only, no GC-PW review writer. */
import {planXml229RigidWeightDrafts,planXml229UnqualifiedDrafts} from './xml229-p4-unqualified-drafts.mjs';
import {planXml229SkipWeightDrafts} from './xml229-p4-skip-weight-drafts.mjs';
import {revealXml229PreparedWeightInput} from './xml229-p4-reveal-applied-weight.mjs';
const deny=(code,message)=>{const e=new Error(message||code);e.code=code;throw e;};
export async function applyXml229SourceWideSuggestionDrafts({
 session,drafts,minScorePercent,isCurrent,saveDrafts,showFirst,render,table,detail,say,
}={}){
 if(typeof session?.planQualifiedBlankFill!=='function'||!(drafts instanceof Map)||
    typeof isCurrent!=='function'||typeof saveDrafts!=='function'||
    typeof showFirst!=='function'||typeof render!=='function')
   deny('SUGGESTION_SOURCE_BOUND_WORKSPACE_REQUIRED');
 say('Filling Applied Weight from source-linked suggestions ≥'+minScorePercent+'%...');
 const beforeFinal=typeof session.readCompletion==='function'
  ?(await session.readCompletion())?.counts?.final:null;
 const plan=await session.planQualifiedBlankFill({minScorePercent});
 if(!Number.isSafeInteger(plan?.qualified)||!Array.isArray(plan.qualifiedSuggestions)||
    plan.qualifiedSuggestions.length!==plan.qualified)
   deny('SUGGESTION_WORKER_PLAN_INCOMPLETE',
     'Worker qualified-count and source-proposal evidence do not match');
 const planned=await planXml229RigidWeightDrafts(session,{
  existingDrafts:drafts,minScorePercent,qualifiedSuggestions:plan.qualifiedSuggestions,
  isCurrent,
 });
 if(!isCurrent())deny('STALE_WEIGHT_AUTO_FILL_SOURCE');
 for(const [id,draft] of planned.drafts)
  if(!drafts.has(id))drafts.set(id,draft);
 saveDrafts();
 if(planned.firstPreparedIndex!==null)showFirst(planned.firstPreparedIndex);
 const visiblePopulated=await render();
 if(planned.counts.prepared>0&&!(visiblePopulated>0))
   deny('SUGGESTION_VISIBLE_INPUT_NOT_APPLIED',
     'No actual proposed kilograms were populated on the selected page');
 if(visiblePopulated>0&&!revealXml229PreparedWeightInput(table)){
   // Once a selected input is accepted as Final during render, a blank-only
   // filter may remove that row. A real Worker Final-count increase is a
   // stronger proof of successful application than a stale draft DOM marker.
   const afterFinal=typeof session.readCompletion==='function'
    ?(await session.readCompletion())?.counts?.final:null;
   if(!Number.isSafeInteger(beforeFinal)||!Number.isSafeInteger(afterFinal)||
      afterFinal<=beforeFinal)
    deny('SUGGESTION_INPUT_OUTSIDE_VIEWPORT',
      'Applied kg could not be revealed or attested as Worker Final');
 }
 detail.hidden=true;detail.textContent='';
 const confirm=table.querySelector('[data-p4-bulk-confirm]');
 if(confirm){confirm.disabled=!plan.qualified;
  confirm.textContent='Apply all Match-1 ('+plan.qualified+')';}
 const c=planned.counts;
 say('Apply all suggestions ≥'+minScorePercent+'%: '+c.prepared+
   ' Applied Weight value(s) filled across the verified source. '+
   visiblePopulated+' actual kg input(s) populated on this page; first input revealed. '+
   c.workerQualified+' source-qualified candidate(s) reconciled ('+
   c.workerQualifiedPrepared+' newly filled, '+
   c.workerQualifiedAlreadyDrafted+' existing values kept, '+
   c.manualConflictsPreserved+' manual edit conflicts preserved); '+
   c.preparedUnqualified+' estimated suggestions (≈). '+
   c.withoutProposal+' no proposal, '+c.belowThreshold+
   ' below threshold. Applied Weight selections saved; native CII output remains HELD.');
 return {planned,visiblePopulated,reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false};
}

/** Zero drafts and unqualified candidates are dispositions-in-progress,
 * never accepted zero masses, Final decisions or native CII payloads. */
export async function applyXml229BlankWeightDrafts({
 kind,session,drafts,isCurrent,saveDrafts,resetView,render,detail,
}={}){
 if(!['skip','unqualified'].includes(kind)||!(drafts instanceof Map)||
    typeof isCurrent!=='function'||typeof saveDrafts!=='function'||
    typeof resetView!=='function'||typeof render!=='function')
   deny('BLANK_WEIGHT_DRAFT_ACTION_REQUIRED');
 const planned=kind==='skip'
  ?await planXml229SkipWeightDrafts(session,{existingDrafts:drafts,isCurrent})
  :await planXml229UnqualifiedDrafts(session,{existingDrafts:drafts,isCurrent});
 if(!isCurrent())deny('BLANK_WEIGHT_DRAFT_SOURCE_STALE');
 for(const [id,draft] of planned.drafts)
   if(!drafts.has(id))drafts.set(id,draft);
 saveDrafts();
 if(kind==='skip'){detail.hidden=true;detail.textContent='';}
 resetView(kind);
 await render();
 if(kind==='skip')
  return 'Skip Weight: '+planned.counts.skipped+
    ' blank eligible weight row(s) filled with 0 kg DRAFT. '+
    planned.counts.alreadyEdited+' existing drafts kept; '+
    planned.counts.existingReview+' reviewed rows untouched. '+
    '0 kg is not verified engineering mass and does not enter CII/Final automatically.';
 const c=planned.counts;
 return c.prepared+' new unqualified editable draft(s) across '+c.blankRigid+
   ' blank RIGIDs; '+c.withoutProposal+' have no proposal, '+
   c.qualifiedPresent+' have qualified candidates and '+c.alreadyDrafted+
   ' already had local drafts. Zero decisions accepted. Drafts are InputBasis-bound.';
}
