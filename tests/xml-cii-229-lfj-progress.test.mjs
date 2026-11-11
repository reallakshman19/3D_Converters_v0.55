import assert from 'node:assert/strict';
import test from 'node:test';
import {createLfjSourceProgress,advanceLfjSourceProgress,lfjSourceProgressView} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-progress.js';
const move=(state,kind,changes={})=>advanceLfjSourceProgress(state,{kind,nowMs:2000,...changes});
const summary={complete:true,rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,occurrenceCount:622915};
test('808 staged pages always indeterminate and no total or percent invented',()=>{
 let state=move(createLfjSourceProgress(),'START',{nowMs:1000});
 state=move(state,'PAGE',{pagesStaged:808});
 const v=lfjSourceProgressView(state);
 assert.equal(v.indeterminate,true);assert.equal(v.complete,false);assert.equal(v.pagesStaged,808);
 assert.match(v.detail,/808 bounded pages staged/);assert.match(v.detail,/total pages unknown/);
 assert(!v.detail.includes('%'));assert.equal(state.occurrencesCommitted,null);
 assert.equal(state.sourceCommitted,false);assert.equal(v.elapsedSeconds,1);
});
test('commit pending remains indeterminate; actual SOURCE_INDEX_COMPLETE only after verified durable commit',()=>{
 let state=move(createLfjSourceProgress(),'START',{nowMs:1000});
 state=move(state,'PAGE',{pagesStaged:9});
 state=move(state,'COMMIT_PENDING',{nowMs:2300});
 assert.equal(lfjSourceProgressView(state).indeterminate,true);
 assert.equal(lfjSourceProgressView(state).complete,false);
 state=move(state,'SOURCE_COMMITTED',{summary,nowMs:2800});
 const v=lfjSourceProgressView(state);
 assert.equal(v.complete,true);assert.equal(v.indeterminate,false);
 assert.match(v.detail,/622,915 original occurrences committed/);
 assert.match(v.rights,/separate authorized Build/);
});
test('out-of-order or invalid final summary must fail closed',()=>{
 const s=move(createLfjSourceProgress(),'START');
 assert.throws(()=>move(s,'SOURCE_COMMITTED',{summary}),/LFJ_PROGRESS_REQUIRES/);
 const committing=move(s,'COMMIT_PENDING');
 for(const changes of [{complete:false},{rightsBasis:'ENGINEERING_READY'},{engineeringReady:true},{occurrenceCount:-3},{occurrenceCount:null},{occurrenceCount:0.5}]){
  assert.throws(()=>move(committing,'SOURCE_COMMITTED',{summary:{...summary,...changes}}),/LFJ_PROGRESS_REQUIRES/,JSON.stringify(changes));
 }
});
test('failure invalidates provisional staged pages without trace/export promotion',()=>{
 let s=move(createLfjSourceProgress(),'START',{nowMs:1000});
 s=move(s,'PAGE',{pagesStaged:808});
 s=move(s,'FAILED',{code:'SOURCE_PAGE_LIMIT',nowMs:3000});
 const v=lfjSourceProgressView(s);
 assert.equal(v.complete,false);assert.equal(v.indeterminate,false);
 assert.match(v.detail,/no source index or CSV rights/);
 assert.equal(s.occurrencesCommitted,null);assert.equal(s.sourceCommitted,false);
 assert.equal(s.code,'SOURCE_PAGE_LIMIT');
});
test('replacement resets previous committed proof and page count',()=>{
 let s=move(createLfjSourceProgress(),'START');
 s=move(s,'PAGE',{pagesStaged:12});
 s=move(s,'COMMIT_PENDING');s=move(s,'SOURCE_COMMITTED',{summary});
 assert.equal(lfjSourceProgressView(s).complete,true);
 s=move(s,'REVOKED');
 assert.equal(lfjSourceProgressView(s).complete,false);
 assert.equal(s.pagesStaged,0);assert.equal(s.occurrencesCommitted,null);
 s=move(s,'START',{nowMs:3100});assert.equal(s.pagesStaged,0);
 assert.equal(lfjSourceProgressView(s).indeterminate,true);
});
test('no stale/duplicate pages can regress newer or committed phase',()=>{
 let s=move(createLfjSourceProgress(),'START');
 s=move(s,'PAGE',{pagesStaged:12});
 assert.equal(move(s,'PAGE',{pagesStaged:11}),s);
 assert.equal(move(s,'PAGE',{pagesStaged:12}),s);
 s=move(s,'COMMIT_PENDING');
 assert.equal(move(s,'PAGE',{pagesStaged:99}),s);
 s=move(s,'SOURCE_COMMITTED',{summary});
 assert.equal(move(s,'PAGE',{pagesStaged:200}),s);
});
test('no op, invalid or missing progress input never fabricates a successful source',()=>{
 const initial=createLfjSourceProgress();
 assert.equal(lfjSourceProgressView(initial).complete,false);
 assert.equal(lfjSourceProgressView(initial).indeterminate,false);
 const s=move(initial,'START');
 for(const value of [null,NaN,0,-1,1.2,Number.MAX_SAFE_INTEGER+10]){
  assert.equal(move(s,'PAGE',{pagesStaged:value}),s);
 }
 assert.equal(move(s,'IGNORED'),s);
});
