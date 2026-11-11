import './xml229-run-unresolved-popup.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planXml229SkipWeightDrafts} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-skip-weight-drafts.mjs';
import {renderXml229WeightReviewPage} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';

const basisId='b'.repeat(64),sourceId='SOURCE';
const row=i=>({sourceId,occurrenceId:'o-'+i,componentType:'RIGID',
 nodeName:'TEST_VALVE_'+i,sourceKg:null,match1Kg:null,finalKg:null,
 match1View:{match1Revision:'r1',stageDecision:null},
 finalView:{finalRevision:'f1',stageDecision:null},proposals:[]});
const fake=(items)=>({receipt:{basisId,sourceId},readPage:async({offset,limit,filter,query})=>{
 assert.equal(filter,'blank-rigid');assert.equal(query,'');
 return {basisId,offset,totalCount:items.length,complete:true,rows:items.slice(offset,offset+limit)};
}});
test('Skip Weight prepares 0 kg drafts across all Worker pages, preserving edits without writes',async()=>{
 const all=Array.from({length:53},(_,i)=>row(i));
 all[1].match1View.stageDecision={state:'rejected'};
 const existing=new Map([['o-2',{value:'21.5',proposalId:'',reason:'manual edit'}]]);
 const result=await planXml229SkipWeightDrafts(fake(all),{existingDrafts:existing});
 assert.equal(result.counts.blank,53);
 assert.equal(result.counts.existingReview,1);
 assert.equal(result.counts.alreadyEdited,1);
 assert.equal(result.counts.skipped,51);
 assert.equal(result.drafts.size,51);
 assert.deepEqual(result.drafts.get('o-52'),{
  value:'0',proposalId:'',reason:'',skippedWeight:true,autoUnqualified:false,autoFilled:false});
 assert.equal(result.drafts.has('o-1'),false);
 assert.equal(result.drafts.has('o-2'),false);
 assert.equal(existing.get('o-2').value,'21.5');
 assert.equal(result.historicalReviewWrites,0);
 assert.equal(result.acceptedMatch1Automatically,false);
 assert.equal(result.acceptedFinalAutomatically,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});
test('Skip Weight refuses changed source basis and nonblank source masses',async()=>{
 const wrong=fake([row(1)]);
 wrong.readPage=async()=>({basisId:'c'.repeat(64),offset:0,totalCount:1,complete:true,rows:[row(1)]});
 await assert.rejects(planXml229SkipWeightDrafts(wrong),{code:'SKIP_WEIGHT_PAGE_DRIFT'});
 const wrongMass=row(2);wrongMass.sourceKg=12.4;
 await assert.rejects(planXml229SkipWeightDrafts(fake([wrongMass])),{code:'SKIP_WEIGHT_ROW_DRIFT'});
 let current=true;
 const stale=fake([row(0)]);
 const original=stale.readPage;
 stale.readPage=async args=>{current=false;return original(args);};
 await assert.rejects(planXml229SkipWeightDrafts(stale,{isCurrent:()=>current}),
  {code:'SKIP_WEIGHT_SOURCE_STALE'});
});
test('Unqualified pipe is never zero-filled as a weight item',async()=>{
 const excluded={...row(3),nodeName:'PIPE MAIN'};
 await assert.rejects(planXml229SkipWeightDrafts(fake([excluded])),{code:'SKIP_WEIGHT_ROW_DRIFT'});
});
test('one suggestion-backed editable Applied Weight field never writes engineering decisions',()=>{
 const html=renderXml229WeightReviewPage({totalCount:1,rows:[row(1)]});
 assert.match(html,/Nearest Suggestions[\s\S]*data-p4-excel-column="nearestSuggestions"[\s\S]*<\/th>[\s\S]*Applied Weight[\s\S]*data-p4-excel-column="appliedWeight"/);
 assert.doesNotMatch(html,/data-p4-skip-weight/);
 assert.match(html,/Filter Blank Weight/);
 assert.match(html,/All XML physicals/);
 assert.doesNotMatch(html,/data-p4-reason|data-p4-review-match1|data-p4-review-final|data-p4-draft-marker/);
 assert.equal((html.match(/data-p4-applied-weight/g)||[]).length,1);
 assert.match(html,/no separate Match-1 or Final action is required/);
 assert.doesNotMatch(html,/data-p4-accept-match1|data-p4-accept-final|data-p4-candidate|data-p4-bulk-confirm/);
});
test('served Weight/Run assets are byte-identical, and current-source hold is explained',async()=>{
 for(const f of [
  'xml229-p4-weight-review-presentation.mjs',
  'xml229-p4-unqualified-drafts.mjs',
  'xml229-p4-skip-weight-drafts.mjs',
  'xml-cii-adapted-p4-verified-weight-panel.js',
  'xml-cii-adapted-output-run.js'
 ]){
  const source='tabs/xml-cii-2019-standalone/ui-adapted/'+f;
  assert.equal(await readFile(new URL('../'+source,import.meta.url),'utf8'),
   await readFile(new URL('../docs/'+source,import.meta.url),'utf8'),f);
 }
 const run=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(run,/note\.dataset\.xml229CurrentSourceHold='true'/);
 assert.match(run,/If that JSON belonged to a different XML/);
 assert.match(run,/XML-only test conversion/);
 assert.match(run,/sourceBytes/);
});