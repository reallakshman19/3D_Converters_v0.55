import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {runPsi116TopologyStage} from '../converters/xml-cii-2019-standalone/topology-integration.js';
import {getXml229TopologyReview,runXml229TopologyReview,selectXml229TopologyActions,
 openXml229TopologyFreshWeight,xml229TopologyDisplayState}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-topology-review-controller.mjs';
import {startXml229TopologyFreshReview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-topology-fresh-review.mjs';
import {canXml229AutoCommitSuggestedFinal}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-topofix-fresh-worker-handoff.mjs';
import {buildStandaloneOutputRunReadiness} from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import {runXml229NativeCiiMassCandidate} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-cii-candidate-run.mjs';
import {xml229NativeRunWaitingMessage} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-waiting-message.mjs';

installWeightBasisXmlDom(globalThis);
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(import.meta.url);
const {HostBackedPyodide}=require('./helpers/host-backed-pyodide.js');
const original=readFileSync(join(root,'Benchmarks/1885Sjson/FirstpassXML'),'utf8');
const base=()=>({current:{sourceKind:'xml',xmlProcessingMode:'single',sourceText:original,
 modeASourceId:'PUBLIC-TEST',sourceFile:{name:'FirstpassXML.xml'},supportConfigJson:'{}',
 options:{outputMode:'both',analyzeTopology:true,generateTopoFix:true,useTopoFixForCii:true,
  topologyActionIds:[]},masterContext:{datasetRefs:{},appliedMappingRevision:{}},
 xml229StagedSourceReceipt:{schema:'XML229.OriginalStagedSourceReceipt.v1',
  phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
  sha256:'a'.repeat(64),generationId:'OLD-O1'},branchSelection:{}}});
async function planned(ref){
 const sourceSha=await digestUtf8(original);
 return runXml229TopologyReview(ref,{engineJob:async job=>({ok:true,
  topologyFixPlanText:JSON.stringify({source:{sha256:sourceSha},actions:[
   {action_id:'ACT-OK',status:'PROPOSED',blockers:[],disposition:'KEEP'},
   {action_id:'ACT-BLOCKED',status:'BLOCKED',blockers:['AMBIGUOUS']},
  ]})})});
}

test('Analyze is callable with zero reviewed IDs while native Run is held',async()=>{
 const ref=base();let calls=0;
 await runXml229TopologyReview(ref,{engineJob:async job=>{
  calls++;assert.equal(job.topologyPreFinalOnly,true);
  assert.equal(job.options.generateTopoFix,false);assert.equal(job.options.useTopoFixForCii,false);
  assert.equal(job.xml229NativeFinalPacket,undefined);assert.equal(job.stagedJsonText,undefined);
  assert.equal(job.sourceText,original);
  return {ok:true,topologyFixPlanText:JSON.stringify({source:{sha256:await digestUtf8(original)},actions:[]})};
 }});
 assert.equal(calls,1);assert.equal(ref.current.running,false);
 assert.deepEqual(getXml229TopologyReview(ref).selected,[]);
 const report=buildStandaloneOutputRunReadiness(ref.current);
 assert(report.checklistRows.some(r=>r.id==='topofix-prefinal-review'&&r.blocking));
 assert.equal(ref.current.result,null);
});
test('Only explicitly reviewed, current, unblocked plan IDs may commit',async()=>{
 const ref=base();await planned(ref);
 assert.throws(()=>selectXml229TopologyActions(ref,['ACT-BLOCKED']),{code:'TOPOFIX_UNREVIEWABLE_ACTION'});
 assert.throws(()=>selectXml229TopologyActions(ref,['UNKNOWN']),{code:'TOPOFIX_UNREVIEWABLE_ACTION'});
 selectXml229TopologyActions(ref,['ACT-OK']);assert.deepEqual(ref.current.options.topologyActionIds,['ACT-OK']);
 ref.current={...ref.current,sourceText:original+'\n'};
 assert.throws(()=>selectXml229TopologyActions(ref,['ACT-OK']),{code:'TOPOFIX_CURRENT_PLAN_REQUIRED'});
});
for(const drift of ['source','master'])test('Reject '+drift+' drift during analysis',async()=>{
 const ref=base();await assert.rejects(runXml229TopologyReview(ref,{engineJob:async()=>{
  ref.current=drift==='source'?{...ref.current,sourceText:original+'\n'}:
   {...ref.current,masterContext:{...ref.current.masterContext,appliedMappingRevision:{weight:2}}};
  return {ok:true,topologyFixPlanText:JSON.stringify({source:{sha256:await digestUtf8(original)},actions:[]})};
 }}),{code:'TOPOFIX_REVIEW_STALE_SOURCE'});
 assert.equal(ref.current.running,false);assert.equal(getXml229TopologyReview(ref),null);
});
test('Reject a plan for a different XML and a returned CII payload',async()=>{
 for(const result of [{ok:true,topologyFixPlanText:'{"source":{"sha256":"bad"}}'},
  {ok:true,ciiText:'UNAUTHORIZED',topologyFixPlanText:'{}'}]){
  const ref=base();await assert.rejects(runXml229TopologyReview(ref,{engineJob:async()=>result}));
  assert.equal(ref.current.result,null);
 }
});
test('Sidecar display cannot replace a verified native CII payload',async()=>{
 const ref=base();await planned(ref);const state={...ref.current,result:{ok:true,ciiText:'ACTUAL',xml229NativeOutput:{status:'VERIFIED'}}};
 const display=xml229TopologyDisplayState(state,ref);
 assert.equal(display.result.ciiText,'ACTUAL');assert.equal(display.result.ok,true);
 assert.equal(display.result.xml229NativeOutput.status,'VERIFIED');assert(display.result.topologyFixPlanText);
});
test('Native candidate refuses pending topology before querying any Final packet',async()=>{
 let reads=0;
 for(const state of [base().current,{...base().current,options:{outputMode:'both'},
  xml229TopoFixFreshReviewPending:{requiresFreshWorkerBasis:true}}]){
  await assert.rejects(runXml229NativeCiiMassCandidate({state,
   session:{readNativeFinalPacket:async()=>{reads++;}},isCurrent:()=>true}),
   {code:'NATIVE_TOPOFIX_PREFINAL_REVIEW_REQUIRED'});
  assert(buildStandaloneOutputRunReadiness(state).checklistRows.some(
   row=>row.id==='topofix-prefinal-review'&&row.blocking));
 }
 assert.equal(reads,0);
});
test('Run message reports an actual blocker instead of promising automatic start',()=>{
 const message=xml229NativeRunWaitingMessage({checklistRows:[{id:'topofix-action-ids',
  label:'Reviewed TopoFix action IDs',message:'0 selected.',blocking:true}]});
 assert.match(message,/Native Run is waiting/);assert.match(message,/0 selected/);
 assert.doesNotMatch(message,/starts automatically/);
});
test('Real Python public TopoFix feeds an attested fresh, manual-only Worker transition',async()=>{
 const ref=base(),folder=mkdtempSync(join(tmpdir(),'xml229-topology-review-'));
 const pyodide=new HostBackedPyodide(folder,root);
 const input=join(folder,'source.xml');writeFileSync(input,original);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async input=>{
  const url=input instanceof URL?input:new URL(String(input));
  if(url.protocol!=='file:')return originalFetch(input);
  return {ok:true,text:async()=>readFileSync(fileURLToPath(url),'utf8')};
 };
 let count=0;
 const engineJob=async job=>{
  assert.equal(job.topologyPreFinalOnly,true);const output=join(folder,'stage-'+(++count));mkdirSync(output);
  return {ok:true,...await runPsi116TopologyStage(pyodide,job,input,output,[])};
 };
 try{
  await runXml229TopologyReview(ref,{engineJob});
  const plan=JSON.parse(getXml229TopologyReview(ref).result.topologyFixPlanText);
  const selected=plan.actions.find(a=>a.disposition==='SAFE_DROP_PIPE_GEOMETRY'&&a.node_numbers.includes(1600));
  assert(selected);selectXml229TopologyActions(ref,[selected.action_id]);
  await runXml229TopologyReview(ref,{commit:true,engineJob});
  const review=getXml229TopologyReview(ref);assert.equal(review.result.topoFixCommitted,true);
  const oldSession={receipt:{basisId:'b'.repeat(64),sourceGenerationId:'OLD-O1'},closed:false};
  let revoked=false,reindexed=false,opened=false;
  const session={receipt:{basisId:'c'.repeat(64),sourceId:'PUBLIC-TEST',
   sourceGenerationId:'NEW-O1',originalJsonSha256:'a'.repeat(64),
   weightEngineeringAccepted:false,finalEngineeringAccepted:false},closed:false,cancel(){this.closed=true;}};
  const ports={getWorker:()=>oldSession,revoke:()=>{revoked=true;oldSession.closed=true;},
   resolveBlob:()=>({isCurrent:()=>true}),makeFile:(text,name)=>({name,text}),
   reindex:async(raw,{isCurrent,expectedReceipt})=>{
    assert(revoked);assert.equal(expectedReceipt.generationId,'OLD-O1');assert(isCurrent());
    raw.current={...raw.current,xml229StagedSourceReceipt:{...expectedReceipt,generationId:'NEW-O1'}};reindexed=true;
   },resolveInputs:async raw=>({xmlText:raw.current.sourceText,sourceId:'PUBLIC-TEST',
    selection:[{sourceId:'PUBLIC-TEST',selectionRef:'all'}],inputLease:'test-new-lease',isCurrent:()=>true,
    originalStagedSourceReceipt:raw.current.xml229StagedSourceReceipt}),
   open:async(raw,{resolveInputs})=>{assert(reindexed);assert.equal((await resolveInputs()).xmlText,review.result.topoFixXmlText);opened=true;return session;}};
  const proof=await openXml229TopologyFreshWeight(ref,{transition:args=>startXml229TopologyFreshReview({...args,ports})});
  assert(opened);assert.equal(proof.session,session);assert.equal(proof.priorFinalDecisionsTransferred,false);
  assert.equal(canXml229AutoCommitSuggestedFinal(session),false);
  assert.equal(ref.current.activePhaseId,'weight-match');assert.equal(ref.current.options.generateTopoFix,false);
  assert.equal(ref.current.sourceText,review.result.topoFixXmlText);assert.equal(ref.current.xml229FinalReviewBackup,null);
  assert.equal(ref.current.result,null);assert.equal(getXml229TopologyReview(ref).freshProof,proof);
 }finally{globalThis.fetch=originalFetch;}
});
