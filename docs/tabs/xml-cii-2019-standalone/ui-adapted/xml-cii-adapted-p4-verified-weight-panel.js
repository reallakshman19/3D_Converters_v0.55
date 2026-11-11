import {openXml229WorkerHeldOriginalWeightReview} from '../integration/xml229-original-blob-gcpw-client.mjs';
import {installXml229TopoFixFreshStartControl} from './xml229-topofix-fresh-worker-control.mjs';
import {canXml229AutoCommitSuggestedFinal} from '../integration/xml229-topofix-fresh-worker-handoff.mjs';
import {xml229P4ConfigEquivalent as configEquivalent} from './xml229-p4-config-equivalence.mjs';
import {renderXml229VerifiedPanelShell} from './xml229-p4-panel-shell.mjs';
import {resolveXml229OptionalReviewCustody} from './xml229-p4-optional-json-custody.mjs';
import {xmlCiiEnrichedConfigFromState} from './xml-cii-adapted-state.js';
import {materializeXmlCiiDatasetBackedConfig} from '../xml-cii-dataset-backed-config.js';
import {resolveXml229FourMasterCustody} from '../integration/xml229-four-master-custody.mjs';
import {digestCanonical} from '../../../contracts/gc-pw-v1/contract.mjs';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';
import {xmlCiiBranchScopeFromState,xmlCiiSourceDigest} from '../xml-cii-branch-scope.js';
import {renderXml229WeightReviewPage} from './xml229-p4-weight-review-presentation.mjs';
import {installXml229WeightExcelAutoFilter} from './xml229-p4-excel-autofilter.mjs';
import {commitXml229SelectedAppliedWeight} from './xml229-p4-applied-weight-owner-selection.mjs';
import {createXml229ZeroMassPopup} from './xml229-p4-zero-mass-popup.mjs';
import {renderXml229InstrumentSuggestions} from './xml229-p4-optional-instrument-advisory.mjs';
import {commitXml229AllSelectedFinal,commitXml229VisibleSelectedFinal} from './xml229-p4-source-wide-final-commit.mjs';
import {hydrateXml229WeightDraftInputs,seedXml229VisibleSuggestedWeightDrafts} from './xml229-p4-unqualified-drafts.mjs';
import {applyXml229SourceWideSuggestionDrafts,applyXml229BlankWeightDrafts} from './xml229-p4-source-wide-suggestion-action.mjs';
import {disarmXml229EditedDraft} from './xml229-p4-two-click-confirmation.mjs';
import {createXml229BulkApplyQueue} from './xml229-p4-busy-apply-queue.mjs';
import {openXml229WeightDraftWorkspace} from './xml229-p4-weight-draft-workspace.mjs';
import {showXml229DraftRecoveryNotice,saveXml229RecoveryDrafts} from './xml229-p4-draft-recovery-notice.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';
import {exportXml229WeightEvidence} from './xml229-p4-private-weight-evidence.mjs';
import {downloadXml229FullSourceSafety} from './xml229-full-source-safety-download.mjs';
import {downloadXml229OwnerBasisCustody} from './xml229-owner-basis-custody-download.mjs';
import {beginXml229FlowTrace} from './xml229-flow-trace-registry.mjs';
import {getXml229VerifiedEngineeringEntry,beginXml229VerifiedEngineeringBuild,publishXml229VerifiedEngineeringBuild,revokeXml229VerifiedEngineeringBasis} from '../integration/xml229-engineering-basis-authority.mjs';
const err=(code,detail)=>{const e=new Error(detail||code);e.code=code;throw e;};
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const labelKg=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n+' kg':'—';
/** InputBasis tracks real XML/JSON/master changes, not UI navigation or File wrapper churn. */
const ownerScope=value=>{const s=String(value??'').trim();
 return !s||s==='ALL'||s==='__ALL__'?'__ALL__':s;
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
 jsonInputPresent:hasXml229PreviewJsonSource(raw),
});
export function compareXml229P4LiveSourceSnapshot(basis,current,{
 verifyFullSelection=()=>false,
}={}){
 if(!basis||!current)return false;
 const activeId=String(current?.modeASourceId||current?.sourceBatch?.activeSourceId||basis.sourceId);
 if(activeId!==basis.sourceId)return false;
 const latest=captureXml229P4LiveSourceSnapshot(current,basis.sourceId);
 // Accept equivalent full-branch selections, never a partial/stale source.
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
/** Resolve full original Mode A XML, optional indexed JSON and four attested masters. */
export async function resolveXml229P4ProductionInputs(stateRef){
 const baseRef=stateRef?.modeABaseRef||stateRef,raw=baseRef?.current;
 const view=stateRef?.current||raw;
 if(!raw?.sourceText)err('ORIGINAL_XML_REQUIRED','Load original XML first');
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
 const {xmlOnly,source,sourceXmlSha256}=await resolveXml229OptionalReviewCustody(raw,view,baseRef);
 const before=captureXml229P4LiveSourceSnapshot(raw,sourceId);
 const context=view.masterContext||raw.masterContext||{};
 const config=await materializeXmlCiiDatasetBackedConfig(
   xmlCiiEnrichedConfigFromState(view),{...view,masterContext:context});
 const {masters,attestations}=await resolveXml229FourMasterCustody(config,context,{
   restoreFailures:raw.masterRestoreFailures||view.masterRestoreFailures||{},
 });
 const isCurrent=()=>{
   if(source&& !source.isCurrent())return false;
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
   receiptSha:source?.receipt.sha256??null,
   generationId:source?.receipt.generationId??'xml-only:sha256:'+sourceXmlSha256,
   selectionRef:'all',config,attestations});
 if(!isCurrent())err('STALE_ORIGINAL_MASTER_SOURCE',
   'Original source/master changed during full content attestation');
 return {xmlText:raw.sourceText,sourceId,masters,
   selection:[{sourceId,selectionRef:'all'}],
   config,overrides:config.overrides||{},
   reviewSourceKind:xmlOnly?'XML_ONLY':'XML_WITH_JSON',sourceXmlSha256,
   originalStagedBlob:source?.blob??null,
   originalStagedSourceReceipt:source?.receipt??null,
   requestId:'xml229-p4-'+(source?.generationId??sourceXmlSha256)+'-'+sourceId,
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
 // One source authority per baseRef; newer Preview builds supersede old Workers.
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
 container.innerHTML=renderXml229VerifiedPanelShell(existingWorkflow);
 const root=container.querySelector('[data-p4-weight-root]');
 root.dataset.p4ReadReady='false';
 const status=root.querySelector('[data-p4-weight-status]');
 const bulkDetail=root.querySelector('[data-p4-bulk-detail]');
 const table=root.querySelector('[data-p4-weight-table]');
 const build=root.querySelector('[data-p4-weight-build]');
 const key=stateRef?.modeABaseRef||stateRef;
 let active=getXml229CurrentWorkerHeldReview(stateRef),offset=0,busy=false;
 let mode='rigid',query='',pendingBulk=null,searchTimer=null,renderSequence=0,minScorePercent=80,hideShortMm=false;
 let draftOwner=null,draftValues=new Map(),draftWorkspace=null,zeroPopup=null;
 const bindDrafts=session=>{
   draftWorkspace=openXml229WeightDraftWorkspace(session.receipt,{
     occurrenceIds:session.originalPhysicalOccurrences.map(x=>x.occurrenceId),recoverUnknownCensus:true,
   });
   draftOwner=session;draftValues=draftWorkspace.drafts;
   showXml229DraftRecoveryNotice(root,draftWorkspace,downloadTextFile);
 };
 const persistDrafts=()=>{if(draftWorkspace&&draftOwner===active&&live()===active)return saveXml229RecoveryDrafts(draftWorkspace);
   return 0;
 };
 const clearDrafts=()=>{draftOwner=null;draftWorkspace=null;draftValues=new Map();
   bulkDetail.hidden=true;bulkDetail.textContent='';
   zeroPopup?.dismiss();excel.reset();hideShortMm=false;
   root.querySelector('[data-xml229-draft-recovery]')?.remove();
 };
 const captureDraft=tr=>{if(!tr||!active||draftOwner!==active||live()!==active)return;
   if(disarmXml229EditedDraft(tr,root.__p4VisibleRows,draftValues,
     pendingBulk,table,bulkDetail)){
     pendingBulk=null;
     say('Applied Weight updated. Previous bulk selection cancelled.');
   }
   try{persistDrafts();}
   catch(error){say('Applied Weight is available in this session, but local save failed ['+
     String(error.code||'WEIGHT_DRAFT_STORAGE_WRITE_FAILED')+
     ']. Save Applied Weight before leaving.',true);}
 };
 const say=(message,bad=false)=>{status.textContent=message;status.style.color=bad?'#f87171':'#10b981';
 };
 const live=()=>getXml229CurrentWorkerHeldReview(stateRef),applyQueue=createXml229BulkApplyQueue(root,live,say);
 const requireRebuild=()=>{root.dataset.p4ReadReady='false';
   active=null;pendingBulk=null;clearDrafts();root.__p4VisibleRows=[];
   table.replaceChildren();
   say('Verified original-source Worker ended. Return to 4 Preview → Build Preview '+
     'to verify the current XML, JSON Blob and four masters again. '+
     'No Match-1/Final decisions were restored or accepted automatically.',true);
 };
 const render=async({suppressAutoCommit=false}={})=>{
   if(!active)return;
   const session=active,token=++renderSequence;
   const page=await (mode==='all'&&!query&&!hideShortMm&&!Object.keys(excel.snapshot().columnFilters).length&&!excel.snapshot().sort?session.readPage({offset,limit:25}):session.readPage({offset,limit:25,filter:mode,query,hideShortMm,...excel.snapshot()}));
   if(token!==renderSequence||session!==active||
      root.isConnected===false||live()!==session)return;
   if(draftOwner!==session)bindDrafts(session);
   table.innerHTML=renderXml229WeightReviewPage(page,offset,{filter:mode,query,minScorePercent,hideShortMm,...excel.snapshot()});
   root.__p4VisibleRows=page.rows;
   seedXml229VisibleSuggestedWeightDrafts(page.rows,draftValues,{minScorePercent});
   const count=hydrateXml229WeightDraftInputs(table,page.rows,draftValues);
   persistDrafts(); // Source-basis-bound backup before any authoritative write.
   // Visible source-ranked selections go directly through protected Final CAS.
   suppressAutoCommit=suppressAutoCommit||!!(stateRef?.modeABaseRef||stateRef)?.current?.xml229TopoFixFreshReviewPending;
   const {committed,stale}=(!canXml229AutoCommitSuggestedFinal(session,{suppressAutoCommit}))?{committed:0,stale:false}:await commitXml229VisibleSelectedFinal({
     session,rows:page.rows,drafts:draftValues,
     isCurrent:()=>token===renderSequence&&active===session&&live()===session,
     onError:error=>say('Applied Weight could not be recorded ['+
       String(error?.code||'APPLIED_WEIGHT_COMMIT_FAILED')+
       ']. Selection retained locally; native CII still HELD.',true),
   });
   if(stale)return count;
   if(committed>0){
     persistDrafts();
     await render(); // authoritative Final read and new stage revisions
     return count; // source-wide Apply all observed values before they became accepted
   }
   return count;
 };
 const excel=installXml229WeightExcelAutoFilter({root,table,
  readSession:()=>active,readScope:()=>({filter:mode,query,hideShortMm}),
  refresh:()=>render({suppressAutoCommit:true}),resetPage:()=>{offset=0;pendingBulk=null;},
  isCurrent:session=>session===active&&live()===session&&root.isConnected!==false,
 });
 zeroPopup=createXml229ZeroMassPopup({
   root,live,getDrafts:()=>draftValues,saveDrafts:persistDrafts,render,say,
 });
 root.addEventListener('input',event=>{
   if(event.target.closest?.('[data-p4-proposal]')){
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
   if(event.target.matches?.('[data-p4-hide-short-mm]')){
     if(busy||!active||live()!==active){event.target.checked=hideShortMm;return;}
     const old=hideShortMm;hideShortMm=event.target.checked;offset=0;pendingBulk=null;excel.close();
     try{await render({suppressAutoCommit:true});}
     catch(error){hideShortMm=old;say('Short-element filter unavailable ['+String(error?.code||'READ_FAILED')+']. No mass changed.',true);}
     return;
   }
   const applied=event.target.closest?.('[data-p4-applied-weight]');
   if(applied){
     const tr=applied.closest('tr[data-p4-row]');
     const row=root.__p4VisibleRows?.[Number(tr?.dataset.p4Row)];
     const selected=draftValues.get(row?.occurrenceId);
     const value=Number(applied.value);
     if(!row||tr.dataset.p4Occurrence!==row.occurrenceId||
        !applied.value.trim()||!Number.isFinite(value)||value<0){
       say('Applied Weight requires a nonnegative kg value; 0 kg is valid only for a blank occurrence.',true);
       return;
     }
     const session=active;
     if(busy||!session||live()!==session)return;
     busy=true;
     try{
       await commitXml229SelectedAppliedWeight({
         session,row,value,proposalId:value===0?'':(selected?.proposalId||''),
         origin:value===0?'confirmed-zero':'manual',isCurrent:()=>active===session&&live()===session&&table.contains(tr),
       });
       draftValues.delete(row.occurrenceId);persistDrafts();
       await render();
       say('Applied Weight recorded in the verified Worker. Native CII output remains separately HELD.');
     }catch(error){
       say('Applied Weight selection not recorded ['+
         String(error?.code||'APPLIED_WEIGHT_COMMIT_FAILED')+
         ']. Value retained locally.',true);
     }finally{busy=false;}
     return;
   }
   if(event.target.closest?.('[data-p4-import-drafts]')){
     const input=event.target;
     const file=input.files?.[0];input.value='';
     if(!file)return;
     if(busy||!active||live()!==active){say('Current verified source is required for draft restore.',true);return;}
     busy=true;
     try{
       if(file.size<1||file.size>1500000)err('WEIGHT_DRAFT_FILE_SIZE_INVALID');
       if(!draftWorkspace)bindDrafts(active);
       const originalSession=active;
       const backup=JSON.parse(await file.text());
       if(live()!==originalSession||active!==originalSession)
         err('WEIGHT_DRAFT_SOURCE_STALE');
       const count=draftWorkspace.restoreBackup(backup);
       pendingBulk=null;offset=0;
       await render();
       say('Restored '+count+' Applied Weight selection(s) for the same verified source. Native CII remains HELD.');
     }catch(error){
       say('Draft restore rejected ['+String(error.code||'WEIGHT_DRAFT_FILE_INVALID')+
         ']. Existing drafts and reviewed masses were not replaced.',true);
     }finally{busy=false;}
     return;
   }
   if(event.target.closest?.('[data-p4-min-score]')){
     const value=Number(event.target.value);
     if(!Number.isFinite(value)||value<0||value>100){
       event.target.value=String(minScorePercent);
       say('Suggestion score must be between 0 and 100%.',true);return;
     }
     minScorePercent=value;pendingBulk=null;
     // Regenerate suggested drafts without erasing manually edited weights.
     for(const [id,saved] of draftValues)if(saved.autoFilled)draftValues.delete(id);
     persistDrafts();
     bulkDetail.hidden=true;bulkDetail.textContent='';
     await render();
     say('Suggestion threshold set to '+minScorePercent+'%. Applied Weight suggestions refreshed.');
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
 installXml229TopoFixFreshStartControl({build,root,stateRef,resolveInputs,getPreviousSession:()=>active,isBusy:()=>busy,setBusy:v=>{busy=v;},say,openSession:qualifiedInputs=>openXml229P4VerifiedSession(stateRef,{resolveInputs:qualifiedInputs}),activateSession:async session=>{active=session;offset=0;clearDrafts();await render({suppressAutoCommit:true});root.dataset.p4ReadReady='true';}});build?.addEventListener('click',async()=>{
   if(busy)return;busy=true;build.disabled=true;
   const prev=active;
   root.dataset.p4ReadReady='false';
   try{
     prev?.cancel();active=null;clearDrafts();
     say('Checking original source/master custody and starting isolated Workers…');
     active=await openXml229P4VerifiedSession(stateRef,{
       resolveInputs,onProgress:stage=>say('GC-PW Worker: '+stage),
     });
     offset=0;clearDrafts();await render();
     void renderXml229InstrumentSuggestions(root,active,()=>root.isConnected!==false&&live()===active,render);
     root.dataset.p4ReadReady='true';
     applyQueue.drain(active);
     say('Verified source facts ready. Applied Weight suggestions are available.');
     void zeroPopup.offer(active);
   }catch(error){
     say('Weight verification held: '+String(error?.message||error)+
       (error?.code?' ['+error.code+']':''),true);
   }finally{busy=false;build.disabled=false;}
 });
 root.addEventListener('click',async event=>{
   if(!active||applyQueue.defer(event,active,busy||root.dataset.p4ReadReady!=='true'))return;
   const confirmZero=event.target.closest?.('[data-p4-confirm-zero]');
   const dismissZero=event.target.closest?.('[data-p4-dismiss-zero]');
   const prev=event.target.closest?.('[data-p4-prev]');
   const next=event.target.closest?.('[data-p4-next]');
   const scope=event.target.closest?.('[data-p4-scope]');
   const planButton=event.target.closest?.('[data-p4-bulk-plan]');
   const draftFillButton=event.target.closest?.('[data-p4-draft-unqualified]');
      const saveButton=event.target.closest?.('[data-p4-save-review]');
   const restoreButton=event.target.closest?.('[data-p4-choose-review]');
   const saveDraftButton=event.target.closest?.('[data-p4-save-drafts]');
   const restoreDraftButton=event.target.closest?.('[data-p4-choose-drafts]');
   const safetyButton=event.target.closest?.('[data-p4-full-source-safety]'),auditButton=event.target.closest?.('[data-p4-audit-decisions]');
   const custodyButton=event.target.closest?.('[data-p4-export-effective-basis]');
   const coverageButton=event.target.closest?.('[data-p4-export-candidate-readiness]');
   const traceButton=event.target.closest?.('[data-p4-export-flow-trace]');
   const candidateChip=event.target.closest?.('[data-p4-pick]');
      if(!confirmZero&&!dismissZero&&!prev&&!next&&!scope&&!planButton&&!draftFillButton&&!candidateChip&&!auditButton&&!safetyButton&&!custodyButton&&!coverageButton&&!traceButton&&!saveButton&&!restoreButton&&!saveDraftButton&&!restoreDraftButton)return;
   busy=true;root.dataset.p4Busy='true';
   try{
     if(confirmZero||dismissZero){
       pendingBulk=null;
       await zeroPopup.handle(confirmZero?'apply':'dismiss',active);
       return;
     }
     if(restoreDraftButton){
       root.querySelector('[data-p4-import-drafts]')?.click();
       return;
     }
     if(saveDraftButton){
       if(live()!==active)err('WEIGHT_DRAFT_SOURCE_STALE');
       if(!draftWorkspace)bindDrafts(active);
       const saved=draftWorkspace.exportBackup();
       downloadTextFile('xml229-source-bound-applied-weight-drafts.json',
         JSON.stringify(saved,null,2),'application/json;charset=utf-8');
       say('Saved '+saved.entries.length+' Applied Weight selection(s) for the current verified source and masters.');
       return;
     }
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
     if(traceButton||coverageButton||auditButton){
       const session=active;
       const kind=traceButton?'trace':coverageButton?'coverage':'audit';
       say(await exportXml229WeightEvidence({kind,session,stateRef,
         isCurrent:()=>live()===session&&active===session&&root.isConnected!==false}));
       return;
     }
     if(safetyButton){await downloadXml229FullSourceSafety({session:active,isCurrent:()=>live()===active&&root.isConnected!==false,say});return;}
     if(custodyButton){
       await downloadXml229OwnerBasisCustody({resolveInputs,session:active,
         getEntry:()=>getXml229VerifiedEngineeringEntry(stateRef),
         isCurrent:()=>getXml229CurrentWorkerHeldReview(stateRef)===active&&root.isConnected!==false});
       say('Private effective config and exact four-master custody saved locally. No Match-1, Final or native CII authority granted.');return;
     }
     if(scope){
       mode=scope.getAttribute('data-p4-scope')||'all';
       offset=0;pendingBulk=null;await render();return;
     }
     if(planButton){
       const session=active;pendingBulk=null;
       await applyXml229SourceWideSuggestionDrafts({
         session,drafts:draftValues,minScorePercent,saveDrafts:persistDrafts,
         isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
         showFirst:index=>{mode='blank-rigid';query='';offset=Math.floor(index/25)*25;
           hideShortMm=false;excel.reset();},
         render:()=>render({suppressAutoCommit:true}),table,detail:bulkDetail,say,
       });
       // Apply all traverses every source physical using fresh Final CAS.
       const {accepted}=await commitXml229AllSelectedFinal({
         session,drafts:draftValues,
         isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
         saveDrafts:persistDrafts,
         onProgress:({accepted,scanned,total})=>say('Applied Weight: '+accepted+
           ' selected Final masses accepted; physicals '+scanned+'/'+total+'.'),
       });
       await render();
       say('Apply all suggestions ≥'+minScorePercent+'%: complete. '+accepted+' additional positive kg masses recorded as Owner-designated GC-PW Final. Missing/0 kg physicals remain unresolved. Native CII output remains separately HELD.');
       return;
     }
     if(draftFillButton){
       const session=active;pendingBulk=null;
       say(await applyXml229BlankWeightDrafts({
         kind:'unqualified',session,drafts:draftValues,
         isCurrent:()=>active===session&&live()===session&&root.isConnected!==false,
         saveDrafts:persistDrafts,render,detail:bulkDetail,
         resetView:kind=>{mode='blank-rigid';offset=0;if(kind==='skip')query='';},
       }));
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
       await commitXml229SelectedAppliedWeight({
         session:active,row,value:candidate.value,proposalId,origin:'click',
         isCurrent:()=>live()===active&&tr.isConnected!==false&&table.contains(tr),
       });
       draftValues.delete(row.occurrenceId);persistDrafts();
       await render();
       say('Applied Weight selected and recorded in the verified Worker for this occurrence. Native CII release remains separately HELD.');
       return;
     }
   }catch(error){
     say('Weight action unavailable: '+String(error?.message||error)+
       (error?.code?' ['+error.code+']':''),true);
   }finally{busy=false;root.dataset.p4Busy='false';applyQueue.drain(active);}
 });
 if(existingWorkflow&&!active)
   say('Build 4 Preview using the existing Build Preview button before reviewing weights. No separate Weight Build is required.',true);
 const attach=async(session)=>{
   await render();
   const proof=await session.readCompletion();
   if(root.isConnected===false||live()!==session||active!==session)return;
   root.dataset.p4ReadReady='true';
   void renderXml229InstrumentSuggestions(root,session,()=>root.isConnected!==false&&active===session&&live()===session,render);
   applyQueue.drain(session);
   const counts=proof?.counts||{};
   say('Existing verified Preview facts loaded. Weight decisions: '+
     (counts.source??0)+' original source masses, '+
     (counts.match1??0)+' accepted Match-1, '+
     (counts.final??0)+' accepted Final, '+
     (counts.unresolved??0)+' unresolved. '+
     'Applied Weight selections are saved for this source. Native CII output release remains HELD.');
   void zeroPopup.offer(session);
 };
 if(active){
   const initial=active;
   void attach(initial).catch(async error=>{
     if(root.isConnected===false)return;
     const latest=live();
     // Reattach only to a newer independently verified Preview Worker.
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
 return {dispose:()=>{if(searchTimer!==null)clearTimeout(searchTimer);excel.dispose();},
   cancel:()=>revokeXml229VerifiedEngineeringBasis(key,{expectedSession:active})};
}
