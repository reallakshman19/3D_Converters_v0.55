import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {psi116TopoFixBranchNodes,psi116TopoFixNodeSha256}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-topofix-node-semantic-digest.mjs';
import {
 attestXml229TopoFixFreshSource,startXml229TopoFixFreshWeightSession,
 getXml229TopoFixFreshWorkerProvenance,canXml229AutoCommitSuggestedFinal,
} from '../tabs/xml-cii-2019-standalone/integration/xml229-topofix-fresh-worker-handoff.mjs';
installWeightBasisXmlDom(globalThis);
const ORIGINAL='<PipeStressExport><Pipe><Branch><Branchname>/A</Branchname>'+
 '<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>'+
 '<Position>0 0 0</Position></Node>'+
 '<Node><NodeNumber>20</NodeNumber><ComponentType>RIGID</ComponentType>'+
 '<Endpoint>2</Endpoint><Rigid>2</Rigid><ComponentRefNo>R1</ComponentRefNo>'+
 '<Position>1 0 0</Position></Node></Branch></Pipe></PipeStressExport>';
const FIXED=ORIGINAL.replace('<NodeNumber>10</NodeNumber>','<NodeNumber>20</NodeNumber>');
const hash='a'.repeat(64),master='b'.repeat(64);
async function evidence(){
 const source=await digestUtf8(ORIGINAL),fixed=await digestUtf8(FIXED);
 const originalNodes=psi116TopoFixBranchNodes(ORIGINAL)[0];
 const fixedNodes=psi116TopoFixBranchNodes(FIXED)[0];
 const semantic=await Promise.all([...originalNodes,...fixedNodes].map(psi116TopoFixNodeSha256));
 const lineageReceipt={
  schema:'psi116-topofix-source-lineage/v1',
  sourceXmlSha256:source,fixedXmlSha256:fixed,
  transactionSha256:hash,reviewedActionIds:['ACT-123'],
  sourceXmlMutated:false,state:'PRE_FINAL_ONLY',
  acceptedFinalTransferred:false,nativeCiiReleaseAuthorized:false,
  requiresFreshWorkerBasis:true,
  counts:{sourceNodeOccurrences:2,fixedNodeOccurrences:2,
    retainedNodeOccurrences:2,removedPlainPipeOccurrences:0,
    changedRetainedOccurrences:1},
  sourceOccurrenceMap:[
   {branchOccurrenceIndex:0,sourceNodeOrdinal:0,sourceNodeKey:'B0:N10:S0',
    sourceNodeSha256:semantic[0],status:'RENUMBERED_CONNECTION',
    fixedNodeOrdinal:0,fixedNodeSha256:semantic[2],operationId:'OP-000001'},
   {branchOccurrenceIndex:0,sourceNodeOrdinal:1,sourceNodeKey:'B0:N20:S1',
    sourceNodeSha256:semantic[1],status:'RETAINED',
    fixedNodeOrdinal:1,fixedNodeSha256:semantic[3],operationId:null},
  ],
 };
 const handoffReceipt={
  schema:'psi116-topofix-prefinal-handoff/v1',
  originalSourceXmlSha256:source,newSourceXmlSha256:fixed,
  transactionSha256:hash,sourceNodeOccurrenceCount:2,
  fixedNodeOccurrenceCount:2,reviewedActionIds:['ACT-123'],
  requiresFreshWorkerBasis:true,acceptedFinalTransferred:false,
  nativeCiiReleaseAuthorized:false,
 };
 return {lineageReceipt,handoffReceipt};
}
async function harness(){
 const proof=await evidence();
 const input={xmlText:FIXED,sourceId:'SOURCE',selection:[{sourceId:'SOURCE',selectionRef:'all'}],
  inputLease:master,isCurrent:()=>true,
  originalStagedSourceReceipt:{
   schema:'XML229.OriginalStagedSourceReceipt.v1',
   phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',
   engineeringReady:false,generationId:'NEW-O1',sha256:hash},
 };
 let calls=0,oldSession={receipt:{basisId:hash,sourceGenerationId:'OLD-O1'}};
 const session={receipt:{
   basisId:master,sourceId:'SOURCE',originalJsonSha256:hash,
   sourceGenerationId:'NEW-O1',weightEngineeringAccepted:false,
   finalEngineeringAccepted:false,
  },closed:false,cancel(){this.closed=true;}};
 const args={stateRef:{current:{sourceText:FIXED}},originalXmlText:ORIGINAL,...proof,
  previousSession:oldSession,resolveInputs:async()=>input,
  openSession:async({resolveInputs})=>{calls++;assert.equal((await resolveInputs()).xmlText,FIXED);return session;},
  explicitUserAction:true,isCurrent:()=>true};
 return {args,input,session,oldSession,calls:()=>calls};
}
test('L3 attests the original and fixed PSI116 occurrence coverage',async()=>{
 const p=await evidence();
 const result=await attestXml229TopoFixFreshSource({originalXmlText:ORIGINAL,fixedXmlText:FIXED,...p});
 assert.equal(result.sourceNodeCount,2);
 assert.equal(result.fixedNodeCount,2);
 assert.equal(result.acceptedFinalTransferred,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});
test('L3 starts the existing GC-PW opener against a new O1 generation and basis',async()=>{
 const h=await harness();
 const result=await startXml229TopoFixFreshWeightSession(h.args);
 assert.equal(h.calls(),1);
 assert.equal(result.session,h.session);
 assert.equal(result.basisId,master);
 assert.equal(result.priorFinalDecisionsTransferred,false);
 assert.equal(result.reviewBackupRestored,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 const custody=getXml229TopoFixFreshWorkerProvenance(h.session);
 assert.equal(custody.basisId,master);
 assert.equal(custody.newSourceXmlSha256,await digestUtf8(FIXED));
 assert.equal(custody.originalSourceXmlSha256,await digestUtf8(ORIGINAL));
 assert.equal(custody.acceptedFinalTransferred,false);
 h.session.cancel();
 assert.equal(getXml229TopoFixFreshWorkerProvenance(h.session),null);
});
test('L3 refuses stale source, reused generation, carried Final and forged source map',async()=>{
 const h=await harness();
 const rejects=async(args,code)=>assert.rejects(
  startXml229TopoFixFreshWeightSession(args),{code});
 await rejects({...h.args,explicitUserAction:false},'TOPOFIX_HANDOFF_EXPLICIT_CURRENT_START_REQUIRED');
 await rejects({...h.args,isCurrent:()=>false},'TOPOFIX_HANDOFF_EXPLICIT_CURRENT_START_REQUIRED');
 await rejects({...h.args,stateRef:{current:{sourceText:ORIGINAL}}},
  'TOPOFIX_HANDOFF_SOURCE_SHA_DRIFT');
 await rejects({...h.args,previousSession:{receipt:{basisId:hash,sourceGenerationId:'NEW-O1'}}},
  'TOPOFIX_HANDOFF_OLD_GENERATION_REUSE');
 await rejects({...h.args,stateRef:{current:{sourceText:FIXED,xml229XmlOnlyApproval:{approved:true}}}},
  'TOPOFIX_HANDOFF_PRIOR_FINAL_MIGRATION_REFUSED');
 const fake=structuredClone(h.args.lineageReceipt);
 fake.sourceOccurrenceMap[0].fixedNodeOrdinal=1;
 await rejects({...h.args,lineageReceipt:fake},'TOPOFIX_HANDOFF_FIXED_NODE_SHA_DRIFT');
 const forged=structuredClone(h.args.lineageReceipt);
 forged.sourceOccurrenceMap[1].sourceNodeSha256=hash;
 await rejects({...h.args,lineageReceipt:forged},'TOPOFIX_HANDOFF_SOURCE_NODE_SHA_DRIFT');
 assert.equal(h.calls(),0,'No Worker may open after a failed source handoff');
});
test('L3 destroys an opened candidate Worker if its receipt is stale',async()=>{
 const h=await harness();
 const bad=structuredClone(h.session.receipt);bad.finalEngineeringAccepted=true;
 const session={receipt:bad,closed:false,cancel(){this.closed=true;}};
 await assert.rejects(startXml229TopoFixFreshWeightSession({
  ...h.args,openSession:async()=>session,
 }),{code:'TOPOFIX_HANDOFF_WORKER_NOT_FRESH'});
 assert.equal(session.closed,true);
});

// Worker provenance, unlike a panel-local marker, survives DOM reattachment.
test('Topofix manual Final policy survives panel recreation and receipt drift',async()=>{
 const h=await harness();
 const ordinary={receipt:{basisId:master},closed:false};
 assert.equal(canXml229AutoCommitSuggestedFinal(ordinary),true);
 assert.equal(canXml229AutoCommitSuggestedFinal(ordinary,{suppressAutoCommit:true}),false);
 await startXml229TopoFixFreshWeightSession(h.args);
 const reinstallPanel=()=>()=>canXml229AutoCommitSuggestedFinal(h.session);
 const first=reinstallPanel(),reattached=reinstallPanel();
 assert.equal(first(),false);
 assert.equal(reattached(),false,'re-installed panel must remain manual-only');
 h.session.receipt={...h.session.receipt,basisId:hash};
 assert.equal(getXml229TopoFixFreshWorkerProvenance(h.session),null);
 assert.equal(reattached(),false,'receipt drift must not reauthorize suggested Final');
 h.session.cancel();
 assert.equal(reattached(),false);
 const panel=readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.match(panel,/canXml229AutoCommitSuggestedFinal\(session,\{suppressAutoCommit\}\)/);
 assert.doesNotMatch(panel,/topoFixFreshManualReviewSession/);
});

const changedFixed=()=>FIXED.replace('<Position>1 0 0</Position>','<Position>2 0 0</Position>');
test('L3 rejects in-place source mutation while source SHA attestation awaits',async()=>{
 const h=await harness();let opened=0;
 h.args.openSession=async()=>{opened++;return h.session;};
 const pending=startXml229TopoFixFreshWeightSession(h.args);
 h.args.stateRef.current.sourceText=changedFixed();
 h.input.xmlText=h.args.stateRef.current.sourceText;
 await assert.rejects(pending,{code:'TOPOFIX_HANDOFF_STALE_SOURCE'});
 assert.equal(opened,0);
});
test('L3 rejects source replacement during input hydration before opening a Worker',async()=>{
 const h=await harness();let opened=0;
 h.args.openSession=async()=>{opened++;return h.session;};
 h.args.resolveInputs=async()=>{
  h.args.stateRef.current.sourceText=changedFixed();
  h.input.xmlText=h.args.stateRef.current.sourceText;return h.input;
 };
 await assert.rejects(startXml229TopoFixFreshWeightSession(h.args),
  {code:'TOPOFIX_HANDOFF_FRESH_O1_AND_FULL_SCOPE_REQUIRED'});
 assert.equal(opened,0);
});
test('L3 cancels a candidate if source changes during Worker startup',async()=>{
 const h=await harness();
 h.args.openSession=async({resolveInputs})=>{
  await resolveInputs();h.args.stateRef.current.sourceText=changedFixed();
  return h.session;
 };
 await assert.rejects(startXml229TopoFixFreshWeightSession(h.args),
  {code:'TOPOFIX_HANDOFF_WORKER_NOT_FRESH'});
 assert.equal(h.session.closed,true);
 assert.equal(getXml229TopoFixFreshWorkerProvenance(h.session),null);
});
test('L3 rechecks source at the deferred Worker input callback',async()=>{
 const h=await harness();
 h.args.openSession=async({resolveInputs})=>{
  h.args.stateRef.current.sourceText=changedFixed();
  await resolveInputs();return h.session;
 };
 await assert.rejects(startXml229TopoFixFreshWeightSession(h.args),
  {code:'TOPOFIX_HANDOFF_STALE_SOURCE'});
 assert.equal(getXml229TopoFixFreshWorkerProvenance(h.session),null);
});
test('L3 permits replacement state objects with unchanged source bytes',async()=>{
 const h=await harness();
 h.args.resolveInputs=async()=>{
  h.args.stateRef.current={...h.args.stateRef.current,unrelatedUiState:'new'};
  return h.input;
 };
 const result=await startXml229TopoFixFreshWeightSession(h.args);
 assert.equal(result.session,h.session);
 assert.equal(canXml229AutoCommitSuggestedFinal(h.session),false);
});
