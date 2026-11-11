/**
 * Source-wide, read-only unqualified Weight draft planning.
 * This never calls the GC-PW review decision writer. No draft is a mass fact.
 * Returned entries live only in the UI's current Worker/session memory.
 */
import {xml229WeightReviewEligible,xml229ProposalScorePercent,xml229WeightThreshold}
 from '../integration/xml229-weight-review-focus.mjs';
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const deny=code=>{const e=new Error(code);e.code=code;throw e;};
const safeCount=x=>whole(x)?x:0;

export function formatXml229Match1Exclusions(plan){
 const x=plan?.exclusions||{};
 return [
  'Match-1 source-wide plan — '+safeCount(plan?.qualified)+' ready for explicit confirmation',
  'Original source mass: '+safeCount(x.sourceMassPresent),
  'Existing Match-1 decision (accepted/rejected/deferred): '+safeCount(x.match1DecisionPresent),
  'No rank-1 proposal: '+safeCount(x.noRank1Proposal),
  'Rank-1 not qualified: '+safeCount(x.topRankUnqualified),
  '  Of those, qualified only at lower rank: '+safeCount(x.lowerRankQualified),
  'Invalid rank-1 kg: '+safeCount(x.topRankInvalidMass),
  'Wrong rank-1 unit: '+safeCount(x.topRankInvalidUnit),
  'Existing Final decision: '+safeCount(x.finalDecisionPresent),
  'Conflicting qualified values: '+safeCount(x.conflictingQualifiedCandidates),
  'Source-proposal mismatch: '+safeCount(x.planProjectionMismatch),
  'Excluded by component scope or minimum score: '+safeCount(x.excludedByScope),
  'Review decisions are unchanged until separately confirmed. Final/native CII remain independent.',
 ].join('\n');
}

/** 
 * Prepare UI-only source-wide blank RIGID proposals, including qualified ones.
 * The actual qualified bulk acceptance list remains exclusively Worker-owned.
 * This function NEVER writes to the review ledger, even for qualified proposals.
 */
export async function planXml229RigidWeightDrafts(session,{
 existingDrafts=new Map(),isCurrent=()=>true,unqualifiedOnly=false,minScorePercent=0,
 qualifiedSuggestions=[],
}={}){
 if(!session?.receipt?.basisId||typeof session.readPage!=='function'||
    !(existingDrafts instanceof Map)||typeof isCurrent!=='function'||
    !Array.isArray(qualifiedSuggestions)||qualifiedSuggestions.length>10000)
   deny('UNQUALIFIED_DRAFT_SOURCE_REQUIRED');
 const minScore=xml229WeightThreshold(minScorePercent);
 const basisId=session.receipt.basisId,sourceId=session.receipt.sourceId;
 const limit=25,limitPhysical=10000,drafts=new Map();
 // Verify the *same* qualified Worker bulk plan against each original
 // read-only row rather than independently re-ranking all qualified rows.
 const qualifiedById=new Map(),qualifiedSeen=new Set();
 for(const entry of qualifiedSuggestions){
   if(typeof entry?.occurrenceId!=='string'||!entry.occurrenceId||
      typeof entry.proposalId!=='string'||!entry.proposalId||
      !positive(entry.value)||entry.qualified!==true||entry.unit!=='kg'||
      qualifiedById.has(entry.occurrenceId))
     deny('SUGGESTION_WORKER_PLAN_INVALID');
   qualifiedById.set(entry.occurrenceId,entry);
 }
 let firstPreparedIndex=null;
 const counts={blankRigid:0,withoutProposal:0,qualifiedPresent:0,
   unqualifiedInvalid:0,existingReview:0,alreadyDrafted:0,
   conflictingQualifiedValues:0,belowThreshold:0,preparedQualified:0,preparedUnqualified:0,
   workerQualified:qualifiedById.size,workerQualifiedPrepared:0,workerQualifiedAlreadyDrafted:0,
   prepared:0};
 let total=null,offset=0,matchRevision=null,finalRevision=null;
 do{
   if(!isCurrent())deny('UNQUALIFIED_DRAFT_STALE_SOURCE');
   const page=await session.readPage({offset,limit,filter:'blank-rigid',query:''});
   if(!isCurrent())deny('UNQUALIFIED_DRAFT_STALE_SOURCE');
   if(page?.basisId!==basisId||page?.complete!==true||page.offset!==offset||
      !whole(page.totalCount)||page.totalCount>limitPhysical||
      !Array.isArray(page.rows)||page.rows.length!==Math.min(limit,page.totalCount-offset)||
      (total!==null&&total!==page.totalCount))
     deny('UNQUALIFIED_DRAFT_PAGE_DRIFT');
   if(total===null)total=page.totalCount;
   for(let index=0;index<page.rows.length;index++){
     const row=page.rows[index];
     if(!row||row.sourceId!==sourceId||typeof row.occurrenceId!=='string'||
        !row.occurrenceId||!xml229WeightReviewEligible(row)||
        positive(row.sourceKg)||positive(row.match1Kg)||positive(row.finalKg)||
        drafts.has(row.occurrenceId))
       deny('UNQUALIFIED_DRAFT_ROW_DRIFT');
     counts.blankRigid++;
     const required=qualifiedById.get(row.occurrenceId);
     if(required){
       if(qualifiedSeen.has(row.occurrenceId))
         deny('SUGGESTION_WORKER_PLAN_DUPLICATE_ROW');
       qualifiedSeen.add(row.occurrenceId);
       const projected=(row.proposals||[]).find(p=>p.proposalId===required.proposalId);
       const pinned=(row.match1View?.proposals||[]).find(p=>p.proposalId===required.proposalId);
       if(!projected||!pinned||projected.ranking!==1||
          !projected.qualified||!pinned.qualified||
          projected.value!==required.value||pinned.value!==required.value||
          pinned.unit!=='kg'||minScore>0&&
          (xml229ProposalScorePercent(projected)??-1)<minScore)
         deny('SUGGESTION_WORKER_PLAN_PROPOSAL_DRIFT');
     }
     if(row.match1View?.stageDecision||row.finalView?.stageDecision){
       counts.existingReview++;continue;
     }
     if(matchRevision===null){
       matchRevision=row.match1View?.match1Revision;
       finalRevision=row.finalView?.finalRevision;
     }else if(row.match1View?.match1Revision!==matchRevision||
              row.finalView?.finalRevision!==finalRevision)
       deny('UNQUALIFIED_DRAFT_REVIEW_DRIFT');
     if(required&&firstPreparedIndex===null)firstPreparedIndex=offset+index;
     if(existingDrafts.has(row.occurrenceId)){
       const saved=existingDrafts.get(row.occurrenceId);
       // A human-edited kg value or Manual selection must NEVER be
       // silently bulk-approved as a different Worker-ranked proposal.
       if(required&&!saved?.skippedWeight&&
          (String(saved?.value)!==String(required.value)||
          saved?.proposalId!==required.proposalId))
         deny('SUGGESTION_MANUAL_DRAFT_CONFLICT');
       counts.alreadyDrafted++;
       if(required)counts.workerQualifiedAlreadyDrafted++;
       continue;
     }
     const proposals=Array.isArray(row.proposals)?row.proposals:[];
     if(!proposals.length){counts.withoutProposal++;continue;}
     const qualified=proposals.filter(p=>p.qualified===true);
     if(unqualifiedOnly&&qualified.length){counts.qualifiedPresent++;continue;}
     const top=required
       ?proposals.find(p=>p.proposalId===required.proposalId)
       :proposals.find(p=>p.ranking===1);
     const pinned=Array.isArray(row.match1View?.proposals)
       ?row.match1View.proposals.find(p=>p.proposalId===top?.proposalId):null;
     if(!top||!positive(top.value)||!top.proposalId||
       typeof top.proposalId!=='string'||
       (Array.isArray(row.match1View?.proposals)&&
         (!pinned||pinned.value!==top.value||pinned.qualified!==top.qualified||
          pinned.unit!=='kg'))||
       (unqualifiedOnly&&top.qualified!==false)){
       counts.unqualifiedInvalid++;continue;
     }
     if(minScore>0&&(xml229ProposalScorePercent(top)??-1)<minScore){
       counts.belowThreshold++;continue;
     }
     if(qualified.some(p=>p.proposalId!==top.proposalId&&p.value!==top.value))
       counts.conflictingQualifiedValues++;
     if(firstPreparedIndex===null)firstPreparedIndex=offset+index;
     if(required)counts.workerQualifiedPrepared++;
     drafts.set(row.occurrenceId,Object.freeze({
       proposalId:top.proposalId,value:String(top.value),reason:'',
       autoUnqualified:top.qualified!==true,autoFilled:true,
     }));
     if(top.qualified)counts.preparedQualified++;
     else counts.preparedUnqualified++;
     counts.prepared++;
   }
   offset+=page.rows.length;
 }while(offset<total);
 if(!isCurrent())deny('UNQUALIFIED_DRAFT_STALE_SOURCE');
 if(qualifiedSeen.size!==qualifiedById.size||
    counts.workerQualifiedPrepared+counts.workerQualifiedAlreadyDrafted!==qualifiedById.size)
   deny('SUGGESTION_WORKER_PLAN_POPULATION_DRIFT');
 return Object.freeze({basisId,sourceId,firstPreparedIndex,counts:Object.freeze(counts),
   drafts,reviewDecisionsAuthorized:false,finalAcceptedAutomatically:false,
   nativeCiiReleaseAuthorized:false});
}

/** Backward-compatible unqualified-only convenience action. */
export async function planXml229UnqualifiedDrafts(session,options={}){
 return planXml229RigidWeightDrafts(session,{...options,unqualifiedOnly:true});
}


/**
 * Shared by the live panel and Chromium regression. The returned count is
 * measured from REAL number-input.value and selected option.value, not a
 * placeholder or a calculated count. Never invokes the review writer.
 */
export function hydrateXml229WeightDraftInputs(table,rows,draftValues){
 if(!table?.querySelectorAll||!Array.isArray(rows)||!(draftValues instanceof Map))
   deny('SUGGESTION_VISIBLE_TABLE_REQUIRED');
 let visiblePopulated=0;
 for(const tr of table.querySelectorAll('tr[data-p4-row]')){
   const row=rows[Number(tr.dataset.p4Row)];
   const saved=row&&draftValues.get(row.occurrenceId);
   if(!saved||row.occurrenceId!==tr.dataset.p4Occurrence)continue;
   if(row.match1View?.stageDecision||row.finalView?.stageDecision){
     draftValues.delete(row.occurrenceId);continue;
   }
   const candidate=(row.proposals||[]).find(p=>p.proposalId===saved.proposalId);
   if(saved.autoFilled&&saved.proposalId&&(!candidate||!positive(candidate.value)||
      String(candidate.value)!==String(saved.value)))
     deny('SUGGESTION_VISIBLE_PROPOSAL_DRIFT');
   const input=tr.querySelector('[data-p4-proposal]');
   const selection=tr.querySelector('[data-p4-candidate]');
   const reason=tr.querySelector('[data-p4-reason]');
   if(!input)deny('SUGGESTION_VISIBLE_INPUT_MISSING');
   input.value=saved.value;
   if(selection)selection.value=saved.proposalId;
   else tr.dataset.p4PickedProposal=saved.proposalId||'';
   if(reason)reason.value=saved.reason||'';
   if(input.value!==String(saved.value)||
      (selection&&selection.value!==saved.proposalId))
     deny('SUGGESTION_VISIBLE_INPUT_NOT_APPLIED');
   tr.dataset.p4DraftFilled='true';
   const flag=tr.querySelector('[data-p4-draft-marker]');
   if(flag)flag.textContent=saved.skippedWeight
     ?'Skipped: 0 kg draft (NOT an accepted zero mass)'
     :saved.autoUnqualified
       ?'Suggestion needs engineering review — draft only'
       :'Applied Weight is an editable draft — no approval';
   visiblePopulated++;
 }
 return visiblePopulated;
}
