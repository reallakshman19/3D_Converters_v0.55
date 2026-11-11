import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 renderXml229WeightReviewPage,choiceForXml229WeightRow,
 xml229WeightReviewPageModel,xml229WeightReviewStatus,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs';
import {xml229UnbuiltIndependentStage}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-run-readiness-presentation.mjs';
import {planXml229RigidWeightDrafts,planXml229UnqualifiedDrafts,formatXml229Match1Exclusions}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs';
import {xml229WeightReviewEligible,xml229IsExcludedWeightFitting,xml229ProposalScorePercent,xml229WeightThreshold}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-weight-review-focus.mjs';
import {matchesXml229WeightReviewFilter,xml229WeightReviewFilters}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-weight-page-filter.mjs';

const row=()=>({
  sourceId:'SRC-TEST',occurrenceId:'exact-source::occ-01',
  branchOccurrenceIndex:7,nodeOrdinal:13,sourceKg:null,match1Kg:null,finalKg:null,
  proposedKg:47.488,match1View:{revision:'match1-r'},finalView:{revision:'final-r'},
  proposals:[{proposalId:'attested-master-1',ranking:1,value:47.488,qualified:false,method:'master-match'}],
});

test('simple source-bound Weight UI shows Applied Weight, three adjacent filters and no approval clutter',()=>{
  const page={totalCount:423,rows:[row()]};
  const html=renderXml229WeightReviewPage(page,0);
  assert.match(html,/mc-rigid-review-table-wrap/);
  assert.match(html,/mc-rigid-review-candidate/);
  assert.match(html,/data-p4-occurrence="exact-source::occ-01"/);
  assert.match(html,/data-p4-proposal/);
  assert.match(html,/data-p4-applied-weight/);
  assert.match(html,/Nearest Suggestions/);
  assert.match(html,/Applied Weight/);
  assert.match(html,/Recorded Weight/);
  assert.match(html,/Filter Blank Weight/);
  assert.match(html,/All XML physicals/);
  assert.match(html,/Weight items/);
  assert.match(html,/data-p4-skip-weight/);
  assert.match(html,/Apply all suggestions/);
  assert.doesNotMatch(html,/data-p4-candidate|data-p4-reason|data-p4-accept-match1|data-p4-accept-final|data-p4-bulk-confirm|data-p4-filter-unresolved/);
  assert.doesNotMatch(html,/Apply all Match-1|Engineering reason|Review Final|<option value="">Manual/);
  assert.equal((html.match(/<th style=/g)||[]).length,14);
  assert.match(html,/data-p4-scope="rigid"/);
  assert.match(html,/data-p4-scope="blank-rigid"/);
  assert.match(html,/data-p4-scope="all"/);
  assert.match(html,/data-p4-min-score/);
  assert.match(html,/423 components/);
  assert.match(html,/showing 1–1/);
  assert.match(html,/Editable draft · not approved/);
  assert.equal(xml229WeightReviewPageModel(page,0).counts.unresolved,1);
});

test('rendered original occurrence and master candidate are escaped and can never inject HTML',()=>{
 const x=row();x.sourceId='<script>alert(1)</script>';
 x.proposals[0].method='<img src=x onerror=alert(1)>';
 const html=renderXml229WeightReviewPage({totalCount:1,rows:[x]});
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/<img src=/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img/);
});

test('candidate chip is a draft; only a selected source-bound candidate can create Match-1',()=>{
 const x=row();
 assert.deepEqual(choiceForXml229WeightRow(x,{
   stage:'match1',proposalId:'attested-master-1',reason:'Reviewed source candidate',
 }),{view:x.match1View,choice:{
   action:'accept-proposal',proposalId:'attested-master-1',reason:'Reviewed source candidate',
 }});
 assert.throws(()=>choiceForXml229WeightRow(x,{stage:'match1',proposalId:'invented'}),
   /does not belong/);
});

test('manual Match-1 and Final need explicit positive mass and engineering reason',()=>{
 const x=row();
 for(const stage of ['match1','final']){
   assert.throws(()=>choiceForXml229WeightRow(x,{stage,value:'',reason:'x'}),/positive/);
   assert.throws(()=>choiceForXml229WeightRow(x,{stage,value:'-2',reason:'x'}),/positive/);
   assert.throws(()=>choiceForXml229WeightRow(x,{stage,value:'40',reason:' '}),/reason/);
 }
 assert.deepEqual(choiceForXml229WeightRow(x,{stage:'match1',value:'35',reason:'Engineer checked'}),
   {view:x.match1View,choice:{action:'enter-manual',value:35,unit:'kg',reason:'Engineer checked'}});
 assert.deepEqual(choiceForXml229WeightRow(x,{stage:'final',value:'40',reason:'Independent final'}),
   {view:x.finalView,choice:{action:'final-override',value:40,unit:'kg',reason:'Independent final'}});
});

test('review stage semantics remain distinct, including source-only mass',()=>{
 const r=row();
 assert.equal(xml229WeightReviewStatus(r).kind,'unresolved');
 assert.equal(xml229WeightReviewStatus({...r,sourceKg:13}).kind,'source');
 assert.equal(xml229WeightReviewStatus({...r,match1Kg:14}).kind,'match1');
 assert.equal(xml229WeightReviewStatus({...r,finalKg:15}).kind,'final');
});

test('Filter Blank shows only source-bound RIGID rows with no accepted mass',()=>{
 assert.deepEqual(xml229WeightReviewFilters,
  ['all','rigid','blank-rigid','needs-review']);
 const unresolved={componentType:'RIGID',sourceKg:null,match1State:'deferred',finalState:'rejected'};
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',unresolved),true);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,sourceKg:0}),true);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,sourceKg:NaN}),true);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,componentType:'PIPE'}),false);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,sourceKg:15}),false);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,match1State:'accepted'}),false);
 assert.equal(matchesXml229WeightReviewFilter('blank-rigid',{...unresolved,finalState:'accepted'}),false);
 assert.equal(matchesXml229WeightReviewFilter('needs-review',{...unresolved,componentType:'PIPE'}),false);
 assert.equal(matchesXml229WeightReviewFilter('rigid',{...unresolved,sourceKg:15}),true);
 assert.equal(matchesXml229WeightReviewFilter('all',{...unresolved,componentType:'PIPE'}),true);
 assert.throws(()=>matchesXml229WeightReviewFilter('unverified',unresolved),/Unknown/);
});

test('source-wide unqualified draft action plans all Worker pages without review writes',async()=>{
 const rows=Array.from({length:53},(_,i)=>({
   sourceId:'SOURCE',occurrenceId:'id-'+i,componentType:'RIGID',
   sourceKg:null,match1Kg:null,finalKg:null,
   match1View:{match1Revision:'m1',stageDecision:i===2?{state:'rejected'}:null},
   finalView:{finalRevision:'f1',stageDecision:null},
   proposals:i===0?[]:i===1?[{proposalId:'q',ranking:1,value:5,qualified:true}]:
     [{proposalId:'p-'+i,ranking:1,value:i+1,qualified:false}],
 }));
 const calls=[],writes=[];
 const session={receipt:{basisId:'b'.repeat(64),sourceId:'SOURCE'},async readPage(args){
   calls.push(args);
   return {basisId:this.receipt.basisId,offset:args.offset,
     totalCount:rows.length,complete:true,rows:rows.slice(args.offset,args.offset+args.limit)};
 },review:()=>writes.push('write')};
 const saved=new Map([['id-3',{value:'123',proposalId:'p-3',reason:'reviewer draft'}]]);
 const result=await planXml229UnqualifiedDrafts(session,{existingDrafts:saved});
 assert.equal(result.counts.blankRigid,53);
 assert.equal(result.counts.withoutProposal,1);
 assert.equal(result.counts.qualifiedPresent,1);
 assert.equal(result.counts.existingReview,1);
 assert.equal(result.counts.alreadyDrafted,1);
 assert.equal(result.counts.prepared,49);
 assert.equal(result.drafts.size,49);
 assert.deepEqual(calls.map(x=>x.offset),[0,25,50]);
 assert(calls.every(x=>x.filter==='blank-rigid'&&x.query===''&&x.limit===25));
 assert.equal(result.drafts.has('id-3'),false);
 assert.equal(result.drafts.has('id-2'),false);
 assert.equal(result.drafts.get('id-52').value,'53');
 assert.equal(result.drafts.get('id-52').proposalId,'p-52');
 assert.deepEqual(writes,[]);
 assert.equal(result.reviewDecisionsAuthorized,false);
 assert.equal(result.finalAcceptedAutomatically,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});

test('unqualified draft scan fails closed on stale Worker and changed review revision',async()=>{
 const mk=(revision='m1')=>({
   sourceId:'SOURCE',occurrenceId:'id-'+revision,componentType:'RIGID',
   match1View:{match1Revision:revision,stageDecision:null},
   finalView:{finalRevision:'f1',stageDecision:null},
   proposals:[{proposalId:'p',ranking:1,value:5,qualified:false}],
 });
 const receipt={basisId:'b'.repeat(64),sourceId:'SOURCE'};
 const stale={receipt,readPage:async()=>({
   basisId:'c'.repeat(64),offset:0,totalCount:1,complete:true,rows:[mk()],
 })};
 await assert.rejects(planXml229UnqualifiedDrafts(stale),{code:'UNQUALIFIED_DRAFT_PAGE_DRIFT'});
 let current=true;
 const closed={receipt,readPage:async()=>{current=false;return {
   basisId:receipt.basisId,offset:0,totalCount:1,complete:true,rows:[mk()],
 };}};
 await assert.rejects(planXml229UnqualifiedDrafts(closed,{isCurrent:()=>current}),
  {code:'UNQUALIFIED_DRAFT_STALE_SOURCE'});
 const drift={receipt,readPage:async({offset})=>({
   basisId:receipt.basisId,offset,totalCount:26,complete:true,
   rows:Array.from({length:Math.min(25,26-offset)},(_,i)=>({
     ...mk(offset? 'm2':'m1'),occurrenceId:'id-'+(offset+i),
   })),
 })};
 await assert.rejects(planXml229UnqualifiedDrafts(drift),{code:'UNQUALIFIED_DRAFT_REVIEW_DRIFT'});
});

test('Match-1 exclusion display describes disjoint reasons, never engineering acceptance',()=>{
 const report=formatXml229Match1Exclusions({qualified:0,exclusions:{
   sourceMassPresent:2,match1DecisionPresent:125,noRank1Proposal:88,
   topRankUnqualified:205,lowerRankQualified:3,
   finalDecisionPresent:0,conflictingQualifiedCandidates:2,
 }});
 assert.match(report,/No rank-1 proposal: 88/);
 assert.match(report,/Rank-1 not qualified: 205/);
 assert.match(report,/qualified only at lower rank: 3/);
 assert.match(report,/Existing Match-1 decision.*: 125/);
 assert.match(report,/ready for explicit confirmation/);
 assert.match(report,/Final\/native CII remain independent/);
});

test('5 Run distinguishes unperformed independent stages but cannot admit a blocked stage',()=>{
 for(const id of ['support-mapper','resolver-json','manual-restraints']){
  const p=xml229UnbuiltIndependentStage(id,{status:'missing',blocking:'false'});
  assert.equal(p.status,'not-run');
  assert.equal(p.severity,'warning');
  assert.match(p.message,/Not run:/);
  assert.equal(xml229UnbuiltIndependentStage(id,{status:'missing',blocking:'true'}),null);
  assert.equal(xml229UnbuiltIndependentStage(id,{status:'ready',blocking:'false'}),null);
 }
 assert.equal(xml229UnbuiltIndependentStage('xml229-original-json-engineering-authority',
   {status:'held',blocking:'true'}),null);
 assert.equal(xml229UnbuiltIndependentStage('weight-match',{status:'pending',blocking:'false'}),null);
});

test('adapter uses Worker readPage/review and keeps native Run HOLD and full source custody',async()=>{
 const panel=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 const run=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
  const worker=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',import.meta.url),'utf8');
  assert.match(worker,/matchesXml229WeightReviewFilter\(mode,/);
  assert.match(panel,/planQualifiedBlankFill/);
  assert.doesNotMatch(panel,/commitXml229TwoClickMatch1/);
 assert.match(panel,/(?:active|session)\.readPage\(\{offset,limit:25\}\)/,
   'Worker paging must stay source-bound; captured session prevents late cancelled responses from painting');
 assert.doesNotMatch(panel,/await active\.review\(\{view,choice\}\)/);
  assert.match(panel,/planXml229SkipWeightDrafts\(/);
 assert.doesNotMatch(panel,/choiceForXml229WeightRow/);
 assert.match(panel,/getXml229CurrentWorkerHeldReview/);
 assert.match(run,/projectOriginalReviewIntoRunChecklist/);
 assert.match(run,/verifiedEngineering:/);
 assert(run.includes('paint(verifiedReport,latest)'), 'must paint one verified canonical report using the latest workflow state');
 assert.doesNotMatch(run,/tr\.children\[2\]\.textContent=status/,
   'verification must publish one report, never hand-edit a checklist cell');
});

test('served production route is byte-identical to owned root files',async()=>{
 for(const path of [
 'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-review-presentation.mjs',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-run-readiness-presentation.mjs',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js',
 ]){
   const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
   const served=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
   assert.equal(root,served,path);
 }
});

test('Auto Fill populates original RIGID rank-1 candidates across full Worker paging without acceptance',async()=>{
 const basisId='b'.repeat(64),sourceId='SOURCE',writes=[],reads=[];
 const rows=Array.from({length:27},(_,i)=>{
   const top={proposalId:'p-'+i,ranking:1,value:i+20.125,qualified:i%2===0,unit:'kg'};
   const proposals=i===3?[]:i===4?[top,{proposalId:'other',ranking:2,value:99.5,
     qualified:true,unit:'kg'}]:[top];
   return {sourceId,occurrenceId:'original-'+i,componentType:'RIGID',
     sourceKg:null,match1Kg:null,finalKg:null,proposals,
     match1View:{match1Revision:'m1',stageDecision:i===5?{state:'deferred'}:null,proposals},
     finalView:{finalRevision:'f1',stageDecision:null}};
 });
 const entered={value:'manually entered',proposalId:'',reason:'Engineer typing'};
 const existingDrafts=new Map([['original-6',entered]]);
 const session={receipt:{basisId,sourceId},async readPage(args){
   reads.push(args);
   return {basisId,offset:args.offset,totalCount:rows.length,
     complete:true,rows:rows.slice(args.offset,args.offset+args.limit)};
 },review(){writes.push('write');}};
 const result=await planXml229RigidWeightDrafts(session,{existingDrafts});
 assert.equal(result.counts.blankRigid,27);
 assert.equal(result.counts.withoutProposal,1);
 assert.equal(result.counts.existingReview,1);
 assert.equal(result.counts.alreadyDrafted,1);
 assert.equal(result.counts.prepared,24);
 assert.equal(result.counts.conflictingQualifiedValues,1);
 assert(result.counts.preparedQualified>0&&result.counts.preparedUnqualified>0);
 assert.equal(result.drafts.get('original-0').value,'20.125');
 assert.equal(result.drafts.get('original-0').proposalId,'p-0');
 assert.equal(result.drafts.get('original-0').autoUnqualified,false);
 assert.equal(result.drafts.get('original-1').value,'21.125');
 assert.equal(result.drafts.get('original-1').autoUnqualified,true);
 assert.equal(result.drafts.has('original-3'),false);
 assert.equal(result.drafts.has('original-5'),false);
 assert.equal(result.drafts.has('original-6'),false);
 assert.equal(existingDrafts.get('original-6'),entered);
 assert.deepEqual(reads.map(x=>x.offset),[0,25]);
 assert(reads.every(x=>x.filter==='blank-rigid'&&x.limit===25));
 assert.deepEqual(writes,[]);
 assert.equal(result.reviewDecisionsAuthorized,false);
 assert.equal(result.finalAcceptedAutomatically,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});

test('Auto Fill refuses a tampered projected kilogram value',async()=>{
 const basisId='b'.repeat(64),sourceId='SOURCE',
   pinned={proposalId:'p',ranking:1,value:35,qualified:true,unit:'kg'};
 const session={receipt:{basisId,sourceId},async readPage({offset}){
   return {basisId,offset,totalCount:1,complete:true,rows:[{
     sourceId,occurrenceId:'o',componentType:'RIGID',
     proposals:[{...pinned,value:514.448}],
     match1View:{match1Revision:'m1',stageDecision:null,proposals:[pinned]},
     finalView:{finalRevision:'f1',stageDecision:null},
   }]};
 }};
 const plan=await planXml229RigidWeightDrafts(session);
 assert.equal(plan.counts.prepared,0);
 assert.equal(plan.counts.unqualifiedInvalid,1);
 assert.equal(plan.drafts.size,0);
});

test('Auto Fill actually hydrates input values and selected candidates rather than placeholders only',async()=>{
 const file=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 assert.match(file,/planXml229RigidWeightDrafts\(session,/);
 const hydration=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs',import.meta.url),'utf8');
 assert.match(hydration,/input\.value=saved\.value/);
 assert.match(file,/hydrateXml229WeightDraftInputs\(table,page\.rows,draftValues\)/);
 assert.match(hydration,/selection\.value=saved\.proposalId/);
 assert.match(file,/confirm\.disabled=!plan\.qualified/);
 assert.doesNotMatch(file,/nativeCiiReleaseAuthorized:true/);
 const raw=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs',import.meta.url),'utf8');
 const served=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-unqualified-drafts.mjs',import.meta.url),'utf8');
 assert.equal(raw,served);
});

test('pinned Match-1 candidate cannot accept manually edited different kilograms',()=>{
 const x=row();
 assert.throws(()=>choiceForXml229WeightRow(x,{
   stage:'match1',proposalId:'attested-master-1',value:'514.448',reason:'Checked',
 }),/Draft kg differs from selected proposal/);
 assert.equal(choiceForXml229WeightRow(x,{
   stage:'match1',proposalId:'attested-master-1',value:'47.488',
 }).choice.action,'accept-proposal');
});

test('focused RIGID queue excludes ordinary fittings but preserves full-source audit',()=>{
 assert.equal(xml229WeightReviewEligible({componentType:'RIGID',nodeName:'VGT-100'}),true);
 assert.equal(xml229WeightReviewEligible({componentType:'VALV',nodeName:'VGT-100'}),true);
 assert.equal(xml229WeightReviewEligible({componentType:'INST',nodeName:'PCV-100'}),true);
 for(const r of [
  {componentType:'RIGID',nodeName:'TEE REDUCING BW'},
  {componentType:'RIGID',dtxr:'TEE REDUCING BW SCH 80'},
  {componentType:'RIGID',nodeName:'ELBOW-90'},
  {componentType:'RIGID',nodeName:'PIPE-STRAIGHT'},
  {componentType:'RIGID',dtxr:'REDUCER BW 300'},
 ]) {
  assert.equal(xml229WeightReviewEligible(r),false);
  assert.equal(matchesXml229WeightReviewFilter('rigid',r),false);
  assert.equal(matchesXml229WeightReviewFilter('blank-rigid',r),false);
  assert.equal(matchesXml229WeightReviewFilter('all',r),true);
 }
 assert.equal(xml229IsExcludedWeightFitting({dtxr:'WELDING NECK FLANGE PIPE CLASS'}),false);
});

test('suggestion threshold normalizes scores and never commits draft weights',async()=>{
 assert.equal(xml229ProposalScorePercent({score:.86}),86);
 assert.equal(xml229ProposalScorePercent({score:91}),91);
 assert.equal(xml229ProposalScorePercent({score:null}),null);
 assert.equal(xml229WeightThreshold(80),80);
 assert.throws(()=>xml229WeightThreshold(101),/0–100/);
 const basisId='b'.repeat(64),sourceId='SOURCE';
 const ps=[
  {proposalId:'p0',ranking:1,value:15,unit:'kg',qualified:true,score:.91},
  {proposalId:'p1',ranking:1,value:19,unit:'kg',qualified:false,score:79},
  {proposalId:'p2',ranking:1,value:12,unit:'kg',qualified:false,score:.88},
 ];
 let writes=0;
 const session={receipt:{basisId,sourceId},async readPage({offset}){
  const rows=ps.map((p,i)=>({
   sourceId,occurrenceId:'o'+i,componentType:'RIGID',nodeName:'VGT-100',
   sourceKg:null,match1Kg:null,finalKg:null,proposals:[p],
   match1View:{match1Revision:'m1',stageDecision:null,proposals:[p]},
   finalView:{finalRevision:'f1',stageDecision:null},
  }));
  return {basisId,offset,totalCount:rows.length,complete:true,rows};
 },review(){writes++}};
 const plan=await planXml229RigidWeightDrafts(session,{minScorePercent:80});
 assert.equal(plan.counts.prepared,2);
 assert.equal(plan.counts.preparedQualified,1);
 assert.equal(plan.counts.preparedUnqualified,1);
 assert.equal(plan.counts.belowThreshold,1);
 assert.equal(plan.drafts.has('o1'),false);
 assert.equal(plan.drafts.get('o2').value,'12');
 assert.equal(writes,0);
 assert.equal(plan.finalAcceptedAutomatically,false);
 assert.equal(plan.nativeCiiReleaseAuthorized,false);
});

test('two click Match-1 UI retains explicit Worker planId commitment',async()=>{
 const panel=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',import.meta.url),'utf8');
 assert.match(panel,/minScorePercent=80/);
 assert.match(panel,/session\.planQualifiedBlankFill\(\{minScorePercent\}\)/);
 const guard=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-two-click-confirmation.mjs',import.meta.url),'utf8');
 assert.match(guard,/session\.commitQualifiedBlankFill\(\{planId:plan\.planId\}\)/);
 assert.match(worker,/candidateEligibility:/);
 assert.match(worker,/xml229WeightReviewEligible\(meta\)/);
 assert.match(worker,/xml229ProposalScorePercent\(selected\)/);
 assert.doesNotMatch(panel,/nativeCiiReleaseAuthorized:true/);
});

test('proposal confidence displays normalized percentage rather than 0 or 1 percent',()=>{
 const x=row();
 x.proposals[0].score=0.91;
 const html=renderXml229WeightReviewPage({totalCount:1,rows:[x]});
 assert.match(html,/91%/);
 assert.doesNotMatch(html,/0\.91%/);
 assert.doesNotMatch(html,/ · 1% · master-match/);
});

test('qualified Worker plan and draft population reconcile one-for-one; drift is held',async()=>{
 const basisId='a'.repeat(64),sourceId='SOURCE',readOffsets=[],writeEvents=[];
 const rows=Array.from({length:51},(_,i)=>{
   const p={proposalId:'master-'+i,ranking:1,value:i+31.25,
     unit:'kg',qualified:true,score:0.97};
   return {sourceId,occurrenceId:'o-'+i,componentType:'VALV',nodeName:'VGT-100',
     sourceKg:null,match1Kg:null,finalKg:null,proposals:[p],
     match1View:{match1Revision:'m',stageDecision:null,proposals:[p]},
     finalView:{finalRevision:'f',stageDecision:null}};
 });
 const approved=rows.map(r=>({occurrenceId:r.occurrenceId,
   proposalId:r.proposals[0].proposalId,value:r.proposals[0].value,
   unit:'kg',qualified:true}));
 const session={receipt:{basisId,sourceId},async readPage({offset,limit,filter,query}){
   readOffsets.push(offset);
   assert.equal(filter,'blank-rigid');assert.equal(query,'');
   return {basisId,offset,totalCount:rows.length,complete:true,
     rows:rows.slice(offset,offset+limit)};
 },review(){writeEvents.push('write')}};
 const saved=new Map([['o-3',{value:'34.25',proposalId:'master-3',reason:'Engineer reviewed',autoFilled:false}]]);
 const planned=await planXml229RigidWeightDrafts(session,{
   minScorePercent:80,qualifiedSuggestions:approved,existingDrafts:saved});
 assert.equal(planned.counts.workerQualified,51);
 assert.equal(planned.counts.workerQualifiedPrepared,50);
 assert.equal(planned.counts.workerQualifiedAlreadyDrafted,1);
 assert.equal(planned.counts.prepared,50);
 assert.equal(planned.firstPreparedIndex,0);
 assert.equal(planned.drafts.get('o-25').value,'56.25');
 assert.equal(saved.get('o-3').value,'34.25');
 assert.deepEqual(readOffsets,[0,25,50]);
 assert.deepEqual(writeEvents,[]);
 const edited=new Map([['o-3',{value:'41',proposalId:'',reason:'Manual engineer edit'}]]);
 await assert.rejects(planXml229RigidWeightDrafts(session,{
   minScorePercent:80,qualifiedSuggestions:approved,existingDrafts:edited,
 }),{code:'SUGGESTION_MANUAL_DRAFT_CONFLICT'});
 assert.equal(planned.finalAcceptedAutomatically,false);
 assert.equal(planned.nativeCiiReleaseAuthorized,false);
 await assert.rejects(planXml229RigidWeightDrafts(session,{
   minScorePercent:80,qualifiedSuggestions:[{...approved[0],value:999}],
 }),{code:'SUGGESTION_WORKER_PLAN_PROPOSAL_DRIFT'});
});
