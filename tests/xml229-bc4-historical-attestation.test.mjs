import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
  evaluateBc4Fixture,inspectHistoricalBasisBackup,BC4_FIXTURE_SHA256
} from '../scripts/xml229-bc4-historical-attestation.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const original=new URL('./fixtures/xml229/BC4.LineList.json',import.meta.url);
const history={historicalLineListCount:385,
  historicalRowSha256:'7611c84e6aa365069154cd0eaab04196b930912162487adc7266b8d9962be62d',
  historicalMapSha256:'ce24f71840ac38d5f014688a68768cab9f459dd20f89378e37b66c80369a7507',
  historicalEffectiveConfigSha256:'21960505924b299997d570839cd561a028885e202d1b21a83721baf4179dd4af'};

test('real 385-row BC4 JSON with actual production normalization is historical HOLD',async()=>{
 const fixtureBytes=await readFile(original);
 assert.equal(sha(fixtureBytes),BC4_FIXTURE_SHA256);
 const r=evaluateBc4Fixture({fixtureBytes,historical:history});
 assert.equal(r.rawRows,385);
 assert.equal(r.currentMapDigest,'d85c6c7fa1e59f649451f01141b79e39ce693646b429846922ee3e6e49701717');
 assert.equal(r.currentRowsDigest,'65548a7e176534c457b7be41b50b64b22a54f869a5606ffc2ddff856d67c7f53');
 assert.equal(r.mappingMatches,false);
 assert.equal(r.rowsMatch,false);
 assert.equal(r.historicalLineListContentVerified,false);
 assert.equal(r.fullOriginalInputBasisVerified,false);
 assert.equal(r.historicalDecisionUpdates,0);
 assert.equal(r.engineeringKgApproved,0);
 assert.equal(r.acceptedFinal,0);
 assert.equal(r.governedNativeCiiReleaseAuthorized,false);
});
test('same-row-count JSON tampering fails source integrity',async()=>{
 const b=await readFile(original);
 const altered=Buffer.from(b.toString('utf8').replace('Service','Forged Service'));
 assert.equal(JSON.parse(altered).rows.length,385);
 assert.throws(()=>evaluateBc4Fixture({fixtureBytes:altered,historical:history}),
  {code:'ORIGINAL_BC4_JSON_FIXTURE_CHANGED'});
});
test('manually supplied wrong map cannot approve historical weight',async()=>{
 const b=await readFile(original);
 const r=evaluateBc4Fixture({fixtureBytes:b,historical:history,
  appliedFieldMap:{lineKey1:'2',lineKey2:'3',pipingClass:'22'}});
 assert.equal(r.mappingMatches,false);
 assert.equal(r.rowsMatch,false);
 assert.equal(r.originalAppliedMappingProvided,true);
 assert.equal(r.governedNativeCiiReleaseAuthorized,false);
});
test('even synthetic content-matching history cannot release Final or CII',async()=>{
 const b=await readFile(original);
 const baseline=evaluateBc4Fixture({fixtureBytes:b,historical:history});
 const r=evaluateBc4Fixture({fixtureBytes:b,historical:{
  historicalLineListCount:385,
  historicalRowSha256:baseline.currentRowsDigest,
  historicalMapSha256:baseline.currentMapDigest}});
 assert.equal(r.historicalLineListContentVerified,true);
 assert.equal(r.fullOriginalInputBasisVerified,false);
 assert.equal(r.engineeringKgApproved,0);
 assert.equal(r.acceptedFinal,0);
 assert.equal(r.governedNativeCiiReleaseAuthorized,false);
});
test('forged incomplete Owner backup cannot satisfy pinned content attestation',()=>{
 const fake={schema:'XML229.SourceBoundGC-PWReviewBackup.v1',
  physicalCount:423,factCount:2961,nativeCiiReleaseAuthorized:false};
 assert.throws(()=>inspectHistoricalBasisBackup(fake,'f'.repeat(64)),
  {code:'PRIVATE_BACKUP_INTEGRITY_OR_SOURCE_MISMATCH'});
 assert.throws(()=>evaluateBc4Fixture({fixtureBytes:Buffer.from('{}'),historical:history}),
  {code:'ORIGINAL_BC4_JSON_FIXTURE_CHANGED'});
});