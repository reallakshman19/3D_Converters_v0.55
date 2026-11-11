import { buildStandaloneOutputRunReadiness, hasOriginalJsonSourceOnlyRunHold } from '../xml-cii-output-run-readiness.js';
import { detectXmlCiiWorkflowSourceKind, maskedFileName } from '../xml-cii-workflow-source-detect.js';
import { createElement, createOption, downloadTextFile } from './xml-cii-adapted-dom.js';
import { updateWorkflowOptions, applyStandaloneOutputRunReadiness, updateWorkflowState } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import { deriveLineKeyFromBranchName } from '../../../converters/xml-cii2019-core/regex-line-key.js';
import { renderAdaptedCiiPreviewCanvas } from './xml-cii-adapted-cii-preview-canvas.js?v=20261001-weight-output-2';
import {getXml229CurrentWorkerHeldReview} from './xml-cii-adapted-p4-verified-weight-panel.js';
import {runXml229NativeCiiMassCandidate} from './xml229-native-cii-candidate-run.mjs';
import {buildXml229NativeOwnerBlockerEvidence} from './xml229-native-owner-blocker-evidence.mjs';
import {createXml229InstrumentSourceReviewControl} from './xml229-instrument-source-review-ui.mjs';
import {startXml229InstrumentFreshReview} from './xml229-instrument-fresh-review.mjs';
import {bindXml229RunArtifactDownloads} from './xml229-run-artifact-download.mjs';
import {createXml229RunMassReviewButton} from './xml229-run-mass-review-button.mjs';
import {offerXml229AutomaticNativeRun} from './xml229-run-auto-native.mjs';
import {executeXml229NativeRun} from './xml229-native-run-action.mjs';
import {renderXml229NativeRunDebug} from './xml229-native-run-debug.mjs';
import {inspectXml229NativeRunEligibility} from './xml229-native-run-eligibility.mjs';
import {renderXml229TopologyReview} from './xml229-topology-review-ui.mjs';
import {xml229TopologyDisplayState} from './xml229-topology-review-controller.mjs';
import {xml229NativeRunWaitingMessage} from './xml229-run-waiting-message.mjs';
import {ensureXml229FlowTrace,getXml229FlowTrace,recordXml229FlowTrace,getXml229CandidateAttempt} from './xml229-flow-trace-registry.mjs';
import {buildXml229RunHoldAudit} from '../integration/xml229-run-hold-audit.mjs';
import {isXml229VerifiedReviewCompletionForInput} from '../integration/xml229-live-preview-restoration.mjs';
import {readXml229NativeFinalObservation} from '../integration/xml229-native-final-observation.mjs';
import {inspectXml229EngineeringLease} from '../integration/xml229-engineering-basis-authority.mjs';
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

function reportFromState(state,stateRef) {
  const display=xml229TopologyDisplayState(state,stateRef),hasSidecars=display!==state;
  state=display;
  const session=getXml229CurrentWorkerHeldReview(stateRef);
  const sessionState=session?(session.closed?'CLOSED':'LIVE'):'MISSING';
  const leaseDiagnosis=inspectXml229EngineeringLease(stateRef);
  // Never trust an old stored legacy report for a selected governed O1 source.
  // This conservative baseline is replaced only after a live verified Worker
  // read; its native CII release HOLD is preserved throughout.
  return hasOriginalJsonSourceOnlyRunHold(state)
    ? buildStandaloneOutputRunReadiness(state,{sessionState,leaseDiagnosis,
        candidate:getXml229CandidateAttempt(stateRef,session)})
    : (!hasSidecars&&state.outputRunReadinessReport) || buildStandaloneOutputRunReadiness(state);
}

function renderSummary(parent, report) {
  const panel = section(parent, 'Pre-run Summary');
  panel.appendChild(table(['Source', 'Status', 'Message'], [
    { Source: 'source mode', Status: report.summary.sourceMode,
      Message: `${report.summary.blockingCount} blocking items · ${report.summary.warningCount ?? report.checklistRows.filter(item=>item.status!=='ready'&&!item.blocking).length} incomplete/warning stages` },
    { Source: 'artifacts', Status: report.summary.artifactCount,
      Message: 'available artifacts (not proof of a current CII output)' },
  ], 'No readiness summary yet.'));
  const hold=report.checklistRows?.find(row=>
    row.id==='xml229-original-json-engineering-authority'&&row.blocking===true);
  if(hold){
    const note=createElement('div','', 'model-converters-workflow-detail-note');
    note.dataset.xml229CurrentSourceHold='true';
    const branchRow=report.checklistRows?.find(row=>row.id==='branch-format-authority');
    const branches=String(branchRow?.message||'').match(/\d+ selected branch occurrences/)?.[0]||'current selection';
    const bytes=report.manifest?.sourceBytes;
    note.textContent='Current XML: '+branches+
      (Number.isSafeInteger(bytes)?' · '+bytes+' source bytes':'')+
      '. JSON-governed CII remains held because Final/output authority is not verified, and a staged JSON receipt is present. If that JSON belonged to a different XML, re-index the matching JSON for this XML, or choose XML-only testing. '+
      'For conversion testing without JSON-derived engineering weights, select XML-only below and refresh the checklist. '+
      'Applied Weight selections are recorded as Owner-designated GC-PW Final masses, including explicitly confirmed 0 kg. Governed native CII remains HELD until exact source-to-output mass and split-child lineage are independently verified; this is not a converter runtime error.';
    panel.appendChild(note);
  }
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

function renderArtifacts(parent, state, report, stateRef) {
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
  bindXml229RunArtifactDownloads(panel,{stateRef,report});
}

function topologyArtifactRows(result) {
  return [
    { kind: 'topology-findings', label: 'Topology Findings JSON', filename: result?.topologyFindingsName, value: result?.topologyFindingsText, mime: 'application/json;charset=utf-8' },
    { kind: 'topology-plan', label: 'Topology Fix Plan JSON', filename: result?.topologyFixPlanName, value: result?.topologyFixPlanText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-xml', label: 'Committed TopoFix XML', filename: result?.topoFixXmlName, value: result?.topoFixXmlText, mime: 'application/xml;charset=utf-8' },
    { kind: 'topofix-transaction', label: 'TopoFix Transaction JSON', filename: result?.topoFixTransactionName, value: result?.topoFixTransactionText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-validation', label: 'TopoFix Validation JSON', filename: result?.topoFixValidationName, value: result?.topoFixValidationText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-lineage', label: 'Pre-Final TopoFix Source Lineage JSON', filename: result?.topoFixLineageName, value: result?.topoFixLineageText, mime: 'application/json;charset=utf-8' },
    { kind: 'topofix-handoff', label: 'Verified TopoFix Fresh-Basis Handoff JSON', filename: result?.topoFixPreFinalHandoffName, value: result?.topoFixPreFinalHandoffText, mime: 'application/json;charset=utf-8' },
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
  topologyCard.append(topologyGrid, createElement('div', xmlMode
    ? 'Analysis is non-mutating. Reviewed TopoFix emits source-lineage evidence. GC-PW Weight/Final requires a fresh source basis; an accepted Final never transfers.'
    : 'Topology controls are available only for PSI116 XML source mode.', 'model-converters-workflow-detail-note'));
  if(xmlMode)renderXml229TopologyReview(topologyCard,{stateRef,render});
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

/**
 * Owner-invoked audit. Read current live Worker completion AND Final intent
 * afresh. Never export original JSON/XML, source IDs, physical occurrence
 * IDs, SHA values, full Worker receipts or private native candidate bytes.
 */
async function collectXml229RunHoldAudit(stateRef,report){
 ensureXml229FlowTrace(stateRef);
 recordXml229FlowTrace(stateRef,{kind:'RUN_AUDIT_REQUESTED',actor:'output-ui'});
 const session=getXml229CurrentWorkerHeldReview(stateRef);
 let completion=null,finalIntent=null,finalIntentReadError=null,readError=null;
 let sessionState=session?(session.closed?'CLOSED':'LIVE'):'MISSING';
 if(session&&!session.closed){
   try{
     const observed=await readXml229NativeFinalObservation(session,
       ()=>getXml229CurrentWorkerHeldReview(stateRef)===session&&!session.closed);
     if(observed.stale)
       throw Object.assign(new Error('STALE_WORKER_LEASE'),{code:'STALE_WORKER_LEASE'});
     completion=observed.completion;
     finalIntent=observed.finalIntent;
     finalIntentReadError=observed.finalIntentReadError;
     recordXml229FlowTrace(stateRef,{kind:'RUN_AUDIT_COMPLETED',actor:'output-ui',
       counts:{physical:completion?.verifiedPhysicalCount,
         facts:completion?.verifiedFactCount,
         sourceMass:completion?.counts?.source,match1:completion?.counts?.match1,
         final:completion?.counts?.final,unresolved:completion?.counts?.unresolved}});
   }catch(error){
     completion=null;finalIntent=null;finalIntentReadError=null;
     readError={code:error?.code||'WORKER_READ_UNAVAILABLE'};
     sessionState=session.closed?'CLOSED':'LIVE';
     recordXml229FlowTrace(stateRef,{kind:'RUN_AUDIT_FAILED',actor:'output-ui',
       code:readError.code});
   }
 }
 // Read the latest immutable UI state AFTER the two asynchronous calls.
 // The attestor itself demands matching source, generation, basis and census.
 const input=stateRef.current;
 if(completion&&!await isXml229VerifiedReviewCompletionForInput(
   (stateRef.modeABaseRef||stateRef).current,session.receipt,completion))completion=null;
 const freshReport=buildStandaloneOutputRunReadiness(input,{
   verifiedEngineering:completion
     ?{sessionReceipt:session.receipt,proof:completion,finalIntent,finalIntentReadError}
     :readError?{readError}:null,
 });
 const params={
   input,report:freshReport,sessionState,
   leaseDiagnosis:inspectXml229EngineeringLease(stateRef),
   sessionReceipt:session?.closed?null:session?.receipt||null,
   completion,finalIntent,finalIntentReadError,readError,
   candidate:getXml229CandidateAttempt(stateRef,session),
 };
 const provisional=buildXml229RunHoldAudit({
   ...params,flowTrace:getXml229FlowTrace(stateRef)?.snapshot()||null,
 });
 recordXml229FlowTrace(stateRef,{kind:'RUN_GATE_DIAGNOSED',actor:'native-gate',
   code:provisional.diagnosisCode});
 return {...buildXml229RunHoldAudit({
   ...params,flowTrace:getXml229FlowTrace(stateRef)?.snapshot()||null,
 }),execution:inspectXml229NativeRunEligibility({
   state:input,report:freshReport,session,candidate:params.candidate})};
}

function xml229RunHoldPlainMeaning(audit){
 const code=audit?.diagnosisCode||'';
 const weights=audit?.evidence?.find(x=>x.name==='weight-final-readiness');
 const mass=weights?.status==='VERIFIED'
   ?'The current Worker reports a complete accepted Source/Final mass census. '
   :'Weight/Final evidence is not fully verified for this snapshot. ';
 if(code==='FINAL_INTENT_NOT_OBSERVED')
   return mass+'Native Final intent has not been read for this display; it is not a missing-weight verdict.';
 if(code==='FINAL_INTENT_READ_FAILED')
   return mass+'The Worker Final-intent read failed; the audit keeps Weight evidence separate and native Run remains unverified.';
 if(code==='INDEPENDENT_NATIVE_RELEASE_AUTHORITY_ABSENT')
   return mass+'Final intent is eligible. Actual native CII output and independent mass reconciliation are still required.';
 if(code==='BRANCH_FORMAT_IDENTITY_UNRESOLVED')
   return mass+'Branch format identities are unresolved. No native candidate failure is recorded in this audit; review the two separate 4 Preview passes.';
 if(code==='NATIVE_CANDIDATE_FAILED'){
   const failure=audit?.nativeCandidate?.failureCode||'NATIVE_CANDIDATE_FAILED';
   return mass+'Native conversion was attempted and FAILED: '+failure+
     (failure==='XML229_STAGED_POSITION_AMBIGUOUS'
       ?'. Staged JSON position evidence has multiple possible source owners. Review exact staged-position ownership before retrying; no CII was released.'
       :'. Inspect the native failure diagnostic before retrying.')+
     (audit?.branchFormat?.blocked
       ?' Separate warning: configured Format 1 / Format 2 enrichment identity remains unresolved.'
       :'');
 }
 if(code==='FINAL_INTENT_SOURCE_OR_BASIS_DRIFT'||code==='FINAL_INTENT_POPULATION_DRIFT')
   return mass+'The returned Final intent contradicts the current source, Worker basis or mass census; rebuild on one source revision.';
 if(code==='FINAL_INTENT_INVALID')
   return mass+'The returned Final-intent receipt is malformed; do not use it to run or release CII.';
 if(code==='FINAL_INTENT_NOT_ELIGIBLE')
   return mass+'The current Worker has not authorized this Final mass population for native binding; inspect the accepted review decisions.';
 return mass+'Inspect the first unverified stage. Diagnostic evidence alone cannot authorize native CII.';
}
function renderRunControls(parent, stateRef, state, report, render) {
  const ctrlCard = section(parent, 'Run Conversion');
  const routeLabel=createElement('label','','model-converters-workflow-regex-field');
  routeLabel.appendChild(createElement('span','Conversion source / CII route'));
  const routeSelect=createElement('select');
  routeSelect.dataset.action='xml229-output-participation';
  const approved=isXml229XmlOnlyApproved(state);
  routeSelect.append(
    createOption('governed','Source XML + accepted engineering weights (JSON optional; verified native CII)',!approved),
    createOption('xml-only','XML-only test conversion (no draft weights)',approved),
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
      :(report.raw.xml229NativeOutputVerified
        ?'Current accepted engineering weights are consumed by verified native CII output. Download is permitted while this Worker source and Final intent remain unchanged.'
        :xml229NativeRunWaitingMessage(report)),
    'model-converters-workflow-detail-note'));
  const actionDiv = createElement('div');
  if (actionDiv.style) Object.assign(actionDiv.style, { marginTop: '12px', display: 'flex', gap: '8px', flexDirection: 'column' });
  const noteDiv = createElement('div', '', 'model-converters-workflow-detail-note');
  const runReviewBtn=createXml229RunMassReviewButton({
    stateRef,render,approved,report,createElement,updateWorkflowState,noteDiv,
  });
  noteDiv.innerHTML = approved ? 'XML-only mode excludes JSON-derived Weight/Final from native output; independent XML preflight remains mandatory.' : 'Verified unresolved masses automatically open a second Weight-style review popup. If dismissed, use the button above to reopen it. Each Applied Weight starts at an uncommitted 0 kg default; Final decisions are recorded only on explicit confirmation. Native CII remains independently governed.';
  if(state.xml229CurrentRunReviewStatus)noteDiv.textContent=state.xml229CurrentRunReviewStatus;
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
  // The canonical row remains HELD by design. Show WHY, including the
  // first unsupported boundary, even when Preview/Weight are already ready.
  if(report.runHoldAudit?.gateStatus==='HELD'){
    ensureXml229FlowTrace(stateRef);
    const snapshot=report.runHoldAudit;
    recordXml229FlowTrace(stateRef,{kind:'RUN_GATE_DIAGNOSED',
      actor:'native-gate',code:snapshot.diagnosisCode});
    const auditPanel=createElement('details','','xml-cii-weight-panel');
    auditPanel.appendChild(createElement('summary',
      'Why is native Run HELD? — source/Worker audit trail'));
    const auditStatus=createElement('div',
      'Current diagnosis: '+snapshot.diagnosisCode+
      '. First missing/held boundary: '+(snapshot.firstUnverifiedBoundary||'unknown')+
      '. '+xml229RunHoldPlainMeaning(snapshot)+' Native release remains separately governed.',
      'model-converters-workflow-detail-note');
    auditPanel.appendChild(auditStatus);
    let auditStages=table(
      ['Stage','Status','Evidence / reason'],
      snapshot.evidence.map(e=>({Stage:e.name,Status:e.status,
        'Evidence / reason':e.reason})),
      'No evidence boundaries available.');
    auditPanel.appendChild(auditStages);
    const auditBtn=button('xml229-download-run-hold-audit',
      'Download fresh Run HOLD audit trail JSON');
    auditBtn.addEventListener('click',async()=>{
      if(auditBtn.disabled)return;
      auditBtn.disabled=true;
      try{
        const evidence=await collectXml229RunHoldAudit(stateRef,report);
        if(auditPanel.isConnected!==false){
          auditStatus.textContent='Current diagnosis: '+evidence.diagnosisCode+
            '. First missing/held boundary: '+(evidence.firstUnverifiedBoundary||'unknown')+
            '. '+xml229RunHoldPlainMeaning(evidence)+' Native release remains separately governed.';
          const fresh=table(['Stage','Status','Evidence / reason'],
            evidence.evidence.map(e=>({Stage:e.name,Status:e.status,
              'Evidence / reason':e.reason})),
            'No evidence boundaries available.');
          auditStages.replaceWith(fresh);
          auditStages=fresh;
        }
        downloadTextFile('xml229-run-hold-audit.json',
          JSON.stringify(evidence,null,2),'application/json;charset=utf-8');
      }catch{
        // Even unexpected collector bugs remain a typed fail-closed diagnostic.
        recordXml229FlowTrace(stateRef,{kind:'RUN_AUDIT_FAILED',
          actor:'output-ui',code:'RUN_AUDIT_UNEXPECTED_FAILURE'});
        const failed=buildXml229RunHoldAudit({
          input:stateRef.current,report,
          sessionState:'UNKNOWN',
          readError:{code:'RUN_AUDIT_UNEXPECTED_FAILURE'},
          flowTrace:getXml229FlowTrace(stateRef)?.snapshot()||null,
        });
        if(auditPanel.isConnected!==false){
          auditStatus.textContent='Fresh audit failed: '+failed.diagnosisCode+
            '. The current Worker/source proof is not verified. Native release remains HELD.';
          const fresh=table(['Stage','Status','Evidence / reason'],
            failed.evidence.map(e=>({Stage:e.name,Status:e.status,
              'Evidence / reason':e.reason})),
            'No evidence boundaries available.');
          auditStages.replaceWith(fresh);
          auditStages=fresh;
        }
        downloadTextFile('xml229-run-hold-audit.json',
          JSON.stringify(failed,null,2),'application/json;charset=utf-8');
      }finally{auditBtn.disabled=false;}
    });
    auditPanel.appendChild(auditBtn);
    actionDiv.appendChild(auditPanel);
  }
  renderXml229NativeRunDebug(actionDiv,stateRef,getXml229CurrentWorkerHeldReview(stateRef));
  const governed=hasOriginalJsonSourceOnlyRunHold(state);
  const weightsReady=report.raw.xml229VerifiedEngineering===true&&
    report.checklistRows.some(r=>r.id==='weight-match'&&r.status==='ready');
  const execution=inspectXml229NativeRunEligibility({state,report,
    session:getXml229CurrentWorkerHeldReview(stateRef),
    candidate:getXml229CandidateAttempt(stateRef,getXml229CurrentWorkerHeldReview(stateRef))});
  const blocked=state.running||(governed?!execution.canExecute:report.summary.blockingCount>0);
  if(governed){
    const detail=createElement('div',execution.canExecute
      ?'Accepted weights are ready. Use Finalise and Run Conversion to generate and verify CII; Download enables after verification.'
      :state.running?'Native conversion is running; see the execution stage above.'
      :'Native conversion is waiting: '+execution.blockerIds.map(id=>
        report.checklistRows.find(row=>row.id===id)?.message||id).join(' '),
      'model-converters-workflow-detail-note');
    detail.dataset.xml229NativeExecution='true';
    actionDiv.appendChild(detail);
  }
  const finalizeBtn=createElement('button',state.running?'Running...':
    'Finalise and Run Conversion','model-converters-download-btn');
  if(finalizeBtn.style)Object.assign(finalizeBtn.style,{
    width:'100%',padding:'12px',background:blocked?'#334155':'#1e4ed8',
    color:'#fff',border:'none',fontWeight:'700'});
  finalizeBtn.disabled=!!blocked;
  finalizeBtn.dataset.action=governed&&weightsReady?'xml229-native-run':'run';
  if(governed&&weightsReady)finalizeBtn.addEventListener('click',async()=>{
    if(finalizeBtn.disabled)return;
    finalizeBtn.disabled=true;
    await executeXml229NativeRun({stateRef,
      session:getXml229CurrentWorkerHeldReview(stateRef),
      liveWorker:()=>getXml229CurrentWorkerHeldReview(stateRef),
      runCandidate:runXml229NativeCiiMassCandidate,updateState:updateWorkflowState,
      render,download:downloadTextFile});
    if(finalizeBtn.isConnected!==false)finalizeBtn.disabled=!!stateRef.current.running;
  });
  actionDiv.append(runReviewBtn,noteDiv,refreshBtn,exportEvidenceBtn,finalizeBtn);
  ctrlCard.appendChild(actionDiv);
  // Scoped allowlisted evidence; never expose the native engine's raw logs.
  const failure=state.result?.xml229NativeFailure;
  if(failure?.schema==='XML229.NativeConverterFailure.v1'){
    const category=['ENGINE_FAILED','CII_OUTPUT_MISSING','NATIVE_MASS_PROOF_MISSING']
      .includes(failure.category)?failure.category:'ENGINE_FAILED';
    const phase=['PYODIDE_INITIALIZE','SCRIPT_LOAD','BASE_MODULE_RESET',
      'INPUT_PREPARATION','TOPOLOGY_STAGE','ENRICH_XML','CII_CONVERSION',
      'MASS_PROOF_READ','MASS_PROOF_VERIFY','RUNTIME_OPTIONS',
      'ORIGINAL_LINEAGE_STAGE','STAGED_ENRICHMENT',
      'LINEAGE_PACKET_VALIDATE','LINEAGE_GEOMETRY_VERIFY','LINEAGE_PREFINAL_RESTRAINT_REPLAY','LINEAGE_FINAL_SOURCE_COMPARE','LINEAGE_OWNER_CENSUS','STAGED_POSITION_TRANSFER','SOURCE_VALUE_HYDRATION','VERIFIED_MASTER_COMPLETENESS','BEND_RADIUS_POLICY',
      'PREACCEPTANCE_GEOMETRY','FINAL_MASS_BINDING','FINAL_GEOMETRY_READ',
      'MODEL_PARSE','MODEL_BUILD','MODEL_GEOMETRY_CHECK',
      'RIGID_WEIGHT_OWNER_CHECK','CII_SERIALIZE','EMITTED_MASS_VERIFY',
      'OUTPUT_WRITE','UNKNOWN']
      .includes(failure.phase)?failure.phase:'UNKNOWN';
    const code=/^[A-Z][A-Z0-9_]{2,79}$/.test(failure.code||'')
      ?failure.code:'NATIVE_CANDIDATE_CONVERTER_FAILED';
    const ownerMatchCardinality=code==='CII_NATIVE_PHYSICAL_OWNER_MISSING'?'ZERO':
      code==='CII_NATIVE_PHYSICAL_OWNER_MULTIPLE'?'MULTIPLE':null;
    const stagedPositionAmbiguity=code==='XML229_STAGED_POSITION_AMBIGUOUS'&&
      failure.stagedPositionAmbiguity?.schema==='XML229.NativeStagedPositionAmbiguity.v1'
        ?failure.stagedPositionAmbiguity:null;
    const safe={schema:'XML229.NativeConverterFailure.v1',code,category,phase,
      ...(ownerMatchCardinality?{ownerMatchCardinality}:{}),
      ...(stagedPositionAmbiguity?{stagedPositionAmbiguity}:{}),
      candidatePublished:false,nativeCiiReleaseAuthorized:false};
    const panel=section(ctrlCard,'Native converter failure — diagnostic only');
    panel.appendChild(createElement('div',
      'Failure category: '+category+'; stage: '+phase+'; code: '+code+
      (ownerMatchCardinality?'; owner matches: '+ownerMatchCardinality:'')+
      '. No CII was published. Final decisions were not changed.',
      'model-converters-workflow-detail-note'));
    const exportBtn=button('download-native-failure-diagnostic',
      'Download safe native failure diagnostic JSON');
    exportBtn.addEventListener('click',()=>downloadTextFile(
      'xml229-native-converter-failure.json',JSON.stringify(safe,null,2),
      'application/json;charset=utf-8'));
    panel.appendChild(exportBtn);
  }
  // Show exact source locations for rejected instrument mass owners. Do not
  // turn optional Preview suggestions into approved RIGID classifications.
  const unsupported=rows(state.result?.xml229NativeOwnerPreflight?.unsupportedOwners);
  if(unsupported.length){
    const audit=createElement('details','','xml-cii-weight-panel');
    audit.open=true;
    audit.dataset.xml229NativeOwnerPreflight='true';
    audit.appendChild(createElement('summary',
      unsupported.length+' accepted instrument owners lack native RIGID classification'));
    audit.appendChild(createElement('div',
      'These accepted masses cannot be released as fully reconciled CII RIGID masses. '+
      'Review original instrument modeling authority and create a new source '+
      'revision before new Final mass decisions. The original source, old Final '+
      'review, and XML-only test path remain intact.',
      'model-converters-workflow-detail-note'));
    audit.appendChild(table(
      ['Branch ordinal','Node ordinal','Type','Reference','Span mm','Reason'],
      unsupported.map(owner=>({
        'Branch ordinal':owner.branchOccurrenceIndex,
        'Node ordinal':owner.sourceNodeOrdinal,
        Type:owner.componentType,Reference:owner.componentRefNo,
        'Span mm':owner.spanMm,Reason:owner.reason,
      })), 'No unsupported instrument owners'));
    const evidenceStatus=createElement('div','',
      'model-converters-workflow-detail-note');
    const evidenceBtn=button('xml229-export-owner-blockers',
      'Download source-bound blocker evidence JSON');
    evidenceBtn.addEventListener('click',()=>{
      try{
        const evidence=buildXml229NativeOwnerBlockerEvidence(
          state.result?.xml229NativeOwnerPreflight);
        downloadTextFile('xml229-native-owner-blockers.json',
          JSON.stringify(evidence,null,2),'application/json;charset=utf-8');
        evidenceStatus.textContent='Blocker evidence exported for source review. '+
          'This JSON is NOT an instrument classification manifest or CII release proof.';
      }catch{
        evidenceStatus.textContent='Evidence export unavailable; source or Final '+
          'receipt no longer matches. Refresh the current Worker review.';
      }
    });
    audit.appendChild(evidenceBtn);
    audit.appendChild(evidenceStatus);
    audit.appendChild(createXml229InstrumentSourceReviewControl({readCurrent:()=>{
      const current=stateRef.current;
      return {sourceText:current.sourceText,sourceFile:current.sourceFile,
        sourceName:current.sourceName||current.sourceFile?.name,
        report:current.result?.xml229NativeOwnerPreflight};
    },activate:args=>startXml229InstrumentFreshReview({
      ...args,stateRef,container:parent,
      sourceIsCurrent:()=>stateRef.current?.sourceText===args.sourceText&&
        stateRef.current?.result?.xml229NativeOwnerPreflight===args.report,
      render,
    })}));
    audit.appendChild(createElement('div',
      'Use the review above to select instrument models, activate the revised XML '+
      'and start a fresh Final review here, or download the XML separately. '+
      'The source revision receipt does not approve engineering masses or release CII. '+
      'For a repository workflow, the equivalent commands are:',
      'model-converters-workflow-detail-note'));
    audit.appendChild(createElement('pre',[
      'python3 converters/scripts/xml229_instrument_source_revision.py inspect',
      '  --source YOUR_SOURCE.xml --manifest instrument-suggestions.json',
      '',
      '# Review instrument-suggestions.json; mark RIGID only when justified.',
      'python3 converters/scripts/xml229_instrument_source_revision.py apply',
      '  --source YOUR_SOURCE.xml --manifest instrument-suggestions.json',
      '  --revised-source reviewed-source.xml --receipt revision-receipt.json',
    ].join('\n'),'xml-cii-phase-help'));
    ctrlCard.appendChild(audit);
  }
  if(governed&&weightsReady&&!blocked)offerXml229AutomaticNativeRun({
    stateRef,session:getXml229CurrentWorkerHeldReview(stateRef),report,
    button:finalizeBtn,liveWorker:()=>getXml229CurrentWorkerHeldReview(stateRef)});
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
 if(receipt?.schema!=='XML229.OriginalStagedSourceReceipt.v1'&&
   getXml229CurrentWorkerHeldReview(stateRef)?.receipt?.reviewSourceKind!=='XML_ONLY')return;
 const enabled=raw.sourceBatch?.sources?.filter(x=>x.enabled!==false)||null;
 if(enabled&&enabled.length!==1)return;
 const session=getXml229CurrentWorkerHeldReview(stateRef);
 if(!session)return;
 recordXml229FlowTrace(stateRef,{kind:'OUTPUT_READ_REQUESTED',actor:'output-ui'});
 const activeId=raw.sourceBatch?.activeSourceId||state.modeASourceId||'';
 if(enabled?.length===1&&enabled[0].sourceId!==activeId)return;
 // An older in-flight Worker completion must never repaint a newer Run panel.
 const token=card.__xml229ReadinessToken;
 void readXml229NativeFinalObservation(session,
   ()=>getXml229CurrentWorkerHeldReview(stateRef)===session&&!session.closed
 ).then(async({stale,completion:proof,finalIntent,finalIntentReadError})=>{
   if(!await isXml229VerifiedReviewCompletionForInput(
     (stateRef.modeABaseRef||stateRef).current,session.receipt,proof))return;
   if(stale)return;
   if(card.isConnected===false||card.__xml229ReadinessToken!==token||
      getXml229CurrentWorkerHeldReview(stateRef)!==session)return;
   // Ordinary immutable UI updates may replace the state object while an
   // independently verified Worker RPC is pending. Challenge the *latest*
   // state against the Worker proof rather than requiring object identity.
   const latest=stateRef.current;
   const verifiedReport=buildStandaloneOutputRunReadiness(xml229TopologyDisplayState(latest,stateRef),{
     candidate:getXml229CandidateAttempt(stateRef,session),
     verifiedEngineering:{sessionReceipt:session.receipt,proof,finalIntent,
        finalIntentReadError,nativeOutput:latest.result?.xml229NativeOutput||null},
   });
   recordXml229FlowTrace(stateRef,{kind:'OUTPUT_READ_VERIFIED',actor:'output-ui',
     counts:{physical:proof?.verifiedPhysicalCount,facts:proof?.verifiedFactCount,
       sourceMass:proof?.counts?.source,match1:proof?.counts?.match1,
       final:proof?.counts?.final,unresolved:proof?.counts?.unresolved}});
   if(verifiedReport.checklistRows?.some(r=>
      r.id==='xml229-original-json-engineering-authority'&&r.blocking))
     recordXml229FlowTrace(stateRef,{kind:'RUN_GATE_HELD',actor:'native-gate',
       code:'NATIVE_CONSUMPTION_UNVERIFIED'});
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
   recordXml229FlowTrace(stateRef,{kind:'OUTPUT_READ_FAILED',actor:'output-ui',
     code:error?.code||'WORKER_READ_UNAVAILABLE'});
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
    renderArtifacts(card, renderState, report, stateRef);
    renderTopologyArtifacts(card, xml229TopologyDisplayState(renderState,stateRef));
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
  paint(reportFromState(state,stateRef));
  projectOriginalReviewIntoRunChecklist(card,stateRef,state,paint);
}

