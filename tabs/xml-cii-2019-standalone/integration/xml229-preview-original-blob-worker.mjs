/** XML229 P3B.3 — real 4 Preview, original Worker Blob source route.
 *
 * This is an alternate one-shot transport for the existing P2.2 computation,
 * NOT a new calculation algorithm or an O1 engineering-data promotion.
 * O1 source receipt is checked again inside this Worker against original bytes
 * before any source-derived Preview values may be emitted.
 */
import {installWeightBasisXmlDom} from '../workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from '../ui-adapted/xml-cii-adapted-preview-facts-xml-source.js';
import {xmlCiiDryRunPreview} from '../ui-adapted/xml-cii-adapted-preview-dryrun.js';
if(typeof DOMParser!=='function')installWeightBasisXmlDom(globalThis);

const PROTOCOL='xml-cii-preview-local/1';
const MAX_SOURCE=100*1024*1024;
const clock=()=>globalThis.performance?.now?.() ?? Date.now();
let used=false;
const fail=(code,message=code)=>{const e=new Error(message);e.code=code;throw e;};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const toHex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
function post(request,body){
  globalThis.postMessage({protocol:PROTOCOL,requestId:request.requestId,
    basisId:request.basisId,...body});
}
globalThis.addEventListener('message',async({data:req})=>{
  if(used){post(req||{},{state:'failed',error:{code:'WORKER_ALREADY_USED',stage:'dispatch'}});return;}
  used=true;
  let stage='validate',result=null;
  const progress=(name,completed)=>post(req,{state:'running',stage:name,completed,total:3});
  try{
    if(req?.protocol!==PROTOCOL||req?.kind!=='execute'||
      !req.requestId||!hex(req.basisId)||typeof req.xmlText!=='string'||
      !req.xmlText.trim()||!req.config||typeof req.config!=='object'||
      Array.isArray(req.config)||req.scope?.mode==='B'||req.scope?.selection!=null)
      fail('XML229_PREVIEW_ORIGINAL_ENVELOPE');
    const r=req.originalSourceReceipt;
    if(r?.schema!=='XML229.OriginalStagedSourceReceipt.v1'||
      r.phase!=='INDEX_COMMITTED'||r.rightsBasis!=='SOURCE_FACTS_ONLY'||
      r.engineeringReady!==false||!hex(r.sha256)||
      typeof r.sourceRevision!=='string'||
      !r.sourceRevision.endsWith(':sha256:'+r.sha256)||
      !r.sourceRefId||!r.generationId||
      !(req.originalStagedBlob instanceof Blob)||
      req.originalStagedBlob.size!==r.byteLength||
      r.byteLength<1||r.byteLength>MAX_SOURCE||
      !Number.isSafeInteger(r.occurrenceCount)||r.occurrenceCount<1||
      !Number.isSafeInteger(r.pageCount)||r.pageCount<1)
      fail('XML229_PREVIEW_SOURCE_NOT_COMMITTED');
    const begin=clock();
    stage='original-source';progress(stage,0);
    // O1 attested the complete original source already. This second digest
    // prevents wrong-Blob/receipt substitution without parsing in the UI.
    const originalBytes=await req.originalStagedBlob.arrayBuffer();
    const actual=toHex(await crypto.subtle.digest('SHA-256',originalBytes));
    if(actual!==r.sha256)fail('XML229_PREVIEW_SOURCE_SHA_MISMATCH');
    const stagedJsonText=new TextDecoder('utf-8',{fatal:true}).decode(originalBytes);
    stage='source-occurrences';
    const original=projectXmlCiiOccurrences({
      xmlText:req.xmlText,mode:'A',sourceId:req.scope?.sourceId||null,
      manifest:null,selection:null
    });
    progress(stage,1);
    stage='engineering-dryrun';
    result=xmlCiiDryRunPreview(req.xmlText,req.config,stagedJsonText);
    progress(stage,2);
    stage='source-coverage';
    if(!result||!Array.isArray(result.branchRows)||!Array.isArray(result.nodeRows)||
      result.branchRows.length!==original.branchCount)
      fail('XML229_PREVIEW_ORIGINAL_COVERAGE');
    const seen=new Set(result.branchRows.map((row,i)=>
      Number.isSafeInteger(row.branchOccurrenceIndex)?row.branchOccurrenceIndex:i));
    if(seen.size!==original.branchCount)fail('XML229_PREVIEW_ORIGINAL_BRANCH_ALIAS');
    progress(stage,3);
    post(req,{state:'completed',stage:'local-engineering',completed:3,total:3,
      result:{branchRows:result.branchRows,nodeRows:result.nodeRows,
        // Preserve both nonauthorizing Format 1/2 Preview passes from the
        // native original-source Worker; UI must never silently pick one.
        formatPreviewPasses:Array.isArray(result.formatPreviewPasses)
          ?result.formatPreviewPasses:[],
        sourceOccurrences:original,
        coverage:{sourceBranchCount:original.branchCount,
          originalNodeCount:original.nodeCount,
          engineeringBranchCount:result.branchRows.length,
          legacyReviewNodeCount:result.nodeRows.length},
        originalStagedSourceSha256:r.sha256,
        originalStagedSourceGeneration:r.generationId,
        timings:{totalWorkerMs:Math.round(clock()-begin)},
        engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false}});
  }catch(e){
    post(req||{},{state:'failed',error:{
      code:String(e?.code||'XML229_PREVIEW_WORKER_ERROR'),
      message:String(e?.message||e),stage,retryable:false}});
  }finally{globalThis.close?.();}
});
