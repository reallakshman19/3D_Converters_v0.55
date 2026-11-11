/**
 * XML229 explicit OWNER-LOCAL review backup/restore.
 * Uses only the portable, attested GC-PW exportReviewState/restoreReviewState
 * service. No alternate decision writer or native CII output authority.
 * SHA-256 is a corruption digest, NOT an authentication signature:
 * import files must remain Owner-controlled and exact-source bound.
 */
import {projectXml229WeightDecisionProvenance}
 from './xml229-weight-decision-provenance.mjs';
const SCHEMA='XML229.SourceBoundGC-PWReviewBackup.v1';
const fail=(code,detail)=>{const e=new Error(detail||code);e.code=code;throw e;};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x);
const xmlOnly=p=>p?.reviewSourceKind==='XML_ONLY'&&p.originalJsonSha256===null&&
 sha(p.sourceXmlSha256)&&p.sourceGenerationId==='xml-only:sha256:'+p.sourceXmlSha256;
const count=x=>Number.isSafeInteger(x)&&x>=0;
const validCounts=c=>obj(c)&&['source','match1','final','unresolved']
  .every(k=>count(c[k]));
const checkProof=(proof,basisId,sourceId)=>{
 if(!obj(proof)||proof.basisId!==basisId||proof.sourceId!==sourceId||
  proof.engineeringFactsVerified!==true||proof.ciiReleaseAuthorized!==false||
  (!sha(proof.originalJsonSha256)&&!xmlOnly(proof))||
  typeof proof.sourceGenerationId!=='string'||!proof.sourceGenerationId||
  !count(proof.verifiedPhysicalCount)||proof.verifiedPhysicalCount<1||
  proof.verifiedFactCount!==proof.verifiedPhysicalCount*7||
  !validCounts(proof.counts)||
  proof.counts.source+proof.counts.match1+proof.counts.final+
  proof.counts.unresolved!==proof.verifiedPhysicalCount)
   fail('REVIEW_BACKUP_PROOF_REQUIRED',
      'Current verified original source and full GC-PW completion required');
};
/** Worker owns this result until the Owner explicitly downloads the file. */
export async function exportXml229SourceBoundReviewBackup(review,{
 basisId,sourceId,proof,
}={}){
 checkProof(proof,basisId,sourceId);
 if(typeof review?.exportReviewState!=='function')
  fail('GC_PW_REVIEW_EXPORT_REQUIRED');
 const reviewState=await review.exportReviewState({basisId});
 if(reviewState?.basisId!==basisId||!sha(reviewState.contentSha256))
  fail('GC_PW_REVIEW_DIGEST_REQUIRED');
 return {
  schema:SCHEMA,basisId,sourceId,
  originalJsonSha256:proof.originalJsonSha256,
  ...(xmlOnly(proof)?{reviewSourceKind:'XML_ONLY',sourceXmlSha256:proof.sourceXmlSha256}:{}),
  captureSourceGenerationId:proof.sourceGenerationId,
  physicalCount:proof.verifiedPhysicalCount,
  factCount:proof.verifiedFactCount,
  counts:{...proof.counts},
  stageRevisions:proof.stageRevisions||null,
  reviewState,
  nativeCiiReleaseAuthorized:false,
  warning:'Local Owner-controlled backup includes private accepted command reasons and occurrence identities. SHA256 checks integrity, not authorship. Reimport only on an independently verified exact InputBasis. Native CII Run HELD. Prior-session bulk click confirmation is not independently certified by a restored ledger.',
 };
}
/** Fail fast before calling portable GC-PW restore. Never merge a file into live decisions. */
export async function restoreXml229SourceBoundReviewBackup(review,backup,{
 basisId,sourceId,proof,
}={}){
 checkProof(proof,basisId,sourceId);
 if(!obj(backup)||backup.schema!==SCHEMA)
  fail('REVIEW_BACKUP_SCHEMA_INVALID','Expected original-source GC-PW review backup schema');
 if(backup.basisId!==basisId||backup.sourceId!==sourceId||
   backup.originalJsonSha256!==proof.originalJsonSha256||
   (!sha(backup.originalJsonSha256)&&!(xmlOnly(proof)&&
     backup.reviewSourceKind==='XML_ONLY'&&backup.sourceXmlSha256===proof.sourceXmlSha256)))
  fail('STALE_REVIEW_BACKUP',
   'Backup is bound to a different verified source, staged JSON or exact InputBasis');
 if(typeof backup.captureSourceGenerationId!=='string'||
   !backup.captureSourceGenerationId||
   backup.nativeCiiReleaseAuthorized!==false)
  fail('REVIEW_BACKUP_CAPTURE_INVALID',
   'Backup must record the original source generation and native Run HELD');
 if(!count(backup.physicalCount)||backup.physicalCount!==proof.verifiedPhysicalCount||
    backup.factCount!==proof.verifiedFactCount)
  fail('REVIEW_BACKUP_POPULATION_DRIFT',
   'Physical occurrence and complete FactRecord census must match current verification');
 if(!validCounts(backup.counts))
  fail('REVIEW_BACKUP_COUNTS_INVALID',
   'Every captured source, Match-1, Final and unresolved count must be bounded');
 // Captured counts represent EFFECTIVE precedence (Final > Match-1 > source).
 // A reviewed Match-1 can supersede one of the immutable original source
 // masses; exact basis and seven fields per physical attest underlying data.
 if(backup.counts.source>proof.counts.source)
  fail('REVIEW_BACKUP_SOURCE_COUNT_DRIFT',
    'A restored overlay cannot invent additional original source masses');
 if(backup.counts.source+backup.counts.match1+backup.counts.final+
    backup.counts.unresolved!==proof.verifiedPhysicalCount)
  fail('REVIEW_BACKUP_SUM_DRIFT',
   'Saved effective source + Match-1 + Final + unresolved census must be exact');
 if(!obj(backup.reviewState)||backup.reviewState.basisId!==basisId||
    !sha(backup.reviewState.contentSha256))
  fail('REVIEW_BACKUP_LEDGER_DRIFT',
   'Attested original-source portable GC-PW ledger and SHA256 required');
 if(typeof review?.restoreReviewState!=='function'||
    typeof review?.getDecisionState!=='function')
   fail('GC_PW_REVIEW_RESTORE_REQUIRED');
 for(const stage of ['RigidMatch1','Rigidmatch2']){
  const state=review.getDecisionState({basisId,scopeId:sourceId,stage});
  if(state.decisionRevision!==null||Object.keys(state.decisions).length)
   fail('REVIEW_BACKUP_LIVE_REVIEW_CONFLICT',
    'Never overwrite or mix a live accepted Match-1 / independent Final review');
 }
 const entries=backup.reviewState.reviewStates;
 if(!Array.isArray(entries)||!Array.isArray(backup.reviewState.frozenSnapshots)||
   entries.length>2||entries.some(e=>!obj(e)||e.scopeId!==sourceId||
    !['RigidMatch1','Rigidmatch2'].includes(e.stage))||
   new Set(entries.map(e=>e.stage)).size!==entries.length)
   fail('REVIEW_BACKUP_STAGE_SCOPE_INVALID');
 const m=entries.find(x=>x.stage==='RigidMatch1')?.decisions||{};
 const f=entries.find(x=>x.stage==='Rigidmatch2')?.decisions||{};
 if(!obj(m)||!obj(f))fail('REVIEW_BACKUP_DECISIONS_INVALID');
 const accepted=x=>new Set(Object.entries(x).filter(([,v])=>v?.state==='accepted')
   .map(([id])=>id));
 const finals=accepted(f),match1=accepted(m);
 const match1Only=[...match1].filter(id=>!finals.has(id)).length;
 if(match1Only!==backup.counts.match1||finals.size!==backup.counts.final)
  fail('REVIEW_BACKUP_DECISION_CENSUS_DRIFT',
    'Saved accepted Match-1 and Final decisions differ from the captured full-population counts');
 // Provenance consistency must be checked BEFORE mutating the current Worker
 // ledger. An imported bulk command cannot regain its prior click evidence.
 const candidateAudit=projectXml229WeightDecisionProvenance({
  reviewState:backup.reviewState,basisId,sourceId,
  completion:{...proof,counts:backup.counts,stageRevisions:backup.stageRevisions},
  confirmedBulkCommandIds:[],
 });
 if(candidateAudit.summary.issues.some(i=>i!=='BULK_CONFIRMATION_NOT_PROVEN'))
  fail('REVIEW_BACKUP_COMMAND_PROVENANCE_DRIFT',
   'Saved source-bound command events or accepted decision census are inconsistent');
 // Portable service validates digest, every source occurrence, proposal value,
 // command provenance and frozen snapshot BEFORE any ledger is published.
 const result=await review.restoreReviewState({
  basisId,payload:backup.reviewState,
 });
 return {basisId,sourceId,restoredStages:result.restoredStages,
  restoredSnapshots:result.restoredSnapshots,match1Only,final:finals.size,
  capturedSourceGenerationId:backup.captureSourceGenerationId,
  currentSourceGenerationId:proof.sourceGenerationId,
  nativeCiiReleaseAuthorized:false,
  priorBulkConfirmationStatus:'not independently proven after reload',
 };
}
