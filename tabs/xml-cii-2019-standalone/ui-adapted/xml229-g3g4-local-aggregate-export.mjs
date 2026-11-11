/**
 * Owner-local, redacted G3/G4 candidate+readiness export.
 * Never download raw candidate rows, original physical IDs, XML, JSON or
 * master data; do not grant Match-1, Final, or native CII authority.
 */
import {reconcileXml229CandidateCoverage}
 from '../../../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs';
export const G3G4_LOCAL_AGGREGATE_SCHEMA=
 'XML229.G3G4.LocalAggregateEvidenceExport.v1';
const coverageKeys=['zeroCandidateOccurrences','oneCandidateOccurrences',
 'multiCandidateOccurrences','qualifiedCandidateCount','unqualifiedCandidateCount',
 'occurrencesWithQualifiedCandidates','onlyUnqualifiedCandidateOccurrences',
 'multipleQualifiedCandidateOccurrences','positiveSourceMassCount',
 'nullSourceMassCount','invalidSourceMassCount','acceptedMatch1Count',
 'acceptedFinalCount','rejectedMatch1Count','deferredMatch1Count',
 'rejectedFinalCount','deferredFinalCount'];
const g4Keys=['source','match1','final','unresolved'];
const pick=(obj,keys)=>Object.fromEntries(keys.map(k=>[k,obj?.[k]]));
const rejected=()=>{const e=new Error('G3_G4_AGGREGATE_EXPORT_HELD');e.code=e.message;throw e;};
export function prepareXml229G3G4LocalAggregateExport({pair,receipt}={}){
 const c=pair?.coverage,r=pair?.readiness;
 if(pair?.schema!=='XML229.G3G4.SourceBoundAggregatePair.v1'||
    pair?.readOnly!==true||pair?.reviewDecisionsAuthorized!==false||
    pair?.nativeCiiReleaseAuthorized!==false||
    pair?.reconciliation?.status!=='CONSISTENT'||
    pair?.reconciliation?.authoritative!==false||
    pair?.reconciliation?.nativeCiiReleaseAuthorized!==false||
    !receipt||receipt.basisId!==c?.basisId||
    receipt.sourceId!==c?.sourceId||
    receipt.originalJsonSha256!==c?.originalJsonSha256||
    receipt.sourceGenerationId!==c?.sourceGenerationId||
    reconcileXml229CandidateCoverage({coverage:c,readiness:r}).status!=='CONSISTENT')
   rejected();
 const rev=c.decisionRevisions,stage=r.stageRevisions?.[c.sourceId];
 const coverage={schema:c.schema,basisId:c.basisId,sourceId:c.sourceId,
   originalJsonSha256:c.originalJsonSha256,sourceGenerationId:c.sourceGenerationId,
   requestId:c.requestId,physicalCount:c.physicalCount,
   verifiedFactCount:c.verifiedFactCount,proposalCount:c.proposalCount,
   counts:pick(c.counts,coverageKeys),decisionRevisions:pick(rev,['match1','final']),
   sourceBasisVerified:true,reviewDecisionsAuthorized:false,
   nativeQualificationAuthorized:false,nativeCiiReleaseAuthorized:false};
 const readiness={schema:r.schema,basisId:r.basisId,sourceId:r.sourceId,
   originalJsonSha256:r.originalJsonSha256,
   sourceGenerationId:r.sourceGenerationId,
   verifiedPhysicalCount:r.verifiedPhysicalCount,verifiedFactCount:r.verifiedFactCount,
   counts:pick(r.counts,g4Keys),
   stageRevisions:{[c.sourceId]:pick(stage,['match1','final'])},
   engineeringFactsVerified:true,ciiReleaseAuthorized:false};
 if(reconcileXml229CandidateCoverage({coverage,readiness}).status!=='CONSISTENT')
   rejected();
 const envelope={schema:G3G4_LOCAL_AGGREGATE_SCHEMA,
   coverage,readiness,structuralStatus:'CONSISTENT',
   localOwnerReviewOnly:true,reviewDecisionsAuthorized:false,
   nativeCiiReleaseAuthorized:false};
 const text=JSON.stringify(envelope,null,2);
 if(text.length>16384)rejected();
 return {filename:'xml229-g3-g4-source-bound-aggregate.json',text};
}
