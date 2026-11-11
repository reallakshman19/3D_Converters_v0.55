import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { digestUtf8 } from '../contracts/gc-pw-v1/contract.mjs';
import { createWeightReviewService, WEIGHT_SCHEMA } from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import { verifyEmittedCiiWeightHandoff } from '../converters/xml-cii2019-core/weight-facts-emitted-cii-handoff.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const hash=text=>createHash('sha256').update(String(text)).digest('hex');
const reject=code=>e=>{assert.equal(e.code,code);return true;};
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(){
  const sourceIds=['PL01','PL06'],basisId=hash('GC-PW U8 physical source emitted CII');
  const basis={schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId,
    sourceRefs:sourceIds.map(sourceId=>({sourceId,sha256:hash('source/'+sourceId),mediaType:'application/xml'})),
    scope:sourceIds.map(sourceId=>({sourceId,selectionRef:'all'})),
    selectionSha256:hash('select'),stagedSourceSha256:null,masters:{},
    configSha256:hash('config'),overridesSha256:hash('overrides')};
  const occurrenceIds=sourceIds.map(sourceId=>JSON.stringify([sourceId,0,0,'VALV_-1_original_node']));
  const masses=[59,120.73401];
  const facts=sourceIds.map((sourceId,i)=>({schemaVersion:WEIGHT_SCHEMA,basisId,domainId:basis.domainId,
    subjectType:'physical-component',sourceId,occurrenceId:occurrenceIds[i],fieldId:'mass.kg',
    authority:'source',value:masses[i],unit:'kg',provenance:[{sourceRef:sourceId,locator:'original-order-0'}],
    diagnostics:[]}));
  const review=createWeightReviewService({score:()=>[]});review.openBasis(basis,{facts});
  const match=review.applyDecisions({basisId,scopeId:'PL01',stage:'RigidMatch1',
    commands:[{commandId:'explicit-m20',basisId,scopeId:'PL01',occurrenceId:occurrenceIds[0],
      expectedDecisionRevision:null,action:'enter-manual',value:20,unit:'kg',reason:'Measured Match-1 mass'}]});
  const frozenM=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'RigidMatch1',
    expectedDecisionRevision:match[0].decisionRevision});
  const final=review.applyDecisions({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    commands:[{commandId:'explicit-f22',basisId,scopeId:'PL01',occurrenceId:occurrenceIds[0],
      expectedDecisionRevision:null,action:'final-override',value:22,unit:'kg',
      reason:'Engineer accepted Final Split mass 22 kg'}]});
  const frozenF=review.freezeSnapshot({basisId,scopeId:'PL01',stage:'Rigidmatch2',
    expectedDecisionRevision:final[0].decisionRevision});
  const session={basis,review,openedFacts:2};
  return {session,basis,ids:occurrenceIds,refs:[frozenM.snapshotRef,frozenF.snapshotRef]};
}
function generatedXml(ids,{firstChildKg=10,secondChildKg=12,firstScale=10,
  firstValue=220,secondValue=1207.3401,includeSecond=true,extra='',alias=false}={}){
  const first=Buffer.from(alias?'PL01/branch:0/physical:0':ids[0],'utf8').toString('base64url');
  const second=Buffer.from(ids[1],'utf8').toString('base64url');
  return `<CII><Physical source="PL01" occurrence="${first}"><Child id="A" kg="${firstChildKg}"/><Child id="B" kg="${secondChildKg}"/><Output unit="cii-force" scale="${firstScale}" value="${firstValue}"/></Physical>`+
    (includeSecond?`<Physical source="PL06" occurrence="${second}"><Child id="C" kg="120.73401"/><Output unit="cii-force" scale="10" value="${secondValue}"/></Physical>`:'')+extra+'</CII>';
}
// Held-out synthetic independent test adapter: only reads emitted bytes. The real
// #999/#1019 oracle must extract from the actual produced CII writer artifact.
async function extractPhysicalChildren(xml,{basisId,artifactSha256,writerRunId}){
  const components=[...xml.matchAll(/<Physical source="([^"]+)" occurrence="([^"]+)">([\s\S]*?)<\/Physical>/g)]
    .map((match)=>{
      const [,sourceId,token,body]=match;
      const children=[...body.matchAll(/<Child id="([^"]+)" kg="([^"]+)"\s*\/>/g)]
        .map(c=>({childId:c[1],kg:Number(c[2])}));
      const output=body.match(/<Output unit="([^"]+)" scale="([^"]+)" value="([^"]+)"\s*\/>/);
      return {sourceId,occurrenceId:Buffer.from(token,'base64url').toString('utf8'),
        children,output:output?{unit:output[1],scale:Number(output[2]),value:Number(output[3])}:null};
    });
  return {basisId,artifactSha256,writerRunId,components};
}
async function run(input={},opts={}){
  const f=fixture(),artifactXml=generatedXml(f.ids,opts);
  return {f,artifactXml,options:{artifactXml,artifactSha256:await digestUtf8(artifactXml),
    writerRunId:'writer-run-actual-output',reviewedSnapshotRefs:f.refs,
    extractPhysicalChildren,...input}};
}

test('U8 emitted CII evidence requires the actual artifact digest, original physical children, separate frozen reviews and one x10 output conversion',async()=>{
  const {f,options}=await run();
  let readCount=0;
  const outcome=await verifyEmittedCiiWeightHandoff(f.session,{...options,
    extractPhysicalChildren:async(...args)=>{readCount++;return extractPhysicalChildren(...args);}});
  assert.equal(readCount,1);
  assert.equal(outcome.verified,true);
  assert.equal(outcome.physicalCount,2);
  assert.equal(outcome.childCount,3);
  assert.equal(outcome.acceptedKg,142.73401);
  assert.ok(Math.abs(outcome.emittedChildKg-142.73401)<1e-9);
  assert.ok(Math.abs(outcome.ciiForce-1427.3401)<1e-7);
  assert.equal(outcome.artifactSha256,options.artifactSha256);
  assert.deepEqual(outcome.reviewedSnapshotRefs,f.refs);
  assert.equal(f.session.review.getDecisionState({basisId:f.basis.basisId,scopeId:'PL01',stage:'RigidMatch1'}).decisions[f.ids[0]].value,20);
  assert.equal(f.session.review.getDecisionState({basisId:f.basis.basisId,scopeId:'PL01',stage:'Rigidmatch2'}).decisions[f.ids[0]].value,22);
});

test('U8 rejects forged artifact digest, absent XML, absent independent extractor and false output basis',async()=>{
  const {f,options}=await run();
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,artifactXml:options.artifactXml+'<!-- changed -->'}),reject('EMITTED_ARTIFACT_DIGEST_MISMATCH'));
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,artifactXml:''}),reject('EMITTED_ARTIFACT_REQUIRED'));
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,extractPhysicalChildren:null}),reject('EMITTED_ARTIFACT_REQUIRED'));
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,
    extractPhysicalChildren:async(xml,contract)=>({...await extractPhysicalChildren(xml,contract),basisId:hash('wrong')})}),reject('OUTPUT_ARTIFACT_CUSTODY_MISMATCH'));
});

test('U8 missing/duplicated/out-of-scope/stale review snapshots are blocked before output verification',async()=>{
  const {f,options}=await run();
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,reviewedSnapshotRefs:[f.refs[0]]}),reject('MISSING_CURRENT_REVIEW_SNAPSHOT'));
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,reviewedSnapshotRefs:[...f.refs,...f.refs.slice(0,1)]}),reject('DUPLICATE_REVIEW_SNAPSHOT'));
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,reviewedSnapshotRefs:[...f.refs,'forged']}),reject('UNEXPECTED_REVIEW_SNAPSHOT'));
});

test('U8 held-out emitted XML oracle rejects source omissions, duplicate source, noncanonical row aliases and double conversion',async()=>{
  for(const [opts,code] of [
    [{includeSecond:false},'OUTPUT_PHYSICAL_CENSUS_MISMATCH'],
    [{alias:true},'NONCANONICAL_OUTPUT_OCCURRENCE'],
    [{firstScale:100,firstValue:2200},'INVALID_EMITTED_MASS_EVIDENCE'],
    [{firstValue:2200},'DOUBLE_CONVERSION'],
    [{firstChildKg:11},'MASS_NOT_CONSERVED'],
  ]){
    const {f,options}=await run({},opts);
    await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,options),reject(code));
  }
  const fx=fixture();const xml=generatedXml(fx.ids);
  const duplicate=xml.replace('</CII>',xml.match(/<Physical source="PL01"[\s\S]*?<\/Physical>/)[0]+'</CII>');
  const duplicateSha256 = await digestUtf8(duplicate);
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(fx.session,{
    artifactXml:duplicate,artifactSha256:duplicateSha256,
    writerRunId:'writer-run-actual-output',reviewedSnapshotRefs:fx.refs,
    extractPhysicalChildren}),reject('OUTPUT_PHYSICAL_CENSUS_MISMATCH'));
});

test('U8 concurrent stage changes during independent emitted CII parsing are fenced',async()=>{
  const {f,options}=await run();
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,
    extractPhysicalChildren:async(xml,contract)=>{
      const current=f.session.review.getDecisionState({basisId:f.basis.basisId,scopeId:'PL01',stage:'Rigidmatch2'});
      f.session.review.applyDecisions({basisId:f.basis.basisId,scopeId:'PL01',stage:'Rigidmatch2',
        expectedDecisionRevision:current.decisionRevision,commands:[{
          commandId:'later-final23',basisId:f.basis.basisId,scopeId:'PL01',occurrenceId:f.ids[0],
          expectedDecisionRevision:current.decisionRevision,action:'final-override',
          value:23,unit:'kg',reason:'Late engineering correction',
        }]});
      return extractPhysicalChildren(xml,contract);
    }}),reject('STALE_EMITTED_REVIEW'));
});

test('U8 run boundary never creates generated children from Weight ledger facts',async()=>{
  const {f,options}=await run();
  await assert.rejects(()=>verifyEmittedCiiWeightHandoff(f.session,{...options,
    extractPhysicalChildren:async(xml,contract)=>({...await extractPhysicalChildren(xml,contract),
      components:[]})}),reject('OUTPUT_PHYSICAL_CENSUS_MISMATCH'));
  assert.equal(f.session.openedFacts,2);
  assert.equal(f.session.review.getDecisionState({basisId:f.basis.basisId,scopeId:'PL06',stage:'Rigidmatch2'}).decisionRevision,null);
});
