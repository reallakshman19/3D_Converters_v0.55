/**
 * Independent read-only audit of a private flow-trace export. It does not
 * ingest raw XML/JSON, logs or candidate rows and never authorizes native CII.
 */
export const XML229_FLOW_AUDIT_SCHEMA='XML229.CrossWorkerFlowAudit.v1';
const kind=new Set(['BUILD_REQUESTED','SOURCE_INPUTS_VERIFIED','CENSUS_REQUESTED',
 'CENSUS_VERIFIED','GC_PW_WORKER_REQUESTED','GC_PW_WORKER_STARTED',
 'PREVIEW_CHILD_REQUESTED','PREVIEW_CHILD_PROGRESS','PREVIEW_CHILD_COMPLETED',
 'FACTS_OPENED','GC_PW_READY','RPC_REQUESTED','RPC_COMPLETED','RPC_FAILED',
 'WEIGHT_UI_RENDERED','WEIGHT_REVIEW_RECORDED','OUTPUT_READ_REQUESTED',
 'OUTPUT_READ_VERIFIED','OUTPUT_READ_FAILED','RUN_GATE_HELD',
 'RUN_AUDIT_REQUESTED','RUN_AUDIT_COMPLETED','RUN_AUDIT_FAILED',
 'NATIVE_CANDIDATE_REQUESTED','NATIVE_CANDIDATE_SUCCEEDED',
 'NATIVE_CANDIDATE_FAILED','CANDIDATE_STAGE','RUN_GATE_DIAGNOSED',
 'SESSION_REUSED',
 'SESSION_CANCELLED','SESSION_REPLACED','FLOW_ERROR']);
const actor=new Set(['preview-ui','weight-ui','output-ui','ui-controller',
 'census-worker','gc-pw-worker','preview-child-worker','native-gate']);
const counter=new Set(['physical','facts','sourceMass','match1','final',
 'unresolved','qualifiedCandidates','branches']);
const fields=new Set(['seq','elapsedMs','kind','actor','rpcSeq','step','code','counts']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const result=(status,issues=[],firstGap=null,summary={})=>Object.freeze({
 schema:XML229_FLOW_AUDIT_SCHEMA,status,issues,firstGap,summary,
 independentSourceVerified:false,nativeCiiReleaseAuthorized:false,
});
function validEvent(e){
 if(!object(e)||Object.keys(e).some(k=>!fields.has(k))||
    !whole(e.seq)||e.seq<1||!whole(e.elapsedMs)||
    !kind.has(e.kind)||!actor.has(e.actor))return false;
 if(e.rpcSeq!==undefined&&(!whole(e.rpcSeq)||e.rpcSeq<1))return false;
 if(e.step!==undefined&&!/^[a-z][a-z0-9-]{0,63}$/.test(e.step))return false;
 if(e.code!==undefined&&!/^[A-Z][A-Z0-9_]{2,63}$/.test(e.code))return false;
 return e.counts===undefined||(object(e.counts)&&
   Object.entries(e.counts).every(([key,n])=>counter.has(key)&&whole(n)));
}
export function auditXml229CrossWorkerFlowTrace(trace){
 if(trace?.schema!=='XML229.CrossWorkerFlowTrace.v1'||
    !Array.isArray(trace.events)||trace.events.length>1024||
    !whole(trace.totalEvents)||!whole(trace.droppedEvents)||
    trace.nativeCiiReleaseAuthorized!==false||
    !trace.events.every(validEvent))
   return result('INVALID',['TRACE_ENVELOPE_INVALID']);
 const events=trace.events;
 if(events.length+trace.droppedEvents!==trace.totalEvents)
   return result('INVALID',['TRACE_WINDOW_COUNT_MISMATCH']);
 const seen=new Set(),requests=new Set(),issues=[];
 let previous=0,firstGap=null,latestCounts=null,firstFailure=null;
 const fault=(code,e)=>{issues.push(code);
   if(!firstGap)firstGap={atSequence:e.seq,code};};
 for(const e of events){
   if(e.seq<=previous){fault('NON_MONOTONIC_EVENT_ORDER',e);break;}
   previous=e.seq;
   if(e.counts?.physical!==undefined)latestCounts=e.counts;
   if(e.kind==='RPC_REQUESTED'&&e.rpcSeq)requests.add(e.rpcSeq);
   if((e.kind==='RPC_COMPLETED'||e.kind==='RPC_FAILED')&&e.rpcSeq&&
      !requests.has(e.rpcSeq)&&trace.droppedEvents===0)
     fault('RPC_RESPONSE_WITHOUT_REQUEST',e);
   if(e.kind==='CENSUS_VERIFIED'&&!seen.has('CENSUS_REQUESTED')&&
      trace.droppedEvents===0)fault('CENSUS_WITHOUT_DISPATCH',e);
   if(e.kind==='PREVIEW_CHILD_COMPLETED'&&!seen.has('PREVIEW_CHILD_REQUESTED')&&
      trace.droppedEvents===0)fault('PREVIEW_CHILD_RETURN_WITHOUT_DISPATCH',e);
   if(e.kind==='FACTS_OPENED'&&!seen.has('PREVIEW_CHILD_COMPLETED')&&
      trace.droppedEvents===0)fault('FACTS_BEFORE_CHILD_PREVIEW',e);
   if(e.kind==='GC_PW_READY'&&e.actor==='gc-pw-worker'&&
      !seen.has('FACTS_OPENED')&&trace.droppedEvents===0)
     fault('GC_PW_READY_BEFORE_FACTS',e);
   if(e.kind==='OUTPUT_READ_VERIFIED'&&!seen.has('OUTPUT_READ_REQUESTED')&&
      trace.droppedEvents===0)fault('OUTPUT_PROOF_WITHOUT_REQUEST',e);
   if(e.counts?.physical!==undefined&&e.counts?.facts!==undefined&&
      e.counts.physical*7!==e.counts.facts)
     fault('PHYSICAL_FACT_SEVEN_TO_ONE_DRIFT',e);
   if((e.kind==='FLOW_ERROR'||e.kind==='RPC_FAILED'||e.kind==='OUTPUT_READ_FAILED')&&
      !firstFailure)firstFailure={atSequence:e.seq,code:e.code||'UNTYPED_FLOW_FAILURE'};
   seen.add(e.kind);
 }
 if(firstFailure)issues.push('FLOW_ERROR_OBSERVED');
 if(seen.has('RUN_GATE_HELD'))issues.push('NATIVE_RELEASE_HOLD_EXPECTED');
 if(latestCounts?.unresolved>0)issues.push('ENGINEERING_MASS_UNRESOLVED');
 if(trace.droppedEvents)issues.push('TRACE_WINDOW_TRUNCATED');
 const summary={
   eventCount:events.length,hasCensus:seen.has('CENSUS_VERIFIED'),
   hasPreviewChild:seen.has('PREVIEW_CHILD_COMPLETED'),
   hasPhysicalFacts:seen.has('FACTS_OPENED'),
   hasWorkerReview:seen.has('GC_PW_READY'),
   hasOutputRead:seen.has('OUTPUT_READ_VERIFIED'),
   hasNativeHold:seen.has('RUN_GATE_HELD'),
   ...(latestCounts?{physical:latestCounts.physical??null,
     facts:latestCounts.facts??null,unresolved:latestCounts.unresolved??null}:{}),
 };
 return result(firstGap||firstFailure?'BROKEN_FLOW':
   seen.has('RUN_GATE_HELD')?'EXPECTED_RELEASE_HOLD':
   seen.has('GC_PW_READY')?'OBSERVED_REVIEW_FLOW':'PARTIAL_FLOW',
   [...new Set(issues)],firstGap||firstFailure,summary);
}
