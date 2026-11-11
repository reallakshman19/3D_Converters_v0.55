// GC-PW/1.0 Weight-owned pre-writer handoff: approved source masses ONLY.
// Does not assign generated children, write CII, or accept ranked proposals.
import { digestCanonical } from '../../contracts/gc-pw-v1/contract.mjs';
import { readVerifiedModeAFinalRows } from './weight-facts-mode-a-final-read.js';

const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
function fail(code,message){const e=new Error(message);e.code=code;e.retryable=false;throw e;}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function reviewRefs(session,read,refs){
  if(!Array.isArray(refs)||!refs.every(x=>typeof x==='string'&&x))
    fail('REVIEW_SNAPSHOT_REFS_REQUIRED','An explicit frozen review snapshot list is required');
  if(new Set(refs).size!==refs.length)
    fail('DUPLICATE_REVIEW_SNAPSHOT','Duplicate snapshot refs cannot enter a CII run');
  if(typeof session.review?.getSnapshot!=='function')
    fail('VERIFIED_SESSION_REQUIRED','The verified source Weight ledger must expose frozen snapshots');
  const offered=new Set(refs),accepted=[];
  for(const sourceId of read.sources){
    for(const stage of ['RigidMatch1','Rigidmatch2']){
      const revision=read.revisionBySource[sourceId][stage==='RigidMatch1'?'match1':'final'];
      if(revision===null)continue;
      const current=session.review.getDecisionState({basisId:read.basisId,scopeId:sourceId,stage});
      const matches=session.review.getSnapshot({basisId:read.basisId,scopeId:sourceId,stage,revision})
        .filter(s=>s.basisId===read.basisId&&s.scopeId===sourceId&&s.stage===stage&&
          s.revision===revision&&canonical(s.decisions)===canonical(current.decisions)&&
          offered.has(s.snapshotRef));
      if(matches.length!==1)
        fail('MISSING_CURRENT_REVIEW_SNAPSHOT','Source '+sourceId+' requires the exact frozen '+stage+' ledger revision');
      offered.delete(matches[0].snapshotRef);
      accepted.push(matches[0].snapshotRef);
    }
  }
  if(offered.size)fail('UNEXPECTED_REVIEW_SNAPSHOT','Unselected or stale review snapshots cannot enter this run');
  return accepted;
}
function sourcePacket(session,refs){
  const read=readVerifiedModeAFinalRows(session);
  const snapshots=reviewRefs(session,read,refs);
  const components=[];
  let acceptedKg=0;
  for(const row of read.rows){
    if(!positive(row.effectiveKg))
      fail('UNRESOLVED_WEIGHT','Writer handoff refuses unresolved original physical component '+row.occurrenceId);
    const authority=positive(row.finalKg)?'Rigidmatch2':
      positive(row.match1Kg)?'RigidMatch1':'source';
    components.push({
      sourceId:row.sourceId,occurrenceId:row.occurrenceId,
      massKg:row.effectiveKg,unit:'kg',authority,
      // Keep independent source and review masses distinguishable.
      sourceKg:row.sourceKg,match1Kg:row.match1Kg,finalKg:row.finalKg,
    });
    acceptedKg+=row.effectiveKg;
  }
  if(!components.length)fail('INCOMPLETE_WEIGHT_RUN','No original physical components to send to Run');
  return {schemaVersion:'gc-pw-weight-run/1.0',basisId:read.basisId,
    sourceIds:read.sources,physicalCount:components.length,
    factCount:read.verifiedFactCount,reviewedSnapshotRefs:snapshots,
    acceptedKg,components};
}
function checkSameSnapshot(session,refs,expected){
  const current=sourcePacket(session,refs);
  if(canonical(current)!==canonical(expected))
    fail('STALE_WEIGHT_RUN_HANDOFF','Original physical facts, source masses, or frozen review revisions changed');
  return current;
}
/** Prepare independent SHA-anchored source-mass inputs for the integrator's writer.
 *  Caller MUST run assertCurrentApprovedWeightRunPacket immediately before Run,
 *  and independently validate actual generated child mass after the CII writer.
 */
export async function prepareApprovedWeightRunPacket(session,{reviewedSnapshotRefs}={}){
  const before=sourcePacket(session,reviewedSnapshotRefs);
  const packetSha256=await digestCanonical(before);
  if(!sha(packetSha256))fail('INVALID_WEIGHT_PACKET_DIGEST','Canonical Weight run source packet SHA256 required');
  checkSameSnapshot(session,reviewedSnapshotRefs,before);
  return {packet:before,packetSha256};
}
/** Prevent stale/tampered captured source mass from being used at CII Run time. */
export async function assertCurrentApprovedWeightRunPacket(session,handoff){
  if(!handoff||!handoff.packet||!sha(handoff.packetSha256))
    fail('INVALID_WEIGHT_RUN_HANDOFF','Frozen Weight run packet and SHA256 required');
  const before=checkSameSnapshot(session,handoff.packet.reviewedSnapshotRefs,handoff.packet);
  const actualSha=await digestCanonical(before);
  if(actualSha!==handoff.packetSha256.toLowerCase())
    fail('WEIGHT_RUN_PACKET_DIGEST_MISMATCH','Captured original source mass packet changed after approval');
  checkSameSnapshot(session,handoff.packet.reviewedSnapshotRefs,before);
  return {valid:true,basisId:before.basisId,packetSha256:actualSha,
    physicalCount:before.physicalCount,reviewedSnapshotRefs:before.reviewedSnapshotRefs};
}
