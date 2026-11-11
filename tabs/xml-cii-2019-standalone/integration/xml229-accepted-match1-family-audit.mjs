/**
 * Read-only audit of already-accepted GC-PW Match-1 decisions.
 * Classification is current evidence about a past decision, NOT revocation,
 * confirmation of a historical click, Final approval or native CII authority.
 */
import {projectXml229WeightDecisionProvenance}
 from './xml229-weight-decision-provenance.mjs';
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const own = (o,k) => Object.prototype.hasOwnProperty.call(o || {},k);
const STOP = Object.freeze(new Set([
  'SEMANTIC_CONFLICT','SEMANTIC_MISMATCH','SOURCE_EVIDENCE_UNKNOWN',
  'PROPOSAL_NOT_FOUND','PROPOSAL_VALUE_DRIFT','ELIGIBILITY_UNAVAILABLE',
  'GEOMETRY_OR_METHOD_HOLD','MANUAL_INDEPENDENT_REVIEW_REQUIRED',
]));
const status = (code,reason) => ({code,reason,requiresIndependentVerification:true,
  finalAuthorized:false,nativeCiiReleaseAuthorized:false});
const publicType = classification => ({
  status:classification?.status||'UNKNOWN',
  family:classification?.family||'UNKNOWN',
  subtype:classification?.subtype||'UNKNOWN',
  sources:(classification?.evidence||[]).map(x=>({
    origin:x.origin,family:x.family,subtype:x.subtype,
  })),
});
/** Report a decision's current engineering evidence without changing it. */
export function auditXml229AcceptedMatch1Row(row) {
  const decision = row?.match1View?.stageDecision || row?.match1Decision;
  if (decision?.state !== 'accepted') return null;
  const base={occurrenceId:row.occurrenceId,acceptedKg:decision.value,
    action:decision.action,proposalId:decision.proposalId||null,
    sourceComponentType:row.componentType||'',originalNodeName:row.nodeName||'',
    originalDtxr:row.dtxr||'',readOnly:true};
  if (decision.action!=='accept-proposal') return {...base,...status(
    'MANUAL_INDEPENDENT_REVIEW_REQUIRED','Accepted manual kg lacks a matching master proposal; inspect original engineering evidence')};
  const proposal=(row.proposals||[]).find(p=>p.proposalId===decision.proposalId);
  if(!proposal)return {...base,...status('PROPOSAL_NOT_FOUND',
    'Historical acceptance has no matching current-basis ranked proposal')};
  if(!positive(decision.value)||proposal.value!==decision.value||proposal.unit!=='kg')
    return {...base,...status('PROPOSAL_VALUE_DRIFT',
      'Historical accepted kg differs from source-bound current proposal')};
  const eligibility=proposal.familyEligibility;
  if(!eligibility?.source||!eligibility?.master||
     !Array.isArray(eligibility.reasons))
    return {...base,...status('ELIGIBILITY_UNAVAILABLE',
      'Current candidate lacks source/master family audit evidence')};
  const evidence={...base,masterRowOrdinal:proposal.masterRowOrdinal??null,
    masterFamily:publicType(eligibility.master),
    sourceFamily:publicType(eligibility.source),
    eligibilityReasons:[...eligibility.reasons]};
  if(eligibility.source.status==='CONFLICT'||eligibility.master.status==='CONFLICT')
    return {...evidence,...status('SEMANTIC_CONFLICT',
      'Contradictory source or master family evidence requires engineering resolution')};
  if(eligibility.source.status!=='KNOWN'||eligibility.master.status!=='KNOWN')
    return {...evidence,...status('SOURCE_EVIDENCE_UNKNOWN',
      'Family is not established from verified source and master metadata')};
  if(eligibility.reasons.some(r=>r==='FAMILY_MISMATCH'||r==='VALVE_SUBTYPE_UNVERIFIED'))
    return {...evidence,...status('SEMANTIC_MISMATCH',
      'Accepted master family or valve subtype is incompatible with source')};
  if(!eligibility.qualified||proposal.qualified!==true)
    return {...evidence,...status('GEOMETRY_OR_METHOD_HOLD',
      'Current proposal is not fully qualified for automatic Match-1')};
  return {...evidence,...status('FAMILY_COMPATIBLE_ONLY',
    'Family and direct candidate are currently compatible; kg still needs independent verification')};
}
/**
 * Bounded full-source audit from the verified Worker projection.
 * Read operations only; no service applyDecisions or freezeSnapshot.
 */
export function auditXml229AcceptedMatch1Population({
  basisId,sourceId,physicalCount,decisions,getRow,getProposals,
}={}) {
  if(typeof basisId!=='string'||!basisId||typeof sourceId!=='string'||!sourceId||
     !Number.isSafeInteger(physicalCount)||physicalCount<0||
     !decisions||typeof decisions!=='object'||Array.isArray(decisions)||
     typeof getRow!=='function'||typeof getProposals!=='function')
    throw new Error('SOURCE_BOUND_ACCEPTED_AUDIT_REQUIRED');
  const accepted=Object.entries(decisions).filter(([,d])=>d?.state==='accepted')
    .sort(([a],[b])=>a.localeCompare(b));
  if(accepted.length>physicalCount||physicalCount>100000)
    throw new Error('ACCEPTED_DECISION_CENSUS_INVALID');
  const rows=[],seen=new Set();
  for(let offset=0;offset<accepted.length;offset+=80){
    const chunk=accepted.slice(offset,offset+80);
    const ids=chunk.map(([id])=>id);
    const ranked=getProposals(ids);
    if(!(ranked instanceof Map)||ranked.size!==ids.length)
      throw new Error('ACCEPTED_PROPOSAL_PROJECTION_INCOMPLETE');
    for(const [occurrenceId,decision] of chunk){
      if(seen.has(occurrenceId)||!own(decisions,occurrenceId))
        throw new Error('ACCEPTED_DECISION_DUPLICATE');
      seen.add(occurrenceId);
      const original=getRow(occurrenceId);
      if(original?.occurrenceId!==occurrenceId||original?.basisId!==basisId||
         original?.sourceId!==sourceId||!ranked.has(occurrenceId))
        throw new Error('ACCEPTED_SOURCE_OCCURRENCE_DRIFT');
      const audit=auditXml229AcceptedMatch1Row({...original,proposals:ranked.get(occurrenceId),
        match1Decision:decision});
      if(!audit)throw new Error('ACCEPTED_DECISION_AUDIT_MISSING');
      rows.push(audit);
    }
  }
  const statuses=Object.fromEntries([...new Set([...STOP,'FAMILY_COMPATIBLE_ONLY'])]
    .sort().map(code=>[code,0]));
  for(const row of rows)statuses[row.code]=(statuses[row.code]||0)+1;
  if(rows.length!==accepted.length||
     Object.values(statuses).reduce((a,b)=>a+b,0)!==rows.length)
    throw new Error('ACCEPTED_AUDIT_RECONCILIATION_FAILED');
  return {
    schema:'XML229.AcceptedMatch1FamilyAudit.v1',basisId,sourceId,
    physicalCount,acceptedMatch1Count:accepted.length,
    summary:{...statuses,acceptedMatch1Count:accepted.length,
      holdOrUnknownCount:rows.filter(r=>STOP.has(r.code)).length,
      familyCompatibleOnly:statuses.FAMILY_COMPATIBLE_ONLY,
      requiresIndependentVerification:accepted.length,
      finalAuthorized:false,nativeCiiReleaseAuthorized:false},
    rows,readOnly:true,
    caution:'Family compatibility alone is not Final engineering verification. Historical decisions are preserved. Private source occurrence names remain in this owner-local export.',
  };
}

/** Reuse the established read-only provenance export, with a second family lens. */
export async function projectXml229AuditedDecisionProvenance({
 review,weightProjection,basisId,sourceId,completion,confirmedBulkCommandIds=[],
}={}) {
 if(!review||!weightProjection||typeof review.getDecisionState!=='function'||
    typeof review.exportReviewState!=='function')
   throw new Error('AUDIT_SOURCE_SESSION_REQUIRED');
 const reviewState=await review.exportReviewState({basisId});
 const provenance=projectXml229WeightDecisionProvenance({
   reviewState,basisId,sourceId,completion,confirmedBulkCommandIds,
 });
 const acceptedFamilyAudit=auditXml229AcceptedMatch1Population({
   basisId,sourceId,physicalCount:weightProjection.count,
   decisions:review.getDecisionState({
     basisId,scopeId:sourceId,stage:'RigidMatch1',
   }).decisions,
   getRow:id=>weightProjection.get(id),
   getProposals:ids=>weightProjection.proposals(ids),
 });
 if(acceptedFamilyAudit.acceptedMatch1Count!==provenance.summary.acceptedMatch1All||
    acceptedFamilyAudit.physicalCount!==provenance.population.physicalCount||
    provenance.basisId!==basisId||provenance.sourceId!==sourceId)
   throw new Error('ACCEPTED_AUDIT_PROVENANCE_CENSUS_DRIFT');
 return {...provenance,acceptedFamilyAudit};
}
