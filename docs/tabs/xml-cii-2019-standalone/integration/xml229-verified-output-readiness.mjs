/**
 * Read-only XML229 GC-PW -> Output/Run checklist projection.
 * Never creates review decisions or CII Run authority. A source-index receipt,
 * legacy localStorage result, or a DOM-rendered row cannot prove engineering
 * completion. The Worker attests the facts; this verifies the exact live lease.
 */
import {isXml229AttestedXmlReview} from './xml229-xml-review-attestation.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const same=(a,b)=>typeof a==='string'&&a.length>0&&a===b;
// Failures are visible, but cannot carry exception messages, private paths,
// stack traces, or attacker-controlled content into checklist diagnostics.
const safeFailureCode=value=>{
  const code=String(value?.code||'GC_PW_COMPLETION_UNAVAILABLE');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(code)?code:'GC_PW_COMPLETION_UNAVAILABLE';
};
const optional=Object.freeze({
  'support-mapper':Object.freeze({
    label:'Support Type Mapper (separate stage)',
    message:'Not run: independent Support Type Mapper result is absent. Use tab 7 when support mapping is required.',
  }),
  'resolver-json':Object.freeze({
    label:'Resolver / JSON Trace (separate stage)',
    message:'Not run: independent Resolver/JSON Trace result is absent. Staged original JSON is not Trace/CSV approval.',
  }),
  'manual-restraints':Object.freeze({
    label:'Manual restraints (separate stage)',
    message:'Not run: manual restraint sideload/review has not produced a result. Use only when required.',
  }),
});
function originalReceipt(input) {
  const own=input?.xml229StagedSourceReceipt;
  const enabled=input?.sourceBatch?.sources?.filter(x=>x?.enabled!==false);
  // Multi-source proof must never be borrowed from another selected source.
  if(enabled?.length>1)return {governed:!!own||enabled.some(x=>
    x?.xml229StagedSourceReceipt||x?.workflow?.xml229StagedSourceReceipt),receipt:null};
  const selected=enabled?.[0];
  const selectedReceipt=selected?.xml229StagedSourceReceipt||
    selected?.workflow?.xml229StagedSourceReceipt;
  if(own&&selectedReceipt&&
     (!same(own.sha256,selectedReceipt.sha256)||
      !same(own.generationId,selectedReceipt.generationId)))
    return {governed:true,receipt:null};
  return {governed:!!(own||selectedReceipt),receipt:own||selectedReceipt||null,
    sourceId:selected?.sourceId||input?.modeASourceId||input?.sourceBatch?.activeSourceId||''};
}
export function isXml229VerifiedCompletionForInput(input,sessionReceipt,proof) {
  if(sessionReceipt?.reviewSourceKind==='XML_ONLY')
    return isXml229AttestedXmlReview(input,sessionReceipt,proof);
  const scope=originalReceipt(input);
  if(!scope.governed||!scope.receipt||
     scope.receipt.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
     proof?.schema!=='XML229.P4.RunAdvisory.v1'||
     !object(sessionReceipt)||!object(proof)||!object(proof.counts))return false;
  const receipt=scope.receipt,c=proof.counts;
  if(!same(receipt.sha256,proof.originalJsonSha256)||
     !same(receipt.generationId,proof.sourceGenerationId)||
     !same(sessionReceipt.basisId,proof.basisId)||
     !same(sessionReceipt.sourceId,proof.sourceId)||
     !same(sessionReceipt.originalJsonSha256,receipt.sha256)||
     !same(sessionReceipt.sourceGenerationId,receipt.generationId)||
     (scope.sourceId&&scope.sourceId!==proof.sourceId)||
     !whole(sessionReceipt.physicalCount)||
     proof.verifiedPhysicalCount!==sessionReceipt.physicalCount||
     !whole(proof.verifiedFactCount)||
     proof.verifiedFactCount!==proof.verifiedPhysicalCount*7||
     ![c.source,c.match1,c.final,c.unresolved].every(whole)||
     c.source+c.match1+c.final+c.unresolved!==proof.verifiedPhysicalCount||
     proof.engineeringFactsVerified!==true||
     proof.previewStatus!=='FULL_SOURCE_FACTS_VERIFIED'||
     proof.ciiReleaseAuthorized!==false)return false;
  return true;
}
function rowUpdated(row,patch){return {...row,...patch};}
/**
 * Only the verified, matching Worker can change Preview/Weight to ready.
 * Independent optional stages may be described as not-run, never as ready.
 * Rebuild the canonical report from these rows (including summary/logs).
 */
export function projectXml229RunChecklist(input,rows,verifiedEngineering=null) {
  const scope=originalReceipt(input);
  if(!scope.governed&&verifiedEngineering?.sessionReceipt?.reviewSourceKind!=='XML_ONLY')return {rows,verified:false};
  const verified=isXml229VerifiedCompletionForInput(
    input,verifiedEngineering?.sessionReceipt,verifiedEngineering?.proof);
  const proof=verified?verifiedEngineering.proof:null;
  const failure=!verified&&verifiedEngineering?.readError
    ?safeFailureCode(verifiedEngineering.readError):null;
  const c=proof?.counts;
  const reviewed=!!c&&c.unresolved===0&&c.match1===0;
  return {verified,rows:rows.map(row=>{
    if(row.id==='preview-audit'){
      if(!proof)return rowUpdated(row,{
        status:failure?'held':'missing',severity:'warning',blocking:false,
        message:failure
          ? 'Original engineering verification could not be read ['+failure+
            ']. No Preview/Weight evidence accepted. Open 4 Preview → Build Preview to reverify the current source and masters.'
          : 'Original engineering 4 Preview is not verified for the current source and masters. Open 4 Preview → Build Preview.',
      });
      return rowUpdated(row,{
        label:'Original Preview engineering facts',status:'ready',severity:'ok',blocking:false,
        message:'Verified current 4 Preview: '+proof.verifiedPhysicalCount+
          ' original physical components; '+proof.verifiedFactCount+
          ' complete source-bound FactRecords. Independent Diagnostics/Matched Audit not implied.',
      });
    }
    if(row.id==='weight-match'){
      if(!proof)return rowUpdated(row,{
        status:failure?'held':'missing',severity:'warning',blocking:false,
        message:failure
          ? 'Current GC-PW Weight/Final verification is HELD ['+failure+
            ']. Review is not accepted; reverify 4 Preview, then inspect 6 Weight Match.'
          : 'Current GC-PW source/Final review is not verified. Open 6 Weight Match to select a positive Applied Weight for the verified Worker.',
      });
      return rowUpdated(row,{
        label:'Weight Match / Final review (GC-PW)',
        status:reviewed?'ready':'pending',severity:reviewed?'ok':'warning',blocking:false,
        message:'Verified GC-PW: '+c.final+' Final, '+c.match1+' Match-1 only, '+
          c.source+' original source masses, '+c.unresolved+
          ' unresolved. Selected positive Applied Weight records Worker Final; native CII output consumption still requires independent verification.',
      });
    }
    const independent=optional[row.id];
    if(independent&&row.status==='missing'&&!row.blocking)
      return rowUpdated(row,{...independent,status:'not-run',severity:'warning',blocking:false});
    return row;
  })};
}
