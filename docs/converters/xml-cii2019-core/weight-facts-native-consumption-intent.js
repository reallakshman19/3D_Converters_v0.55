/**
 * XML229 R2-B source-side canonical Final-weight consumption intent.
 *
 * No old NodeNumber/issue.key, no guessed mass, no scorer changes.
 * The sha256 commits the COMPLETE original physical population, current
 * source/master InputBasis, both stage CAS revisions, and actual decision
 * values. It is not proof those values were applied to enriched XML/CII.
 */
import {canonicalJson} from '../../contracts/gc-pw-v1/contract.mjs';
import {readVerifiedModeAFinalRows} from './weight-facts-mode-a-final-read.js';

export const NATIVE_FINAL_INTENT_SCHEMA='XML229.NativeFinalPhysicalIntent.v1';
const dig=/^[0-9a-f]{64}$/i;
const sha=async source=>{
 if(!globalThis.crypto?.subtle?.digest)
   throw Object.assign(new Error('SHA-256 is unavailable; no weight intent custody'),
     {code:'FINAL_INTENT_CRYPTO_UNAVAILABLE'});
 const bytes=new TextEncoder().encode(source);
 const array=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(array)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
function denied(code,message){
 const error=new Error(message);error.code=code;error.retryable=false;throw error;
}
function normalizedPopulation(session,{sourceGenerationId,originalJsonSha256,reviewSourceKind,sourceXmlSha256}={}){
 const current=readVerifiedModeAFinalRows(session);
 const xmlOnly=reviewSourceKind==='XML_ONLY'&&originalJsonSha256===null&&
   dig.test(sourceXmlSha256)&&sourceGenerationId==='xml-only:sha256:'+sourceXmlSha256&&
   session.basis.sourceRefs.length===1&&session.basis.sourceRefs[0].sha256===sourceXmlSha256;
 if(!dig.test(current.basisId)||!(xmlOnly||reviewSourceKind!=='XML_ONLY'&&dig.test(originalJsonSha256))||
    !sourceGenerationId||typeof sourceGenerationId!=='string')
   denied('SOURCE_BASIS_REQUIRED','Original JSON Blob generation and approved source/master InputBasis required');
 if(current.sources.length!==1||current.physicalCount!==current.rows.length||
    !Number.isSafeInteger(current.verifiedFactCount)||
    current.verifiedFactCount!==session.openedFacts)
   denied('COMPLETE_FINAL_POPULATION_REQUIRED','Original physical FactRecord population must be complete');
 const rows=current.rows.map(row=>{
   if(typeof row.sourceId!=='string'||!row.sourceId||
      typeof row.occurrenceId!=='string'||!row.occurrenceId||
      !Number.isSafeInteger(row.branchOccurrenceIndex)||
      !Number.isSafeInteger(row.nodeOrdinal))
     denied('ORIGINAL_PHYSICAL_ID_REQUIRED','No legacy or missing original physical identity allowed');
   const effective=row.effectiveKg;
   if(effective!==null&&
      (typeof effective!=='number'||!Number.isFinite(effective)||effective<0))
     denied('INVALID_FINAL_MASS','Effective mass must be a finite nonnegative kg value');
   // A zero is a Final engineering decision, NEVER an unreviewed blank.
   // readVerifiedModeAFinalRows only projects accepted per-owner Final;
   // the GC-PW decision service already requires set-zero-mass confirmation.
   if(effective===0&&
      (row.status!=='Final'||row.finalKg!==0||
       row.sourceKg!==null||row.match1Kg!==null))
     denied('INVALID_FINAL_MASS','Zero kg requires an explicitly accepted blank-source Final');
   return [row.sourceId,row.occurrenceId,row.branchOccurrenceIndex,
     row.nodeOrdinal,row.componentSignature,
     row.sourceKg,row.match1Kg,row.finalKg,effective];
 });
 return {current,rows};
}
export async function commitXml229NativeFinalIntent(session,source){
 const initial=normalizedPopulation(session,source);
 const digestInput=canonicalJson({
   schema:NATIVE_FINAL_INTENT_SCHEMA,
   ...(source.reviewSourceKind==='XML_ONLY'?{reviewSourceKind:'XML_ONLY',sourceXmlSha256:source.sourceXmlSha256}:{}),
   basisId:initial.current.basisId,
   originalJsonSha256:source.originalJsonSha256,
   sourceGenerationId:source.sourceGenerationId,
   revisionBySource:initial.current.revisionBySource,
   verifiedFactCount:initial.current.verifiedFactCount,
   rows:initial.rows,
 });
 const intentSha256=await sha(digestInput);
 // Crypto is async: another review could have updated Match-1 / Final.
 // Reread the *entire* source and both revisions before publishing intent.
 const again=normalizedPopulation(session,source);
 if(canonicalJson(again)!==canonicalJson(initial))
   denied('FINAL_INTENT_CHANGED_DURING_HASH','Source facts or accepted weight decision changed during SHA-256 commitment');
 const sourceCount=initial.current.rows.filter(x=>x.status==='Source').length;
 const match1OnlyCount=initial.current.rows.filter(x=>x.status==='Match-1').length;
 const acceptedFinalCount=initial.current.rows.filter(x=>x.status==='Final').length;
 const unresolvedCount=initial.current.rows.filter(x=>x.status==='Needs review').length;
 const eligibleForEngineBinding=unresolvedCount===0&&match1OnlyCount===0;
 return Object.freeze({
   schema:NATIVE_FINAL_INTENT_SCHEMA,
   ...(source.reviewSourceKind==='XML_ONLY'?{reviewSourceKind:'XML_ONLY',sourceXmlSha256:source.sourceXmlSha256}:{}),
   basisId:initial.current.basisId,
   originalJsonSha256:source.originalJsonSha256,
   sourceGenerationId:source.sourceGenerationId,
   revisionBySource:initial.current.revisionBySource,
   verifiedFactCount:initial.current.verifiedFactCount,
   physicalCount:initial.current.physicalCount,
   sourceAcceptedCount:sourceCount,
   match1OnlyCount,acceptedFinalCount,unresolvedCount,
   intentSha256,
   eligibleForEngineBinding,
   physicalEngineConsumptionVerified:false,
   nativeCiiReleaseAuthorized:false,
   reason:eligibleForEngineBinding
     ?'Full final/source mass intent hashed. Await per-original-physical transfer and independent native CII output consumption.'
     :'Final/source intent contains unresolved or Match-1-only physical weights; explicit Final review is required.',
 });
}
