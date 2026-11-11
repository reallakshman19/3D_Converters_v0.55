/**
 * O1/W09: ordinary single-source PSI116 XML→CII JSON uploads now use the
 * existing independent native source/domain Workers by default. Other modes
 * retain existing behavior. Source-facts never imply Preview/Weight rights.
 * Uses the existing R10 Worker and an independent page-batched, durable IndexedDB adapter.
 */
import {openIndexedPageRecordStore} from '../../../lfj/storage/browser/indexed-page-record-store.mjs';
import {createLfjSourceProgress,advanceLfjSourceProgress,mountLfjSourceProgress,updateLfjSourceProgress} from './xml-cii-adapted-lfj-o1-progress.js';
import {SOURCE_WORKER_SCHEMA,O1_SOURCE_MAX_BYTES} from '../../../lfj/ports/source-worker-port.mjs';
import {startLfjO1Domain,exportLfjO1Csv,mountLfjO1DomainUi,revokeLfjO1Domain} from './xml-cii-adapted-lfj-o1-domain-ui.js';
import {xmlCiiProcessingMode} from './xml-cii-adapted-processing-mode.js';
import {detectXmlCiiWorkflowSourceKind} from '../xml-cii-workflow-source-detect.js';
import {refreshResolverHierarchyScopeControl} from './xml-cii-adapted-resolver-scope.js';
import {
  createXml229StagedSourceIntent,advanceXml229StagedSourceReceipt,
} from '../integration/xml229-staged-source-receipt.mjs';
import {refreshXml229StagedSourceBadge} from './xml-cii-adapted-phase-panels.js';

const sessions=new WeakMap();
const SCOPE_SCHEMA='LFJ.O1.HierarchyScopes.v1';
const ALL_SCOPE='__ALL__';
function clearScope(stateRef,container){
 if(!stateRef?.current)return;
 stateRef.current={...stateRef.current,jsonTraceScopeId:ALL_SCOPE,
   resolverJsonTraceO1ScopeReadModel:null};
 refreshResolverHierarchyScopeControl(container,stateRef);
}
async function discoverWorkerScopes(job,session,stateRef,container){
 const model=await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../workers/lfj-o1-hierarchy-scope-worker.mjs',import.meta.url),{type:'module'});
  job.scopeWorker=worker;
  const timer=setTimeout(()=>{worker.terminate();reject(error('O1_SCOPE_WORKER_TIMEOUT'));},60000);
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(error('O1_SCOPE_WORKER_FAILED'));};
  worker.onmessage=({data:m})=>{
   clearTimeout(timer);worker.terminate();job.scopeWorker=null;
   if(m?.schema!==SCOPE_SCHEMA||m.kind!=='SCOPE_RESULT'||
      m.jobId!==job.id||m.sourceRefId!==job.ref||
      m.sourceSha256!==job.basis.sourceSha256||
      m.sourceRevision!==job.basis.sourceRevision){
     reject(error('O1_SCOPE_SOURCE_BASIS'));return;
   }
   resolve(m);
  };
  worker.postMessage({schema:SCOPE_SCHEMA,kind:'DISCOVER',
    jobId:job.id,sourceRefId:job.ref,sourceSha256:job.basis.sourceSha256,
    sourceRevision:job.basis.sourceRevision,blob:job.file});
 });
 if(session.job!==job||job.cancelled)return;
 stateRef.current={...stateRef.current,
   resolverJsonTraceO1ScopeReadModel:model,jsonTraceScopeId:ALL_SCOPE};
 refreshResolverHierarchyScopeControl(container,stateRef);
}

const error=(code)=>Object.assign(new Error(code),{code});
const safeCode=e=>{
  const code=String(e?.code||e?.message||'LFJ_SOURCE_FAILED').slice(0,100);
  return code==='O1_SOURCE_BYTE_LIMIT'?
    'O1_SOURCE_BYTE_LIMIT (original JSON must be at most 100 MiB / 104857600 bytes)':code;
};
const getSession=ref=>{
  if(!sessions.has(ref))sessions.set(ref,{optIn:true,job:null,requestSeq:0,status:'O1 Worker ready; load original PSI116 XML and JSON, then Build.',progress:createLfjSourceProgress(),progressRoot:null});
  return sessions.get(ref);
};
function eligibleSource(state){
  // The standalone resolver is proved for Single PSI116 XML+JSON. Do not
  // silently promote Mode-A/B multi-source or InputXML to this authority.
  return xmlCiiProcessingMode(state)==='single'&&
    ['auto','xml'].includes(state?.sourceKind||'auto')&&
    detectXmlCiiWorkflowSourceKind(state?.sourceText,'xml')==='xml';
}
function status(session,text){
  session.status=text;
  if(session.label)session.label.textContent=text;
}
// Lightweight serializable state only. The original File/Blob, page store and
// Worker remain in this module's session WeakMap. A receipt is source facts,
// never a fallback stagedJsonText or engineering/Run/CSV approval.
function publishJsonSourceReceipt(stateRef,container,receipt=null,sourceStatus='') {
  if(!stateRef?.current)return;
  stateRef.current={...stateRef.current,
    xml229StagedSourceReceipt:receipt,
    xml229StagedSourceStatus:sourceStatus,
    outputRunReadinessReport:null,outputRunReadinessStatus:'',
    result:null,
  };
  refreshXml229StagedSourceBadge(container,stateRef.current);
}
function revokeJsonSourceReceipt(stateRef,container) {
  const receipt=stateRef?.current?.xml229StagedSourceReceipt;
  if (receipt?.phase && receipt.phase!=='REVOKED') {
    publishJsonSourceReceipt(stateRef,container,
      advanceXml229StagedSourceReceipt(receipt,{kind:'REVOKE'}));
  } else publishJsonSourceReceipt(stateRef,container,null);
}
function sourceProgress(session,kind,extra={}){
  const nowMs=typeof performance==='object'?performance.now():0;
  session.progress=advanceLfjSourceProgress(session.progress,{kind,nowMs,...extra});
  updateLfjSourceProgress(session.progressRoot,session.progress);
}
function deleteDb(name){
  return new Promise(resolve=>{
    if(!name)return resolve();
    const req=indexedDB.deleteDatabase(name);
    req.onsuccess=req.onerror=req.onblocked=()=>resolve();
  });
}
async function revoke(job){
  if(!job)return;
  job.cancelled=true;
  try{job.worker?.terminate();}catch{}
  try{job.scopeWorker?.terminate();}catch{}
  try{await job.store?.abort();}catch{}
  try{job.store?.close();}catch{}
  await deleteDb(job.databaseName);
}
function validatePage(m,job){
  if(m.schema!==SOURCE_WORKER_SCHEMA||m.jobId!==job.id||
      m.sourceRefId!==job.ref||!Number.isSafeInteger(m.sequence)||
      m.sequence!==job.next||!Array.isArray(m.rows)||!m.rows.length||
      m.rows.length>1024)throw error('LFJ_PAGE_IDENTITY');
  if(!job.basis){
    const row=m.rows[0];
    if(typeof row.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sourceSha256)||
        !row.sourceRevision)throw error('LFJ_PAGE_SOURCE_ID');
    job.basis={sourceRefId:job.ref,sourceSha256:row.sourceSha256,sourceRevision:row.sourceRevision};
  }
  if(m.rows.some(row=>row.sourceRefId!==job.ref||
      row.sourceSha256!==job.basis.sourceSha256||
      row.sourceRevision!==job.basis.sourceRevision))
    throw error('LFJ_PAGE_MIXED_SOURCE');
}
async function recordPage(job,m){
  validatePage(m,job);
  if(!job.store)job.store=await openIndexedPageRecordStore({
    databaseName:job.databaseName,namespace:job.ref,generation:job.id,
    basis:job.basis,kind:'source'
  });
  await job.store.stagePage(m.rows);
  if(job.cancelled)throw error('LFJ_SOURCE_SUPERSEDED');
  job.pages++;job.next++;
  job.worker.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'PAGE_ACK',
    jobId:job.id,sourceRefId:job.ref,sequence:m.sequence});
}
async function finish(job,m){
  const s=m.summary;
  if(m.schema!==SOURCE_WORKER_SCHEMA||m.jobId!==job.id||
      m.sourceRefId!==job.ref||!job.store||
      s?.complete!==true||s.rightsBasis!=='SOURCE_FACTS_ONLY'||
      s.engineeringReady!==false||s.sourceSha256!==job.basis?.sourceSha256||
      s.sourceRevision!==job.basis.sourceRevision||
      s.eventCount!==s.occurrenceCount*2)throw error('LFJ_UNCOMMITTED_SOURCE');
  await job.store.commit(s);
  job.summary=s;
  return s;
}
async function scan(file,session,stateRef,container){
  clearScope(stateRef,container);
  // Intent is ordered at the browser change event, not after asynchronous IDB
  // cleanup. A prior scan must never install a job after a newer selection.
  const request=++session.requestSeq;
  status(session,'LFJ Worker: replacing original source; previous receipt invalid.');
  revokeJsonSourceReceipt(stateRef,container);
  sourceProgress(session,'REVOKED');
  revokeLfjO1Domain(session);
  const old=session.job;
  session.job=null;
  if(old)await revoke(old);
  if(request!==session.requestSeq)throw error('LFJ_SOURCE_SUPERSEDED');
  if(!(file instanceof File)||!file.size){
    publishJsonSourceReceipt(stateRef,container,null,'FAILED');
    throw error('LFJ_SOURCE_MISSING');
  }
  // Visible fail-closed policy rejection; prior source/domain/export rights
  // were revoked above before any new job or Worker is admitted.
  if(file.size>O1_SOURCE_MAX_BYTES){
    publishJsonSourceReceipt(stateRef,container,null,'FAILED');
    throw error('O1_SOURCE_BYTE_LIMIT');
  }
  const uuid=crypto.randomUUID();
  const job={id:uuid,ref:'lfj226-'+uuid,databaseName:'lfj226-source-'+uuid,
    file,worker:null,scopeWorker:null,store:null,basis:null,summary:null,next:0,pages:0,cancelled:false};
  session.job=job;
  job.receipt=advanceXml229StagedSourceReceipt(createXml229StagedSourceIntent({
    generationId:job.id,sourceRefId:job.ref,sourceRevision:job.id,
    byteLength:file.size,
  }),{kind:'INDEX_START'});
  publishJsonSourceReceipt(stateRef,container,job.receipt);
  sourceProgress(session,'START');
  status(session,'LFJ Worker: reading original Blob off the UI thread...');
  return await new Promise((resolve,reject)=>{
    let settled=false;
    const settle=(e,v)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(e)reject(e);else resolve(v);
    };
    const timer=setTimeout(()=>settle(error('LFJ_SOURCE_TIMEOUT')),180000);
    try{
      const worker=new Worker(new URL('../../../lfj/ports/source-browser-worker.mjs',import.meta.url),{type:'module'});
      job.worker=worker;
      worker.onerror=()=>settle(error('LFJ_WORKER_FAILURE'));
      worker.onmessage=async({data:m})=>{
        if(settled||job.cancelled)return;
        try{
          if(m?.kind==='PROVISIONAL_PAGE'){
            await recordPage(job,m);
            if(session.job===job&&!job.cancelled)sourceProgress(session,'PAGE',{pagesStaged:job.pages});
            if(job.pages===1||job.pages%8===0)
              status(session,'LFJ Worker: '+job.pages+' bounded pages staged (not committed)');
          }else if(m?.kind==='SCAN_DONE'){
            if(session.job===job&&!job.cancelled){
              sourceProgress(session,'COMMIT_PENDING');
              job.receipt=advanceXml229StagedSourceReceipt(job.receipt,{kind:'COMMIT_PENDING'});
              publishJsonSourceReceipt(stateRef,container,job.receipt);
            }
            const summary=await finish(job,m);
            worker.terminate();job.worker=null;
            settle(null,summary);
          }else if(m?.kind==='FAILED')settle(error(String(m.code||'LFJ_SCAN_FAILED')));
        }catch(e){settle(e);}
      };
      worker.postMessage({schema:SOURCE_WORKER_SCHEMA,kind:'SCAN',
        jobId:job.id,sourceRefId:job.ref,revision:job.id,blob:file,pageEvents:1024});
    }catch(e){settle(e);}
  }).then(summary=>{
    if(session.job!==job||job.cancelled)throw error('LFJ_SOURCE_SUPERSEDED');
    job.receipt=advanceXml229StagedSourceReceipt(job.receipt,{
      kind:'INDEX_COMMITTED',summary,durableCommitConfirmed:true,
      committedPageCount:job.pages,
    });
    publishJsonSourceReceipt(stateRef,container,job.receipt);
    sourceProgress(session,'SOURCE_COMMITTED',{summary});
    status(session,'LFJ source index COMMITTED: '+summary.occurrenceCount+
      ' original occurrences; SHA '+summary.sourceSha256.slice(0,12)+
      '. Trace/CSV NOT authorized by this intake.');
    void discoverWorkerScopes(job,session,stateRef,container).catch(e=>{
      if(session.job!==job||job.cancelled)return;
      stateRef.current={...stateRef.current,jsonTraceScopeId:ALL_SCOPE,
        resolverJsonTraceO1ScopeReadModel:{schema:SCOPE_SCHEMA,sourceRefId:job.ref,
          sourceSha256:job.basis.sourceSha256,sourceRevision:job.basis.sourceRevision,
          indexable:false,scopes:[],reason:String(e?.code||'O1_SCOPE_WORKER_FAILED')}};
      refreshResolverHierarchyScopeControl(container,stateRef);
    });
    return summary;
  }).catch(async e=>{
    if(request===session.requestSeq&&session.job===job){
      session.job=null;
      if(job.receipt?.phase){
        job.receipt=advanceXml229StagedSourceReceipt(job.receipt,{
          kind:'FAIL',reason:safeCode(e)});
        publishJsonSourceReceipt(stateRef,container,job.receipt,'FAILED');
      }else publishJsonSourceReceipt(stateRef,container,null,'FAILED');
      sourceProgress(session,'FAILED',{code:safeCode(e)});
      status(session,'LFJ Worker FAILED: '+safeCode(e)+'; no trace/export rights.');
    }
    await revoke(job);
    throw e;
  });
}
export function installLfjO1SourceIntake(container,stateRef){
  const field=container.querySelector('[data-mode-a-staged-json-all], [data-field="staged-json-file"]');
  if(!field)return;
  const session=getSession(stateRef);
  const supported=eligibleSource(stateRef.current);
  if(!supported&&session.job){
    revokeJsonSourceReceipt(stateRef,container);
    const old=session.job;session.job=null;
    sourceProgress(session,'UNAVAILABLE');
    revokeLfjO1Domain(session);void revoke(old);
  }
  const group=document.createElement('div');
  group.dataset.lfjO1Intake='true';
  group.style.cssText='padding:8px;border:1px solid #475569;margin:8px 0';
  const label=document.createElement('label');
  label.textContent=supported
    ? ' O1: Responsive native Worker trace (on by default for single PSI116 XML + JSON)'
    : ' O1: Standalone Worker trace applies to single PSI116 XML + JSON only';
  const toggle=document.createElement('input');
  toggle.type='checkbox';toggle.dataset.lfjO1Enable='true';
  toggle.checked=session.optIn&&supported;toggle.disabled=!supported;
  label.prepend(toggle);
  const progress=document.createElement('div');
  progress.dataset.lfjO1Status='true';
  progress.textContent=supported?session.status:'O1 Worker unavailable for this source kind or processing mode; no Worker trace/CSV rights.';
  session.label=progress;
  group.append(label,progress);
  session.progressRoot=mountLfjSourceProgress(group,supported?session.progress:advanceLfjSourceProgress(session.progress,{kind:'UNAVAILABLE'}));
  (field.parentElement?.parentElement || field.parentElement)?.appendChild(group);
  toggle.addEventListener('change',()=>{
    session.optIn=toggle.checked;
    if(!toggle.checked){
      revokeJsonSourceReceipt(stateRef,container);
      session.requestSeq++;
      revokeLfjO1Domain(session);
      const old=session.job;session.job=null;
      void revoke(old);
      status(session,'LFJ Worker opt-in disabled. No source output was promoted.');
      sourceProgress(session,'REVOKED');
    }
  });
  // Captured against the entire authored workspace. Original XML selection,
  // resolver configuration, or branch/scope change revokes old CSV controls
  // immediately, before the legacy handler mutates state asynchronously.
  container.addEventListener('change',event=>{
    const el=event.target;
    if(!(el instanceof Element))return;
    if(el.matches('[data-field="source-file"], [data-field="source-kind"],'+
      ' [data-field="support-config"], [data-field="resolver-json-config"],'+
      ' [data-field^="resolver-"], [data-field*="scope"],'+
      ' [data-branch-select], [data-branch-scope], [data-mode-a-enable]')){
      const originalXmlChanged=el.matches('[data-field="source-file"], [data-field="source-kind"]');
      // XML file/source kind is part of the job's user selection. Cancel
      // source admission too so a late receipt cannot revive old authority.
      if(originalXmlChanged){
        revokeJsonSourceReceipt(stateRef,container);
        session.requestSeq++;
        const old=session.job;session.job=null;
        void revoke(old);
      }
      revokeLfjO1Domain(session);
      sourceProgress(session,'REVOKED');
      status(session,'O1 source/config/selection changed; prior trace and CSV revoked. Build again.');
    }
  },true);
  // Registered before legacy Single / Mode-A handler; intercept only supported O1.
  field.addEventListener('change',event=>{
    if(!session.optIn||!eligibleSource(stateRef.current))return;
    event.stopImmediatePropagation();
    const file=event.target.files?.[0];
    if(!file){
      revokeJsonSourceReceipt(stateRef,container);
      return;
    }
    void scan(file,session,stateRef,container).catch(e=>{
      // A superseded request is not a failure of the newer user selection.
      if(e?.code!=='LFJ_SOURCE_SUPERSEDED'&&session.status.startsWith('LFJ Worker:')){
        sourceProgress(session,'FAILED',{code:safeCode(e)});
        status(session,'LFJ Worker FAILED: '+safeCode(e)+'; no trace/export rights.');
      }
    });
  },true);
  // Opt-in is a distinct O1 owned Worker flow. Capture Build/CSV before
  // legacy listeners; never synchronously parse staged JSON in the UI.
  for(const action of ['build-resolver-index','save-resolver-json-config',
    'download-node-wise-trace-csv','download-evidence-tree-csv']){
    container.querySelector('[data-action="'+action+'"]')?.addEventListener('click',e=>{
      if(!session.optIn||!eligibleSource(stateRef.current))return;
      e.preventDefault();e.stopImmediatePropagation();
      if(action==='build-resolver-index'||action==='save-resolver-json-config'){
        void startLfjO1Domain(session,stateRef).catch(err=>
          status(session,'O1 domain blocked: '+safeCode(err)+'; no output rights.'));
      }else{
        const kind=action==='download-node-wise-trace-csv'?'node':'evidence';
        void exportLfjO1Csv(session,kind).catch(err=>
          status(session,'O1 CSV blocked: '+safeCode(err)+'; no output rights.'));
      }
    },true);
  }
  mountLfjO1DomainUi(group,session);
}


/**
 * XML229 P3B.3 — narrow read-only handoff to the existing Preview Worker.
 * The original File never enters saved workspace state or the UI's JSON parser.
 * The O1 source index remains SOURCE_FACTS_ONLY; this merely exposes the
 * immutable Blob from the same committed job to one separately verified
 * Preview Worker request. No new source/digest rights are created here.
 */
export function resolveXml229CurrentPreviewBlob(stateRef,expectedReceipt) {
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const session=sessions.get(stateRef),job=session?.job;
  const live=stateRef?.current?.xml229StagedSourceReceipt;
  const same=(a,b)=>a&&b&&[
    'generationId','sourceRefId','sourceRevision','sha256',
    'byteLength','occurrenceCount','pageCount'
  ].every(key=>a[key]===b[key]);
  if(!session?.optIn||!job||job.cancelled||!job.store||!job.file||
     job.summary?.complete!==true||job.summary?.rightsBasis!=='SOURCE_FACTS_ONLY'||
     job.summary?.engineeringReady!==false||
     job.receipt?.phase!=='INDEX_COMMITTED'||live?.phase!=='INDEX_COMMITTED'||
     !same(job.receipt,live)||!same(live,expectedReceipt)||
     job.summary.sourceSha256!==live.sha256||
     job.summary.byteLength!==job.file.size||
     job.summary.sourceRevision!==live.sourceRevision||
     job.id!==live.generationId||job.ref!==live.sourceRefId)
    fail('XML229_PREVIEW_ORIGINAL_SOURCE_STALE');
  // The identity test is synchronous and cheap; caller must run it around
  // all awaits and again before accepting a Worker result.
  const isCurrent=()=>session.job===job&&!job.cancelled&&session.optIn&&
    same(stateRef?.current?.xml229StagedSourceReceipt,job.receipt)&&
    stateRef?.current?.xml229StagedSourceReceipt?.phase==='INDEX_COMMITTED';
  if(!isCurrent())fail('XML229_PREVIEW_ORIGINAL_SOURCE_STALE');
  return Object.freeze({blob:job.file,receipt:job.receipt,isCurrent,
    sourceSha256:live.sha256,sourceRevision:live.sourceRevision,
    sourceRefId:live.sourceRefId,generationId:live.generationId,
    byteLength:live.byteLength});
}

/** Explicit fresh-source transition: re-index the SAME genuine original File.
 * A new native scan/IDB commit creates its generation; no receipt is fabricated.
 */
export async function reindexXml229OriginalBlobForTopoFix(stateRef,{
 expectedReceipt,container,isCurrent=()=>false,
}={}){
 const original=resolveXml229CurrentPreviewBlob(stateRef,expectedReceipt);
 if(!eligibleSource(stateRef.current)||!isCurrent())
   throw error('TOPOFIX_FRESH_SOURCE_STALE');
 const session=getSession(stateRef),request=session.requestSeq+1;
 try{
   await scan(original.blob,session,stateRef,container);
   if(!isCurrent()||session.requestSeq!==request)
     throw error('TOPOFIX_FRESH_SOURCE_STALE');
   const current=resolveXml229CurrentPreviewBlob(stateRef,
     stateRef.current.xml229StagedSourceReceipt);
   if(current.receipt.generationId===expectedReceipt.generationId||
      current.receipt.sha256!==expectedReceipt.sha256)
     throw error('TOPOFIX_FRESH_O1_IDENTITY_DRIFT');
   return current;
 }catch(e){
   if(session.requestSeq===request){
     session.requestSeq++;
     revokeJsonSourceReceipt(stateRef,container);
     const job=session.job;session.job=null;await revoke(job);
   }
   throw e;
 }
}
