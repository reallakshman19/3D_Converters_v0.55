/**
 * Read-only EF05 / owner-local full-source GC-PW acceptance PRECHECK.
 * This file can run in browser inside an attested Worker-held session.
 * No decisions, source text, original JSON, master values, IDs, branch names,
 * NodeNames or per-occurrence details leave its aggregate return value.
 *
 * This precheck is NEVER engineering Final approval or native CII authority.
 */
const error=code=>{const e=new Error(code);e.code=code;throw e;};
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function reviewCounts(x){
 if(!x||!['source','match1','final','unresolved'].every(k=>safeInt(x[k])))
   error('PUBLIC41_REVIEW_COUNTS_INVALID');
 return [x.source,x.match1,x.final,x.unresolved];
}
function attestRead(readiness,coverage,receipt){
 if(!hash(readiness?.basisId)||readiness.basisId!==receipt.basisId||
    readiness.originalJsonSha256!==receipt.originalJsonSha256||
    readiness.verifiedPhysicalCount!==receipt.physicalCount||
    readiness.verifiedFactCount!==receipt.physicalFactCount||
    readiness.verifiedFactCount!==7*readiness.verifiedPhysicalCount||
    !readiness.engineeringFactsVerified||readiness.ciiReleaseAuthorized!==false||
    coverage?.basisId!==readiness.basisId||
    coverage?.originalJsonSha256!==receipt.originalJsonSha256||
    coverage.physicalCount!==readiness.verifiedPhysicalCount||
    coverage.verifiedFactCount!==readiness.verifiedFactCount||
    !safeInt(coverage.proposalCount))
   error('PUBLIC41_WORKER_CUSTODY_OR_FACT_DRIFT');
 const c=readiness.counts,cc=coverage.counts;
 if(!reviewCounts(c)||c.source+c.match1+c.final+c.unresolved!==readiness.verifiedPhysicalCount||
    cc?.acceptedMatch1Count<c.match1||cc?.acceptedFinalCount!==c.final||
    coverage.reviewDecisionsAuthorized!==false||
    coverage.nativeCiiReleaseAuthorized!==false)
   error('PUBLIC41_REVIEW_CENSUS_DRIFT');
}
/**
 * Owner-safe aggregate: 41-branch benchmark or private session; no automatic
 * acceptance is possible because only three read methods are invoked.
 */
export async function collectXml229ReadOnlyWeightAcceptance(session,{
 expectedPhysicalCount=null,expectedFactCount=null,
}={}){
 if(!session?.receipt||typeof session.readCompletion!=='function'||
    typeof session.readCandidateReadinessPair!=='function'||
    typeof session.readPage!=='function')
   error('PUBLIC41_ATTESTED_WORKER_REQUIRED');
 const receipt=session.receipt;
 if(!hash(receipt.basisId)||!hash(receipt.originalJsonSha256)||
    !safeInt(receipt.physicalCount)||receipt.physicalCount<1||
    receipt.physicalCount>10000||receipt.physicalFactCount!==7*receipt.physicalCount)
   error('PUBLIC41_RECEIPT_INVALID');
 const before=await session.readCompletion();
 const pair=await session.readCandidateReadinessPair();
 if(pair?.schema!=='XML229.G3G4.SourceBoundAggregatePair.v1'||
    pair.reconciliation?.status!=='CONSISTENT'||pair.readOnly!==true||
    pair.reviewDecisionsAuthorized!==false||
    pair.nativeCiiReleaseAuthorized!==false)
   error('PUBLIC41_COVERAGE_NOT_ATTESTED');
 const coverage=pair.coverage,readiness=pair.readiness;
 attestRead(before,coverage,receipt);
 attestRead(readiness,coverage,receipt);
 if(expectedPhysicalCount!==null&&before.verifiedPhysicalCount!==expectedPhysicalCount||
    expectedFactCount!==null&&before.verifiedFactCount!==expectedFactCount)
   error('PUBLIC41_OWNER_EXPECTED_CENSUS_DRIFT');
 const counts={physical:0,proposals:0,qualified:0,unqualified:0,
  familyUnknownProposals:0,familyConflictProposals:0,
  valveToFlangeRejected:0,valveToFlangeQualified:0,
  invalidQualifiedFamily:0,acceptedMatch1:0,acceptedFinal:0};
 let total=null;
 for(let offset=0;;offset+=25){
  const page=await session.readPage({offset,limit:25,filter:'all',query:''});
  if(page?.complete!==true||page.basisId!==receipt.basisId||
     page.offset!==offset||!safeInt(page.totalCount)||
     page.totalCount!==receipt.physicalCount||
     total!==null&&page.totalCount!==total||
     !Array.isArray(page.rows)||page.rows.length!==Math.min(25,page.totalCount-offset))
   error('PUBLIC41_PAGE_POPULATION_DRIFT');
  if(total===null)total=page.totalCount;
  for(const row of page.rows){
   if(!row||!Array.isArray(row.proposals)||!Array.isArray(row.match1View?.proposals)||
      row.match1View.proposals.length!==row.proposals.length)
    error('PUBLIC41_CANDIDATE_PROJECTION_DRIFT');
   // This is a read-only audit, not an empty-ledger-only precheck. Accepted
   // decisions belong to the current protected Worker and must be counted,
   // not treated as corruption when the Owner already selected Applied Weight.
   const m=row.match1View.stageDecision,f=row.finalView?.stageDecision;
   if(m?.state==='accepted'){
     if(!positive(row.match1Kg))error('PUBLIC41_MATCH1_MASS_DRIFT');
     counts.acceptedMatch1++;
   }else if(positive(row.match1Kg))error('PUBLIC41_MATCH1_LEDGER_DRIFT');
   if(f?.state==='accepted'){
     if(!((positive(row.finalKg))||
       (row.finalKg===0&&f.action==='set-zero-mass')))
      error('PUBLIC41_FINAL_MASS_DRIFT');
     counts.acceptedFinal++;
   }else if(typeof row.finalKg==='number')error('PUBLIC41_FINAL_LEDGER_DRIFT');
   counts.physical++;
   for(const p of row.proposals){
    const family=p.familyEligibility;
    counts.proposals++;
    if(p.qualified===true)counts.qualified++;
    else if(p.qualified===false)counts.unqualified++;
    else error('PUBLIC41_CANDIDATE_QUALIFICATION_INVALID');
    if(family?.source?.status!=='KNOWN')counts.familyUnknownProposals++;
    if(family?.source?.status==='CONFLICT'||family?.master?.status==='CONFLICT')
     counts.familyConflictProposals++;
    const valveToFlange=family?.source?.family==='VALVE'&&
      family?.master?.family==='FLANGE';
    if(valveToFlange){
     if(p.qualified)counts.valveToFlangeQualified++;
     else counts.valveToFlangeRejected++;
    }
    if(p.qualified&&(
       family?.qualified!==true||
       family.source?.status!=='KNOWN'||family.master?.status!=='KNOWN'||
       family.source.family!==family.master.family||
       family.source.family==='VALVE'&&(
         !family.source.subtype||family.source.subtype!==family.master.subtype)))
     counts.invalidQualifiedFamily++;
   }
  }
  if(offset+page.rows.length===total)break;
 }
 if(counts.physical!==receipt.physicalCount||
    counts.acceptedMatch1!==coverage.counts.acceptedMatch1Count||
    counts.acceptedFinal!==coverage.counts.acceptedFinalCount||
    counts.proposals!==coverage.proposalCount||
    counts.qualified!==coverage.counts.qualifiedCandidateCount||
    counts.unqualified!==coverage.counts.unqualifiedCandidateCount||
    counts.invalidQualifiedFamily||counts.valveToFlangeQualified)
   error('PUBLIC41_SEMANTIC_ACCEPTANCE_DRIFT');
 const after=await session.readCompletion();
 if(JSON.stringify(reviewCounts(after.counts))!==JSON.stringify(reviewCounts(before.counts))||
    JSON.stringify(reviewCounts(readiness.counts))!==JSON.stringify(reviewCounts(before.counts))||
    after.basisId!==before.basisId||after.verifiedFactCount!==before.verifiedFactCount||
    after.ciiReleaseAuthorized!==false)
   error('PUBLIC41_READ_ONLY_STATE_CHANGED');
 return Object.freeze({
  schema:'XML229.PublicOrOwner.LocalWeightReadOnlyAcceptance.v1',
  evidenceKind:'VERIFIED_WORKER_READ_ONLY_NOT_ENGINEERING_APPROVAL',
  originalJsonSha256:receipt.originalJsonSha256,
  basisId:receipt.basisId,
  population:{physicalCount:counts.physical,factCount:receipt.physicalFactCount,
    sevenFactsPerPhysical:true},
  proposals:{total:counts.proposals,qualified:counts.qualified,
    unqualified:counts.unqualified,
    sourceFamilyUnknown:counts.familyUnknownProposals,
    sourceFamilyConflict:counts.familyConflictProposals,
    valveToFlangeRejected:counts.valveToFlangeRejected,
    valveToFlangeQualified:0},
  review:{source:before.counts.source,acceptedMatch1:counts.acceptedMatch1,
    acceptedFinal:counts.acceptedFinal,unresolved:before.counts.unresolved,
    unchanged:true},
  ownerEngineeringAcceptance:counts.acceptedFinal>0,
  historical125DecisionVerification:false,
  nativeCiiReleaseAuthorized:false,readOnly:true,
 });
}
