import assert from 'node:assert/strict';
import test from 'node:test';
import {readVerifiedIndividualWeightReview} from '../converters/xml-cii2019-core/weight-facts-individual-review.js';

const sourceId='public-fixture';
const oid=i=>JSON.stringify([sourceId,0,i,'VALVE']);
function sessionCase(){
 const basisId='b'.repeat(64),ids=Array.from({length:80},(_,i)=>oid(i));
 const facts=ids.flatMap((occurrenceId,i)=>Array.from({length:7},(_,k)=>({
   sourceId,occurrenceId,subjectType:'physical-component',
   fieldId:k===0?'mass.kg':'test.field.'+k,
   authority:k===0&&i===3?'source':'unresolved',
   value:k===0&&i===3?35:null,unit:'kg'
 })));
 let calls=0,revision=null,corrupt=false;
 const review={
   getFacts({basisId:id,sourceId:s,cursor,limit}){
     assert.equal(id,basisId);assert.equal(s,sourceId);calls++;
     const start=cursor===null?0:Number(cursor),end=Math.min(start+limit,facts.length);
     return {complete:true,items:facts.slice(start,end),
       totalCount:corrupt?facts.length+1:facts.length,
       nextCursor:end<facts.length?String(end):null};
   },
   getDecisionState({stage}){
     return {decisionRevision:revision,decisions:stage==='RigidMatch1'&&revision
       ?{[oid(3)]:{state:'accepted',value:41}}:{}};
   },
   getProposals({basisId:id,occurrenceIds}){
     const occurrenceId=occurrenceIds[0];
     return {complete:true,nextCursor:null,totalCount:1,
       items:[{basisId:id,occurrenceId,proposalId:'master:'+occurrenceId,
         ranking:1,value:20,unit:'kg',qualified:true,method:'public-fixture'}]};
   },
   applyDecisions(){throw Error('No review writes expected')},
   freezeSnapshot(){throw Error('No review writes expected')}
 };
 return {session:{basis:{basisId,sourceRefs:[{sourceId}],scope:[{sourceId}]},
   review,openedFacts:facts.length},
   get calls(){return calls},setRevision:v=>{revision=v},corrupt:v=>{corrupt=v}};
}
test('verified source facts are traversed once per session; decisions stay live',()=>{
 const s=sessionCase();
 for(let i=0;i<80;i++){
   const m=readVerifiedIndividualWeightReview(s.session,
     {sourceId,occurrenceId:oid(i),stage:'RigidMatch1'});
   const f=readVerifiedIndividualWeightReview(s.session,
     {sourceId,occurrenceId:oid(i),stage:'Rigidmatch2'});
   assert.equal(m.sourceKg,i===3?35:null);
   assert.equal(f.finalKg,null);
 }
 assert.equal(s.calls,2,'560 facts must use 2 pages, not 160 full traversals');
 s.setRevision('new-revision');
 const current=readVerifiedIndividualWeightReview(s.session,
   {sourceId,occurrenceId:oid(3),stage:'RigidMatch1'});
 assert.equal(current.match1Kg,41);
 assert.equal(current.match1Revision,'new-revision');
 assert.equal(s.calls,2);
 const separate=sessionCase();
 readVerifiedIndividualWeightReview(separate.session,{sourceId,occurrenceId:oid(1)});
 assert.equal(separate.calls,2,'a fresh session cannot share the old fact index');
});
test('incomplete verified source census fails closed and is not cached',()=>{
 const s=sessionCase();s.corrupt(true);
 assert.throws(()=>readVerifiedIndividualWeightReview(s.session,
   {sourceId,occurrenceId:oid(1)}),{code:'INCOMPLETE_SOURCE_FACTS'});
 assert.equal(s.calls,2);
 s.corrupt(false);
 assert.equal(readVerifiedIndividualWeightReview(s.session,
   {sourceId,occurrenceId:oid(1)}).sourceKg,null);
 assert.equal(s.calls,4,'a failed census must be traversed again');
 assert.throws(()=>readVerifiedIndividualWeightReview(s.session,
   {sourceId:'different',occurrenceId:oid(1)}),{code:'SOURCE_SCOPE_CONFLICT'});
});
