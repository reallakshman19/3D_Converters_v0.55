import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captureXml229WeightDraft,disarmXml229EditedDraft,verifyXml229Match1DraftConfirmation,
 verifyXml229VisibleMatch1Drafts,commitXml229TwoClickMatch1}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-two-click-confirmation.mjs';
import {planXml229RigidWeightDrafts}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs';

const basisId='a'.repeat(64),sourceId='OWNER_TEST';
function makePlan(n=51){
 const qualifiedSuggestions=Array.from({length:n},(_,i)=>({
  occurrenceId:'owner-'+i,proposalId:'p-'+i,value:i+12.5,unit:'kg',qualified:true,
 }));
 const planId=JSON.stringify([basisId,sourceId,null,null,1,n]);
 return {planId,basisId,qualified:n,qualifiedSuggestions,reviewStage:'RigidMatch1',
  finalAcceptedAutomatically:false};
}
const drafts=plan=>new Map(plan.qualifiedSuggestions.map(p=>[p.occurrenceId,{
 value:String(p.value),proposalId:p.proposalId,autoFilled:true,autoUnqualified:false,reason:'',
}]));
function dom(plan,saved,index=0){
 const p=plan.qualifiedSuggestions[index];
 const controls={
  '[data-p4-proposal]':{value:saved.get(p.occurrenceId).value,disabled:false},
  '[data-p4-candidate]':{value:p.proposalId,disabled:false},
  '[data-p4-reason]':{value:'',disabled:false},
 };
 const tr={dataset:{p4Row:'0',p4Occurrence:p.occurrenceId},
  querySelector:key=>controls[key]||null};
 const confirm={disabled:false};
 const table={querySelectorAll:selector=>{
  if(selector==='tr[data-p4-row]')return [tr];
  if(selector==='[data-p4-proposal],[data-p4-candidate],[data-p4-reason]')
   return Object.values(controls);
  return [];
 },querySelector:key=>key==='[data-p4-bulk-confirm]'?confirm:null};
 return {table,rows:[{occurrenceId:p.occurrenceId}],controls,confirm};
}
test('P1 first click: exact Worker-qualified 51-page set remains editable and read-only',async()=>{
 const plan=makePlan(),rows=plan.qualifiedSuggestions.map(p=>({
  sourceId,occurrenceId:p.occurrenceId,componentType:'VALV',nodeName:'VGT-100',
  sourceKg:null,match1Kg:null,finalKg:null,
  proposals:[{proposalId:p.proposalId,ranking:1,unit:'kg',value:p.value,
   qualified:true,score:.94}],
  match1View:{match1Revision:null,stageDecision:null,
   proposals:[{proposalId:p.proposalId,ranking:1,unit:'kg',value:p.value,qualified:true}]},
  finalView:{finalRevision:null,stageDecision:null},
 }));
 const calls=[],writes=[],existing=new Map([['owner-0',{
  value:'12.5',proposalId:'p-0',autoFilled:false,reason:'Reviewed earlier',
 }]]);
 const session={receipt:{basisId,sourceId},async readPage({offset,limit}){
  calls.push(offset);
  return {basisId,offset,totalCount:51,complete:true,rows:rows.slice(offset,offset+limit)};
 },commitQualifiedBlankFill(){writes.push('commit')}};
 const prepared=await planXml229RigidWeightDrafts(session,{
  qualifiedSuggestions:plan.qualifiedSuggestions,existingDrafts:existing,minScorePercent:80});
 assert.deepEqual(calls,[0,25,50]);
 assert.equal(prepared.counts.workerQualified,51);
 assert.equal(prepared.counts.workerQualifiedPrepared,50);
 assert.equal(prepared.counts.workerQualifiedAlreadyDrafted,1);
 assert.equal(prepared.firstPreparedIndex,0,
  'the first confirmed candidate must be visible even when its draft already exists');
 assert.equal(prepared.drafts.size,50);
 assert.deepEqual(writes,[]);
 assert.equal(prepared.reviewDecisionsAuthorized,false);
 assert.equal(prepared.finalAcceptedAutomatically,false);
});
test('P1 second click matches every off-page proposed kg and pinned proposal',async()=>{
 const plan=makePlan(),saved=drafts(plan),d=dom(plan,saved);
 let writes=0,lockedWhileInFlight=false;
 const session={receipt:{basisId,sourceId},async commitQualifiedBlankFill({planId}){
  assert.equal(planId,plan.planId);
  writes++;lockedWhileInFlight=Object.values(d.controls).every(x=>x.disabled);
  return {acceptedCount:51,stage:'RigidMatch1',finalAcceptedAutomatically:false};
 }};
 assert.deepEqual(verifyXml229Match1DraftConfirmation(plan,saved,session.receipt),
  {qualifiedDraftsVerified:51,readOnly:true,
   finalAcceptedAutomatically:false,nativeCiiReleaseAuthorized:false});
 assert.equal(verifyXml229VisibleMatch1Drafts(d.table,d.rows,saved,plan),1);
 const result=await commitXml229TwoClickMatch1({
  session,plan,drafts:saved,table:d.table,rows:d.rows});
 assert.equal(result.acceptedCount,51);
 assert.equal(writes,1);
 assert.equal(lockedWhileInFlight,true);
 assert(Object.values(d.controls).every(x=>!x.disabled));
 assert.equal(d.confirm.disabled,true);
});
test('P1 tampered off-page source-weight draft blocks every Worker write',async()=>{
 const plan=makePlan(),saved=drafts(plan),d=dom(plan,saved);
 saved.get('owner-50').value='50000';
 let writes=0;
 const session={receipt:{basisId,sourceId},commitQualifiedBlankFill(){
  writes++;return Promise.resolve({acceptedCount:51});
 }};
 await assert.rejects(commitXml229TwoClickMatch1({
  session,plan,drafts:saved,table:d.table,rows:d.rows,
 }),{code:'MATCH1_TWO_CLICK_DRAFT_DRIFT'});
 assert.equal(writes,0);
});
test('P1 manual selection and missing qualified draft cannot piggyback on bulk',()=>{
 const plan=makePlan(2),saved=drafts(plan);
 saved.get('owner-0').proposalId='';
 assert.throws(()=>verifyXml229Match1DraftConfirmation(plan,saved,{basisId,sourceId}),
  {code:'MATCH1_TWO_CLICK_DRAFT_DRIFT'});
 saved.delete('owner-1');
 assert.throws(()=>verifyXml229Match1DraftConfirmation(plan,saved,{basisId,sourceId}),
  {code:'MATCH1_TWO_CLICK_DRAFT_DRIFT'});
});
test('P1 direct DOM changes without input events cannot authorize stale kg or candidate',()=>{
 const plan=makePlan(1),saved=drafts(plan),d=dom(plan,saved);
 d.controls['[data-p4-proposal]'].value='13';
 assert.throws(()=>verifyXml229VisibleMatch1Drafts(d.table,d.rows,saved,plan),
  {code:'MATCH1_VISIBLE_DRAFT_DRIFT'});
 d.controls['[data-p4-proposal]'].value='12.5';
 d.controls['[data-p4-candidate]'].value='forged-proposal';
 assert.throws(()=>verifyXml229VisibleMatch1Drafts(d.table,d.rows,saved,plan),
  {code:'MATCH1_VISIBLE_DRAFT_DRIFT'});
});
test('P1 stale session or forged planId cannot commit, no duplicated action',async()=>{
 const plan=makePlan(1),saved=drafts(plan),d=dom(plan,saved);
 let writes=0;
 const session={receipt:{basisId,sourceId},commitQualifiedBlankFill(){
  writes++;return Promise.resolve({acceptedCount:1});
 }};
 await assert.rejects(commitXml229TwoClickMatch1({
  session,plan,drafts:saved,table:d.table,rows:d.rows,isCurrent:()=>false,
 }),{code:'MATCH1_TWO_CLICK_SESSION_STALE'});
 assert.throws(()=>verifyXml229Match1DraftConfirmation({
  ...plan,planId:'["forged"]'},saved,session.receipt),
  {code:'MATCH1_TWO_CLICK_PLAN_INVALID'});
 assert.equal(writes,0);
});
test('P1 failed Worker CAS disarms confirmation and restores editable fields',async()=>{
 const plan=makePlan(1),saved=drafts(plan),d=dom(plan,saved);
 const session={receipt:{basisId,sourceId},commitQualifiedBlankFill(){
  return Promise.reject(Object.assign(new Error('review revised'),{code:'STALE_DECISION'}));
 }};
 await assert.rejects(commitXml229TwoClickMatch1({
  session,plan,drafts:saved,table:d.table,rows:d.rows,
 }),{code:'STALE_DECISION'});
 assert.equal(d.confirm.disabled,true);
 assert(Object.values(d.controls).every(x=>!x.disabled));
});
test('P1 captured manual draft is separated from Worker plan and invalidates bulk approval',()=>{
 const plan=makePlan(1),saved=drafts(plan),d=dom(plan,saved);
 const original=plan.qualifiedSuggestions[0];
 d.controls['[data-p4-proposal]'].value='99';
 assert.equal(captureXml229WeightDraft(d.table.querySelectorAll('tr[data-p4-row]')[0],d.rows,saved),
  original.occurrenceId);
 assert.equal(saved.get('owner-0').value,'99');
 assert.equal(saved.get('owner-0').autoFilled,false);
 assert.throws(()=>verifyXml229Match1DraftConfirmation(plan,saved,{basisId,sourceId}),
  {code:'MATCH1_TWO_CLICK_DRAFT_DRIFT'});
});
test('P1 editing an already prepared input disarms second-click confirmation',()=>{
 const plan=makePlan(1),saved=drafts(plan),d=dom(plan,saved);
 const detail={hidden:false,textContent:'Prior qualified plan'};
 d.controls['[data-p4-proposal]'].value='500';
 assert.equal(disarmXml229EditedDraft(
  d.table.querySelectorAll('tr[data-p4-row]')[0],d.rows,saved,plan,d.table,detail),true);
 assert.equal(d.confirm.disabled,true);
 assert.equal(detail.hidden,true);
 assert.equal(detail.textContent,'');
 assert.equal(saved.get('owner-0').value,'500');
});
test('P1 production click path and served mirror use one exact draft-confirmation module',async()=>{
 const panel='tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';
 const helper='tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-two-click-confirmation.mjs';
 const p=await readFile(new URL('../'+panel,import.meta.url),'utf8');
 assert.doesNotMatch(p,/commitXml229TwoClickMatch1\(\{/);
  const action=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-source-wide-suggestion-action.mjs',import.meta.url),'utf8');
  assert.match(action,/planXml229SkipWeightDrafts\(/);
  assert.match(p,/applyXml229BlankWeightDrafts/);
 assert.match(p,/pendingBulk=null/);
 assert.match(p,/disarmXml229EditedDraft\(/);
 const h=await readFile(new URL('../'+helper,import.meta.url),'utf8');
 assert.match(h,/if\(confirm\)confirm\.disabled=true/);
 assert.ok(p.split('\n').length<=620,'oversized panel must be decomposed into review/exports/draft actions');
 // Review engine remains separately tested, but the simplified UI
 // exposes one draft kg input and cannot submit Worker stage decisions.
 assert.doesNotMatch(p,/prepareXml229ExplicitMassReview|commitXml229ExplicitMassReview|data-p4-review-match1|data-p4-review-final/);
 assert.match(p,/seedXml229VisibleSuggestedWeightDrafts/);
 const review=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-explicit-mass-review.mjs',import.meta.url),'utf8');
 assert.match(review,/session\.review\(\{view:prepared\.view,choice:prepared\.choice\}\)/);
 for(const name of [panel,helper]){
  const root=await readFile(new URL('../'+name,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/'+name,import.meta.url),'utf8');
  assert.equal(root,served,name);
 }
});
