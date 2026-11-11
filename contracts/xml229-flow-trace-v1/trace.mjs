/**
 * XML229 v1 bounded, non-authorizing, privacy-preserving causal flow trace.
 * Never accept arbitrary object properties or raw Worker messages.
 */
export const XML229_FLOW_TRACE_SCHEMA='XML229.CrossWorkerFlowTrace.v1';
const kinds=new Set([
 'BUILD_REQUESTED','SOURCE_INPUTS_VERIFIED','CENSUS_REQUESTED','CENSUS_VERIFIED',
 'GC_PW_WORKER_REQUESTED','GC_PW_WORKER_STARTED','PREVIEW_CHILD_REQUESTED',
 'PREVIEW_CHILD_PROGRESS','PREVIEW_CHILD_COMPLETED','FACTS_OPENED',
 'GC_PW_READY','RPC_REQUESTED','RPC_COMPLETED','RPC_FAILED',
 'WEIGHT_UI_RENDERED','WEIGHT_REVIEW_RECORDED','OUTPUT_READ_REQUESTED',
 'OUTPUT_READ_VERIFIED','OUTPUT_READ_FAILED','RUN_GATE_HELD',
 'RUN_AUDIT_REQUESTED','RUN_AUDIT_COMPLETED','RUN_AUDIT_FAILED',
 'NATIVE_CANDIDATE_REQUESTED','NATIVE_CANDIDATE_SUCCEEDED',
 'NATIVE_CANDIDATE_FAILED','CANDIDATE_STAGE','RUN_GATE_DIAGNOSED',
 'SESSION_REUSED','SESSION_CANCELLED','SESSION_REPLACED','FLOW_ERROR',
]);
const actors=new Set(['preview-ui','weight-ui','output-ui','ui-controller',
 'census-worker','gc-pw-worker','preview-child-worker','native-gate']);
const counters=['physical','facts','sourceMass','match1','final','unresolved','qualifiedCandidates','branches'];
const safeCode=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{2,63}$/.test(v)?v:null;
const safeStep=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v)?v:null;
const nonneg=n=>Number.isSafeInteger(n)&&n>=0;
const fallbackId=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
 ?crypto.randomUUID():'local-flow-'+String(Date.now())+'-'+Math.random().toString(36).slice(2);
export function createXml229CrossWorkerFlowTrace({
 id=fallbackId(),clock=()=>typeof performance==='undefined'?Date.now():performance.now(),
 maxEvents=256,
}={}){
 if(typeof id!=='string'||id.length>96||!id.trim()||
    !Number.isSafeInteger(maxEvents)||maxEvents<16||maxEvents>1024)
   throw new Error('FLOW_TRACE_CONFIGURATION_INVALID');
 let seq=0,dropped=0,closed=false;
 const started=clock(),events=[];
 function record(input={}){
   if(closed)return null;
   if(!kinds.has(input.kind)||!actors.has(input.actor))
     throw new Error('FLOW_TRACE_EVENT_CONTRACT_INVALID');
   const event={seq:++seq,elapsedMs:Math.max(0,Math.round(clock()-started)),
     kind:input.kind,actor:input.actor};
   if(nonneg(input.rpcSeq)&&input.rpcSeq>0)event.rpcSeq=input.rpcSeq;
   const step=safeStep(input.step);
   if(step)event.step=step;
   const code=safeCode(input.code);
   if(code)event.code=code;
   if(input.counts&&typeof input.counts==='object'){
     const safe=Object.fromEntries(counters.filter(k=>nonneg(input.counts[k]))
       .map(k=>[k,input.counts[k]]));
     if(Object.keys(safe).length)event.counts=safe;
   }
   events.push(Object.freeze(event));
   if(events.length>maxEvents){events.shift();dropped++;}
   return event.seq;
 }
 function snapshot(){
   const list=events.map(x=>({...x,...(x.counts?{counts:{...x.counts}}:{})}));
   const latest=[...list].reverse().find(x=>x.counts?.physical!==undefined||
     x.counts?.unresolved!==undefined);
   const explicitHold=list.some(x=>x.kind==='RUN_GATE_HELD');
   const failed=list.filter(x=>x.kind==='FLOW_ERROR'||
     x.kind==='RPC_FAILED'||x.kind==='OUTPUT_READ_FAILED');
   const last=latest?.counts||{};
   const findings=[];
   if(failed.length)findings.push('FLOW_FAILURE_OBSERVED');
   if(nonneg(last.physical)&&nonneg(last.facts)&&
      last.physical*7!==last.facts)
     findings.push('PHYSICAL_FACT_POPULATION_DRIFT');
   if(nonneg(last.unresolved)&&last.unresolved>0)
     findings.push('ENGINEERING_MASS_UNRESOLVED');
   if(explicitHold)findings.push('NATIVE_RELEASE_HOLD_EXPECTED');
   if(dropped)findings.push('EARLY_EVENTS_DROPPED');
   return Object.freeze({schema:XML229_FLOW_TRACE_SCHEMA,traceId:id,
     observedEvents:list.length,totalEvents:seq,droppedEvents:dropped,
     closed,events:list,findings,
     // Diagnostics can never be mistaken for independent approval.
     independentSourceVerified:false,
     nativeCiiReleaseAuthorized:false});
 }
 return Object.freeze({get id(){return id;},record,snapshot,close(){closed=true;}});
}
