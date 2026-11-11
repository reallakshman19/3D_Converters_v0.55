import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWeightReviewService,WEIGHT_SCHEMA}
 from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import {readVerifiedIndividualWeightReview,commitVerifiedIndividualWeightReview}
 from '../converters/xml-cii2019-core/weight-facts-individual-review.js';
import {readVerifiedModeAFinalRows}
 from '../converters/xml-cii2019-core/weight-facts-mode-a-final-read.js';
import {commitXml229NativeFinalIntent}
 from '../converters/xml-cii2019-core/weight-facts-native-consumption-intent.js';
import {validateDecisionCommand} from '../contracts/gc-pw-v1/contract.mjs';
import {renderXml229WeightReviewPage}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';
import {commitXml229SelectedAppliedWeight}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-applied-weight-owner-selection.mjs';
import {eligibleXml229UnassignedZero,visitXml229UnassignedZero,
 applyXml229OwnerConfirmedZero}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-confirmed-zero-source-wide.mjs';
import {createXml229ZeroMassPopup}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-zero-mass-popup.mjs';
import {renderXml229VerifiedPanelShell}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-panel-shell.mjs';

const digest=x=>createHash('sha256').update(String(x)).digest('hex');
const sourceId='SRC',basisId=digest('owner-confirmed-zero');
const occurrenceId=JSON.stringify([sourceId,0,0,'["FLAN","F-1","1","FL-1"]']);
const reason='Owner-confirmed explicit zero kg: deliberately no physical mass for this original component';
const basis={
 schemaVersion:WEIGHT_SCHEMA,basisId,domainId:'xml-cii/2019',
 sourceRefs:[{sourceId,sha256:digest('original XML'),mediaType:'application/xml'}],
 scope:[{sourceId,selectionRef:'full-original'}],
 selectionSha256:digest('selection'),stagedSourceSha256:null,
 masters:{},configSha256:digest('config'),overridesSha256:digest('overrides'),
};
function physicalFact(id=occurrenceId){
 return {schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId,
  sourceId,occurrenceId:id,subjectType:'physical-component',fieldId:'mass.kg',
  value:null,unit:'kg',authority:'unresolved',provenance:[],diagnostics:[]};
}
function gcPw(facts=[physicalFact()]){
 const review=createWeightReviewService({score:()=>[]});
 review.openBasis(basis,{facts});
 return {basis,review,openedFacts:facts.length};
}
test('blank remains unresolved until explicit owner confirmation; 0kg is a distinct reviewed Final',()=>{
 const session=gcPw();
 assert.equal(readVerifiedModeAFinalRows(session).unresolved,1);
 const before=readVerifiedIndividualWeightReview(session,{sourceId,occurrenceId,stage:'Rigidmatch2'});
 assert.equal(before.finalKg,null);
 assert.throws(()=>commitVerifiedIndividualWeightReview(session,before,{
   action:'set-zero-mass',value:0,unit:'kg',reason,
 }),{code:'ZERO_WEIGHT_CONFIRMATION_REQUIRED'});
 assert.throws(()=>commitVerifiedIndividualWeightReview(session,before,{
   action:'final-override',value:0,unit:'kg',reason,
 }),{code:'ENGINEERING_REASON_REQUIRED'});
 const committed=commitVerifiedIndividualWeightReview(session,before,{
   action:'set-zero-mass',value:0,unit:'kg',reason,zeroMassConfirmed:true,
 });
 assert.equal(committed.view.finalKg,0);
 assert.equal(committed.view.stageDecision.action,'set-zero-mass');
 assert.equal(committed.view.effectiveKg,0);
 const final=readVerifiedModeAFinalRows(session);
 assert.equal(final.unresolved,0);
 assert.equal(final.rows[0].status,'Final');
 assert.equal(final.rows[0].effectiveKg,0);
 assert.equal(session.review.verifyRun({
   basisId,reviewedSnapshotIds:[committed.snapshot.snapshotRef],
   outputBasis:{components:[{sourceId,occurrenceId,
     children:[{childId:'massless-rigid',kg:0}],
     output:{unit:'cii-force',scale:10,value:0}}]},
 }).verified,true,'explicit 0 is a mass decision; native CII release remains independent');
 const html=renderXml229WeightReviewPage({totalCount:1,rows:[{
  sourceId,occurrenceId,finalKg:0,match1Kg:null,sourceKg:null,
  proposals:[],componentType:'FLAN',finalView:committed.view,
 }]});
 assert.match(html,/Final 0 kg \(confirmed\)/);
 assert.match(html,/data-p4-applied-weight[^>]*value="0"/s);
});
test('native Final intent accepts only confirmed zero; null stays ineligible',async()=>{
 const session=gcPw();
 const source={sourceGenerationId:'owner-confirmed-zero-generation',
   originalJsonSha256:digest('indexed original staged JSON')};
 const unresolved=await commitXml229NativeFinalIntent(session,source);
 assert.equal(unresolved.eligibleForEngineBinding,false);
 assert.equal(unresolved.unresolvedCount,1);
 assert.equal(unresolved.nativeCiiReleaseAuthorized,false);
 const view=readVerifiedIndividualWeightReview(session,{sourceId,occurrenceId,
   stage:'Rigidmatch2'});
 assert.throws(()=>commitVerifiedIndividualWeightReview(session,view,{
   action:'set-zero-mass',value:0,unit:'kg',reason,
 }),{code:'ZERO_WEIGHT_CONFIRMATION_REQUIRED'});
 const committed=commitVerifiedIndividualWeightReview(session,view,{
   action:'set-zero-mass',value:0,unit:'kg',reason,zeroMassConfirmed:true,
 });
 assert.equal(committed.view.stageDecision.action,'set-zero-mass');
 const confirmed=await commitXml229NativeFinalIntent(session,source);
 assert.equal(confirmed.eligibleForEngineBinding,true);
 assert.equal(confirmed.acceptedFinalCount,1);
 assert.equal(confirmed.unresolvedCount,0);
 assert.equal(confirmed.nativeCiiReleaseAuthorized,false);
 assert.equal(confirmed.physicalEngineConsumptionVerified,false);
 assert.notEqual(confirmed.intentSha256,unresolved.intentSha256);
 assert.equal((await commitXml229NativeFinalIntent(session,source)).intentSha256,
   confirmed.intentSha256,'same current Final CAS revisions must hash identically');
});
test('mixed positive and explicitly confirmed zero reach native intent without release',async()=>{
 const other=JSON.stringify([sourceId,0,1,'["VALV","V-2","1","VL-2"]']);
 const session=gcPw([physicalFact(),physicalFact(other)]);
 for(const [id,kg] of [[occurrenceId,0],[other,27]]){
   const view=readVerifiedIndividualWeightReview(session,{
     sourceId,occurrenceId:id,stage:'Rigidmatch2'});
   const zero=kg===0;
   commitVerifiedIndividualWeightReview(session,view,{
     action:zero?'set-zero-mass':'final-override',
     value:kg,unit:'kg',reason:zero?reason:'Owner designated 27 kg for VALV source physical',
     ...(zero?{zeroMassConfirmed:true}:{}),
   });
 }
 const rows=readVerifiedModeAFinalRows(session);
 assert.equal(rows.unresolved,0);
 assert.deepEqual(rows.rows.map(x=>x.effectiveKg).sort((a,b)=>a-b),[0,27]);
 const intent=await commitXml229NativeFinalIntent(session,{
   sourceGenerationId:'mixed-confirmed-zero-source',
   originalJsonSha256:digest('mixed staged JSON')});
 assert.equal(intent.eligibleForEngineBinding,true);
 assert.equal(intent.physicalCount,2);
 assert.equal(intent.acceptedFinalCount,2);
 assert.equal(intent.nativeCiiReleaseAuthorized,false);
});

test('contract forbids 0kg manual and any unconfirmed zero command',()=>{
 const command={commandId:'c',basisId,scopeId:sourceId,occurrenceId,
  expectedDecisionRevision:null,action:'set-zero-mass',value:0,unit:'kg',reason};
 assert.throws(()=>validateDecisionCommand(command),{code:'ZERO_WEIGHT_CONFIRMATION_REQUIRED'});
 assert.equal(validateDecisionCommand({...command,zeroMassConfirmed:true}).value,0);
 assert.throws(()=>validateDecisionCommand({...command,action:'final-override',zeroMassConfirmed:true}),
  {code:'INVALID_MANUAL_VALUE'});
});
function mockSource(){
 const decisions=new Map();
 const rows=[
  {sourceId,occurrenceId:'unresolved',sourceKg:null,match1Kg:null,finalKg:null,proposals:[]},
  {sourceId,occurrenceId:'old-zero-skip',sourceKg:null,match1Kg:null,finalKg:null,proposals:[]},
  {sourceId,occurrenceId:'source',sourceKg:18,match1Kg:null,finalKg:null,proposals:[]},
  {sourceId,occurrenceId:'manual',sourceKg:null,match1Kg:null,finalKg:null,proposals:[]},
  {sourceId,occurrenceId:'qualified',sourceKg:null,match1Kg:null,finalKg:null,
   proposals:[{proposalId:'p1',qualified:true,value:11,unit:'kg'}]},
  {sourceId,occurrenceId:'accepted',sourceKg:null,match1Kg:null,finalKg:9,proposals:[]},
 ];
 const s={receipt:{basisId,sourceId},decisions,
  async readPage({offset,limit,filter}){
   assert.equal(filter,'all');
   return {basisId,offset,complete:true,totalCount:rows.length,
    rows:rows.slice(offset,offset+limit).map(r=>({
      ...r,finalKg:decisions.has(r.occurrenceId)?0:r.finalKg,
      finalView:{stageDecision:decisions.has(r.occurrenceId)
        ?{state:'accepted',value:0,action:'set-zero-mass'}:null},
    }))};
  },
  async readIndividual({occurrenceId,stage}){
   return {basisId,sourceId,occurrenceId,stage:'Rigidmatch2',
    sourceKg:rows.find(r=>r.occurrenceId===occurrenceId).sourceKg,
    match1Kg:null,finalKg:decisions.has(occurrenceId)?0:null,
    stageDecision:decisions.has(occurrenceId)?{state:'accepted',value:0}:null,
    proposals:[]};
  },
  async review({view,choice}){
   assert.equal(choice.action,'set-zero-mass');
   assert.equal(choice.zeroMassConfirmed,true);
   assert.equal(choice.value,0);
   decisions.set(view.occurrenceId,0);
   return {decisionRevision:'f'+decisions.size};
  },
 };
 return s;
}
test('nonintrusive offer never writes; confirmed source-wide 0 skips positive/qualified/manual and preserves zero-skip custody',async()=>{
 const session=mockSource();
 const drafts=new Map([
  ['old-zero-skip',{value:'0',skippedWeight:true,proposalId:''}],
  ['manual',{value:'25',skippedWeight:false,proposalId:'',autoFilled:false}],
 ]);
 const live=()=>true;
 const census=await visitXml229UnassignedZero({session,drafts,isCurrent:live});
 assert.equal(census.total,6);
 assert.equal(census.eligible,2);
 assert.equal(session.decisions.size,0,'showing a popup never commits a mass');
 assert.equal(eligibleXml229UnassignedZero({
  sourceKg:null,match1Kg:null,finalKg:null,occurrenceId:'A',
  proposals:[{qualified:true,value:12,unit:'kg'}],
 }),false);
 const result=await applyXml229OwnerConfirmedZero({
  session,drafts,isCurrent:live,
 });
 assert.equal(result.accepted,2);
 assert.deepEqual([...session.decisions.keys()],['unresolved','old-zero-skip']);
 assert.equal(drafts.get('manual').value,'25');
 assert.equal(drafts.has('old-zero-skip'),false);
 assert.equal((await visitXml229UnassignedZero({session,drafts,isCurrent:live})).eligible,0);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});
test('small dismissible corner popup is opt-in, one-shot per Worker and never modal',async()=>{
 const html=renderXml229VerifiedPanelShell(true);
 assert.match(html,/data-p4-confirm-zero-notice/);
 assert.match(html,/data-p4-confirm-zero-text/);
 assert.match(html,/data-p4-confirm-zero/);
 assert.match(html,/data-p4-dismiss-zero/);
 assert.match(html,/position:fixed/);
 assert.match(html,/right:16px;bottom:16px/);
 assert.doesNotMatch(html,/role="dialog"|window\\.confirm/);
 const notice={hidden:true},message={textContent:''};
 const root={isConnected:true,querySelector(key){
  if(key==='[data-p4-confirm-zero-notice]')return notice;
  if(key==='[data-p4-confirm-zero-text]')return message;
  return null;
 }};
 const session=mockSource(),drafts=new Map([['manual',{
  value:'25',skippedWeight:false,proposalId:'',autoFilled:false,
 }]]);
 let renders=0;
 const popup=createXml229ZeroMassPopup({
  root,live:()=>session,getDrafts:()=>drafts,
  saveDrafts:()=>{},render:async()=>{renders++;return 0;},say:()=>{},
 });
 await popup.offer(session);
 assert.equal(notice.hidden,false);
 assert.match(message.textContent,/2 unresolved original physical/);
 assert.equal(session.decisions.size,0);
 await popup.handle('dismiss',session);
 assert.equal(notice.hidden,true);
 await popup.offer(session);
 assert.equal(notice.hidden,true,'never nag after dismissal on same Worker');
 assert.equal(session.decisions.size,0);
 // Same modal-free component can perform a separately selected Apply click.
 const second=mockSource(),secondRoot={...root};
 const apply=createXml229ZeroMassPopup({
  root:secondRoot,live:()=>second,getDrafts:()=>drafts,
  saveDrafts:()=>{},render:async()=>{renders++;return 0;},say:()=>{},
 });
 await apply.offer(second);
 assert.equal(notice.hidden,false);
 const decision=await apply.handle('apply',second);
 assert.equal(decision.accepted,2);
 assert.equal(renders,1);
 assert.equal(notice.hidden,true);
 assert.deepEqual([...second.decisions.keys()],['unresolved','old-zero-skip']);
});
test('stale source and checked-positive input do not accept zero',async()=>{
 const session=mockSource(),row={sourceId,occurrenceId:'source',sourceKg:18,
  match1Kg:null,finalKg:null};
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session,row,value:0,origin:'confirmed-zero',
 }),{code:'ZERO_WEIGHT_NOT_BLANK'});
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session,row:{...row,sourceKg:null},value:0,
  origin:'confirmed-zero',isCurrent:()=>false,
 }),{code:'APPLIED_WEIGHT_SOURCE_STALE'});
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session,row:{...row,sourceKg:null},value:0,
  origin:'manual',
 }),{code:'APPLIED_WEIGHT_POSITIVE_KG_REQUIRED'});
 assert.equal(session.decisions.size,0);
});
