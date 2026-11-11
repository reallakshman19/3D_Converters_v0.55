import test from 'node:test';
import assert from 'node:assert/strict';
import {readXml229BoundedStagedPositionEvidence,diagnoseXml229NativeConverterFailure}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-converter-failure-diagnostic.mjs';

const sample={matcherRevision:'XML229_POSITION_PRECISION_V2',matchToleranceMm:3,
 count:2,sampleTruncated:false,sample:[
 {type:'dtxr-position-ambiguous',sourceClaimIndex:17,scope:'MANDATORY',
  reason:'NON_UNIQUE_POSITION_OWNER',candidateCount:2,candidatePositionRowIndices:[22,23],
  candidateGeometry:'DISTINCT',preciseCandidateCount:0,guardBandCandidateCount:2,
  matchedTransformCount:2,psCorroboratedCandidateCount:0,explicitXmlRefPresent:false,
  sourceBranch:'PRIVATE_PLANT'},
 {type:'dtxr-position-ambiguous',sourceClaimIndex:18,scope:'MANDATORY',
  reason:'COMPETING_POSITION_TRANSFORMS',candidateCount:3,candidatePositionRowIndices:[24,25,26],
  candidateGeometry:'COINCIDENT',preciseCandidateCount:2,guardBandCandidateCount:3,
  matchedTransformCount:2,psCorroboratedCandidateCount:2,explicitXmlRefPresent:true,
  rawPosition:'SECRET_COORDINATES'},
]};
const logs=['arbitrary raw source path PRIVATE_PLANT',
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(sample)];

test('only bounded source-free staged-position indices enter downloadable native failure',()=>{
 const safe=readXml229BoundedStagedPositionEvidence(logs);
 assert.equal(safe.schema,'XML229.NativeStagedPositionAmbiguity.v1');
 assert.equal(safe.ambiguousCount,2);
 assert.equal(safe.matcherRevision,'XML229_POSITION_PRECISION_V2');
 assert.equal(safe.matchToleranceMm,3);
 assert.equal(safe.sample[0].scope,'MANDATORY');
 assert.equal(safe.sample[0].candidateGeometry,'DISTINCT');
 assert.equal(safe.sample[0].preciseCandidateCount,0);
 assert.equal(safe.sample[0].guardBandCandidateCount,2);
 assert.equal(safe.sample[1].candidateGeometry,'COINCIDENT');
 assert.equal(safe.sample.length,2);
 assert.deepEqual(safe.sample[0].candidatePositionRowIndices,[22,23]);
 assert(!JSON.stringify(safe).includes('PRIVATE_PLANT'));
 assert(!JSON.stringify(safe).includes('SECRET_COORDINATES'));
 const failure=diagnoseXml229NativeConverterFailure({
  ok:false,error:'XML229_STAGED_POSITION_AMBIGUOUS',nativeFailurePhase:'CII_CONVERSION',
  nativePythonFailure:{code:'XML229_STAGED_POSITION_AMBIGUOUS',stage:'STAGED_POSITION_TRANSFER'},logs,
 });
 assert.equal(failure.code,'XML229_STAGED_POSITION_AMBIGUOUS');
 assert.deepEqual(failure.stagedPositionAmbiguity,safe);
 assert.equal(failure.nativeCiiReleaseAuthorized,false);
 assert.equal(failure.candidatePublished,false);
});
test('V3 native original-source proof remains bounded, typed and independently inspectable',()=>{
 const v3={...sample,matcherRevision:'XML229_POSITION_ORIGINAL_AUTHOR_V3',
   sample:sample.sample.map((e,i)=>({...e,
     originalSourceProofPresent:true,
     originalSourceRestraintCandidates:i===0?1:2,
     originalMatchingRestraintCandidates:i===0?0:2,
     originalNodeRef:'SECRET_SOURCE_REFERENCE',
   }))};
 const x=readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(v3)]);
 assert.equal(x.matcherRevision,'XML229_POSITION_ORIGINAL_AUTHOR_V3');
 assert.equal(x.sample[0].originalSourceProofPresent,true);
 assert.equal(x.sample[0].originalSourceRestraintCandidates,1);
 assert.equal(x.sample[1].originalMatchingRestraintCandidates,2);
 assert.equal(JSON.stringify(x).includes('SECRET_SOURCE_REFERENCE'),false);
 for(const bad of [
  {...v3,sample:[{...v3.sample[0],originalSourceProofPresent:'true'}]},
  {...v3,sample:[{...v3.sample[0],originalSourceRestraintCandidates:99}]},
  {...v3,sample:[{...v3.sample[0],originalMatchingRestraintCandidates:2}]},
 ])assert.equal(readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(bad)]),null);
});
test('V4 source carrier proof is bounded, typed and does not leak carrier reference',()=>{
 const original={...sample,matcherRevision:'XML229_POSITION_CARRIER_AUTHORITY_V4',
  sample:sample.sample.map((e,i)=>({...e,
   originalSourceProofPresent:true,originalSourceRestraintCandidates:0,
   originalMatchingRestraintCandidates:0,
   carrierRefDeclared:true,
   carrierRouteVerified:i===0,
   carrierCandidateCount:i===0?2:0,
   COMPRE:'PRIVATE_REFERENCE',
  }))};
 const resolved=readXml229BoundedStagedPositionEvidence([
   'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(original)]);
 assert.equal(resolved.matcherRevision,'XML229_POSITION_CARRIER_AUTHORITY_V4');
 assert.equal(resolved.sample[0].carrierRefDeclared,true);
 assert.equal(resolved.sample[0].carrierRouteVerified,true);
 assert.equal(resolved.sample[0].carrierCandidateCount,2);
 assert.equal(resolved.sample[1].carrierRouteVerified,false);
 assert.equal(JSON.stringify(resolved).includes('PRIVATE_REFERENCE'),false);
 for(const bad of [
  {...original,sample:[{...original.sample[0],carrierRefDeclared:'true'}]},
  {...original,sample:[{...original.sample[0],carrierCandidateCount:3}]},
  {...original,sample:[{...original.sample[1],carrierCandidateCount:1}]},
  {...original,sample:[{...original.sample[1],carrierRefDeclared:false,carrierRouteVerified:true}]},
 ])assert.equal(readXml229BoundedStagedPositionEvidence([
   'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(bad)]),null);
});
test('V5 carrier-edge matcher attests the corrected source-safe runtime',()=>{
 const v5={...sample,matcherRevision:'XML229_POSITION_CARRIER_EDGE_V5',
  sample:sample.sample.map((e,i)=>({...e,
   originalSourceProofPresent:true,
   originalSourceRestraintCandidates:0,
   originalMatchingRestraintCandidates:0,
   carrierRefDeclared:true,carrierRouteVerified:true,
   carrierCandidateCount:0,
   originalRef:'DO_NOT_EXPOSE_PRIVATE_REF',
  }))};
 const result=readXml229BoundedStagedPositionEvidence([
   'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(v5)]);
 assert.equal(result.matcherRevision,'XML229_POSITION_CARRIER_EDGE_V5');
 assert.equal(result.sample[0].carrierRouteVerified,true);
 assert.equal(result.sample[0].carrierCandidateCount,0);
 assert(!JSON.stringify(result).includes('DO_NOT_EXPOSE_PRIVATE_REF'));
});

test('V6 classifies carrier-route provenance without leaking producer identity',()=>{
 const statuses=['VERIFIED','NOT_DECLARED','MALFORMED_REFERENCE',
  'CONFLICTING_DECLARATIONS','BRANCH_UNRESOLVED','ROUTE_REF_NOT_FOUND',
  'ROUTE_REF_OTHER_BRANCH','ROUTE_REF_DUPLICATED'];
 for(const status of statuses){
  const claimed=status!=='NOT_DECLARED';
  const verified=status==='VERIFIED';
  const v6={...sample,matcherRevision:'XML229_POSITION_CARRIER_PROVENANCE_V6',
   sample:[{...sample.sample[0],originalSourceProofPresent:true,
    originalSourceRestraintCandidates:0,originalMatchingRestraintCandidates:0,
    carrierRefDeclared:claimed,carrierRouteVerified:verified,
    carrierCandidateCount:0,carrierRouteStatus:status,
    COMPRE:'SECRET_COMPRE',fullSourcePath:'SECRET_LOCATION'}]};
  const read=readXml229BoundedStagedPositionEvidence([
   'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(v6)]);
  assert(read);
  assert.equal(read.matcherRevision,'XML229_POSITION_CARRIER_PROVENANCE_V6');
  assert.equal(read.sample[0].carrierRouteStatus,status);
  assert.equal(read.sample[0].carrierRouteVerified,verified);
  assert(!JSON.stringify(read).includes('SECRET_'));
  const bad = [{...v6,sample:[{...v6.sample[0],carrierRouteStatus:'SECRET_STATUS'}]},
   {...v6,sample:[{...v6.sample[0],carrierRouteStatus:status,
    carrierRouteVerified:!verified}]},
   {...v6,sample:[{...v6.sample[0],carrierRefDeclared:!claimed}]}];
  for(const invalid of bad)assert.equal(
   readXml229BoundedStagedPositionEvidence([
    'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(invalid)]),null);
 }
});

test('legacy pre-version receipt remains bounded and scope optional',()=>{
 const older={count:1,sampleTruncated:false,sample:[{
  sourceClaimIndex:3,reason:'NON_UNIQUE_POSITION_OWNER',
  candidateCount:2,candidatePositionRowIndices:[2,3]}]};
 const receipt=readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(older)]);
 assert.equal(receipt.ambiguousCount,1);
 assert.equal(receipt.matcherRevision,undefined);
 assert.equal(receipt.sample[0].scope,undefined);
});
test('untrusted or oversized native logs cannot introduce arbitrary provenance',()=>{
 assert.equal(readXml229BoundedStagedPositionEvidence(['SECRET']),null);
 for(const changed of [
  {...sample,matcherRevision:'FORGED_NATIVE_AUTHORITY'},
  {...sample,matchToleranceMm:-1},
  {...sample,sample:[{...sample.sample[0],scope:'SECRET'}]},
  {...sample,sample:[{...sample.sample[0],candidateGeometry:'SECRET'}]},
  {...sample,sample:[{...sample.sample[0],preciseCandidateCount:3}]},
 ])assert.equal(readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify(changed)]),null);
 assert.equal(readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify({
   count:1,sample:[{sourceClaimIndex:0,reason:'FORGED',candidateCount:1,candidatePositionRowIndices:[0]}]})]),null);
 assert.equal(readXml229BoundedStagedPositionEvidence([
  'XML229_STAGED_POSITION_AMBIGUITY '+JSON.stringify({count:1,sample:new Array(21).fill(sample.sample[0])})]),null);
});
