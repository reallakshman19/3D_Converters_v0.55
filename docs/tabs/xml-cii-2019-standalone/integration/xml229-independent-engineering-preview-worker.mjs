/**
 * XML229 original-json engineering Preview runs in its own Worker.
 * This worker is Preview-only: no weight proposal approval or CII release.
 */
import {installWeightBasisXmlDom} from '../workers/weight-basis-xml-dom.js';
import {xmlCiiDryRunPreview} from '../ui-adapted/xml-cii-adapted-preview-dryrun.js';
import {isolatedOriginalPreviewWorkConfig} from './xml229-original-preview-work-config.mjs';
installWeightBasisXmlDom(globalThis);
const P='XML229.P4.IndependentEngineeringPreview.v1';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const digest=async bytes=>Array.from(new Uint8Array(
 await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
let started=false;
self.addEventListener('message',async({data:m})=>{
 if(m?.protocol!==P||m.kind!=='start'||started)return;
 started=true;
 const emit=(state,values={})=>postMessage({protocol:P,
   requestId:m.requestId,sourceId:m.sourceId,basisId:m.basisId,
   sourceGenerationId:m.sourceGenerationId,originalJsonSha256:m.originalJsonSha256,
   reviewSourceKind:m.reviewSourceKind,sourceXmlSha256:m.sourceXmlSha256,
   state,...values});
 try{
   const xmlOnly=m.reviewSourceKind==='XML_ONLY';
   const sourceValid=xmlOnly
     ? m.originalJsonSha256===null&&m.originalStagedBlob==null&&sha(m.sourceXmlSha256)&&
       m.sourceGenerationId==='xml-only:sha256:'+m.sourceXmlSha256
     : sha(m.originalJsonSha256)&&m.originalStagedBlob instanceof Blob&&
       m.originalStagedBlob.size>0&&m.originalStagedBlob.size<=100*1024*1024;
   if(typeof m.requestId!=='string'||!m.requestId||
      typeof m.sourceId!=='string'||!m.sourceId||
      typeof m.sourceGenerationId!=='string'||!m.sourceGenerationId||
      !sha(m.basisId)||!sourceValid||
      typeof m.xmlText!=='string'||!m.xmlText.trim())
     throw Error('INVALID_PREVIEW_INPUT');
   emit('progress',{stage:xmlOnly?'preview-xml-byte-sha256':'preview-json-byte-sha256'});
   const bytes=xmlOnly?new TextEncoder().encode(m.xmlText):await m.originalStagedBlob.arrayBuffer();
   if(await digest(bytes)!==(xmlOnly?m.sourceXmlSha256:m.originalJsonSha256))
     throw Error('PREVIEW_ORIGINAL_JSON_SHA_DRIFT');
   const staged=xmlOnly?'':new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   emit('progress',{stage:'engineering-preview-using-actual-json'});
   const result=xmlCiiDryRunPreview(m.xmlText,
     isolatedOriginalPreviewWorkConfig(m.config),staged);
   if(!Array.isArray(result?.branchRows)||!Array.isArray(result?.nodeRows))
     throw Error('PREVIEW_INCOMPLETE');
   emit('completed',{result});
 }catch{
   emit('failed',{error:{code:'ISOLATED_ENGINEERING_PREVIEW_FAILED'}});
 }finally{self.close();}
});
