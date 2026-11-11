/** XML229 P3A: fail closed when the indexed JSON File is not a Preview data port.
 * Source-index SHA-256 proves byte custody, NOT availability of source values
 * for the legacy Preview builder. Never hash an empty legacy text as the File.
 */
import {XML229_STAGED_SOURCE_SCHEMA} from './xml229-staged-source-receipt.mjs';

const validSha = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export function xml229PreviewSourceGate({
  sourceReceipt = null, sourceStatus = '', stagedJsonText = '',
} = {}) {
  const hasReceipt = sourceReceipt !== null && sourceReceipt !== undefined;
  // If legacy JSON has a real text payload and there is NO selected Worker
  // source, existing cache calculation remains unchanged.
  if (!hasReceipt && !sourceStatus) return Object.freeze({
    blocked:false,reason:'LEGACY_OR_XML_ONLY',sourceSha256:null,
    sourceBytes:0,
  });
  const recognized = sourceReceipt?.schema === XML229_STAGED_SOURCE_SCHEMA &&
    sourceReceipt?.rightsBasis === 'SOURCE_FACTS_ONLY' &&
    sourceReceipt?.engineeringReady === false;
  const committed = recognized && sourceReceipt.phase === 'INDEX_COMMITTED' &&
    validSha(sourceReceipt.sha256) &&
    Number.isSafeInteger(sourceReceipt.byteLength) && sourceReceipt.byteLength > 0;
  const phase= recognized ? String(sourceReceipt.phase) :
    sourceStatus === 'FAILED' ? 'FAILED' : 'SOURCE_UNVERIFIED';
  const reason = committed ? 'ORIGINAL_JSON_INDEXED_NO_PREVIEW_READ_PORT' :
    phase === 'REVOKED' ? 'ORIGINAL_JSON_SOURCE_REVOKED' :
    phase === 'FAILED' ? 'ORIGINAL_JSON_SOURCE_FAILED' :
    'ORIGINAL_JSON_SOURCE_PENDING';
  // Even if a previous legacy JSON text remains in state, it was not proven
  // to match this selected Worker File. Refuse rather than using stale text.
  return Object.freeze({
    blocked:true,reason,phase,
    sourceSha256:committed?sourceReceipt.sha256:null,
    sourceBytes:recognized&&Number.isSafeInteger(sourceReceipt.byteLength)
      ?sourceReceipt.byteLength:0,
    hasUnverifiedLegacyText:Boolean(stagedJsonText),
  });
}
