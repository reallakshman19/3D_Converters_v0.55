// Explicit-click Match-1 actions for verified GC-PW Mode A sources.
// The plan walks complete FactRecord pages, never visible UI or legacy row keys.
import { planExactSourceWeightCommands, commitExactSourceWeightCommands } from './weight-facts-bulk-decisions.js';
const fail=(code,message)=>{const e=new Error(message);e.code=code;e.retryable=false;throw e;};
function checked(session) {
  const b=session?.basis, review=session?.review;
  if(!b || !/^[a-f0-9]{64}$/i.test(b.basisId) || !Array.isArray(b.scope) ||
      !Array.isArray(b.sourceRefs) || !Number.isSafeInteger(session.openedFacts) ||
      session.openedFacts<1 || !review ||
      ['getFacts','getProposals','getDecisionState','applyDecisions'].some(k=>typeof review[k]!=='function'))
    fail('VERIFIED_SESSION_REQUIRED','A completed canonical Preview-to-Weight session is required');
  const sources=[...new Set(b.scope.map(x=>x.sourceId))].sort();
  const authorized=new Set(b.sourceRefs.map(x=>x.sourceId));
  if(!sources.length || sources.some(id=>typeof id!=='string'||!authorized.has(id)))
    fail('INVALID_SELECTION_SCOPE','Selected source scope is inconsistent with BasisRef');
  return {basisId:b.basisId,sources,review};
}
export function planVerifiedModeAExactMatch1(session) {
  const {basisId,sources,review}=checked(session);
  const plans=sources.map(scopeId=>planExactSourceWeightCommands(review,{basisId,scopeId}));
  return {basisId,stage:'RigidMatch1',sources,plans,
    physicalCount:plans.reduce((sum,p)=>sum+p.physicalCount,0),
    preservedSourceWeights:plans.reduce((sum,p)=>sum+p.preservedSourceWeights,0),
    alreadyReviewed:plans.reduce((sum,p)=>sum+p.alreadyReviewed,0),
    unresolved:plans.reduce((sum,p)=>sum+p.unresolved,0),
    qualified:plans.reduce((sum,p)=>sum+p.commands.length,0)};
}
export function commitVerifiedModeAExactMatch1(session,plan) {
  const {basisId,sources,review}=checked(session);
  if(!plan || plan.basisId!==basisId || plan.stage!=='RigidMatch1' ||
      !Array.isArray(plan.sources) || !Array.isArray(plan.plans) ||
      JSON.stringify(plan.sources)!==JSON.stringify(sources) || plan.plans.length!==sources.length)
    fail('INVALID_REVIEW_PLAN','Requested exact plan does not match canonical source selection');
  // Recompute every source revision and eligible proposal BEFORE any mutation.
  if(JSON.stringify(plan)!==JSON.stringify(planVerifiedModeAExactMatch1(session)))
    fail('STALE_REVIEW_PLAN','Fact, proposal or another source decision changed; replan');
  const committedSources=[],results=[];
  for(const p of plan.plans) {
    try {
      const rows=commitExactSourceWeightCommands(review,p);
      committedSources.push(p.scopeId);
      results.push({sourceId:p.scopeId,accepted:rows.length});
    } catch(error) {
      const failure=new Error('Partial Mode A review: '+String(error?.message||error));
      failure.code='PARTIAL_MULTI_SOURCE_REVIEW';
      failure.completedSources=committedSources;
      failure.failedSource=p.scopeId;
      failure.cause=error;
      throw failure;
    }
  }
  return {basisId,stage:'RigidMatch1',committedSources,results,
    accepted:results.reduce((sum,row)=>sum+row.accepted,0)};
}
