import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifySourceFamily, classifyMasterFamily, evaluateCandidateEligibility }
  from '../converters/xml-cii2019-core/weight-family-eligibility.js';
import { createXmlCiiFactWeightScorer, isXmlCiiDirectQualifiedCandidate,
  legacyXmlCiiWeightFacts } from '../converters/xml-cii2019-core/weight-facts-xml-cii-adapter.js';
import { createWeightReviewService, WEIGHT_SCHEMA }
  from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import { planExactSourceWeightCommands }
  from '../converters/xml-cii2019-core/weight-facts-bulk-decisions.js';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const sourceId = 'test-source';
function basis() {
  return { schemaVersion: WEIGHT_SCHEMA, domainId: 'xml-cii/2019',
    basisId: hash('family-negative-fixture'), sourceRefs: [
      { sourceId, sha256: hash('source'), mediaType: 'application/xml' }],
    selectionSha256: hash('selection'), stagedSourceSha256: null,
    masters: { weight: { datasetId: 'fixture', revision: 1, sha256: hash('master'),
      mappingSha256: hash('map'), rowCount: 1 } },
    configSha256: hash('config'), overridesSha256: hash('overrides'),
    scope: [{ sourceId, selectionRef: 'all' }] };
}
function facts(b, { nodeName='88-VGT-25202', componentType='RIGID',
  dtxr='GATE VALVE', lengthMm=86 }={}) {
  return legacyXmlCiiWeightFacts([{ key: 'B::-1', branchOccurrenceIndex: 0, nodeOrdinal: 0,
    boreMm: 100, rating: '300', lengthMm, nodeName, componentType, dtxr,
    originalWeight: null }], b, sourceId);
}
const row = (typeDesc, overrides={}) => ({
  boreMm: 100, rating: '300', lengthMm: 86, weight: 13, typeDesc, ...overrides,
});
function score(source, masterRows) {
  const b = basis(), scorer = createXmlCiiFactWeightScorer({weight:{masterRows}});
  const f = facts(b, source);
  return { b, f, proposals: scorer(f, b) };
}
test('P0 Gate VGT and Check VCH may rank flange first, never qualify even with exact geometry', () => {
  for (const [name, dtxr] of [['88-VGT-25202', 'GATE VALVE'],
    ['88-VCH-30001', 'CHECK VALVE']]) {
    const result = score({nodeName:name, dtxr}, [row('Weldneck Flange')]);
    assert.equal(result.proposals.length, 1);
    const proposal = result.proposals[0];
    assert.equal(proposal.ranking, 1);
    assert.equal(proposal.value, 13);
    assert.equal(proposal.qualified, false);
    assert.ok(proposal.eligibilityReasons.includes('FAMILY_MISMATCH'));
    assert.equal(proposal.extensions.familyEligibility.source.family, 'VALVE');
    assert.equal(proposal.extensions.familyEligibility.master.family, 'FLANGE');
    assert.equal(proposal.extensions.candidate.preferred, true);
  }
});
test('P0 positive controls: Gate→Gate, Check→Check and FLAN→Flange still qualify', () => {
  for (const [source, typeDesc] of [
    [{nodeName:'VGT-1',dtxr:'GATE VALVE'},'Gate Valve'],
    [{nodeName:'VCH-1',dtxr:'CHECK VALVE'},'Check Valve'],
    [{nodeName:'',componentType:'FLAN',dtxr:'Weldneck Flange'},'Weldneck Flange']]) {
    const {proposals}=score(source,[row(typeDesc)]);
    assert.equal(proposals[0].qualified,true,typeDesc);
    assert.equal(proposals[0].eligibilityReasons[0],'exact-bore-rating-length');
  }
});
test('P0 blank RIGID name and missing DTXR are UNKNOWN, never auto accepted', () => {
  const p=score({nodeName:'',dtxr:''},[row('Weldneck Flange')]).proposals[0];
  assert.equal(p.qualified,false);
  assert.ok(p.eligibilityReasons.includes('SOURCE_FAMILY_UNKNOWN'));
});
test('P0 RIGID blank name with DTXR-only family remains held without attestation', () => {
  const p=score({nodeName:'',dtxr:'Weldneck Flange'},[row('Weldneck Flange')]).proposals[0];
  assert.equal(p.qualified,false);
  assert.ok(p.eligibilityReasons.includes('SOURCE_FAMILY_UNKNOWN'));
  assert.deepEqual(p.extensions.familyEligibility.source.evidence.map(e=>e.origin),['dtxr']);
});
test('P0 VGT contradicting flange DTXR is held, not silently resolved', () => {
  const p=score({dtxr:'Weldneck Flange'},[row('Gate Valve')]).proposals[0];
  assert.equal(p.qualified,false);
  assert.ok(p.eligibilityReasons.includes('SOURCE_FAMILY_CONFLICT'));
  assert.deepEqual(p.extensions.familyEligibility.source.evidence.map(e=>e.origin),
    ['nodeName','dtxr']);
});
test('P0 typed gate cannot bulk-qualify against generic or check valve master', () => {
  for(const desc of ['Valve','Check Valve']) {
    const p=score({},[row(desc)]).proposals[0];
    assert.equal(p.qualified,false,desc);
    assert.ok(p.eligibilityReasons.includes('VALVE_SUBTYPE_UNVERIFIED'));
  }
});
test('P0 explicitly flanged gate valve describes valve, not standalone flange', () => {
  const result=score({dtxr:'Flanged Gate Valve'},[row('Gate Valve')]);
  assert.equal(result.proposals[0].qualified,true);
});
test('P0 contradictory master type descriptors cannot qualify', () => {
  const master=row('Weldneck Flange',{valveType:'Gate Valve'});
  const p=score({},[master]).proposals[0];
  assert.equal(p.qualified,false);
  assert.ok(p.eligibilityReasons.includes('MASTER_FAMILY_CONFLICT'));
});
test('P0 direct predicate refuses candidate-only qualification; score cannot override veto', () => {
  const candidate={preferred:true,lengthQualified:true,ratingExact:true,
    selectedWeight:13,weightMethod:'master',score:1,typeDesc:'Weldneck Flange'};
  assert.equal(isXmlCiiDirectQualifiedCandidate(candidate),false);
  assert.equal(isXmlCiiDirectQualifiedCandidate(candidate,
    {nodeName:'88-VGT-25202',componentType:'RIGID',dtxr:'GATE VALVE'}),false);
  assert.equal(isXmlCiiDirectQualifiedCandidate({...candidate,typeDesc:'Gate Valve'},
    {nodeName:'88-VGT-25202',componentType:'RIGID',dtxr:'GATE VALVE'}),true);
});
test('P0 geometry and non-direct methods still fail even with correct family', () => {
  const source={componentType:'VALV',nodeName:'VGT-1',dtxr:'Gate Valve'};
  const direct={typeDesc:'Gate Valve',preferred:true,lengthQualified:true,
    ratingExact:true,selectedWeight:13,weightMethod:'master'};
  for(const extra of [{preferred:false},{inferredWeight:true},{flangeWeightFallback:true},
    {selectedWeight:0},{weightMethod:'length-extrapolated'},{ratingExact:false}]) {
    assert.equal(evaluateCandidateEligibility(source,{...direct,...extra}).qualified,false);
  }
});
test('P0 Worker source-wide plan excludes wrong-family qualified candidates without ledger writes', () => {
  const b=basis();
  const service=createWeightReviewService({
    score:createXmlCiiFactWeightScorer({weight:{masterRows:[row('Weldneck Flange')]}})
  });
  service.openBasis(b,{facts:facts(b)});
  const before=service.getDecisionState({basisId:b.basisId,scopeId:sourceId,stage:'RigidMatch1'});
  const plan=planExactSourceWeightCommands(service,{basisId:b.basisId,scopeId:sourceId});
  const after=service.getDecisionState({basisId:b.basisId,scopeId:sourceId,stage:'RigidMatch1'});
  assert.equal(plan.physicalCount,1);
  assert.equal(plan.commands.length,0);
  assert.equal(plan.exclusions.topRankUnqualified,1);
  assert.deepEqual(after,before);
});
test('P0 preserve distinct source/master evidence in source-family contradictions', () => {
  const s=classifySourceFamily({nodeName:'88-VCH-32',dtxr:'Weldneck Flange'});
  const m=classifyMasterFamily({type:'Flg',typeDesc:'Weldneck Flange'});
  assert.equal(s.status,'CONFLICT');
  assert.deepEqual(s.evidence.map(x=>x.origin),['nodeName','dtxr']);
  assert.equal(m.family,'FLANGE');
});

test('P0/P1 canonical seven-field physical facts recover original NodeName without new facts',()=>{
 const b=basis(),ref='test-ref',signature=JSON.stringify(['RIGID',ref,'2','88-VGT-25202']);
 const occurrenceId=JSON.stringify([sourceId,0,0,signature]);
 const base=legacyXmlCiiWeightFacts([{key:'B::-1',branchOccurrenceIndex:0,nodeOrdinal:0,
   boreMm:100,rating:'300',lengthMm:86,nodeName:'88-VGT-25202',
   componentType:'RIGID',componentRefNo:ref,originalWeight:null}],b,sourceId);
 const wanted=new Set(['bore.mm','rating','length.mm','mass.kg','component.type','component.ref']);
 const seven=base.filter(f=>wanted.has(f.fieldId)).map(f=>({
   ...f,occurrenceId,fieldId:f.fieldId,
 }));
 seven.push({...seven[0],fieldId:'source.occurrence',value:true,unit:null,authority:'source'});
 assert.equal(seven.length,7);
 assert.equal(seven.some(f=>f.fieldId==='node.name'),false);
 const scorer=createXmlCiiFactWeightScorer({weight:{masterRows:[
   row('Gate Valve'),row('Weldneck Flange',{weight:50}),
 ]}});
 const proposals=scorer(seven,b);
 assert.equal(proposals[0].qualified,true,
   'verified canonical original VGT must be available to family rule');
 assert.equal(proposals[0].extensions.familyEligibility.source.subtype,'GATE');
 assert.equal(proposals[1].qualified,false);
 assert(proposals[1].eligibilityReasons.includes('FAMILY_MISMATCH'));
 const drift=seven.map(f=>f.fieldId==='component.type'?{...f,value:'FLAN'}:f);
 assert.throws(()=>scorer(drift,b),/SOURCE_FAMILY_SIGNATURE_FACT_DRIFT/);
});
test('P0 historical incompatible Match-1 can be restored without promoting it to qualified or Final',async()=>{
 const b=basis(),f=facts(b),scorer=createXmlCiiFactWeightScorer({
   weight:{masterRows:[row('Weldneck Flange')]},
 });
 const originalCandidate=scorer(f,b)[0];
 assert.equal(originalCandidate.qualified,false);
 const digestReview=async value=>hash(JSON.stringify(value));
 const legacy=createWeightReviewService({
   score:(records,input)=>scorer(records,input).map(p=>({...p,qualified:true})),
   digestReview,
 });
 legacy.openBasis(b,{facts:f});
 const id=f[0].occurrenceId;
 legacy.applyDecisions({basisId:b.basisId,scopeId:sourceId,stage:'RigidMatch1',
   commands:[{commandId:'historical-click',basisId:b.basisId,scopeId:sourceId,
     occurrenceId:id,expectedDecisionRevision:null,action:'accept-proposal',
     proposalId:originalCandidate.proposalId}],
 });
 const historical=await legacy.exportReviewState({basisId:b.basisId});
 const strict=createWeightReviewService({score:scorer,digestReview});
 strict.openBasis(b,{facts:f});
 assert.equal(strict.getProposals({basisId:b.basisId,occurrenceIds:[id]}).items[0].qualified,false);
 await strict.restoreReviewState({basisId:b.basisId,payload:historical});
 const accepted=strict.getDecisionState({basisId:b.basisId,scopeId:sourceId,stage:'RigidMatch1'});
 assert.equal(accepted.decisions[id].value,13);
 assert.equal(accepted.decisions[id].proposalId,originalCandidate.proposalId);
 assert.deepEqual(strict.getDecisionState({basisId:b.basisId,scopeId:sourceId,stage:'Rigidmatch2'}).decisions,{});
});
