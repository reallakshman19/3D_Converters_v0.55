/**
 * G3-G4 read-only, non-authorizing cross-check of downloaded aggregate receipts.
 * These self-reported fields are not independent source-byte or CII-slot proof.
 */
export const CANDIDATE_RECONCILIATION_SCHEMA=
  'XML229.G3.CandidateReadinessReconciliation.v1';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const str=x=>typeof x==='string'&&x.trim().length>0;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const names=['zeroCandidateOccurrences','oneCandidateOccurrences',
 'multiCandidateOccurrences','qualifiedCandidateCount','unqualifiedCandidateCount',
 'occurrencesWithQualifiedCandidates','onlyUnqualifiedCandidateOccurrences',
 'multipleQualifiedCandidateOccurrences','positiveSourceMassCount',
 'nullSourceMassCount','invalidSourceMassCount','acceptedMatch1Count',
 'acceptedFinalCount','rejectedMatch1Count','deferredMatch1Count',
 'rejectedFinalCount','deferredFinalCount'];
const error=(issues,code)=>{if(!issues.includes(code))issues.push(code);};
function validCoverage(c,issues){
 if(c?.schema!=='XML229.G3.CandidateCoverageReport.v1'||
    !sha(c?.basisId)||!sha(c?.originalJsonSha256)||!str(c?.sourceId)||
    !str(c?.sourceGenerationId)||!str(c?.requestId)||
    !count(c?.physicalCount)||!c?.physicalCount||
    !count(c?.verifiedFactCount)||!count(c?.proposalCount)||
    !plain(c?.counts)||!names.every(name=>count(c?.counts[name]))||
    (!plain(c?.decisionRevisions)||!Object.hasOwn(c.decisionRevisions,'match1')||
      !Object.hasOwn(c.decisionRevisions,'final')))
   error(issues,'G3_COVERAGE_MALFORMED');
 if(c?.sourceBasisVerified!==true||
    c?.reviewDecisionsAuthorized!==false||
    c?.nativeQualificationAuthorized!==false||
    c?.nativeCiiReleaseAuthorized!==false)
   error(issues,'G3_UNSUPPORTED_AUTHORITY');
}
function validReadiness(r,issues){
 if(r?.schema!=='XML229.P4.RunAdvisory.v1'||
    !sha(r?.basisId)||!sha(r?.originalJsonSha256)||!str(r?.sourceId)||
    !str(r?.sourceGenerationId)||!count(r?.verifiedPhysicalCount)||
    !r?.verifiedPhysicalCount||!count(r?.verifiedFactCount)||
    !plain(r?.counts)||
    !['source','match1','final','unresolved'].every(k=>count(r?.counts[k]))||
    !plain(r?.stageRevisions)||r.engineeringFactsVerified!==true)
   error(issues,'G4_READINESS_MALFORMED');
 if(r?.ciiReleaseAuthorized!==false||r?.nativeCiiReleaseAuthorized===true)
   error(issues,'G4_UNSUPPORTED_NATIVE_AUTHORITY');
}
function checkMassAndCandidateTotals(c,r,issues){
 const n=c?.counts,p=c?.physicalCount,sc=r?.counts;
 if(n.zeroCandidateOccurrences+n.oneCandidateOccurrences+
    n.multiCandidateOccurrences!==p)
   error(issues,'G3_CANDIDATE_POPULATION_DRIFT');
 if(n.qualifiedCandidateCount+n.unqualifiedCandidateCount!==c?.proposalCount||
    n.oneCandidateOccurrences+2*n.multiCandidateOccurrences>c?.proposalCount||
    n.occurrencesWithQualifiedCandidates>p||
    n.onlyUnqualifiedCandidateOccurrences>p||
    n.multipleQualifiedCandidateOccurrences>n.multiCandidateOccurrences||
    n.onlyUnqualifiedCandidateOccurrences+n.occurrencesWithQualifiedCandidates>
      n.oneCandidateOccurrences+n.multiCandidateOccurrences||
    n.occurrencesWithQualifiedCandidates>n.qualifiedCandidateCount)
   error(issues,'G3_CANDIDATE_QUALIFICATION_DRIFT');
 if(n.positiveSourceMassCount+n.nullSourceMassCount+
    n.invalidSourceMassCount!==p)
   error(issues,'G3_SOURCE_MASS_POPULATION_DRIFT');
 for(const stage of ['Match1','Final']){
   const accepted=n['accepted'+stage+'Count'];
   const rejected=n['rejected'+stage+'Count'];
   const deferred=n['deferred'+stage+'Count'];
   if(accepted+rejected+deferred>p)
     error(issues,'G3_REVIEW_PARTITION_DRIFT');
 }
 if(sc.source+sc.match1+sc.final+sc.unresolved!==p)
   error(issues,'G4_MASS_PARTITION_DRIFT');
 if(sc.final!==n.acceptedFinalCount||
    sc.match1>n.acceptedMatch1Count||
    sc.source>n.positiveSourceMassCount||
    sc.source+sc.match1+sc.final>
      n.positiveSourceMassCount+n.acceptedMatch1Count+n.acceptedFinalCount)
   error(issues,'G3_G4_MASS_AUTHORITY_CONFLICT');
}
export function reconcileXml229CandidateCoverage(input={}){
 const {coverage,readiness}=input??{};
 const issues=[];
 validCoverage(coverage,issues);
 validReadiness(readiness,issues);
 if(issues.includes('G3_COVERAGE_MALFORMED')||
    issues.includes('G4_READINESS_MALFORMED'))
   return Object.freeze({schema:CANDIDATE_RECONCILIATION_SCHEMA,
     status:'INCOMPLETE',issues:Object.freeze(issues),
     authoritative:false,nativeCiiReleaseAuthorized:false});
 const c=coverage,r=readiness;
 if(c?.basisId!==r?.basisId||c?.sourceId!==r?.sourceId||
    c?.originalJsonSha256!==r?.originalJsonSha256||
    c?.sourceGenerationId!==r?.sourceGenerationId)
   error(issues,'G3_G4_INPUT_BASIS_DRIFT');
 if(c?.physicalCount!==r?.verifiedPhysicalCount||
    c?.verifiedFactCount!==r?.verifiedFactCount||
    c?.physicalCount*7!==c?.verifiedFactCount)
   error(issues,'G3_G4_FACT_POPULATION_DRIFT');
 const rev=r?.stageRevisions?.[c?.sourceId];
 if(!plain(rev)||!Object.hasOwn(rev,'match1')||
    !Object.hasOwn(rev,'final')||
    (rev.match1??null)!==(c?.decisionRevisions.match1??null)||
    (rev.final??null)!==(c?.decisionRevisions.final??null))
   error(issues,'G3_G4_REVIEW_REVISION_DRIFT');
 checkMassAndCandidateTotals(c,r,issues);
 return Object.freeze({schema:CANDIDATE_RECONCILIATION_SCHEMA,
   status:issues.length?'INCONSISTENT':'CONSISTENT',
   issues:Object.freeze(issues),authoritative:false,
   nativeCiiReleaseAuthorized:false,
   // Counts only; no original owner, raw proposed kg or file path is exposed.
   physicalCount:c?.physicalCount,
   verifiedFactCount:c?.verifiedFactCount,
   candidateOccurrencesWithNone:c?.counts.zeroCandidateOccurrences,
   qualifiedCandidateCount:c?.counts.qualifiedCandidateCount,
   unresolvedMassCount:r?.counts.unresolved,
 });
}
