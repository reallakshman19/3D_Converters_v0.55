/** UI orchestration only; injected runner must perform native verification. */
import {captureXml229NativeRunContext} from './xml229-native-run-context.mjs';
import {ensureXml229FlowTrace,recordXml229FlowTrace,
 recordXml229CandidateAttempt} from './xml229-flow-trace-registry.mjs';

import {nativeEnrichedFields} from '../../../converters/xml-cii-2019-standalone/native-enriched-artifact.js';
import {nativeRunPhase} from '../../../converters/xml-cii-2019-standalone/engine-progress.mjs';

const active=new WeakMap();
const owner=ref=>ref?.modeABaseRef||ref;
const codeOf=error=>/^[A-Z][A-Z0-9_]{2,79}$/.test(error?.code||'')
 ?error.code:'NATIVE_CII_RECONCILIATION_FAILED';
function record(ref,session,status,code){
 recordXml229CandidateAttempt(ref,session,{status,code});
 recordXml229FlowTrace(ref,{actor:'native-gate',
  kind:status==='IN_PROGRESS'?'NATIVE_CANDIDATE_REQUESTED':
   status==='SUCCEEDED'?'NATIVE_CANDIDATE_SUCCEEDED':'NATIVE_CANDIDATE_FAILED',
  ...(code?{code}:{}),
 });
}
function failedResult(error){
 return {ok:false,error:codeOf(error),
  ...nativeEnrichedFields(error?.xml229EnrichedArtifact),
  ...(error?.xml229NativeFailure?.schema==='XML229.NativeConverterFailure.v1'
   ?{xml229NativeFailure:error.xml229NativeFailure}:{}),
  ...(error?.xml229NativeOwnerPreflight?.unsupportedOwners?.length
   ?{xml229NativeOwnerPreflight:error.xml229NativeOwnerPreflight}:{})};
}
export async function executeXml229NativeRun({
 stateRef,session,liveWorker,runCandidate,updateState,render,download,
}){
 const key=owner(stateRef);
 if(!key||active.has(key)||stateRef.current?.running)return false;
 const token={};active.set(key,token);
 ensureXml229FlowTrace(stateRef);
 const sameSession=()=>session&&!session.closed&&liveWorker()===session;
 const onProgress=phase=>{
  if(!nativeRunPhase(phase)||!sameSession()||active.get(key)!==token)return;
  recordXml229CandidateAttempt(stateRef,session,{status:'IN_PROGRESS',phase});
  recordXml229FlowTrace(stateRef,{kind:'CANDIDATE_STAGE',actor:'native-gate',code:phase});
 };
 let context;
 try{
  record(stateRef,session,'IN_PROGRESS');
  context=captureXml229NativeRunContext({stateRef,session,liveWorker});
  if(!context?.isCurrent())throw {code:'NATIVE_RUN_SOURCE_CHANGED'};
  stateRef.current=updateState(stateRef.current,{running:true,result:null});
  render?.();
  const verified=await runCandidate({state:context.state,session,
    isCurrent:context.isCurrent,onProgress});
  if(!context.isCurrent()||verified?.nativeCiiReleaseAuthorized!==true||
     verified?.massConsumptionVerified!==true||
     verified?.strictOneToOneOwnerMatch!==true||!verified?.ciiText?.trim())
   throw {code:'NATIVE_RUN_SOURCE_CHANGED_OR_OUTPUT_UNVERIFIED'};
  const result={ok:true,...nativeEnrichedFields(verified),ciiText:verified.ciiText,
   ciiName:'xml229-verified-native.cii',
   xml229ActualCiiSha256:verified.actualCiiSha256,xml229NativeOutput:verified};
  stateRef.current=updateState(stateRef.current,{result});
  // State routing may itself alter inputs; challenge again before download.
  if(!context.isCurrent()){
   stateRef.current=updateState(stateRef.current,{result:null});
   throw {code:'NATIVE_RUN_SOURCE_CHANGED'};
  }
  onProgress('OUTPUT_VERIFIED');
  record(stateRef,session,'SUCCEEDED');
  try{download(result.ciiName,result.ciiText,'text/plain;charset=utf-8');}
  catch{recordXml229FlowTrace(stateRef,{kind:'CANDIDATE_STAGE',
    actor:'output-ui',code:'AUTO_DOWNLOAD_UNAVAILABLE'});}
  return true;
 }catch(error){
  if(sameSession()){
   onProgress(error?.phase);
   record(stateRef,session,'FAILED',codeOf(error));
   // A safe failure explains the attempt; it grants no source/output authority.
   const failure=context&&!context.isCurrent()
    ?{code:'NATIVE_RUN_SOURCE_CHANGED'}:error;
   stateRef.current=updateState(stateRef.current,{result:failedResult(failure)});
  }
  return false;
 }finally{
  if(active.get(key)===token){
   active.delete(key);
   stateRef.current=updateState(stateRef.current,{running:false});
   render?.();
  }
 }
}
