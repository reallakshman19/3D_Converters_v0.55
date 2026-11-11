import { buildStandaloneOutputRunReadiness, hasOriginalJsonSourceOnlyRunHold } from '../xml-cii-output-run-readiness.js';
import { detectXmlCiiWorkflowSourceKind, maskedFileName } from '../xml-cii-workflow-source-detect.js';
import { createElement, createOption, downloadTextFile } from './xml-cii-adapted-dom.js';
import { updateWorkflowOptions, applyStandaloneOutputRunReadiness, updateWorkflowState } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import { deriveLineKeyFromBranchName } from '../../../converters/xml-cii2019-core/regex-line-key.js';
import { renderAdaptedCiiPreviewCanvas } from './xml-cii-adapted-cii-preview-canvas.js?v=20261001-weight-output-2';
import {getXml229CurrentWorkerHeldReview} from './xml-cii-adapted-p4-verified-weight-panel.js';
import {syncXml229CanonicalOutputHeaderBadges} from './xml229-canonical-output-header-badges.mjs';
import {captureXml229XmlOnlyApproval,isXml229XmlOnlyApproved}
  from '../integration/xml229-output-participation.mjs';

function rows(value) { return Array.isArray(value) ? value : []; }
function text(value) { return String(value ?? ''); }

function supportConfigForReadiness(state) {
  try {
    const parsed = JSON.parse(String(state?.supportConfigJson || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function masterRowCount(state, masterKey, contextRowsKey, configRows) {
  const ref = state?.masterContext?.datasetRefs?.[masterKey];
  const datasetCount = Number(ref?.rowCount);
  if (ref?.datasetId && Number.isFinite(datasetCount) && datasetCount >= 0) return datasetCount;
  const contextRows = state?.masterContext?.[contextRowsKey];
  if (Array.isArray(contextRows) && contextRows.length) return contextRows.length;
  return Array.isArray(configRows) ? configRows.length : 0;
}

export function outputRunReadinessMasterCounts(state, config = supportConfigForReadiness(state)) {
  return {
    linelist: masterRowCount(state, 'lineList', 'lineRows', config?.linelist?.masterRows),
    pipingClass: masterRowCount(state, 'pipingClass', 'pipingClassRows', config?.pipingClass?.masterRows),
    material: masterRowCount(state, 'materialMap', 'materialMapRows', config?.material?.mapRows),
    weight: masterRowCount(state, 'weight', 'weightMasterRows', config?.weight?.masterRows),
  };
}

function section(parent, title) {
  const el = createElement('section', '', 'xml-cii-weight-panel');
  el.appendChild(createElement('h3', title));
  parent.appendChild(el);
  return el;
}

function button(action, label, disabled = false) {
  const el = createElement('button', label);
  el.type = 'button';
  el.dataset.action = action;
  el.disabled = !!disabled;
  return el;
}

function table(headers, data, emptyText) {
  if (!data.length) return createElement('div', emptyText, 'xml-cii-phase-help');
  const el = createElement('table', '', 'xml-cii-weight-table');
  const head = createElement('thead');
  const hr = createElement('tr');
  for (const header of headers) hr.appendChild(createElement('th', header));
  head.appendChild(hr);
  el.append(head, tableBody(headers, data));
  return el;
}

function tableBody(headers, data) {
  const body = createElement('tbody');
  for (const item of data.slice(0, 80)) {
    const tr = createElement('tr');
    for (const header of headers) tr.appendChild(createElement('td', text(valueFor(item, header))));
    body.appendChild(tr);
  }
  return body;
}

function valueFor(item, header) {
  const key = { ID: 'id', Label: 'label', Status: 'status', Severity: 'severity', Blocking: 'blocking', Message: 'message', Kind: 'kind', Artifact: 'label', Available: 'available', Filename: 'filename', Bytes: 'bytes', Level: 'level', Source: 'source' }[header] || header;
  return item?.[key] ?? item?.[header];
}

function reportFromState(state) {
  // Never trust an old stored legacy report for a selected governed O1 source.
  // This conservative baseline is replaced only after a live verified Worker
  // read; its native CII release HOLD is preserved throughout.
  return hasOriginalJsonSourceOnlyRunHold(state)
    ? buildStandaloneOutputRunReadiness(state)
    : state.outputRunReadinessReport || buildStandaloneOutputRunReadiness(state);
}

function renderSummary(parent, report) {
  const panel = section(parent, 'Pre-run Summary');
  panel.appendChild(table(['Source', 'Status', 'Message'], [
    { Source: 'source mode', Status: report.summary.sourceMode,
      Message: `${report.summary.blockingCount} blocking items · ${report.summary.warningCount ?? report.checklistRows.filter(item=>item.status!=='ready'&&!item.blocking).length} incomplete/warning stages` },
    { Source: 'artifacts', Status: report.summary.artifactCount,
      Message: 'available artifacts (not proof of a current CII output)' },
  ], 'No readiness summary yet.'));
  return panel;
}

function renderChecklist(parent, report) {
  const panel = section(parent, 'Pre-run Checklist');
  // The original six-column table squeezed all values into the viewport,
  // merging the Status/Severity/Blocking text and cutting off Owner messages.
  // Keep exact report values, but make the message column readable and let
  // narrow screens scroll horizontally instead of hiding provenance.
  const wrap=createElement('div');
  wrap.className='xml229-run-checklist-scroll';
  wrap.style.cssText='width:100%;max-width:100%;overflow-x:auto;overflow-y:visible;'+
    'border:1px solid #334155;border-radius:8px;margin:8px 0 16px;';
  const audit=table(['ID','Label','Status','Severity','Blocking','Message'],
    rows(report.checklistRows),'No checklist rows yet.');
  audit.style.cssText='border-collapse:collapse;table-layout:fixed;'+
    'min-width:1200px;width:100%;font-size:13px;line-height:1.45;';
  const columns=['205px','230px','90px','95px','90px','auto'];
  for(const group of [audit.querySelectorAll('th'),audit.querySelectorAll('td')]){
    for(const cell of group){
      const col=cell.cellIndex;
      cell.style.cssText='padding:9px 10px;text-align:left;'+
        'vertical-align:top;overflow-wrap:anywhere;'+
        'border-bottom:1px solid #22334b;'+
        (col===5?'min-width:460px;white-space:normal;':'');
      if(columns[col]!=='auto')cell.style.width=columns[col];
    }
  }
  wrap.appendChild(audit);
  panel.appendChild(wrap);
  return panel;
}

function renderFormatFailures(parent, report) {
  const authority = rows(report.checklistRows).find(item => item.id === 'branch-format-authority');
  if (!authority?.blocking || !authority.detail) return;
  let failures = [];
  try { failures = JSON.parse(authority.detail); } catch { return; }
  if (!Array.isArray(failures) || !failures.length) return;

  const panel = section(parent, 'Branch format diagnosis (first 20 failed occurrences)');
  panel.appendChild(createElement('div',
    'UNMATCHED means no configured format extracted required Line Key and Piping Class. AMBIGUOUS means multiple formats disagree; Review Regex Tester Format 1 / Format 2 and re-run readiness. Preview and Weight status are separate.',
    'xml-cii-phase-help'));
  const diagnosticRows = failures.flatMap(failure => {
    const candidates = rows(failure.formatCandidates);
    if (!candidates.length) return [{
      Occurrence: String(Number(failure.occurrenceIndex) + 1),
      Branch: text(failure.branchName), Status: text(failure.status),
      Format: 'none', Diagnosis: text(failure.reason),
    }];
    return candidates.map(candidate => ({
      Occurrence: String(Number(failure.occurrenceIndex) + 1),
      Branch: text(failure.branchName),
      Status: text(failure.status),
      Format: String(Number(candidate.formatIndex) + 1),
      Diagnosis: failure.status === 'AMBIGUOUS'
        ? `Line Key=${candidate.lineKey || '-'}, Piping Class=${candidate.pipingClass || '-'}, Rating=${candidate.rating || '-'}, Bore=${candidate.bore || '-'}`
        : Object.entries(candidate.reasons || {}).map(([field, reason]) => `${field}: ${reason}`).join('; ') || 'Format did not resolve',
    }));
  });
  // Native table cells use textContent; untrusted Branchname is never HTML.
  panel.appendChild(table(['Occurrence', 'Branch', 'Status', 'Format', 'Diagnosis'], diagnosticRows, 'No examples available.'));
}

function renderArtifacts(parent, state, report) {
  const panel = section(parent, 'Output Artifacts / Downloads');
  panel.appendChild(table(['Kind', 'Artifact', 'Available', 'Filename', 'Bytes'], rows(report.artifactRows), 'No artifact rows yet.'));
  const buttonsDiv = createElement('div');
  buttonsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;';
  for (const row of rows(report.artifactRows)) {
    const btn = button(row.downloadAction || `download-${row.kind}`, `Download ${row.label}`, !row.available);
    btn.style.cssText = `cursor:pointer;padding:6px 12px;border-radius:6px;background:${row.available ? '#1e293b' : '#334155'};color:${row.available ? '#cbd5e1' : '#64748b'};border:1px solid #334155;font-size:12px;`;
    btn.dataset.action = row.downloadAction || `download-${row.kind}`;
    buttonsDiv.appendChild(btn);
  }
  panel.appendChild(buttonsDiv);
  renderAdaptedCiiPreviewCanvas(panel, state, report);
}

function topologyArtifactRows(result) {
  return [
    { kind: 'topology-findings', label: 'Topology Findings JSON', filename: result?.topologyFindingsName, value: result?.topologyFindingsText, mime: 'application/json;charset=utf-8' },
    { kind: 'topology-plan', label: 'Topology Fix Plan JSON', filename: result?.topologyFixPlanName, value: result?.topologyFixPlanText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-xml', label: 'Committed TopoFix XML', filename: result?.topoFixXmlName, value: result?.topoFixXmlText, mime: 'application/xml;charset=utf-8' },
    { kind: 'topofix-transaction', label: 'TopoFix Transaction JSON', filename: result?.topoFixTransactionName, value: result?.topoFixTransactionText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-validation', label: 'TopoFix Validation JSON', filename: result?.topoFixValidationName, value: result?.topoFixValidationText, mime: 'application/json;charset=utf-8' },
  ].map((row) => ({ ...row, available: text(row.value).length > 0, bytes: new TextEncoder().encode(text(row.value)).length }));
}

function renderTopologyArtifacts(parent, state) {
  const requested = state.options?.analyzeTopology === true || state.options?.generateTopoFix === true || !!state.result?.topologyFindingsText;
  if (!requested) return;
  const panel = section(parent, 'Topology Sidecars / Downloads');
  const data = topologyArtifactRows(state.result);
  panel.appendChild(table(['Kind', 'Artifact', 'Available', 'Filename', 'Bytes'], data.map((row) => ({ ...row, Artifact: row.label, Kind: row.kind, Available: row.available, Filename: row.filename || '', Bytes: row.bytes })), 'Run topology analysis to build sidecars.'));
  const actions = createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;';
  for (const row of data) {
    const control = button(`download-${row.kind}`, `Download ${row.label}`, !row.available);
    control.style.cssText = 'cursor:pointer;padding:6px 12px;border-radius:6px;background:#1e293b;color:#cbd5e1;border:1px solid #334155;font-size:12px;';
    control.addEventListener('click', () => {
      if (!row.available) return;
      downloadTextFile(maskedFileName(row.filename || `${row.kind}.txt`), row.value, row.mime);
    });
    actions.appendChild(control);
  }
  panel.appendChild(actions);
  if (state.result?.topologyFindingsText) {
    const status = state.result?.topoFixCommitted === true ? 'Committed TopoFix available.' : (state.options?.generateTopoFix ? 'TopoFix was not committed; inspect transaction/validation reports.' : 'Analysis-only sidecars available.');
    panel.appendChild(createElement('div', `${status} CII input: ${state.result?.ciiInputSource || 'original'}.`, 'model-converters-workflow-detail-note'));
  }
}

function renderLogs(parent, report) {
  const panel = section(parent, 'Logs');
  panel.appendChild(table(['Level', 'Source', 'Message'], rows(report.logRows), 'No logs yet.'));
}

function renderManifest(parent, report) {
  const panel = section(parent, 'Run Manifest');
  panel.appendChild(createElement('pre', JSON.stringify(report.manifest || {}, null, 2)));
}

function renderRaw(parent, report) {
  const details = createElement('details', '', 'xml-cii-weight-panel');
  details.appendChild(createElement('summary', 'Raw JSON advanced/debug'));
  details.appendChild(createElement('pre', JSON.stringify(report.raw || {}, null, 2)));
  parent.appendChild(details);
}

function runStatusRow(ok, label, value) {
  const rowEl = createElement('div', '', 'model-converters-workflow-run-status-row');
  rowEl.append(
    createElement('span', ok ? 'OK' : '!', `model-converters-workflow-run-status-icon ${ok ? 'ok' : 'warn'}`),
    createElement('span', ` ${label} `),
    createElement('strong', value)
  );
  return rowEl;
}

function renderReadinessCard(parent, config, state) {
  const readyCard = createElement('div', '', 'model-converters-workflow-master-card');
  readyCard.appendChild(createElement('div', 'Readiness', 'model-converters-workflow-section-title'));
  const counts = outputRunReadinessMasterCounts(state, config);
  readyCard.append(
    runStatusRow(counts.linelist > 0, 'Line List', counts.linelist ? `${counts.linelist} row(s)` : 'not loaded'),
    runStatusRow(counts.pipingClass > 0, 'Piping Class Master', counts.pipingClass > 0 ? `${counts.pipingClass} row(s)` : 'not loaded'),
    runStatusRow(counts.material > 0, 'Material Map', counts.material ? `${counts.material} row(s)` : 'not loaded'),
    runStatusRow(counts.weight > 0, 'Valve Weights', counts.weight ? `${counts.weight} row(s)` : 'not loaded')
  );
  const sampleBranch = String(config.linelist?.sampleBranchName || '/ASIM-1885-10"-S8810101-91261M7-HC/B1');
  const lineKey = deriveLineKeyFromBranchName(sampleBranch, config);
  const sampleRow = createElement('div', '', 'model-converters-workflow-run-status-row');
  if (sampleRow.style) sampleRow.style.marginTop = '8px';
  sampleRow.append(
    createElement('span', lineKey ? 'OK' : '!', `model-converters-workflow-run-status-icon ${lineKey ? 'ok' : 'warn'}`),
    createElement('span', ' Sample line key from '),
    createElement('code', sampleBranch),
    createElement('strong', ` ${lineKey || '(no key derived)'}`)
  );
  readyCard.appendChild(sampleRow);
  parent.appendChild(readyCard);
}

function actualSourceKind(state) {
  return state.sourceKind === 'auto' ? detectXmlCiiWorkflowSourceKind(state.sourceText || '', 'xml') : (state.sourceKind || 'xml');
}

function parseActionIds(value) {
  return [...new Set(String(value ?? '').split(/[\s,;]+/).map((entry) => entry.trim()).filter(Boolean))];
}

function topologyOptionsPatch(options, key, checked) {
  const next = { [key]: checked };
  if (key === 'analyzeTopology' && !checked) Object.assign(next, { generateTopoFix: false, useTopoFixForCii: false });
  if (key === 'generateTopoFix' && checked) next.analyzeTopology = true;
  if (key === 'generateTopoFix' && !checked) next.useTopoFixForCii = false;
  if (key === 'useTopoFixForCii' && checked) Object.assign(next, { analyzeTopology: true, generateTopoFix: true });
  return next;
}

function renderRunOptions(parent, stateRef, state, render) {
  const optCard = createElement('div', '', 'model-converters-workflow-master-card');
  optCard.appendChild(createElement('div', 'Run Options', 'model-converters-workflow-section-title'));
  const optGrid = createElement('div', '', 'model-converters-workflow-regex-grid');
  const coordsLabel = createElement('label', '', 'model-converters-workflow-regex-field');
  coordsLabel.appendChild(createElement('span', 'Coords Mode'));
  const coordsSelect = createElement('select');
  for (const opt of ['first', 'all', 'none']) coordsSelect.appendChild(createOption(opt, opt, (state.options?.coordsMode || 'first') === opt));
  coordsSelect.addEventListener('change', (e) => { stateRef.current = updateWorkflowOptions(stateRef.current, { coordsMode: e.target.value }); if (typeof render === 'function') render(); });
  coordsLabel.appendChild(coordsSelect);
  optGrid.append(coordsLabel, optionCheckbox('createEnrichedXml', 'Create enriched XML before CII', !!state.options?.createEnrichedXml, stateRef, render), optionCheckbox('kgToNewton', 'kg -> N weight conversion (x10)', state.options?.kgToNewton !== false, stateRef, render));
  optCard.appendChild(optGrid);

  const topologyCard = createElement('div', '', 'model-converters-workflow-master-card');
  topologyCard.appendChild(createElement('div', 'PSI116 Topology Sidecar', 'model-converters-workflow-section-title'));
  const xmlMode = actualSourceKind(state) === 'xml';
  const topologyGrid = createElement('div', '', 'model-converters-workflow-regex-grid');
  topologyGrid.append(
    optionCheckbox('analyzeTopology', 'Analyze PSI116 topology', state.options?.analyzeTopology === true, stateRef, render, !xmlMode, topologyOptionsPatch),
    optionCheckbox('generateTopoFix', 'Generate reviewed TopoFix XML', state.options?.generateTopoFix === true, stateRef, render, !xmlMode, topologyOptionsPatch),
    optionCheckbox('useTopoFixForCii', 'Use committed TopoFix XML for CII', state.options?.useTopoFixForCii === true, stateRef, render, !xmlMode, topologyOptionsPatch),
  );
  const actionField = createElement('label', '', 'model-converters-workflow-regex-field');
  actionField.appendChild(createElement('span', 'Reviewed TopoFix action IDs'));
  const actionInput = createElement('textarea');
  actionInput.dataset.field = 'topology-action-ids';
  actionInput.rows = 3;
  actionInput.placeholder = 'ACT-000184, ACT-000185';
  actionInput.value = rows(state.options?.topologyActionIds).join('\n');
  actionInput.disabled = !xmlMode || state.options?.generateTopoFix !== true;
  actionInput.addEventListener('change', (event) => {
    stateRef.current = updateWorkflowOptions(stateRef.current, { topologyActionIds: parseActionIds(event.target.value) });
    if (typeof render === 'function') render();
  });
  actionField.appendChild(actionInput);
  topologyCard.append(topologyGrid, actionField, createElement('div', xmlMode
    ? 'Analysis is non-mutating. TopoFix requires explicit reviewed action IDs and is used for CII only after the atomic transaction commits.'
    : 'Topology controls are available only for PSI116 XML source mode.', 'model-converters-workflow-detail-note'));
  parent.append(optCard, topologyCard);
}

function optionCheckbox(optionKey, labelText, checked, stateRef, render, disabled = false, patcher = null) {
  const label = createElement('label', '', 'model-converters-workflow-map-field');
  if (label.style) Object.assign(label.style, { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' });
  const input = createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener('change', (e) => {
    const patch = typeof patcher === 'function' ? patcher(stateRef.current.options || {}, optionKey, e.target.checked) : { [optionKey]: e.target.checked };
    stateRef.current = updateWorkflowOptions(stateRef.current, patch);
    if (typeof render === 'function') render();
  });
  label.append(input, createElement('span', labelText));
  return label;
}

function renderRunControls(parent, stateRef, state, report, render) {
  const ctrlCard = section(parent, 'Run Conversion');
  const routeLabel=createElement('label','','model-converters-workflow-regex-field');
  routeLabel.appendChild(createElement('span','Native output input authority'));
  const routeSelect=createElement('select');
  routeSelect.dataset.action='xml229-output-participation';
  const approved=isXml229XmlOnlyApproved(state);
  routeSelect.append(
    createOption('governed','JSON-governed: native CII HELD until independent Final/output authorization',!approved),
    createOption('xml-only','XML-only: ignore optional JSON and unverified engineering facts',approved),
  );
  routeSelect.disabled=actualSourceKind(state)!=='xml'||!!state.running;
  routeSelect.addEventListener('change',event=>{
    // Never infer XML-only from merely opening this tab or loading an O1 JSON.
    let next=updateWorkflowState(stateRef.current,{
      result:null,outputRunReadinessReport:null,xml229XmlOnlyApproval:null,
    });
    const active=next.sourceBatch?.sources?.find(x=>x.sourceId===next.sourceBatch.activeSourceId);
    const selected=event.target.value==='xml-only'
      ?captureXml229XmlOnlyApproval(next,active):null;
    if(active){
      next={
        ...next,xml229XmlOnlyApproval:selected,
        sourceBatch:{...next.sourceBatch,
          sources:next.sourceBatch.sources.map(x=>x.sourceId===active.sourceId
            ?{...x,xml229XmlOnlyApproval:selected}:x)},
      };
    }else next={...next,xml229XmlOnlyApproval:selected};
    stateRef.current=next;
    if(typeof render==='function')render();
  });
  routeLabel.appendChild(routeSelect);
  ctrlCard.append(routeLabel,createElement('div',
    approved
      ?'XML-only selected for this exact XML, branch selection, config and master basis. Staged JSON, Preview, GC-PW and accepted Weight/Final decisions are excluded from native conversion; source or master changes require new explicit selection.'
      :'Default: original JSON engineering output remains governed and HELD. Explicit XML-only selection uses independent native XML preflight and excludes optional JSON-derived facts.',
    'model-converters-workflow-detail-note'));
  const actionDiv = createElement('div');
  if (actionDiv.style) Object.assign(actionDiv.style, { marginTop: '12px', display: 'flex', gap: '8px', flexDirection: 'column' });
  const runReviewBtn = createElement('button', 'Run - Review Weight Matches', 'model-converters-run-btn');
  if (runReviewBtn.style) Object.assign(runReviewBtn.style, { width: '100%', padding: '12px' });
  runReviewBtn.addEventListener('click', () => { stateRef.current = updateWorkflowState(stateRef.current, { activePhaseId: 'weight-match' }); if (typeof render === 'function') render(); });
  const noteDiv = createElement('div', '', 'model-converters-workflow-detail-note');
  noteDiv.innerHTML = approved ? 'XML-only mode excludes JSON-derived Weight/Final from native output; independent XML preflight remains mandatory.' : 'Opens <strong>4A Weight Match</strong> to review approximate weights, then Finalize and Run.';
  const refreshBtn = button('refresh-output-run', 'Refresh readiness / checklist');
  refreshBtn.style.cssText = 'cursor:pointer;padding:12px;border-radius:6px;background:#1e293b;color:#cbd5e1;border:1px solid #334155;font-size:12px;width:100%;text-align:center;font-weight:700;';
  refreshBtn.addEventListener('click', () => { stateRef.current = applyStandaloneOutputRunReadiness(stateRef.current, buildStandaloneOutputRunReadiness(stateRef.current)); if (typeof render === 'function') render(); });
  // Available even before Run; Output artifacts/diagnostics may not exist
  // while native CII release is correctly HELD. Explicit, inspectable export.
  const exportEvidenceBtn=button('export-output-readiness','Download readiness diagnostics JSON');
  exportEvidenceBtn.addEventListener('click',()=>{
    const evidence={schema:'XML229.OutputRunReadinessEvidence.v1',
      exportedAt:new Date().toISOString(),summary:report.summary,
      checklistRows:report.checklistRows,logRows:report.logRows,
      diagnostics:report.diagnostics,raw:report.raw,manifest:report.manifest};
    downloadTextFile('xml-cii-output-run-readiness.json',
      JSON.stringify(evidence,null,2),'application/json;charset=utf-8');
  });
  const finalizeBtn = createElement('button', state.running ? 'Running...' : 'Finalise and Run Conversion', 'model-converters-download-btn');
  if (finalizeBtn.style) Object.assign(finalizeBtn.style, { width: '100%', padding: '12px', background: (state.running || report.summary.blockingCount > 0) ? '#334155' : '#1e4ed8', color: '#fff', border: 'none', fontWeight: '700' });
  finalizeBtn.disabled = !!(state.running || report.summary.blockingCount > 0);
  finalizeBtn.dataset.action = 'run';
  actionDiv.append(runReviewBtn, noteDiv, refreshBtn, exportEvidenceBtn, finalizeBtn);
  ctrlCard.appendChild(actionDiv);
}

/**
 * Project the SAME live GC-PW session into existing 5 Run checklist rows.
 * Presentation only: NEVER mutate readiness state, blocking rules, cached
 * results, weight decisions or the native Run button. A stale/disposed Worker
 * fails closed, and Mode-A multi-source cannot borrow another source's proof.
 */
function projectOriginalReviewIntoRunChecklist(card,stateRef,state,paint){
 const raw=(stateRef?.modeABaseRef||stateRef)?.current||state;
 const receipt=state?.xml229StagedSourceReceipt||raw.xml229StagedSourceReceipt;
 if(receipt?.schema!=='XML229.OriginalStagedSourceReceipt.v1')return;
 const enabled=raw.sourceBatch?.sources?.filter(x=>x.enabled!==false)||null;
 if(enabled&&enabled.length!==1)return;
 const session=getXml229CurrentWorkerHeldReview(stateRef);
 if(!session)return;
 const activeId=raw.sourceBatch?.activeSourceId||state.modeASourceId||'';
 if(enabled?.length===1&&enabled[0].sourceId!==activeId)return;
 // An older in-flight Worker completion must never repaint a newer Run panel.
 const token=card.__xml229ReadinessToken;
 void Promise.resolve().then(()=>session.readCompletion()).then(proof=>{
   if(card.isConnected===false||card.__xml229ReadinessToken!==token||
      getXml229CurrentWorkerHeldReview(stateRef)!==session)return;
   // Ordinary immutable UI updates may replace the state object while an
   // independently verified Worker RPC is pending. Challenge the *latest*
   // state against the Worker proof rather than requiring object identity.
   const latest=stateRef.current;
   const verifiedReport=buildStandaloneOutputRunReadiness(latest,{
     verifiedEngineering:{sessionReceipt:session.receipt,proof},
   });
   if(verifiedReport.raw?.xml229VerifiedEngineering!==true){
     // Bad/partial proof is a diagnosable verification refusal, never READY.
     paint(buildStandaloneOutputRunReadiness(latest,{
       verifiedEngineering:{readError:{code:'UNVERIFIED_ENGINEERING_COMPLETION'}},
     }),latest);
     return;
   }
   // One canonical report: table, summary, logs, diagnostics and controls all
   // derive from the same source-bound snapshot, not modified DOM cells.
   paint(verifiedReport,latest);
 }).catch(error=>{
   // A failed Worker RPC used to disappear into a generic "missing" row.
   // Publish only a bounded failure code for this SAME current session.
   if(card.isConnected===false||card.__xml229ReadinessToken!==token||
      getXml229CurrentWorkerHeldReview(stateRef)!==session)return;
   const latest=stateRef.current;
   const held=buildStandaloneOutputRunReadiness(latest,{
     verifiedEngineering:{readError:{code:error?.code}},
   });
   paint(held,latest);
 });
}

export function renderStandaloneOutputRunPanel(card, stateOrRef, render) {
  const isRef = stateOrRef && 'current' in stateOrRef;
  const stateRef = isRef ? stateOrRef : { current: stateOrRef };
  const state = stateRef.current;
  card.__xml229ReadinessToken=(card.__xml229ReadinessToken||0)+1;
  const paint=(report,renderState=stateRef.current)=>{
    card.innerHTML = '';
    const title = createElement('div', '5 Run', 'model-converters-workflow-detail-title');
    const desc = createElement('div', 'Run the conversion — optionally analyze PSI116 topology, generate a reviewed TopoFix sidecar, and use only a committed fix for CII.', 'model-converters-workflow-detail-text');
    card.append(title, desc);
    renderSummary(card,report);
    renderChecklist(card,report);
    renderFormatFailures(card, report);
    renderReadinessCard(card, supportConfigForReadiness(renderState), renderState);
    renderRunOptions(card, stateRef, renderState, render);
    renderRunControls(card, stateRef, renderState, report, render);
    renderArtifacts(card, renderState, report);
    renderTopologyArtifacts(card, renderState);
    renderLogs(card, report);
    renderManifest(card, report);
    renderRaw(card, report);
    if(!syncXml229CanonicalOutputHeaderBadges(card,report)) {
      // Initial shell paints the phase before attaching the shell root.
      queueMicrotask(()=>{
        if(card.isConnected!==false)
          syncXml229CanonicalOutputHeaderBadges(card,report);
      });
    }
  };
  paint(reportFromState(state));
  projectOriginalReviewIntoRunChecklist(card,stateRef,state,paint);
}
