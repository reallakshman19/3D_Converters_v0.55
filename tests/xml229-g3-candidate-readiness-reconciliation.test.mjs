import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcileXml229CandidateCoverage as reconcile}
 from '../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs';
const s='a'.repeat(64),h='b'.repeat(64);
const clone=x=>structuredClone(x);
function pair(){
 const counts={zeroCandidateOccurrences:1,oneCandidateOccurrences:1,
   multiCandidateOccurrences:1,qualifiedCandidateCount:2,
   unqualifiedCandidateCount:2,occurrencesWithQualifiedCandidates:2,
   onlyUnqualifiedCandidateOccurrences:0,multipleQualifiedCandidateOccurrences:0,
   positiveSourceMassCount:1,nullSourceMassCount:2,invalidSourceMassCount:0,
   acceptedMatch1Count:1,acceptedFinalCount:1,
   rejectedMatch1Count:0,deferredMatch1Count:0,
   rejectedFinalCount:0,deferredFinalCount:0};
 const coverage={schema:'XML229.G3.CandidateCoverageReport.v1',basisId:s,
   sourceId:'S1',originalJsonSha256:h,sourceGenerationId:'G1',
   requestId:'REQ1',physicalCount:3,verifiedFactCount:21,proposalCount:4,
   sourceBasisVerified:true,reviewDecisionsAuthorized:false,
   nativeQualificationAuthorized:false,nativeCiiReleaseAuthorized:false,
   counts,decisionRevisions:{match1:'R1',final:'R2'}};
 const readiness={schema:'XML229.P4.RunAdvisory.v1',basisId:s,sourceId:'S1',
   originalJsonSha256:h,sourceGenerationId:'G1',
   verifiedPhysicalCount:3,verifiedFactCount:21,
   counts:{source:1,match1:1,final:1,unresolved:0},
   stageRevisions:{S1:{match1:'R1',final:'R2'}},
   engineeringFactsVerified:true,ciiReleaseAuthorized:false};
 return {coverage,readiness};
}
const has=(x,code)=>assert(x.issues.includes(code),JSON.stringify(x));
test('matching actual G3/G4 contract is structurally consistent, never releasable',()=>{
 const result=reconcile(pair());
 assert.equal(result.status,'CONSISTENT');
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 assert.equal(result.authoritative,false);
 assert.equal(result.candidateOccurrencesWithNone,1);
 assert(!JSON.stringify(result).includes('REQ1'));
});
test('source, original JSON, generation or basis drift are rejected',()=>{
 for(const path of ['basisId','sourceId','originalJsonSha256','sourceGenerationId']){
  const p=pair();p.coverage[path]=path==='basisId'?'c'.repeat(64):
   path==='originalJsonSha256'?'d'.repeat(64):'OTHER';
  has(reconcile(p),'G3_G4_INPUT_BASIS_DRIFT');
 }
});
test('reviewed revision is never silently joined across different stages',()=>{
 const p=pair();p.readiness.stageRevisions.S1.final='STALE';
 has(reconcile(p),'G3_G4_REVIEW_REVISION_DRIFT');
});
test('missing / malformed receipts fail incomplete; no release',()=>{
 const r=reconcile({coverage:{},readiness:{}});
 assert.equal(r.status,'INCOMPLETE');
 assert.equal(r.nativeCiiReleaseAuthorized,false);
 const p=pair();delete p.readiness.stageRevisions;
 has(reconcile(p),'G4_READINESS_MALFORMED');
});
test('forged native or review authority always fails',()=>{
 const a=pair();a.coverage.nativeCiiReleaseAuthorized=true;
 has(reconcile(a),'G3_UNSUPPORTED_AUTHORITY');
 const b=pair();b.readiness.ciiReleaseAuthorized=true;
 has(reconcile(b),'G4_UNSUPPORTED_NATIVE_AUTHORITY');
 const c=pair();c.coverage.reviewDecisionsAuthorized=true;
 has(reconcile(c),'G3_UNSUPPORTED_AUTHORITY');
});
test('mass authority and proposal partitions are independently checked',()=>{
 const p=pair();p.coverage.counts.acceptedFinalCount=0;
 has(reconcile(p),'G3_G4_MASS_AUTHORITY_CONFLICT');
 const q=pair();q.coverage.counts.multiCandidateOccurrences=2;
 has(reconcile(q),'G3_CANDIDATE_POPULATION_DRIFT');
 const d=pair();d.coverage.counts.qualifiedCandidateCount=3;
 has(reconcile(d),'G3_CANDIDATE_QUALIFICATION_DRIFT');
 const x=pair();x.readiness.counts.unresolved=1;
 has(reconcile(x),'G4_MASS_PARTITION_DRIFT');
});
test('facts count must equal 7 per physical and match each evidence source',()=>{
 const p=pair();p.readiness.verifiedFactCount=20;
 has(reconcile(p),'G3_G4_FACT_POPULATION_DRIFT');
 const q=pair();q.coverage.verifiedFactCount=20;
 has(reconcile(q),'G3_G4_FACT_POPULATION_DRIFT');
});
test('complete unresolved originals can have candidates without accepted mass',()=>{
 const p=pair();const n=p.coverage.counts;
 n.positiveSourceMassCount=0;n.nullSourceMassCount=3;
 n.acceptedMatch1Count=0;n.acceptedFinalCount=0;
 p.readiness.counts={source:0,match1:0,final:0,unresolved:3};
 const res=reconcile(p);
 assert.equal(res.status,'CONSISTENT');
 assert.equal(res.qualifiedCandidateCount,2);
 assert.equal(res.unresolvedMassCount,3);
});
test('whitelists counts without reflecting adversarial original or proposal text',()=>{
 const p=pair();p.coverage.extra={rawXml:'<Plant PRIVATE/>',
  proposedKg:999,masterRows:['private']};
 p.readiness.extra={candidateIds:['PRIVATE']};
 const out=JSON.stringify(reconcile(p));
 for(const forbidden of ['PRIVATE','<Plant','999','REQ1','masterRows'])
  assert.equal(out.includes(forbidden),false);
});
test('zero physical or nonsensical counter values are incomplete',()=>{
 const p=pair();p.coverage.physicalCount=0;
 assert.equal(reconcile(p).status,'INCOMPLETE');
 const q=pair();q.coverage.counts.qualifiedCandidateCount=-1;
 assert.equal(reconcile(q).status,'INCOMPLETE');
});

test('absent and null receipts remain incomplete instead of throwing',()=>{
 for(const arg of [undefined,null,{},
   {coverage:null,readiness:null},
   {coverage:undefined,readiness:undefined}]){
   const result=reconcile(arg);
   assert.equal(result.status,'INCOMPLETE');
   assert.equal(result.nativeCiiReleaseAuthorized,false);
 }
});
test('missing revision keys cannot impersonate matching no-decision states',()=>{
 const p=pair();p.coverage.decisionRevisions={};
 assert.equal(reconcile(p).status,'INCOMPLETE');
 const q=pair();q.readiness.stageRevisions.S1={};
 has(reconcile(q),'G3_G4_REVIEW_REVISION_DRIFT');
});

test('reconciliation contract is byte-identical in served docs Worker asset tree',async()=>{
 const moduleUrl=new URL('../contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs',import.meta.url);
 const docsUrl=new URL('../docs/contracts/xml229-evidence-v1/candidate-readiness-reconciliation.mjs',import.meta.url);
 const [source,served]=await Promise.all([readFile(moduleUrl,'utf8'),readFile(docsUrl,'utf8')]);
 assert.equal(served,source,'the browser Worker must resolve the same reconciliation contract');
});
