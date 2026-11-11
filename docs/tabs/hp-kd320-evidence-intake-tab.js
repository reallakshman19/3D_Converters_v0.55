import {
  getKd320EvidenceCsvTemplate,
  KD320_CSV_MODES,
  previewKd320EvidenceCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/csv-four-record-intake.js';
import {
  getKd320Q1SemanticCsvTemplate,
  previewKd320Q1SemanticCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/semantic-csv-intake.js';
import {
  getKd320Q1ExitAttestationJsonTemplate,
  previewKd320Q1ExitAttestationJson,
  previewKd320Q1Package,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/package-preview.js';

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function ensureStyles() {
  if (document.querySelector('style[data-kd320-csv-intake-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.kd320CsvIntakeStyle = 'true';
  style.textContent = `
    .kd320csv{padding:0 18px 24px;min-height:calc(100vh - 150px)}.kd320csv *{box-sizing:border-box}
    .kd320csv-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,430px);gap:16px;padding:10px 0 16px}.kd320csv h2{margin:0;font-size:24px}.kd320csv p{color:var(--text-muted,#9aa8b8);line-height:1.45}.kd320csv-scope{border:1px solid rgba(248,113,113,.32);border-radius:13px;padding:13px;background:rgba(127,29,29,.13)}
    .kd320csv-card{border:1px solid rgba(148,163,184,.17);border-radius:13px;padding:14px;margin:10px 0;background:rgba(15,23,42,.24)}.kd320csv-card h3{margin:0 0 8px;font-size:16px}.kd320csv-toolbar{display:flex;align-items:end;justify-content:space-between;gap:10px;flex-wrap:wrap}.kd320csv-actions{display:flex;gap:8px;flex-wrap:wrap}.kd320csv-field{display:grid;gap:5px;min-width:320px}.kd320csv-field span{font-size:11px;color:var(--text-muted,#9aa8b8);font-weight:700}.kd320csv select,.kd320csv button{font:inherit;color:inherit;border:1px solid rgba(148,163,184,.24);background:rgba(15,23,42,.52);border-radius:9px;padding:8px 11px}.kd320csv button{cursor:pointer}.kd320csv button.primary{background:rgba(37,99,235,.24);border-color:rgba(96,165,250,.44);font-weight:750}.kd320csv button:disabled{opacity:.5;cursor:not-allowed}
    .kd320csv-badges{display:flex;gap:7px;flex-wrap:wrap}.kd320csv-badge{display:inline-flex;align-items:center;padding:4px 8px;border:1px solid rgba(148,163,184,.25);border-radius:999px;font-size:11px;font-weight:800}.kd320csv-badge.blocked{border-color:rgba(248,113,113,.36);background:rgba(127,29,29,.14)}.kd320csv-badge.info{border-color:rgba(96,165,250,.34);background:rgba(30,64,175,.14)}.kd320csv-badge.good{border-color:rgba(74,222,128,.34);background:rgba(20,83,45,.14)}
    .kd320csv-notice{padding:10px 12px;border:1px solid rgba(148,163,184,.17);border-radius:10px;margin:9px 0;background:rgba(2,6,23,.2)}.kd320csv-notice.error{border-color:rgba(248,113,113,.34);background:rgba(127,29,29,.13)}.kd320csv-notice.good{border-color:rgba(74,222,128,.32);background:rgba(20,83,45,.13)}.kd320csv-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
    .kd320csv-table-wrap{overflow:auto;border:1px solid rgba(148,163,184,.15);border-radius:10px}.kd320csv-table{width:100%;border-collapse:collapse;min-width:1100px}.kd320csv-table th,.kd320csv-table td{padding:9px;border-bottom:1px solid rgba(148,163,184,.11);text-align:left;vertical-align:top}.kd320csv-table th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#9aa8b8)}.kd320csv-table td{font-size:12px}.kd320csv-list{margin:5px 0 0;padding-left:17px}.kd320csv-list li{margin:3px 0}
    .kd320csv-subpackage{border-style:dashed}.kd320csv-hidden{display:none!important}@media(max-width:850px){.kd320csv{padding:0 10px 18px}.kd320csv-hero{grid-template-columns:1fr}.kd320csv-field{min-width:100%;width:100%}.kd320csv-actions{width:100%}.kd320csv button{flex:1 1 160px}}
  `;
  document.head.appendChild(style);
}

function modeLabel(mode) {
  if (mode === KD320_CSV_MODES.CONTROLLED_SOURCE) return 'CONTROLLED_SOURCE — Q1 source receipts';
  if (mode === KD320_CSV_MODES.EDITION_SEMANTIC) return 'EDITION_SEMANTIC — 2023→2025 reconciliation';
  if (mode === KD320_CSV_MODES.QF022_ORACLE) return 'QF022_ORACLE — published numerical oracle';
  return 'QF023_PROJECT_CALC — checked project calculation';
}

function rowIdentity(row) {
  return row.evidence?.receiptId || row.evidence?.semanticId
    || row.oracle?.calculationRef || row.oracle?.bibliographicRef || `CSV row ${row.rowNumber}`;
}

function rowGate(row) {
  if (row.admission) return { state: row.admission.state, blockers: row.admission.blockers ?? [] };
  if (row.editionReconciliation) return {
    state: row.editionReconciliation.state,
    blockers: [...(row.editionReconciliation.structuralErrors ?? []),
      ...(row.editionReconciliation.blockers ?? []),
      ...(row.editionReconciliation.changedSemantics ?? []).map((id) => `${id}:CHANGED_REQUIRES_NEW_ORACLE`)],
  };
  return { state: 'NOT_EVALUATED', blockers: [] };
}

function blockersHtml(items) {
  if (!items.length) return '<span>None at this gate.</span>';
  const visible = items.slice(0, 8);
  const more = items.length - visible.length;
  return `<ul class="kd320csv-list">${visible.map((item) => `<li class="kd320csv-code">${esc(typeof item === 'string' ? item : `${item.code}: ${item.message}`)}</li>`).join('')}</ul>${more > 0 ? `<small>+ ${more} more blocker(s)</small>` : ''}`;
}

function resultsHtml(result, fileName, emptyMessage) {
  if (!result) return `<div class="kd320csv-notice">${esc(emptyMessage)}</div>`;
  const fileIssues = result.fileIssues ?? [];
  if (fileIssues.length && !result.rows?.length) return `<div class="kd320csv-notice error"><strong>${esc(fileName)} blocked before row preview.</strong>${blockersHtml(fileIssues)}</div>`;
  const ready = result.rows.filter((row) => row.ok).length;
  const fileNotice = fileIssues.length ? `<div class="kd320csv-notice error"><strong>File-level contract blockers.</strong>${blockersHtml(fileIssues)}</div>` : '';
  return `${fileNotice}<div class="kd320csv-notice ${result.ok ? 'good' : 'error'}"><strong>${ready}/${result.rows.length} row(s) passed CSV preflight.</strong> Qualification readiness is evaluated separately; preview never admits evidence.</div>
  <div class="kd320csv-table-wrap"><table class="kd320csv-table"><thead><tr><th>Row / evidence</th><th>CSV preflight</th><th>Qualification gate</th><th>Preflight blockers</th><th>Gate blockers</th><th>Authority</th></tr></thead><tbody>${result.rows.map((row) => {
    const gate = rowGate(row);
    return `<tr><td><strong>${esc(rowIdentity(row))}</strong><br><span class="kd320csv-code">row ${row.rowNumber}</span></td><td><span class="kd320csv-badge ${row.ok ? 'good' : 'blocked'}">${esc(row.preflightState)}</span></td><td><span class="kd320csv-badge info">${esc(gate.state)}</span></td><td>${blockersHtml(row.issues ?? [])}</td><td>${blockersHtml(gate.blockers)}</td><td><span class="kd320csv-badge blocked">DESIGN AUTHORITY FALSE</span><br><span class="kd320csv-code">native KD320=false · production=false</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function attestationHtml(result, fileName) {
  if (!result) return '<div class="kd320csv-notice">Download the redacted formal-exit template, complete it after E01–E08/G0–G1 are controlled and checked, then upload the JSON.</div>';
  if (!result.ok) return `<div class="kd320csv-notice error"><strong>${esc(fileName)} blocked.</strong>${blockersHtml(result.fileIssues ?? [])}</div>`;
  return `<div class="kd320csv-notice good"><strong>Formal-exit JSON parsed.</strong> Exact receipt hashes, semantic bindings, evidence/gate sets and review custody are validated only in the combined Q1 package gate.</div>`;
}

function packageHtml(result) {
  const ready = result?.q1Complete === true;
  const state = result?.state || 'Q1_CONTROLLED_EVIDENCE_PENDING';
  const blockers = result?.blockers ?? ['Q1_PACKAGE_CONTROLLED_SOURCE_MISSING', 'Q1_PACKAGE_SEMANTICS_MISSING', 'Q1_PACKAGE_FORMAL_EXIT_MISSING'];
  return `<div class="kd320csv-notice ${ready ? 'good' : 'error'}"><div class="kd320csv-badges"><span class="kd320csv-badge ${ready ? 'good' : 'blocked'}">${esc(state)}</span><span class="kd320csv-badge blocked">NATIVE KD320 · FALSE</span><span class="kd320csv-badge blocked">DESIGN AUTHORITY · FALSE</span></div><p>${ready ? 'Formal Q1 is complete. QF022/QF023 remain separate Q2 evidence.' : 'Formal Q1 remains blocked until all three CONTROLLED_SOURCE sub-packages agree exactly.'}</p>${blockersHtml(blockers)}</div>`;
}

function templateFileName(mode) {
  if (mode === KD320_CSV_MODES.CONTROLLED_SOURCE) return 'kd320-controlled-source.template.csv';
  if (mode === KD320_CSV_MODES.EDITION_SEMANTIC) return 'kd320-edition-semantic.template.csv';
  if (mode === KD320_CSV_MODES.QF022_ORACLE) return 'kd320-qf022-oracle.template.csv';
  return 'kd320-qf023-project-calc.template.csv';
}

function downloadFile(content, fileName, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
}

export function renderHpKd320EvidenceIntakeTab(container) {
  ensureStyles();
  let mode = KD320_CSV_MODES.CONTROLLED_SOURCE;
  let result = null, fileName = '', controlledSourceResult = null;
  let semanticResult = null, semanticFileName = '';
  let attestationResult = null, attestationFileName = '';
  let packageResult = previewKd320Q1Package();
  const modes = [KD320_CSV_MODES.CONTROLLED_SOURCE, KD320_CSV_MODES.EDITION_SEMANTIC,
    KD320_CSV_MODES.QF022_ORACLE, KD320_CSV_MODES.QF023_PROJECT_CALC];
  container.innerHTML = `<div class="kd320csv">
    <div class="kd320csv-hero"><div><h2>KD320 Evidence Intake</h2><p>Four-record CSV preflight plus controlled Q1 sub-packages. Existing Q1/Q2 evaluators remain the gate authority; this surface performs no KD320 numerical calculation.</p></div><aside class="kd320csv-scope"><strong>Qualification boundary</strong><p>Preview-only. No automatic oracle admission, native CORE KD320 qualification, Code-compliance claim, design authority, production-kernel promotion, or licensed source text storage.</p><div class="kd320csv-badges"><span class="kd320csv-badge blocked">CORE KD-3 · NOT QUALIFIED</span><span class="kd320csv-badge blocked">DESIGN AUTHORITY · FALSE</span></div></aside></div>
    <section class="kd320csv-card"><div class="kd320csv-toolbar"><label class="kd320csv-field"><span>Evidence record class</span><select data-kd320csv-mode>${modes.map((value) => `<option value="${value}">${modeLabel(value)}</option>`).join('')}</select></label><div class="kd320csv-actions"><button type="button" data-kd320csv-template>Download exact template</button><button type="button" class="primary" data-kd320csv-upload>Upload CSV</button><input class="kd320csv-hidden" type="file" accept="text/csv,.csv" data-kd320csv-file></div></div><p><strong>CONTROLLED_SOURCE</strong> remains the top-level receipt record class. Its semantic and formal-exit packages are below; no fifth first-class record is introduced.</p><div class="kd320csv-notice"><strong>Data handling:</strong> all uploads are parsed in browser memory only. Nothing is written into the project, master store, oracle catalog, controlled-source store, or production calculation path.</div></section>
    <section class="kd320csv-card"><h3>Admission preview</h3><div data-kd320csv-results>${resultsHtml(result, fileName, 'Choose a record class, download its exact CSV template if needed, then upload a CSV for preview.')}</div></section>
    <section class="kd320csv-card kd320csv-subpackage"><div class="kd320csv-toolbar"><div><h3>CONTROLLED_SOURCE sub-package — Q1 semantic contract</h3><p>Exactly 14 controlled semantic rows: KD320-SEM-001…014. No licensed Code text, equations, fatigue-curve points, or native numerical values.</p></div><div class="kd320csv-actions"><button type="button" data-kd320q1-template>Download Q1 semantic template</button><button type="button" class="primary" data-kd320q1-upload>Upload Q1 semantic CSV</button><input class="kd320csv-hidden" type="file" accept="text/csv,.csv" data-kd320q1-file></div></div><div class="kd320csv-notice"><strong>Fail-closed:</strong> SEM-001 → Q1-SRC-B313-2024; SEM-002…014 → Q1-SRC-VIII3-2025. Complete semantics alone never make Q1 complete.</div><div data-kd320q1-results>${resultsHtml(semanticResult, semanticFileName, 'Upload the independently checked 14-row semantic package.')}</div></section>
    <section class="kd320csv-card kd320csv-subpackage"><div class="kd320csv-toolbar"><div><h3>CONTROLLED_SOURCE sub-package — formal Q1 exit</h3><p>Redacted JSON custody record binding exact receipt hashes, all 14 semantic locators/opaque refs, E01–E08, G0/G1, evidence-ledger/audit SHA-256 and independent review.</p></div><div class="kd320csv-actions"><button type="button" data-kd320exit-template>Download formal-exit template</button><button type="button" class="primary" data-kd320exit-upload>Upload formal-exit JSON</button><input class="kd320csv-hidden" type="file" accept="application/json,.json" data-kd320exit-file></div></div><div data-kd320exit-results>${attestationHtml(attestationResult, attestationFileName)}</div></section>
    <section class="kd320csv-card"><h3>Combined Q1 package preview</h3><p>Joins the latest valid CONTROLLED_SOURCE receipt CSV, Q1 semantic CSV and formal-exit JSON in browser memory and delegates the final state to the Q1/Q2 evaluator.</p><div data-kd320package-results>${packageHtml(packageResult)}</div></section>
  </div>`;

  const modeSelect = container.querySelector('[data-kd320csv-mode]');
  const fileInput = container.querySelector('[data-kd320csv-file]');
  const semanticInput = container.querySelector('[data-kd320q1-file]');
  const attestationInput = container.querySelector('[data-kd320exit-file]');
  const results = container.querySelector('[data-kd320csv-results]');
  const semanticResults = container.querySelector('[data-kd320q1-results]');
  const attestationResults = container.querySelector('[data-kd320exit-results]');
  const packageResults = container.querySelector('[data-kd320package-results]');

  function refreshPackage() {
    packageResult = previewKd320Q1Package({ controlledSourceResult, semanticResult, attestationResult });
    packageResults.innerHTML = packageHtml(packageResult);
  }
  function refresh() { results.innerHTML = resultsHtml(result, fileName, 'Choose a record class, download its exact CSV template if needed, then upload a CSV for preview.'); }
  function onMode() { mode = modeSelect.value; result = null; fileName = ''; fileInput.value = ''; refresh(); }
  async function onFile() {
    const file = fileInput.files?.[0]; if (!file) return;
    fileName = file.name;
    try { result = previewKd320EvidenceCsv(await file.text(), mode); }
    catch (error) { result = { ok: false, fileIssues: [{ code: 'CSV_PREVIEW_EXCEPTION', message: String(error?.message || error) }], rows: [] }; }
    if (mode === KD320_CSV_MODES.CONTROLLED_SOURCE) controlledSourceResult = result;
    refresh(); refreshPackage(); fileInput.value = '';
  }
  async function onSemanticFile() {
    const file = semanticInput.files?.[0]; if (!file) return;
    semanticFileName = file.name;
    try { semanticResult = previewKd320Q1SemanticCsv(await file.text()); }
    catch (error) { semanticResult = { ok: false, fileIssues: [{ code: 'Q1_SEMANTIC_PREVIEW_EXCEPTION', message: String(error?.message || error) }], rows: [] }; }
    semanticResults.innerHTML = resultsHtml(semanticResult, semanticFileName, 'Upload the independently checked 14-row semantic package.');
    refreshPackage(); semanticInput.value = '';
  }
  async function onAttestationFile() {
    const file = attestationInput.files?.[0]; if (!file) return;
    attestationFileName = file.name;
    attestationResult = previewKd320Q1ExitAttestationJson(await file.text());
    attestationResults.innerHTML = attestationHtml(attestationResult, attestationFileName);
    refreshPackage(); attestationInput.value = '';
  }
  function onClick(event) {
    if (event.target.closest('[data-kd320csv-template]')) downloadFile(getKd320EvidenceCsvTemplate(mode), templateFileName(mode));
    if (event.target.closest('[data-kd320csv-upload]')) fileInput.click();
    if (event.target.closest('[data-kd320q1-template]')) downloadFile(getKd320Q1SemanticCsvTemplate(), 'kd320-q1-semantic-contract.template.csv');
    if (event.target.closest('[data-kd320q1-upload]')) semanticInput.click();
    if (event.target.closest('[data-kd320exit-template]')) downloadFile(getKd320Q1ExitAttestationJsonTemplate(), 'kd320-q1-formal-exit.template.json', 'application/json;charset=utf-8');
    if (event.target.closest('[data-kd320exit-upload]')) attestationInput.click();
  }

  modeSelect.addEventListener('change', onMode); fileInput.addEventListener('change', onFile);
  semanticInput.addEventListener('change', onSemanticFile); attestationInput.addEventListener('change', onAttestationFile);
  container.addEventListener('click', onClick);
  return () => {
    modeSelect.removeEventListener('change', onMode); fileInput.removeEventListener('change', onFile);
    semanticInput.removeEventListener('change', onSemanticFile); attestationInput.removeEventListener('change', onAttestationFile);
    container.removeEventListener('click', onClick); container.innerHTML = '';
  };
}
