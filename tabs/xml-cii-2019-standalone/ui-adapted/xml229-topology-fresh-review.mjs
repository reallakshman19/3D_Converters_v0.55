/** Explicit committed-source transition through existing O1 and L3 authority. */
import {attestXml229TopoFixFreshSource,startXml229TopoFixFreshWeightSession}
 from '../integration/xml229-topofix-fresh-worker-handoff.mjs';
import {revokeXml229VerifiedEngineeringBasis}
 from '../integration/xml229-engineering-basis-authority.mjs';
import {resolveXml229CurrentPreviewBlob,reindexXml229OriginalBlobForTopoFix}
 from './xml-cii-adapted-lfj-o1-intake.js';
import {singleXmlCiiSourceState} from './xml-cii-adapted-processing-mode.js';
import {updateWorkflowState} from './xml-cii-adapted-state.js';
import {normalizeXmlCiiBranchSelection} from '../xml-cii-branch-scope.js';
import {getXml229CurrentWorkerHeldReview,openXml229P4VerifiedSession,
 resolveXml229P4ProductionInputs,captureXml229P4LiveSourceSnapshot,
 compareXml229P4LiveSourceSnapshot,assertXml229P4OriginalFullSelection}
 from './xml-cii-adapted-p4-verified-weight-panel.js';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const defaults={attest:attestXml229TopoFixFreshSource,
 getWorker:getXml229CurrentWorkerHeldReview,revoke:revokeXml229VerifiedEngineeringBasis,
 resolveBlob:resolveXml229CurrentPreviewBlob,reindex:reindexXml229OriginalBlobForTopoFix,
 resolveInputs:resolveXml229P4ProductionInputs,open:openXml229P4VerifiedSession,
 start:startXml229TopoFixFreshWeightSession,
 makeFile:(text,name)=>new File([text],name,{type:'application/xml'})};

/** Optional ports are explicit test dependencies; production uses real Workers. */
export async function startXml229TopologyFreshReview({
 stateRef,review,container,sourceIsCurrent,render=()=>{},ports={},
}={}){
 const p={...defaults,...ports},raw=stateRef?.modeABaseRef||stateRef;
 if(!raw||typeof sourceIsCurrent!=='function'||!sourceIsCurrent())
  fail('TOPOFIX_FRESH_SOURCE_STALE');
 const original=raw.current,previous=p.getWorker(raw),result=review?.result;
 const sourceId=original.modeASourceId||original.sourceBatch?.activeSourceId||previous?.receipt?.sourceId;
 if(!sourceId)fail('TOPOFIX_FRESH_SOURCE_ID_REQUIRED');
 if(!result?.topoFixCommitted||review.originalXmlText!==original.sourceText)
  fail('TOPOFIX_COMMITTED_SOURCE_REQUIRED');
 const lineageReceipt=JSON.parse(result.topoFixLineageText);
 const handoffReceipt=JSON.parse(result.topoFixPreFinalHandoffText);
 const attestation=await p.attest({originalXmlText:review.originalXmlText,
  fixedXmlText:result.topoFixXmlText,lineageReceipt,handoffReceipt});
 if(!sourceIsCurrent())fail('TOPOFIX_FRESH_SOURCE_STALE');
 const oldReceipt=original.xml229StagedSourceReceipt;
 const source=p.resolveBlob(raw,oldReceipt);
 if(!source.isCurrent()||!sourceIsCurrent())fail('TOPOFIX_FRESH_SOURCE_STALE');
 const file=p.makeFile(result.topoFixXmlText,result.topoFixXmlName||'source.topofix.xml');
 const next=singleXmlCiiSourceState(original,file,result.topoFixXmlText,'xml');
 next.modeASourceId=sourceId;
 next.branchSelection=normalizeXmlCiiBranchSelection(result.topoFixXmlText,{});
 next.options={...original.options,analyzeTopology:true,generateTopoFix:true,
  useTopoFixForCii:true,topologyActionIds:[]};
 Object.assign(next,{xml229XmlOnlyApproval:null,xml229AcceptedFinalIntent:null,
  xml229TopoFixFreshReviewPending:attestation||{requiresFreshWorkerBasis:true},
  xml229FinalReviewBackup:null,weightMatchResult:null,weightMatchOverridesJson:'{}',
  result:null,outputRunReadinessReport:null,running:true});
 p.revoke(raw,{expectedSession:previous});
 raw.current=updateWorkflowState(original,next);
 const snapshot=captureXml229P4LiveSourceSnapshot(raw.current,sourceId);
 const current=()=>compareXml229P4LiveSourceSnapshot(snapshot,raw.current,{
  verifyFullSelection:state=>{try{assertXml229P4OriginalFullSelection(state);return true;}catch{return false;}}});
 render();
 await p.reindex(raw,{expectedReceipt:oldReceipt,container,isCurrent:current});
 if(!current())fail('TOPOFIX_FRESH_SOURCE_STALE');
 const proof=await p.start({stateRef:raw,originalXmlText:review.originalXmlText,
  lineageReceipt,handoffReceipt,previousSession:previous,explicitUserAction:true,
  isCurrent:current,resolveInputs:()=>p.resolveInputs(raw),
  openSession:({resolveInputs})=>p.open(raw,{resolveInputs})});
 if(!current()){proof.session?.cancel?.();fail('TOPOFIX_FRESH_SOURCE_STALE');}
 raw.current=updateWorkflowState(raw.current,{xml229TopoFixFreshReviewPending:null,
  options:{...raw.current.options,analyzeTopology:false,generateTopoFix:false,
   useTopoFixForCii:false,topologyActionIds:[]}});
 return proof;
}
