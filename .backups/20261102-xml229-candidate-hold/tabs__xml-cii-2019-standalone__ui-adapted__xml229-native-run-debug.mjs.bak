/** Visible per-attempt diagnosis. This summary never grants CII release. */
import {createElement,downloadTextFile} from './xml-cii-adapted-dom.js';
import {getXml229CandidateAttempt} from './xml229-flow-trace-registry.mjs';
import {readXml229RunClock} from './xml229-run-clock.mjs';

function message(attempt){
 const elapsed=(attempt.elapsedMs/1000).toFixed(1)+' s';
 const phase=attempt.phase||'not yet reported';
 if(attempt.status==='IDLE')return 'Conversion not started · Elapsed: 0.0 s · Waiting for review or Run eligibility.';
 if(attempt.status==='RAW_RUNNING')return 'Conversion is running. Stage: '+phase+'. Elapsed: '+elapsed+'.';
 if(attempt.status==='RAW_FAILED'||attempt.status==='RAW_FINISHED')return 'Conversion '+
   (attempt.status==='RAW_FAILED'?'failed':'finished')+'. Elapsed: '+elapsed+'.';
 if(attempt.status==='FAILED')return 'Conversion failed: '+attempt.code+
  '. Last stage: '+phase+'. Elapsed: '+elapsed+
  '. No verified CII is available from this attempt. Download the execution debug JSON for diagnosis.';
 if(attempt.status==='SUCCEEDED')return 'Conversion completed and verified in '+elapsed+'.';
 return 'Conversion is running. Stage: '+phase+'. Elapsed: '+elapsed+
  '. The conversion Worker has a five-minute execution limit.';
}
export function renderXml229NativeRunDebug(parent,stateRef,session){
 const read=()=>getXml229CandidateAttempt(stateRef,session)||readXml229RunClock(stateRef);
 const attempt=read();
 const panel=createElement('section','','xml-cii-weight-panel');
 panel.dataset.xml229NativeDebug='true';
 const status=createElement('div',message(attempt),'model-converters-workflow-detail-note');
 status.setAttribute('role',attempt.status==='FAILED'?'alert':'status');
 panel.appendChild(status);
 const button=createElement('button','Download execution debug JSON');
 button.type='button';button.dataset.action='xml229-download-native-execution-debug';
 button.addEventListener('click',()=>downloadTextFile('xml229-native-execution-debug.json',
  JSON.stringify({schema:'XML229.NativeExecutionDebug.v1',...read(),
   nativeCiiReleaseAuthorized:false,ciiDownloadAuthorized:false},null,2),
  'application/json;charset=utf-8'));
 if(!['IDLE','RAW_RUNNING','RAW_FAILED','RAW_FINISHED'].includes(attempt.status))panel.appendChild(button);
 parent.appendChild(panel);
 if(!['IN_PROGRESS','RAW_RUNNING'].includes(attempt.status))return;
 const timer=setInterval(()=>{
  const latest=read();
  if(!panel.isConnected||!latest){clearInterval(timer);return;}
  status.textContent=message(latest);
  status.setAttribute('role',latest.status==='FAILED'?'alert':'status');
  if(!['IN_PROGRESS','RAW_RUNNING'].includes(latest.status))clearInterval(timer);
 },500);
}
