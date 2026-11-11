/**
 * G1 candidate: read-only InputBasis/live Worker lease attestation.
 * Run INSIDE the independent source-custody Worker. No scoring, decisions,
 * native qualification, or release authority. Never trust bare SHA-shaped IDs.
 */
import {assertBasisDigest} from '../gc-pw-v1/contract.mjs';
import {attestLiveBasis} from '../gc-pw-v1/occurrence-bridge.mjs';
export const G1_LEASE_SCHEMA='XML229.G1.LiveEvidenceLease.v1';
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x);
const str=x=>typeof x==='string'&&x.trim().length>0;
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=['source','match1','final','unresolved'];
export class Xml229G1LeaseError extends Error {
  constructor(code){super(code);this.name='Xml229G1LeaseError';this.code=code;}
}
const ensure=(ok,code)=>{if(!ok)throw new Xml229G1LeaseError(code);};
function receipts(basis,receipt,session,proof) {
  ensure(obj(basis)&&Array.isArray(basis.sourceRefs)&&
    basis.sourceRefs.length===1&&str(basis.sourceRefs[0]?.sourceId),
  'SINGLE_ORIGINAL_SOURCE_REQUIRED');
  ensure(obj(receipt)&&receipt.schema==='XML229.OriginalStagedSourceReceipt.v1'&&
    sha(receipt.sha256)&&str(receipt.generationId)&&receipt.phase==='INDEX_COMMITTED',
  'CURRENT_ORIGINAL_RECEIPT_REQUIRED');
  ensure(sha(basis.stagedSourceSha256)&&basis.stagedSourceSha256===receipt.sha256,
    'STAGED_JSON_BASIS_DRIFT');
  ensure(obj(session)&&sha(session.basisId)&&str(session.sourceId)&&
    sha(session.originalJsonSha256)&&str(session.sourceGenerationId)&&
    whole(session.physicalCount),'INVALID_SESSION_RECEIPT');
  ensure(obj(proof)&&proof.schema==='XML229.P4.RunAdvisory.v1'&&
    proof.engineeringFactsVerified===true&&
    proof.previewStatus==='FULL_SOURCE_FACTS_VERIFIED'&&
    proof.ciiReleaseAuthorized===false&&
    proof.nativeCiiReleaseAuthorized!==true&&
    proof.nativeQualificationAuthorized!==true&&
    proof.reviewDecisionsAuthorized!==true&&obj(proof.counts)&&
    keys.every(k=>whole(proof.counts[k]))&&whole(proof.verifiedPhysicalCount)&&
    whole(proof.verifiedFactCount),'UNVERIFIED_ENGINEERING_COMPLETION');
  const sourceId=basis.sourceRefs[0].sourceId;
  ensure(session.basisId===basis.basisId&&proof.basisId===basis.basisId&&
    session.sourceId===sourceId&&proof.sourceId===sourceId,
    'CROSS_BASIS_OR_SOURCE_PROOF');
  ensure(session.originalJsonSha256===receipt.sha256&&
    proof.originalJsonSha256===receipt.sha256&&
    session.sourceGenerationId===receipt.generationId&&
    proof.sourceGenerationId===receipt.generationId,
    'SOURCE_GENERATION_OR_SHA_DRIFT');
  ensure(proof.verifiedPhysicalCount===session.physicalCount&&
    proof.verifiedFactCount===session.physicalCount*7&&
    keys.reduce((n,k)=>n+proof.counts[k],0)===session.physicalCount,
    'PHYSICAL_FACT_OR_MASS_CENSUS_DRIFT');
  return sourceId;
}
function checkLease(current,basisId,generation,sourceId,requestId){
  ensure(obj(current)&&current.basisId===basisId&&
    current.sourceGenerationId===generation&&current.sourceId===sourceId&&
    current.requestId===requestId&&current.closed===false,'LEASE_SUPERSEDED_OR_CLOSED');
}
/**
 * Attests actual live bytes against GC-PW InputBasis and rejects late results.
 * The caller must be the currently trusted source Worker. This function
 * cannot independently authenticate a malicious caller or its provenance.
 */
export async function attestXml229G1LiveLease({
  basis,sourceReceipt,sessionReceipt,completion,live,readCurrentLease,requestId,
}={}){
  ensure(typeof readCurrentLease==='function','CURRENT_LEASE_PORT_REQUIRED');
  ensure(str(requestId),'CURRENT_REQUEST_ID_REQUIRED');
  const sourceId=receipts(basis,sourceReceipt,sessionReceipt,completion);
  ensure(obj(live)&&obj(live.sources)&&obj(live.masters)&&
    Array.isArray(live.selection),'LIVE_BYTES_REQUIRED');
  checkLease(readCurrentLease(),basis.basisId,sourceReceipt.generationId,sourceId,requestId);
  await assertBasisDigest(basis);
  await attestLiveBasis({basis,sources:live.sources,masters:live.masters,
    selection:live.selection,stagedSource:live.stagedSource,
    config:live.config,overrides:live.overrides});
  checkLease(readCurrentLease(),basis.basisId,sourceReceipt.generationId,sourceId,requestId);
  return Object.freeze({schema:G1_LEASE_SCHEMA,basisId:basis.basisId,sourceId,requestId,
    originalJsonSha256:sourceReceipt.sha256,
    sourceGenerationId:sourceReceipt.generationId,
    verifiedPhysicalCount:sessionReceipt.physicalCount,
    verifiedFactCount:completion.verifiedFactCount,
    counts:Object.freeze(Object.fromEntries(keys.map(k=>[k,completion.counts[k]]))),
    byteCustodyAttested:true,reviewDecisionsAuthorized:false,
    nativeQualificationAuthorized:false,nativeCiiReleaseAuthorized:false});
}
