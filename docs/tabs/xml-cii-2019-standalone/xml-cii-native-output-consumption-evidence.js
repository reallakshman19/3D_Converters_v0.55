/**
 * XML229 R2-A — evidence of the ACTUAL job passed from XML parity into the
 * native CII engine and the returned CII payload. SHA-256 over UTF-8 bytes.
 *
 * This is an engine-boundary WITNESS, not physical per-occurrence Final
 * weight consumption proof. In particular:
 *   - matching source/input/output digests does not prove canonical
 *     original physical occurrences survived enrichment;
 *   - no binding from GC-PW Final Match-2 was admitted or reconciled here;
 *   - no native CII release is authorized by this record, even if the
 *     native engine returns ok=true.
 */
import {digestXmlCiiParityText} from './xml-cii-run-parity-evidence.js';
export const XML229_NATIVE_EVIDENCE_SCHEMA='XML229.NativeCiiEngineBoundary.v1';
const enc=new TextEncoder();
const sha256=async value=>{
 const bytes=enc.encode(String(value??''));
 const cryptoObject=globalThis.crypto;
 if(!cryptoObject?.subtle?.digest)
   throw new Error('SHA-256 browser crypto unavailable: refuse native engine evidence');
 const hash=await cryptoObject.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const hasText=s=>typeof s==='string'&&s.trim().length>0;
export async function observeXml229NativeEngineBoundary({
 originalSourceText,parityXmlText,parityEvidence,
 engineJob,engineResult,
}={}){
 const original=String(originalSourceText??'');
 const parity=String(parityXmlText??'');
 const engineInput=String(engineJob?.sourceText??'');
 const textOut=String(engineResult?.ciiText??'');
 const currentInputParity=parityEvidence?.ok===true&&
   typeof parityEvidence.engineInputDigest==='string'&&
   parityEvidence.engineInputDigest===digestXmlCiiParityText(parity);
 const inputBytes=enc.encode(engineInput).length;
 const outputBytes=enc.encode(textOut).length;
 const originalSourceSha256=await sha256(original);
 const parityInputSha256=await sha256(parity);
 const engineInputSha256=await sha256(engineInput);
 const ciiOutputSha256=hasText(textOut)?await sha256(textOut):null;
 const preserved=hasText(original)&&hasText(parity)&&hasText(engineInput)&&
   original!==''&&currentInputParity&&parity===engineInput&&
   parityInputSha256===engineInputSha256;
 const emitted=engineResult?.ok===true&&
   hasText(textOut)&&typeof engineResult?.ciiName==='string'&&
   engineResult.ciiName.trim().length>0;
 const engineBoundaryVerified=preserved&&emitted;
 return Object.freeze({
   schema:XML229_NATIVE_EVIDENCE_SCHEMA,
   originalSourceSha256,
   parityInputSha256,engineInputSha256,
   engineInputBytes:inputBytes,
   ciiOutputSha256,ciiOutputBytes:outputBytes,
   ciiName:hasText(engineResult?.ciiName)?engineResult.ciiName:null,
   actualEngineInputEqualsVerifiedParity:preserved,
   nativeCiiProduced:emitted,
   status:engineBoundaryVerified?'INPUT_AND_OUTPUT_SHA256_OBSERVED':
      !preserved?'BLOCKED_INPUT_PARITY_OR_IDENTITY':
      'BLOCKED_NATIVE_CII_OUTPUT_MISSING',
   engineBoundaryVerified,
   physicalMatch2ConsumptionVerified:false,
   nativeCiiReleaseAuthorized:false,
   reason:engineBoundaryVerified
     ?'Native input/output bytes observed. Original physical occurrence-to-Final weight and CII field consumption are NOT YET ATTESTED.'
     :'Exact parity-to-engine bytes or genuine native CII output could not be independently witnessed.',
 });
}
