import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildStandaloneOutputRunReadiness}
  from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {isXml229VerifiedCompletionForInput}
  from '../tabs/xml-cii-2019-standalone/integration/xml229-verified-output-readiness.mjs';

const sha='a'.repeat(64),basis='b'.repeat(64),sourceId='ORIGINAL-SOURCE';
const original={schema:'XML229.OriginalStagedSourceReceipt.v1',
  sha256:sha,generationId:'GEN-1',phase:'INDEX_COMMITTED'};
const sessionReceipt={basisId:basis,sourceId,originalJsonSha256:sha,
  sourceGenerationId:'GEN-1',physicalCount:3};
function input(){
 return {sourceKind:'xml',sourceText:'<Plant><Branch /></Plant>',supportConfigJson:'{}',
  options:{outputMode:'both'},masterContext:{},modeASourceId:sourceId,
  xml229StagedSourceReceipt:{...original},
  previewDiagnosticsAuditReport:{some:'legacy-cache'},
  weightMatchResult:{issueRows:[{id:'legacy'}]},
 };
}
function proof(counts={source:1,match1:0,final:2,unresolved:0}){
 return {schema:'XML229.P4.RunAdvisory.v1',basisId:basis,sourceId,
  originalJsonSha256:sha,sourceGenerationId:'GEN-1',
  engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
  verifiedPhysicalCount:3,verifiedFactCount:21,counts,
  ciiReleaseAuthorized:false};
}
const find=(report,id)=>report.checklistRows.find(row=>row.id===id);
const checked=proofValue=>buildStandaloneOutputRunReadiness(input(),{
 verifiedEngineering:{sessionReceipt,proof:proofValue},
});
function assertSingleReport(report){
 const warnings=report.checklistRows.filter(r=>!r.blocking&&r.status!=='ready').length;
 const blockers=report.checklistRows.filter(r=>r.blocking).length;
 assert.equal(report.summary.warningCount,warnings);
 assert.equal(report.summary.blockingCount,blockers);
 for(const id of ['preview-audit','weight-match']){
  const row=find(report,id);
  if(row.status==='ready')assert(!report.logRows.some(x=>x.source==='readiness'&&
    x.message.startsWith(row.label+': ')),'ready stage must not remain in logs');
 }
 assert.equal(find(report,'xml229-original-json-engineering-authority').status,'held');
 assert.equal(find(report,'xml229-original-json-engineering-authority').blocking,true);
}

test('governed original Preview/Weight cannot borrow legacy cache or local result',()=>{
 const r=buildStandaloneOutputRunReadiness(input());
 assert.equal(find(r,'preview-audit').status,'missing');
 assert.equal(find(r,'weight-match').status,'missing');
 assert.equal(r.raw.xml229VerifiedEngineering,false);
 for(const id of ['support-mapper','resolver-json','manual-restraints'])
  assert.equal(find(r,id).status,'not-run');
 assert.match(find(r,'preview-audit').message,/Build Preview/);
 assertSingleReport(r);
});

test('full source-bound engineering evidence updates one report, not only DOM text',()=>{
 const r=checked(proof());
 assert.equal(r.raw.xml229VerifiedEngineering,true);
 assert.equal(find(r,'preview-audit').status,'ready');
 assert.match(find(r,'preview-audit').message,/21 complete source-bound FactRecords/);
 assert.equal(find(r,'weight-match').status,'ready');
 assert.match(find(r,'weight-match').message,/2 Final/);
 assertSingleReport(r);
 assert(r.summary.blockingCount>=1,'native CII release stays HELD');
 assert(r.diagnostics.some(x=>x.type==='xml229-original-json-engineering-authority'));
});

test('Match-1 only, proposals and unresolved weights are not Final',()=>{
 for(const counts of [
  {source:0,final:0,match1:3,unresolved:0},
  {source:0,final:0,match1:0,unresolved:3},
 ]){
  const r=checked(proof(counts));
  assert.equal(find(r,'preview-audit').status,'ready');
  assert.equal(find(r,'weight-match').status,'pending');
  assert.equal(find(r,'weight-match').severity,'warning');
  assertSingleReport(r);
 }
});

test('refuses cross-source, changed generation, wrong basis, incomplete facts or counts',()=>{
 for(const mutation of [
  x=>{x.proof.basisId='wrong';},
  x=>{x.proof.sourceGenerationId='old';},
  x=>{x.proof.originalJsonSha256='c'.repeat(64);},
  x=>{x.proof.verifiedPhysicalCount=2;},
  x=>{x.proof.verifiedFactCount=20;},
  x=>{x.proof.counts.unresolved=1;},
  x=>{x.proof.ciiReleaseAuthorized=true;},
  x=>{x.sessionReceipt.sourceId='FOREIGN';},
 ]){
  const x={sessionReceipt:{...sessionReceipt},proof:proof({...proof().counts})};
  mutation(x);
  assert.equal(isXml229VerifiedCompletionForInput(input(),x.sessionReceipt,x.proof),false);
  const r=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:x});
  assert.equal(find(r,'preview-audit').status,'missing');
  assert.equal(find(r,'weight-match').status,'missing');
  assertSingleReport(r);
 }
});

test('multiple selected sources cannot borrow another GC-PW proof',()=>{
 const state=input();
 state.sourceBatch={activeSourceId:sourceId,sources:[
  {sourceId,enabled:true,xml229StagedSourceReceipt:{...original}},
  {sourceId:'OTHER',enabled:true,xml229StagedSourceReceipt:{...original}},
 ]};
 const r=buildStandaloneOutputRunReadiness(state,{
  verifiedEngineering:{sessionReceipt,proof:proof()},
 });
 assert.equal(find(r,'preview-audit').status,'missing');
 assert.equal(find(r,'weight-match').status,'missing');
 assertSingleReport(r);
});

test('genuine independent stage output is preserved and ordinary XML behavior unchanged',()=>{
 const state=input();
 state.supportTypeMapperResult={previewRows:[]};
 state.resolverJsonTraceResult={rows:[]};
 state.manualElementSideloadResult={summary:{matchedRows:0}};
 const r=buildStandaloneOutputRunReadiness(state);
 for(const id of ['support-mapper','resolver-json','manual-restraints'])
  assert.equal(find(r,id).status,'ready');
 const ordinary={...state,xml229StagedSourceReceipt:null};
 const legacy=buildStandaloneOutputRunReadiness(ordinary);
 assert.equal(find(legacy,'preview-audit').status,'ready');
 assert.equal(find(legacy,'weight-match').status,'ready');
 assert.equal(legacy.checklistRows.some(x=>x.id==='xml229-original-json-engineering-authority'),false);
});

test('Run result errors and readiness blockers are separate counters (#275 investigation)',()=>{
 const state=input();
 state.result={error:'Independent Run error',logs:['Error: first','Error: second']};
 const r=buildStandaloneOutputRunReadiness(state);
 assert.equal(r.summary.blockingCount,1,'only source-only CII release is blocking');
 assert.equal(r.logRows.filter(x=>x.level==='error').length,3,
  'only actual result/error logs are errors; policy HELD is a warning');
 assert.equal(r.logRows.filter(x=>x.level==='warning'&&x.source==='readiness').length>0,true,
  'governed native HOLD is still blocking but not a runtime error');
 assert.equal(r.diagnostics.find(x=>x.type==='xml229-original-json-engineering-authority').level,'warning');
 // This reproduces a counter-vs-log mismatch; it does not identify the
 // Owner's two private, unprovided error strings.
});

test('actual native CII release follows matching live Final-intent and cannot reuse stale output',()=>{
 const inputState=input();
 const cii='native CII bytes';
 const native={schema:'XML229.GovernedNativeCandidateResult.v1',
   basisId:basis,sourceId,sourceGenerationId:'GEN-1',
   originalJsonSha256:sha,sourceXmlSha256:'e'.repeat(64),
   finalIntentSha256:'c'.repeat(64),physicalCount:3,nativeRigidCount:3,
   actualCiiSha256:'d'.repeat(64),massConsumptionVerified:true,
   strictOneToOneOwnerMatch:true,nativeCiiReleaseAuthorized:true,
   ciiText:cii};
 inputState.result={ok:true,ciiText:cii,
   xml229ActualCiiSha256:native.actualCiiSha256,xml229NativeOutput:native};
 const context={verifiedEngineering:{sessionReceipt,proof:proof(),
   finalIntent:{intentSha256:native.finalIntentSha256},nativeOutput:native}};
 const current=buildStandaloneOutputRunReadiness(inputState,context);
 assert.equal(find(current,'xml229-original-json-engineering-authority').status,'ready');
 assert.equal(find(current,'xml229-original-json-engineering-authority').blocking,false);
 assert.equal(current.summary.blockingCount,0);
 assert.equal(current.raw.xml229NativeOutputVerified,true);
 assert.equal(current.artifactRows.find(x=>x.kind==='cii').available,true);
 const altered=[
  {finalIntent:{intentSha256:'f'.repeat(64)}},
  {nativeOutput:{...native,physicalCount:2}},
  {nativeOutput:{...native,nativeCiiReleaseAuthorized:false}},
 ];
 for(const diff of altered){
  const stale=buildStandaloneOutputRunReadiness(inputState,{
    verifiedEngineering:{...context.verifiedEngineering,...diff}});
  assert.equal(find(stale,'xml229-original-json-engineering-authority').status,'held');
  assert.equal(stale.raw.xml229NativeOutputVerified,false);
  assert.equal(stale.artifactRows.find(x=>x.kind==='cii').available,false);
 }
 inputState.result.xml229ActualCiiSha256='f'.repeat(64);
 const tampered=buildStandaloneOutputRunReadiness(inputState,context);
 assert.equal(tampered.raw.xml229NativeOutputVerified,false);
});

test('root and served production modules have exact byte parity',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/integration/xml229-verified-output-readiness.mjs',
  'tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 ]){
  const a=await readFile(new URL('../'+path,import.meta.url));
  const b=await readFile(new URL('../docs/'+path,import.meta.url));
  assert.deepEqual(a,b,path);
 }
});
