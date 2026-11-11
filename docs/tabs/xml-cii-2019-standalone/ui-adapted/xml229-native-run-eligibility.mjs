/** Execution blockers are distinct from the post-conversion release gate. */
export function inspectXml229NativeRunEligibility({state,report,session,candidate}={}){
 const blockers=(report?.checklistRows||[]).filter(row=>row.blocking&&
  row.id!=='xml229-original-json-engineering-authority').map(row=>row.id);
 const add=id=>{if(!blockers.includes(id))blockers.push(id);};
 if(state?.running)add('native-conversion-running');
 if(state?.xmlProcessingMode==='mode-b'||
    (state?.sourceBatch?.sources?.filter(x=>x.enabled!==false).length??1)!==1)
  add('native-single-source-required');
 if(report?.raw?.xml229VerifiedEngineering!==true||
    !report?.checklistRows?.some(r=>r.id==='weight-match'&&r.status==='ready'))
  add('native-verified-final-required');
 if(!session||session.closed)add('native-live-worker-required');
 else if(typeof session.readNativeFinalPacket!=='function')
  add('native-final-packet-reader-required');
 return Object.freeze({schema:'XML229.NativeRunEligibility.v1',
  status:blockers.length?'BLOCKED':candidate?.status==='FAILED'
   ?'RETRY_AVAILABLE':'READY',
  canExecute:blockers.length===0,blockerIds:Object.freeze(blockers),
  candidateStatus:candidate?.status||'NOT_OBSERVED',
  nativeCiiReleaseAuthorized:false,ciiDownloadAuthorized:false});
}
