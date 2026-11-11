import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { makeBasisRef, digestCanonical } from '../contracts/gc-pw-v1/contract.mjs';
import { physicalOccurrenceId } from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import { createCanonicalWeightFactSession } from '../converters/xml-cii2019-core/weight-facts-canonical-consumer.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const hash = s => createHash('sha256').update(s).digest('hex');
const copy = v => structuredClone(v);
const sources = {PL01:'<Model A="1"/>',PL06:'<Model B="2"/>'};
const original = [
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:0,nodeNumber:-1},
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:1,nodeNumber:-1},
  {sourceId:'PL06',branchOccurrenceIndex:0,nodeOrdinal:0,nodeNumber:-1},
];
const physical = [
  {sourceId:'PL01',branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:'gate-1'},
  {sourceId:'PL06',branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:'gate-1'},
];
const fields = ['mass.kg','rating','bore.mm'];
async function fixture() {
  const live={
    sources:copy(sources),
    selection:[{sourceId:'PL01',selectionRef:'all'},{sourceId:'PL06',selectionRef:'all'}],
    stagedSource:null,
    masters:{weight:{datasetId:'valves',revision:1,rows:[{weight:15}],mapping:{Weight:'weight'}}},
    config:{ratingMode:'preview'},
    overrides:{},
  };
  const basis=await makeBasisRef({
    domainId:'xml-cii/2019',
    sourceRefs:Object.entries(live.sources).map(([sourceId,text])=>({
      sourceId,sha256:hash(text),mediaType:'application/xml',
    })),
    selectionSha256:await digestCanonical(live.selection),
    stagedSourceSha256:null,
    masters:{weight:{datasetId:'valves',revision:1,rowCount:1,
      sha256:await digestCanonical(live.masters.weight.rows),
      mappingSha256:await digestCanonical(live.masters.weight.mapping)}},
    configSha256:await digestCanonical(live.config),
    overridesSha256:await digestCanonical(live.overrides),
    scope:live.selection,
  });
  const records=physical.flatMap((p,index)=>fields.map(fieldId=>({
    schemaVersion:'gc-pw/1.0',basisId:basis.basisId,domainId:basis.domainId,
    subjectType:'physical-component',sourceId:p.sourceId,
    occurrenceId:physicalOccurrenceId(p),fieldId,
    value:fieldId==='mass.kg' ? (index===0 ? 59 : null) :
      fieldId==='rating' ? '150' : 100,
    unit:fieldId==='mass.kg'?'kg':fieldId==='bore.mm'?'mm':null,
    authority:fieldId==='mass.kg' && index===1?'unresolved':'source',
    provenance:[{sourceRef:p.sourceId,locator:'original-ordinals'}],diagnostics:[],
  })));
  const pages=[
    {schemaVersion:'gc-pw/1.0',basisId:basis.basisId,items:records.slice(0,3),
      totalCount:records.length,nextCursor:'offset:3',complete:true},
    {schemaVersion:'gc-pw/1.0',basisId:basis.basisId,items:records.slice(3),
      totalCount:records.length,nextCursor:null,complete:true},
  ];
  return {basis,live,originalOccurrences:copy(original),
    expectedOriginalCount:original.length,physicalOccurrences:copy(physical),
    requiredFieldIds:fields.slice(),pages};
}
const service=()=>createCanonicalWeightFactSession({score:()=>[]});
const rejectCode=code=>error=>{assert.equal(error.code,code);return true};

test('canonical bridge opens exactly original-selected facts; proposed is not accepted',async()=>{
  const input=await fixture(), review=service();
  assert.equal(review.openBasis,undefined);
  assert.equal(review.openBasisJob,undefined);
  const completed=await review.openCanonicalFacts(input);
  assert.equal(completed.verifiedOriginalCount,3);
  assert.equal(completed.verifiedPhysicalCount,2);
  assert.equal(completed.verifiedFactCount,6);
  assert.equal(review.getFacts({basisId:input.basis.basisId,subjectType:'physical-component'}).totalCount,6);
  const id=physicalOccurrenceId(input.physicalOccurrences[1]);
  assert.equal(review.getDecisionState({basisId:input.basis.basisId,scopeId:'PL06'}).decisionRevision,null);
  const accepted=review.applyDecisions({basisId:input.basis.basisId,scopeId:'PL06',
    commands:[{commandId:'explicit-final-22',basisId:input.basis.basisId,scopeId:'PL06',
      occurrenceId:id,expectedDecisionRevision:null,action:'enter-manual',value:22,unit:'kg'}]});
  assert.equal(accepted[0].state,'accepted');
  assert.equal(review.getDecisionState({basisId:input.basis.basisId,scopeId:'PL01'}).decisionRevision,null);
  assert.equal(review.getDecisionState({basisId:input.basis.basisId,scopeId:'PL06'}).decisions[id].value,22);
});

test('canonical bridge fails before review on same-length changed source and changed master',async()=>{
  const input=await fixture();
  const changed=copy(input);changed.live.sources.PL01='<Model A="9"/>';
  assert.equal(changed.live.sources.PL01.length,input.live.sources.PL01.length);
  await assert.rejects(()=>service().openCanonicalFacts(changed),rejectCode('CONTENT_DIGEST_MISMATCH'));
  const master=copy(input);master.live.masters.weight.rows[0].weight=16; // same row count
  await assert.rejects(()=>service().openCanonicalFacts(master),rejectCode('MASTER_CONTENT_DRIFT'));
});

test('canonical bridge blocks omitted original occurrence, untrusted alias and truncated pages',async()=>{
  const input=await fixture();
  const missing=copy(input);missing.originalOccurrences.pop();
  await assert.rejects(()=>service().openCanonicalFacts(missing),rejectCode('ORIGINAL_POPULATION_MISMATCH'));
  const alias=copy(input);delete alias.physicalOccurrences[0].nodeOrdinal;
  await assert.rejects(()=>service().openCanonicalFacts(alias),rejectCode('INVALID_SOURCE_ORDINAL'));
  const truncated=copy(input);truncated.pages.pop();
  await assert.rejects(()=>service().openCanonicalFacts(truncated),
    error=>{assert.match(error.code,/TRUNCATED|INCOMPLETE|EARLY_TERMINAL/);return true;});
});
