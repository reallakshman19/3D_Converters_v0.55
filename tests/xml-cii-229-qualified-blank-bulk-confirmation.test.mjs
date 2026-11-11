import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createWeightReviewService,WEIGHT_SCHEMA}
 from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import {legacyXmlCiiWeightFacts}
 from '../converters/xml-cii2019-core/weight-facts-xml-cii-adapter.js';
import {planXml229QualifiedBlankFill,commitXml229QualifiedBlankFill}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-source-weight-bulk-review.mjs';
import {projectXml229WeightDecisionProvenance}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-weight-decision-provenance.mjs';
import {exportXml229SourceBoundReviewBackup,restoreXml229SourceBoundReviewBackup}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-source-weight-review-transfer.mjs';

const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const basis={
 schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',
 basisId:hash('xml229-original-bulk-real-service'),
 sourceRefs:[{sourceId:'one',sha256:hash('one'),mediaType:'application/xml'}],
 selectionSha256:hash('full-original-source'),stagedSourceSha256:hash('original-json'),
 masters:{weight:{datasetId:'weight-master',revision:'1',sha256:hash('weight-master'),
  mappingSha256:hash('master-mapping'),rowCount:1595}},
 configSha256:hash('config'),overridesSha256:hash('no-overrides'),
 scope:[{sourceId:'one',selectionRef:'all'}],
};
const physical=i=>({
 key:'BR::'+i,branchName:'BR',nodeNumber:String(i),branchOccurrenceIndex:i,
 nodeOrdinal:0,boreMm:100,rating:'150',lengthMm:100,
 nodeName:'VGT-'+i,componentType:'VALV',dtxr:'GATE',
 originalWeight:i===0?59:null,
});
const id=i=>'one/branch:'+i+'/physical:0';
function harness(count=112,{reviewed=true,sourceMass=true}={}){
 const facts=Array.from({length:count},(_,i)=>legacyXmlCiiWeightFacts(
  [{...physical(i),originalWeight:sourceMass&&i===0?59:null}],basis,'one')).flat();
 const score=(rows,b)=>{
  const oid=rows[0].occurrenceId;
  const proposals=[{basisId:b.basisId,domainId:b.domainId,occurrenceId:oid,
   proposalId:oid+'/master-exact',unit:'kg',value:15,method:'exact-master',
   ranking:1,qualified:oid!==id(4),scoringRevision:'oracle-exact-v1',
   eligibilityReasons:['bore-rating-length'],evidenceRefs:[b.masters.weight.sha256]}];
  if(oid===id(5))proposals.push({...proposals[0],ranking:2,value:19,
    proposalId:oid+'/competing-qualified',qualified:true});
  return proposals;
 };
 const service=createWeightReviewService({score,
  digestReview:async data=>hash(JSON.stringify(data)),
 });
 service.openBasis(basis,{facts});
 const projection={proposals:ids=>{
  const found=new Map(ids.map(i=>[i,[]]));
  for(let cursor=null,loops=0;;loops++){
   assert(loops<15,'proposal pagination must terminate');
   const page=service.getProposals({basisId:basis.basisId,occurrenceIds:ids,
    cursor,limit:200});
   assert(page.complete,'partial proposal page cannot be accepted');
   for(const row of page.items)found.get(row.occurrenceId).push(row);
   if(page.nextCursor==null)break;
   cursor=page.nextCursor;
  }
  return found;
 }};
 if(reviewed){
 const manual=service.applyDecisions({basisId:basis.basisId,scopeId:'one',
  stage:'RigidMatch1',commands:[{
   commandId:'explicit-manual-one',basisId:basis.basisId,scopeId:'one',
   occurrenceId:id(1),expectedDecisionRevision:null,action:'enter-manual',
   value:20,unit:'kg',reason:'Engineer separately reviewed original physical #1',
  }]})[0];
 assert.equal(manual.state,'accepted');
 assert.equal(service.getDecisionState({basisId:basis.basisId,scopeId:'one',
  stage:'RigidMatch1'}).decisions[id(1)].value,20);
 const final=service.applyDecisions({basisId:basis.basisId,scopeId:'one',
  stage:'Rigidmatch2',commands:[{
   commandId:'explicit-final-two',basisId:basis.basisId,scopeId:'one',
   occurrenceId:id(2),expectedDecisionRevision:null,action:'final-override',
   value:22,unit:'kg',reason:'Independent Final Match-2 reviewed mass',
  }]})[0];
 assert.equal(final.state,'accepted');
 assert.equal(service.getDecisionState({basisId:basis.basisId,scopeId:'one',
  stage:'Rigidmatch2'}).decisions[id(2)].value,22);
 }
 return {service,projection};
}
const plan=(h,sequence=1)=>planXml229QualifiedBlankFill(
 h.service,h.projection,{basisId:basis.basisId,sourceId:'one',sequence});
const confirm=(h,pending,planId=pending?.planId)=>commitXml229QualifiedBlankFill(
 h.service,{basisId:basis.basisId,sourceId:'one',pending,planId});
const decisions=(h,stage)=>h.service.getDecisionState({
 basisId:basis.basisId,scopeId:'one',stage}).decisions;

test('Worker guarded source bulk: qualified off-page blanks commit only AFTER explicit planId; source and Final are untouched',()=>{
 const h=harness(),start=decisions(h,'RigidMatch1');
 assert.equal(Object.keys(start).length,1);
 const beforeFinal=structuredClone(decisions(h,'Rigidmatch2'));
 const prepared=plan(h,1);
 assert.equal(prepared.summary.physicalCount,112);
 assert.equal(prepared.summary.preservedSourceWeights,1);
 assert.equal(prepared.summary.alreadyReviewed,1);
 assert.equal(prepared.summary.excludedFinal,1);
 assert.equal(prepared.summary.ambiguousQualified,1);
 assert.equal(prepared.summary.unresolved,1);
 assert.equal(prepared.summary.qualified,107);
 assert.deepEqual(prepared.summary.exclusions,{
   sourceMassPresent:1,match1DecisionPresent:1,noRank1Proposal:0,
   topRankUnqualified:1,topRankInvalidMass:0,topRankInvalidUnit:0,
   lowerRankQualified:0,finalDecisionPresent:1,
   conflictingQualifiedCandidates:1,planProjectionMismatch:0,excludedByScope:0,
   readyForConfirmation:107,
 });
 assert.equal(prepared.summary.reviewStage,'RigidMatch1');
 assert.equal(prepared.summary.finalAcceptedAutomatically,false);
 assert.equal(Object.keys(decisions(h,'RigidMatch1')).length,1,
  'planning and showing a proposal cannot write any decision');
 assert.throws(()=>confirm(h,prepared.pending,'forged-plan-id'),e=>
  e.code==='BULK_PLAN_STALE');
 const committed=confirm(h,prepared.pending);
 assert.deepEqual(committed,{
  basisId:basis.basisId,acceptedCount:107,
  stage:'RigidMatch1',finalAcceptedAutomatically:false,
 });
 const all=decisions(h,'RigidMatch1');
 assert.equal(Object.keys(all).length,108);
 assert.equal(all[id(1)].value,20,'existing Match-1 preserved');
 for(const excluded of [0,2,4,5])assert.equal(all[id(excluded)],undefined,
  'source/Final/unqualified/ambiguous physical not bulk-filled: '+excluded);
 assert.equal(all[id(6)].value,15);
 assert.equal(all[id(111)].value,15,
  'qualified physical outside first visible 25 rows included');
 assert.deepEqual(decisions(h,'Rigidmatch2'),beforeFinal);
 assert.equal(plan(h,2).summary.qualified,0,'reviewed blanks never refilled');
});
test('stale Final revision fails the bulk confirmation with no Match-1 mutation',()=>{
 const h=harness(14),prepared=plan(h),before=structuredClone(decisions(h,'RigidMatch1'));
 h.service.applyDecisions({basisId:basis.basisId,scopeId:'one',
  stage:'Rigidmatch2',expectedDecisionRevision:'f1',commands:[{
   commandId:'separate-final-three',basisId:basis.basisId,scopeId:'one',
   occurrenceId:id(3),expectedDecisionRevision:'f1',action:'final-override',
   value:24,unit:'kg',reason:'Independent Final action invalidates old bulk plan',
  }]});
 assert.throws(()=>confirm(h,prepared.pending),e=>e.code==='BULK_FINAL_REVIEW_CHANGED');
 assert.deepEqual(decisions(h,'RigidMatch1'),before);
 assert.equal(decisions(h,'Rigidmatch2')[id(3)].value,24);
});
test('stale Match-1 revision refuses bulk without partial writes, replay without pending is rejected',()=>{
 const h=harness(12),prepared=plan(h);
 const beforeFinal=structuredClone(decisions(h,'Rigidmatch2'));
 h.service.applyDecisions({basisId:basis.basisId,scopeId:'one',
  stage:'RigidMatch1',expectedDecisionRevision:'m1',commands:[{
   commandId:'concurrent-human-reviewed-eleven',basisId:basis.basisId,scopeId:'one',
   occurrenceId:id(11),expectedDecisionRevision:'m1',action:'enter-manual',
   value:33,unit:'kg',reason:'New Match-1 human decision after plan',
  }]});
 assert.throws(()=>confirm(h,prepared.pending),e=>e.code==='STALE_DECISION');
 assert.equal(Object.keys(decisions(h,'RigidMatch1')).length,2,
  'no bulk acceptance after CAS conflict');
 assert.deepEqual(decisions(h,'Rigidmatch2'),beforeFinal);
 assert.throws(()=>confirm(h,null,prepared.summary.planId),e=>e.code==='BULK_PLAN_STALE');
});
test('worker sources import the same plan/confirm guards, and served root/docs are identical',async()=>{
 const worker=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',
  import.meta.url),'utf8');
 assert.match(worker,/planXml229QualifiedBlankFill\(review,weightProjection/);
 assert.match(worker,/commitXml229QualifiedBlankFill\(review/);
 assert.match(worker,/const pending=pendingBulk;pendingBulk=null/);
 const path='tabs/xml-cii-2019-standalone/integration/xml229-source-weight-bulk-review.mjs';
 const root=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const docs=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
 assert.equal(root,docs);
});

test('same GC-PW command ledger proves 107 confirmed bulk, one manual Match-1, one independent Final; never proposals',async()=>{
 const h=harness(),prepared=plan(h,1);
 const before=await h.service.exportReviewState({basisId:basis.basisId});
 const beforeProof={basisId:basis.basisId,sourceId:'one',
  originalJsonSha256:basis.stagedSourceSha256,sourceGenerationId:'test-generation',
  verifiedPhysicalCount:112,verifiedFactCount:784,engineeringFactsVerified:true,
  ciiReleaseAuthorized:false,counts:{source:1,match1:1,final:1,unresolved:109}};
 const beforeAudit=projectXml229WeightDecisionProvenance({
  reviewState:before,basisId:basis.basisId,sourceId:'one',completion:beforeProof});
 assert.equal(beforeAudit.summary.manual,1);
 assert.equal(beforeAudit.summary.finalOverride,1);
 assert.equal(beforeAudit.summary.bulkConfirmed,0);
 assert.equal(beforeAudit.summary.auditedAcceptedDecisions,2);
 assert.equal(beforeAudit.summary.provenanceComplete,true);
 confirm(h,prepared.pending);
 const proof={...beforeProof,counts:{source:1,match1:108,final:1,unresolved:2}};
 const reviewState=await h.service.exportReviewState({basisId:basis.basisId});
 const verified=projectXml229WeightDecisionProvenance({
  reviewState,basisId:basis.basisId,sourceId:'one',completion:proof,
  confirmedBulkCommandIds:prepared.pending.plan.commands.map(c=>c.commandId),
 });
 assert.equal(verified.population.physicalCount,112);
 assert.equal(verified.population.factCount,784);
 assert.equal(verified.summary.bulkConfirmed,107);
 assert.equal(verified.summary.manual,1);
 assert.equal(verified.summary.finalOverride,1);
 assert.equal(verified.summary.acceptedMatch1All,108);
 assert.equal(verified.summary.effectiveMatch1Only,108);
 assert.equal(verified.summary.acceptedFinal,1);
 assert.equal(verified.summary.unverified,0);
 assert.equal(verified.summary.provenanceComplete,true);
 assert.equal(verified.rows.length,109);
 assert.equal(verified.rows.find(r=>r.occurrenceId===id(111)).provenanceKind,'bulk-confirmed');
 assert.equal(verified.rows.find(r=>r.occurrenceId===id(1)).kg,20);
 assert.equal(verified.rows.find(r=>r.occurrenceId===id(2)).stage,'Rigidmatch2');
 assert.equal(verified.summary.nativeCiiReleaseAuthorized,false);
 assert(!JSON.stringify(verified).includes('Engineer separately reviewed original physical #1'),
   'no raw engineering reason or original source bytes in exported audit');
});

test('bulk command ledger without same-Worker confirmation remains honestly unproven',async()=>{
 const h=harness(14),p=plan(h);confirm(h,p.pending);
 const proof={basisId:basis.basisId,sourceId:'one',
  originalJsonSha256:basis.stagedSourceSha256,sourceGenerationId:'test-generation',
  verifiedPhysicalCount:14,verifiedFactCount:98,engineeringFactsVerified:true,
  ciiReleaseAuthorized:false,counts:{source:1,match1:10,final:1,unresolved:2}};
 // 14 components: 1 source + 1 manual + 1 Final + 2 excluded
 // unqualified/ambiguous + 9 approved = 14, so Match-1 = 10.
 const envelope=await h.service.exportReviewState({basisId:basis.basisId});
 const audit=projectXml229WeightDecisionProvenance({
  reviewState:envelope,basisId:basis.basisId,sourceId:'one',completion:proof});
 assert.equal(audit.summary.bulkConfirmationUnknown,9);
 assert.equal(audit.summary.bulkConfirmed,0);
 assert.equal(audit.summary.provenanceComplete,false);
 assert(audit.summary.issues.includes('BULK_CONFIRMATION_NOT_PROVEN'));
 assert.equal(audit.summary.nativeCiiReleaseAuthorized,false);
});

test('audit fails closed for stale source, modified receipt and decision/completion census drift',async()=>{
 const h=harness(14),p=plan(h);confirm(h,p.pending);
 const envelope=await h.service.exportReviewState({basisId:basis.basisId});
 const proof={basisId:basis.basisId,sourceId:'one',
  verifiedPhysicalCount:14,verifiedFactCount:98,engineeringFactsVerified:true,
  ciiReleaseAuthorized:false,counts:{source:1,match1:10,final:1,unresolved:2}};
 assert.throws(()=>projectXml229WeightDecisionProvenance({
  reviewState:envelope,basisId:basis.basisId,sourceId:'another',completion:proof,
 }),e=>e.code==='PROVENANCE_SOURCE_PROOF_REQUIRED');
 assert.throws(()=>projectXml229WeightDecisionProvenance({
  reviewState:envelope,basisId:basis.basisId,sourceId:'one',
  completion:{...proof,verifiedFactCount:97},
 }),e=>e.code==='PROVENANCE_SOURCE_PROOF_REQUIRED');
 const drift=projectXml229WeightDecisionProvenance({
  reviewState:envelope,basisId:basis.basisId,sourceId:'one',
  completion:{...proof,counts:{source:0,match1:11,final:1,unresolved:2}},
 });
 assert.equal(drift.summary.provenanceComplete,false);
 assert(drift.summary.issues.includes('COMPLETION_DECISION_CENSUS_MISMATCH'));
});

const proofForBackup=(count,counts,gen='GEN-ORIGINAL')=>({
 basisId:basis.basisId,sourceId:'one',
 originalJsonSha256:basis.stagedSourceSha256,
 sourceGenerationId:gen,
 engineeringFactsVerified:true,ciiReleaseAuthorized:false,
 verifiedPhysicalCount:count,verifiedFactCount:count*7,counts,
 stageRevisions:{one:{match1:'m1',final:'f1'}},
});

test('explicit GC-PW file export → fresh attested basis restore preserves 107 bulk + manual Match-1 + distinct Final',async()=>{
 const old=harness(),prepared=plan(old);confirm(old,prepared.pending);
 const before=proofForBackup(112,{source:1,match1:108,final:1,unresolved:2});
 const backup=await exportXml229SourceBoundReviewBackup(old.service,{
  basisId:basis.basisId,sourceId:'one',proof:before});
 assert.equal(backup.schema,'XML229.SourceBoundGC-PWReviewBackup.v1');
 assert.equal(backup.counts.match1,108);
 assert.equal(backup.captureSourceGenerationId,'GEN-ORIGINAL');
 assert.equal(backup.nativeCiiReleaseAuthorized,false);
 assert.equal(backup.reviewState.schemaVersion,WEIGHT_SCHEMA);
 assert.match(backup.reviewState.contentSha256,/^[0-9a-f]{64}$/);
 const fresh=harness(112,{reviewed:false});
 assert.equal(Object.keys(decisions(fresh,'RigidMatch1')).length,0);
 const current=proofForBackup(112,{source:1,match1:0,final:0,unresolved:111},'GEN-REBUILT');
 const result=await restoreXml229SourceBoundReviewBackup(fresh.service,backup,{
  basisId:basis.basisId,sourceId:'one',proof:current});
 assert.equal(result.match1Only,108);
 assert.equal(result.final,1);
 assert.equal(result.capturedSourceGenerationId,'GEN-ORIGINAL');
 assert.equal(result.currentSourceGenerationId,'GEN-REBUILT');
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 assert.equal(result.priorBulkConfirmationStatus,'not independently proven after reload');
 assert.equal(Object.keys(decisions(fresh,'RigidMatch1')).length,108);
 assert.equal(decisions(fresh,'RigidMatch1')[id(1)].value,20);
 assert.equal(decisions(fresh,'RigidMatch1')[id(111)].value,15);
 assert.equal(decisions(fresh,'Rigidmatch2')[id(2)].value,22);
 const recaptured=await exportXml229SourceBoundReviewBackup(fresh.service,{
  basisId:basis.basisId,sourceId:'one',proof:{...current,
   counts:{source:1,match1:108,final:1,unresolved:2}}});
 assert.deepEqual(recaptured.reviewState,backup.reviewState,
  'exact command ledger, source evidence and Final preserved across restart');
 const audit=projectXml229WeightDecisionProvenance({
  reviewState:recaptured.reviewState,basisId:basis.basisId,sourceId:'one',
  completion:{...current,counts:recaptured.counts}});
 assert.equal(audit.summary.bulkConfirmationUnknown,107,
  'reloaded command ledger is NOT an independent bulk click attestation');
 await assert.rejects(restoreXml229SourceBoundReviewBackup(fresh.service,backup,{
  basisId:basis.basisId,sourceId:'one',proof:current}),
  e=>e.code==='REVIEW_BACKUP_LIVE_REVIEW_CONFLICT');
});

test('GC-PW restore refuses modified file digest, source/master basis, count mismatch and forged accepted ledger',async()=>{
 const reviewed=harness(14),plan1=plan(reviewed);confirm(reviewed,plan1.pending);
 const backup=await exportXml229SourceBoundReviewBackup(reviewed.service,{
  basisId:basis.basisId,sourceId:'one',
  proof:proofForBackup(14,{source:1,match1:10,final:1,unresolved:2})});
 const current=proofForBackup(14,{source:1,match1:0,final:0,unresolved:13},'GEN-NEW');
 const attempt=async file=>restoreXml229SourceBoundReviewBackup(
  harness(14,{reviewed:false}).service,file,{
   basisId:basis.basisId,sourceId:'one',proof:current});
 const corrupted=structuredClone(backup);
 corrupted.reviewState.reviewStates[0].decisions[id(1)].value=777;
 await assert.rejects(attempt(corrupted),e=>e.code==='REVIEW_DIGEST_MISMATCH'||
  e.code==='REVIEW_BACKUP_COMMAND_PROVENANCE_DRIFT');
 const wrongSha=structuredClone(backup);wrongSha.originalJsonSha256='f'.repeat(64);
 await assert.rejects(attempt(wrongSha),e=>e.code==='STALE_REVIEW_BACKUP');
 const wrongBasis=structuredClone(backup);wrongBasis.basisId='f'.repeat(64);
 await assert.rejects(attempt(wrongBasis),e=>e.code==='STALE_REVIEW_BACKUP');
 const wrongPopulation=structuredClone(backup);wrongPopulation.factCount=97;
 await assert.rejects(attempt(wrongPopulation),e=>e.code==='REVIEW_BACKUP_POPULATION_DRIFT');
 const wrongCount=structuredClone(backup);wrongCount.counts.match1=9;
 wrongCount.counts.unresolved=3;
 await assert.rejects(attempt(wrongCount),e=>e.code==='REVIEW_BACKUP_DECISION_CENSUS_DRIFT');
 const forged=structuredClone(backup);
 forged.reviewState.reviewStates[0].decisions[id(1)].value=777;
 forged.reviewState.contentSha256=hash(JSON.stringify((({contentSha256,...rest})=>rest)(
  forged.reviewState)));
 await assert.rejects(attempt(forged),e=>
  e.code==='REVIEW_BACKUP_COMMAND_PROVENANCE_DRIFT');
 const crossSource=structuredClone(backup);crossSource.sourceId='not-this-source';
 await assert.rejects(attempt(crossSource),e=>e.code==='STALE_REVIEW_BACKUP');
});

test('GC-PW review transfer does not add a new decision writer, passes source/docs mirror',async()=>{
 const path='tabs/xml-cii-2019-standalone/integration/xml229-source-weight-review-transfer.mjs';
 const code=await readFile(new URL('../'+path,import.meta.url),'utf8');
 assert.equal(code,await readFile(new URL('../docs/'+path,import.meta.url),'utf8'));
 assert.match(code,/review\.exportReviewState/);
 assert.match(code,/review\.restoreReviewState/);
 assert.match(code,/REVIEW_BACKUP_LIVE_REVIEW_CONFLICT/);
 assert.match(code,/projectXml229WeightDecisionProvenance/);
 const worker=await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',import.meta.url),'utf8');
 assert.match(worker,/req\.what==='review-backup'/);
 assert.match(worker,/req\.kind==='restore-review'/);
 assert.match(worker,/restoringReview=true/);
});

test('real frozen individual Match-1 and Final snapshots restore across independent service restart',async()=>{
 const reviewed=harness(14);
 reviewed.service.freezeSnapshot({basisId:basis.basisId,scopeId:'one',
  stage:'RigidMatch1',expectedDecisionRevision:'m1'});
 reviewed.service.freezeSnapshot({basisId:basis.basisId,scopeId:'one',
  stage:'Rigidmatch2',expectedDecisionRevision:'f1'});
 const counts={source:1,match1:1,final:1,unresolved:11};
 const file=await exportXml229SourceBoundReviewBackup(reviewed.service,{
  basisId:basis.basisId,sourceId:'one',
  proof:proofForBackup(14,counts)});
 assert.equal(file.reviewState.frozenSnapshots.length,2);
 const fresh=harness(14,{reviewed:false});
 const imported=await restoreXml229SourceBoundReviewBackup(fresh.service,file,{
  basisId:basis.basisId,sourceId:'one',
  proof:proofForBackup(14,{source:1,match1:0,final:0,unresolved:13},
    'GEN-NEW')});
 assert.equal(imported.restoredSnapshots,2);
 assert.equal(fresh.service.getSnapshot({basisId:basis.basisId,
  stage:'RigidMatch1',scopeId:'one'}).length,1);
 assert.equal(fresh.service.getSnapshot({basisId:basis.basisId,
  stage:'Rigidmatch2',scopeId:'one'}).length,1);
 assert.equal(decisions(fresh,'RigidMatch1')[id(1)].value,20);
 assert.equal(decisions(fresh,'Rigidmatch2')[id(2)].value,22);
});

test('same source facts can restore explicit Match-1 overlay on an original source mass',async()=>{
 const reviewed=harness(14);
 reviewed.service.applyDecisions({basisId:basis.basisId,scopeId:'one',
  stage:'RigidMatch1',expectedDecisionRevision:'m1',commands:[{
   commandId:'human-reviewed-source-mass-zero',basisId:basis.basisId,scopeId:'one',
   occurrenceId:id(0),expectedDecisionRevision:'m1',action:'enter-manual',
   value:62,unit:'kg',reason:'Engineer explicitly overrides original 59 kg source mass',
  }]});
 const backup=await exportXml229SourceBoundReviewBackup(reviewed.service,{
  basisId:basis.basisId,sourceId:'one',
  proof:proofForBackup(14,{source:0,match1:2,final:1,unresolved:11})});
 const fresh=harness(14,{reviewed:false});
 const result=await restoreXml229SourceBoundReviewBackup(fresh.service,backup,{
  basisId:basis.basisId,sourceId:'one',
  proof:proofForBackup(14,{source:1,match1:0,final:0,unresolved:13},'GEN-REBUILT')});
 assert.equal(result.match1Only,2);
 assert.equal(decisions(fresh,'RigidMatch1')[id(0)].value,62);
 assert.equal(decisions(fresh,'RigidMatch1')[id(1)].value,20);
 assert.equal(decisions(fresh,'Rigidmatch2')[id(2)].value,22);
 assert.equal(backup.counts.source,0);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});

test('Owner-shaped 423 physical / 2961 facts / 125 explicitly accepted Match-1 + 298 unresolved survive exact-basis reload',async()=>{
 const count=423;
 const old=harness(count,{reviewed:false,sourceMass:false});
 const commands=Array.from({length:125},(_,i)=>({
  commandId:'owner-shaped-test-explicit-'+String(i),
  basisId:basis.basisId,scopeId:'one',
  occurrenceId:id(i),expectedDecisionRevision:null,
  action:'enter-manual',value:15+i/10,unit:'kg',
  reason:'Controlled fixture: explicit Match-1 acceptance; NOT an Owner corpus approval',
 }));
 const receipts=old.service.applyDecisions({
  basisId:basis.basisId,scopeId:'one',stage:'RigidMatch1',
  expectedDecisionRevision:null,commands,
 });
 assert.equal(receipts.length,125);
 assert(receipts.every(x=>x.state==='accepted'));
 const proof=proofForBackup(count,{
  source:0,match1:125,final:0,unresolved:298,
 },'GEN-FIRST');
 const backup=await exportXml229SourceBoundReviewBackup(old.service,{
  basisId:basis.basisId,sourceId:'one',proof,
 });
 assert.equal(backup.counts.source,0);
 assert.equal(backup.counts.match1,125);
 assert.equal(backup.counts.final,0);
 assert.equal(backup.counts.unresolved,298);
 assert.equal(backup.factCount,2961);
 assert.equal(backup.nativeCiiReleaseAuthorized,false);
 const fresh=harness(count,{reviewed:false,sourceMass:false});
 const refreshed=proofForBackup(count,{
  source:0,match1:0,final:0,unresolved:423,
 },'GEN-COLD-REBUILT');
 const outcome=await restoreXml229SourceBoundReviewBackup(fresh.service,
  structuredClone(backup),{
   basisId:basis.basisId,sourceId:'one',proof:refreshed,
  });
 assert.equal(outcome.match1Only,125);
 assert.equal(outcome.final,0);
 assert.equal(outcome.nativeCiiReleaseAuthorized,false);
 const savedAgain=await exportXml229SourceBoundReviewBackup(fresh.service,{
  basisId:basis.basisId,sourceId:'one',proof:{
   ...refreshed,counts:backup.counts,
  },
 });
 assert.deepEqual(savedAgain.reviewState,backup.reviewState,
  'source-bound command IDs and review revisions changed across reload');
 assert.equal(Object.keys(decisions(fresh,'RigidMatch1')).length,125);
 assert.equal(Object.keys(decisions(fresh,'Rigidmatch2')).length,0);
 assert.equal(decisions(fresh,'RigidMatch1')[id(124)].value,27.4);
 assert.equal(decisions(fresh,'RigidMatch1')[id(125)],undefined,
  '126th physical must remain unresolved rather than inherited acceptance');
 const audit=projectXml229WeightDecisionProvenance({
  reviewState:savedAgain.reviewState,basisId:basis.basisId,sourceId:'one',
  completion:{...refreshed,counts:savedAgain.counts},
 });
 assert.equal(audit.summary.manual,125);
 assert.equal(audit.summary.acceptedFinal,0);
 assert.equal(audit.summary.bulkConfirmed,0);
 assert.equal(audit.summary.effectiveMatch1Only,125);
 assert.equal(audit.summary.provenanceComplete,true);
 assert.equal(audit.summary.nativeCiiReleaseAuthorized,false);
 assert.equal(audit.population.factCount,2961);
});

test('Worker bulk scope predicate blocks excluded/low-score commands before Match-1 writes',()=>{
 const h=harness(14,{reviewed:false,sourceMass:false});
 const allowed=id(6);
 const planned=planXml229QualifiedBlankFill(h.service,h.projection,{
   basisId:basis.basisId,sourceId:'one',sequence:77,
   candidateEligibility:occurrenceId=>occurrenceId===allowed,
 });
 assert.equal(planned.summary.qualified,1);
 assert.equal(planned.summary.exclusions.excludedByScope,12);
 assert.equal(Object.keys(decisions(h,'RigidMatch1')).length,0);
 const committed=confirm(h,planned.pending);
 assert.equal(committed.acceptedCount,1);
 assert.equal(decisions(h,'RigidMatch1')[allowed].value,15);
 assert.equal(Object.keys(decisions(h,'RigidMatch1')).length,1);
 assert.equal(Object.keys(decisions(h,'Rigidmatch2')).length,0);
});
