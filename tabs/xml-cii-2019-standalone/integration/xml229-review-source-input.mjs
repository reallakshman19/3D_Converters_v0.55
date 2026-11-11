/** Honest optional-JSON identity. XML-only inputs never acquire an O1 JSON receipt. */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function resolveXml229ReviewSourceInput({reviewSourceKind,
  xmlText,sourceXmlSha256,originalStagedBlob:blob,originalStagedSourceReceipt:r}={}){
  if(reviewSourceKind==='XML_ONLY'){
    if(blob!=null||r!=null)fail('XML_ONLY_UNEXPECTED_JSON_INPUT');
    const sha256=await digestUtf8(xmlText);
    if(sha256!==sourceXmlSha256)fail('ORIGINAL_XML_SHA256_DRIFT');
    return {kind:'XML_ONLY',stagedSource:null,xmlSha256:sha256,
      identity:{schema:'XML229.XmlOnlyReviewSource.v1',sha256:null,
        generationId:'xml-only:sha256:'+sha256}};
  }
  if(reviewSourceKind!=null&&reviewSourceKind!=='XML_WITH_JSON')fail('REVIEW_SOURCE_KIND_INVALID');
  if(r?.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
    r.phase!=='INDEX_COMMITTED'||r.rightsBasis!=='SOURCE_FACTS_ONLY'||
    r.engineeringReady!==false||!/^([a-f0-9]{64})$/.test(r.sha256)||
    typeof r.sourceRevision!=='string'||!r.sourceRevision.endsWith(':sha256:'+r.sha256)||
    !r.generationId||!r.sourceRefId||!Number.isSafeInteger(r.occurrenceCount)||
    r.occurrenceCount<1||r.occurrenceCount>2000000||
    !Number.isSafeInteger(r.pageCount)||r.pageCount<1||
    !(blob instanceof Blob)||blob.size!==r.byteLength||blob.size<=0||blob.size>100*1024*1024)
    fail('ORIGINAL_STAGED_BLOB_NOT_ATTESTED');
  const bytes=await blob.arrayBuffer();
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
    b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==r.sha256)fail('ORIGINAL_JSON_SHA256_DRIFT');
  return {kind:'XML_WITH_JSON',identity:r,xmlSha256:await digestUtf8(xmlText),
    stagedSource:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}
