import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareXml229ExplicitMassReview,commitXml229ExplicitMassReview,
 xml229VisibleSingleReviewSnapshot}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-explicit-mass-review.mjs';

const basisId='b'.repeat(64),sourceId='SOURCE',occurrenceId='physical-1';
const row=()=>({
 sourceId,occurrenceId,componentType:'RIGID',
 sourceKg:null,match1Kg:null,finalKg:null,
 match1View:{stageDecision:null},finalView:{stageDecision:null},
 proposals:[{proposalId:'master-p',ranking:1,value:35,qualified:true,unit:'kg'}],
});
const draft=()=>({value:'35',proposalId:'master-p',reason:'Engineer checked source and supplier',
 autoFilled:false,autoUnqualified:false});
function visible(){
 const controls={'[data-p4-proposal]':{value:'35'},
   '[data-p4-reason]':{value:'Engineer checked source and supplier'}};
 const tr={dataset:{p4Occurrence:occurrenceId,p4PickedProposal:'master-p'},
  querySelector:key=>controls[key]||null};
 return {tr,controls};
}
function worker({onRead=()=>{},responseRevision='decision-1'}={}){
 const calls=[],view={basisId,sourceId,occurrenceId,stage:'RigidMatch1'};
 const session={receipt:{basisId,sourceId},
  async readIndividual(args){calls.push(['read',args]);onRead();return view;},
  async review(args){calls.push(['write',args]);
   return {decisionRevision:responseRevision};}};
 return {session,calls,view};
}
function args(session,r,d,tr,extra={}){
 return {session,row:r,stage:'match1',draft:d,typed:tr.querySelector('[data-p4-proposal]').value,
  reason:tr.querySelector('[data-p4-reason]').value,
  isCurrent:()=>true,readVisible:()=>xml229VisibleSingleReviewSnapshot(tr),...extra};
}
test('preparing a candidate is read-only; the separate confirmation is the sole Worker write',async()=>{
 const r=row(),d=draft(),{tr}=visible(),{session,calls}=worker();
 const prepared=await prepareXml229ExplicitMassReview(args(session,r,d,tr));
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'read');
 assert.equal(prepared.reviewDecisionsAuthorized,false);
 assert.equal(prepared.nativeCiiReleaseAuthorized,false);
 assert.equal(prepared.choice.action,'accept-proposal');
 assert.equal(prepared.choice.proposalId,'master-p');
 const result=await commitXml229ExplicitMassReview({prepared,session,draft:d,
  readVisible:()=>xml229VisibleSingleReviewSnapshot(tr)});
 assert.equal(result.decisionRevision,'decision-1');
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1][1],{view:prepared.view,choice:prepared.choice});
});
test('manual edit while asynchronous CAS view is read rejects before confirmation',async()=>{
 const r=row(),d=draft(),{tr,controls}=visible();
 const {session,calls}=worker({onRead:()=>{
  controls['[data-p4-proposal]'].value='999';
 }});
 await assert.rejects(prepareXml229ExplicitMassReview(args(session,r,d,tr)),
  {code:'WEIGHT_REVIEW_VISIBLE_EDIT_DURING_PREPARE'});
 assert.deepEqual(calls.map(x=>x[0]),['read']);
});
test('direct DOM kg/reason mutation without input event blocks Worker write',async()=>{
 const r=row(),d=draft(),{tr,controls}=visible(),{session,calls}=worker();
 const prepared=await prepareXml229ExplicitMassReview(args(session,r,d,tr));
 controls['[data-p4-reason]'].value='Changed without input event';
 await assert.rejects(commitXml229ExplicitMassReview({prepared,session,draft:d,
  readVisible:()=>xml229VisibleSingleReviewSnapshot(tr)}),{code:'WEIGHT_REVIEW_DRAFT_CHANGED'});
 assert.deepEqual(calls.map(x=>x[0]),['read']);
});
test('stale basis and revised draft never reach Worker writer',async()=>{
 const r=row(),d=draft(),{tr}=visible(),{session,calls}=worker();
 const prepared=await prepareXml229ExplicitMassReview(args(session,r,d,tr));
 await assert.rejects(commitXml229ExplicitMassReview({prepared,session,
  draft:{...d,value:'52'},readVisible:()=>xml229VisibleSingleReviewSnapshot(tr)}),
  {code:'WEIGHT_REVIEW_DRAFT_CHANGED'});
 await assert.rejects(commitXml229ExplicitMassReview({prepared,session,draft:d,
  isCurrent:()=>false,readVisible:()=>xml229VisibleSingleReviewSnapshot(tr)}),
  {code:'WEIGHT_REVIEW_PREPARE_STALE'});
 assert.deepEqual(calls.map(x=>x[0]),['read']);
});
test('zero Skip and blank engineering reason cannot become accepted masses',async()=>{
 const r=row(),{tr,controls}=visible(),{session,calls}=worker();
 controls['[data-p4-proposal]'].value='0';
 await assert.rejects(prepareXml229ExplicitMassReview(args(session,r,
  {...draft(),value:'0',skippedWeight:true},tr)),
 {code:'SKIPPED_OR_ZERO_WEIGHT_REQUIRES_DISPOSITION'});
 controls['[data-p4-proposal]'].value='35';
 controls['[data-p4-reason]'].value='  ';
 await assert.rejects(prepareXml229ExplicitMassReview(args(session,r,draft(),tr)),
 {code:'WEIGHT_REVIEW_REASON_REQUIRED'});
 assert.equal(calls.length,0);
});
test('Final requires independently reviewed source or Match-1 predecessor',async()=>{
 const r=row(),d=draft(),{tr}=visible(),{session,calls}=worker();
 await assert.rejects(prepareXml229ExplicitMassReview(args(session,r,d,tr,{stage:'final'})),
 {code:'FINAL_PRECURSOR_REQUIRED'});
 assert.equal(calls.length,0);
});
test('refactored controller stays within guard; all new served helpers match owned files',async()=>{
 const owned='tabs/xml-cii-2019-standalone/ui-adapted/';
 const names=['xml-cii-adapted-p4-verified-weight-panel.js',
  'xml229-p4-explicit-mass-review.mjs','xml229-p4-panel-shell.mjs',
  'xml229-p4-private-weight-evidence.mjs','xml229-p4-source-wide-suggestion-action.mjs'];
 for(const name of names){
  const [a,b]=await Promise.all([
   readFile(new URL('../'+owned+name,import.meta.url),'utf8'),
   readFile(new URL('../docs/'+owned+name,import.meta.url),'utf8')]);
  assert.equal(a,b,name);
  if(name.endsWith('panel.js'))assert.ok(a.split('\n').length<=620,
   'panel must remain composed from review/shell/evidence/draft modules');
 }
});
