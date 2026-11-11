import test from 'node:test';
import './xml229-native-run-action.test.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildStandaloneOutputRunReadiness}
 from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {buildXml229RunHoldAudit}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-run-hold-audit.mjs';
import {readXml229NativeFinalObservation}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-native-final-observation.mjs';
import {createXml229CrossWorkerFlowTrace}
 from '../contracts/xml229-flow-trace-v1/trace.mjs';
import {beginXml229VerifiedEngineeringBuild,publishXml229VerifiedEngineeringBuild,
  revokeXml229VerifiedEngineeringBasis,inspectXml229EngineeringLease}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-engineering-basis-authority.mjs';

const hash='a'.repeat(64),basis='b'.repeat(64),sourceId='O1';
const input=()=>({
 sourceKind:'xml',sourceText:'<Plant><Branch /></Plant>',
 supportConfigJson:'{}',options:{outputMode:'both'},
 modeASourceId:sourceId,
 xml229StagedSourceReceipt:{
  schema:'XML229.OriginalStagedSourceReceipt.v1',
  phase:'INDEX_COMMITTED',sha256:hash,generationId:'G1',
 },
});
const receipt=()=>({basisId:basis,sourceId,
 originalJsonSha256:hash,sourceGenerationId:'G1',physicalCount:2});
const proof=(c={source:0,match1:0,final:0,unresolved:2})=>({
 schema:'XML229.P4.RunAdvisory.v1',
 basisId:basis,sourceId,originalJsonSha256:hash,
 sourceGenerationId:'G1',verifiedPhysicalCount:2,
 verifiedFactCount:14,counts:c,engineeringFactsVerified:true,
 previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false,
});
const final=(eligible=true,sourceCount=0)=>({
 schema:'XML229.NativeFinalPhysicalIntent.v1',
 basisId:basis,originalJsonSha256:hash,sourceGenerationId:'G1',
 physicalCount:2,verifiedFactCount:14,
 sourceAcceptedCount:sourceCount,acceptedFinalCount:2-sourceCount,match1OnlyCount:0,unresolvedCount:0,
 intentSha256:'c'.repeat(64),eligibleForEngineBinding:eligible,
 nativeCiiReleaseAuthorized:false,
});
function audit({state=input(),sr=null,p=null,intent=null,candidate=null,
 readError=null,sessionState='UNKNOWN',trace=null}={}){
 const report=buildStandaloneOutputRunReadiness(state,{
  verifiedEngineering:p?{sessionReceipt:sr,proof:p}:readError?{readError}:null});
 return {report,diagnostic:buildXml229RunHoldAudit({
  input:state,report,sessionState,sessionReceipt:sr,
  completion:p,finalIntent:intent,candidate,readError,
  flowTrace:trace,
 })};
}
test('omnipresent error is an immutable native policy hold, never proof weights are missing',()=>{
 const a=audit({sr:receipt(),p:proof({source:0,match1:0,final:2,unresolved:0}),
   intent:final(),sessionState:'LIVE'});
 const row=a.report.checklistRows.find(x=>x.id==='xml229-original-json-engineering-authority');
 assert.equal(a.report.summary.blockingCount,1);
 assert.equal(row.blocking,true);
 assert.equal(row.status,'held');
 assert.equal(a.report.checklistRows.find(x=>x.id==='weight-match').status,'ready');
 assert.equal(a.diagnostic.diagnosisCode,'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT');
 assert.equal(a.diagnostic.firstUnverifiedBoundary,'worker-r2-and-native-candidate');
 assert.equal(a.diagnostic.nativeCiiReleaseAuthorized,false);
 assert.equal(a.report.runHoldAudit.diagnosisCode,'FINAL_INTENT_NOT_OBSERVED',
  'The implicit canonical report must NOT assume the Final intent was queried');
});
test('live evidence diagnosis separates missing session, stale source, wrong facts and read errors',()=>{
 const none=audit({sessionState:'MISSING'});
 assert.equal(none.diagnostic.diagnosisCode,'LIVE_WORKER_SESSION_MISSING');
 const mismatch=proof();mismatch.sourceGenerationId='different';
 const stale=audit({sr:receipt(),p:mismatch,sessionState:'LIVE'});
 assert.equal(stale.diagnostic.diagnosisCode,'WORKER_COMPLETION_REJECTED');
 assert.equal(stale.diagnostic.evidence[2].reason,'SOURCE_GENERATION_DRIFT');
 const wrong=proof();wrong.verifiedFactCount=13;
 const incomplete=audit({sr:receipt(),p:wrong,sessionState:'LIVE'});
 assert.equal(incomplete.diagnostic.evidence[2].reason,'WORKER_FACT_CENSUS_DRIFT');
 const error=audit({sr:receipt(),readError:{code:'STALE_INPUT',
   message:'private Owner file contents',stack:'/private/repo'},sessionState:'LIVE'});
 assert.equal(error.diagnostic.diagnosisCode,'WORKER_READ_FAILED');
 assert.equal(error.diagnostic.worker.readFailureCode,'STALE_INPUT');
 assert.doesNotMatch(JSON.stringify(error),/private Owner|private\/repo/);
});
test('unresolved, Match-1 only and source-complete stages are separate',()=>{
 const unresolved=audit({sr:receipt(),p:proof(),sessionState:'LIVE'});
 assert.equal(unresolved.diagnostic.diagnosisCode,'UNRESOLVED_PHYSICAL_MASS');
 assert.equal(unresolved.diagnostic.evidence[3].status,'HELD');
 const m1=audit({sr:receipt(),p:proof({source:0,match1:2,final:0,unresolved:0}),
   sessionState:'LIVE'});
 assert.equal(m1.diagnostic.diagnosisCode,'MATCH1_NOT_FINAL');
 const source=audit({sr:receipt(),p:proof({source:2,match1:0,final:0,unresolved:0}),
   sessionState:'LIVE'});
 assert.equal(source.diagnostic.diagnosisCode,'FINAL_INTENT_NOT_OBSERVED');
 assert.equal(source.diagnostic.evidence[3].status,'VERIFIED');
});
test('successful nonreleasing candidate is diagnosed but release stays permanently HELD',()=>{
 const params={sr:receipt(),p:proof({source:2,match1:0,final:0,unresolved:0}),
  intent:final(true,2),sessionState:'LIVE'};
 const failed=audit({...params,candidate:{status:'FAILED',code:'NATIVE_PYODIDE_SCRIPT_FAILED'}});
 assert.equal(failed.diagnostic.diagnosisCode,'NATIVE_CANDIDATE_FAILED');
 assert.equal(failed.diagnostic.nativeCandidate.failureCode,'NATIVE_PYODIDE_SCRIPT_FAILED');
 const passed=audit({...params,candidate:{status:'SUCCEEDED',nativeRigidObserved:1,
   unresolvedNativeOwners:1}});
 assert.equal(passed.diagnostic.diagnosisCode,'NATIVE_CANDIDATE_NONRELEASING');
 assert.equal(passed.diagnostic.evidence[5].status,'VERIFIED');
 assert.equal(passed.diagnostic.evidence[6].status,'HELD');
 assert.equal(passed.diagnostic.independentlyAccepted,false);
 assert.equal(passed.diagnostic.nativeCiiReleaseAuthorized,false);
 assert.equal(passed.report.summary.blockingCount,1);
});
test('selected source drift and multi-source cannot borrow another current Worker proof',()=>{
 const state=input();
 state.sourceBatch={activeSourceId:sourceId,sources:[
  {sourceId,enabled:true,xml229StagedSourceReceipt:{...state.xml229StagedSourceReceipt}},
  {sourceId:'other',enabled:true,xml229StagedSourceReceipt:{...state.xml229StagedSourceReceipt}},
 ]};
 const a=audit({state,sr:receipt(),p:proof(),sessionState:'LIVE'});
 assert.equal(a.diagnostic.diagnosisCode,'MULTISOURCE_RELEASE_UNSUPPORTED');
 assert.equal(a.diagnostic.evidence[0].status,'STALE');
});
test('chronology includes bounded causal steps and losses, no private payload',()=>{
 const t=createXml229CrossWorkerFlowTrace({id:'FLOW-DIAG'});
 t.record({kind:'RUN_AUDIT_REQUESTED',actor:'output-ui'});
 t.record({kind:'OUTPUT_READ_VERIFIED',actor:'output-ui',
  counts:{physical:2,facts:14,sourceMass:2,unresolved:0}});
 t.record({kind:'RUN_GATE_DIAGNOSED',actor:'native-gate',
  code:'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT'});
 const source=input();source.sourceText='<PRIVATE-OWNER-PROPRIETARY/>';
 const obj=audit({state:source,sr:receipt(),
  p:proof({source:2,match1:0,final:0,unresolved:0}),
  sessionState:'LIVE',trace:t.snapshot()}).diagnostic;
 assert.equal(obj.chronology.available,true);
 assert.equal(obj.chronology.events.length,3);
 assert.equal(obj.chronology.events.at(-1).code,'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT');
 const encoded=JSON.stringify(obj);
 for(const privateValue of ['PRIVATE-OWNER-PROPRIETARY',hash,basis,'originalOccurrenceId',
   'sourceText','masterRows','engineInputXmlText','ciiText']){
   assert(!encoded.includes(privateValue),'Audit leaked '+privateValue);
 }
 assert.equal(obj.nativeCiiReleaseAuthorized,false);
});
test('audit refuses reordered event chronology and missing counted events',()=>{
 const trace=createXml229CrossWorkerFlowTrace({id:'ORDER-CHALLENGE'});
 trace.record({kind:'RUN_AUDIT_REQUESTED',actor:'output-ui'});
 trace.record({kind:'RUN_AUDIT_COMPLETED',actor:'output-ui'});
 trace.record({kind:'RUN_GATE_DIAGNOSED',actor:'native-gate',
   code:'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT'});
 const good=trace.snapshot();
 const reordered={...good,events:[good.events[1],good.events[0],good.events[2]]};
 const order=audit({trace:reordered}).diagnostic;
 assert.equal(order.chronology.integrity.status,'BROKEN_FLOW');
 assert(order.chronology.integrity.issues.includes('NON_MONOTONIC_EVENT_ORDER'));
 const missing={...good,events:[good.events[0],good.events[2]]};
 const gaps=audit({trace:missing}).diagnostic;
 assert.equal(gaps.chronology.integrity.status,'INVALID');
 assert(gaps.chronology.integrity.issues.includes('TRACE_WINDOW_COUNT_MISMATCH'));
 assert.equal(gaps.nativeCiiReleaseAuthorized,false);
});
test('engineering-basis lease audit tells never-built, building, published, replaced and revoked apart',()=>{
 const stateRef={current:input()};
 assert.equal(inspectXml229EngineeringLease(stateRef).reason,'NEVER_BUILT');
 const first=beginXml229VerifiedEngineeringBuild(stateRef);
 assert.equal(inspectXml229EngineeringLease(stateRef).reason,'BUILD_STARTED');
 const worker1={closed:false,cancel(){this.closed=true;}};
 assert.equal(publishXml229VerifiedEngineeringBuild(first,{lease:'private-lease-1',session:worker1}),true);
 assert.equal(inspectXml229EngineeringLease(stateRef).reason,'WORKER_PUBLISHED');
 const second=beginXml229VerifiedEngineeringBuild(stateRef);
 assert.equal(inspectXml229EngineeringLease(stateRef).reason,'WORKER_REPLACED');
 const held=buildXml229RunHoldAudit({input:stateRef.current,
  report:buildStandaloneOutputRunReadiness(stateRef.current),
  sessionState:'MISSING',leaseDiagnosis:inspectXml229EngineeringLease(stateRef)});
 assert.equal(held.evidence[1].reason,'WORKER_REPLACED');
 assert.equal(held.worker.leasePresent,false);
 assert.equal(JSON.stringify(held).includes('private-lease-1'),false);
 const worker2={closed:false,cancel(){this.closed=true;}};
 assert.equal(publishXml229VerifiedEngineeringBuild(second,{lease:'private-lease-2',session:worker2}),true);
 assert.equal(revokeXml229VerifiedEngineeringBasis(stateRef,{expectedSession:worker2}),true);
 assert.equal(inspectXml229EngineeringLease(stateRef).reason,'WORKER_REVOKED');
 assert.equal(inspectXml229EngineeringLease(stateRef).nativeCiiReleaseAuthorized,false);
});
test('standalone XML-only route remains unaffected by extra diagnostics',()=>{
 const state=input();delete state.xml229StagedSourceReceipt;
 const a=audit({state});
 assert.equal(a.diagnostic.gateStatus,'NOT_APPLICABLE');
 assert.equal(a.report.runHoldAudit.gateStatus,'NOT_APPLICABLE');
 assert.equal(a.report.checklistRows.some(r=>r.id==='xml229-original-json-engineering-authority'),false);
});
test('source and served docs audit/Run/registry contract mirrors are byte identical',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/integration/xml229-run-hold-audit.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-engineering-basis-authority.mjs',
  'tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
  'contracts/xml229-flow-trace-v1/trace.mjs',
 ]){
  const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const docs=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(root,docs,path);
 }
});

test('canonical readiness observes qualified live Final intent without clearing governed native HOLD',()=>{
 const x=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:{
  sessionReceipt:receipt(),
  proof:proof({source:0,match1:0,final:2,unresolved:0}),
  finalIntent:final(),
 }});
 assert.equal(x.runHoldAudit.diagnosisCode,'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT');
 assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='native-final-intent').status,'VERIFIED');
 assert.equal(x.summary.blockingCount,1);
 assert.equal(x.raw.xml229NativeOutputVerified,false);
});
test('canonical report shows the actual failed native attempt without losing accepted Weight evidence',()=>{
 const x=buildStandaloneOutputRunReadiness(input(),{candidate:{status:'FAILED',
  code:'NATIVE_FINAL_MASS_REQUIRED'},verifiedEngineering:{sessionReceipt:receipt(),
   proof:proof({source:0,match1:0,final:2,unresolved:0}),finalIntent:final()}});
 assert.equal(x.runHoldAudit.diagnosisCode,'NATIVE_CANDIDATE_FAILED');
 assert.equal(x.runHoldAudit.nativeCandidate.failureCode,'NATIVE_FINAL_MASS_REQUIRED');
 assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='weight-final-readiness').status,'VERIFIED');
 assert.equal(x.runHoldAudit.nativeCiiReleaseAuthorized,false);
});
test('Final-intent RPC failure does not erase verified Weight census or invent missing weights',()=>{
 const x=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:{
  sessionReceipt:receipt(),
  proof:proof({source:0,match1:0,final:2,unresolved:0}),
  finalIntentReadError:{code:'FINAL_INTENT_CHANGED_DURING_HASH',
    message:'private owner path',stack:'/private/owner.xml'},
 }});
 assert.equal(x.runHoldAudit.diagnosisCode,'FINAL_INTENT_READ_FAILED');
 assert.equal(x.runHoldAudit.firstUnverifiedBoundary,'native-final-intent');
 assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='weight-final-readiness').status,'VERIFIED');
 assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='native-final-intent').status,'FAILED');
 assert.equal(x.runHoldAudit.worker.finalIntentReadFailureCode,'FINAL_INTENT_CHANGED_DURING_HASH');
 assert.doesNotMatch(JSON.stringify(x.runHoldAudit),/private owner|private\/owner/);
 assert.equal(x.summary.blockingCount,1);
});
test('incorrect basis, source generation, population, schema and forged eligibility fail closed',()=>{
 const complete=proof({source:0,match1:0,final:2,unresolved:0});
 const cases=[
  [{...final(),sourceGenerationId:'G-STALE'},'FINAL_INTENT_SOURCE_OR_BASIS_DRIFT'],
  [{...final(),basisId:'d'.repeat(64)},'FINAL_INTENT_SOURCE_OR_BASIS_DRIFT'],
  [{...final(),physicalCount:3},'FINAL_INTENT_POPULATION_DRIFT'],
  [{...final(),acceptedFinalCount:1},'FINAL_INTENT_POPULATION_DRIFT'],
  [{...final(),schema:'UNKNOWN'},'FINAL_INTENT_INVALID'],
  [{...final(),eligibleForEngineBinding:false},'FINAL_INTENT_POPULATION_DRIFT'],
 ];
 for(const [intent,diagnosis] of cases){
  const result=audit({sr:receipt(),p:complete,intent,sessionState:'LIVE'});
  assert.equal(result.diagnostic.diagnosisCode,diagnosis);
  assert.notEqual(result.diagnostic.evidence.find(e=>e.name==='native-final-intent').status,'VERIFIED');
  assert.equal(result.diagnostic.nativeCiiReleaseAuthorized,false);
 }
});
test('ordinary Output Run source contains current-Worker Final read and no release bypass',async()=>{
 const ui=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(ui,/readXml229NativeFinalObservation\(session/);
 assert.match(ui,/finalIntentReadError,nativeOutput/);
 assert.match(ui,/auditStatus.textContent='Current diagnosis: '/);
 const action=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-action.mjs',import.meta.url),'utf8');
 assert.match(ui,/executeXml229NativeRun/);
 assert.match(action,/verified\?\.nativeCiiReleaseAuthorized!==true/);
 const helper=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-native-final-observation.mjs',import.meta.url),'utf8');
 const mirrored=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/integration/xml229-native-final-observation.mjs',import.meta.url),'utf8');
 assert.equal(helper,mirrored);
});

test('CI: current Worker Final intent is observed after complete Source/Final mass census',async()=>{
 let intentReads=0;
 const observed=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof({source:0,match1:0,final:2,unresolved:0}),
  readNativeFinalIntent:async()=>{intentReads++;return final();},
 });
 assert.equal(observed.stale,false);
 assert.equal(intentReads,1);
 const x=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:{
  sessionReceipt:receipt(),proof:observed.completion,finalIntent:observed.finalIntent,
 }});
 assert.equal(x.runHoldAudit.diagnosisCode,'INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT');
 assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='native-final-intent').status,'VERIFIED');
 assert.equal(x.summary.blockingCount,1);
});
test('CI: Final RPC failures never erase valid Weight and redact unrecognized codes',async()=>{
 for(const [code,expected] of [
  ['FINAL_INTENT_CHANGED_DURING_HASH','FINAL_INTENT_CHANGED_DURING_HASH'],
  ['OWNER_PRIVATE_SOURCE_PATH','FINAL_INTENT_READ_FAILED'],
 ]){
  const observed=await readXml229NativeFinalObservation({
   readCompletion:async()=>proof({source:0,match1:0,final:2,unresolved:0}),
   readNativeFinalIntent:async()=>{throw Object.assign(new Error('/private-owner.xml'),
    {code});},
  });
  const x=buildStandaloneOutputRunReadiness(input(),{verifiedEngineering:{
   sessionReceipt:receipt(),proof:observed.completion,
   finalIntentReadError:observed.finalIntentReadError,
  }});
  assert.equal(x.runHoldAudit.diagnosisCode,'FINAL_INTENT_READ_FAILED');
  assert.equal(x.runHoldAudit.worker.finalIntentReadFailureCode,expected);
  assert.equal(x.runHoldAudit.evidence.find(e=>e.name==='weight-final-readiness').status,'VERIFIED');
  assert.equal(x.summary.blockingCount,1);
  assert.doesNotMatch(JSON.stringify(x.runHoldAudit),/private-owner|OWNER_PRIVATE/);
 }
});
test('CI: source replacement, missing intent reader, and unresolved Match-1 remain fail closed',async()=>{
 let live=true;
 const stale=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof({source:2,match1:0,final:0,unresolved:0}),
  readNativeFinalIntent:async()=>{live=false;return final(true,2);},
 },()=>live);
 assert.equal(stale.stale,true);
 assert.equal(stale.finalIntent,null);
 const missing=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof({source:2,match1:0,final:0,unresolved:0}),
 });
 assert.equal(missing.finalIntentReadError.code,'FINAL_INTENT_READ_UNAVAILABLE');
 let calls=0;
 const unresolved=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof({source:0,match1:2,final:0,unresolved:0}),
  readNativeFinalIntent:async()=>{calls++;return final();},
 });
 assert.equal(calls,0);
 assert.equal(unresolved.finalIntent,null);
});

