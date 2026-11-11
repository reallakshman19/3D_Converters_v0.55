/**
 * XML229: exactly the Worker-owned guarded Match-1 bulk plan/commit protocol.
 * This module has no alternate scorer/decision writer. It delegates exclusively
 * to the portable GC-PW service and its exact source bulk action module.
 *
 * A rendered row, a proposal, or a click without the returned planId is
 * NEVER engineering review authority. Final/Match-2 is always independent.
 */
import {planExactSourceWeightCommands,commitExactSourceWeightCommands}
 from '../../../converters/xml-cii2019-core/weight-facts-bulk-decisions.js';

const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/** Return a read-only summary and a Worker-private plan. */
export function planXml229QualifiedBlankFill(review,projection,{
 basisId,sourceId,sequence,candidateEligibility=null,
}={}){
 if(!review||!projection||typeof projection.proposals!=='function'||
    typeof basisId!=='string'||!basisId||
    typeof sourceId!=='string'||!sourceId||
    !Number.isSafeInteger(sequence)||sequence<1)
   fail('VERIFIED_BULK_BASIS_REQUIRED','Current verified original source and proposal projection required');
 const plan=planExactSourceWeightCommands(review,{basisId,scopeId:sourceId});
 const final=review.getDecisionState({basisId,scopeId:sourceId,stage:'Rigidmatch2'});
 if(!object(final)||!object(final.decisions))
   fail('FINAL_REVIEW_UNAVAILABLE','Final decision state must be available before Match-1 bulk review');
 let excludedFinal=0,ambiguousQualified=0,notQualifiedAtGuard=0,excludedByScope=0;
 const commands=[],qualifiedSuggestions=[];
 for(let i=0;i<plan.commands.length;i+=80){
   const chunk=plan.commands.slice(i,i+80);
   const proposals=projection.proposals(chunk.map(c=>c.occurrenceId));
   if(!(proposals instanceof Map))
     fail('SOURCE_PROPOSALS_UNAVAILABLE','Verified original source proposal page is unavailable');
   for(const cmd of chunk){
     if(Object.hasOwn(final.decisions,cmd.occurrenceId)){
       excludedFinal++;continue;
     }
     const candidates=proposals.get(cmd.occurrenceId)||[];
     const selected=candidates.find(p=>p.proposalId===cmd.proposalId);
     if(!selected?.qualified){notQualifiedAtGuard++;continue;}
     if(candidateEligibility&&!candidateEligibility(cmd.occurrenceId,selected)){
       excludedByScope++;continue;
     }
     if(candidates.some(p=>
         p.qualified&&p.proposalId!==cmd.proposalId&&p.value!==selected.value)){
       ambiguousQualified++;continue;
     }
     // Read-only display evidence from the SAME Worker/CAS acceptance plan.
     // This is NOT an approval: only the separate planId commit can write.
     if(typeof selected.proposalId!=='string'||!selected.proposalId||
        typeof selected.value!=='number'||!Number.isFinite(selected.value)||
        selected.value<=0||selected.unit!=='kg')
       fail('BULK_DISPLAY_CANDIDATE_INVALID','Qualified plan contains an invalid kg proposal');
     qualifiedSuggestions.push(Object.freeze({
       occurrenceId:cmd.occurrenceId,proposalId:selected.proposalId,
       value:selected.value,unit:'kg',qualified:true,
     }));
     commands.push(cmd);
   }
 }
 const guarded={...plan,commands,qualified:commands.length};
 const planId=JSON.stringify([basisId,sourceId,plan.expectedDecisionRevision,
   final.decisionRevision,sequence,commands.length]);
 return {
   pending:{planId,plan:guarded,finalRevision:final.decisionRevision},
   summary:{planId,basisId,qualified:guarded.qualified,
     qualifiedSuggestions:Object.freeze(qualifiedSuggestions),unresolved:plan.unresolved,
     excludedFinal,ambiguousQualified,
     exclusions:{...plan.exclusions,
       finalDecisionPresent:excludedFinal,
       conflictingQualifiedCandidates:ambiguousQualified,
       planProjectionMismatch:notQualifiedAtGuard,
       excludedByScope,
       readyForConfirmation:commands.length},
     preservedSourceWeights:plan.preservedSourceWeights,
     alreadyReviewed:plan.alreadyReviewed,physicalCount:plan.physicalCount,
     reviewStage:'RigidMatch1',finalAcceptedAutomatically:false},
 };
}
/**
 * Must be called by the Worker after taking and clearing its pending plan.
 * Reject stale/fabricated planIds and ANY intervening Final revision or row.
 */
export function commitXml229QualifiedBlankFill(review,{
 basisId,sourceId,pending,planId,
}={}){
 if(!object(pending)||!pending.planId||
    typeof planId!=='string'||planId!==pending.planId||
    pending.plan?.basisId!==basisId||pending.plan?.scopeId!==sourceId)
   fail('BULK_PLAN_STALE','Review current qualified blank-only Match-1 bulk plan first');
 const currentFinal=review.getDecisionState({
   basisId,scopeId:sourceId,stage:'Rigidmatch2'});
 if(currentFinal.decisionRevision!==pending.finalRevision||
    pending.plan.commands.some(cmd=>Object.hasOwn(currentFinal.decisions,cmd.occurrenceId)))
   fail('BULK_FINAL_REVIEW_CHANGED','Final review changed since blank-only bulk plan; replan');
 const result=commitExactSourceWeightCommands(review,pending.plan);
 return {basisId,acceptedCount:result.length,stage:'RigidMatch1',
   finalAcceptedAutomatically:false};
}
