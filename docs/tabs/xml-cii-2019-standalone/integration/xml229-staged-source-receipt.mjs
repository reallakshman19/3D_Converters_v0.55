/**
 * XML229 P1 source-only receipt contract (isolated integration seam).
 *
 * A real receipt is a small, immutable description of the existing LFJ O1
 * source Worker and R07 durable committed-page store. This module does NOT
 * hash/read/parse original JSON, approve a domain Build, or grant Weight/CII
 * decisions. The trusted caller MUST invoke commit only after store.commit.
 * No product UI is wired to this contract in the contract-only workpack.
 */
export const XML229_STAGED_SOURCE_SCHEMA = 'XML229.OriginalStagedSourceReceipt.v1';
export const XML229_MAX_ORIGINAL_JSON_BYTES = 104857600;
export const XML229_MAX_ORIGINAL_OCCURRENCES = 2000000;

const validId = x => typeof x === 'string' && x.length > 0 && x.length <= 512;
const hexSha256 = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const safeCount = x => Number.isSafeInteger(x) && x >= 0;
const record = value => Object.freeze({
  schema: XML229_STAGED_SOURCE_SCHEMA,
  rightsBasis: 'SOURCE_FACTS_ONLY',
  engineeringReady: false,
  ...value,
});
function reject(code) {
  const error = new Error(code);
  error.code=code;
  throw error;
}
function receiptOrReject(receipt) {
  if (receipt?.schema !== XML229_STAGED_SOURCE_SCHEMA ||
      !validId(receipt.generationId) ||
      !validId(receipt.sourceRefId) ||
      !validId(receipt.sourceRevision) ||
      !safeCount(receipt.byteLength) ||
      receipt.rightsBasis !== 'SOURCE_FACTS_ONLY' ||
      receipt.engineeringReady !== false) reject('XML229_RECEIPT_INVALID');
  return receipt;
}

/**
 * Creates the selectable identity without reading the File or inventing SHA.
 * sourceRevision is the actual generation revision submitted to source Worker.
 */
export function createXml229StagedSourceIntent({
  generationId, sourceRefId, sourceRevision, byteLength,
} = {}) {
  if(!validId(generationId)||!validId(sourceRefId)||!validId(sourceRevision))
    reject('XML229_SOURCE_ID_INVALID');
  if(!safeCount(byteLength)||byteLength===0)reject('XML229_SOURCE_MISSING');
  if(byteLength>XML229_MAX_ORIGINAL_JSON_BYTES)reject('O1_SOURCE_BYTE_LIMIT');
  return record({
    generationId,sourceRefId,sourceRevision,byteLength,
    sha256:null,occurrenceCount:null,pageCount:null,
    phase:'SELECTED', reason:null,
  });
}

/** Advance only the source-index state, never domain or engineering state. */
export function advanceXml229StagedSourceReceipt(prior, event = {}) {
  const current=receiptOrReject(prior);
  const kind=event.kind;
  if (kind==='REVOKE') {
    if(current.phase==='REVOKED')return current;
    return record({...current,phase:'REVOKED',reason:'SOURCE_REPLACED'});
  }
  if(kind==='FAIL') {
    if(current.phase==='REVOKED')return current;
    const reason=validId(event.reason)?event.reason.slice(0,128):'SOURCE_FAILED';
    return record({...current,phase:'FAILED',reason,sha256:null,
      occurrenceCount:null,pageCount:null});
  }
  if(kind==='INDEX_START') {
    if(current.phase!=='SELECTED')reject('XML229_SOURCE_TRANSITION_INVALID');
    return record({...current,phase:'INDEXING'});
  }
  if(kind==='COMMIT_PENDING') {
    if(current.phase!=='INDEXING')reject('XML229_SOURCE_TRANSITION_INVALID');
    return record({...current,phase:'COMMIT_PENDING'});
  }
  if(kind==='INDEX_COMMITTED') {
    if(current.phase!=='COMMIT_PENDING')reject('XML229_SOURCE_TRANSITION_INVALID');
    const summary=event.summary;
    // Must be called only after the existing IndexedDB commit resolves.
    if(event.durableCommitConfirmed!==true)reject('XML229_SOURCE_DURABLE_COMMIT_REQUIRED');
    if(summary?.schema!=='LFJ.JSON.OccurrenceIndexSummary.v1' ||
       summary.complete!==true ||
       summary.rightsBasis!=='SOURCE_FACTS_ONLY' ||
       summary.engineeringReady!==false ||
       summary.sourceRefId!==current.sourceRefId ||
       !hexSha256(summary.sourceSha256) ||
       // R03 derives the authoritative revision after hashing the original
       // Blob: <requested-revision>:sha256:<full-original-sha>. The initial
       // source-intent value is the scan REQUEST revision, not final basis.
       summary.sourceRevision!==current.sourceRevision+':sha256:'+summary.sourceSha256 ||
       summary.byteLength!==current.byteLength ||
       !safeCount(summary.occurrenceCount) ||
       summary.occurrenceCount>XML229_MAX_ORIGINAL_OCCURRENCES ||
       !safeCount(summary.eventCount) ||
       summary.eventCount!==summary.occurrenceCount*2 ||
       !Number.isSafeInteger(event.committedPageCount) ||
       event.committedPageCount<1)
      reject('XML229_SOURCE_COMMIT_INVALID');
    return record({...current,phase:'INDEX_COMMITTED',
      sourceRevision:summary.sourceRevision,sha256:summary.sourceSha256,
      occurrenceCount:summary.occurrenceCount,
      pageCount:event.committedPageCount,reason:null});
  }
  reject('XML229_SOURCE_EVENT_UNSUPPORTED');
}

/** Never use a receipt without independently asserting current generation. */
export function isCurrentXml229StagedSourceReceipt(receipt, {
  generationId, sourceRefId, sourceRevision, sha256, byteLength,
} = {}) {
  try {
    receiptOrReject(receipt);
    return receipt.phase==='INDEX_COMMITTED' && hexSha256(receipt.sha256) &&
      receipt.generationId===generationId &&
      receipt.sourceRefId===sourceRefId &&
      receipt.sourceRevision===sourceRevision &&
      receipt.sha256===sha256 &&
      receipt.byteLength===byteLength;
  } catch {return false;}
}
