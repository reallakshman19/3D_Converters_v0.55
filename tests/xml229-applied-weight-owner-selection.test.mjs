import test from 'node:test';
import assert from 'node:assert/strict';
import {commitXml229SelectedAppliedWeight}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-applied-weight-owner-selection.mjs';

const basisId='a'.repeat(64),sourceId='SOURCE';
const proposal={proposalId:'source-proposal',value:35,unit:'kg',qualified:false};
const row={sourceId,occurrenceId:'occurrence'};
function session({accepted=null,proposals=[proposal]}={}){
 const calls=[];
 return {calls,receipt:{basisId},
  async readIndividual({occurrenceId,stage}){
   calls.push('read:'+stage);
   return {basisId,sourceId,occurrenceId,stage:'Rigidmatch2',
    proposals,stageDecision:accepted===null?null:{state:'accepted',value:accepted}};
  },
  async review({view,choice}){
   calls.push('review');
   assert.equal(view.occurrenceId,row.occurrenceId);
   assert.equal(choice.action,'final-override');
   assert.equal(choice.unit,'kg');
   assert.ok(choice.reason.includes('Owner-designated Applied Weight'));
   assert.ok(choice.reason.includes('no independent native CII consumption asserted'));
   return {decisionRevision:'f1'};
  },
 };
}
test('a selected unqualified suggestion is recorded as an Owner decision with preserved qualification evidence',async()=>{
 const s=session();
 const r=await commitXml229SelectedAppliedWeight({
  session:s,row,value:35,proposalId:'source-proposal',origin:'click',
 });
 assert.equal(r.accepted,true);
 assert.deepEqual(s.calls,['read:Rigidmatch2','review']);
});
test('manual positive kg needs no stage-button confirmation',async()=>{
 const s=session();
 const r=await commitXml229SelectedAppliedWeight({
  session:s,row,value:36.25,origin:'manual',
 });
 assert.equal(r.accepted,true);
 assert.deepEqual(s.calls,['read:Rigidmatch2','review']);
});
test('prefill is idempotent but never overrides an existing conflicting Final',async()=>{
 const s=session({accepted:35});
 const same=await commitXml229SelectedAppliedWeight({
  session:s,row,value:35,origin:'prefill',
 });
 assert.equal(same.unchanged,true);
 assert.deepEqual(s.calls,['read:Rigidmatch2']);
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session:s,row,value:37,origin:'prefill',
 }),{code:'APPLIED_WEIGHT_EXISTING_DISPOSITION'});
});
test('stale Worker, candidate drift, invalid kg and absent session never write',async()=>{
 const s=session();
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session:s,row,value:0,
 }),{code:'APPLIED_WEIGHT_POSITIVE_KG_REQUIRED'});
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session:s,row,value:35,origin:'prefill',isCurrent:()=>false,
 }),{code:'APPLIED_WEIGHT_SOURCE_STALE'});
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session:s,row,value:55,proposalId:'source-proposal',
 }),{code:'APPLIED_WEIGHT_SOURCE_PROPOSAL_DRIFT'});
 await assert.rejects(commitXml229SelectedAppliedWeight({
  session:{},row,value:35,
 }),{code:'APPLIED_WEIGHT_SOURCE_SESSION_REQUIRED'});
 assert.equal(s.calls.includes('review'),false);
});
