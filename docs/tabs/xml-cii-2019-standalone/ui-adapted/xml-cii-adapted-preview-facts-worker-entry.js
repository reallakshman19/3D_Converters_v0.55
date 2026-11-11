// Agent P P2.2-A local-only engineering execution endpoint.
// One job per dedicated Worker. This does NOT define shared GC-PW worker protocol.
// P2.2-B owns cross-job queue, cancellation, retries and stale-result fencing.
import {installWeightBasisXmlDom} from '../workers/weight-basis-xml-dom.js';
import {projectXmlCiiOccurrences} from './xml-cii-adapted-preview-facts-xml-source.js';
import {xmlCiiDryRunPreview} from './xml-cii-adapted-preview-dryrun.js';

if (typeof DOMParser !== 'function') installWeightBasisXmlDom(globalThis);
const PROTOCOL='xml-cii-preview-local/1';
const clock=()=>globalThis.performance?.now?.() ?? Date.now();
let used=false;
function errorInfo(error,stage) {
  return {code:String(error?.code||'PREVIEW_COMPUTE_FAILURE'),
    message:String(error?.message||error), stage, retryable:false};
}
function post(body,requestId,basisId) {
  globalThis.postMessage({protocol:PROTOCOL,requestId,basisId,...body});
}
globalThis.addEventListener('message',async (event)=>{
  const request=event.data||{},requestId=request.requestId,basisId=request.basisId;
  if(used) {
    post({state:'failed',error:errorInfo({code:'WORKER_ALREADY_USED',message:'Dedicated local worker accepts only one job'},'dispatch')},requestId,basisId);
    return;
  }
  used=true;
  let stage='validate',result;
  const timings={};
  const progress=(stage,completed,total=3)=>post({state:'running',stage,completed,total},requestId,basisId);
  try {
    if(request.protocol!==PROTOCOL||request.kind!=='execute'
      ||typeof requestId!=='string'||!requestId.trim()
      ||typeof basisId!=='string'||!/^[a-f0-9]{64}$/.test(basisId))
      throw Object.assign(new Error('Invalid local execution envelope'),{code:'INVALID_ENVELOPE'});
    if(typeof request.xmlText!=='string'||!request.xmlText.trim()
      ||!request.config||typeof request.config!=='object'||Array.isArray(request.config)
      ||typeof request.stagedJsonText!=='string')
      throw Object.assign(new Error('XML/config/staged JSON missing or nonserializable'),{code:'INVALID_INPUT'});
    if(request.scope?.selection != null)
      throw Object.assign(new Error('Selected subpopulation engineering compute needs an explicit scoped adapter'),{code:'SCOPED_ENGINEERING_PENDING'});
    const started=clock();
    stage='source-occurrences';progress(stage,0);
    const original=projectXmlCiiOccurrences({xmlText:request.xmlText,
      mode:request.scope?.mode||'A',sourceId:request.scope?.sourceId||null,
      manifest:request.scope?.manifest||null,selection:null});
    timings.sourceOccurrenceMs=Number((clock()-started).toFixed(3));
    progress(stage,1);
    stage='engineering-dryrun';
    const computedAt=clock();progress(stage,1);
    // Retain existing Format1/2, LineList, PipingClass, bore, Rating, Material,
    // B31.3 and DTXR logic. Never rewrite, relax or hardcode engineering values.
    result=xmlCiiDryRunPreview(request.xmlText,request.config,request.stagedJsonText);
    timings.engineeringDryRunMs=Number((clock()-computedAt).toFixed(3));
    progress(stage,2);
    stage='source-coverage';
    const checkedAt=clock();
    if(!result||!Array.isArray(result.branchRows)||!Array.isArray(result.nodeRows))
      throw Object.assign(new Error('Dryrun did not emit branch/node arrays'),{code:'INVALID_DRYRUN_RESULT'});
    if(result.branchRows.length!==original.branchCount)
      throw Object.assign(new Error('Expected '+original.branchCount+' original Branch occurrences but computed '+result.branchRows.length),
        {code:'SOURCE_BRANCH_COVERAGE_MISMATCH'});
    const ordinals=new Set(result.branchRows.map((row,index)=>Number.isSafeInteger(row.branchOccurrenceIndex)
      ? row.branchOccurrenceIndex:index));
    if(ordinals.size!==original.branchCount)
      throw Object.assign(new Error('Computed duplicate/missing branch occurrence'),{code:'BRANCH_OCCURRENCE_ALIAS'});
    timings.sourceCoverageMs=Number((clock()-checkedAt).toFixed(3));
    timings.totalWorkerMs=Number((clock()-started).toFixed(3));
    progress(stage,3);
    // Legacy nodeRows are only review-eligible nodes: never equate their count to
    // all source nodes. Original sourceOccurrences survive separately, losslessly.
    post({state:'completed',stage:'local-engineering',completed:3,total:3,
      result:{branchRows:result.branchRows,nodeRows:result.nodeRows,
        sourceOccurrences:original,
        coverage:{sourceBranchCount:original.branchCount,
          originalNodeCount:original.nodeCount,
          engineeringBranchCount:result.branchRows.length,
          legacyReviewNodeCount:result.nodeRows.length},
        timings,engineeringAcceptance:'NOT_ASSESSED',
        fullFactPopulationAccepted:false}},
      requestId,basisId);
  }catch(error){
    post({state:'failed',error:errorInfo(error,stage)},requestId,basisId);
  }finally{
    // Dedicated worker has no source/master cache or second-job authority.
    globalThis.close?.();
  }
});
