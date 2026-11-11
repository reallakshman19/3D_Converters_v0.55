/** Resolve exact governed native XML; O1 JSON bytes remain in the Worker when UI has no file.
 * The current source-bound Worker Final packet, not UI JSON, is the authority.
 */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';

const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const text=value=>typeof value==='string'?value:'';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);

export async function resolveXml229NativeCandidateSource({state,packet,readFile,attachment=null}={}){
 const xmlOnly=packet?.reviewSourceKind==='XML_ONLY'&&packet.originalJsonSha256===null&&
   packet.sourceGenerationId==='xml-only:sha256:'+packet.sourceXmlSha256;
 if(!state||!packet||!sha(packet.sourceXmlSha256)||
    !(xmlOnly||packet.reviewSourceKind!=='XML_ONLY'&&sha(packet.originalJsonSha256))||typeof readFile!=='function')
   fail('NATIVE_CANDIDATE_SOURCE_CUSTODY_REQUIRED');
 const sourceFileText=state.sourceFile?text(await readFile(state.sourceFile)):null;
 const sourceStateText=text(state.sourceText);
 if(state.sourceFile&&!sourceFileText)
   fail('NATIVE_CANDIDATE_SOURCE_XML_FILE_UNREADABLE');
 if(sourceFileText&&sourceStateText&&sourceFileText!==sourceStateText)
   fail('NATIVE_CANDIDATE_SOURCE_XML_CONFLICT');
 const sourceText=sourceFileText||sourceStateText;
 if(!sourceText.trim())fail('NATIVE_CANDIDATE_SOURCE_XML_REQUIRED');
 if(await digestUtf8(sourceText)!==packet.sourceXmlSha256)
   fail('NATIVE_CANDIDATE_SOURCE_XML_SHA_DRIFT');
 if(xmlOnly){
   if(hasXml229PreviewJsonSource(state)||attachment)fail('NATIVE_CANDIDATE_XML_ONLY_JSON_CONFLICT');
   return Object.freeze({sourceText,stagedJsonText:''});
 }

 // JSON raw bytes are an OPTIONAL converter input here, not the source of
 // authority: the private O1 Blob and its SHA are independently attested by
 // the active GC-PW Worker which produced packet.originalJsonSha256.
 const stagedFileText=state.stagedJsonFile?text(await readFile(state.stagedJsonFile)):null;
 const stagedStateText=text(state.stagedJsonText);
 if(state.stagedJsonFile&&!stagedFileText)
   fail('NATIVE_CANDIDATE_STAGED_JSON_FILE_UNREADABLE');
 if(stagedFileText&&stagedStateText&&stagedFileText!==stagedStateText)
   fail('NATIVE_CANDIDATE_STAGED_JSON_CONFLICT');
 let stagedJsonText=stagedFileText||stagedStateText;
 if(!stagedJsonText&&attachment){
   if(attachment.basisId!==packet.basisId||
      attachment.sourceGenerationId!==packet.sourceGenerationId||
      attachment.sha256!==packet.originalJsonSha256||!attachment.file)
     fail('NATIVE_CANDIDATE_JSON_ATTACHMENT_STALE');
   stagedJsonText=text(await readFile(attachment.file));
   if(!stagedJsonText)fail('NATIVE_CANDIDATE_JSON_ATTACHMENT_UNREADABLE');
 }
 // Default native behavior uses staged JSON for restraint semantics.
 // Never silently opt out merely because O1 keeps the original blob private.
 if(!stagedJsonText&&state.options?.useRestraintTypeBasedOnJson!==false)
   fail('NATIVE_CANDIDATE_JSON_RESTRAINT_SOURCE_REQUIRED');
 if(stagedJsonText&&await digestUtf8(stagedJsonText)!==packet.originalJsonSha256)
   fail('NATIVE_CANDIDATE_STAGED_JSON_SHA_DRIFT');
 return Object.freeze({sourceText,stagedJsonText});
}
