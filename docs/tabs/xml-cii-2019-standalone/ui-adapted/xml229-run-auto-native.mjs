/** Automatically attempt governed native CII once per verified Worker session.
 * This schedules only the existing guarded Run button; it never accepts mass,
 * overrides a HOLD, fabricates CII output, or retries failed conversions.
 */
const attempted=new WeakSet();
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';
const currentWorker=(session,stateRef)=>!!session&&!session.closed&&
  typeof session.readNativeFinalPacket==='function'&&
  ((session.receipt?.reviewSourceKind==='XML_ONLY'&&
    !hasXml229PreviewJsonSource(stateRef?.current)&&session.receipt.originalJsonSha256===null&&
    session.receipt.sourceGenerationId==='xml-only:sha256:'+session.receipt.sourceXmlSha256)||
  (stateRef?.current?.xml229StagedSourceReceipt?.schema===
    'XML229.OriginalStagedSourceReceipt.v1'&&
  stateRef.current.xml229StagedSourceReceipt.sha256===
    session.receipt?.originalJsonSha256&&
  stateRef.current.xml229StagedSourceReceipt.generationId===
    session.receipt?.sourceGenerationId));

export function xml229CanAutoRunVerifiedFinal({state,report,session}={}){
 const checks=Array.isArray(report?.checklistRows)?report.checklistRows:[];
 return !!state&&state.activePhaseId==='run'&&state.running!==true&&
   !state.result?.ciiText&&!state.result?.xml229NativeOutput&&
   state.result?.ok!==false&&!state.result?.error&&!state.xml229XmlOnlyApproval&&
   report?.raw?.xml229VerifiedEngineering===true&&
   checks.some(r=>r.id==='weight-match'&&r.status==='ready'&&
     r.blocking!==true)&&
   checks.every(r=>!r.blocking||
     r.id==='xml229-original-json-engineering-authority')&&
   session&&!session.closed&&typeof session.readNativeFinalPacket==='function';
}

export function offerXml229AutomaticNativeRun({
 stateRef,session,report,button,liveWorker,
}={}){
 if(!stateRef||!session||!button||typeof liveWorker!=='function'||
    attempted.has(session)||
    !xml229CanAutoRunVerifiedFinal({state:stateRef.current,report,session})||
    !currentWorker(session,stateRef)||liveWorker()!==session)return false;
 queueMicrotask(()=>{
   if(attempted.has(session)||button.isConnected===false||
      button.disabled||button.dataset?.action!=='xml229-native-run'||
      liveWorker()!==session||!currentWorker(session,stateRef)||
      !xml229CanAutoRunVerifiedFinal({state:stateRef.current,report,session}))
     return;
   attempted.add(session);
   button.click();
 });
 return true;
}

