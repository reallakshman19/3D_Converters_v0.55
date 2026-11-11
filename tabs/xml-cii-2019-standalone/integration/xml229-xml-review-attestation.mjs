/** In-memory full XML digest attestation. No persisted flag can replace this check. */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {hasXml229PreviewJsonSource} from '../ui-adapted/xml229-preview-json-source.mjs';
const attestations=new WeakMap();
export function isXml229AttestedXmlReview(input,receipt,proof){
 const saved=proof&&attestations.get(proof);
 const sourceId=input?.modeASourceId||input?.sourceBatch?.activeSourceId;
 return !!saved&&saved.receipt===receipt&&saved.signature===JSON.stringify([receipt,proof])&&saved.text===input?.sourceText&&
   !hasXml229PreviewJsonSource(input)&&(!sourceId||sourceId===receipt.sourceId)&&
   !(input.sourceBatch?.sources?.filter(x=>x.enabled!==false).length>1);
}
export async function attestXml229XmlReview(input,receipt,proof){
 if(hasXml229PreviewJsonSource(input)||!input?.sourceText||
   input.sourceBatch?.sources?.filter(x=>x.enabled!==false).length>1)return false;
 const text=input.sourceText,sha=await digestUtf8(text),c=proof?.counts;
 const sourceId=input.modeASourceId||input.sourceBatch?.activeSourceId;
 const valid=receipt?.reviewSourceKind==='XML_ONLY'&&proof?.schema==='XML229.P4.RunAdvisory.v1'&&
   Number.isSafeInteger(receipt.physicalCount)&&receipt.physicalCount>=0&&
   (!sourceId||sourceId===receipt.sourceId)&&receipt.sourceXmlSha256===sha&&
   proof.sourceXmlSha256===sha&&receipt.sourceGenerationId==='xml-only:sha256:'+sha&&
   proof.sourceGenerationId===receipt.sourceGenerationId&&proof.reviewSourceKind==='XML_ONLY'&&
   proof.originalJsonSha256===null&&receipt.originalJsonSha256===null&&
   proof.basisId===receipt.basisId&&proof.sourceId===receipt.sourceId&&
   proof.engineeringFactsVerified===true&&proof.previewStatus==='FULL_SOURCE_FACTS_VERIFIED'&&
   proof.ciiReleaseAuthorized===false&&proof.verifiedPhysicalCount===receipt.physicalCount&&
   proof.verifiedFactCount===receipt.physicalCount*7&&c&&
   [c.source,c.match1,c.final,c.unresolved].every(n=>Number.isSafeInteger(n)&&n>=0)&&
   c.source+c.match1+c.final+c.unresolved===receipt.physicalCount;
 if(valid)attestations.set(proof,{receipt,text,signature:JSON.stringify([receipt,proof])});
 return !!valid&&isXml229AttestedXmlReview(input,receipt,proof);
}
