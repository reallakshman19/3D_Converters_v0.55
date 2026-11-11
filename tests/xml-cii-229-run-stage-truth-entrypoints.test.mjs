import test from 'node:test';
import assert from 'node:assert/strict';
import {runModeABatchFromUi}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a.js';
import {runModeABatchFastFromUi}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-mode-a-fast.js';

const xml='<Plant><Branch><Branchname>/OWNER-S8811000-91261M7/B1</Branchname></Branch></Plant>';
function state(){
 return {current:{
  sourceKind:'xml',sourceText:xml,supportConfigJson:'{}',running:false,batchRunning:false,
  options:{outputMode:'both'},
  branchSelection:{selectedBranchNames:['/OWNER-S8811000-91261M7/B1']},
  xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',
    engineeringReady:false,sha256:'a'.repeat(64),generationId:'SYNTHETIC-O1'},
  sourceBatch:{mode:'separate-models',activeSourceId:'S',sources:[{
   sourceId:'S',sourceText:xml,fileName:'synthetic.xml',sourceDigest:'test',
   enabled:true,supportConfigJson:'{}',metrics:{branchCount:1},
   branchSelection:{selectedBranchNames:['/OWNER-S8811000-91261M7/B1']},
  }]},
 }};
}
test('standard Mode A execution refuses source-only original JSON before generating models',async()=>{
 const ref=state();
 await runModeABatchFromUi(ref,()=>{});
 assert.equal(ref.current.batchRunResult?.summary?.succeeded,0);
 assert(ref.current.batchRunResult?.summary?.blocked>=1);
 assert.equal(ref.current.batchRunResult?.sources?.length,0);
 assert.match(ref.current.batchRunStatus,/original JSON O1 (?:source is indexed\/selected only|indexing is source-only)/i);
 assert.equal(ref.current.batchRunning,false);
});
test('fast Mode A ZIP execution refuses source-only original JSON before consolidated review',async()=>{
 const ref=state();
 const progressElement={textContent:'',dataset:{},style:{}};
 const result=await runModeABatchFastFromUi(ref,()=>{},{
   downloadZip:true,progressElement,
 });
 assert.equal(result.summary.succeeded,0);
 assert(result.summary.blocked>=1);
 assert.equal(result.sources.length,0);
 assert.match(ref.current.batchRunStatus,/original JSON O1 (?:source is indexed\/selected only|indexing is source-only)/i);
 assert.equal(ref.current.batchRunning,false);
 assert.equal(progressElement.dataset.modeAFastRunTone,'bad');
});
