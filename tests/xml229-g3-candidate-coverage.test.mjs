import test from 'node:test';
import assert from 'node:assert/strict';
import {buildXml229CandidateCoverageReport}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-candidate-coverage-report.mjs';
const a='a'.repeat(64),b='b'.repeat(64);
const err=code=>e=>(assert.equal(e?.code,code),true);
function fixture(){
 const ids=['A','B','C','D'];
 const raw=[
  [],[{proposalId:'P1',ranking:1,value:10,qualified:true}],
  [{proposalId:'P2',ranking:1,value:9,qualified:false},
   {proposalId:'P3',ranking:2,value:15,qualified:true}],
  [{proposalId:'P4',ranking:1,value:6,qualified:false}],
 ];
 const by=new Map(ids.map((id,i)=>[id,raw[i]]));
 const masses=new Map([['A',null],['B',null],['C',null],['D',7]]);
 const stages={
   RigidMatch1:{decisionRevision:'R1',decisions:{B:{state:'accepted',value:10}}},
   Rigidmatch2:{decisionRevision:null,decisions:{}},
 };
 let currentReads=0,proposalBatches=0;
 const review={
   getDecisionState({basisId,scopeId,stage}){
     assert.equal(basisId,a);assert.equal(scopeId,'S1');
     const entry=stages[stage];return {basisId,scopeId,stage,
       decisionRevision:entry.decisionRevision,
       decisions:structuredClone(entry.decisions)};
   },
   applyDecisions(){throw Error('MUST NOT WRITE ANY DECISIONS');},
 };
 const session={basis:{basisId:a,scope:[{sourceId:'S1'}]},
   openedFacts:28,review};
 const physicalOccurrences=ids.map(occurrenceId=>({sourceId:'S1',occurrenceId}));
 const weightProjection={count:4,
   get:id=>({basisId:a,sourceId:'S1',occurrenceId:id,sourceKg:masses.get(id)}),
   proposals:batch=>{
     proposalBatches++;
     return new Map(batch.map(id=>[id,structuredClone(by.get(id))]));
   }};
 const input={session,sourceId:'S1',physicalOccurrences,
   weightProjection,sourceReceipt:{sha256:b,generationId:'G1'},
   requestId:'CURRENT',readCurrentSession:()=>{
     currentReads++;return {basisId:a,requestId:'CURRENT',
       sourceGenerationId:'G1',closed:false};
   }};
 return {input,stages,by,masses,getReads:()=>currentReads,
   getBatches:()=>proposalBatches};
}
test('full read-only candidate census separates proposals, source mass and decisions',()=>{
 const x=fixture();const r=buildXml229CandidateCoverageReport(x.input);
 assert.equal(r.schema,'XML229.G3.CandidateCoverageReport.v1');
 assert.equal(r.physicalCount,4);assert.equal(r.verifiedFactCount,28);
 assert.equal(r.proposalCount,4);
 assert.equal(r.counts.zeroCandidateOccurrences,1);
 assert.equal(r.counts.oneCandidateOccurrences,2);
 assert.equal(r.counts.multiCandidateOccurrences,1);
 assert.equal(r.counts.qualifiedCandidateCount,2);
 assert.equal(r.counts.unqualifiedCandidateCount,2);
 assert.equal(r.counts.onlyUnqualifiedCandidateOccurrences,1);
 assert.equal(r.counts.positiveSourceMassCount,1);
 assert.equal(r.counts.nullSourceMassCount,3);
 assert.equal(r.counts.acceptedMatch1Count,1);
 assert.equal(r.counts.acceptedFinalCount,0);
 assert.equal(r.nativeCiiReleaseAuthorized,false);
 assert.equal(r.reviewDecisionsAuthorized,false);
 assert.equal(x.getBatches(),1);
 assert(x.getReads()>=2);
 assert(!JSON.stringify(r).includes('P3'));
 assert(!JSON.stringify(r).includes('"value":10'));
 assert(!JSON.stringify(r).includes('"occurrenceId"'));
});
test('no proposals is distinct from no Final mass; no automatic acceptance',()=>{
 const x=fixture();for(const k of x.by.keys())x.by.set(k,[]);
 x.stages.RigidMatch1.decisions={};
 const r=buildXml229CandidateCoverageReport(x.input);
 assert.equal(r.counts.zeroCandidateOccurrences,4);
 assert.equal(r.counts.acceptedFinalCount,0);
 assert.equal(r.counts.acceptedMatch1Count,0);
 assert.equal(r.proposalCount,0);
});
test('rejects incomplete census, duplicate originals and foreign source',()=>{
 const x=fixture();x.input.session.openedFacts=27;
 assert.throws(()=>buildXml229CandidateCoverageReport(x.input),err('COVERAGE_ATTESTED_POPULATION_REQUIRED'));
 const y=fixture();y.input.physicalOccurrences[1].occurrenceId='A';
 assert.throws(()=>buildXml229CandidateCoverageReport(y.input),err('COVERAGE_ORIGINAL_OWNER_DRIFT'));
 const z=fixture();z.input.physicalOccurrences[1].sourceId='S2';
 assert.throws(()=>buildXml229CandidateCoverageReport(z.input),err('COVERAGE_ORIGINAL_OWNER_DRIFT'));
});
test('refuses Worker supersession and changed review revisions',()=>{
 const x=fixture();x.input.readCurrentSession=()=>({
   basisId:a,requestId:'OLD',sourceGenerationId:'G1',closed:false,
 });
 assert.throws(()=>buildXml229CandidateCoverageReport(x.input),err('COVERAGE_SESSION_SUPERSEDED'));
 const y=fixture();let n=0;
 const getter=y.input.session.review.getDecisionState;
 y.input.session.review.getDecisionState=args=>{
   const state=getter(args);
   if(args.stage==='RigidMatch1'&&++n===2)state.decisionRevision='R2';
   return state;
 };
 assert.throws(()=>buildXml229CandidateCoverageReport(y.input),err('COVERAGE_REVIEW_REVISION_CHANGED'));
});
test('rejects malformed proposals instead of qualifying them',()=>{
 const x=fixture();x.by.set('B',[{proposalId:'P',ranking:1,value:0,qualified:true}]);
 assert.throws(()=>buildXml229CandidateCoverageReport(x.input),err('COVERAGE_CANDIDATE_PROVENANCE_INVALID'));
 const y=fixture();y.by.set('C',[{proposalId:'P',ranking:1,value:8,qualified:'yes'}]);
 assert.throws(()=>buildXml229CandidateCoverageReport(y.input),err('COVERAGE_CANDIDATE_QUALIFICATION_INVALID'));
});
test('rejects unexpected review owner and nonpositive accepted kg',()=>{
 const x=fixture();x.stages.RigidMatch1.decisions.UNKNOWN={state:'accepted',value:10};
 assert.throws(()=>buildXml229CandidateCoverageReport(x.input),err('COVERAGE_FOREIGN_REVIEW_OWNER'));
 const y=fixture();y.stages.RigidMatch1.decisions.B.value=0;
 assert.throws(()=>buildXml229CandidateCoverageReport(y.input),err('COVERAGE_ACCEPTED_NONPOSITIVE_KG'));
});
test('no identity or proposal details escape the report',()=>{
 const x=fixture();x.by.set('B',[{proposalId:'SUPER_PRIVATE_MASTER_ROW',ranking:1,
   value:777777,qualified:true}]);
 const r=buildXml229CandidateCoverageReport(x.input);
 const str=JSON.stringify(r);
 assert(!str.includes('SUPER_PRIVATE_MASTER_ROW'));
 assert(!str.includes('777777'));assert(!str.includes('"A"'));
});
test('large census is bounded and proposals are always requested by at most 64 IDs',()=>{
 const x=fixture();
 const ids=Array.from({length:129},(_,i)=>'O'+i);
 x.input.physicalOccurrences=ids.map(occurrenceId=>({sourceId:'S1',occurrenceId}));
 x.input.session.openedFacts=903;x.input.weightProjection.count=129;
 const batches=[];
 x.input.weightProjection.get=id=>({basisId:a,sourceId:'S1',occurrenceId:id,sourceKg:null});
 x.input.weightProjection.proposals=occ=>{batches.push(occ.length);
   return new Map(occ.map(id=>[id,[]]));};
 x.stages.RigidMatch1.decisions={};
 const r=buildXml229CandidateCoverageReport(x.input);
 assert.equal(r.physicalCount,129);
 assert.deepEqual(batches,[64,64,1]);
 assert.equal(r.counts.zeroCandidateOccurrences,129);
});

test('read-only coverage accepts only explicit Owner-confirmed zero Final as assigned mass',()=>{
 const x=fixture();
 x.stages.Rigidmatch2.decisions={A:{
  state:'accepted',action:'set-zero-mass',value:0,unit:'kg',
  reason:'Owner-confirmed explicit zero kg: blank physical',
 }};
 x.stages.Rigidmatch2.decisionRevision='F2';
 const coverage=buildXml229CandidateCoverageReport(x.input);
 assert.equal(coverage.counts.acceptedFinalCount,1);
 assert.equal(coverage.nativeCiiReleaseAuthorized,false);
 x.stages.Rigidmatch2.decisions.A.action='final-override';
 assert.throws(()=>buildXml229CandidateCoverageReport(x.input),
  err('COVERAGE_ACCEPTED_NONPOSITIVE_KG'));
});
