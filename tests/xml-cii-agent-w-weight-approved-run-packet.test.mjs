import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createWeightReviewService, WEIGHT_SCHEMA } from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import {
  prepareApprovedWeightRunPacket, assertCurrentApprovedWeightRunPacket,
} from '../converters/xml-cii2019-core/weight-facts-approved-run-packet.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const reject=code=>error=>{assert.equal(error.code,code);return true;};
function fixture({unresolved=false}={}){
  const sources=['PL01','PL06'],basisId=hash('U9 original source weight packet');
  const basis={schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId,
    sourceRefs:sources.map(sourceId=>({sourceId,sha256:hash('original/'+sourceId),mediaType:'application/xml'})),
    scope:sources.map(sourceId=>({sourceId,selectionRef:'all'})),
    selectionSha256:hash('source-selection'),stagedSourceSha256:null,
    configSha256:hash('config'),overridesSha256:hash('overrides'),masters:{}};
  const occurrenceIds=sources.map(sourceId=>JSON.stringify([sourceId,0,0,'-1-original-valve']));
  const facts=sources.map((sourceId,i)=>({
    schemaVersion:WEIGHT_SCHEMA,domainId:basis.domainId,basisId,
    subjectType:'physical-component',sourceId,occurrenceId:occurrenceIds[i],
    fieldId:'mass.kg',value:i===0?59:(unresolved?null:120.73401),
    authority:i===1&&unresolved?'unresolved':'source',
    unit:'kg',provenance:[{sourceRef:sourceId,locator:'original-node-0'}],diagnostics:[],
  }));
  const review=createWeightReviewService({score:()=>[
    {basisId,domainId:basis.domainId,occurrenceId:occurrenceIds[1],
      proposalId:'suggested15',value:15,unit:'kg',method:'factor',
      ranking:1,qualified:false,scoringRevision:'oracle-1',
      eligibilityReasons:['factor-not-qualified'],evidenceRefs:[]} ]});
  review.openBasis(basis,{facts});
  const match=review.applyDecisions({basisId,scopeId:'PL01',stage:'RigidMatch1',
    commands:[{commandId:'review20',basisId,scopeId:'PL01',
      occurrenceId:occurrenceIds[0],expectedDecisionRevision:null,
      action:'enter-manual',unit:'kg',value:20,reason:'Engineering Match-1 measured source'}]})[0];
  const s1=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'RigidMatch1',
    expectedDecisionRevision:match.decisionRevision});
  const final=review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    commands:[{commandId:'review22',basisId,scopeId:'PL01',
      occurrenceId:occurrenceIds[0],expectedDecisionRevision:null,
      action:'final-override',unit:'kg',value:22,
      reason:'Engineer approved Final 22kg physical mass'}]})[0];
  const s2=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    expectedDecisionRevision:final.decisionRevision});
  return {session:{basis,review,openedFacts:2},ids:occurrenceIds,
    refs:[s1.snapshotRef,s2.snapshotRef]};
}
test('U9 source-run packet captures every physical kg with Final > Match1 > original and unchanged source provenance',async()=>{
  const {session,ids,refs}=fixture();
  const handoff=await prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:refs});
  assert.equal(handoff.packet.schemaVersion,'gc-pw-weight-run/1.0');
  assert.equal(handoff.packet.physicalCount,2);
  assert.equal(handoff.packet.factCount,2);
  assert.equal(handoff.packet.acceptedKg,142.73401);
  assert.match(handoff.packetSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(handoff.packet.reviewedSnapshotRefs,refs);
  assert.deepEqual(handoff.packet.components.map(x=>[x.massKg,x.authority]),[
    [22,'Rigidmatch2'],[120.73401,'source']]);
  assert.equal(handoff.packet.components[0].occurrenceId,ids[0]);
  assert.equal(handoff.packet.components[0].sourceKg,59);
  assert.equal(handoff.packet.components[0].match1Kg,20);
  assert.equal(handoff.packet.components[0].finalKg,22);
  assert.ok(handoff.packet.components.every(x=>!Object.hasOwn(x,'children')),
    'approved source kg is NOT generated CII child evidence');
  const check=await assertCurrentApprovedWeightRunPacket(session,handoff);
  assert.equal(check.valid,true);
  assert.equal(check.physicalCount,2);
  assert.equal(check.packetSha256,handoff.packetSha256);
});
test('U9 incomplete or extraneous source-stage frozen snapshot refs prevent a writer handoff',async()=>{
  const {session,refs}=fixture();
  await assert.rejects(()=>prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:[refs[0]]}),
    reject('MISSING_CURRENT_REVIEW_SNAPSHOT'));
  await assert.rejects(()=>prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:[...refs,refs[1]]}),
    reject('DUPLICATE_REVIEW_SNAPSHOT'));
  await assert.rejects(()=>prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:[...refs,'forged']}),
    reject('UNEXPECTED_REVIEW_SNAPSHOT'));
});
test('U9 unresolved original physical mass blocks run despite a ranked 15kg suggestion',async()=>{
  const {session,refs}=fixture({unresolved:true});
  await assert.rejects(()=>prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:refs}),
    reject('UNRESOLVED_WEIGHT'));
  assert.equal(session.review.getDecisionState({
    basisId:session.basis.basisId,scopeId:'PL06',stage:'RigidMatch1'}).decisionRevision,null);
});
test('U9 later Final ledger edit invalidates previously SHA-approved source kg',async()=>{
  const {session,ids,refs}=fixture();
  const handoff=await prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:refs});
  const revision=session.review.getDecisionState({
    basisId:session.basis.basisId,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision;
  session.review.applyDecisions({basisId:session.basis.basisId,scopeId:'PL01',
    stage:'Rigidmatch2',expectedDecisionRevision:revision,commands:[{
      commandId:'later-final23',basisId:session.basis.basisId,scopeId:'PL01',
      occurrenceId:ids[0],expectedDecisionRevision:revision,
      action:'final-override',value:23,unit:'kg',reason:'Late engineering correction'}]});
  await assert.rejects(()=>assertCurrentApprovedWeightRunPacket(session,handoff),
    reject('MISSING_CURRENT_REVIEW_SNAPSHOT'));
});
test('U9 tampered copied packet, altered physical occurrence, and forged SHA fail closed',async()=>{
  const {session,refs}=fixture();
  const original=await prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:refs});
  const tampered=structuredClone(original);
  tampered.packet.components[0].massKg=15;
  await assert.rejects(()=>assertCurrentApprovedWeightRunPacket(session,tampered),
    reject('STALE_WEIGHT_RUN_HANDOFF'));
  const alias=structuredClone(original);
  alias.packet.components[0].occurrenceId='PL01/branch:0/physical:0';
  await assert.rejects(()=>assertCurrentApprovedWeightRunPacket(session,alias),
    reject('STALE_WEIGHT_RUN_HANDOFF'));
  const forged={...original,packetSha256:hash('wrong digest')};
  await assert.rejects(()=>assertCurrentApprovedWeightRunPacket(session,forged),
    reject('WEIGHT_RUN_PACKET_DIGEST_MISMATCH'));
});
test('U9 concurrent stage mutation during source packet SHA256 creation is caught after async hashing',async()=>{
  const {session,ids,refs}=fixture();
  const pending=prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs:refs});
  const revision=session.review.getDecisionState({
    basisId:session.basis.basisId,scopeId:'PL01',stage:'Rigidmatch2'}).decisionRevision;
  session.review.applyDecisions({basisId:session.basis.basisId,scopeId:'PL01',
    stage:'Rigidmatch2',expectedDecisionRevision:revision,commands:[{
      commandId:'mid-hash-final24',basisId:session.basis.basisId,scopeId:'PL01',
      occurrenceId:ids[0],expectedDecisionRevision:revision,
      action:'final-override',value:24,unit:'kg',
      reason:'Concurrent acceptance during SHA computation'}]});
  await assert.rejects(pending,reject('MISSING_CURRENT_REVIEW_SNAPSHOT'));
});
