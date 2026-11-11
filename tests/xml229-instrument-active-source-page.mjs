/** Browser fixture: real source/index/Weight Workers, production UI and guards.
 * Only the synthetic fixture input resolver replaces four workbook uploads.
 */
import {digestCanonical} from '../contracts/gc-pw-v1/contract.mjs';
import * as panel from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js';
import * as intake from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-lfj-o1-intake.js';
import * as state from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import {singleXmlCiiSourceState} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-processing-mode.js';
import {revokeXml229VerifiedEngineeringBasis} from '../docs/tabs/xml-cii-2019-standalone/integration/xml229-engineering-basis-authority.mjs';
import {normalizeXmlCiiBranchSelection} from '../docs/tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';
import {clearModeASourceCaches} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-state.js';
import {commitXml229SelectedAppliedWeight} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-applied-weight-owner-selection.mjs';
import {inspectXml229NativeOwnerPreflight} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-owner-preflight.mjs';
import {createXml229InstrumentSourceReviewControl} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-instrument-source-review-ui.mjs';
import {startXml229InstrumentFreshReview} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml229-instrument-fresh-review.mjs';
import {renderStandaloneOutputRunPanel} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-output-run.js';
import {bindActionEvents} from '../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-events.js';
let ref,fixture,oldWorker,oldBackup,activationProof;

async function resolveFixtureInputs(){
 const raw=ref.current,text=raw.sourceText;
 const source=intake.resolveXml229CurrentPreviewBlob(ref,raw.xml229StagedSourceReceipt);
 const receipt=source.receipt;
 return {xmlText:text,sourceId:raw.modeASourceId,masters:fixture.masters,
  config:fixture.config,overrides:fixture.config.overrides||{},
  selection:[{sourceId:raw.modeASourceId,selectionRef:'all'}],
  originalStagedBlob:source.blob,originalStagedSourceReceipt:receipt,
  requestId:'instrument-'+receipt.generationId,
  inputLease:await digestCanonical({text,receipt,config:fixture.config}),
  isCurrent:()=>source.isCurrent()&&ref.current.sourceText===text};
}

export function setupInstrumentSourcePage(input){
 fixture=input;
 document.body.innerHTML='<main id="scope"><div><label>JSON <input type="file" data-field="staged-json-file"></label></div><div id="models"></div><div id="native"></div></main>';
 ref={current:{...state.createXmlCiiAdaptedWorkflowState(),sourceKind:'xml',
  xmlProcessingMode:'single',sourceText:input.xml,sourceFile:new File([input.xml],'original.xml'),
  modeASourceId:'CONTROL-INSTRUMENT-14',activePhaseId:'run',
  supportConfigJson:JSON.stringify(input.config),masterContext:input.context,
  options:{...state.createDefaultWorkflowOptions(),useRestraintTypeBasedOnJson:false}}};
 window.__instrumentActiveRef=ref;
 intake.installLfjO1SourceIntake(document.querySelector('#scope'),ref);
}

async function selectKg(session,value){
 const rows=(await session.readPage({offset:0,limit:25,filter:'all',query:''})).rows;
 for(const row of rows)await commitXml229SelectedAppliedWeight({session,row,value,
  origin:'manual',isCurrent:()=>panel.getXml229CurrentWorkerHeldReview(ref)===session});
 return rows.length;
}

export async function prepareOriginalModelReview(){
 oldWorker=await panel.openXml229P4VerifiedSession(ref,{resolveInputs:resolveFixtureInputs});
 const count=await selectKg(oldWorker,17);
 oldBackup=await oldWorker.exportReviewBackup();
 const report=inspectXml229NativeOwnerPreflight(await oldWorker.readNativeFinalPacket());
 ref.current=state.updateWorkflowState(ref.current,{result:{ok:false,xml229NativeOwnerPreflight:report}});
 const ports={getWorker:panel.getXml229CurrentWorkerHeldReview,
  open:r=>panel.openXml229P4VerifiedSession(r,{resolveInputs:resolveFixtureInputs}),
  capture:panel.captureXml229P4LiveSourceSnapshot,compare:panel.compareXml229P4LiveSourceSnapshot,
  fullSelection:panel.assertXml229P4OriginalFullSelection,
  resolveBlob:intake.resolveXml229CurrentPreviewBlob,reindex:intake.reindexXml229OriginalBlobForTopoFix,
  update:state.updateWorkflowState,reset:singleXmlCiiSourceState,
  revoke:revokeXml229VerifiedEngineeringBasis,clearCaches:clearModeASourceCaches,
  selection:normalizeXmlCiiBranchSelection,makeFile:(t,n)=>new File([t],n,{type:'application/xml'})};
 document.querySelector('#models').appendChild(createXml229InstrumentSourceReviewControl({
  readCurrent:()=>({sourceText:ref.current.sourceText,sourceFile:ref.current.sourceFile,
   sourceName:'controlled.xml',report:ref.current.result?.xml229NativeOwnerPreflight}),
  activate:async args=>{activationProof=await startXml229InstrumentFreshReview({
   ...args,stateRef:ref,container:document.querySelector('#scope'),ports,
   sourceIsCurrent:()=>ref.current.sourceText===args.sourceText,
  });window.__instrumentActivationComplete=true;},
 }));
 return {count,blocked:report.unsupportedOwners.length,sourceSha:report.sourceXmlSha256,
  generation:oldWorker.receipt.sourceGenerationId,basis:oldWorker.receipt.basisId};
}

export async function finalizeRevisedSource(){
 const session=panel.getXml229CurrentWorkerHeldReview(ref);
 const before=await session.readCompletion(),advice=await session.readInstrumentModelingSuggestions();
 let oldBackupRejected=false;
 try{await session.restoreReviewBackup({backup:oldBackup});}catch{oldBackupRejected=true;}
 const count=await selectKg(session,1.25),packet=await session.readNativeFinalPacket();
 const blocked=inspectXml229NativeOwnerPreflight(packet).unsupportedOwners.length;
 return {before:before.counts,advice:advice.items.length,oldBackupRejected,
  oldWorkerClosed:oldWorker.closed,count,blocked,sha:packet.sourceXmlSha256,
  generation:session.receipt.sourceGenerationId,basis:session.receipt.basisId,
  sourceChanged:ref.current.sourceText!==fixture.xml,proof:activationProof.priorFinalDecisionsTransferred};
}

export function renderInstrumentNativeRun(){
 const host=document.querySelector('#native');
 const paint=()=>{renderStandaloneOutputRunPanel(host,ref,paint);bindActionEvents(host,ref,paint);};
 paint();
}

export async function instrumentRunResult(){
 const result=ref.current.result,session=panel.getXml229CurrentWorkerHeldReview(ref);
 const packet=await session.readNativeFinalPacket();
 return {ok:result?.ok,error:result?.error,output:result?.xml229NativeOutput,
  actualCiiSha256:result?.xml229ActualCiiSha256,
  sourceSha:packet.sourceXmlSha256,values:packet.components.map(c=>c.effectiveKg),
  nativeAttempt:document.querySelector('[data-xml229-native-execution]')?.textContent,
  downloads:[...document.querySelectorAll('[data-action="download-cii"]')].map(b=>({disabled:b.disabled}))};
}

export async function changeInstrumentFinalAfterOutput(){
 const session=panel.getXml229CurrentWorkerHeldReview(ref);
 const row=(await session.readPage({offset:0,limit:25,filter:'all',query:''})).rows[0];
 await commitXml229SelectedAppliedWeight({session,row,value:2,origin:'manual',
  isCurrent:()=>panel.getXml229CurrentWorkerHeldReview(ref)===session});
}
