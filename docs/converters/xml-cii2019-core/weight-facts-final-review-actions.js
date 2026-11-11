// Explicit engineer Final Match-2 commands over the complete verified source population.
// No XML, DOM, worker or output writer dependency.
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const fail = (code, detail) => { const e = new Error(detail); e.code = code; e.retryable = false; throw e; };
function opened(session) {
  const b=session?.basis, service=session?.review;
  if (!b || !/^[a-f0-9]{64}$/i.test(b.basisId) || !Array.isArray(b.scope) ||
      !Array.isArray(b.sourceRefs) || !Number.isSafeInteger(session.openedFacts) ||
      session.openedFacts<1 || !service ||
      ['getFacts','getDecisionState','applyDecisions','freezeSnapshot'].some(k=>typeof service[k]!=='function'))
    fail('VERIFIED_SESSION_REQUIRED','Final review requires completed, independently verified canonical facts');
  const sources=[...new Set(b.scope.map(x=>x.sourceId))].sort();
  const allowed=new Set(b.sourceRefs.map(x=>x.sourceId));
  if(!sources.length || sources.some(x=>!x || !allowed.has(x)))
    fail('INVALID_SELECTION_SCOPE','Selected physical sources must be in InputBasis');
  return {basisId:b.basisId,sources,service};
}
function factsFor(service,basisId,sourceId) {
  let cursor=null,total=null;const seenCursors=new Set(),facts=[];
  do {
    const p=service.getFacts({basisId,sourceId,subjectType:'physical-component',cursor,limit:500});
    if(!p || p.complete!==true || !Array.isArray(p.items) || !Number.isSafeInteger(p.totalCount) ||
       (total!==null && total!==p.totalCount) || p.items.some(f=>f.sourceId!==sourceId ||
       f.subjectType!=='physical-component' || !f.occurrenceId))
      fail('INCOMPLETE_FINAL_FACTS','Final cannot review incomplete or cross-source physical facts');
    total=p.totalCount;
    facts.push(...p.items);
    cursor=p.nextCursor;
    if(cursor!==null && (typeof cursor!=='string' || seenCursors.has(cursor)))
      fail('STALE_FINAL_CURSOR','Final fact cursor reused or malformed');
    if(cursor!==null) seenCursors.add(cursor);
  } while(cursor!==null);
  if(facts.length!==total) fail('INCOMPLETE_FINAL_FACTS','Final source physical field population truncated');
  const byId=new Map();
  for(const fact of facts) {
    if(!byId.has(fact.occurrenceId)) byId.set(fact.occurrenceId,[]);
    byId.get(fact.occurrenceId).push(fact);
  }
  return byId;
}
function sourceMass(facts) {
  const source=facts.find(f=>f.fieldId==='mass.kg' && f.authority==='source' && positive(f.value));
  return source?.value ?? null;
}
export function planVerifiedFinalMatch2(session, choices=[]) {
  const {basisId,sources,service}=opened(session);
  if(!Array.isArray(choices)) fail('INVALID_FINAL_CHOICES','Explicit Final choices array required');
  const offered=new Map();
  for(const c of choices) {
    if(!c || typeof c.sourceId!=='string' || typeof c.occurrenceId!=='string' ||
       !positive(c.value) || (c.unit!==undefined && c.unit!=='kg') ||
       typeof c.reason!=='string' || !c.reason.trim())
      fail('ENGINEERING_FINAL_REASON_REQUIRED','Every explicit Final override needs positive kg and an engineering reason');
    const id=JSON.stringify([c.sourceId,c.occurrenceId]);
    if(offered.has(id)) fail('DUPLICATE_FINAL_CHOICE','The same physical occurrence has two Final overrides');
    offered.set(id,{sourceId:c.sourceId,occurrenceId:c.occurrenceId,value:c.value,
      unit:'kg',reason:c.reason.trim()});
  }
  const plans=[];let physicalCount=0,retained=0;
  for(const sourceId of sources) {
    const selected=factsFor(service,basisId,sourceId);
    const match1=service.getDecisionState({basisId,scopeId:sourceId,stage:'RigidMatch1'});
    const final=service.getDecisionState({basisId,scopeId:sourceId,stage:'Rigidmatch2'});
    const commands=[],unresolved=[];
    for(const [occurrenceId,facts] of selected) {
      const key=JSON.stringify([sourceId,occurrenceId]), choice=offered.get(key);
      if(choice) {
        commands.push({
          commandId:JSON.stringify(['final-explicit-reviewed',basisId,sourceId,occurrenceId,
            final.decisionRevision,choice.value,choice.reason]),
          basisId,scopeId:sourceId,occurrenceId,
          expectedDecisionRevision:final.decisionRevision,action:'final-override',
          value:choice.value,unit:'kg',reason:choice.reason,
        });
        offered.delete(key);
        continue;
      }
      const existingFinal=final.decisions[occurrenceId];
      const acceptedMatch1=match1.decisions[occurrenceId];
      const weight=existingFinal?.state==='accepted' ? existingFinal.value :
        acceptedMatch1?.state==='accepted' ? acceptedMatch1.value : sourceMass(facts);
      if(!positive(weight)) unresolved.push(occurrenceId);
      else retained++;
    }
    physicalCount+=selected.size;
    plans.push({sourceId,expectedDecisionRevision:final.decisionRevision,
      expectedMatch1Revision:match1.decisionRevision,physicalCount:selected.size,
      commands,unresolved});
  }
  if(offered.size) fail('UNKNOWN_FINAL_OCCURRENCE','Final review choice outside trusted physical source selection');
  const unresolved=plans.flatMap(p=>p.unresolved.map(id=>JSON.stringify([p.sourceId,id])));
  if(unresolved.length) fail('INCOMPLETE_FINAL_REVIEW',
    'Final Review needs explicit accepted mass for '+unresolved.length+' physical occurrence(s)');
  return {basisId,stage:'Rigidmatch2',sources,plans,physicalCount,
    retained,overrides:plans.reduce((sum,p)=>sum+p.commands.length,0)};
}
export function commitVerifiedFinalMatch2(session,plan) {
  const {basisId,sources,service}=opened(session);
  if(!plan || plan.basisId!==basisId || plan.stage!=='Rigidmatch2' ||
     JSON.stringify(plan.sources)!==JSON.stringify(sources) || !Array.isArray(plan.plans) ||
     plan.plans.length!==sources.length) fail('INVALID_FINAL_PLAN','Final plan/source scope invalid');
  // Recreate the original choices from the proposed commands, then independently
  // verify all source facts, Match-1/Final revisions and engineering values.
  const choices=plan.plans.flatMap(p=>(p.commands||[]).map(c=>({
    sourceId:p.sourceId,occurrenceId:c.occurrenceId,value:c.value,unit:c.unit,reason:c.reason,
  })));
  const current=planVerifiedFinalMatch2(session,choices);
  if(JSON.stringify(plan)!==JSON.stringify(current))
    fail('STALE_FINAL_REVIEW','Final plan or intervening Match-1/Final decision changed');
  const snapshots=[],committedSources=[];
  for(const sourcePlan of plan.plans) {
    try {
      if(sourcePlan.commands.length) {
        service.applyDecisions({basisId,scopeId:sourcePlan.sourceId,stage:'Rigidmatch2',
          expectedDecisionRevision:sourcePlan.expectedDecisionRevision,
          commands:sourcePlan.commands});
      }
      const now=service.getDecisionState({basisId,scopeId:sourcePlan.sourceId,stage:'Rigidmatch2'});
      const frozen=service.freezeSnapshot({basisId,scopeId:sourcePlan.sourceId,
        stage:'Rigidmatch2',expectedDecisionRevision:now.decisionRevision});
      committedSources.push(sourcePlan.sourceId);
      snapshots.push(frozen);
    } catch(error) {
      const failure=new Error('Final review partially committed; reconcile completed source snapshots: '+
        String(error?.message||error));
      failure.code='PARTIAL_FINAL_COMMIT';failure.completedSources=committedSources;
      failure.failedSource=sourcePlan.sourceId;failure.cause=error;throw failure;
    }
  }
  return {basisId,stage:'Rigidmatch2',committedSources,
    finalSnapshots:snapshots,acceptedOverrides:plan.overrides,
    retained:plan.retained,physicalCount:plan.physicalCount};
}
