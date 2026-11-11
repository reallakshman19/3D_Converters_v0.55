/**
 * UI-only per-stable-stateRef flow custody. Never stored in localStorage;
 * diagnostics capture source-bound transitions, not source data.
 */
import {createXml229CrossWorkerFlowTrace}
 from '../../../contracts/xml229-flow-trace-v1/trace.mjs';
import {nativeRunPhase} from '../../../converters/xml-cii-2019-standalone/engine-progress.mjs';
const live=new WeakMap();
const key=ref=>ref?.modeABaseRef||ref;
export function beginXml229FlowTrace(ref){
 const k=key(ref);
 if(!k||typeof k!=='object')throw Error('FLOW_STATE_REF_REQUIRED');
 const old=live.get(k);old?.record({kind:'SESSION_REPLACED',actor:'ui-controller'});
 old?.close();
 const trace=createXml229CrossWorkerFlowTrace();
 live.set(k,trace);
 return trace;
}
export function ensureXml229FlowTrace(ref){
 const k=key(ref);
 if(!k||typeof k!=='object')return null;
 const existing=live.get(k);
 if(existing)return existing;
 const trace=createXml229CrossWorkerFlowTrace();
 live.set(k,trace);
 return trace;
}
export function getXml229FlowTrace(ref){
 const k=key(ref);
 return k&&typeof k==='object'?live.get(k)||null:null;
}
export function recordXml229FlowTrace(ref,event){
 const trace=getXml229FlowTrace(ref);
 try{return trace?.record(event)??null}catch{return null;}
}

/**
 * Session-only candidate attempt summary. Never persists raw CII, original
 * occurrence IDs, source bytes, hashes or Worker payloads. Bound by SESSION
 * object identity, so a previous candidate cannot authorize a new source.
 */
const candidateAttempts=new WeakMap();
const safeKind=x=>['IN_PROGRESS','FAILED','SUCCEEDED'].includes(x)?x:'FAILED';
const safeFailure=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{2,79}$/.test(x)
  ?x:'NATIVE_CANDIDATE_FAILED';
const count=n=>Number.isSafeInteger(n)&&n>=0?n:undefined;
export function recordXml229CandidateAttempt(ref,session,value={}){
 const k=key(ref);
 if(!k||typeof k!=='object'||!session||typeof session!=='object')return;
 const status=safeKind(value.status);
 const prior=candidateAttempts.get(k);
 const continuing=prior?.session===session&&prior.status==='IN_PROGRESS';
 const startedAtMs=continuing?prior.startedAtMs:Date.now();
 const phase=nativeRunPhase(value.phase)||(continuing?prior.phase:null);
 const stages=continuing?[...prior.stages]:[];
 if(phase&&stages.at(-1)?.phase!==phase)
  stages.push({phase,elapsedMs:Math.max(0,Date.now()-startedAtMs)});
 const entry={session,status,
   startedAtMs,finishedAtMs:status==='IN_PROGRESS'?null:Date.now(),
   ...(phase?{phase}:{}),stages:Object.freeze(stages.slice(-32)),
   ...(status==='FAILED'?{code:safeFailure(value.code)}:{}),
   ...(count(value.nativeRigidObserved)!==undefined?
     {nativeRigidObserved:value.nativeRigidObserved}:{}),
   ...(count(value.unresolvedNativeOwners)!==undefined?
     {unresolvedNativeOwners:value.unresolvedNativeOwners}:{})};
 candidateAttempts.set(k,Object.freeze(entry));
}
export function getXml229CandidateAttempt(ref,session){
 const saved=candidateAttempts.get(key(ref));
 if(!saved||saved.session!==session||session?.closed===true)return null;
 const {session:ignored,startedAtMs,finishedAtMs,stages,...safe}=saved;
 return Object.freeze({...safe,
  elapsedMs:Math.max(0,(finishedAtMs??Date.now())-startedAtMs),
  stages:stages.map(row=>({...row})),
 });
}
