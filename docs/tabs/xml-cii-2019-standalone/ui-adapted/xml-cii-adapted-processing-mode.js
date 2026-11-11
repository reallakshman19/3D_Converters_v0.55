import { commonModeASupportConfig } from '../xml-cii-mode-a-batch.js?v=20260930-issue781-branch-scope-1';
import { clearModeASourceCaches, replaceModeAState } from './xml-cii-adapted-mode-a-state.js?v=20261001-weight-output-2';

export function xmlCiiProcessingMode(state = {}) {
  return ['single', 'mode-a', 'mode-b'].includes(state.xmlProcessingMode) ? state.xmlProcessingMode : 'single';
}

export function selectXmlCiiProcessingMode(stateRef, mode, render) {
  const rawRef = stateRef.modeABaseRef || stateRef;
  replaceModeAState(rawRef, { ...rawRef.current, xmlProcessingMode: mode,
    activePhaseId: 'source', activeSubTabId: 'loader' });
  render();
}

// A combined document is a new Single source. Node-specific overrides and
// staged geometry from its constituent files cannot describe that new source.
export function singleXmlCiiSourceState(state, sourceFile, sourceText, sourceKind = 'auto') {
  const configJson = commonModeASupportConfig(state.supportConfigJson || '{}');
  return { ...state, xmlProcessingMode: 'single', sourceFile, sourceText, sourceKind,
    supportConfigJson: configJson,
    masterContext: state.masterContext ? { ...state.masterContext, config: JSON.parse(configJson) } : null,
    sourceBatch: null, branchScope: null, branchSelection: {}, stagedJsonFile: null, stagedJsonText: '',
    elementSideLoadText: '', regexTesterResult: null, resolverJsonTraceResult: null,
    resolverJsonTraceJsonResult: null, resolverJsonTraceTableResult: null,
    manualElementSideloadResult: null, previewDiagnosticsAuditReport: null,
    weightMatchResult: null, weightMatchOverridesJson: '{}', supportTypeMapperResult: null,
    outputRunReadinessReport: null, result: null, batchRunResult: null, batchRunStatus: '',
    format1SelectedSample: '', format2SelectedSample: '', activePhaseId: 'source', activeSubTabId: 'loader' };
}

export function loadXmlCiiSingleSource(stateRef, sourceFile, sourceText, render, sourceKind = 'auto') {
  const rawRef = stateRef.modeABaseRef || stateRef;
  clearModeASourceCaches();
  replaceModeAState(rawRef, singleXmlCiiSourceState(rawRef.current, sourceFile, sourceText, sourceKind));
  render();
}
