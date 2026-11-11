/** Capture input values, not transient rendering-object identities. */
import {canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';

const rawState=ref=>(ref?.modeABaseRef||ref)?.current;
const sourceIds=state=>(state?.sourceBatch?.sources||[])
  .filter(x=>x.enabled!==false).map(x=>x.sourceId);
function basis(state){
 return canonicalJson(JSON.parse(JSON.stringify({
  sourceKind:state.sourceKind??null,sourceText:state.sourceText??'',
  stagedJsonText:state.stagedJsonText??'',
  supportConfig:JSON.parse(state.supportConfigJson||'{}'),
  masterContext:state.masterContext??null,options:state.options??{},
  branchSelection:state.branchSelection??{},
  jsonTraceScopeId:state.jsonTraceScopeId??null,
  selectedScopeId:state.selectedScopeId??null,
  requestedOwnerZoneScopeId:state.requestedOwnerZoneScopeId??null,
  sourceId:state.modeASourceId||state.sourceBatch?.activeSourceId||'',
  sourceIds:sourceIds(state),mode:state.xmlProcessingMode||'single',
  selectedReceipts:(state.sourceBatch?.sources||[]).filter(x=>x.enabled!==false)
   .map(x=>({id:x.sourceId,receipt:x.xml229StagedSourceReceipt||
     x.workflow?.xml229StagedSourceReceipt||null})),
  receipt:state.xml229StagedSourceReceipt??null,
  xmlOnly:state.xml229XmlOnlyApproval??null,
  topologyPending:state.xml229TopoFixFreshReviewPending??false,
 })));
}
export function captureXml229NativeRunContext({stateRef,session,liveWorker}){
 const original=rawState(stateRef),view=stateRef?.current;
 let snapshot;
 try{snapshot=basis(original);}catch{return null;}
 const receipt=original?.xml229StagedSourceReceipt;
 const sourceFile=original?.sourceFile,stagedJsonFile=original?.stagedJsonFile;
 const valid=()=>session&&!session.closed&&liveWorker()===session&&
  ((session.receipt?.reviewSourceKind==='XML_ONLY'&&!hasXml229PreviewJsonSource(original)&&
   session.receipt.originalJsonSha256===null&&/^[a-f0-9]{64}$/i.test(session.receipt.sourceXmlSha256)&&
   session.receipt.sourceGenerationId==='xml-only:sha256:'+session.receipt.sourceXmlSha256)||
  (receipt?.schema==='XML229.OriginalStagedSourceReceipt.v1'&&
  receipt.sha256===session.receipt?.originalJsonSha256&&
  receipt.generationId===session.receipt?.sourceGenerationId))&&
  original.xmlProcessingMode!=='mode-b'&&sourceIds(original).length<=1;
 if(typeof liveWorker!=='function'||!valid())return null;
 // Governed review attests the entire original source, never a filtered view.
 if(view?.sourceText!==original.sourceText||
    view?.stagedJsonText!==original.stagedJsonText)return null;
 const sourceId=original.modeASourceId||original.sourceBatch?.activeSourceId;
 if(sourceId&&sourceId!==session.receipt?.sourceId)return null;
 const isCurrent=()=>{
  if(!valid())return false;
  const latest=rawState(stateRef);
  try{return latest?.sourceFile===sourceFile&&
    latest?.stagedJsonFile===stagedJsonFile&&basis(latest)===snapshot;
  }catch{return false;}
 };
 return {state:{...view,sourceFile:original.sourceFile,
  sourceText:original.sourceText,stagedJsonFile:original.stagedJsonFile,
  stagedJsonText:original.stagedJsonText},isCurrent};
}
