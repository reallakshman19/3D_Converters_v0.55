/** Explicit source revision -> genuine fresh O1 -> new verified Preview Worker.
 * No previous Final, review backup or native output crosses the transition.
 */
import {createXml229InstrumentSourceRevision} from '../integration/xml229-instrument-source-review.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const key=r=>JSON.stringify([r.branchOccurrenceIndex,r.sourceNodeOrdinal]);

async function productionPorts(){
 const [panel,intake,state,mode,authority,scope,caches]=await Promise.all([
  import('./xml-cii-adapted-p4-verified-weight-panel.js'),
  import('./xml-cii-adapted-lfj-o1-intake.js'),import('./xml-cii-adapted-state.js'),
  import('./xml-cii-adapted-processing-mode.js'),
  import('../integration/xml229-engineering-basis-authority.mjs'),
  import('../xml-cii-branch-scope.js'),import('./xml-cii-adapted-mode-a-state.js'),
 ]);
 return {getWorker:panel.getXml229CurrentWorkerHeldReview,
  open:panel.openXml229P4VerifiedSession,capture:panel.captureXml229P4LiveSourceSnapshot,
  compare:panel.compareXml229P4LiveSourceSnapshot,fullSelection:panel.assertXml229P4OriginalFullSelection,
  resolveBlob:intake.resolveXml229CurrentPreviewBlob,reindex:intake.reindexXml229OriginalBlobForTopoFix,
  update:state.updateWorkflowState,reset:mode.singleXmlCiiSourceState,
  revoke:authority.revokeXml229VerifiedEngineeringBasis,clearCaches:caches.clearModeASourceCaches,
  selection:scope.normalizeXmlCiiBranchSelection,
  makeFile:(text,name)=>new File([text],name,{type:'application/xml'})};
}

async function attestRevision({sourceText,report,revision}){
 const selections=revision?.receipt?.classificationSelections;
 if(!Array.isArray(selections)||!selections.length||
  revision.receipt.schema!=='XML229.BrowserInstrumentSourceRevision.v1')
  fail('INSTRUMENT_FRESH_SELECTION_REQUIRED');
 const checked=await createXml229InstrumentSourceRevision({sourceText,report,
  selectedOwners:selections.map(key)});
 if(checked.revisedXml!==revision.revisedXml||
  checked.receipt.newSourceXmlSha256!==revision.receipt.newSourceXmlSha256||
  checked.receipt.oldSourceXmlSha256!==revision.receipt.oldSourceXmlSha256||
  checked.receipt.selectedCount!==revision.receipt.selectedCount)
  fail('INSTRUMENT_FRESH_REVISION_MISMATCH');
 return checked;
}

function replacement(p,original,revision,name,sourceId){
 const next=p.reset(original,p.makeFile(revision.revisedXml,name),revision.revisedXml,'xml');
 // Lossless validation proved only the explicit Rigid fields changed. Keep
 // committed masters/process/support config; clear all previous review output.
 Object.assign(next,{modeASourceId:sourceId,sourceName:name,
  supportConfigJson:original.supportConfigJson,masterContext:original.masterContext,
  branchSelection:p.selection(revision.revisedXml,{}),
  xml229XmlOnlyApproval:null,xml229AcceptedFinalIntent:null,xml229FinalReviewBackup:null,
  weightMatchResult:null,weightMatchOverridesJson:'{}',result:null,
  outputRunReadinessReport:null,batchRunResult:null,running:true,
  activePhaseId:original.activePhaseId||'run',
  xml229InstrumentSourceRevision:revision.receipt});
 return p.update(original,next);
}

async function challengeFresh(p,raw,previous,checked,oldReceipt,isCurrent){
 const session=await p.open(raw);
 try{
  const after=await session.readCompletion();
  const advice=await session.readInstrumentModelingSuggestions();
  const selected=new Set(checked.receipt.classificationSelections.map(key));
  if(!isCurrent()||session.closed||p.getWorker(raw)!==session||
   !session.receipt?.basisId||session.receipt.basisId===previous.receipt.basisId||
   session.receipt.sourceId!==previous.receipt.sourceId||
   session.receipt.sourceGenerationId===oldReceipt.generationId||
   session.receipt.sourceGenerationId!==raw.current.xml229StagedSourceReceipt?.generationId||
   session.receipt.originalJsonSha256!==oldReceipt.sha256||
   session.receipt.finalEngineeringAccepted!==false||after.counts?.final!==0||
   after.basisId!==session.receipt.basisId||after.verifiedPhysicalCount<1||
   advice.basisId!==session.receipt.basisId||
   advice.sourceXmlSha256!==checked.receipt.newSourceXmlSha256||
   !Array.isArray(advice.items)||advice.items.some(r=>selected.has(JSON.stringify([
    r.branchOccurrenceIndex,r.secondSourceNodeOrdinal]))))
   fail('INSTRUMENT_FRESH_WORKER_NOT_VERIFIED');
  return session;
 }catch(error){p.revoke(raw,{expectedSession:session});session?.cancel?.();throw error;}
}

/** Test ports must be explicitly supplied; default ports use actual Workers. */
export async function startXml229InstrumentFreshReview({stateRef,sourceText,report,
 revision,sourceName='source.instrument-model.xml',container,
 sourceIsCurrent=()=>false,render=()=>{},ports=null}={}){
 const p=ports||await productionPorts(),raw=stateRef?.modeABaseRef||stateRef;
 const original=raw?.current,previous=raw&&p.getWorker(raw);
 if(!original||original.running||original.sourceText!==sourceText||!sourceIsCurrent()||
  !previous||previous.closed||original.xmlProcessingMode==='mode-b')
  fail('INSTRUMENT_FRESH_SOURCE_STALE');
 const enabled=original.sourceBatch?.sources?.filter(s=>s.enabled!==false);
 if(enabled&&enabled.length!==1)fail('INSTRUMENT_FRESH_SINGLE_SOURCE_REQUIRED');
 p.fullSelection(original);
 const sourceId=original.modeASourceId||original.sourceBatch?.activeSourceId||previous.receipt?.sourceId;
 if(!sourceId)fail('INSTRUMENT_FRESH_SOURCE_ID_REQUIRED');
 const before=p.capture(original,sourceId);
 const checked=await attestRevision({sourceText,report,revision});
 const oldReceipt=original.xml229StagedSourceReceipt,source=p.resolveBlob(raw,oldReceipt);
 if(!sourceIsCurrent()||!p.compare(before,raw.current,{verifyFullSelection:()=>false})||
  raw.current.sourceFile!==original.sourceFile||raw.current.running||
  p.getWorker(raw)!==previous||!source.isCurrent())
  fail('INSTRUMENT_FRESH_SOURCE_STALE');
 const next=replacement(p,raw.current,checked,sourceName,sourceId);
 p.revoke(raw,{expectedSession:previous});p.clearCaches();raw.current=next;
 const snapshot=p.capture(raw.current,sourceId);
 const isCurrent=()=>p.compare(snapshot,raw.current,{verifyFullSelection:state=>{
  try{p.fullSelection(state);return true;}catch{return false;}
 }});
 try{
  await p.reindex(raw,{expectedReceipt:oldReceipt,container,isCurrent});
  if(!isCurrent())fail('INSTRUMENT_FRESH_SOURCE_STALE');
  const session=await challengeFresh(p,raw,previous,checked,oldReceipt,isCurrent);
  return Object.freeze({session,sourceXmlSha256:checked.receipt.newSourceXmlSha256,
   basisId:session.receipt.basisId,priorFinalDecisionsTransferred:false,
   nativeCiiReleaseAuthorized:false});
 }finally{
  raw.current=p.update(raw.current,{running:false});render();
 }
}
