import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {installWeightBasisXmlDom}
 from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {canonicalJson} from '../contracts/gc-pw-v1/contract.mjs';
import {physicalOccurrenceId} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {attestXml229OriginalPhysicalEngineInput}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-r2-physical-transfer-manifest.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
installWeightBasisXmlDom(globalThis);

const basisId='a'.repeat(64),sha='b'.repeat(64),sourceId='SYNTHETIC-OWNER';
const signature=canonicalJson(['RIGID','ref-A','2','']);
const occurrenceId=physicalOccurrenceId({
 sourceId,branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:signature,
});
const xml=(weight,extra='')=>`<PipeStressExport><Pipe><Branch>
 <Branchname>/SYNTHETIC/B1</Branchname>
 <Node><NodeNumber>-1</NodeNumber><ComponentType>RIGID</ComponentType>
 <ComponentRefNo>ref-A</ComponentRefNo><Endpoint>2</Endpoint>
 <NodeName></NodeName><Position>112 0 0</Position><Rigid>2</Rigid>
 <Weight>${weight}</Weight></Node>${extra}
 </Branch></Pipe></PipeStressExport>`;
const facts=[{basisId,sourceId,subjectType:'physical-component',
 occurrenceId,fieldId:'mass.kg',authority:'source',value:35}];
const session=()=>({
 basis:{basisId,sourceRefs:[{sourceId}],scope:[{sourceId,selectionRef:'all'}]},
 openedFacts:1,
 review:{
  getFacts:()=>({complete:true,totalCount:1,items:facts,nextCursor:null}),
  getDecisionState:()=>({decisionRevision:null,decisions:{}}),
  applyDecisions:()=>{},freezeSnapshot:()=>{},
 },
});
const inputs=()=>({
 session:session(),sourceId,
 originalXmlText:xml(0),engineInputXmlText:xml(35),
 originalJsonSha256:sha,sourceGenerationId:'SYNTHETIC-GEN',
 independentlyEnumeratedOriginalPhysical:[{
   sourceId,branchOccurrenceIndex:0,nodeOrdinal:0,componentSignature:signature,occurrenceId,
 }],
});
test('exact original physical signature + source mass yields read-only engine-input proof',async()=>{
 const result=await attestXml229OriginalPhysicalEngineInput(inputs());
 assert.equal(result.complete,true);
 assert.equal(result.verifiedEnginePhysicalCount,1);
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].originalOccurrenceId,occurrenceId);
 assert.equal(result.matches[0].engineWeightKg,35);
 assert.equal(result.nativeCiiPhysicalSlotVerified,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 assert.match(result.engineInputSha256,/^[a-f0-9]{64}$/);
 assert.match(result.finalIntentSha256,/^[a-f0-9]{64}$/);
});
test('wrong converted physical mass is a hard source rejection',async()=>{
 await assert.rejects(attestXml229OriginalPhysicalEngineInput({
   ...inputs(),engineInputXmlText:xml(40),
 }),e=>e.code==='FINAL_WEIGHT_NOT_IN_ENGINE_INPUT');
});
test('repeated identical enriched component refuses ambiguous source correspondence',async()=>{
 const double=`<Node><NodeNumber>-1</NodeNumber><ComponentType>RIGID</ComponentType>
   <ComponentRefNo>ref-A</ComponentRefNo><Endpoint>2</Endpoint><NodeName></NodeName>
   <Position>112 0 0</Position><Rigid>2</Rigid><Weight>35</Weight></Node>`;
 await assert.rejects(attestXml229OriginalPhysicalEngineInput({
   ...inputs(),engineInputXmlText:xml(35,double),
 }),e=>e.code==='ENRICHED_COMPONENT_LINEAGE_AMBIGUOUS');
});
test('an extra eligible physical owner not in original XML refuses source completeness',async()=>{
 const extra=`<Node><NodeNumber>-1</NodeNumber><ComponentType>VALV</ComponentType>
   <ComponentRefNo>extra-ref</ComponentRefNo><Endpoint>2</Endpoint><NodeName></NodeName>
   <Position>800 0 0</Position><Weight>50</Weight></Node>`;
 await assert.rejects(attestXml229OriginalPhysicalEngineInput({
   ...inputs(),engineInputXmlText:xml(35,extra),
 }),e=>e.code==='EXTRA_ENRICHED_PHYSICAL_OWNER');
});
test('altered original source identity or incomplete physical census refuses',async()=>{
 const a=inputs();a.independentlyEnumeratedOriginalPhysical[0].nodeOrdinal=7;
 await assert.rejects(attestXml229OriginalPhysicalEngineInput(a),
   e=>e.code==='INVALID_ORIGINAL_PHYSICAL_ID');
 await assert.rejects(attestXml229OriginalPhysicalEngineInput({
   ...inputs(),independentlyEnumeratedOriginalPhysical:[],
 }),e=>e.code==='ORIGINAL_PHYSICAL_CENSUS_REQUIRED');
});
