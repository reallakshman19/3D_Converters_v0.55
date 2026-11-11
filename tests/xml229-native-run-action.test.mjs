import test from 'node:test';
import assert from 'node:assert/strict';
import {createXmlCiiModeAStateRef} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-state.js';
import {createXmlCiiBranchScopedStateRef,ensureXmlCiiBranchSelectionState}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-branch-scope-state.js';
import {captureXml229NativeRunContext} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-context.mjs';
import {executeXml229NativeRun} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-action.mjs';
import {getXml229CandidateAttempt,getXml229FlowTrace}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs';
import {inspectXml229NativeRunEligibility}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-eligibility.mjs';
import {xml229CanAutoRunVerifiedFinal,offerXml229AutomaticNativeRun}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-auto-native.mjs';
import {buildOutputArtifactRows} from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';

// Explicit control-flow fake. These bytes do NOT certify native engineering output.
const fakeVerified=()=>({schema:'XML229.GovernedNativeCandidateResult.v1',
 nativeCiiReleaseAuthorized:true,massConsumptionVerified:true,
 strictOneToOneOwnerMatch:true,ciiText:'FAKE CONTROL-FLOW CII',actualCiiSha256:'c'.repeat(64)});
const sha='a'.repeat(64);
function setup(){
 const state={activePhaseId:'run',sourceKind:'xml',xmlProcessingMode:'single',
  sourceText:'<Plant><Branch><Branchname>L/B1</Branchname><Node><NodeNumber>10</NodeNumber></Node></Branch></Plant>',
  sourceFile:null,stagedJsonFile:null,stagedJsonText:'',
  supportConfigJson:'{"material":{"default":106},"weight":{}}',
  masterContext:{config:{},datasetRefs:{},rowCounts:{weight:1}},
  options:{outputMode:'both'},branchSelection:{},result:null,running:false,
  xml229StagedSourceReceipt:{schema:'XML229.OriginalStagedSourceReceipt.v1',
   phase:'INDEX_COMMITTED',sha256:sha,generationId:'G1'}};
 const raw={current:ensureXmlCiiBranchSelectionState(state)};
 const mode=createXmlCiiModeAStateRef(raw);
 const stateRef=createXmlCiiBranchScopedStateRef(mode);
 const session={closed:false,receipt:{originalJsonSha256:sha,
  sourceGenerationId:'G1',sourceId:mode.current.sourceBatch.activeSourceId},
  readNativeFinalPacket:async()=>({})};
 let worker=session;
 const downloads=[],renders=[];
 const ports={stateRef,session,liveWorker:()=>worker,
  updateState:(value,patch)=>({...value,...patch}),
  render:()=>renders.push(true),download:(...args)=>downloads.push(args),
  runCandidate:async()=>fakeVerified()};
 return {raw,mode,stateRef,session,ports,downloads,renders,
  replaceWorker:value=>{worker=value;}};
}
const report=()=>({raw:{xml229VerifiedEngineering:true},checklistRows:[
 {id:'weight-match',status:'ready',blocking:false},
 {id:'xml229-original-json-engineering-authority',status:'held',blocking:true}]});

test('real Single/Mode-A and branch wrappers accept identical input values after replacement',()=>{
 const f=setup(),context=captureXml229NativeRunContext(f.ports);
 assert(context?.isCurrent());
 const old=f.stateRef.current;
 f.raw.current={...f.raw.current,masterContext:structuredClone(old.masterContext),
  options:structuredClone(old.options),branchSelection:structuredClone(old.branchSelection),
  supportConfigJson:'{"weight":{}, "material": {"default":106}}'};
 assert.notEqual(f.stateRef.current.masterContext,old.masterContext,
  'the previous production reference guard would refuse this equivalent update');
 assert(context.isCurrent());
 f.raw.current.options.outputMode='enriched-only';
 assert.equal(context.isCurrent(),false,'real option changes still invalidate');
});
test('the production action records an attempt and publishes only a verified runner result',async()=>{
 const f=setup();
 assert.equal(await executeXml229NativeRun(f.ports),true);
 assert.equal(f.downloads.length,1);
 assert.equal(f.stateRef.current.running,false);
 assert.equal(f.stateRef.current.result.ciiText,'FAKE CONTROL-FLOW CII');
 assert.equal(getXml229CandidateAttempt(f.stateRef,f.session).status,'SUCCEEDED');
 assert.deepEqual(getXml229FlowTrace(f.stateRef).snapshot().events.map(e=>e.kind),
  ['NATIVE_CANDIDATE_REQUESTED','CANDIDATE_STAGE','NATIVE_CANDIDATE_SUCCEEDED']);
});
test('native success exposes enriched XML through the real artifact table',async()=>{
 const f=setup(),xml='<PipeStressExport><Weight>12.5</Weight></PipeStressExport>';
 f.ports.runCandidate=async()=>({...fakeVerified(),enrichedName:'source_enriched.xml',enrichedText:xml});
 assert.equal(await executeXml229NativeRun(f.ports),true);
 const row=buildOutputArtifactRows(f.stateRef.current).find(r=>r.kind==='enriched');
 assert.equal(row.available,true);assert.equal(row.filename,'source_enriched.xml');
 assert.equal(row.bytes,new TextEncoder().encode(xml).length);
 assert.equal(row.downloadAction,'download-enriched');
 assert.equal(f.downloads.length,1,'XML remains an explicit download, CII auto-download unchanged');
});
test('later native failure retains produced XML without CII publication or release',async()=>{
 const f=setup(),xml='<PipeStressExport><Weight>0</Weight></PipeStressExport>';
 f.ports.runCandidate=async()=>{throw {code:'CII_ELEMENTS_FORMAT_INVALID',
  xml229EnrichedArtifact:{enrichedText:xml,enrichedName:'source_enriched.xml',
   ciiText:'MUST NOT LEAK',nativeCiiReleaseAuthorized:true}};};
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(f.stateRef.current.result.enrichedText,xml);
 assert.equal(f.stateRef.current.result.ok,false);
 assert.equal(f.stateRef.current.result.ciiText,undefined);
 assert.equal(f.stateRef.current.result.nativeCiiReleaseAuthorized,undefined);
 const rows=buildOutputArtifactRows(f.stateRef.current);
 assert.equal(rows.find(r=>r.kind==='enriched').available,true);
 assert.equal(rows.find(r=>r.kind==='cii').available,false);
 assert.equal(f.downloads.length,0);
});
test('changed source rejects even a retained XML from a failed native run',async()=>{
 const f=setup();
 f.ports.runCandidate=async()=>{
  f.raw.current={...f.raw.current,sourceText:'different source'};
  throw {code:'CII_ELEMENTS_FORMAT_INVALID',xml229EnrichedArtifact:{
   enrichedName:'old.xml',enrichedText:'<old/>'}};
 };
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(f.stateRef.current.result.enrichedText,undefined);
 assert.equal(f.stateRef.current.result.error,'NATIVE_RUN_SOURCE_CHANGED');
});
test('a typed converter failure remains visible, clears running, and permits an explicit retry',async()=>{
 const f=setup();
 f.ports.runCandidate=async()=>{throw {code:'NATIVE_FINAL_MASS_REQUIRED',
  xml229NativeFailure:{schema:'XML229.NativeConverterFailure.v1',code:'NATIVE_FINAL_MASS_REQUIRED',
   phase:'FINAL_MASS_BINDING',category:'ENGINE_FAILED'}};};
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(f.stateRef.current.running,false);
 assert.equal(f.downloads.length,0);
 assert.equal(f.stateRef.current.result.xml229NativeFailure.phase,'FINAL_MASS_BINDING');
 assert.equal(getXml229CandidateAttempt(f.stateRef,f.session).status,'FAILED');
 assert.equal(getXml229CandidateAttempt(f.stateRef,f.session).code,'NATIVE_FINAL_MASS_REQUIRED');
 f.ports.runCandidate=async()=>fakeVerified();
 assert.equal(await executeXml229NativeRun(f.ports),true);
});
test('source drift during conversion discards output, records failure and clears running',async()=>{
 const f=setup();
 f.ports.runCandidate=async()=>{
  f.raw.current={...f.raw.current,sourceText:f.raw.current.sourceText+'<!--new-->'};
  return fakeVerified();
 };
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(f.downloads.length,0);
 assert.equal(f.stateRef.current.running,false);
 assert.equal(f.stateRef.current.result.error,'NATIVE_RUN_SOURCE_CHANGED');
 assert.equal(getXml229CandidateAttempt(f.stateRef,f.session).status,'FAILED');
});
test('Worker replacement cannot publish the old output or overwrite the new result',async()=>{
 const f=setup(),replacement={closed:false};
 f.ports.runCandidate=async()=>{
  f.replaceWorker(replacement);
  f.raw.current={...f.raw.current,result:{ok:true,enrichedText:'NEW SOURCE RESULT'}};
  return fakeVerified();
 };
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(f.downloads.length,0);
 assert.equal(f.stateRef.current.result.enrichedText,'NEW SOURCE RESULT');
 assert.equal(f.stateRef.current.running,false);
 assert.equal(getXml229CandidateAttempt(f.stateRef,replacement),null);
});
test('initial source refusal is recorded rather than silently consuming the auto-run attempt',async()=>{
 const f=setup();let calls=0;
 f.raw.current.xml229StagedSourceReceipt={...f.raw.current.xml229StagedSourceReceipt,
  generationId:'DIFFERENT'};
 f.ports.runCandidate=async()=>{calls++;return fakeVerified();};
 assert.equal(await executeXml229NativeRun(f.ports),false);
 assert.equal(calls,0);
 assert.equal(getXml229CandidateAttempt(f.stateRef,f.session).status,'FAILED');
 assert.equal(f.stateRef.current.result.error,'NATIVE_RUN_SOURCE_CHANGED');
});
test('unverified bytes and incomplete independent proof never download',async()=>{
 for(const patch of [{nativeCiiReleaseAuthorized:false},{massConsumptionVerified:false},
  {strictOneToOneOwnerMatch:false},{ciiText:''}]){
  const f=setup();f.ports.runCandidate=async()=>({...fakeVerified(),...patch});
  assert.equal(await executeXml229NativeRun(f.ports),false);
  assert.equal(f.downloads.length,0);
  assert.equal(f.stateRef.current.running,false);
 }
});
test('duplicate manual/automatic dispatch has one runner and one publication',async()=>{
 const f=setup();let release,calls=0;
 f.ports.runCandidate=async()=>{calls++;await new Promise(resolve=>{release=resolve;});return fakeVerified();};
 const first=executeXml229NativeRun(f.ports);
 assert.equal(await executeXml229NativeRun(f.ports),false);
 release();assert.equal(await first,true);
 assert.equal(calls,1);assert.equal(f.downloads.length,1);
});
test('original bytes, source generation, masters, scope, files and selection changes fail closed',()=>{
 for(const [index,change] of [s=>{s.sourceText+=' ';},s=>{s.stagedJsonText='changed';},
  s=>{s.xml229StagedSourceReceipt.generationId='new';},
  s=>{s.masterContext.rowCounts.weight++;},s=>{s.branchSelection.selectedBranchNames=[];},
  s=>{s.sourceFile={name:'replacement.xml'};},s=>{s.selectedScopeId='ZONE-B';}].entries()){
  const f=setup(),context=captureXml229NativeRunContext(f.ports);
  assert(context?.isCurrent());change(f.raw.current);assert.equal(context.isCurrent(),false,'mutation '+index);
 }
});
test('a filtered view cannot silently become a full-source native job',()=>{
 const f=setup();
 const view={modeABaseRef:f.mode,get current(){return {...f.mode.current,sourceText:'<subset/>'};}};
 assert.equal(captureXml229NativeRunContext({...f.ports,stateRef:view}),null);
});
test('execution inspection exposes real blockers while release HOLD alone allows conversion',()=>{
 const f=setup();
 const ready=inspectXml229NativeRunEligibility({state:f.stateRef.current,report:report(),session:f.session});
 assert.equal(ready.canExecute,true);assert.equal(ready.ciiDownloadAuthorized,false);
 const held=inspectXml229NativeRunEligibility({state:f.stateRef.current,report:{...report(),
  checklistRows:[...report().checklistRows,{id:'branch-format-authority',blocking:true}]},session:f.session});
 assert.deepEqual(held.blockerIds,['branch-format-authority']);
 assert.equal(held.canExecute,false);
 assert.equal(inspectXml229NativeRunEligibility({state:f.stateRef.current,report:report(),session:{closed:false}})
  .blockerIds.includes('native-final-packet-reader-required'),true);
});
test('enriched/topology-only results do not suppress a first native run; failures and CII still do',()=>{
 const f=setup(),can=result=>xml229CanAutoRunVerifiedFinal({
  state:{...f.stateRef.current,result},report:report(),session:f.session});
 assert.equal(can({ok:true,enrichedText:'XML'}),true);
 assert.equal(can({ok:true,topologyFindingsText:'{}'}),true);
 assert.equal(can({ok:false,error:'FAILED'}),false);
 assert.equal(can({ok:true,ciiText:'CII'}),false);
});
test('automatic scheduling reaches the guarded action once despite an enriched-only result',async()=>{
 const f=setup();f.raw.current.result={ok:true,enrichedText:'XML'};
 let calls=0;
 const button={isConnected:true,disabled:false,dataset:{action:'xml229-native-run'},
  click:()=>{calls++;}};
 const offer=()=>offerXml229AutomaticNativeRun({...f.ports,report:report(),button});
 assert.equal(offer(),true);await Promise.resolve();
 assert.equal(calls,1);assert.equal(offer(),false);
});
