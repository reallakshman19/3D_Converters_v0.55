/**
 * XML229 P4-D opt-in, source-attested one-flow Weight Match-1 / Final review.
 * Does not replace legacy Weight(kg), native CII Run, or persist issue.key
 * weights. Large original staged JSON remains INSIDE its GC-PW Worker.
 */
import {openXml229WorkerHeldOriginalWeightReview} from '../integration/xml229-original-blob-gcpw-client.mjs';
import {resolveXml229CurrentPreviewBlob} from './xml-cii-adapted-lfj-o1-intake.js';
import {xmlCiiEnrichedConfigFromState} from './xml-cii-adapted-state.js';
import {materializeXmlCiiDatasetBackedConfig} from '../xml-cii-dataset-backed-config.js';
import {resolveXml229FourMasterCustody} from '../integration/xml229-four-master-custody.mjs';
import {digestCanonical,canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
import {xmlCiiBranchScopeFromState,xmlCiiSourceDigest} from '../xml-cii-branch-scope.js';
import {renderXml229WeightReviewPage,formatXml229DecisionAuditSummary} from './xml229-p4-weight-review-presentation.mjs';
import {planXml229RigidWeightDrafts,planXml229UnqualifiedDrafts,formatXml229Match1Exclusions,hydrateXml229WeightDraftInputs} from './xml229-p4-unqualified-drafts.mjs';
import {disarmXml229EditedDraft} from './xml229-p4-two-click-confirmation.mjs';
import {planXml229SkipWeightDrafts} from './xml229-p4-skip-weight-drafts.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';
import {prepareXml229G3G4LocalAggregateExport} from './xml229-g3g4-local-aggregate-export.mjs';
import {downloadXml229FullSourceSafety} from './xml229-full-source-safety-download.mjs';
import {downloadXml229OwnerBasisCustody} from './xml229-owner-basis-custody-download.mjs';
import {beginXml229FlowTrace,getXml229FlowTrace,recordXml229FlowTrace} from './xml229-flow-trace-registry.mjs';
import {getXml229VerifiedEngineeringEntry,beginXml229VerifiedEngineeringBuild,
 publishXml229VerifiedEngineeringBuild,revokeXml229VerifiedEngineeringBasis}
 from '../integration/xml229-engineering-basis-authority.mjs';
const err=(code,detail)=>{const e=new Error(detail||code);e.code=code;throw e;};
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
 .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const labelKg=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?n+' kg':'—';
/**
 * The Worker InputBasis is source bytes + committed original Blob generation +
 * effective config/master revisions + physical selection. UI-only revision
 * bookkeeping and a new File wrapper around the same XML are NOT changes to
 * the verified source/master basis. These were false-staling the live Weight
 * Review after ordinary phase navigation and background UI hydration.
 */
const ownerScope=value=>{
 const s=String(value??'').trim();
 return !s||s==='ALL'||s==='__ALL__'?'__ALL__':s;
};
const configEquivalent=(a,b)=>{
 if(a===b)return true;
 try{return canonicalJson(JSON.parse(a||'{}'))===canonicalJson(JSON.parse(b||'{}'));}
 catch{return false;}
};
export const captureXml229P4LiveSourceSnapshot=(raw,sourceId)=>({
 sourceId,
 sourceText:raw?.sourceText,
 supportConfigJson:raw?.supportConfigJson,
 scope:JSON.stringify(raw?.branchSelection||{}),
 jsonTraceScopeId:ownerScope(raw?.jsonTraceScopeId),
 selectedScopeId:ownerScope(raw?.selectedScopeId),
 requestedOwnerZoneScopeId:ownerScope(raw?.requestedOwnerZoneScopeId),
 datasetRefs:JSON.stringify(raw?.masterContext?.datasetRefs||{}),
 mappingRevisions:JSON.stringify(raw?.masterContext?.appliedMappingRevision||{}),
 rowCounts:JSON.stringify(raw?.masterContext?.rowCounts||{}),
});
export function compareXml229P4LiveSourceSnapshot(basis,current,{
 verifyFullSelection=()=>false,
}={}){
 if(!basis||!current)return false;
 const activeId=String(current?.modeASourceId||current?.sourceBatch?.activeSourceId||basis.sourceId);
 if(activeId!==basis.sourceId)return false;
 const latest=captureXml229P4LiveSourceSnapshot(current,basis.sourceId);
 // A normalized/expanded "all branches" representation has the same
 // physical identity. A genuine partial/stale selection still fails closed.
 if(basis.scope!==latest.scope){
   try{if(!verifyFullSelection(current))return false;}
   catch{return false;}
 }
 for(const key of Object.keys(basis)){
   if(key==='scope')continue;
   if(key==='supportConfigJson'){
     if(!configEquivalent(basis.supportConfigJson,latest.supportConfigJson))return false;
   }else if(!Object.is(basis[key],latest[key]))return false;
 }
 return true;
}

/** Engineering physical scope cannot silently normalize a stale selection to ALL.
 * A genuine 28/28 original-source selection passes; 28/41 and stale data HOLD.
 */
export function assertXml229P4OriginalFullSelection({
 sourceText,branchSelection={},
}={}){
 if(typeof sourceText!=='string'||!sourceText.trim())
  err('ORIGINAL_XML_REQUIRED','Original XML is required for physical-source custody');
 const ids=branchSelection?.selectedBranchOccurrenceIds;
 const names=branchSelection?.selectedBranchNames;
 const explicitlySelected=Array.isArray(ids)||Array.isArray(names);
 const digest=xmlCiiSourceDigest(sourceText);
 if(explicitlySelected&&branchSelection?.sourceDigest!==digest)
  err('STALE_OR_UNBOUND_SELECTION',
   'Explicit branch selection is not bound to current original XML. Reselect before physical Weight review; no ALL fallback');
 const scope=xmlCiiBranchScopeFromState({
  sourceKind:'xml',sourceText,branchSelection,
 });
 if(!scope.applicable||scope.blocked||
    !Array.isArray(scope.sourceBranchOccurrences)||!scope.sourceBranchOccurrences.length||
    scope.selectedBranchOccurrences?.length!==scope.sourceBranchOccurrences.length||
    scope.excludedBranchOccurrences?.length!==0)
  err('PARTIAL_XML_SCOPE_HELD',
   'Selected '+(scope.selectedBranchOccurrences?.length??0)+' of '+
   (scope.sourceBranchOccurrences?.length??0)+
   ' original branch occurrences. A verified subset census is required; no ALL fallback');
 if(Array.isArray(ids)&&(new Set(ids).size!==ids.length||
    ids.length!==scope.sourceBranchOccurrences.length))
  err('ORIGINAL_BRANCH_OCCURRENCE_SET_DRIFT',
   'Duplicate or missing original selected branch occurrence ID');
 return scope;
}
/** Resolve a genuine existing O1 File Blob and all four current masters.
 * One complete original Mode A branch selection only; refuse uncertain joins.
 */
export async function resolveXml229P4ProductionInputs(stateRef){
 const baseRef=stateRef?.modeABaseRef||stateRef,raw=baseRef?.current;
 const view=stateRef?.current||raw;
 if(!raw?.sourceText||!raw?.xml229StagedSourceReceipt)
   err('ORIGINAL_O1_BLOB_REQUIRED','Load original XML + O1 indexed JSON first');
 const sourceId=String(view?.modeASourceId||raw?.modeASourceId||
   raw?.sourceBatch?.activeSourceId||'');
 if(raw.sourceBatch?.activeSourceId&&view?.modeASourceId&&
    raw.sourceBatch.activeSourceId!==view.modeASourceId)
   err('INACTIVE_MODE_A_SOURCE_NOT_ATTESTED',
     'Switch to this XML source in Source & Master before building its original-JSON engineering Preview; never borrow the active source Blob');
 if(!sourceId)err('ORIGINAL_SOURCE_ID_REQUIRED','Select one original XML source');
 const selection=assertXml229P4OriginalFullSelection({
  sourceText:raw.sourceText,branchSelection:raw.branchSelection||{},
 });
 const source=resolveXml229CurrentPreviewBlob(baseRef,raw.xml229StagedSourceReceipt);
 const before=captureXml229P4LiveSourceSnapshot(raw,sourceId);
 const context=view.masterContext||raw.masterContext||{};
 const config=await materializeXmlCiiDatasetBackedConfig(
   xmlCiiEnrichedConfigFromState(view),{...view,masterContext:context});
 const {masters,attestations}=await resolveXml229FourMasterCustody(config,context,{
   restoreFailures:raw.masterRestoreFailures||view.masterRestoreFailures||{},
 });
 const isCurrent=()=>{
   if(!source.isCurrent())return false;
   const current=baseRef.current;
   return compareXml229P4LiveSourceSnapshot(before,current,{
     verifyFullSelection:state=>{
       try{
         assertXml229P4OriginalFullSelection({
           sourceText:state.sourceText,branchSelection:state.branchSelection||{},
         });
         return true;
       }catch{return false;}
     },
   });
 };
 if(!isCurrent())
   err('STALE_ORIGINAL_MASTER_SOURCE','Original XML, stage, master or Owner selection changed during hydration');
 const inputLease=await digestCanonical({sourceId,xmlText:raw.sourceText,
   receiptSha:source.receipt.sha256,generationId:source.receipt.generationId,
   selectionRef:'all',config,attestations});
 if(!isCurrent())err('STALE_ORIGINAL_MASTER_SOURCE',
   'Original source/master changed during full content attestation');
 return {xmlText:raw.sourceText,sourceId,masters,
   selection:[{sourceId,selectionRef:'all'}],
   config,overrides:config.overrides||{},
   originalStagedBlob:source.blob,
   originalStagedSourceReceipt:source.receipt,
   requestId:'xml229-p4-'+source.generationId+'-'+sourceId,
   inputLease,isCurrent};
}
/** Reuse exactly one source-attested original Worker review across Preview
 * and Weight. Rebuild revokes the previous InputBasis and its decisions.
 */
export async function openXml229P4VerifiedSession(stateRef,{
  resolveInputs=()=>resolveXml229P4ProductionInputs(stateRef),
  onProgress=()=>{},signal=null,
}={}){
 const key=stateRef?.modeABaseRef||stateRef;
 if(!key)err('STATE_REF_REQUIRED','Stable source reference required');
 if(signal?.aborted)err('CANCELLED','Preview was cancelled before Worker attestation');
 const trace=beginXml229FlowTrace(key);
 trace.record({kind:'BUILD_REQUESTED',actor:'preview-ui'});
 const inputs=await resolveInputs();
 trace.record({kind:'SOURCE_INPUTS_VERIFIED',actor:'ui-controller'});
 if(signal?.aborted)err('CANCELLED','Preview was cancelled during source/master hydration');
 const lease=inputs.inputLease||null;
 const previous=getXml229VerifiedEngineeringEntry(key);
 if(previous&&lease&&lease===previous.lease){
   try{
     await previous.session.readCompletion();
     trace.record({kind:'SESSION_REUSED',actor:'ui-controller'});
     if(signal?.aborted)err('CANCELLED','Preview was cancelled during existing verified Worker read');
     return previous.session;
   }
   catch{/* genuinely stale/cancelled prior session cannot be reused */}
 }
 // One source-bound authority per stable baseRef, independent of DOM
 // ownership. A newer build invalidates an in-flight predecessor (CAS).
 const ticket=beginXml229VerifiedEngineeringBuild(key);
 const session=await openXml229WorkerHeldOriginalWeightReview({...inputs,onProgress,signal,
   onFlowTrace:event=>{try{trace.record(event)}catch{}}});
 if(signal?.aborted){session.cancel();err('CANCELLED','Preview was cancelled during Worker verification');}
 if(inputs.isCurrent?.()!==true){session.cancel();err('STALE_INPUT',
   'Original source or master changed during Worker verification');}
 const verifiedLease=lease||session.receipt?.basisId;
 if(!publishXml229VerifiedEngineeringBuild(ticket,{lease:verifiedLease,session}))
   err('ENGINEERING_BASIS_SUPERSEDED',
     'A newer verified Preview replaced this engineering source review');
 trace.record({kind:'GC_PW_READY',actor:'ui-controller',
   counts:{physical:session.receipt?.physicalCount,facts:session.receipt?.physicalFactCount}});
 return session;
}
export function getXml229CurrentWorkerHeldReview(stateRef){
 return getXml229VerifiedEngineeringEntry(stateRef)?.session||null;
}
/** The opt-in panel remains usable even if legacy Weight Match/UI is present.
 * A supplied resolveInputs in a Chromium fixture does not bypass Worker
 * full source+master and original-BLOB attestation checks.
 */
export function installXml229WorkerHeldWeightPanel(container,stateRef,{
 resolveInputs=()=>resolveXml229P4ProductionInputs(stateRef),
 existingWorkflow=false,
}={}){
 if(!container)throw new Error('Weight review container required');
 container.innerHTML=`<section data-p4-weight-root
  style="border:1px solid #64748b;border-radius:8px;padding:12px;margin:12px 0;">
  <strong>${existingWorkflow?'Weight Match — verified original physical facts':'Original-source Weight review (GC-PW)'}</strong>
  <p style="font-size:12px;color:#94a3b8;">Independent original XML census + full staged JSON Blob verification in separate Workers.
  Applied Weight is an editable session-only draft. Suggestion and Skip Weight actions
  never accept Match-1/Final or change native CII Run authorization.</p>
  ${existingWorkflow?'':'<button type="button" data-p4-weight-build>Build verified original-source Weight review</button>'}
  <span role="status" data-p4-weight-status style="margin-left:8px;"></span>
  <pre data-p4-bulk-detail role="status" hidden
   style="white-space:pre-wrap;font-size:12px;color:#cbd5e1;background:#101e32;padding:8px;border-radius:6px;"></pre>
  <div style="margin:10px 0"><button type="button" data-p4-export-flow-trace
   class="model-converters-download-btn">Download Worker/UI causal flow trace (private)</button>
   <small style="display:block;color:#94a3b8">Read-only session/Worker transitions, typed failures, fact/review counts and native gate. No source or master rows.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-export-candidate-readiness
   class="model-converters-download-btn">Download candidate coverage + readiness (private)</button>
   <small style="display:block;color:#94a3b8">Same verified Worker, read-only aggregate counts; keep file private. Does not authorize native CII.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-full-source-safety class="model-converters-download-btn">Download full-source Weight safety precheck (private)</button><small style="display:block;color:#94a3b8">Requires empty review ledger; no source rows, approval or native CII release.</small></div>
  <div><button type="button" data-p4-export-effective-basis class="model-converters-download-btn">Download current effective 4-master custody (OWNER PRIVATE)</button><small>Includes private config and normalized master rows. Keep local; no source XML/JSON or approvals.</small></div>
  <div style="margin:10px 0"><button type="button" data-p4-audit-decisions
   class="model-converters-download-btn">Download verified decision provenance JSON</button>
   <small style="display:block;color:#94a3b8">Read-only source-bound Match-1/Final audit. Bulk command IDs alone do not prove an earlier confirmation click. No native CII release.</small></div>
   <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <button type="button" data-p4-save-review class="model-converters-download-btn">Save GC-PW review file</button>
    <button type="button" data-p4-choose-review class="model-converters-download-btn">Restore GC-PW review file</button>
    <input type="file" data-p4-import-review accept=".json,application/json"
      aria-label="Select an Owner-controlled GC-PW review file" hidden>
    <small style="color:#94a3b8">Explicit local file only, same exact verified source/masters InputBasis. Save BEFORE reload; restoring does not approve Final or native CII Run.</small>
   </div>
  <div data-p4-weight-table></div></section>`;
 const root=container.querySelector('[data-p4-weight-root]');
 const status=root.querySelector('[data-p4-weight-status]');
 const bulkDetail=root.querySelector('[data-p4-bulk-detail]');
 const table=root.querySelector('[data-p4-weight-table]');
 const build=root.querySelector('[data-p4-weight-build]');
 const key=stateRef?.modeABaseRef||stateRef;
 let active=getXml229CurrentWorkerHeldReview(stateRef),offset=0,busy=false;
 let mode='rigid',query='',pendingBulk=null,searchTimer=null,renderSequence=0,minScorePercent=80;
 let draftOwner=active,draftValues=new Map();
 const clearDrafts=()=>{draftOwner=active;draftValues.clear();bulkDetail.hidden=true;bulkDetail.textContent='';};
 const captureDraft=tr=>{
   if(!tr||!active||draftOwner!==active||live()!==active)return;
   if(disarmXml229EditedDraft(tr,root.__p4VisibleRows,draftValues,
     pendingBulk,table,bulkDetail)){
     pendingBulk=null;
     say('Applied Weight edited; the previous suggestion plan was invalidated. No mass approved.');
   }
 };
 const say=(message,bad=false)=>{
   status.textContent=message;status.style.color=bad?'#f87171':'#10b981';
 };
 const live=()=>getXml229CurrentWorkerHeldReview(stateRef);
 const requireRebuild=()=>{
   active=null;pendingBulk=null;clearDrafts();root.__p4VisibleRows=[];
   table.replaceChildren();
   say('Verified original-source Worker ended. Return to 4 Preview → Build Preview '+
     'to verify the current XML, JSON Blob and four masters again. '+
     'No Match-1/Final decisions were restored or accepted automatically.',true);
 };
 const render=async()=>{
   if(!active)return;
   const session=active,token=++renderSequence;
   const page=mode==='all'&&!query
     ?await session.readPage({offset,limit:25})
     :await session.readPage({offset,limit:25,filter:mode,query});
   // A late response from a cancelled/replaced Worker cannot paint rows that
   // appear current, even when a new Worker carries a different InputBasis.
   if(token!==renderSequence||session!==active||
      root.isConnected===false||live()!==session)return;
   if(draftOwner!==session)clearDrafts();
   table.innerHTML=renderXml229WeightReviewPage(page,offset,{filter:mode,query,minScorePercent});
   root.__p4VisibleRows=page.rows;
   return hydrateXml229WeightDraftInputs(table,page.rows,draftValues);
 };
 root.addEventListener('input',event=>{
   if(event.target.closest?.('[data-p4-proposal],[data-p4-reason]')){
     const tr=event.target.closest('tr[data-p4-row]');
     if(event.target.matches?.('[data-p4-proposal]'))tr.dataset.p4PickedProposal='';
     captureDraft(tr);return;
   }
   if(!event.target.closest?.('[data-p4-filter]'))return;
   query=String(event.target.value||'').slice(0,120);
   offset=0;pendingBulk=null;
   if(searchTimer!==null)clearTimeout(searchTimer);
   searchTimer=setTimeout(()=>{
     searchTimer=null;
     void render().then(()=>{
       const input=table.querySelector('[data-p4-filter]');
       input?.focus();input?.setSelectionRange?.(query.length,query.length);
     }).catch(error=>say('Source-bound search unavailable: '+String(error.message||error),true));
   },260);
 });
 root.addEventListener('change',async event=>{
   if(event.target.closest?.('[data-p4-min-score]')){
     const value=Number(event.target.value);
     if(!Number.isFinite(value)||value<0||value>100){
       event.target.value=String(minScorePercent);
       say('Suggestion score must be between 0 and 100%.',true);return;
     }
     minScorePercent=value;pendingBulk=null;
     // Regenerate suggested drafts without erasing manually edited weights.
     for(const [id,saved] of draftValues)if(saved.autoFilled)draftValues.delete(id);
     bulkDetail.hidden=true;bulkDetail.textContent='';
     await render();
     say('Suggestion threshold set to '+minScorePercent+'%. Apply all suggestions again.');
     return;
   }
   if(event.target.closest?.('[data-p4-candidate]')){
     captureDraft(event.target.closest('tr[data-p4-row]'));return;
   }
   const fileInput=event.target.closest?.('[data-p4-import-review]');
   if(fileInput){
     const file=fileInput.files?.[0];fileInput.value='';
     if(!file)return;
     if(busy||!active){say('Build verified 4 Preview before restoring a review file.',true);return;}
     busy=true;
     say('Review file verification in progress…');
     try{
       if(!file.size||file.size>16*1024*1024)
         err('REVIEW_FILE_SIZE_INVALID','Review file must be nonempty and no larger than 16 MiB');
       const backup=JSON.parse(await file.text());
       if(getXml229CurrentWorkerHeldReview(stateRef)!==active)
         err('STALE_REVIEW_BACKUP_SOURCE','Original source changed during local review file read');
       const result=await active.restoreReviewBackup({backup});
       offset=0;pendingBulk=null;clearDrafts();await render();
       say('Restored same-InputBasis GC-PW review: '+
         result.counts.match1+' Match-1 only, '+result.counts.final+' independent Final, '+
         result.counts.unresolved+' unresolved. Old bulk-confirmation clicks are not reattested. Native CII Run remains HELD.');
     }catch(error){
       // Never show raw private file contents or stack in UI.
       const code=String(error?.code||'REVIEW_FILE_REJECTED');
       say('Review restore HELD ['+(/^[A-Z][A-Z0-9_]{2,79}$/.test(code)?code:
         'REVIEW_FILE_REJECTED')+']. No automatic decisions accepted.',true);
     }finally{busy=false;}
     return;
   }
   if(event.target.closest?.('[data-p4-filter-unresolved]')){
     mode=event.target.checked?'needs-review':'all';
     offset=0;pendingBulk=null;
     void render().catch(error=>say('Source-bound filter unavailable: '+String(error.message||error),true));
   }
 });
 build?.addEventListener('click',async()=>{
   if(busy)return;busy=true;build.disabled=true;
   const prev=active;
   try{
     prev?.cancel();active=null;clearDrafts();
     say('Checking original source/master custody and starting isolated Workers…');
     active=await openXml229P4VerifiedSession(stateRef,{
       resolveInputs,onProgress:stage=>say('GC-PW Worker: '+stage),
     });
     offset=0;clearDrafts();await render();
     say('Verified original physical facts ready; weights NOT auto-accepted.');
   }catch(error){
     say('Weight verification held: '+String(error?.message||error)+
       (error?.code?' ['+error.code+']':''),true);
   }finally{busy=false;build.disabled=false;}
 });
 root.addEventListener('click',async event=>{
   if(busy||!active)return;
   const prev=event.target.closest?.('[data-p4-prev]');
   const next=event.target.closest?.('[data-p4-next]');
   const scope=event.target.closest?.('[data-p4-scope]');
   const planButton=event.target.closest?.('[data-p4-bulk-plan]');
   const draftFillButton=event.target.closest?.('[data-p4-draft-unqualified]');
   const skipButton=event.target.closest?.('[data-p4-skip-weight]');
      const saveButton=event.target.closest?.('[data-p4-save-review]');
   const restoreButton=event.target.closest?.('[data-p4-choose-review]');
   const safetyButton=event.target.closest?.('[data-p4-full-source-safety]'),auditButton=event.target.closest?.('[data-p4-audit-decisions]');
   const custodyButton=event.target.closest?.('[data-p4-export-effective-basis]');
   const coverageButton=event.target.closest?.('[data-p4-export-candidate-readiness]');
   const traceButton=event.target.closest?.('[data-p4-export-flow-trace]');
   const candidateChip=event.target.closest?.('[data-p4-pick]');
      if(!prev&&!next&&!scope&&!planButton&&!skipButton&&!draftFillButton&&!candidateChip&&!auditButton&&!safetyButton&&!custodyButton&&!coverageButton&&!traceButton&&!saveButton&&!restoreButton)return;
   busy=true;
   try{
     if(restoreButton){
       root.querySelector('[data-p4-import-review]')?.click();
       return;
     }
     if(saveButton){
       if(getXml229CurrentWorkerHeldReview(stateRef)!==active)
         err('STALE_REVIEW_BACKUP_SOURCE','Original verified source changed');
       const backup=await active.exportReviewBackup();
       if(getXml229CurrentWorkerHeldReview(stateRef)!==active||
          backup?.basisId!==active.receipt?.basisId)
         err('STALE_REVIEW_BACKUP_SOURCE','Original source changed during review backup');
       downloadTextFile('xml229-source-bound-gcpw-review.json',
         JSON.stringify(backup,null,2),'application/json;charset=utf-8');
       say('Saved local GC-PW review: '+backup.counts.match1+' Match-1 only, '+
         backup.counts.final+' Final and '+backup.counts.unresolved+
         ' unresolved. Keep this private file to restore only after verified 4 Preview rebuild.');
       return;
     }
     if(traceButton){
       const session=active,trace=getXml229FlowTrace(stateRef);
       if(!trace||live()!==session||root.isConnected===false)
         err('FLOW_TRACE_SESSION_STALE','Current Worker flow trace unavailable');
       const proof=await session.readCompletion();
       if(live()!==session||active!==session||root.isConnected===false)
         err('FLOW_TRACE_SESSION_STALE','Source changed during trace collection');
       recordXml229FlowTrace(stateRef,{kind:'WEIGHT_UI_RENDERED',actor:'weight-ui',
         counts:{physical:proof.verifiedPhysicalCount,facts:proof.verifiedFactCount,
           sourceMass:proof.counts?.source,match1:proof.counts?.match1,
           final:proof.counts?.final,unresolved:proof.counts?.unresolved}});
       const json=JSON.stringify(trace.snapshot(),null,2);
       if(json.length>131072)err('FLOW_TRACE_EXPORT_TOO_LARGE','Trace exceeds private export budget');
       downloadTextFile('xml229-cross-worker-flow-trace.json',json,'application/json;charset=utf-8');
       say('Private Worker/UI trace exported; native CII remains HELD.');
       return;
     }
     if(coverageButton){
       const session=active;
       if(live()!==session||root.isConnected===false)
         err('G3_G4_AGGREGATE_EXPORT_HELD','Current original source review is stale');
       const pair=await session.readCandidateReadinessPair();
       if(live()!==session||active!==session||root.isConnected===false)
         err('G3_G4_AGGREGATE_EXPORT_HELD','Original source changed during aggregate export');
       const receipt=prepareXml229G3G4LocalAggregateExport({
         pair,receipt:session.receipt,
       });
       downloadTextFile(receipt.filename,receipt.text,'application/json;charset=utf-8');
       say('Private G3/G4 aggregate exported: '+
         pair.coverage.physicalCount+' original physicals, '+
         pair.coverage.counts.occurrencesWithQualifiedCandidates+
         ' with qualified proposals; native CII remains HELD.');
       return;
     }
     if(safetyButton){await downloadXml229FullSourceSafety({session:active,isCurrent:()=>live()===active&&root.isConnected!==false,say});return;}
     if(custodyButton){
       await downloadXml229OwnerBasisCustody({resolveInputs,session:active,
         getEntry:()=>getXml229VerifiedEngineeringEntry(stateRef),
         isCurrent:()=>getXml229CurrentWorkerHeldReview(stateRef)===active&&root.isConnected!==false});
       say('Private effective config and exact four-master custody saved locally. No Match-1, Final or native CII authority granted.');return;
     }
     if(auditButton){
       const live=getXml229CurrentWorkerHeldReview(stateRef);
       if(live!==active)err('PROVENANCE_SESSION_STALE',
         'Current verified source changed before decision provenance audit');
       const report=await active.readDecisionProvenance();
       if(getXml229CurrentWorkerHeldReview(stateRef)!==active||
          report?.basisId!==active.receipt?.basisId)
         err('PROVENANCE_SESSION_STALE','Original source changed during decision audit');
       downloadTextFile('xml229-weight-decision-provenance.json',
         JSON.stringify({...report,exportedAt:new Date().toISOString()},null,2),
         'application/json;charset=utf-8');
       say(formatXml229DecisionAuditSummary(report));
       return;
     }
     if(scope){
       mode=scope.getAttribute('data-p4-scope')||'all';
       offset=0;pendingBulk=null;await render();return;
     }
     if(planButton){
       const session=active;
       const plan=await session.planQualifiedBlankFill({minScorePercent});
       if(!Number.isSafeInteger(plan?.qualified)||!Array.isArray(plan.qualifiedSuggestions)||
          plan.qualifiedSuggestions.length!==plan.qualified)
         err('SUGGESTION_WORKER_PLAN_INCOMPLETE',
           'Worker qualified-count and source-proposal evidence do not match');
       const planned=await planXml229RigidWeightDrafts(session,{
         existingDrafts:draftValues,minScorePercent,
         qualifiedSuggestions:plan.qualifiedSuggestions,
         isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
       });
       if(active!==session||live()!==session)
         err('STALE_WEIGHT_AUTO_FILL_SOURCE','Verified source changed during suggestion preparation');
       for(const [id,draft] of planned.drafts)
         if(!draftValues.has(id))draftValues.set(id,draft);
       pendingBulk=null; // Suggestions populate drafts, not a Match-1 commit.
       // Show the first actual populated input. The formerly selected 25 rows
       // may contain zero eligible suggestions even for a source-wide plan.
       if(planned.firstPreparedIndex!==null){
         mode='blank-rigid';query='';
         offset=Math.floor(planned.firstPreparedIndex/25)*25;
       }
       const visiblePopulated=await render();
       if(planned.counts.prepared>0&&!(visiblePopulated>0))
         err('SUGGESTION_VISIBLE_INPUT_NOT_APPLIED',
           'No actual proposed kilograms were populated on the selected page');
       bulkDetail.hidden=true;
       bulkDetail.textContent='';
       const confirm=table.querySelector('[data-p4-bulk-confirm]');
       if(confirm){
         confirm.disabled=!plan.qualified;
         confirm.textContent='Apply all Match-1 ('+plan.qualified+')';
       }
       const c=planned.counts;
       say('Apply all suggestions ≥'+minScorePercent+'%: '+c.prepared+
         ' editable draft(s) prepared across the verified source. '+
         visiblePopulated+' actual kg input(s) visible on this page. '+
         c.workerQualified+' source-qualified candidate(s) reconciled ('+
         c.workerQualifiedPrepared+' newly filled, '+
         c.workerQualifiedAlreadyDrafted+' existing drafts kept); '+
         c.preparedUnqualified+' review-only drafts. '+
         c.withoutProposal+' no proposal, '+c.belowThreshold+
         ' below threshold. Applied Weight drafts are not accepted; governed CII remains HELD.');
       return;
     }
     if(skipButton){
        const session=active;
        const planned=await planXml229SkipWeightDrafts(session,{
          existingDrafts:draftValues,
          isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
        });
        if(active!==session||live()!==session)err('SKIP_WEIGHT_SOURCE_STALE');
        for(const [id,draft] of planned.drafts)
          if(!draftValues.has(id))draftValues.set(id,draft);
        pendingBulk=null;bulkDetail.hidden=true;bulkDetail.textContent='';
        mode='blank-rigid';query='';offset=0;
        await render();
        say('Skip Weight: '+planned.counts.skipped+
          ' blank eligible weight row(s) filled with 0 kg DRAFT. '+
          planned.counts.alreadyEdited+' existing drafts kept; '+
          planned.counts.existingReview+' reviewed rows untouched. '+
          '0 kg is not verified engineering mass and does not enter CII/Final automatically.');
        return;
      }
      if(draftFillButton){
       const session=active;
       const planned=await planXml229UnqualifiedDrafts(session,{
         existingDrafts:draftValues,
         isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
       });
       for(const [id,draft] of planned.drafts)if(!draftValues.has(id))
         draftValues.set(id,draft);
       pendingBulk=null;mode='blank-rigid';offset=0;await render();
       const c=planned.counts;
       say(c.prepared+' new unqualified editable draft(s) across '+c.blankRigid+
         ' blank RIGIDs; '+c.withoutProposal+' have no proposal, '+
         c.qualifiedPresent+' have qualified candidates and '+c.alreadyDrafted+
         ' already had local drafts. Zero decisions accepted. Drafts are session-local.');
       return;
     }
     if(prev||next){
       offset+=next?25:-25;pendingBulk=null;await render();return;
     }
     const tr=event.target.closest('tr[data-p4-row]');
     const row=root.__p4VisibleRows?.[Number(tr?.dataset.p4Row)];
     if(!row||row.occurrenceId!==tr.dataset.p4Occurrence)
       err('STALE_PHYSICAL_ROW','Original physical source row changed');
     const draft=tr.querySelector('[data-p4-proposal]');
     const selection=tr.querySelector('[data-p4-candidate]');
     if(candidateChip){
       const proposalId=candidateChip.getAttribute('data-p4-pick')||'';
       const candidate=(row.proposals||[]).find(p=>p.proposalId===proposalId);
       if(!candidate)err('STALE_PHYSICAL_PROPOSAL','Candidate no longer belongs to this occurrence');
       if(selection)selection.value=proposalId;
       else tr.dataset.p4PickedProposal=proposalId;
       draft.value=String(candidate.value);
       captureDraft(tr);
       say('Source candidate selected as DRAFT only; explicit engineering acceptance is required.');
       return;
     }
   }catch(error){
     say('Review not accepted: '+String(error?.message||error)+
       (error?.code?' ['+error.code+']':''),true);
   }finally{busy=false;}
 });
 if(existingWorkflow&&!active)
   say('Build 4 Preview using the existing Build Preview button before reviewing weights. No separate Weight Build is required.',true);
 const attach=async(session)=>{
   await render();
   const proof=await session.readCompletion();
   if(root.isConnected===false||live()!==session||active!==session)return;
   const counts=proof?.counts||{};
   say('Existing verified Preview facts loaded. Weight decisions: '+
     (counts.source??0)+' original source masses, '+
     (counts.match1??0)+' accepted Match-1, '+
     (counts.final??0)+' accepted Final, '+
     (counts.unresolved??0)+' unresolved. '+
     'Applied Weight and Skip Weight are session drafts, not accepted masses. Governed CII remains HELD.');
 };
 if(active){
   const initial=active;
   void attach(initial).catch(async error=>{
     if(root.isConnected===false)return;
     const latest=live();
     // A second valid Preview build can replace an in-flight Worker read.
     // Reattach only to that already attested Worker; never manufacture
     // source facts, replay decisions, or silently build against old inputs.
     if(latest&&latest!==initial){
       active=latest;pendingBulk=null;clearDrafts();offset=0;
       try{await attach(latest);return;}
       catch(error){
         if(root.isConnected===false)return;
       }
     }
     if(!live()){requireRebuild();return;}
     say('Existing source review verification unavailable; reopen 4 Preview. '+
       'Match-1/Final are not authorized by this view. ['+
       String(error?.code||'VERIFICATION_UNAVAILABLE')+']',true);
   });
 }
 // Removing the panel is not Worker disposal; explicit revocation is separate.
 return {dispose:()=>{if(searchTimer!==null)clearTimeout(searchTimer);},
   cancel:()=>revokeXml229VerifiedEngineeringBasis(key,{expectedSession:active})};
}
