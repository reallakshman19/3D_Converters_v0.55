/** Run paints asynchronously. Own download handlers on EVERY new button;
 * binding once in the outer workflow leaves replacement controls inert.
 */
import {createElement,downloadTextFile} from './xml-cii-adapted-dom.js';
import {maskedFileName} from '../xml-cii-workflow-source-detect.js';
import {getXml229VerifiedEngineeringEntry} from '../integration/xml229-engineering-basis-authority.mjs';
import {captureXml229NativeRunContext} from './xml229-native-run-context.mjs';
import {readXml229NativeFinalObservation} from '../integration/xml229-native-final-observation.mjs';
import {hasXml229GovernedNativeHold} from '../integration/xml229-output-participation.mjs';
import {digestUtf8} from '../../../contracts/gc-pw-v1/contract.mjs';
const deny=()=>{throw new Error('CII_DOWNLOAD_CURRENT_FINAL_REQUIRED');};

function sourceSnapshot(state){
 return {text:state.sourceText,file:state.sourceFile,config:state.supportConfigJson,
  options:JSON.stringify(state.options||{}),selection:JSON.stringify(state.branchSelection||{}),
  receipt:state.xml229StagedSourceReceipt,result:state.result};
}
function matches(snapshot,state){
 const next=sourceSnapshot(state);
 return Object.keys(snapshot).every(k=>snapshot[k]===next[k]);
}

async function challengeGovernedCii(stateRef,result){
 const session=getXml229VerifiedEngineeringEntry(stateRef)?.session;
 const context=captureXml229NativeRunContext({stateRef,session,
  liveWorker:()=>getXml229VerifiedEngineeringEntry(stateRef)?.session});
 const native=result?.xml229NativeOutput;
 if(!context?.isCurrent()||native?.schema!=='XML229.GovernedNativeCandidateResult.v1'||
  native.nativeCiiReleaseAuthorized!==true||native.massConsumptionVerified!==true||
  native.strictOneToOneOwnerMatch!==true||result.ok!==true||native.ciiText!==result.ciiText)
  deny();
 const [sourceSha,ciiSha]=await Promise.all([
  digestUtf8(context.state.sourceText),digestUtf8(result.ciiText)]);
 const observed=await readXml229NativeFinalObservation(session,context.isCurrent);
 const c=observed.completion,f=observed.finalIntent;
 if(observed.stale||!context.isCurrent()||stateRef.current.result!==result||
  native.sourceXmlSha256!==sourceSha||native.actualCiiSha256!==ciiSha||
  result.xml229ActualCiiSha256!==ciiSha||native.basisId!==c?.basisId||
  native.sourceId!==c?.sourceId||native.sourceGenerationId!==c?.sourceGenerationId||
  native.originalJsonSha256!==c?.originalJsonSha256||native.physicalCount!==c?.verifiedPhysicalCount||
  !f?.intentSha256||native.finalIntentSha256!==f.intentSha256)
  deny();
}

function payload(state,row,report){
 const r=state.result;
 if(row.kind==='cii')return {name:r?.ciiName,text:r?.ciiText,mime:'text/plain;charset=utf-8'};
 if(row.kind==='enriched')return {name:r?.enrichedName,text:r?.enrichedText,mime:'application/xml;charset=utf-8'};
 if(row.kind==='diagnostics')return {name:'xml-cii-diagnostics.json',
  text:JSON.stringify(r?.diagnostics||{},null,2),mime:'application/json;charset=utf-8'};
 return {name:'xml-cii-run-manifest.json',text:JSON.stringify(report.manifest||{},null,2),mime:'application/json;charset=utf-8'};
}

export function bindXml229RunArtifactDownloads(parent,{stateRef,report}){
 const snapshot=sourceSnapshot(stateRef.current);
 const status=createElement('div','','model-converters-workflow-detail-note');
 status.dataset.xml229ArtifactDownloadStatus='true';status.setAttribute('role','status');
 for(const row of report.artifactRows||[]){
  const action=row.downloadAction||'download-'+row.kind;
  for(const button of parent.querySelectorAll('[data-action="'+action+'"]')){
   button.addEventListener('click',async event=>{
    // Capturing ownership covers the existing preview control too, and
    // prevents a second, unchallenged outer/legacy handler from also firing.
    event.stopImmediatePropagation();
    if(button.disabled||!row.available)return;
    button.disabled=true;
    try{
     if(!matches(snapshot,stateRef.current))deny();
     const state=stateRef.current,artifact=payload(state,row,report);
     if(!artifact.text)deny();
     if(row.kind==='cii'&&(state.result?.xml229NativeOutput||hasXml229GovernedNativeHold(state)))
      await challengeGovernedCii(stateRef,state.result);
     if(!matches(snapshot,stateRef.current)||!button.isConnected)deny();
     downloadTextFile(maskedFileName(artifact.name||row.filename||'output.txt'),artifact.text,artifact.mime);
     status.textContent='Download created.';button.disabled=false;
    }catch{status.textContent='Download held: current source or Final review changed. Run conversion again.';}
   },true);
  }
 }
 parent.appendChild(status);
}
