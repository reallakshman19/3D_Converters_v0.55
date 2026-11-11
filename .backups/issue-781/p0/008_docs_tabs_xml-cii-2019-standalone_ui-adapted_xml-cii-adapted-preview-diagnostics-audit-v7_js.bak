import {
  _xmlCiiOpenPreviewOverridePopup,
  renderStandaloneDiagnosticsReportPanel,
} from './xml-cii-adapted-preview-diagnostics-audit.js?v=20260929-pr780-metadata-1';
import {
  xmlCiiBuildAndRenderPreview,
  xmlCiiRenderPreviewPhase,
} from './xml-cii-adapted-preview-renderer-v7.js';
import { clearPreviewCachesV7 } from './xml-cii-adapted-preview-cache-v7.js';
import { installPreviewB313WallUpdateAuditController } from './xml-cii-adapted-preview-b313-wall-audit-controller.js?v=20260928-issue776-authority-1';
import { materializeXmlCiiDatasetBackedConfig } from '../xml-cii-dataset-backed-config.js?v=20260929-pr780-dataset-operation-1';
import { compactDatasetBackedConfig } from './xml-cii-adapted-master-runtime.js';
import {
  saveMasterContextToLocalStorage,
  updateWorkflowState,
  xmlCiiEnrichedConfigFromState,
} from './xml-cii-adapted-state.js';

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

export async function renderStandalonePreviewReportPanel(card, stateRef, render) {
  const state = stateRef && stateRef.current !== undefined ? stateRef.current : stateRef;
  const config = await previewConfigFromState(state);
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
    }
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
    stagedJsonText: state.stagedJsonText || '',
    stagedSourceLabel: state.stagedJsonFile?.name || '',
    resolveStagedJsonText: async () => {
      const current = stateRef && stateRef.current !== undefined ? stateRef.current : state;
      return {
        text: current.stagedJsonText || '',
        label: current.stagedJsonFile?.name || '',
      };
    },
  };

  try {
    await xmlCiiBuildAndRenderPreview(card, xmlText, config, options);
    installPreviewB313WallUpdateAuditController({ host, config, xmlText, options });
  } catch (error) {
    console.error('Failed to build standalone preview table:', error);
    host.innerHTML = `<div class="xml-cii-phase-help" style="border-color:#7f1d1d;color:#7f1d1d;background:#fff7f7;">⚠ Build failed: ${esc(error?.message || error)}</div>`;
  }
}
