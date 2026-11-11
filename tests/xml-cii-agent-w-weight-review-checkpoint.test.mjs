import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {digestCanonical} from '../contracts/gc-pw-v1/contract.mjs';
import {createWeightReviewService,WEIGHT_SCHEMA} from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import {createVerifiedWeightReviewCheckpoint,persistVerifiedWeightReviewCheckpoint,
  restoreVerifiedWeightReviewCheckpoint} from '../converters/xml-cii2019-core/weight-facts-review-checkpoint.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const sha=x=>createHash('sha256').update(String(x)).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const rejects=code=>error=>{assert.equal(error.code,code);return true;};
function fixture({sourceMass=59,secondMass=120.73401,signatures=['-1','-1']}={}){
  const sourceIds=['PL01','PL06'],basisId=sha('same immutable original SHA/master/selection U10');
  const basis={schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId,
    sourceRefs:sourceIds.map(sourceId=>({sourceId,sha256:sha('original/'+sourceId),mediaType:'application/xml'})),
    scope:sourceIds.map(sourceId=>({sourceId,selectionRef:'all'})),
    selectionSha256:sha('selection'),stagedSourceSha256:null,
    configSha256:sha('config'),overridesSha256:sha('overrides'),masters:{}};
  const ids=sourceIds.map((sourceId,i)=>JSON.stringify([sourceId,0,0,signatures[i]]));
  const facts=sourceIds.map((sourceId,i)=>({schemaVersion:WEIGHT_SCHEMA,basisId,
    domainId:basis.domainId,subjectType:'physical-component',sourceId,occurrenceId:ids[i],
    fieldId:'mass.kg',authority:'source',value:i?secondMass:sourceMass,unit:'kg',
    provenance:[{sourceRef:sourceId,locator:'original-source-ordinal'}],diagnostics:[]}));
  const review=createWeightReviewService({score:()=>[],digestReview:digestCanonical});
  review.openBasis(basis,{facts});
  return {session:{basis,review,openedFacts:2},ids};
}
function reviewed(){
  const f=fixture(),{session,ids}=f,basisId=session.basis.basisId,review=session.review;
  const m=review.applyDecisions({basisId,scopeId:'PL01',commands:[{
    commandId:'explicit-20',basisId,scopeId:'PL01',occurrenceId:ids[0],
    expectedDecisionRevision:null,action:'enter-manual',value:20,unit:'kg',
    reason:'Measured original component'}]})[0];
  const s1=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'RigidMatch1',
    expectedDecisionRevision:m.decisionRevision});
  const fin=review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    commands:[{commandId:'explicit-final-22',basisId,scopeId:'PL01',
      occurrenceId:ids[0],expectedDecisionRevision:null,action:'final-override',
      value:22,unit:'kg',reason:'Final approved measurement'}]})[0];
  const s2=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    expectedDecisionRevision:fin.decisionRevision});
  return {...f,snapshots:[s1.snapshotRef,s2.snapshotRef]};
}
function storage(){
  const records=new Map();
  return {records,
    async readCheckpoint({basisId}){return records.has(basisId)?clone(records.get(basisId)):null;},
    async compareAndSwapCheckpoint({basisId,expectedRevision,checkpoint}){
      const now=records.get(basisId)||null;
      if((now?.revision||null)!==expectedRevision)return {applied:false};
      const revision='cas-'+String(Number((now?.revision||'cas-0').slice(4))+1);
      records.set(basisId,{revision,checkpoint:clone(checkpoint)});
      return {applied:true,revision};
    }
  };
}
test('U10 persisted SHA-attested Match-1/Final snapshots restore into a reopened original source session',async()=>{
  const {session,snapshots}=reviewed(),store=storage();
  const written=await persistVerifiedWeightReviewCheckpoint(session,{store,expectedStoreRevision:null});
  assert.equal(written.storeRevision,'cas-1');
  assert.match(written.checkpointSha256,/^[a-f0-9]{64}$/);
  assert.equal(written.checkpoint.reviewState.frozenSnapshots.length,2);
  const reopened=fixture(),restored=await restoreVerifiedWeightReviewCheckpoint(reopened.session,{
    store,expectedStoreRevision:written.storeRevision});
  assert.equal(restored.restoredStages,2);
  assert.equal(restored.restoredSnapshots,2);
  assert.deepEqual(reopened.session.review.getSnapshot({
    basisId:reopened.session.basis.basisId,stage:'RigidMatch1'}).map(s=>s.snapshotRef),[snapshots[0]]);
  assert.deepEqual(reopened.session.review.getSnapshot({
    basisId:reopened.session.basis.basisId,stage:'Rigidmatch2'}).map(s=>s.snapshotRef),[snapshots[1]]);
  assert.equal(reopened.session.review.getDecisionState({basisId:reopened.session.basis.basisId,
    scopeId:'PL01',stage:'Rigidmatch2'}).decisions[reopened.ids[0]].value,22);
  const second=await persistVerifiedWeightReviewCheckpoint(reopened.session,{
    store,expectedStoreRevision:written.storeRevision});
  assert.equal(second.storeRevision,'cas-2');
  await assert.rejects(()=>persistVerifiedWeightReviewCheckpoint(session,{
    store,expectedStoreRevision:'cas-1'}),rejects('STALE_STORED_WEIGHT_REVIEW'));
});
test('U10 no blind overwrite when host CAS denies a concurrent writer or lies about readback',async()=>{
  const {session}=reviewed(),store=storage();
  const denied={...store,compareAndSwapCheckpoint:async()=>({applied:false})};
  await assert.rejects(()=>persistVerifiedWeightReviewCheckpoint(session,{
    store:denied,expectedStoreRevision:null}),rejects('WEIGHT_CHECKPOINT_CAS_FAILED'));
  assert.equal(store.records.size,0);
  const liar={...store,compareAndSwapCheckpoint:async()=>({applied:true,revision:'cas-1'})};
  await assert.rejects(()=>persistVerifiedWeightReviewCheckpoint(session,{
    store:liar,expectedStoreRevision:null}),rejects('WEIGHT_CHECKPOINT_READBACK_MISMATCH'));
  assert.equal(store.records.size,0);
});
test('U10 changed original mass and changed physical source identity are rejected even at same count and BasisRef',async()=>{
  const {session}=reviewed(),store=storage();
  const saved=await persistVerifiedWeightReviewCheckpoint(session,{store});
  const alteredMass=fixture({sourceMass:60});
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(alteredMass.session,{
    store,expectedStoreRevision:saved.storeRevision}),rejects('SOURCE_POPULATION_CHANGED'));
  const alias=fixture({signatures:['CHANGED_SAME_COUNT','-1']});
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(alias.session,{
    store,expectedStoreRevision:saved.storeRevision}),rejects('SOURCE_POPULATION_CHANGED'));
  assert.equal(alteredMass.session.review.getDecisionState({basisId:alteredMass.session.basis.basisId,
    scopeId:'PL01',stage:'RigidMatch1'}).decisionRevision,null);
});
test('U10 SHA corruption, substituted review command and stale store CAS revision fail before restore',async()=>{
  const {session}=reviewed(),store=storage();
  const saved=await persistVerifiedWeightReviewCheckpoint(session,{store});
  const entry=store.records.get(session.basis.basisId);
  entry.checkpoint.reviewState.reviewStates[0].decisions[JSON.stringify(['PL01',0,0,'-1'])].value=999;
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(fixture().session,{
    store,expectedStoreRevision:saved.storeRevision}),rejects('WEIGHT_CHECKPOINT_DIGEST_MISMATCH'));
  entry.checkpoint=clone(saved.checkpoint);
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(fixture().session,{
    store,expectedStoreRevision:'cas-other'}),rejects('STALE_STORED_WEIGHT_REVIEW'));
  const changed=clone(saved.checkpoint);
  changed.checkpointSha256=sha('wrong');
  entry.checkpoint=changed;
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(fixture().session,{
    store,expectedStoreRevision:saved.storeRevision}),rejects('WEIGHT_CHECKPOINT_DIGEST_MISMATCH'));
});
test('U10 no persistence of stale accepted stage that changes during asynchronous host CAS',async()=>{
  const {session,ids}=reviewed(),store=storage();
  const disruptive={...store,async compareAndSwapCheckpoint(args){
    const result=await store.compareAndSwapCheckpoint(args);
    const basisId=session.basis.basisId;
    const stage=session.review.getDecisionState({basisId,scopeId:'PL01',stage:'Rigidmatch2'});
    session.review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
      expectedDecisionRevision:stage.decisionRevision,commands:[{
        commandId:'late-final-23',basisId,scopeId:'PL01',occurrenceId:ids[0],
        expectedDecisionRevision:stage.decisionRevision,action:'final-override',
        value:23,unit:'kg',reason:'Engineering changed decision during CAS'}]});
    return result;
  }};
  await assert.rejects(()=>persistVerifiedWeightReviewCheckpoint(session,{
    store:disruptive,expectedStoreRevision:null}),rejects('STALE_WEIGHT_CHECKPOINT'));
});
test('U10 cannot operate on source-only/session-missing, unqualified storage, or empty historical record',async()=>{
  const {session}=reviewed();
  await assert.rejects(()=>createVerifiedWeightReviewCheckpoint({basis:session.basis,openedFacts:2}),
    rejects('PERSISTENCE_UNAVAILABLE'));
  await assert.rejects(()=>persistVerifiedWeightReviewCheckpoint(session,{
    store:{readCheckpoint:async()=>null},expectedStoreRevision:null}),
    rejects('CHECKPOINT_CAS_REQUIRED'));
  await assert.rejects(()=>restoreVerifiedWeightReviewCheckpoint(session,{
    store:storage(),expectedStoreRevision:'cas-404'}),
    rejects('STALE_STORED_WEIGHT_REVIEW'));
});
