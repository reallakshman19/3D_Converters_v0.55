/** Explicit dependency tests at the source-transition boundary. Actual L3
 * attestation/Python topology/Worker tests execute separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {startXml229TopologyFreshReview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-topology-fresh-review.mjs';
installWeightBasisXmlDom(globalThis);
const original='<PipeStressExport><Pipe><Branch><Branchname>TEST</Branchname><Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><Position>0 0 0</Position></Node></Branch></Pipe></PipeStressExport>';
const fixed=original.replace('<NodeNumber>10','<NodeNumber>20');
function fixture(){
 const rows=[{TEST:'fixture-master'}],old={receipt:{sourceId:'EXISTING-SOURCE'},closed:false};
 const ref={current:{sourceText:original,sourceKind:'xml',xmlProcessingMode:'single',
  supportConfigJson:JSON.stringify({overrides:{weight:{10:99}},weight:{finalizedMatches:[99]}}),
  masterContext:{lineRows:rows,pipingClassRows:rows,materialMapRows:rows,weightMasterRows:rows,
   appliedMappingRevision:{weight:1},rowCounts:{weight:1}},
  xml229FinalReviewBackup:{previousFinal:99},xml229AcceptedFinalIntent:{old:true},
  xml229XmlOnlyApproval:{old:true},xml229StagedSourceReceipt:{generationId:'OLD-O1'}}};
 const review={originalXmlText:original,result:{topoFixCommitted:true,topoFixXmlText:fixed,
  topoFixLineageText:'{}',topoFixPreFinalHandoffText:'{}'}};
 const calls={revoked:0,reindexed:0,started:0,cancelled:0};
 const session={cancel(){calls.cancelled++;}};
 const ports={attest:async()=>{},getWorker:()=>old,
  revoke:(_ref,{expectedSession})=>{assert.equal(expectedSession,old);old.closed=true;calls.revoked++;},
  resolveBlob:()=>({isCurrent:()=>true}),makeFile:(text,name)=>({text,name}),
  reindex:async(raw,{isCurrent})=>{assert(isCurrent());calls.reindexed++;
   raw.current={...raw.current,xml229StagedSourceReceipt:{generationId:'NEW-O1'}};},
  start:async()=>{calls.started++;return {session};}};
 return {ref,review,ports,calls,session};
}
const start=f=>startXml229TopologyFreshReview({stateRef:f.ref,review:f.review,
 sourceIsCurrent:()=>f.ref.current.sourceText===original,ports:f.ports});
test('Transition retains actual shared master rows, clears old authority and derives existing source identity',async()=>{
 const f=fixture(),masters=f.ref.current.masterContext;
 await start(f);
 assert.equal(f.ref.current.sourceText,fixed);assert.equal(f.ref.current.modeASourceId,'EXISTING-SOURCE');
 for(const key of ['lineRows','pipingClassRows','materialMapRows','weightMasterRows'])
  assert.deepEqual(f.ref.current.masterContext[key],masters[key]);
 assert.equal(f.ref.current.xml229FinalReviewBackup,null);
 assert.equal(f.ref.current.xml229AcceptedFinalIntent,null);assert.equal(f.ref.current.xml229XmlOnlyApproval,null);
 const config=JSON.parse(f.ref.current.supportConfigJson);
 assert.equal(config.overrides,undefined);assert.equal(config.weight.finalizedMatches,undefined);
 assert.deepEqual(f.calls,{revoked:1,reindexed:1,started:1,cancelled:0});
});
test('Drift during attestation does not replace source or revoke the old Worker',async()=>{
 const f=fixture();f.ports.attest=async()=>{f.ref.current={...f.ref.current,sourceText:'CHANGED'};};
 await assert.rejects(start(f),{code:'TOPOFIX_FRESH_SOURCE_STALE'});
 assert.equal(f.ref.current.sourceText,'CHANGED');assert.equal(f.calls.revoked,0);
});
for(const kind of ['source','master','selection'])test('Reject '+kind+' drift while reindexing before Worker creation',async()=>{
 const f=fixture();f.ports.reindex=async raw=>{
  if(kind==='source')raw.current={...raw.current,sourceText:fixed+'\n'};
  if(kind==='master')raw.current={...raw.current,masterContext:{...raw.current.masterContext,
   appliedMappingRevision:{weight:2}}};
  if(kind==='selection')raw.current={...raw.current,branchSelection:{selectedBranchOccurrenceIds:[]}};
 };
 await assert.rejects(start(f),{code:'TOPOFIX_FRESH_SOURCE_STALE'});
 assert.equal(f.calls.started,0);assert.equal(f.calls.revoked,1);
 assert.equal(f.ref.current.xml229FinalReviewBackup,null);
 assert(f.ref.current.xml229TopoFixFreshReviewPending);
 assert.equal(f.ref.current.options.useTopoFixForCii,true,'failed transition must keep native Run held');
});
test('Late source change cancels a returned candidate Worker',async()=>{
 const f=fixture();f.ports.start=async()=>{
  f.ref.current={...f.ref.current,sourceText:fixed+'\n'};return {session:f.session};
 };
 await assert.rejects(start(f),{code:'TOPOFIX_FRESH_SOURCE_STALE'});
 assert.equal(f.calls.cancelled,1);
});
test('Missing committed transaction or existing source identity fails before replacing source',async()=>{
 for(const kind of ['identity','commit']){
  const f=fixture();if(kind==='identity')f.ports.getWorker=()=>null;
  else f.review.result.topoFixCommitted=false;
  await assert.rejects(start(f));assert.equal(f.calls.revoked,0);assert.equal(f.ref.current.sourceText,original);
 }
});
