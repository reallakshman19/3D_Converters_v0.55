import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {listXml229RunUnresolvedMasses,confirmXml229RunUnresolvedMasses,
 prefillXml229RunMaxSuggestions,xml229MaxSuggestedKg}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-unresolved-mass-popup.mjs';

const basisId='b'.repeat(64),sourceId='EF-05';
function verifiedFixture(){
 const rows=Array.from({length:100},(_,i)=>({
   sourceId,occurrenceId:'original-'+i,
   shortName:'Component '+i,branchName:'Branch 1',componentType:'VALV',
   sourceKg:null,match1Kg:null,finalKg:i<85?i+1:null,
   proposals:i===90?[
     {value:5,unit:'kg',qualified:true},
     {value:12,unit:'kg',qualified:false},
     {value:2,unit:'kg',qualified:true},
     {value:80,unit:'kg',qualified:false},
   ]:[],
 }));
 const decisions=[];
 const session={
   receipt:{basisId,sourceId,physicalCount:100},closed:false,
   readCompletion:async()=>({schema:'XML229.P4.RunAdvisory.v1',
     basisId,verifiedPhysicalCount:100,
     counts:{source:0,match1:0,final:rows.filter(x=>x.finalKg!==null).length,
       unresolved:rows.filter(x=>x.finalKg===null).length}}),
   readPage:async({offset,limit,filter,query})=>{
     assert.equal(filter,'all');assert.equal(query,'');
     return {basisId,offset,totalCount:100,complete:true,
       rows:rows.slice(offset,offset+limit)};
   },
   readIndividual:async({occurrenceId,stage})=>{
     const item=rows.find(x=>x.occurrenceId===occurrenceId);
     assert.equal(stage,'Rigidmatch2');
     return {...item,basisId,stage,stageDecision:item.finalKg===null?null:
       {state:'accepted',value:item.finalKg},proposals:item.proposals};
   },
   review:async({view,choice})=>{
     assert.equal(choice.unit,'kg');
     decisions.push({id:view.occurrenceId,choice});
     rows.find(x=>x.occurrenceId===view.occurrenceId).finalKg=choice.value;
     return {decisionRevision:'rev-'+decisions.length};
   },
 };
 return {session,rows,decisions};
}
test('second popup scans ALL 100 Worker owners, showing only 15 unresolved without writes',async()=>{
 const {session,rows,decisions}=verifiedFixture();
 const snapshot=await listXml229RunUnresolvedMasses({session});
 assert.equal(snapshot.total,100);
 assert.equal(snapshot.startingFinal,85);
 assert.equal(snapshot.pending.length,15);
 assert.deepEqual(snapshot.pending.map(x=>x.occurrenceId),
   Array.from({length:15},(_,i)=>'original-'+(85+i)));
 assert.equal(snapshot.pending.find(x=>x.occurrenceId==='original-90').proposals[0].qualified,true);
 assert.equal(decisions.length,0,'reading defaults must not write any Final decision');
 assert.equal(rows[0].finalKg,1);
});
test('Apply All Source suggestions (Max) only prefills verified kg row inputs',async()=>{
 const {session,rows,decisions}=verifiedFixture();
 const snapshot=await listXml229RunUnresolvedMasses({session});
 const inputs=new Map(snapshot.pending.map(row=>[row.occurrenceId,{value:'0'}]));
 assert.equal(xml229MaxSuggestedKg(snapshot.pending.find(x=>x.occurrenceId==='original-90')),80);
 assert.equal(xml229MaxSuggestedKg({proposals:[
  {value:91,unit:'lb'},{value:-1,unit:'kg'},{value:NaN,unit:'kg'}]}),null);
 const result=prefillXml229RunMaxSuggestions(snapshot.pending,inputs);
 assert.deepEqual(result,{filled:1,unmatched:14});
 assert.equal(inputs.get('original-90').value,'80');
 assert.equal(inputs.get('original-91').value,'0','no source suggestion stays unchanged');
 assert.equal(decisions.length,0,'prefill must never apply Final mass');
 assert.equal(rows[0].finalKg,1,'85 existing Final values remain untouched');
 assert.equal(rows[90].finalKg,null,'no owner acceptance on prefill');
});

test('one explicit confirmation records 0 or positive only for 15; preserves 85 existing Final',async()=>{
 const {session,rows,decisions}=verifiedFixture();
 const snapshot=await listXml229RunUnresolvedMasses({session});
 const values=new Map(snapshot.pending.map(x=>[x.occurrenceId,'0']));
 values.set('original-90','12.5');
 const result=await confirmXml229RunUnresolvedMasses({session,snapshot,values});
 assert.deepEqual({accepted:result.accepted,zero:result.confirmedZero,
   positive:result.positive,release:result.nativeCiiReleaseAuthorized},
   {accepted:15,zero:14,positive:1,release:false});
 assert.equal(rows.filter(x=>x.finalKg===null).length,0);
 assert.deepEqual(rows.slice(0,85).map(x=>x.finalKg),
   Array.from({length:85},(_,i)=>i+1));
 assert.equal(decisions.length,15);
 assert.equal(decisions.filter(x=>x.choice.action==='set-zero-mass').length,14);
 assert.equal(decisions.filter(x=>x.choice.zeroMassConfirmed===true).length,14);
 assert.equal(decisions.find(x=>x.id==='original-90').choice.action,'final-override');
 assert.equal(decisions.find(x=>x.id==='original-90').choice.value,12.5);
});
test('invalid negative, blank, NaN or missing input cannot partially write',async()=>{
 for(const wrong of ['-1','','NaN','Infinity']){
   const {session,decisions}=verifiedFixture();
   const snapshot=await listXml229RunUnresolvedMasses({session});
   const values=new Map(snapshot.pending.map(x=>[x.occurrenceId,'0']));
   values.set('original-95',wrong);
   await assert.rejects(confirmXml229RunUnresolvedMasses({session,snapshot,values}),
     {code:'RUN_ZERO_CONFIRM_NUMERIC_KG_REQUIRED'});
   assert.equal(decisions.length,0);
 }
});
test('source-stale and changed authoritative Final counts fail closed',async()=>{
 const {session,rows,decisions}=verifiedFixture();
 let current=true;
 const old=session.readPage;
 session.readPage=async options=>{current=false;return old(options);};
 await assert.rejects(listXml229RunUnresolvedMasses({session,isCurrent:()=>current}),
   {code:'RUN_ZERO_PAGE_OR_BASIS_DRIFT'});
 session.readPage=old;current=true;
 const snapshot=await listXml229RunUnresolvedMasses({session});
 rows[0].finalKg=null;
 const values=new Map(snapshot.pending.map(x=>[x.occurrenceId,'0']));
 await assert.rejects(confirmXml229RunUnresolvedMasses({session,snapshot,values}),
   {code:'RUN_ZERO_CONFIRM_FINAL_POPULATION_CHANGED'});
 assert.equal(decisions.length,0);
});
test('Run automatically offers unresolved mass popup only for source-verified pending Weight HOLD',async()=>{
 const {shouldAutoOfferXml229RunMassReview}=await import(
   '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-mass-review-button.mjs');
 const ready={raw:{xml229VerifiedEngineering:true},
   runHoldAudit:{diagnosisCode:'UNRESOLVED_PHYSICAL_MASS'},
   checklistRows:[{id:'weight-match',status:'pending'}]};
 assert.equal(shouldAutoOfferXml229RunMassReview(ready),true);
 assert.equal(shouldAutoOfferXml229RunMassReview(ready,true),false);
 assert.equal(shouldAutoOfferXml229RunMassReview({...ready,
   raw:{xml229VerifiedEngineering:false}}),false);
 assert.equal(shouldAutoOfferXml229RunMassReview({...ready,
   runHoldAudit:{diagnosisCode:'NATIVE_OUTPUT_UNVERIFIED'}}),false);
 assert.equal(shouldAutoOfferXml229RunMassReview({...ready,
   checklistRows:[{id:'weight-match',status:'ready'}]}),false);
});

test('root and served popup/UI byte-identical; Run uses a separate explicit popup',async()=>{
 const dir='../tabs/xml-cii-2019-standalone/ui-adapted/';
 for(const name of ['xml229-run-unresolved-mass-popup.mjs',
   'xml-cii-adapted-output-run.js','xml229-run-mass-review-button.mjs']){
   const source=await readFile(new URL(dir+name,import.meta.url),'utf8');
   const docs=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
   assert.equal(source,docs,name);
 }
 const output=await readFile(new URL(dir+'xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 const popup=await readFile(new URL(dir+'xml229-run-unresolved-mass-popup.mjs',import.meta.url),'utf8');
 assert.match(output,/createXml229RunMassReviewButton/);
 const action=await readFile(new URL(dir+'xml229-run-mass-review-button.mjs',import.meta.url),'utf8');
 assert.match(action,/Review unresolved physicals \(0 kg defaults\)/);
 assert.match(action,/queueMicrotask/);
 assert.match(action,/UNRESOLVED_PHYSICAL_MASS/);
 assert.match(popup,/runZeroSuggestion/);
 assert.match(popup,/overflow-wrap:anywhere/);
 assert.doesNotMatch(popup,/\\.slice\\(0,3\\)/);
 assert.match(popup,/Apply All Source suggestions \(Max\)/);
 assert.match(popup,/input\.value=str\(p\.value\)/);
 assert.match(popup,/submit\.addEventListener\('click',async\(\)=>/);
 assert.match(popup,/origin:kg===0\?'confirmed-zero':'manual'/);
 assert.doesNotMatch(popup,/nativeCiiReleaseAuthorized:true/);
});
