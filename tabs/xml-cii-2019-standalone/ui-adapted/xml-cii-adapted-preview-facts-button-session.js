// P3-A Preview-only actual-button adapter. Engineering resolution stays in
// the P2.2 Worker; old table remains the presentation/editor authority.
import {createPreviewBasis} from './xml-cii-adapted-preview-facts-basis.js';
import {openActualPreviewSourceFactPages,installActualPreviewSourceFactPanel}
  from './xml-cii-adapted-preview-facts-browser-read.js';
import {createXmlCiiPreviewJobController} from './xml-cii-adapted-preview-facts-job-controller.js';
import {startAttestedModeBPreviewWorkerSession}
  from './xml-cii-adapted-preview-facts-modeb-session.js';
import {assertBasisDigest,assertContentDigest,digestUtf8,digestCanonical,canonicalJson}
  from '../../../contracts/gc-pw-v1/contract.mjs';

import {executeXml229OriginalPreview} from '../integration/xml229-preview-original-blob-execution.mjs';

const jobs=new WeakMap();
const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const cryptoSha256=async(text)=>{
  if(!globalThis.crypto?.subtle)throw fail('CRYPTO_UNAVAILABLE','SHA-256 is required');
  const raw=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(raw)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
function masterRows(input){return Array.isArray(input)?input:[];}
function master(name,section,rows,mapping={}) {
  return {datasetId:String(section?.datasetId||name),
    revision:section?.revision??'source-session-v1',
    rowCount:rows.length,rows,mapping};
}
/** Bind actual full source + mapped masters + runtime override contents. */
export async function createPreviewButtonBasis({xmlText,config,stagedJsonText,sourceId}) {
  if(typeof sourceId!=='string'||!sourceId.trim())throw fail('SOURCE_ID_REQUIRED','Loaded XML source identity is missing');
  if(typeof xmlText!=='string'||!xmlText.trim())throw fail('XML_REQUIRED','XML source text missing');
  if(!config||typeof config!=='object'||Array.isArray(config))throw fail('CONFIG_REQUIRED','Preview config missing');
  const line=masterRows(config.linelist?.masterRows);
  const piping=masterRows(config.pipingClass?.masterRows);
  const material=masterRows(config.material?.mapRows);
  const weight=masterRows(config.weight?.masterRows);
  return createPreviewBasis({
    domainId:'xml-cii/2019',
    sources:[{sourceId,mediaType:'application/xml',text:xmlText}],
    selection:[{sourceId,selectionRef:'ALL'}],
    stagedSource:stagedJsonText||null,
    masters:{
      linelist:master('linelist',config.linelist,line,config.linelist?.fieldMap||{}),
      pipingClass:master('pipingClass',config.pipingClass,piping,config.pipingClass?.fieldMap||{}),
      material:master('material',config.material,material,config.material?.fieldMap||{}),
      weight:master('weight',config.weight,weight,config.weight?.fieldMap||{}),
    },
    config,overrides:config.overrides||{},sha256:cryptoSha256,
  });
}
async function resolveStaged(options,config) {
  const supplied=typeof options.resolveStagedJsonText==='function'
    ? await options.resolveStagedJsonText(config) : options.stagedJsonText;
  if(supplied&&typeof supplied==='object')
    return {text:String(supplied.text??supplied.stagedJsonText??''),
      label:String(supplied.label??supplied.sourceLabel??'')};
  return {text:String(supplied??''),label:String(options.stagedSourceLabel??'')};
}
/** Selected Owner/zone must not alias the full original source.
 * Reconciled with R16 PR #222; O1 uses '__ALL__' as its real UI sentinel.
 * Until A3 selected-original membership is wired, reject explicit non-ALL.
 */
function requestedOriginalScope(options) {
  const keys=['selectedScopeId','requestedOwnerZoneScopeId','jsonTraceScopeId'];
  const claims=[];
  for(const key of keys) {
    if(!Object.prototype.hasOwnProperty.call(options||{},key))continue;
    const value=options[key];
    if(typeof value!=='string'||!value.trim())
      throw fail('PREVIEW_SCOPE_INVALID',
        'Requested original Owner/zone scope '+key+' must be a nonempty string');
    const s=value.trim();
    claims.push(s==='ALL'||s==='__ALL__'?'__ALL__':s);
  }
  if(new Set(claims).size>1)
    throw fail('PREVIEW_SCOPE_CONFLICT','Multiple original Owner/zone selection claims disagree');
  return claims[0]||'__ALL__';
}
function sourceScope(host,config,options) {
  const sourceId=String(options?.sourceId||host?.dataset?.mcPreviewSourceId||'').trim();
  const manifest=options?.modeBManifest||options?.sourceOrderManifest||config?.modeBManifest||null;
  const advertised=String(options?.previewSourceMode||options?.sourceMode||config?.sourceMode||'').toUpperCase();
  const explicitB=advertised==='B'||config?.modeB?.enabled===true||config?.modeB===true;
  const mode=explicitB||manifest?'B':'A';
  const requestedScopeId=requestedOriginalScope(options);
  if(requestedScopeId!=='__ALL__')
    throw fail('PREVIEW_SELECTED_SCOPE_NOT_INTEGRATED',
      'Original Owner/zone '+requestedScopeId+
      ' is selected, but this Preview Worker has no verified selected-root manifest. '+
      'Select All or complete authenticated selected Preview integration.');
  if(mode==='B'&&!manifest)throw fail('MODE_B_MANIFEST_REQUIRED','Mode B source order/offset manifest required');
  // Mode B requires all original XML files, authenticated original->combined
  // mapping and content digests. Only the B3A+B3B1 attested Worker path can run.
  if(mode==='B')return {mode:'B',sourceId,manifest,selection:null};
  return {mode:'A',sourceId,manifest:null,selection:null};
}
function notice(host,{title,message='',code='',progress=null,showCancel=false,retry=null,cancel=null}) {
  host.innerHTML=`<div role="status" data-mc-preview-job-state class="model-converters-workflow-detail-note" style="padding:15px;border:1px solid #64748b;">
    <strong>${esc(title)}</strong>${code?` <code>${esc(code)}</code>`:''}
    ${message?`<div style="margin-top:6px;">${esc(message)}</div>`:''}
    ${progress?`<div data-mc-preview-job-progress style="margin-top:6px;">${esc(progress)}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:10px;">
    ${showCancel?'<button type="button" data-mc-preview-job-cancel>Cancel</button>':''}
    ${retry?'<button type="button" data-mc-preview-job-retry>Retry Preview</button>':''}
    </div></div>`;
  if(cancel)host.querySelector('[data-mc-preview-job-cancel]')?.addEventListener('click',cancel,{once:true});
  if(retry)host.querySelector('[data-mc-preview-job-retry]')?.addEventListener('click',retry,{once:true});
}
/**
 * Actual Build/Rebuild Preview callback: never fire-and-forget. Cancellation
 * also fences an unresolved staged-source provider promise.
 */
export async function runPreviewButtonSession({
  host,rootEl,xmlText,config,options={},renderResult,
}={}) {
  if(!host||typeof renderResult!=='function')throw fail('INVALID_PREVIEW_HOST','Preview renderer port missing');
  const previous=jobs.get(host);
  if(previous){
    previous.cancelled=true;
    previous.abortController?.abort();
    previous.controller?.cancel('Superseded Preview request');
  }
  const session={cancelled:false,controller:null,abortController:new AbortController()};
  jobs.set(host,session);
  const current=()=>!session.cancelled&&jobs.get(host)===session&&rootEl?.querySelector('#mc-preview-table-host')===host;
  const cancel=()=>{
    session.cancelled=true;
    session.abortController.abort();
    session.controller?.cancel('User cancelled');
    if(jobs.get(host)===session)notice(host,{title:'Preview cancelled',code:'CANCELLED',
      message:'Inputs and overrides remain unchanged.',retry:()=>void runPreviewButtonSession({
        host,rootEl,xmlText,config,options,renderResult})});
  };
  const retry=()=>void runPreviewButtonSession({host,rootEl,xmlText,config,options,renderResult});
  const begun=Date.now();
  try {
    // Validate explicit original scope before reading JSON or dispatching any Worker.
    const scope=sourceScope(host,config,options);
    notice(host,{title:'Resolving staged source…',showCancel:true,cancel});
    let staged;
    try{staged=await resolveStaged(options,config);}
    catch(error){throw fail('STAGED_SOURCE_FAILED',String(error?.message||error));}
    if(!current())return null;
    // XML229 P3B.3: original JSON stays in the O1 job. Existing Preview
    // controller, input basis and source-occurrence renderer remain in use.
    if(scope.mode==='A'&&(typeof options.resolveOriginalWorkerPreviewSource==='function'||
       typeof options.openVerifiedEngineeringSession==='function')){
      let original=null,r=null;
      if(typeof options.resolveOriginalWorkerPreviewSource==='function'){
      notice(host,{title:'Verifying original JSON source custody…',showCancel:true,cancel});
      original=await options.resolveOriginalWorkerPreviewSource(config);
      if(!current())return null;
      r=original?.receipt;
      if(!r||original.isCurrent?.()!==true||!original.blob||
         r.rightsBasis!=='SOURCE_FACTS_ONLY'||r.engineeringReady!==false||
         r.phase!=='INDEX_COMMITTED')
        throw fail('XML229_PREVIEW_ORIGINAL_SOURCE_STALE','Original indexed JSON source is no longer current');
      }
      // XML229: use the actual 4 Preview Build as the sole user trigger.
      // The verified engineering Worker already computed these Preview rows.
      if(typeof options.openVerifiedEngineeringSession==='function'){
        notice(host,{title:'Verifying original physical Preview in Worker…',
          message:'Original XML census, optional JSON custody, four masters and full FactRecords.',
          showCancel:true,cancel});
        const verified=await options.openVerifiedEngineeringSession({
          signal:session.abortController.signal,
          onProgress:stage=>{
            if(current())notice(host,{title:'Verifying engineering Preview…',
              progress:String(stage),showCancel:true,cancel});
          },
        });
        if(!current()){verified.cancel();return null;}
        session.controller={cancel:()=>{verified.cancel();return true;}};
        const result=await verified.readPreviewResult();
        const proof=await verified.readCompletion();
        if(!current())return null;
        if((r?(verified.receipt.originalJsonSha256!==r.sha256||
          verified.receipt.sourceGenerationId!==r.generationId):
          (verified.receipt.reviewSourceKind!=='XML_ONLY'||
           verified.receipt.originalJsonSha256!==null||
           verified.receipt.sourceXmlSha256!==await digestUtf8(xmlText)))||
          proof?.basisId!==verified.receipt.basisId||
          proof?.engineeringFactsVerified!==true||
          proof?.verifiedPhysicalCount!==verified.receipt.physicalCount||
          proof?.ciiReleaseAuthorized!==false)
          throw fail('ENGINEERING_PREVIEW_CUSTODY_DRIFT',
            'Original Preview/GC-PW Worker does not match current indexed source');
        const rendered=await renderResult(result,{text:'',
          label:r?'original JSON source-verified engineering Worker':'XML source-verified engineering Worker'});
        if(!current())return null;
        host.__xmlCiiPreviewOriginalOccurrences=result.sourceOccurrences;
        host.__xmlCiiVerifiedEngineeringReceipt=proof;
        host.dataset.mcPreviewBasisId=verified.receipt.basisId;
        if(r)host.dataset.mcPreviewOriginalJsonSha256=r.sha256;
        host.dataset.mcPreviewJsonSource=r?'P4_ENGINEERING_VERIFIED':'XML_ONLY_ENGINEERING_VERIFIED';
        const evidence=document.createElement('div');
        evidence.setAttribute('data-mc-preview-verified-engineering','');
        evidence.setAttribute('role','status');
        evidence.className='model-converters-workflow-detail-note';
        evidence.textContent='Verified original engineering Preview: '+
          proof.verifiedPhysicalCount+' physical components / '+
          proof.verifiedFactCount+' complete FactRecords. '+
          'Weight Match uses this same session; native CII Run remains HELD.';
        host.prepend(evidence);
        if(r)options.onOriginalWorkerPreviewCompleted?.({
          result,sourceReceipt:r,basisId:verified.receipt.basisId});
        // This completed session belongs to the shared GC-PW review, not to
        // the transient Preview job controller. A repeated Build with an
        // unchanged basis must NOT cancel accepted Match-1/Final decisions.
        session.controller=null;
        return rendered;
      }
      // This descriptor is used ONLY for InputBasis hashing, never as JSON.
      const sourceDescriptor=JSON.stringify({
        schema:'XML229.PreviewOriginalBasis.v1',
        sha256:r.sha256,sourceRefId:r.sourceRefId,
        generationId:r.generationId,sourceRevision:r.sourceRevision,
        byteLength:r.byteLength,occurrenceCount:r.occurrenceCount,
      });
      const calculateBasis=()=>createPreviewButtonBasis({
        xmlText,config,stagedJsonText:sourceDescriptor,sourceId:scope.sourceId,
      });
      const basis=await calculateBasis();
      if(!current()||original.isCurrent()!==true)return null;
      const controller=createXmlCiiPreviewJobController({
        execute:spec=>executeXml229OriginalPreview({
          ...spec,originalSourceSession:original,
        }),
        verifyBasis:async(currentBasis)=>{
          if(original.isCurrent()!==true)return false;
          const live=await options.resolveOriginalWorkerPreviewSource(config);
          if(live?.blob!==original.blob||live?.isCurrent?.()!==true||
             live?.receipt?.sha256!==r.sha256||
             live?.receipt?.generationId!==r.generationId)return false;
          return (await calculateBasis()).basisId===currentBasis.basisId;
        },
      });
      session.controller=controller;
      controller.subscribe(state=>{
        if(!current()||!['queued','running'].includes(state.state))return;
        notice(host,{title:state.state==='queued'
          ?'Original JSON Preview queued…':'Calculating original JSON Preview in Worker…',
          progress:String(state.stage||'basis-attestation')+' · '+state.completed+'/'+state.total,
          message:'Source SHA-256 and selected input revisions remain attested.',
          showCancel:true,cancel});
      });
      const job=controller.start({
        requestId:'xml229-preview-'+begun+'-'+basis.basisId.slice(0,12),
        basis,input:{xmlText,config,stagedJsonText:'',scope},
      });
      const result=await job.promise;
      if(!current())return null;
      const latest=await options.resolveOriginalWorkerPreviewSource(config);
      const now=await calculateBasis();
      if(latest?.blob!==original.blob||latest?.isCurrent?.()!==true||
         now.basisId!==basis.basisId)
        throw fail('XML229_PREVIEW_INPUT_CHANGED','Original source/selection/master/config changed while Preview calculated');
      const sourcePages=await openActualPreviewSourceFactPages({
        basis,xmlText,sourceId:scope.sourceId,
        sourceOccurrences:result.sourceOccurrences,mode:scope.mode,
      });
      if(!current()||original.isCurrent()!==true)return null;
      const rendered=await renderResult(result,{text:'',label:'original Worker-indexed JSON'});
      if(!current()||original.isCurrent()!==true)return null;
      installActualPreviewSourceFactPanel(host,sourcePages);
      host.__xmlCiiPreviewOriginalOccurrences=result.sourceOccurrences;
      host.dataset.mcPreviewBasisId=basis.basisId;
      host.dataset.mcPreviewOriginalJsonSha256=r.sha256;
      host.dataset.mcPreviewJsonSource='O1_WORKER_VERIFIED';
      options.onOriginalWorkerPreviewCompleted?.({result,sourceReceipt:r,basis});
      return rendered;
    }
    if(scope.mode==='B'){
      notice(host,{title:'Authenticating original Mode B XML files…',
        message:'Checking every original file, combined XML, source order and master revision.',
        showCancel:true,cancel});
      // Original files must come from the authenticated importer/caller. Do not
      // infer lineage from the combined XML, filenames or duplicated branch names.
      const originals=typeof options.resolveModeBOriginalSources==='function'
        ? await options.resolveModeBOriginalSources(config,scope)
        : options.modeBOriginalSources;
      if(!current())return null;
      if(!Array.isArray(originals)||originals.length<2)
        throw fail('MODE_B_ORIGINAL_SOURCES_REQUIRED',
          'Mode B Preview needs all original XML files. Re-import originals, then retry.');
      const ports={assertBasisDigest,assertContentDigest,digestUtf8,digestCanonical,canonicalJson};
      const sessionJob=await startAttestedModeBPreviewWorkerSession({
        originalSources:originals,
        combinedSource:{sourceId:scope.sourceId,xmlText},
        manifest:scope.manifest,config,stagedJsonText:staged.text,
        ports,requestId:`modeb-preview-${begun}-${crypto.randomUUID?.()||'local'}`,
        onProgress:(state)=>{
          if(!current())return;
          notice(host,{title:state.state==='queued'?'Mode B Preview queued…':
            state.state==='running'?'Building Mode B Preview in Worker…':'Mode B Preview…',
            progress:`${state.stage||'source-custody'} · ${state.completed}/${state.total}`,
            message:'Original source identity remains separately attested.',
            showCancel:true,cancel});
        },
      });
      if(!current()){sessionJob.cancel();return null;}
      session.controller=sessionJob;
      const committed=await sessionJob.promise;
      if(!current())return null;
      const rendered=await renderResult(committed.result,staged);
      if(!current())return null;
      installActualPreviewSourceFactPanel(host,committed.sourcePages);
      host.__xmlCiiPreviewOriginalOccurrences=committed.result.sourceOccurrences;
      host.dataset.mcPreviewBasisId=committed.basis.basisId;
      host.dataset.mcPreviewSourceMode='B';
      return rendered;
    }
    notice(host,{title:'Checking input and master revisions…',showCancel:true,cancel});
    const basis=await createPreviewButtonBasis({
      xmlText,config,stagedJsonText:staged.text,sourceId:scope.sourceId});
    if(!current())return null;
    const controller=createXmlCiiPreviewJobController({
      verifyBasis:async(currentBasis,spec)=>{
        const actual=await createPreviewButtonBasis({
          xmlText:spec.input.xmlText,config:spec.input.config,
          stagedJsonText:spec.input.stagedJsonText,sourceId:spec.input.scope.sourceId});
        return actual.basisId===currentBasis.basisId;
      },
    });
    session.controller=controller;
    controller.subscribe(state=>{
      if(!current()||!['queued','running'].includes(state.state))return;
      notice(host,{title:state.state==='queued'?'Preview queued…':'Building preview in Worker…',
        progress:`${state.stage||'preparing'} · ${state.completed}/${state.total}`,
        showCancel:true,cancel});
    });
    const input={xmlText,config,stagedJsonText:staged.text,scope};
    const handle=controller.start({requestId:`preview-${begun}-${basis.basisId.slice(0,12)}`,
      basis,input});
    const result=await handle.promise;
    if(!current())return null;
    const sourcePages=await openActualPreviewSourceFactPages({
      basis,xmlText,sourceId:scope.sourceId,sourceOccurrences:result.sourceOccurrences,mode:scope.mode});
    if(!current())return null;
    // A user edit made during worker execution must never be hidden by a stale result.
    // Re-resolve the optional JSON input too: its absence is part of the basis.
    const latestStaged=await resolveStaged(options,config);
    const liveBasis=await createPreviewButtonBasis({
      xmlText,config,stagedJsonText:latestStaged.text,sourceId:scope.sourceId});
    if(liveBasis.basisId!==basis.basisId)throw fail('STALE_INPUT_BASIS',
      'Source/master/overrides changed while Preview was computing. Retry with current inputs.');
    if(!current())return null;
    const rendered=await renderResult(result,staged);
    if(!current())return null;
    installActualPreviewSourceFactPanel(host,sourcePages);
    host.__xmlCiiPreviewOriginalOccurrences=result.sourceOccurrences;
    host.dataset.mcPreviewBasisId=basis.basisId;
    return rendered;
  }catch(error) {
    if(!current())return null;
    const code=String(error?.code||'PREVIEW_BUILD_FAILED');
    notice(host,{title:'Preview failed',code,
      message:String(error?.message||error),retry});
    return null;
  }
}
