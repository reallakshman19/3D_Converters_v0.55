import test from 'node:test';
import assert from 'node:assert/strict';
import {collectXml229ReadOnlyWeightAcceptance}
 from '../scripts/xml229-public41-weight-readonly-acceptance.mjs';

const basisId='b'.repeat(64),sourceId='SYNTHETIC_TEST',
 originalJsonSha256='a'.repeat(64);
const checked={
 status:'KNOWN',family:'VALVE',subtype:'GATE',
};
const flange={status:'KNOWN',family:'FLANGE',subtype:'UNSPECIFIED'};
const candidates=[
 {proposalId:'gate',qualified:true,unit:'kg',value:13,
  familyEligibility:{qualified:true,source:checked,master:checked}},
 {proposalId:'flange',qualified:false,unit:'kg',value:35,
  familyEligibility:{qualified:false,source:checked,master:flange,
   reasons:['FAMILY_MISMATCH']}},
];
function fake({badBasis=false,badKg=false,badPopulation=false,
 modifiedLedger=false,unsafe=false,staleOnAfter=false}={}){
 const receipt={basisId,originalJsonSha256,physicalCount:2,
  physicalFactCount:14};
 let reads=0,writes=0;
 const readCompletion=async()=>{
  reads++;
  return {basisId:staleOnAfter&&reads===3?'c'.repeat(64):basisId,
   originalJsonSha256,verifiedPhysicalCount:2,
   verifiedFactCount:14,engineeringFactsVerified:true,
   counts:{source:0,match1:modifiedLedger&&reads===3?1:0,final:0,
    unresolved:2},ciiReleaseAuthorized:false};
 };
 const coverage={basisId:badBasis?'d'.repeat(64):basisId,
  originalJsonSha256,physicalCount:2,verifiedFactCount:14,
  proposalCount:2,counts:{acceptedMatch1Count:0,acceptedFinalCount:0,
   qualifiedCandidateCount:1,unqualifiedCandidateCount:1},
  reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false};
 const readCandidateReadinessPair=async()=>({
  schema:'XML229.G3G4.SourceBoundAggregatePair.v1',
  readOnly:true,reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false,
  reconciliation:{status:'CONSISTENT'},coverage,
  readiness:{...await readCompletion()},
 });
 const rows=Array.from({length:2},(_,i)=>({
  occurrenceId:'o'+i,sourceId,sourceKg:null,match1Kg:null,finalKg:null,
  proposals:i===0?candidates.map((p,n)=>n===0&&unsafe?
    {...p,familyEligibility:{...p.familyEligibility,master:flange}}:
    {...p,value:n===0&&badKg?0:p.value}):[],
  match1View:{proposals:i===0?candidates:[],stageDecision:null},
  finalView:{stageDecision:null},
 }));
 // Browser/synthetic fixture counts should reflect source-wide two proposals.
 const session={receipt,readCompletion,readCandidateReadinessPair,
  async readPage({offset,limit,filter}){
   if(filter!=='all')throw Error('Expected unfiltered physical page');
   return {basisId,offset,complete:true,totalCount:badPopulation?3:2,
    rows:rows.slice(offset,offset+limit)};
  },
  review(){writes++;}
 };
 return {session,writes:()=>writes};
}
test('public/owner precheck projects only aggregate read-only 7-fact and family evidence',async()=>{
 const x=fake();
 const result=await collectXml229ReadOnlyWeightAcceptance(x.session,{
  expectedPhysicalCount:2,expectedFactCount:14,
 });
 assert.equal(result.population.physicalCount,2);
 assert.equal(result.population.factCount,14);
 assert.equal(result.proposals.qualified,1);
 assert.equal(result.proposals.unqualified,1);
 assert.equal(result.proposals.valveToFlangeRejected,1);
 assert.equal(result.proposals.valveToFlangeQualified,0);
 assert.equal(result.review.acceptedMatch1,0);
 assert.equal(result.ownerEngineeringAcceptance,false);
 assert.equal(result.historical125DecisionVerification,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 assert.equal(x.writes(),0);
 assert(!JSON.stringify(result).includes(sourceId));
 assert(!JSON.stringify(result).includes('gate'));
});
test('source basis, physical page census and owner expectations fail closed',async()=>{
 for(const args of [{badBasis:true},{badPopulation:true}])
  await assert.rejects(collectXml229ReadOnlyWeightAcceptance(fake(args).session),
   /PUBLIC41_WORKER_CUSTODY_OR_FACT_DRIFT|PUBLIC41_PAGE_POPULATION_DRIFT/);
 await assert.rejects(collectXml229ReadOnlyWeightAcceptance(fake().session,
  {expectedPhysicalCount:423}),/PUBLIC41_OWNER_EXPECTED_CENSUS_DRIFT/);
});
test('contradictory qualified valve-to-flange candidate fails closed',async()=>{
 await assert.rejects(collectXml229ReadOnlyWeightAcceptance(
  fake({unsafe:true}).session),{code:'PUBLIC41_SEMANTIC_ACCEPTANCE_DRIFT'});
});
test('review mutation during pagination or provenance read fails closed',async()=>{
 await assert.rejects(collectXml229ReadOnlyWeightAcceptance(
  fake({modifiedLedger:true}).session),{code:'PUBLIC41_READ_ONLY_STATE_CHANGED'});
 await assert.rejects(collectXml229ReadOnlyWeightAcceptance(
  fake({staleOnAfter:true}).session),{code:'PUBLIC41_READ_ONLY_STATE_CHANGED'});
});
