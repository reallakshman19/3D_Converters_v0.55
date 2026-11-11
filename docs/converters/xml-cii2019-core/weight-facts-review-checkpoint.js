// GC-PW original-physical Weight review persistence boundary.
// A host-provided transactional CAS store owns durable storage; no browser API,
// Preview worker, legacy issue.key or CII writer is used here.
import { digestCanonical } from '../../contracts/gc-pw-v1/contract.mjs';
import { readVerifiedModeAFinalRows } from './weight-facts-mode-a-final-read.js';

const SHA=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const fail=(code,message)=>{const error=new Error(message);error.code=code;error.retryable=false;throw error;};
const canon=x=>Array.isArray(x)?'['+x.map(canon).join(',')+']':x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}':JSON.stringify(x);

function verifySession(session) {
  if(!session?.review||typeof session.review.exportReviewState!=='function'||
     typeof session.review.restoreReviewState!=='function')
    fail('PERSISTENCE_UNAVAILABLE','Verified Weight service must support immutable review export and restore');
  return readVerifiedModeAFinalRows(session);
}
function sourceCensus(view){
  // Only original source identity and source mass belong in the input fingerprint.
  // Never include accepted Match-1/Final values in the original-fact fingerprint.
  return {basisId:view.basisId,sourceIds:view.sources,
    factCount:view.verifiedFactCount,physicalCount:view.physicalCount,
    originalPhysical:view.rows.map(r=>({sourceId:r.sourceId,occurrenceId:r.occurrenceId,
      sourceKg:r.sourceKg,branchOccurrenceIndex:r.branchOccurrenceIndex,
      nodeOrdinal:r.nodeOrdinal,componentSignature:r.componentSignature}))};
}
const compatibleStore=store=>store&&typeof store.readCheckpoint==='function'&&
  typeof store.compareAndSwapCheckpoint==='function';
const validRevision=rev=>rev===null||(typeof rev==='string'&&rev.length>0);
function storeRecord(value){
  if(value===null||value===undefined)return {revision:null,checkpoint:null};
  if(!value||typeof value!=='object'||!validRevision(value.revision)||!value.revision||
     !value.checkpoint)
    fail('INVALID_CHECKPOINT_STORE_RECORD','Store must return {revision,checkpoint} or null');
  return value;
}
function sameStored(a,b){return canon(a)===canon(b);}

export async function createVerifiedWeightReviewCheckpoint(session){
  const before=verifySession(session);
  const census=sourceCensus(before);
  const sourceCensusSha256=await digestCanonical(census);
  const ledger=await session.review.exportReviewState({basisId:before.basisId});
  if(!ledger||ledger.basisId!==before.basisId||!SHA(ledger.contentSha256))
    fail('INVALID_WEIGHT_REVIEW_EXPORT','Source review export must contain canonical SHA digest');
  const payload={
    schemaVersion:'gc-pw-review-checkpoint/1.0',
    basisId:before.basisId,sourceCensusSha256,
    reviewedSources:before.sources,
    reviewState:ledger,
  };
  const checkpointSha256=await digestCanonical(payload);
  if(!SHA(checkpointSha256))
    fail('INVALID_WEIGHT_CHECKPOINT_SHA','Checkpoint SHA-256 must be canonical');
  const after=verifySession(session);
  if(!sameStored(before,after)||await digestCanonical(sourceCensus(after))!==sourceCensusSha256)
    fail('STALE_WEIGHT_CHECKPOINT','Original physical source or stage decisions changed while exporting review');
  const repeated=await session.review.exportReviewState({basisId:before.basisId});
  if(!sameStored(ledger,repeated))
    fail('STALE_WEIGHT_CHECKPOINT','Accepted review changed after its SHA export');
  return {...payload,checkpointSha256};
}

/** Persist with an explicitly supplied observed storage revision. The host
 * implements real compare-and-swap atomically; this port never pretends a
 * read-then-write is a transaction. No success without verified readback.
 */
export async function persistVerifiedWeightReviewCheckpoint(session,{
  store,expectedStoreRevision=null,
}={}){
  if(!compatibleStore(store)||!validRevision(expectedStoreRevision))
    fail('CHECKPOINT_CAS_REQUIRED','Atomic host storage CAS and expected storage revision required');
  const basisId=verifySession(session).basisId;
  const observed=storeRecord(await store.readCheckpoint({basisId}));
  if(observed.revision!==expectedStoreRevision)
    fail('STALE_STORED_WEIGHT_REVIEW','Storage checkpoint changed since engineer read it');
  const checkpoint=await createVerifiedWeightReviewCheckpoint(session);
  const saved=await store.compareAndSwapCheckpoint({basisId,expectedRevision:expectedStoreRevision,
    checkpoint});
  if(!saved||saved.applied!==true||typeof saved.revision!=='string'||!saved.revision||
     saved.revision===expectedStoreRevision)
    fail('WEIGHT_CHECKPOINT_CAS_FAILED','Atomic review persistence compare-and-swap rejected or failed');
  const readback=storeRecord(await store.readCheckpoint({basisId}));
  if(readback.revision!==saved.revision||!sameStored(readback.checkpoint,checkpoint))
    fail('WEIGHT_CHECKPOINT_READBACK_MISMATCH','Persisted review does not match stored canonical bytes');
  const current=await createVerifiedWeightReviewCheckpoint(session);
  if(!sameStored(current,checkpoint))
    fail('STALE_WEIGHT_CHECKPOINT','Weight decision changed during asynchronous persistence');
  return {basisId,storeRevision:saved.revision,checkpointSha256:checkpoint.checkpointSha256,
    reviewedSources:checkpoint.reviewedSources,checkpoint};
}

/** Restore only after original source population and content basis are reopened.
 * The core ledger verifies command provenance and frozen review snapshots.
 */
export async function restoreVerifiedWeightReviewCheckpoint(session,{
  store,expectedStoreRevision,
}={}){
  if(!store||typeof store.readCheckpoint!=='function'||
     typeof expectedStoreRevision!=='string'||!expectedStoreRevision)
    fail('CHECKPOINT_READ_REQUIRED','Reopen requires explicit host record revision');
  const before=verifySession(session),basisId=before.basisId;
  const record=storeRecord(await store.readCheckpoint({basisId}));
  if(record.revision!==expectedStoreRevision)
    fail('STALE_STORED_WEIGHT_REVIEW','Stored record revision does not match requested restore');
  const cp=record.checkpoint;
  if(!cp||cp.schemaVersion!=='gc-pw-review-checkpoint/1.0'||
     cp.basisId!==basisId||!SHA(cp.sourceCensusSha256)||!SHA(cp.checkpointSha256)||
     !Array.isArray(cp.reviewedSources)||!cp.reviewState||
     cp.reviewState.basisId!==basisId)
    fail('INVALID_WEIGHT_CHECKPOINT','Stored review payload is not the pinned source basis');
  const {checkpointSha256,...payload}=cp;
  if(await digestCanonical(payload)!==checkpointSha256.toLowerCase())
    fail('WEIGHT_CHECKPOINT_DIGEST_MISMATCH','Stored original source review envelope was modified');
  if(await digestCanonical(sourceCensus(before))!==cp.sourceCensusSha256||
     canon(before.sources)!==canon(cp.reviewedSources))
    fail('SOURCE_POPULATION_CHANGED','Original selected physical source census changed since review');
  const latest=storeRecord(await store.readCheckpoint({basisId}));
  if(latest.revision!==record.revision||!sameStored(latest.checkpoint,cp))
    fail('STALE_STORED_WEIGHT_REVIEW','Storage changed during restore preflight');
  const restored=await session.review.restoreReviewState({basisId,payload:cp.reviewState});
  const after=verifySession(session);
  if(await digestCanonical(sourceCensus(after))!==cp.sourceCensusSha256)
    fail('SOURCE_POPULATION_CHANGED','Source facts changed while restoring review');
  const confirmed=await session.review.exportReviewState({basisId});
  if(!sameStored(confirmed,cp.reviewState))
    fail('RESTORED_WEIGHT_REVIEW_MISMATCH','Restored ledger and immutable snapshots do not match saved payload');
  return {basisId,storeRevision:record.revision,checkpointSha256,
    restoredStages:restored.restoredStages,restoredSnapshots:restored.restoredSnapshots};
}
