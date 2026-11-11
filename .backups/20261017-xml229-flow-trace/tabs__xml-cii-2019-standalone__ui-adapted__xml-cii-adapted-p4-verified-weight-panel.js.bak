/**
 * XML229 P4-D opt-in, source-attested one-flow Weight Match-1 / Final review.
 * Does not replace legacy Weight(kg), native CII Run, or persist issue.key
 * weights. Large original staged JSON remains INSIDE its GC-PW Worker.
 */
import {openXml229WorkerHeldOriginalWeightReview}
 from '../integration/xml229-original-blob-gcpw-client.mjs';
import {resolveXml229CurrentPreviewBlob}
 from './xml-cii-adapted-lfj-o1-intake.js';
import {xmlCiiEnrichedConfigFromState}
 from './xml-cii-adapted-state.js';
import {materializeXmlCiiDatasetBackedConfig}
 from '../xml-cii-dataset-backed-config.js';
import {resolveXml229FourMasterCustody} from '../integration/xml229-four-master-custody.mjs';
import {digestCanonical,canonicalJson} from '../../../contracts/gc-pw-v1/contract.mjs';
import {xmlCiiBranchScopeFromState,xmlCiiSourceDigest}
 from '../xml-cii-branch-scope.js';
import {renderXml229WeightReviewPage,choiceForXml229WeightRow}
 from './xml229-p4-weight-review-presentation.mjs';
import {downloadTextFile} from './xml-cii-adapted-dom.js';
import {prepareXml229G3G4LocalAggregateExport}
 from './xml229-g3g4-local-aggregate-export.mjs';
import {
 getXml229VerifiedEngineeringEntry,beginXml229VerifiedEngineeringBuild,
 publishXml229VerifiedEngineeringBuild,revokeXml229VerifiedEngineeringBasis,
} from '../integration/xml229-engineering-basis-authority.mjs';
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
 const inputs=await resolveInputs();
 if(signal?.aborted)err('CANCELLED','Preview was cancelled during source/master hydration');
 const lease=inputs.inputLease||null;
 const previous=getXml229VerifiedEngineeringEntry(key);
 if(previous&&lease&&lease===previous.lease){
   try{
     await previous.session.readCompletion();
     if(signal?.aborted)err('CANCELLED','Preview was cancelled during existing verified Worker read');
     return previous.session;
   }
   catch{/* genuinely stale/cancelled prior session cannot be reused */}
 }
 // One source-bound authority per stable baseRef, independent of DOM
 // ownership. A newer build invalidates an in-flight predecessor (CAS).
 const ticket=beginXml229VerifiedEngineeringBuild(key);
 const session=await openXml229WorkerHeldOriginalWeightReview({...inputs,onProgress,signal});
 if(signal?.aborted){session.cancel();err('CANCELLED','Preview was cancelled during Worker verification');}
 if(inputs.isCurrent?.()!==true){session.cancel();err('STALE_INPUT',
   'Original source or master changed during Worker verification');}
 const verifiedLease=lease||session.receipt?.basisId;
 if(!publishXml229VerifiedEngineeringBuild(ticket,{lease:verifiedLease,session}))
   err('ENGINEERING_BASIS_SUPERSEDED',
     'A newer verified Preview replaced this engineering source review');
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
  Proposed weights are editable evidence only. Match-1 and Final are distinct explicit
  decisions. Native CII Run is NOT authorized by this panel.</p>
  ${existingWorkflow?'':'<button type="button" data-p4-weight-build>Build verified original-source Weight review</button>'}
  <span role="status" data-p4-weight-status style="margin-left:8px;"></span>
  <div style="margin:10px 0"><button type="button" data-p4-export-candidate-readiness
   class="model-converters-download-btn">Download candidate coverage + readiness (private)</button>
   <small style="display:block;color:#94a3b8">Same verified Worker, read-only aggregate counts; keep file private. Does not authorize native CII.</small></div>
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
 const table=root.querySelector('[data-p4-weight-table]');
 const build=root.querySelector('[data-p4-weight-build]');
 const key=stateRef?.modeABaseRef||stateRef;
 let active=getXml229CurrentWorkerHeldReview(stateRef),offset=0,busy=false;
 let mode='all',query='',pendingBulk=null,searchTimer=null,renderSequence=0;
 const say=(message,bad=false)=>{
   status.textContent=message;status.style.color=bad?'#f87171':'#10b981';
 };
 const live=()=>getXml229CurrentWorkerHeldReview(stateRef);
 const requireRebuild=()=>{
   active=null;pendingBulk=null;root.__p4VisibleRows=[];
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
   table.innerHTML=renderXml229WeightReviewPage(page,offset,{filter:mode,query});
   root.__p4VisibleRows=page.rows;
 };
 root.addEventListener('input',event=>{
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
       offset=0;pendingBulk=null;await render();
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
     prev?.cancel();active=null;
     say('Checking original source/master custody and starting isolated Workers…');
     active=await openXml229P4VerifiedSession(stateRef,{
       resolveInputs,onProgress:stage=>say('GC-PW Worker: '+stage),
     });
     offset=0;await render();
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
   const commitButton=event.target.closest?.('[data-p4-bulk-confirm]');
   const saveButton=event.target.closest?.('[data-p4-save-review]');
   const restoreButton=event.target.closest?.('[data-p4-choose-review]');
   const auditButton=event.target.closest?.('[data-p4-audit-decisions]');
   const coverageButton=event.target.closest?.('[data-p4-export-candidate-readiness]');
   const candidateChip=event.target.closest?.('[data-p4-pick]');
   const isMatch=event.target.closest?.('[data-p4-accept-match1]');
   const isFinal=event.target.closest?.('[data-p4-accept-final]');
   if(!prev&&!next&&!scope&&!planButton&&!commitButton&&!candidateChip&&!isMatch&&!isFinal&&!auditButton&&!coverageButton&&!saveButton&&!restoreButton)return;
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
       say('Decision audit exported: '+report.summary.auditedAcceptedDecisions+
         ' accepted Match-1/Final records, '+
         report.summary.bulkConfirmed+' same-Worker confirmed bulk, '+
         report.summary.bulkConfirmationUnknown+' bulk commands without independently provable confirmation. '+
         (report.summary.provenanceComplete?'All audited decisions have sufficient provenance.':
           'Inspect audit issues before Owner approval.'));
       return;
     }
     if(scope){
       mode=scope.getAttribute('data-p4-scope')||'all';
       offset=0;pendingBulk=null;await render();return;
     }
     if(planButton){
       pendingBulk=await active.planQualifiedBlankFill();
       if(!pendingBulk.qualified){
         say('No qualified blank-only Match-1 suggestions on the verified full source.');
       }else{
         const confirm=table.querySelector('[data-p4-bulk-confirm]');
         confirm.hidden=false;
         confirm.textContent='Confirm '+pendingBulk.qualified+' qualified Match-1';
         say('Review bulk proposal: '+pendingBulk.qualified+' qualified; '+
           pendingBulk.unresolved+' not qualified; existing masses preserved. Confirm separately.');
       }
       return;
     }
     if(commitButton){
       if(!pendingBulk?.planId)err('BULK_PLAN_REQUIRED','First review qualified blank-only suggestions');
       const result=await active.commitQualifiedBlankFill({planId:pendingBulk.planId});
       pendingBulk=null;offset=0;await render();
       say(result.acceptedCount+' qualified blank-only Match-1 decision(s) accepted; Final remains independent.');
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
       selection.value=proposalId;
       draft.value=String(candidate.value);
       say('Source candidate selected as DRAFT only; explicit engineering acceptance is required.');
       return;
     }
     const reason=String(tr.querySelector('[data-p4-reason]').value||'').trim();
     const {view,choice}=choiceForXml229WeightRow(row,{
       stage:isFinal?'final':'match1',proposalId:selection.value,
       value:draft.value,reason,
     });
     await active.review({view,choice});
     pendingBulk=null;
     await render();
     say(isFinal?'Final Match-2 explicitly accepted for original physical source':
       'Match-1 explicitly accepted; Final remains a separate review.');
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
     'Suggestions are DRAFT until explicitly accepted (or a qualified blank-only plan is confirmed).');
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
       active=latest;pendingBulk=null;offset=0;
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
 // Removing the rendered panel is not authority to destroy its Worker.
 // Explicit cancellation/rebuild remains a deliberate ownership transition.
 return {dispose:()=>{if(searchTimer!==null)clearTimeout(searchTimer);},
   cancel:()=>revokeXml229VerifiedEngineeringBasis(key,{expectedSession:active})};
}
