import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openXml229WeightDraftWorkspace}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs';

function receipt(c='a'){
 return {basisId:c.repeat(64),sourceId:'SOURCE',sourceGenerationId:'GEN-'+c,
  originalJsonSha256:c.repeat(64)};
}
function storage(){
 const items=new Map();
 return {items,getItem(k){return items.get(k)??null;},
  setItem(k,v){items.set(k,v);}};
}
const suggested={value:'42.125',proposalId:'qualified-rank1',reason:'',
 autoFilled:true,autoUnqualified:false};
const skip={value:'0',proposalId:'',reason:'',skippedWeight:true,autoFilled:false};

test('navigation reuses source-bound drafts without accepting Match-1/Final',()=>{
 const store=storage();
 const one=openXml229WeightDraftWorkspace(receipt('a'),{storage:store});
 one.drafts.set('physical-1',suggested);
 one.drafts.set('physical-2',skip);
 assert.equal(one.save(),2);
 const two=openXml229WeightDraftWorkspace(receipt('a'),{storage:store});
 assert.equal(two.drafts,one.drafts,'new panel must share the external workspace');
 assert.equal(two.drafts.get('physical-1').value,'42.125');
 assert.equal(two.drafts.get('physical-2').skippedWeight,true);
 const checkpoint=JSON.parse([...store.items.values()][0]);
 assert.equal(checkpoint.schema,'XML229.SourceBoundWeightDraftWorkspace.v1');
 assert.equal(checkpoint.reviewDecisionsAuthorized,false);
 assert.equal(checkpoint.nativeCiiReleaseAuthorized,false);
 assert.equal(checkpoint.entries.length,2);
});

test('reload recovers an entire atomic checkpoint, but never other source/masters',async()=>{
 const store=storage();
 const one=openXml229WeightDraftWorkspace(receipt('b'),{storage:store});
 one.drafts.set('physical-3',{value:'16.25',proposalId:'',reason:'Manual review pending'});
 one.save();
 const fresh=await import('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs?reload=1');
 const again=fresh.openXml229WeightDraftWorkspace(receipt('b'),{storage:store});
 assert.equal(again.drafts.get('physical-3').value,'16.25');
 assert.equal(again.drafts.get('physical-3').reason,'Manual review pending');
 assert.equal(fresh.openXml229WeightDraftWorkspace(receipt('c'),{storage:store})
  .drafts.size,0,'different verified basis cannot recover prior drafts');
 assert.equal(again.isFor({...receipt('b'),sourceGenerationId:'WRONG'}),false);
});

test('fresh Worker generation reattests the exact source basis and physical census across reload',async()=>{
 const store=storage(),old=receipt('7');
 const first=openXml229WeightDraftWorkspace(old,{storage:store,
  occurrenceIds:['physical-1','physical-2']});
 first.drafts.set('physical-1',{value:'31.5',proposalId:'',reason:'Original engineering check'});
 first.save();
 const fresh=await import('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs?reload-generation=1');
 const reverified={...old,sourceGenerationId:'NEW-VERIFIED-GENERATION'};
 const recovered=fresh.openXml229WeightDraftWorkspace(reverified,{storage:store,
  occurrenceIds:['physical-1','physical-2']});
 assert.equal(recovered.drafts.get('physical-1').value,'31.5');
 assert.equal(recovered.isFor(old),false,'new Worker generation must become current');
 recovered.save();
 const now=JSON.parse([...store.items.values()][0]);
 assert.equal(now.sourceGenerationId,'NEW-VERIFIED-GENERATION');
 assert.equal(now.reviewDecisionsAuthorized,false);
 assert.equal(now.nativeCiiReleaseAuthorized,false);
});
test('generation rebind never accepts unknown physicals, other SHA or an unchecked census',async()=>{
 const store=storage(),old=receipt('8');
 const first=openXml229WeightDraftWorkspace(old,{storage:store,occurrenceIds:['physical-1']});
 first.drafts.set('physical-1',{value:'93'});
 first.save();
 const fresh=await import('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs?reload-generation=2');
 const changed={...old,sourceGenerationId:'REVERIFIED'};
 assert.throws(()=>fresh.openXml229WeightDraftWorkspace(changed,{storage:store}),
  {code:'WEIGHT_DRAFT_BASIS_OR_FORMAT_MISMATCH'});
 assert.throws(()=>fresh.openXml229WeightDraftWorkspace(changed,{
  storage:store,occurrenceIds:['not-physical-1']}),
  {code:'WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE'});
 assert.throws(()=>fresh.openXml229WeightDraftWorkspace({
  ...changed,originalJsonSha256:'f'.repeat(64)},{
  storage:store,occurrenceIds:['physical-1']}),
  {code:'WEIGHT_DRAFT_BASIS_OR_FORMAT_MISMATCH'});
 // A second Worker on the SAME page gets a new generation; it must receive
 // a new ownership object but preserve only census-confirmed kg drafts.
 const updated=openXml229WeightDraftWorkspace(changed,{
  storage:store,occurrenceIds:['physical-1']});
 assert.equal(updated.drafts.get('physical-1').value,'93');
 assert.equal(updated.isFor(old),false);
 assert.equal(first.isFor(changed),false);
 assert.equal(updated.reviewDecisionsAuthorized,undefined);
});
test('reopening with 85 existing Final decisions is not blocked by a stale browser draft ID',async()=>{
 const store=storage(),previous=receipt('q');
 const saved=openXml229WeightDraftWorkspace(previous,{storage:store});
 saved.drafts.set('still-original',{value:'18.5',proposalId:'',reason:'Owner pending draft'});
 saved.drafts.set('obsolete-original',{value:'0',skippedWeight:true});
 saved.save();
 const fresh=await import('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs?reopen-safe=1');
 const verified={...previous,sourceGenerationId:'NEW-GENERATION-q'};
 assert.throws(()=>fresh.openXml229WeightDraftWorkspace(verified,{
   storage:store,occurrenceIds:['still-original','new-original']}),
   {code:'WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE'});
 const recovered=fresh.openXml229WeightDraftWorkspace(verified,{
   storage:store,occurrenceIds:['still-original','new-original'],recoverUnknownCensus:true});
 assert.deepEqual(recovered.recovery,{rejectedCount:1,retainedCount:1,backupStored:true});
 assert.equal(recovered.drafts.get('still-original').value,'18.5');
 assert.equal(recovered.drafts.has('obsolete-original'),false);
 assert.equal(recovered.exportQuarantinedBackup().entries.some(([id])=>id==='obsolete-original'),true);
 assert.equal([...store.items.keys()].filter(x=>x.includes('quarantine-v1')).length,1);
 assert.equal(recovered.save(),1);
 assert.equal(JSON.parse([...store.items.values()][0]).entries.length,1);
 assert.equal(recovered.exportBackup().reviewDecisionsAuthorized,false);
 assert.equal(recovered.exportBackup().nativeCiiReleaseAuthorized,false);
 assert.throws(()=>recovered.restoreBackup({
   ...recovered.exportBackup(),entries:[['obsolete-original',{value:'30'}]]}),
   {code:'WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE'});
});
test('same-generation local drafts recover without remapping other physicals',()=>{
 const store=storage(),r=receipt('w');
 const before=openXml229WeightDraftWorkspace(r,{storage:store});
 before.drafts.set('valid',{value:'22'});
 before.drafts.set('ghost',{value:'99'});
 before.save();
 assert.throws(()=>openXml229WeightDraftWorkspace(r,{
   storage:store,occurrenceIds:['valid','new']}),
   {code:'WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE'});
 const after=openXml229WeightDraftWorkspace(r,{
   storage:store,occurrenceIds:['valid','new'],recoverUnknownCensus:true});
 assert.equal(after.drafts,before.drafts);
 assert.equal(after.drafts.get('valid').value,'22');
 assert.equal(after.drafts.has('ghost'),false);
 assert.equal(after.recovery.rejectedCount,1);
 assert.equal(after.save(),1);
 assert.equal(openXml229WeightDraftWorkspace(r,{
   storage:store,occurrenceIds:['valid','new']}),after);
});
test('quarantine storage failure cannot overwrite the only old draft checkpoint',()=>{
 const store=storage(),r=receipt('x');
 const old=openXml229WeightDraftWorkspace(r,{storage:store});
 old.drafts.set('ghost',{value:'36'});old.save();
 const [key,original]=[...store.items.entries()][0],realSet=store.setItem;
 store.setItem=(k,v)=>{if(k.includes('quarantine-v1'))throw Error('quota');realSet(k,v);};
 const current=openXml229WeightDraftWorkspace(r,{
   storage:store,occurrenceIds:['right'],recoverUnknownCensus:true});
 assert.deepEqual(current.recovery,{rejectedCount:1,retainedCount:0,backupStored:false});
 assert.equal(current.drafts.size,0);
 assert.equal(current.exportQuarantinedBackup().entries[0][0],'ghost');
 assert.throws(()=>current.save(),{code:'WEIGHT_DRAFT_QUARANTINE_SAVE_REQUIRED'});
 assert.equal(store.getItem(key),original);
});
test('live Weight panel shows a private recovery warning while preserving strict backup rules',async()=>{
 const dir='tabs/xml-cii-2019-standalone/ui-adapted/';
 const panel=await readFile(new URL('../'+dir+'xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 const notice=await readFile(new URL('../'+dir+'xml229-p4-draft-recovery-notice.mjs',import.meta.url),'utf8');
 assert.match(panel,/recoverUnknownCensus:true/);
 assert.match(panel,/showXml229DraftRecoveryNotice/);
 assert.match(panel,/saveXml229RecoveryDrafts/);
 assert.match(notice,/Download excluded draft backup/);
 assert.match(notice,/Existing accepted Final masses are unchanged/);
 for(const name of ['xml229-p4-draft-recovery-notice.mjs','xml229-p4-weight-draft-workspace.mjs']){
   const [root,served]=await Promise.all([
     readFile(new URL('../'+dir+name,import.meta.url),'utf8'),
     readFile(new URL('../docs/'+dir+name,import.meta.url),'utf8')]);
   assert.equal(root,served,name);
 }
});

test('private backup restore requires exact basis and never mixes reviewed ledgers',()=>{
 const store=storage();
 const source=openXml229WeightDraftWorkspace(receipt('d'),{storage:store});
 source.drafts.set('id-1',suggested);
 source.save();
 const backup=source.exportBackup();
 const target=openXml229WeightDraftWorkspace(receipt('e'),{storage:store});
 target.drafts.set('existing',{value:'29',proposalId:'',reason:'keep'});
 assert.throws(()=>target.restoreBackup(backup),{code:'WEIGHT_DRAFT_BASIS_OR_FORMAT_MISMATCH'});
 assert.equal(target.drafts.get('existing').value,'29');
 assert.equal(target.drafts.has('id-1'),false);
 assert.equal(source.restoreBackup(backup),1);
 assert.equal(source.drafts.get('id-1').proposalId,'qualified-rank1');
});

test('reject corrupt saved values, duplicate occurrences and forged skip zeros',()=>{
 const w=openXml229WeightDraftWorkspace(receipt('f'),{storage:storage()});
 const base=w.exportBackup();
 for(const entries of [
  [['id',{value:'NaN'}]],
  [['id',{value:'-1'}]],
  [['id',{value:'9',skippedWeight:true}]],
  [['same',{value:'3'}],['same',{value:'4'}]],
  [['id',{value:'5',autoFilled:true,proposalId:''}]],
 ]){
  assert.throws(()=>w.restoreBackup({...base,entries}));
 }
 assert.equal(w.drafts.size,0);
});

test('unverified occurrence identifiers are rejected before any draft is recovered',()=>{
 const store=storage();
 const r=receipt('3');
 const w=openXml229WeightDraftWorkspace(r,{storage:store,occurrenceIds:['one','two']});
 w.drafts.set('one',{value:'14.5'});
 w.save();
 assert.throws(()=>w.restoreBackup({...w.exportBackup(),
  entries:[['ghost',{value:'999'}]]}),
  {code:'WEIGHT_DRAFT_UNKNOWN_ORIGINAL_OCCURRENCE'});
 assert.equal(w.drafts.has('ghost'),false);
 assert.throws(()=>openXml229WeightDraftWorkspace(r,{
  storage:store,occurrenceIds:['one','one']}),
  {code:'WEIGHT_DRAFT_PHYSICAL_CENSUS_INVALID'});
});

test('storage failure does not turn unsaved drafts into reviewed masses and restore rolls back',()=>{
 const base=storage();
 const w=openXml229WeightDraftWorkspace(receipt('1'),{storage:base});
 w.drafts.set('original',{value:'10'});
 const saved=w.exportBackup();
 w.save();
 const failing=storage();failing.setItem=()=>{throw Error('quota');};
 const other=openXml229WeightDraftWorkspace(receipt('2'),{storage:failing});
 other.drafts.set('old',{value:'17'});
 assert.throws(()=>other.save(),{code:'WEIGHT_DRAFT_STORAGE_WRITE_FAILED'});
 assert.throws(()=>other.restoreBackup({...saved,...receipt('2')}),
  {code:'WEIGHT_DRAFT_STORAGE_WRITE_FAILED'});
 assert.equal(other.drafts.get('old').value,'17');
});

test('Weight panel and workspace are identically served under docs and leave native HOLD alone',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs',
 ]){
  const [root,served]=await Promise.all([
   readFile(new URL('../'+path,import.meta.url),'utf8'),
   readFile(new URL('../docs/'+path,import.meta.url),'utf8')]);
  assert.equal(root,served,path);
 }
 const panel=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.match(panel,/data-p4-save-drafts/);
 assert.match(panel,/data-p4-import-drafts/);
 assert.match(panel,/openXml229WeightDraftWorkspace/);
 assert.match(panel,/occurrenceIds:session.originalPhysicalOccurrences/);
 assert.match(panel,/persistDrafts\(\)/);
 assert.doesNotMatch(panel,/commitXml229TwoClickMatch1\(/);
 const gate=await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js',import.meta.url),'utf8');
 assert.match(gate,/xml229-original-json-engineering-authority/);
 assert.match(gate,/status:'held'/);
});
