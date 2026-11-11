import { validateSupportConfigJson } from '../xml-cii-workflow-api.js?v=20261001-single-weight-owners-1';
import { createElement, appendLabeledControl, createOption } from './xml-cii-adapted-dom.js';
import { getAdaptedWorkflowPhase } from './xml-cii-adapted-phase-registry.js';
import { renderInputXmlControls, renderSourceControls, renderSourceTextControl, renderStagedJsonControl } from './xml-cii-adapted-controls.js?v=20261001-weight-output-2';
import { renderStandaloneSourceModePanel, renderDetectionSummary, renderValidityDiagnostics } from './xml-cii-adapted-source-mode.js?v=20261001-weight-output-2';
import { renderStandaloneSourcePreviewPanel } from './xml-cii-adapted-source-preview.js';
import { renderStandaloneImportMastersPanel } from './xml-cii-adapted-import-masters.js?v=20261006-c05-5-5-persistence-retry-1';
import { renderStandaloneRegexTesterPanel } from './xml-cii-adapted-regex-tester.js?v=20261001-weight-output-2';
import { renderStandaloneResolverJsonTracePanel } from './xml-cii-adapted-resolver-json-trace.js';
import { renderStandaloneInputXmlElementSideloadPanel, renderStandaloneManualElementSideloadPanel } from './xml-cii-adapted-manual-element-sideload.js';
import { renderStandaloneDiagnosticsReportPanel, renderStandalonePreviewReportPanel } from './xml-cii-adapted-preview-diagnostics-audit-v7.js?v=20261001-weight-output-2';
import { renderStandalonePropagationAuditPanel } from './xml-cii-adapted-propagation-audit.js?v=20261001-weight-output-2';
import { renderAdaptedWeightMatchPanelV2 } from './xml-cii-adapted-weight-match-v2.js?v=20261001-single-weight-owners-1';
import { renderStandaloneSupportTypeMapperPanel } from './xml-cii-adapted-support-type-mapper.js?v=20261001-weight-output-2';
import { renderStandaloneOutputRunPanel } from './xml-cii-adapted-output-run.js?v=20261001-weight-output-2';
import { renderAdaptedConfigPanel } from './xml-cii-adapted-config-tabs.js?v=20261001-single-weight-owners-1';
import { appendBendRadiusConfigToggle } from './xml-cii-adapted-bend-radius-toggle.js?v=20261001-weight-output-2';
import { summarizeWorkflowFile } from '../xml-cii-workflow-ui-adapter.js?v=20261001-weight-output-2';
import { XML229_STAGED_SOURCE_SCHEMA } from '../integration/xml229-staged-source-receipt.mjs';

export function renderActivePhase(root, stateRef, render) {
  const state = stateRef.current;
  const phase = getAdaptedWorkflowPhase(state.activePhaseId);
  const card = createElement('section', '', 'xml-cii-standalone-card xml-cii-phase-panel');
  card.dataset.activePhase = phase.id;
  card.append(createElement('h2', phase.label), createElement('p', phase.summary, 'xml-cii-phase-help'));
  renderPhaseBody(card, phase.id, stateRef, render);
  root.appendChild(card);
}

export function renderPhaseBody(card, phaseId, stateRef, render) {
  const state = stateRef.current;
  if (phaseId === 'source') {
    const subTabId = state.activeSubTabId || 'loader';
    const container = createElement('div', '', 'xml-cii-sub-tabs-layout');
    const rail = createElement('nav', '', 'xml-cii-sub-nav-rail');
    rail.setAttribute('aria-label', 'Source & Masters sub-phases');
    const subPhases = [
      { id: 'loader', label: '📂 Source' },
      { id: 'linelist', label: '📊 Line List' },
      { id: 'pipingClass', label: '🪈 Piping Class' },
      { id: 'materialMap', label: '🗺️ Material Map' },
      { id: 'weight', label: '⚖️ Valve Weights' },
      { id: 'manualOverrides', label: '✏️ Manual Overrides' },
      { id: 'elementSideload', label: '🎛️ InputXML / Element Side-load' }
    ];
    for (const sub of subPhases) {
      const btn = createElement('button', sub.label, 'xml-cii-sub-phase-pill');
      btn.type = 'button';
      btn.dataset.subTab = sub.id;
      btn.classList.toggle('is-active', subTabId === sub.id);
      let isLoaded = false;
      const counts = state.masterContext?.rowCounts || {};
      if (sub.id === 'loader') isLoaded = !!state.sourceText;
      else if (sub.id === 'linelist') isLoaded = (counts.lineList || 0) > 0;
      else if (sub.id === 'pipingClass') isLoaded = (counts.pipingClass || 0) > 0;
      else if (sub.id === 'materialMap') isLoaded = (counts.materialMap || 0) > 0;
      else if (sub.id === 'weight') isLoaded = (counts.weight || 0) > 0;
      else if (sub.id === 'manualOverrides') {
        let overridesCount = 0;
        try {
          const cfg = JSON.parse(state.supportConfigJson || '{}');
          if (cfg.overrides) {
            overridesCount = Object.keys(cfg.overrides.pipingClass || {}).length + Object.keys(cfg.overrides.material || {}).length + Object.keys(cfg.overrides.rating || {}).length + Object.keys(cfg.overrides.materialCode || {}).length + Object.keys(cfg.overrides.wallThickness || {}).length + Object.keys(cfg.overrides.corrosion || {}).length;
          }
        } catch {}
        isLoaded = overridesCount > 0;
      } else if (sub.id === 'elementSideload') isLoaded = !!state.elementSideLoadText;
      btn.classList.toggle('is-loaded', isLoaded);
      rail.appendChild(btn);
    }
    container.appendChild(rail);
    const subWorkspace = createElement('div', '', 'xml-cii-sub-workspace');
    if (subTabId === 'loader') {
      renderSourceControls(subWorkspace, state);
      renderDetectionSummary(subWorkspace, state);
      renderValidityDiagnostics(subWorkspace, state);
      renderStandaloneSourcePreviewPanel(subWorkspace, state);
    } else if (subTabId === 'linelist') renderStandaloneImportMastersPanel(subWorkspace, state, 'lineList');
    else if (subTabId === 'pipingClass') renderStandaloneImportMastersPanel(subWorkspace, state, 'pipingClass');
    else if (subTabId === 'materialMap') renderStandaloneImportMastersPanel(subWorkspace, state, 'materialMap');
    else if (subTabId === 'weight') renderStandaloneImportMastersPanel(subWorkspace, state, 'weight');
    else if (subTabId === 'manualOverrides') renderStandaloneManualElementSideloadPanel(subWorkspace, state);
    else if (subTabId === 'elementSideload') renderStandaloneInputXmlElementSideloadPanel(subWorkspace, state);
    container.appendChild(subWorkspace);
    card.appendChild(container);
    return;
  }
  if (phaseId === 'regex') return renderRegexPanel(card, stateRef, render);
  if (phaseId === 'json-trace') return renderJsonTracePanel(card, stateRef, render);
  if (phaseId === 'preview') return renderStandalonePreviewReportPanel(card,stateRef,render);
  if (phaseId === 'diagnostics') return renderStandaloneDiagnosticsReportPanel(card, state);
  if (phaseId === 'matched-audit') return renderStandalonePropagationAuditPanel(card, state, render);
  if (phaseId === 'weight-match') return renderAdaptedWeightMatchPanelV2(card,stateRef);
  if (phaseId === 'support-mapper') return renderSupportMapperPanel(card, stateRef, render);
  if (phaseId === 'config') {
    renderAdaptedConfigPanel(card, stateRef, render);
    appendBendRadiusConfigToggle(card, stateRef, render);
    return;
  }
  if (phaseId === 'run') return renderRunPanel(card, stateRef, render);
  renderStandaloneSourceModePanel(card, state);
}

export function renderRegexPanel(card, stateRef, render) {
  renderStandaloneRegexTesterPanel(card, stateRef.current, stateRef, render);
}

export function renderImportPanel(card, state) {
  renderStagedJsonControl(card, state);
  renderStandaloneImportMastersPanel(card, state);
}

/** The original JSON File is held by O1's Worker session, not stagedJsonText. */
export function xml229StagedSourceBadgeView(state = {}) {
  const receipt = state.xml229StagedSourceReceipt;
  const recognized = receipt?.schema === XML229_STAGED_SOURCE_SCHEMA &&
    receipt.rightsBasis === 'SOURCE_FACTS_ONLY' && receipt.engineeringReady === false;
  if (recognized && receipt.phase === 'INDEX_COMMITTED' &&
      /^[a-f0-9]{64}$/.test(receipt.sha256 || '') &&
      Number.isSafeInteger(receipt.occurrenceCount) &&
      Number.isSafeInteger(receipt.pageCount)) {
    return {text: '✅ Staged JSON: Indexed in Worker · ' +
      receipt.occurrenceCount.toLocaleString('en-US') + ' original occurrences · ' +
      receipt.pageCount.toLocaleString('en-US') + ' source pages · SHA ' +
      receipt.sha256.slice(0,12) + ' · Trace requires separate Build',color:'#8be28b',
      phase:'index-committed'};
  }
  if (recognized && ['SELECTED','INDEXING','COMMIT_PENDING'].includes(receipt.phase)) {
    const stage = receipt.phase === 'COMMIT_PENDING' ? 'committing durable index' :
      receipt.phase === 'INDEXING' ? 'indexing in Worker' : 'selected for Worker';
    return {text:'⏳ Staged JSON: '+stage+' · '+receipt.byteLength.toLocaleString('en-US')+
      ' bytes · not yet source-verified',color:'#fbbf24',phase:'indexing'};
  }
  if (recognized && receipt.phase === 'FAILED')
    return {text:'⚠️ Staged JSON: Worker source failed · '+receipt.reason,
      color:'#f87171',phase:'failed'};
  if (recognized && receipt.phase === 'REVOKED')
    return {text:'⚠️ Staged JSON: Previous Worker source revoked; select JSON again',
      color:'#fbbf24',phase:'revoked'};
  if (state.xml229StagedSourceStatus === 'FAILED')
    return {text:'⚠️ Staged JSON: Worker source rejected; no source index rights',
      color:'#f87171',phase:'failed'};
  return state.stagedJsonText
    ? {text:'✅ Staged JSON: Loaded',color:'#8be28b',phase:'legacy-loaded'}
    : {text:'⚠️ Staged JSON: Not loaded',color:'#fbbf24',phase:'absent'};
}

export function applyXml229StagedSourceBadge(badge,state) {
  if (!badge) return;
  const view = xml229StagedSourceBadgeView(state);
  badge.textContent=view.text;
  badge.dataset.sourcePhase=view.phase;
  if (badge.style) badge.style.color=view.color;
}

export function refreshXml229StagedSourceBadge(container,state) {
  const badge=container?.querySelector?.('[data-xml229-staged-json-source-badge]');
  applyXml229StagedSourceBadge(badge,state);
}

export function renderJsonTracePanel(card, stateRef, render) {
  const state = stateRef.current;
  const fileRow = createElement('div');
  if (fileRow.style) Object.assign(fileRow.style, { display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '14px', alignItems: 'flex-start' });
  const srcGroup = createElement('label');
  if (srcGroup.style) Object.assign(srcGroup.style, { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#94a3b8' });
  srcGroup.appendChild(createElement('span', '📄 Source XML / PSI116 file:'));
  const srcInput = createElement('input');
  srcInput.type = 'file';
  srcInput.accept = '.xml,.XML,.inputxml';
  srcInput.dataset.field = 'source-file';
  srcGroup.appendChild(srcInput);
  const srcBadge = createElement('span', state.sourceText ? '✅ XML source: Loaded' : '⚠️ XML source: Not loaded', 'xml-cii-phase-help');
  if (srcBadge.style) srcBadge.style.color = state.sourceText ? '#8be28b' : '#fbbf24';
  srcGroup.appendChild(srcBadge);
  fileRow.appendChild(srcGroup);
  const jsonGroup = createElement('label');
  if (jsonGroup.style) Object.assign(jsonGroup.style, { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#94a3b8' });
  jsonGroup.appendChild(createElement('span', '📦 Staged JSON (ATTRIBUTE-AML_…):'));
  const jsonInput = createElement('input');
  jsonInput.type = 'file';
  jsonInput.accept = '.json,.JSON';
  jsonInput.dataset.field = 'staged-json-file';
  jsonGroup.appendChild(jsonInput);
  if (state.stagedJsonFile) jsonGroup.appendChild(createElement('div', summarizeWorkflowFile(state.stagedJsonFile), 'xml-cii-file-summary'));
  const jsonBadge = createElement('span', '', 'xml-cii-phase-help');
  jsonBadge.dataset.xml229StagedJsonSourceBadge = 'true';
  applyXml229StagedSourceBadge(jsonBadge, state);
  jsonGroup.appendChild(jsonBadge);
  fileRow.appendChild(jsonGroup);
  card.appendChild(fileRow);
  renderStandaloneResolverJsonTracePanel(card, stateRef.current, stateRef, render);
}

export function renderCustomInputPanel(card, state) {
  renderInputXmlControls(card, state);
}

export function renderXmlOptionsPanel(card, state) {
  const coords = appendLabeledControl(card, 'coordsMode:', createElement('select'));
  coords.dataset.field = 'coords-mode';
  for (const mode of ['first', 'all', 'none']) coords.appendChild(createOption(mode, mode, state.options.coordsMode === mode));
  renderXmlToggle(card, 'kgToNewton:', 'kg-to-newton', state.options.kgToNewton);
  renderXmlToggle(card, 'useRestraintTypeBasedOnJson:', 'json-restraints', state.options.useRestraintTypeBasedOnJson);
  renderSplitControl(card, state);
}

export function renderXmlToggle(card, label, field, checked) {
  const control = appendLabeledControl(card, label, createElement('input'));
  control.type = 'checkbox';
  control.checked = !!checked;
  control.dataset.field = field;
}

export function renderSplitControl(card, state) {
  const split = appendLabeledControl(card, 'splitCondensedValveFlange:', createElement('select'));
  const value = state.options.splitCondensedValveFlange;
  const selected = value === true ? 'true' : value === false ? 'false' : 'null';
  split.dataset.field = 'split-condensed';
  split.append(createOption('null', 'config/default', selected === 'null'), createOption('true', 'force true', selected === 'true'), createOption('false', 'force false', selected === 'false'));
}

export function renderSupportMapperPanel(card, stateRef, render) {
  renderStandaloneSupportTypeMapperPanel(card, stateRef, render);
}

export function renderRunPanel(card, stateRef, render) {
  renderStandaloneOutputRunPanel(card, stateRef, render);
}
