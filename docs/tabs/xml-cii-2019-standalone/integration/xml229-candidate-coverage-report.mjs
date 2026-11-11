/**
 * XML229 G3: Aggregate-only candidate coverage from the EXISTING attested
 * GC-PW scorer, source-first physical projection and explicit decision ledger.
 * Read-only and Worker-private: never emits occurrence IDs, candidate values,
 * master rows, XML, JSON, raw evidence or authority to approve/release.
 */
export const CANDIDATE_COVERAGE_SCHEMA='XML229.G3.CandidateCoverageReport.v1';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const valid=x=>typeof x==='string'&&x.trim().length>0;
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const ensure=(test,code)=>{if(!test)fail(code);};
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const occurrenceKey=id=>id?.occurrenceId||
  JSON.stringify([id?.sourceId,id?.branchOccurrenceIndex,id?.nodeOrdinal,id?.componentSignature]);
const active=(current,basisId,generation,requestId)=>{
  ensure(typeof current==='function','COVERAGE_CURRENT_SESSION_REQUIRED');
  const now=current();
  ensure(now&&now.basisId===basisId&&now.sourceGenerationId===generation&&
    now.requestId===requestId&&now.closed===false,'COVERAGE_SESSION_SUPERSEDED');
};
function decisions(review,basisId,sourceId,stage){
  const state=review.getDecisionState({basisId,scopeId:sourceId,stage});
  ensure(state?.basisId===basisId&&state.scopeId===sourceId&&
    state.stage===stage&&state.decisions&&
    !Array.isArray(state.decisions)&&typeof state.decisions==='object',
    'COVERAGE_DECISION_BASIS_DRIFT');
  return state;
}
/**
 * Must be called inside the source-bound GC-PW Worker after full facts open.
 * Scores ONLY through weightProjection.proposals() which uses GC-PW's existing
 * getProposals() and same-source original occurrence join. NEVER calls writes.
 */
export function buildXml229CandidateCoverageReport({
  session,sourceId,physicalOccurrences,weightProjection,sourceReceipt,
  requestId,readCurrentSession,
}={}){
  const basisId=session?.basis?.basisId;
  ensure(sha(basisId)&&valid(sourceId)&&valid(requestId)&&
    session?.basis?.scope?.length===1&&
    session.basis.scope[0]?.sourceId===sourceId&&
    sha(sourceReceipt?.sha256)&&valid(sourceReceipt?.generationId)&&
    Array.isArray(physicalOccurrences)&&physicalOccurrences.length>0&&
    physicalOccurrences.length<=100000&&
    weightProjection?.count===physicalOccurrences.length&&
    typeof weightProjection.get==='function'&&
    typeof weightProjection.proposals==='function'&&
    session?.review?.getDecisionState&&
    session.openedFacts===physicalOccurrences.length*7,
    'COVERAGE_ATTESTED_POPULATION_REQUIRED');
  const generation=sourceReceipt.generationId;
  active(readCurrentSession,basisId,generation,requestId);
  const match=decisions(session.review,basisId,sourceId,'RigidMatch1');
  const final=decisions(session.review,basisId,sourceId,'Rigidmatch2');
  const ids=physicalOccurrences.map(occurrenceKey);
  ensure(ids.every(valid)&&ids.length===new Set(ids).size&&
    physicalOccurrences.every(p=>p.sourceId===sourceId),
    'COVERAGE_ORIGINAL_OWNER_DRIFT');
  const c={zeroCandidateOccurrences:0,oneCandidateOccurrences:0,
    multiCandidateOccurrences:0,qualifiedCandidateCount:0,
    unqualifiedCandidateCount:0,occurrencesWithQualifiedCandidates:0,
    onlyUnqualifiedCandidateOccurrences:0,multipleQualifiedCandidateOccurrences:0,
    positiveSourceMassCount:0,nullSourceMassCount:0,invalidSourceMassCount:0,
    acceptedMatch1Count:0,acceptedFinalCount:0,
    rejectedMatch1Count:0,deferredMatch1Count:0,
    rejectedFinalCount:0,deferredFinalCount:0};
  let proposalsTotal=0;
  const checkDecision=(state,id,prefix)=>{
    const d=state.decisions[id];
    if(d===undefined)return;
    ensure(['accepted','rejected','deferred'].includes(d?.state),
      'COVERAGE_INVALID_REVIEW_DECISION');
    if(d.state==='accepted'){
      ensure(positive(d.value) || (prefix==='final' && d.action==='set-zero-mass' &&
        d.value===0 && typeof d.reason==='string' &&
        d.reason.startsWith('Owner-confirmed explicit zero kg: ')),
        'COVERAGE_ACCEPTED_NONPOSITIVE_KG');
      c[prefix==='match1'?'acceptedMatch1Count':'acceptedFinalCount']++;
    }else if(d.state==='rejected'){
      c[prefix==='match1'?'rejectedMatch1Count':'rejectedFinalCount']++;
    }else c[prefix==='match1'?'deferredMatch1Count':'deferredFinalCount']++;
  };
  const knownIds=new Set(ids);
  for(const s of [match,final])
    ensure(Object.keys(s.decisions).every(id=>knownIds.has(id)),
      'COVERAGE_FOREIGN_REVIEW_OWNER');
  for(let start=0;start<ids.length;start+=64){
    active(readCurrentSession,basisId,generation,requestId);
    const slice=ids.slice(start,start+64);
    const projected=weightProjection.proposals(slice);
    ensure(projected instanceof Map&&projected.size===slice.length,
      'COVERAGE_PROPOSAL_POPULATION_DRIFT');
    for(const id of slice){
      const meta=weightProjection.get(id);
      ensure(meta?.basisId===basisId&&meta.sourceId===sourceId&&
        meta.occurrenceId===id,'COVERAGE_SOURCE_PROJECTION_DRIFT');
      if(meta.sourceKg===null||meta.sourceKg===undefined)c.nullSourceMassCount++;
      else if(positive(meta.sourceKg))c.positiveSourceMassCount++;
      else c.invalidSourceMassCount++;
      const rows=projected.get(id);
      ensure(Array.isArray(rows),'COVERAGE_PROPOSAL_PAGE_INCOMPLETE');
      let qualified=0;
      const pids=new Set();
      for(const p of rows){
        ensure(p?.qualified===true||p?.qualified===false,
          'COVERAGE_CANDIDATE_QUALIFICATION_INVALID');
        ensure(valid(p.proposalId)&&!pids.has(p.proposalId)&&
          safe(p.ranking)&&p.ranking>0&&positive(p.value),
          'COVERAGE_CANDIDATE_PROVENANCE_INVALID');
        pids.add(p.proposalId);
        if(p.qualified){qualified++;c.qualifiedCandidateCount++;}
        else c.unqualifiedCandidateCount++;
      }
      proposalsTotal+=rows.length;
      if(rows.length===0)c.zeroCandidateOccurrences++;
      else if(rows.length===1)c.oneCandidateOccurrences++;
      else c.multiCandidateOccurrences++;
      if(qualified>0)c.occurrencesWithQualifiedCandidates++;
      if(rows.length>0&&qualified===0)c.onlyUnqualifiedCandidateOccurrences++;
      if(qualified>1)c.multipleQualifiedCandidateOccurrences++;
      checkDecision(match,id,'match1');
      checkDecision(final,id,'final');
    }
  }
  active(readCurrentSession,basisId,generation,requestId);
  const recheckMatch=decisions(session.review,basisId,sourceId,'RigidMatch1');
  const recheckFinal=decisions(session.review,basisId,sourceId,'Rigidmatch2');
  ensure(recheckMatch.decisionRevision===match.decisionRevision&&
    recheckFinal.decisionRevision===final.decisionRevision,
    'COVERAGE_REVIEW_REVISION_CHANGED');
  ensure(c.zeroCandidateOccurrences+c.oneCandidateOccurrences+
    c.multiCandidateOccurrences===ids.length&&
    c.qualifiedCandidateCount+c.unqualifiedCandidateCount===proposalsTotal&&
    c.positiveSourceMassCount+c.nullSourceMassCount+
      c.invalidSourceMassCount===ids.length,
    'COVERAGE_AGGREGATE_COUNT_DRIFT');
  return Object.freeze({
    schema:CANDIDATE_COVERAGE_SCHEMA,basisId,sourceId,
    originalJsonSha256:sourceReceipt.sha256,sourceGenerationId:generation,
    requestId,physicalCount:ids.length,verifiedFactCount:session.openedFacts,
    proposalCount:proposalsTotal,counts:Object.freeze(c),
    decisionRevisions:Object.freeze({
      match1:match.decisionRevision??null,final:final.decisionRevision??null,
    }),sourceBasisVerified:true,reportKind:'READ_ONLY_CANDIDATE_COVERAGE',
    reviewDecisionsAuthorized:false,nativeQualificationAuthorized:false,
    nativeCiiReleaseAuthorized:false,
  });
}
