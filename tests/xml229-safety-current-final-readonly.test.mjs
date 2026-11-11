import test from 'node:test';
import assert from 'node:assert/strict';
import {collectXml229ReadOnlyWeightAcceptance}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-full-source-weight-safety-receipt.mjs';
import {buildStandaloneOutputRunReadiness}
 from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';

const sha='a'.repeat(64),sourceSha='b'.repeat(64);
function fixture(acceptedKg=null){
 const final=acceptedKg!==null,counts={
  source:0,match1:0,final:Number(final),unresolved:Number(!final),
 };
 const receipt={basisId:sha,originalJsonSha256:sourceSha,
  sourceId:'SOURCE',physicalCount:1,physicalFactCount:7};
 const ready={basisId:sha,originalJsonSha256:sourceSha,
  verifiedPhysicalCount:1,verifiedFactCount:7,
  engineeringFactsVerified:true,ciiReleaseAuthorized:false,counts};
 const coverage={basisId:sha,originalJsonSha256:sourceSha,
  physicalCount:1,verifiedFactCount:7,proposalCount:0,
  counts:{acceptedMatch1Count:0,acceptedFinalCount:Number(final),
   qualifiedCandidateCount:0,unqualifiedCandidateCount:0},
  reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false};
 const row={sourceId:'SOURCE',occurrenceId:'id',sourceKg:null,match1Kg:null,
  finalKg:acceptedKg,proposals:[],
  match1View:{proposals:[],stageDecision:null},
  finalView:{stageDecision:final?{
   state:'accepted',action:acceptedKg===0?'set-zero-mass':'final-override',
   value:acceptedKg,
  }:null}};
 let writes=0,reads=0;
 const session={receipt,
  async readCompletion(){reads++;return structuredClone(ready);},
  async readCandidateReadinessPair(){reads++;return {
   schema:'XML229.G3G4.SourceBoundAggregatePair.v1',
   reconciliation:{status:'CONSISTENT'},
   coverage:structuredClone(coverage),readiness:structuredClone(ready),
   readOnly:true,reviewDecisionsAuthorized:false,nativeCiiReleaseAuthorized:false};
  },
  async readPage({offset,limit,filter,query}){
   reads++;assert.equal(filter,'all');assert.equal(query,'');
   assert.equal(limit,25);return {basisId:sha,offset,totalCount:1,complete:true,
    rows:offset===0?[structuredClone(row)]:[]};
  },
  async review(){writes++;throw Error('READ_ONLY_AUDIT_MUST_NOT_WRITE');},
 };
 return {session,ready,coverage,row,getStats:()=>({writes,reads})};
}
for(const kg of [null,35,0]){
 test('safety audit downloads exact current ledger without new decisions; Final '+kg,async()=>{
  const f=fixture(kg);
  const before=structuredClone(f.ready);
  const result=await collectXml229ReadOnlyWeightAcceptance(f.session,{
   expectedPhysicalCount:1,expectedFactCount:7,
  });
  assert.equal(result.readOnly,true);
  assert.equal(result.population.physicalCount,1);
  assert.equal(result.review.acceptedFinal,kg===null?0:1);
  assert.equal(result.review.unresolved,kg===null?1:0);
  assert.equal(result.review.unchanged,true);
  assert.equal(result.ownerEngineeringAcceptance,kg!==null);
  assert.equal(result.nativeCiiReleaseAuthorized,false);
  assert.equal(f.getStats().writes,0,'audit must not authorize or write');
  assert(f.getStats().reads>=4,'fresh before, pair, page, after');
  assert.deepEqual(f.ready,before,'even approved 0 Final is not mutated');
 });
}
test('changed Final during download fails closed without granting release',async()=>{
 const f=fixture(15);
 const completion=f.session.readCompletion;let calls=0;
 f.session.readCompletion=async()=>{calls++;const proof=await completion();
  if(calls===2)proof.counts.final=0;
  return proof;
 };
 await assert.rejects(collectXml229ReadOnlyWeightAcceptance(f.session),
  {code:'PUBLIC41_READ_ONLY_STATE_CHANGED'});
 assert.equal(f.getStats().writes,0);
});
test('governed JSON is visibly HELD, warning not runtime error, and still blocks Run',()=>{
 const state={
  sourceKind:'xml',sourceText:'<PipeStressExport />',
  supportConfigJson:'{}',options:{outputMode:'cii-only'},
  xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'},
 };
 const report=buildStandaloneOutputRunReadiness(state);
 const held=report.checklistRows.find(x=>x.id==='xml229-original-json-engineering-authority');
 assert.equal(held.status,'held');
 assert.equal(held.severity,'warning');
 assert.equal(held.blocking,true);
 assert(report.summary.blockingCount>0);
 assert(report.logRows.some(x=>x.source==='readiness'&&x.level==='warning'&&
   x.message.startsWith(held.label+': ')));
 assert(report.diagnostics.some(x=>x.type===held.id&&x.level==='warning'));
 assert.equal(report.runHoldAudit.nativeCiiReleaseAuthorized,false);
});
