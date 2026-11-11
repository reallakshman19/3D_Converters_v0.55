/** Transient source-bound topology review. No Final decisions or native output. */
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
import {runXmlCii2019StandaloneEngineJob} from '../xml-cii-workflow-engine-client.js';
import {detectXmlCiiWorkflowSourceKind} from '../xml-cii-workflow-source-detect.js';
import {updateWorkflowState,updateWorkflowOptions} from './xml-cii-adapted-state.js';
import {xmlCiiProcessingMode} from './xml-cii-adapted-processing-mode.js';
import {assertXml229P4OriginalFullSelection} from './xml-cii-adapted-p4-verified-weight-panel.js';
import {startXml229TopologyFreshReview} from './xml229-topology-fresh-review.mjs';

const reviews=new WeakMap();
const failures=new WeakMap();
const key=ref=>ref?.modeABaseRef||ref;
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function captureXml229TopologySource(state){
 return {sourceText:state.sourceText,sourceKind:state.sourceKind,
  mode:xmlCiiProcessingMode(state),sourceId:state.modeASourceId||'',
  config:state.supportConfigJson||'{}',scope:JSON.stringify(state.branchSelection||{}),
  masters:JSON.stringify([state.masterContext?.datasetRefs,
   state.masterContext?.appliedMappingRevision,state.masterContext?.rowCounts]),
  receipt:JSON.stringify(state.xml229StagedSourceReceipt||null)};
}
const matches=(snapshot,state)=>snapshot&&Object.entries(snapshot).every(
 ([name,value])=>captureXml229TopologySource(state)[name]===value);
export function getXml229TopologyReview(ref){
 const review=reviews.get(key(ref));
 return review&&(matches(review.source,key(ref).current)||
  matches(review.appliedSource,key(ref).current))?review:null;
}
export const getXml229TopologyFailure=ref=>failures.get(key(ref))||null;
export function xml229TopologyDisplayState(state,ref){
 const review=getXml229TopologyReview(ref),result=review?.result;
 if(!result)return state;
 const sidecars=Object.fromEntries(Object.entries(result).filter(([name])=>
  name.startsWith('topology')||name.startsWith('topoFix')||name==='ciiInputSource'));
 return {...state,result:{...state.result,...sidecars,
  ciiInputSource:review.freshProof?'topofix':result.ciiInputSource}};
}
export function xml229TopologyActions(result){
 try{
  const plan=JSON.parse(result?.topologyFixPlanText||'{}');
  return Array.isArray(plan.actions)?plan.actions:[];
 }catch{return [];}
}
export function selectXml229TopologyActions(ref,ids){
 const review=getXml229TopologyReview(ref);
 if(!review||review.busy||review.appliedSource)fail('TOPOFIX_CURRENT_PLAN_REQUIRED');
 const requested=[...new Set(ids)];
 const allowed=new Set(xml229TopologyActions(review.result)
  .filter(a=>a.status==='PROPOSED'&&!a.blockers?.length).map(a=>a.action_id));
 if(requested.some(id=>!allowed.has(id)))fail('TOPOFIX_UNREVIEWABLE_ACTION');
 review.selected=requested;
 const raw=key(ref);raw.current=updateWorkflowOptions(raw.current,{topologyActionIds:requested});
}
function assertSource(state){
 if(xmlCiiProcessingMode(state)!=='single'||
    (state.sourceBatch?.sources?.filter(s=>s.enabled!==false).length||0)>1||
    detectXmlCiiWorkflowSourceKind(state.sourceText,'xml')!=='xml')
  fail('TOPOFIX_SINGLE_ORIGINAL_XML_REQUIRED');
 assertXml229P4OriginalFullSelection(state);
}
export async function runXml229TopologyReview(ref,{
 commit=false,render=()=>{},engineJob=runXmlCii2019StandaloneEngineJob,
}={}){
 const raw=key(ref),state=raw.current;assertSource(state);
 const existing=getXml229TopologyReview(raw);
 if(state.running||existing?.busy)fail('TOPOFIX_REVIEW_BUSY');
 if(commit&&(!existing||!existing.selected.length||existing.appliedSource))
  fail('TOPOFIX_REVIEWED_ACTIONS_REQUIRED');
 const review={source:captureXml229TopologySource(state),originalXmlText:state.sourceText,
  selected:commit?[...existing.selected]:[],result:existing?.result||null,busy:true,errorCode:null};
 reviews.set(raw,review);
 failures.delete(raw);
 const current=()=>reviews.get(raw)===review&&matches(review.source,raw.current);
 raw.current=updateWorkflowState(state,{running:true,options:{...state.options,
  analyzeTopology:true,generateTopoFix:true,useTopoFixForCii:true,
  topologyActionIds:review.selected}});render();
 try{
  const sourceSha=await digestUtf8(review.originalXmlText);
  if(!current())fail('TOPOFIX_REVIEW_STALE_SOURCE');
  const result=await engineJob({sourceKind:'xml',sourceText:review.originalXmlText,
   sourceName:state.sourceFile?.name||'source.xml',topologyPreFinalOnly:true,
   options:{outputMode:'enriched-only',analyzeTopology:true,generateTopoFix:commit,
    useTopoFixForCii:false,topologyActionIds:review.selected}});
  if(!current())fail('TOPOFIX_REVIEW_STALE_SOURCE');
  if(result?.ok!==true||result.ciiText||!result.topologyFixPlanText)
   fail('TOPOFIX_REVIEW_STAGE_FAILED');
  let plan;try{plan=JSON.parse(result.topologyFixPlanText);}catch{fail('TOPOFIX_PLAN_INVALID');}
  if(plan.source?.sha256!==sourceSha)fail('TOPOFIX_PLAN_SOURCE_DRIFT');
  review.result=result;review.sourceSha256=sourceSha;
  if(commit&&(!result.topoFixCommitted||!result.topoFixXmlText||
     !result.topoFixLineageText||!result.topoFixPreFinalHandoffText))
   fail('TOPOFIX_TRANSACTION_NOT_COMMITTED');
  return review;
 }catch(e){review.errorCode=String(e.code||'TOPOFIX_REVIEW_FAILED');failures.set(raw,review.errorCode);throw e;}
 finally{
  review.busy=false;
  if(reviews.get(raw)===review){raw.current=updateWorkflowState(raw.current,{running:false});render();}
 }
}
export async function openXml229TopologyFreshWeight(ref,{
 container,render=()=>{},transition=startXml229TopologyFreshReview,
}={}){
 const raw=key(ref),review=getXml229TopologyReview(raw);
 if(!review?.result?.topoFixCommitted||review.busy||review.appliedSource||raw.current.running)
  fail('TOPOFIX_COMMITTED_REVIEW_REQUIRED');
 const sourceIsCurrent=()=>reviews.get(raw)===review&&matches(review.source,raw.current);
 review.busy=true;raw.current=updateWorkflowState(raw.current,{running:true});render();
 failures.delete(raw);
 try{
  const proof=await transition({stateRef:raw,review,container,sourceIsCurrent,render});
  review.appliedSource=captureXml229TopologySource(raw.current);
  review.freshProof=proof;review.errorCode=null;
  raw.current=updateWorkflowState(raw.current,{activePhaseId:'weight-match',running:false});
  return proof;
 }catch(e){review.errorCode=String(e.code||'TOPOFIX_FRESH_REVIEW_FAILED');failures.set(raw,review.errorCode);throw e;}
 finally{
  review.busy=false;
  if(reviews.get(raw)===review){raw.current=updateWorkflowState(raw.current,{running:false});render();}
 }
}
