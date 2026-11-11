// Canonical single-physical Weight UI boundary. DOM-free and source-local.
// An attested GC-PW session comes from the integrator's accepted worker fact pages.
import { decodePhysicalOccurrenceId } from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
const STAGES=new Set(['RigidMatch1','Rigidmatch2']);
const MASS=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function fail(code,details){const e=new Error(details);e.code=code;e.retryable=false;throw e;}
function ready(session,scopeId,occurrenceId,stage) {
  if(!STAGES.has(stage))fail('INVALID_REVIEW_STAGE','Match-1 or Final Match-2 required');
  const b=session?.basis,r=session?.review;
  if(!b||!(/^[a-f0-9]{64}$/i).test(b.basisId)||
     !Number.isSafeInteger(session.openedFacts)||session.openedFacts<1||
     !Array.isArray(b.sourceRefs)||!Array.isArray(b.scope)||
     !r||['getFacts','getProposals','getDecisionState','applyDecisions','freezeSnapshot'].some(k=>typeof r[k]!=='function'))
    fail('VERIFIED_SESSION_REQUIRED','A completed canonical source facts session is required');
  if(!b.scope.some(s=>s.sourceId===scopeId)||!b.sourceRefs.some(s=>s.sourceId===scopeId))
    fail('SOURCE_SCOPE_CONFLICT','Requested source is not selected in the verified basis');
  let decoded;try{decoded=decodePhysicalOccurrenceId(occurrenceId);}
  catch{fail('NONCANONICAL_WEIGHT_OCCURRENCE','Original branch/node ordinals and component signature required');}
  if(decoded.sourceId!==scopeId)
    fail('SOURCE_SCOPE_CONFLICT','A physical occurrence cannot be accepted in a different source');
  return {basis:b,service:r};
}
function sourceFacts(service,basisId,sourceId,occurrenceId) {
  // Walk all source pages; never use a visible/list-limited UI subset.
  let cursor=null,total=null;const cursors=new Set(),all=[];
  do{
    const page=service.getFacts({basisId,sourceId,subjectType:'physical-component',cursor,limit:500});
    if(!page||page.complete!==true||!Array.isArray(page.items)||
       !Number.isSafeInteger(page.totalCount)||page.totalCount<1||
       (total!==null&&total!==page.totalCount)||
       page.items.some(x=>x.sourceId!==sourceId||x.subjectType!=='physical-component'))
      fail('INCOMPLETE_SOURCE_FACTS','Selected physical source facts must be complete');
    total=page.totalCount;all.push(...page.items);
    cursor=page.nextCursor;
    if(cursor!==null&&(typeof cursor!=='string'||cursors.has(cursor)))
      fail('STALE_SOURCE_CURSOR','Unstable physical source page cursor');
    if(cursor!==null)cursors.add(cursor);
  }while(cursor!==null);
  if(all.length!==total)fail('INCOMPLETE_SOURCE_FACTS','Physical source fact population truncated');
  const facts=all.filter(x=>x.occurrenceId===occurrenceId);
  if(!facts.length||!facts.some(x=>x.fieldId==='mass.kg'))
    fail('UNKNOWN_PHYSICAL_OCCURRENCE','Requested identity is not a selected original physical component');
  return facts;
}
function sourceWeight(facts){
  const row=facts.find(f=>f.fieldId==='mass.kg'&&f.authority==='source'&&MASS(f.value));
  return row?.value??null;
}
export function readVerifiedIndividualWeightReview(session,{sourceId,occurrenceId,stage='RigidMatch1'}={}) {
  const {basis,service}=ready(session,sourceId,occurrenceId,stage);
  const facts=sourceFacts(service,basis.basisId,sourceId,occurrenceId);
  const match1=service.getDecisionState({basisId:basis.basisId,scopeId:sourceId,stage:'RigidMatch1'});
  const final=service.getDecisionState({basisId:basis.basisId,scopeId:sourceId,stage:'Rigidmatch2'});
  const selected=stage==='RigidMatch1'?match1:final;
  const proposals=service.getProposals({basisId:basis.basisId,occurrenceIds:[occurrenceId],limit:500});
  if(proposals.complete!==true||proposals.nextCursor!==null||
    proposals.items.length!==proposals.totalCount||
    proposals.items.some(p=>p.basisId!==basis.basisId||p.occurrenceId!==occurrenceId))
    fail('INCOMPLETE_PROPOSALS','Ranked candidates are not complete or source-bound');
  const sourceKg=sourceWeight(facts);
  const m=match1.decisions[occurrenceId],f=final.decisions[occurrenceId];
  return {
    basisId:basis.basisId,sourceId,occurrenceId,stage,
    stageRevision:selected.decisionRevision,
    match1Revision:match1.decisionRevision,finalRevision:final.decisionRevision,
    stageDecision:selected.decisions[occurrenceId]??null,
    sourceKg,
    match1Kg:m?.state==='accepted'?m.value:null,
    finalKg:f?.state==='accepted'?f.value:null,
    effectiveKg:f?.state==='accepted'?f.value:(m?.state==='accepted'?m.value:sourceKg),
    proposals:proposals.items.map(p=>({proposalId:p.proposalId,ranking:p.ranking,
      value:p.value,unit:p.unit,qualified:p.qualified,method:p.method,
      eligibilityReasons:p.eligibilityReasons??[]})),
  };
}
export function commitVerifiedIndividualWeightReview(session,view,choice={}) {
  if(!view||!STAGES.has(view.stage))fail('INVALID_REVIEW_VIEW','A source-bound review view is required');
  const current=readVerifiedIndividualWeightReview(session,{
    sourceId:view.sourceId,occurrenceId:view.occurrenceId,stage:view.stage});
  if(JSON.stringify(current)!==JSON.stringify(view))
    fail('STALE_INDIVIDUAL_REVIEW','Basis, candidates, Match-1 or Final decision changed; reopen review');
  const action=choice?.action;
  const reason=typeof choice.reason==='string'?choice.reason.trim():'';
  if(!['accept-proposal','enter-manual','final-override','reject','defer'].includes(action))
    fail('INVALID_REVIEW_ACTION','An explicit engineering review action is required');
  if(view.stage==='Rigidmatch2'&&['accept-proposal','enter-manual'].includes(action)||
     view.stage==='RigidMatch1'&&action==='final-override')
    fail('STAGE_CONFLICT','Final manual override is distinct from Match-1 proposal acceptance');
  let value=null,proposalId=null;
  if(action==='accept-proposal'){
    const candidate=current.proposals.find(p=>p.proposalId===choice.proposalId);
    if(!candidate)fail('STALE_PROPOSAL','Accept only a displayed pinned ranked proposal');
    if(!candidate.qualified&&!reason)
      fail('UNQUALIFIED_PROPOSAL','Inferred/factor/fallback proposal requires engineer review reason');
    if(!MASS(candidate.value)||candidate.unit!=='kg')
      fail('INVALID_REVIEW_WEIGHT','Proposed mass must be positive kg');
    value=candidate.value;proposalId=candidate.proposalId;
  }
  if(['enter-manual','final-override'].includes(action)){
    if(!MASS(choice.value)||choice.unit!=='kg'||!reason)
      fail('ENGINEERING_REASON_REQUIRED','Manual and Final accepted mass requires explicit positive kg and reason');
    value=choice.value;
  }
  if(['reject','defer'].includes(action)&&!reason)
    fail('ENGINEERING_REASON_REQUIRED','Reject and Defer require engineering reason');
  if(MASS(current.sourceKg)&&MASS(value)&&current.sourceKg!==value&&!reason)
    fail('SOURCE_OVERRIDE_REASON_REQUIRED','A changed source mass requires explicit reason');
  if(current.stageDecision?.state==='accepted'&&current.stageDecision.value!==value&&!reason)
    fail('OVERWRITE_REQUIRES_REASON','Changing accepted review value needs a reason');
  const cmd={commandId:JSON.stringify(['individual',current.basisId,current.sourceId,
    current.occurrenceId,current.stage,current.stageRevision,action,proposalId,value,reason]),
    basisId:current.basisId,scopeId:current.sourceId,
    occurrenceId:current.occurrenceId,expectedDecisionRevision:current.stageRevision,
    action};
  if(proposalId)cmd.proposalId=proposalId;
  if(MASS(value)){cmd.value=value;cmd.unit='kg';}
  if(reason)cmd.reason=reason;
  const result=session.review.applyDecisions({basisId:current.basisId,scopeId:current.sourceId,
    stage:current.stage,expectedDecisionRevision:current.stageRevision,commands:[cmd]});
  const snapshot=session.review.freezeSnapshot({basisId:current.basisId,scopeId:current.sourceId,
    stage:current.stage,expectedDecisionRevision:result[0].decisionRevision});
  return {result:result[0],snapshot,view:readVerifiedIndividualWeightReview(session,{
    sourceId:current.sourceId,occurrenceId:current.occurrenceId,stage:current.stage})};
}
