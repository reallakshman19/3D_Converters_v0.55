import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readXml229LivePreviewForCurrentInput}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-live-preview-restoration.mjs';
const sha='a'.repeat(64), basis='b'.repeat(64),sourceId='owner-source-41';
const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',
 sha256:sha,generationId:'GEN-41',phase:'INDEX_COMMITTED'};
const ready={basisId:basis,sourceId,originalJsonSha256:sha,
 sourceGenerationId:'GEN-41',physicalCount:423};
const proof={schema:'XML229.P4.RunAdvisory.v1',basisId:basis,
 sourceId,originalJsonSha256:sha,sourceGenerationId:'GEN-41',
 verifiedPhysicalCount:423,verifiedFactCount:2961,
 counts:{source:0,match1:0,final:0,unresolved:423},
 engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
 ciiReleaseAuthorized:false};
const result={
 branchRows:Array.from({length:41},(_,i)=>({branchName:'original-branch-'+i})),
 nodeRows:[],
 sourceOccurrences:{branchCount:41,branches:Array.from({length:41},(_,i)=>({branchName:'original-branch-'+i})),nodes:[]},
};
const input=()=>({sourceKind:'xml',modeASourceId:sourceId,
 xml229StagedSourceReceipt:{...receipt},
 previewDiagnosticsAuditReport:{fakeCache:'should never be used'},
 weightMatchResult:{fakeCache:'should never be used'}});
const session=(options={})=>({
 receipt:{...ready,...options.receipt},
 async readCompletion(){return {...proof,...options.proof};},
 async readPreviewResult(){return {...result,...options.result};},
});
test('Owner-sized 41/423/2961 Preview is restored from same Worker, without accepting any weights',async()=>{
 const restored=await readXml229LivePreviewForCurrentInput({
  input:input(),session:session()});
 assert.equal(restored.proof.verifiedPhysicalCount,423);
 assert.equal(restored.proof.verifiedFactCount,2961);
 assert.equal(restored.proof.counts.unresolved,423);
 assert.equal(restored.result.branchRows.length,41);
 assert.equal(restored.receipt.basisId,basis);
});
test('stale, cross-source, truncated, or forged original Worker cannot restore Preview display',async()=>{
 const altered=input();altered.xml229StagedSourceReceipt.sha256='c'.repeat(64);
 const trials=[
  {input:altered,session:session()},
  {input:input(),session:session({proof:{originalJsonSha256:'c'.repeat(64)}})},
  {input:input(),session:session({proof:{verifiedFactCount:2960}})},
  {input:input(),session:session({proof:{ciiReleaseAuthorized:true}})},
  {input:input(),session:session({receipt:{basisId:'wrong'}})},
  {input:input(),session:session({result:{sourceOccurrences:{branchCount:40}}})},
  {input:input(),session:session({result:{nodeRows:null}})},
 ];
 for(const trial of trials)await assert.rejects(
  readXml229LivePreviewForCurrentInput({...trial,isCurrent:()=>true}),
  e=>e.code==='UNVERIFIED_PREVIEW_RESTORE');
});
test('navigation or source mutation during asynchronous Worker reads invalidates restore',async()=>{
 let calls=0;
 await assert.rejects(readXml229LivePreviewForCurrentInput({
  input:input(),session:session(),isCurrent:()=>++calls<3,
 }),e=>e.code==='UNVERIFIED_PREVIEW_RESTORE');
 await assert.rejects(readXml229LivePreviewForCurrentInput({
  input:input(),session:null,
 }),e=>e.code==='VERIFIED_PREVIEW_SESSION_REQUIRED');
});
test('tab-4 code binds live verified Preview to actual editable renderer and forbids legacy O1 cache',async()=>{
 const pane=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js',
  import.meta.url),'utf8');
 const renderer=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js',
  import.meta.url),'utf8');
 assert.match(pane,/getXml229CurrentWorkerHeldReview\(stateRef\)/);
 assert.match(pane,/readXml229LivePreviewForCurrentInput/);
 assert.match(pane,/precomputedPreview:result/);
 assert.match(pane,/mcPreviewJsonSource='P4_ENGINEERING_VERIFIED'/);
 assert.match(pane,/skipLegacyCache:governed/);
 assert.match(renderer,/!forceBuild && !options.skipLegacyCache/);
 for(const p of [
  'tabs/xml-cii-2019-standalone/integration/xml229-live-preview-restoration.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js',
 ]){
  assert.equal(await readFile(new URL('../'+p,import.meta.url),'utf8'),
   await readFile(new URL('../docs/'+p,import.meta.url),'utf8'),p+' served mirror');
 }
});
