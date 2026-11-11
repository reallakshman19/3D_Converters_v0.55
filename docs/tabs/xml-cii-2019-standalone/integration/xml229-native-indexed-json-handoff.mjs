/** Narrow native-only handoff of the original O1 Blob already used to build
 * the current independently verified GC-PW Worker. Never authorize release.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
export async function attestXml229IndexedJsonForNative({
 originalBlob,sourceReceipt,workerReceipt,packet,confirmPacket,isCurrent,
}={}){
 if(typeof isCurrent!=='function'||!isCurrent()||
    !(originalBlob instanceof Blob)||typeof confirmPacket!=='function'||
    sourceReceipt?.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
    sourceReceipt.phase!=='INDEX_COMMITTED'||
    sourceReceipt.rightsBasis!=='SOURCE_FACTS_ONLY'||
    originalBlob.size!==sourceReceipt.byteLength||
    !hex(sourceReceipt.sha256)||!hex(workerReceipt?.basisId)||
    !hex(packet?.finalIntentSha256))
   fail('NATIVE_INDEXED_JSON_ORIGINAL_CUSTODY_REQUIRED');
 if(workerReceipt?.originalJsonSha256!==sourceReceipt.sha256||
    packet?.schema!=='XML229.NativeFinalPhysicalPacket.v1'||
    packet.originalJsonSha256!==sourceReceipt.sha256||
    packet.basisId!==workerReceipt.basisId||
    packet.sourceGenerationId!==sourceReceipt.generationId||
    packet.sourceGenerationId!==workerReceipt.sourceGenerationId||
    packet.sourceId!==workerReceipt.sourceId||
    !Number.isSafeInteger(packet.physicalCount)||packet.physicalCount<1||
    packet.nativeCiiReleaseAuthorized!==false)
   fail('NATIVE_INDEXED_JSON_PACKET_BASIS_DRIFT');
 // Fresh Worker packet rejects unresolved Final masses and stale Final intent.
 const current=await confirmPacket();
 if(!isCurrent()||current?.basisId!==packet.basisId||
    current?.sourceGenerationId!==packet.sourceGenerationId||
    current?.originalJsonSha256!==packet.originalJsonSha256||
    current?.sourceXmlSha256!==packet.sourceXmlSha256||
    current?.finalIntentSha256!==packet.finalIntentSha256||
    current?.physicalCount!==packet.physicalCount)
   fail('NATIVE_INDEXED_JSON_FINAL_PACKET_CHANGED');
 const sourceText=await originalBlob.text();
 if(!isCurrent()||!sourceText||await digestUtf8(sourceText)!==sourceReceipt.sha256)
   fail('NATIVE_INDEXED_JSON_SHA_DRIFT');
 if(!isCurrent())fail('NATIVE_INDEXED_JSON_SOURCE_CHANGED');
 return Object.freeze({file:originalBlob,sha256:sourceReceipt.sha256,
   basisId:packet.basisId,sourceGenerationId:packet.sourceGenerationId});
}
