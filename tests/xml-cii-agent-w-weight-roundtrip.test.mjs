import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {makeBasisRef,digestCanonical,digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {physicalOccurrenceId} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {createCanonicalWeightFactSession} from '../converters/xml-cii2019-core/weight-facts-canonical-consumer.js';
import {readVerifiedModeAFinalRows} from '../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import {persistVerifiedWeightReviewCheckpoint,restoreVerifiedWeightReviewCheckpoint}
  from '../converters/xml-cii2019-core/weight-facts-review-checkpoint.js';
import {prepareApprovedWeightRunPacket,assertCurrentApprovedWeightRunPacket}
  from '../converters/xml-cii2019-core/weight-facts-approved-run-packet.js';
import {verifyEmittedCiiWeightHandoff}
  from '../converters/xml-cii2019-core/weight-facts-emitted-cii-handoff.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const copy=x=>structuredClone(x);
const rejected=code=>error=>{assert.equal(error.code,code);return true;};
const original=[
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:0,nodeNumber:-1},
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:1,nodeNumber:-1},
  {sourceId:'PL01',branchOccurrenceIndex:1,nodeOrdinal:0,nodeNumber:-1},
  {sourceId:'PL06',branchOccurrenceIndex:0,nodeOrdinal:0,nodeNumber:-1},
];
const physical=[
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:'identical-negative-number'},
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:1,componentSignature:'identical-negative-number'},
  {sourceId:'PL06',branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:'identical-negative-number'},
];
const ids=physical.map(physicalOccurrenceId);
async function input(){
  const live={
    sources:{PL01:'<Model A="1"><Node Number="-1"/></Model>',
      PL06:'<Model B="2"><Node Number="-1"/></Model>'},
    selection:[{sourceId:'PL01',selectionRef:'all'},{sourceId:'PL06',selectionRef:'all'}],
    stagedSource:null,
    masters:{weight:{datasetId:'weight',revision:1,
      rows:[{code:'valve',massKg:15}],mapping:{Mass:'massKg'}}},
    config:{ratingMode:'from-original-source'},overrides:{},
  };
  const basis=await makeBasisRef({
    domainId:'xml-cii/2019',
    sourceRefs:Object.entries(live.sources).map(([sourceId,xml])=>({
      sourceId,sha256:hash(xml),mediaType:'application/xml'})),
    selectionSha256:await digestCanonical(live.selection),
    stagedSourceSha256:null,
    masters:{weight:{datasetId:'weight',revision:1,rowCount:1,
      sha256:await digestCanonical(live.masters.weight.rows),
      mappingSha256:await digestCanonical(live.masters.weight.mapping)}},
    configSha256:await digestCanonical(live.config),
    overridesSha256:await digestCanonical(live.overrides),
    scope:live.selection,
  });
  const mass=[59,32,120.73401],fields=['mass.kg','rating','bore.mm'];
  const records=physical.flatMap((p,i)=>fields.map(fieldId=>({
    schemaVersion:'gc-pw/1.0',basisId:basis.basisId,domainId:basis.domainId,
    subjectType:'physical-component',sourceId:p.sourceId,
    occurrenceId:physicalOccurrenceId(p),fieldId,
    value:fieldId==='mass.kg'?mass[i]:fieldId==='rating'?'150':100,
    unit:fieldId==='mass.kg'?'kg':fieldId==='bore.mm'?'mm':null,
    authority:'source',
    provenance:[{sourceRef:p.sourceId,locator:'original-source-ordinal'}],diagnostics:[],
  })));
  return {basis,live,originalOccurrences:copy(original),
    expectedOriginalCount:original.length,physicalOccurrences:copy(physical),
    requiredFieldIds:fields,
    pages:[
      {schemaVersion:'gc-pw/1.0',basisId:basis.basisId,items:records.slice(0,4),
        totalCount:records.length,nextCursor:'offset:4',complete:true},
      {schemaVersion:'gc-pw/1.0',basisId:basis.basisId,items:records.slice(4),
        totalCount:records.length,nextCursor:null,complete:true},
    ]};
}
async function open(source){
  const review=createCanonicalWeightFactSession({score:()=>[],digestReview:digestCanonical});
  const result=await review.openCanonicalFacts(source);
  assert.equal(result.verifiedOriginalCount,4);
  assert.equal(result.verifiedPhysicalCount,3);
  assert.equal(result.verifiedFactCount,9);
  return {basis:source.basis,review,openedFacts:result.verifiedFactCount};
}
function accept(session){
  const basisId=session.basis.basisId;
  const match=session.review.applyDecisions({basisId,scopeId:'PL01',stage:'RigidMatch1',
    commands:[{basisId,scopeId:'PL01',occurrenceId:ids[0],commandId:'explicit-m1-20',
      expectedDecisionRevision:null,action:'enter-manual',value:20,unit:'kg',
      reason:'Engineer measured first original physical valve'}]})[0];
  const s1=session.review.freezeSnapshot({basisId,scopeId:'PL01',stage:'RigidMatch1',
    expectedDecisionRevision:match.decisionRevision});
  const fin=session.review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    commands:[{basisId,scopeId:'PL01',occurrenceId:ids[0],commandId:'explicit-fin-22',
      expectedDecisionRevision:null,action:'final-override',value:22,unit:'kg',
      reason:'Separate Final engineering child allocation'}]})[0];
  const s2=session.review.freezeSnapshot({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    expectedDecisionRevision:fin.decisionRevision});
  return [s1.snapshotRef,s2.snapshotRef];
}
function memoryCas(){
  let record=null;
  return {
    async readCheckpoint(){return record?copy(record):null;},
    async compareAndSwapCheckpoint({expectedRevision,checkpoint}){
      if((record?.revision??null)!==expectedRevision)return {applied:false};
      const revision='r'+(Number(record?.revision?.slice(1)||0)+1);
      record={revision,checkpoint:copy(checkpoint)};
      return {applied:true,revision};
    },
  };
}
// Independent test oracle reads a synthetic emitted CII XML specimen, not
// accepted parent kg or Weight FactRecords. #999/#1019 must supply the REAL
// output parser before claiming production verification.
const parent=(source,occurrence,children,unitValue,scale=10)=>
  '<Physical source="'+source+'" occurrence="'+encodeURIComponent(occurrence)+'">'+
  children.map(([id,kg])=>'<Child id="'+id+'" kg="'+kg+'"/>').join('')+
  '<Output unit="cii-force" scale="'+scale+'" value="'+unitValue+'"/></Physical>';
function syntheticCii({omitThird=false,firstKg=10,firstOutput=220,firstScale=10}={}){
  return '<CII>'+
    parent('PL01',ids[0],[['child-a',firstKg],['child-b',12]],firstOutput,firstScale)+
    parent('PL01',ids[1],[['child-c',14],['child-d',18]],320)+
    (omitThird?'':parent('PL06',ids[2],[['child-e',120.73401]],1207.3401))+
    '</CII>';
}
async function independentParse(xml,identity){
  const components=[...xml.matchAll(/<Physical source="([^"]+)" occurrence="([^"]+)">([\s\S]*?)<\/Physical>/g)]
    .map(m=>{
      const out=m[3].match(/<Output unit="([^"]+)" scale="([^"]+)" value="([^"]+)"\s*\/>/);
      return {sourceId:m[1],occurrenceId:decodeURIComponent(m[2]),
        children:[...m[3].matchAll(/<Child id="([^"]+)" kg="([^"]+)"\s*\/>/g)]
          .map(x=>({childId:x[1],kg:Number(x[2])})),
        output:out?{unit:out[1],scale:Number(out[2]),value:Number(out[3])}:null};
    });
  return {...identity,components};
}
async function openedAndRestored(){
  const source=await input(),session=await open(source),refs=accept(session),store=memoryCas();
  const written=await persistVerifiedWeightReviewCheckpoint(session,{
    store,expectedStoreRevision:null});
  const reopened=await open(copy(source));
  const restored=await restoreVerifiedWeightReviewCheckpoint(reopened,{
    store,expectedStoreRevision:written.storeRevision});
  return {source,session,reopened,refs,store,written,restored};
}
async function extractChecked(reopened,refs,xml){
  return verifyEmittedCiiWeightHandoff(reopened,{
    artifactXml:xml,artifactSha256:await digestUtf8(xml),writerRunId:'independent-writer-xml-specimen',
    reviewedSnapshotRefs:refs,extractPhysicalChildren:independentParse});
}

test('U11 full canonical multi-page fact bridge, dual review, atomic checkpoint reload, SHA run packet, emitted CII oracle',async()=>{
  const {source,reopened,refs,written,restored}=await openedAndRestored();
  assert.equal(source.pages.length,2);
  assert.equal(restored.restoredStages,2);
  assert.equal(restored.restoredSnapshots,2);
  assert.match(written.checkpointSha256,/^[a-f0-9]{64}$/);
  const rowModel=readVerifiedModeAFinalRows(reopened);
  assert.deepEqual(rowModel.rows.map(r=>r.sourceId),['PL01','PL01','PL06']);
  assert.equal(rowModel.verifiedFactCount,9);
  assert.equal(rowModel.physicalCount,3);
  const handoff=await prepareApprovedWeightRunPacket(reopened,{reviewedSnapshotRefs:refs});
  assert.equal(handoff.packet.physicalCount,3);
  assert.deepEqual(handoff.packet.components.map(c=>c.massKg),[22,32,120.73401]);
  assert.deepEqual(handoff.packet.components.map(c=>c.authority),['Rigidmatch2','source','source']);
  assert.equal(handoff.packet.components[0].sourceKg,59);
  assert.equal(handoff.packet.components[0].match1Kg,20);
  assert.equal(handoff.packet.components[0].finalKg,22);
  assert.ok(handoff.packet.components.every(c=>!('children' in c)));
  assert.equal((await assertCurrentApprovedWeightRunPacket(reopened,handoff)).valid,true);
  const output=await extractChecked(reopened,refs,syntheticCii());
  assert.equal(output.verified,true);
  assert.equal(output.physicalCount,3);
  assert.equal(output.childCount,5);
  assert.ok(Math.abs(output.acceptedKg-174.73401)<1e-9);
  assert.ok(Math.abs(output.emittedChildKg-174.73401)<1e-9);
  assert.ok(Math.abs(output.ciiForce-1747.3401)<1e-6);
  assert.deepEqual(output.reviewedSnapshotRefs,refs);
});
test('U11 emission missing an original physical or nonconserving a split fails after actual XML parse',async()=>{
  const {reopened,refs}=await openedAndRestored();
  await assert.rejects(()=>extractChecked(reopened,refs,syntheticCii({omitThird:true})),
    rejected('OUTPUT_PHYSICAL_CENSUS_MISMATCH'));
  await assert.rejects(()=>extractChecked(reopened,refs,syntheticCii({firstKg:11})),
    rejected('MASS_NOT_CONSERVED'));
  await assert.rejects(()=>extractChecked(reopened,refs,syntheticCii({firstOutput:2200})),
    rejected('DOUBLE_CONVERSION'));
});
test('U11 an accepted Final edit after reload makes both the pre-writer packet and emitted oracle stale',async()=>{
  const {reopened,refs}=await openedAndRestored();
  const captured=await prepareApprovedWeightRunPacket(reopened,{reviewedSnapshotRefs:refs});
  const basisId=reopened.basis.basisId;
  const current=reopened.review.getDecisionState({basisId,scopeId:'PL01',stage:'Rigidmatch2'});
  reopened.review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    expectedDecisionRevision:current.decisionRevision,commands:[{
      commandId:'late-final-23',basisId,scopeId:'PL01',occurrenceId:ids[0],
      expectedDecisionRevision:current.decisionRevision,action:'final-override',
      value:23,unit:'kg',reason:'Revised measurement after review restore'}]});
  await assert.rejects(()=>assertCurrentApprovedWeightRunPacket(reopened,captured),
    rejected('MISSING_CURRENT_REVIEW_SNAPSHOT'));
  await assert.rejects(()=>extractChecked(reopened,refs,syntheticCii()),
    rejected('MISSING_CURRENT_REVIEW_SNAPSHOT'));
});
test('U11 changed same-size original XML and same-rowcount master cannot replay a previously frozen source basis',async()=>{
  const source=await input();
  const sameLength=copy(source);
  sameLength.live.sources.PL01=sameLength.live.sources.PL01.replace('Model A="1"','Model A="9"');
  assert.equal(sameLength.live.sources.PL01.length,source.live.sources.PL01.length);
  await assert.rejects(()=>open(sameLength),rejected('CONTENT_DIGEST_MISMATCH'));
  const sameRows=copy(source);
  sameRows.live.masters.weight.rows[0].massKg=16;
  assert.equal(sameRows.live.masters.weight.rows.length,source.live.masters.weight.rows.length);
  await assert.rejects(()=>open(sameRows),rejected('MASTER_CONTENT_DRIFT'));
});
