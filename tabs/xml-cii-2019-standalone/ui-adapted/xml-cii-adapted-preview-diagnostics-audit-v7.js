import {
  _xmlCiiOpenPreviewOverridePopup,
  renderStandaloneDiagnosticsReportPanel,
} from './xml-cii-adapted-preview-diagnostics-audit.js?v=20261001-weight-output-2';
import {
  xmlCiiBuildAndRenderPreview,
  xmlCiiRenderPreviewPhase,
} from './xml-cii-adapted-preview-renderer-v7.js?v=20261001-weight-output-2';
import { clearPreviewCachesV7 } from './xml-cii-adapted-preview-cache-v7.js';
import { installPreviewB313WallUpdateAuditController } from './xml-cii-adapted-preview-b313-wall-audit-controller.js?v=20261001-weight-output-2';
import { installPreviewB313AutoBasisPanel } from './xml-cii-adapted-preview-b313-auto-basis.js?v=20261001-weight-output-2';
import { materializeXmlCiiDatasetBackedConfig } from '../xml-cii-dataset-backed-config.js?v=20261001-weight-output-2';
import {openXml229P4VerifiedSession,getXml229CurrentWorkerHeldReview}
 from './xml-cii-adapted-p4-verified-weight-panel.js';
import {readXml229LivePreviewForCurrentInput}
 from '../integration/xml229-live-preview-restoration.mjs';
import { compactDatasetBackedConfig } from './xml-cii-adapted-master-runtime.js';
import {
  saveMasterContextToLocalStorage,
  updateWorkflowState,
  xmlCiiEnrichedConfigFromState,
} from './xml-cii-adapted-state.js?v=20261001-weight-output-2';

import {resolveXml229CurrentPreviewBlob} from './xml-cii-adapted-lfj-o1-intake.js';
import {hasXml229PreviewJsonSource} from './xml229-preview-json-source.mjs';
import {xmlCiiBranchScopeFromState} from '../xml-cii-branch-scope.js';

export { renderStandaloneDiagnosticsReportPanel };

export async function previewConfigFromState(state, options = {}) {
  return materializeXmlCiiDatasetBackedConfig(
    xmlCiiEnrichedConfigFromState(state),
    state,
    options,
  );
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function modeASourceInputs(stateRef, sourceId) {
  // Read the underlying batch state: sourceRef.current rebuilds the selected
  // XML scope, including a full XML parse, on every access.
  const base = stateRef?.modeABaseRef?.current || stateRef?.current;
  if (!base) return null;
  const source = stateRef?.modeABaseRef && sourceId
    ? base.sourceBatch?.sources?.find((row) => row.sourceId === sourceId) : base;
  if (!source) return null;
  const active = source === base || base.sourceBatch?.activeSourceId === sourceId;
  return {
    sourceText: active ? base.sourceText : source.sourceText,
    sourceFile: active ? base.sourceFile : source.sourceFile,
    stagedJsonText: active ? base.stagedJsonText : source.stagedJsonText,
    stagedJsonFile: active ? base.stagedJsonFile : source.stagedJsonFile,
    branchSelection: JSON.stringify((active ? base.branchSelection : source.branchSelection) || {}),
    masterContext: base.masterContext,
    datasetRefs: base.masterContext?.datasetRefs,
    dependencyRevisions: JSON.stringify(base.dependencyRevisions || {}),
    xml229StagedSourceReceipt: active ? base.xml229StagedSourceReceipt : null,
    xml229StagedSourceStatus: active ? base.xml229StagedSourceStatus : '',
  };
}

function previewInputsCurrent(card, stateRef, sourceId, captured) {
  if (!captured) return true;
  if (card?.isConnected === false) return false;
  const current = modeASourceInputs(stateRef, sourceId);
  return !!current && Object.keys(captured).every((key) => captured[key] === current[key]);
}

export async function renderStandalonePreviewReportPanel(card, stateRef, render) {
  const state = stateRef && stateRef.current !== undefined ? stateRef.current : stateRef;
  let sourceInputs = modeASourceInputs(stateRef, state.modeASourceId);
  const config = await previewConfigFromState(state);
  if (!previewInputsCurrent(card, stateRef, state.modeASourceId, sourceInputs)) return;
  const traceResult = state.resolverJsonTraceResult;
  const traceDataPresent = (Array.isArray(traceResult?.resolvedFacts) && traceResult.resolvedFacts.length > 0)
    || (Array.isArray(traceResult?.matchedFacts) && traceResult.matchedFacts.length > 0);
  if (traceDataPresent && config.useJsonTraceStagedSource == null && config.useParsedCustomInputSource == null && config.useParsedCustomInputSourceForPreview == null) {
    config.useJsonTraceStagedSource = true;
    config.useParsedCustomInputSource = true;
    config.useParsedCustomInputSourceForPreview = true;
  }

  const xmlText = state.sourceText || '';
  const xmlFile = state.sourceFile || (xmlText ? new File([xmlText], 'source.xml', { type: 'application/xml' }) : null);
  card.innerHTML = xmlCiiRenderPreviewPhase(xmlFile, config);
  const host = card.querySelector('#mc-preview-table-host');
  if (!host) return;

  const persistConfig = (newCfg, { clearPreview = true } = {}) => {
    if (clearPreview) clearPreviewCachesV7();
    if (stateRef && stateRef.current !== undefined) {
      const currentContext = stateRef.current.masterContext || {};
      const compactConfig = compactDatasetBackedConfig(newCfg, currentContext);
      const routed = updateWorkflowState(stateRef.current, {
        supportConfigJson: JSON.stringify(compactConfig, null, 2),
      });
      stateRef.current = { ...routed, masterContext: { ...currentContext, config: compactConfig } };
      saveMasterContextToLocalStorage(stateRef.current.masterContext);
      sourceInputs = modeASourceInputs(stateRef, state.modeASourceId);
    }
  };

  // O1 original Owner/site selection is independent of XML branchSelection.
  // Bind it to the actual Build Preview button, and invalidate it on change.
  const scopeSnapshot = stateRef?.modeABaseRef?.current || state;
  const capturedJsonTraceScopeId = scopeSnapshot?.jsonTraceScopeId ?? state.jsonTraceScopeId ?? '__ALL__';
  const currentJsonTraceScopeId = () =>
    (stateRef?.modeABaseRef?.current || stateRef?.current || {}).jsonTraceScopeId ?? '__ALL__';
  const stagedSource = {
    text: state.stagedJsonText || '',
    label: state.stagedJsonFile?.name || '',
  };
  const options = {
    onSaveConfig: (newCfg) => persistConfig(newCfg, { clearPreview: true }),
    onSaveConfigPreservePreview: (newCfg) => persistConfig(newCfg, { clearPreview: false }),
    onB313WallUpdateReport: (report) => {
      if (stateRef && stateRef.current !== undefined) {
        stateRef.current = { ...stateRef.current, b313WallUpdateReport: report };
      }
    },
    openOverridePopup: _xmlCiiOpenPreviewOverridePopup,
    ensureOverrides: (cfg) => {
      if (!cfg.overrides) cfg.overrides = {};
      return cfg.overrides;
    },
    jsonTraceScopeId: capturedJsonTraceScopeId,
    ...(state.selectedScopeId != null ? { selectedScopeId: state.selectedScopeId } : {}),
    ...(state.requestedOwnerZoneScopeId != null ? {
      requestedOwnerZoneScopeId: state.requestedOwnerZoneScopeId
    } : {}),
    stagedJsonText: stagedSource.text,
    stagedSourceLabel: stagedSource.label,
    // These SOURCE_FACTS_ONLY fields do not provide Preview JSON data.
    // The V7 boundary must visibly HOLD instead of signing a JSON 0B digest.
    originalStagedSourceReceipt:state.xml229StagedSourceReceipt || null,
    originalStagedSourceStatus:state.xml229StagedSourceStatus || '',
    // XML229 production B1 route. This callback never puts File/Blob into
    // state or reads/parses the JSON on the UI thread; the original source
    // Worker will independently verify its complete SHA before Preview.
    ...(state.xmlProcessingMode!=='mode-b'&&/<PipeStressExport(?:\s|>)/.test(xmlText)?{
      openVerifiedEngineeringSession: ({onProgress,signal}={})=>
        openXml229P4VerifiedSession(stateRef,{onProgress,signal}),
    }:{}),
    ...(hasXml229PreviewJsonSource(state) ? {
    resolveOriginalWorkerPreviewSource: async () => {
      if(currentJsonTraceScopeId() !== capturedJsonTraceScopeId)
        throw Object.assign(new Error('Original Owner/zone selection changed; rebuild Preview'),
          {code:'XML229_PREVIEW_SCOPE_CHANGED'});
      if(!previewInputsCurrent(card,stateRef,state.modeASourceId,sourceInputs))
        throw Object.assign(new Error('Preview source/selection/config changed'),
          {code:'XML229_PREVIEW_INPUT_CHANGED'});
      // The branch-scoped UI ref already contains FILTERED XML. Test scope
      // against the underlying unfiltered Mode-A original, otherwise a partial
      // selection appears falsely to be "all" after filtering.
      const current=stateRef?.modeABaseRef?.current||stateRef?.current||{};
      const scope=xmlCiiBranchScopeFromState({
        sourceKind:'xml',sourceText:current.sourceText||'',
        branchSelection:current.branchSelection||{},
      });
      if(current.sourceText!==xmlText)
        throw Object.assign(new Error('Filtered or replaced XML cannot claim full O1 source scope'),
          {code:'XML229_PREVIEW_ORIGINAL_XML_SCOPE_STALE'});
      // Existing B1 Worker computes the original full XML only. A selected
      // subset needs its own original-occurrence join; do not silently use ALL.
      if(!scope.applicable||scope.blocked||
         scope.selectedBranchOccurrences.length!==scope.sourceBranchOccurrences.length)
        throw Object.assign(new Error('Selected partial scope needs a separate source-bound Preview implementation'),
          {code:'XML229_PREVIEW_PARTIAL_SCOPE_HELD'});
      // O1 session is keyed by the unwrapped Mode-A ref in the workflow shell;
      // B1 receives a branch-scoped wrapper. Never key O1 by that wrapper.
      return resolveXml229CurrentPreviewBlob(
        stateRef?.modeABaseRef||stateRef,options.originalStagedSourceReceipt);
    },
    } : {}),
    resolveStagedJsonText: async () => {
      if (!previewInputsCurrent(card, stateRef, state.modeASourceId, sourceInputs)) {
        throw new Error('Preview source or branch selection changed during build; rebuild Preview.');
      }
      return stagedSource;
    },
  };

  try {
    // Tab navigation recreates #mc-preview-table-host. Do not lose a LIVE,
    // verified original-source engineering Preview or substitute an unrelated
    // legacy localStorage result. A full reload without its Worker must Build.
    const originalState=stateRef?.modeABaseRef?.current||state;
    const governed=typeof options.openVerifiedEngineeringSession==='function';
    let previewResult=null;
    const existing=governed?getXml229CurrentWorkerHeldReview(stateRef):null;
    if(existing){
      const isCurrent=()=>previewInputsCurrent(card,stateRef,
        state.modeASourceId,sourceInputs) &&
        currentJsonTraceScopeId()===capturedJsonTraceScopeId;
      try{
        const {result,proof,receipt}=await readXml229LivePreviewForCurrentInput({
          session:existing,input:originalState,isCurrent,
        });
        if(!isCurrent())return;
        previewResult=await xmlCiiBuildAndRenderPreview(card,xmlText,config,{
          ...options,forceBuild:true,skipLegacyCache:true,
          precomputedPreview:result,
          precomputedStagedSource:{text:'',label:'original verified GC-PW Worker'},
        });
        if(!isCurrent())return;
        host.__xmlCiiPreviewOriginalOccurrences=result.sourceOccurrences;
        host.__xmlCiiVerifiedEngineeringReceipt=proof;
        host.dataset.mcPreviewBasisId=receipt.basisId;
        if(proof.originalJsonSha256)host.dataset.mcPreviewOriginalJsonSha256=proof.originalJsonSha256;
        if(receipt.reviewSourceKind==='XML_ONLY')host.dataset.mcPreviewJsonSource='XML_ONLY_ENGINEERING_VERIFIED';
        else host.dataset.mcPreviewJsonSource='P4_ENGINEERING_VERIFIED';
        const evidence=document.createElement('div');
        evidence.setAttribute('data-mc-preview-verified-engineering','');
        evidence.setAttribute('role','status');
        evidence.className='model-converters-workflow-detail-note';
        evidence.textContent='Restored current source-bound engineering Preview: '+
          proof.verifiedPhysicalCount+' physical components / '+
          proof.verifiedFactCount+' complete FactRecords. '+
          'Match-1/Final are separately reviewed; native CII Run HELD.';
        host.prepend(evidence);
      }catch(error){
        if(!isCurrent())return;
        // The missing/stale Worker is not a license for legacy cache reuse.
        // Only a bounded error code is exposed; private paths are not logged.
        const code=String(error?.code||'PREVIEW_RESTORE_UNAVAILABLE');
        const safeCode=/^[A-Z][A-Z0-9_]{2,79}$/.test(code)
          ?code:'PREVIEW_RESTORE_UNAVAILABLE';
        const notice=document.createElement('div');
        notice.setAttribute('data-mc-preview-restore-held','');
        notice.setAttribute('role','status');
        notice.textContent='Source-bound Preview restore HELD ['+safeCode+
          ']. Use Build Preview to verify current source and masters.';
        host.append(notice);
      }
    }
    if(!previewResult)previewResult=await xmlCiiBuildAndRenderPreview(
      card,xmlText,config,{...options,skipLegacyCache:governed});
    if (previewResult?.blocked) return; // No computed rows or review snapshot.
    if (!previewInputsCurrent(card, stateRef, state.modeASourceId, sourceInputs)) return;
    installPreviewB313WallUpdateAuditController({
      host,
      config,
      xmlText,
      rows: previewResult?.branchRows || [],
      options,
    });
    queueMicrotask(() => installPreviewB313AutoBasisPanel({
      host,
      config,
      rows: previewResult?.branchRows || [],
      options,
    }));
  } catch (error) {
    console.error('Failed to build standalone preview table:', error);
    host.innerHTML = `<div class="xml-cii-phase-help" style="border-color:#7f1d1d;color:#7f1d1d;background:#fff7f7;">⚠ Build failed: ${esc(error?.message || error)}</div>`;
  }
}
