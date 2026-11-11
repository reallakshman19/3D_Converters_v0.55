import test from 'node:test';
import assert from 'node:assert/strict';
import {buildXml229RunHoldAudit} from '../tabs/xml-cii-2019-standalone/integration/xml229-run-hold-audit.mjs';
test('branch-format execution refusal is diagnosed before native intent/release, without private branch export',()=>{
 const sha='a'.repeat(64),basis='b'.repeat(64),sourceId='TEST';
 const input={sourceKind:'xml',sourceText:'<Plant/>',options:{},modeASourceId:sourceId,
  xml229StagedSourceReceipt:{schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
   sha256:sha,generationId:'G1'}};
 const sessionReceipt={basisId:basis,sourceId,originalJsonSha256:sha,sourceGenerationId:'G1',physicalCount:150};
 const completion={schema:'XML229.P4.RunAdvisory.v1',...sessionReceipt,
  verifiedPhysicalCount:150,verifiedFactCount:1050,counts:{source:0,match1:0,final:150,unresolved:0},
  engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false};
 const rows=[{id:'xml229-original-json-engineering-authority',blocking:true},
  {id:'branch-format-authority',blocking:true,detail:JSON.stringify([
   {status:'UNMATCHED',branchName:'PRIVATE_OWNER_BRANCH',formatCandidates:[{lineKey:'PRIVATE_KEY'}]},
   {status:'AMBIGUOUS',branchName:'PRIVATE_OWNER_BRANCH_2'}])}];
 const audit=buildXml229RunHoldAudit({input,sessionReceipt,completion,sessionState:'LIVE',
  report:{checklistRows:rows}});
 assert.equal(audit.diagnosisCode,'BRANCH_FORMAT_IDENTITY_UNRESOLVED');
 assert.equal(audit.firstUnverifiedBoundary,'configured-branch-formats');
 assert.equal(audit.branchFormat.unmatchedInSample,1);assert.equal(audit.branchFormat.ambiguousInSample,1);
 assert.equal(audit.evidence.find(s=>s.name==='weight-final-readiness').status,'VERIFIED');
 assert.equal(audit.nativeCiiReleaseAuthorized,false);assert.equal(audit.ciiDownloadAuthorized,false);
 const attempted=buildXml229RunHoldAudit({input,sessionReceipt,completion,sessionState:'LIVE',
   report:{checklistRows:rows},candidate:{status:'FAILED',code:'XML229_STAGED_POSITION_AMBIGUOUS',
     phase:'STAGED_POSITION_TRANSFER',elapsedMs:27015}});
 assert.equal(attempted.diagnosisCode,'NATIVE_CANDIDATE_FAILED');
 assert.equal(attempted.firstUnverifiedBoundary,'worker-r2-and-native-candidate');
 assert.equal(attempted.nativeCandidate.failureCode,'XML229_STAGED_POSITION_AMBIGUOUS');
 assert.equal(attempted.branchFormat.blocked,true);
 assert.equal(attempted.ciiDownloadAuthorized,false);
 assert(!JSON.stringify(audit).includes('PRIVATE_'));
 rows[1].detail='invalid private detail';
 assert.doesNotThrow(()=>buildXml229RunHoldAudit({input,report:{checklistRows:rows}}));
});
