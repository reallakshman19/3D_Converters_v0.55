import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
  serializeHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import {
  HP_PIPING_CLASS_CYCLE_BULK_HEADERS,
  HP_PIPING_CLASS_STATE_BULK_HEADERS,
  applyHpPipingClassTransientBulkInput,
  previewHpPipingClassTransientBulkInput,
} from './hp-piping-class-transient-bulk-input.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmt(value, digits = 5) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function cloneProject(project) {
  return project == null ? null : parseHpPipingClassWorkspaceProject(JSON.stringify(project));
}

function readStoredProject() {
  const raw = globalThis.localStorage?.getItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY);
  if (!raw) return null;
  return parseHpPipingClassWorkspaceProject(raw);
}

function ensureStyles() {
  if (document.querySelector('style[data-hp-transient-bulk-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.hpTransientBulkStyle = 'true';
  style.textContent = `
    .hpwb-transient-bulk{margin:8px 0 14px}.hpwb-transient-bulk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hpwb-transient-bulk textarea{width:100%;min-height:150px;resize:vertical;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(2,6,23,.52);border:1px solid rgba(148,163,184,.23);border-radius:8px;padding:10px;line-height:1.45}.hpwb-transient-bulk-contract{display:block;margin:6px 0;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd;overflow-wrap:anywhere}.hpwb-transient-bulk-preview-table{min-width:780px}.hpwb-transient-bulk-preview-table td,.hpwb-transient-bulk-preview-table th{white-space:nowrap}
    @media(max-width:900px){.hpwb-transient-bulk-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function previewHtml(preview, applied = false) {
  if (!preview) return '<div class="hpwb-muted">Validate both tables before applying them.</div>';
  if (!preview.ok) {
    return `<div class="hpwb-notice error"><strong>Transient bulk intake blocked · ${preview.issues?.length ?? 0} issue(s).</strong><ul>${(preview.issues ?? []).slice(0, 14).map((item) => `<li><span class="hpwb-code">${esc(item.code)}</span> · ${esc(item.message)}</li>`).join('')}</ul></div>`;
  }
  const summary = preview.summary ?? {};
  const cleanup = preview.plan?.removedExternalRows ?? [];
  const removedPackages = preview.plan?.removedFatigueProductIds ?? [];
  return `<div class="hpwb-notice good"><strong>${applied ? 'Transient spectrum applied.' : 'Transient spectrum valid.'}</strong> Spectrum ${esc(preview.spectrumId)} · ${summary.parsedStates ?? 0} state(s) · ${summary.parsedCycles ?? 0} governed cycle(s) · ${Number(summary.totalDeclaredCycles ?? 0).toLocaleString()} declared lifetime cycles.${applied ? ' Review calculation requested through the existing canonical workbench action.' : ''}</div>
    <div class="hpwb-notice"><strong>KD custody:</strong> ${summary.retainedExternalRows ?? 0} external row(s) retain exact cycle/state-pair + state-value custody · ${summary.removedExternalRows ?? 0} stale row(s) will be removed · ${summary.fatiguePackagesNeedingCycleRows ?? 0} existing KD package(s) will need one or more cycle rows after import.</div>
    ${cleanup.length ? `<div class="hpwb-notice warn"><strong>Stale external rows removed:</strong> ${esc(cleanup.map((row) => `${row.productId}:${row.cycleId}(${row.reason})`).join(', '))}.</div>` : ''}
    ${removedPackages.length ? `<div class="hpwb-notice warn"><strong>Empty KD package(s) removed:</strong> ${esc(removedPackages.join(', '))}. Re-add the product in KD Review when new Seq/N values are available.</div>` : ''}
    <h4>Operating-state preview</h4>
    <div class="hpwb-table-wrap"><table class="hpwb-table hpwb-transient-bulk-preview-table"><thead><tr><th>State</th><th>Pressure MPa</th><th>Material T °C</th><th>Structural T °C</th></tr></thead><tbody>${(preview.states ?? []).map((row) => `<tr><td><strong>${esc(row.stateId)}</strong></td><td>${fmt(row.pressureMpa)}</td><td>${fmt(row.materialTemperatureC, 2)}</td><td>${fmt(row.structuralTemperatureC, 2)}</td></tr>`).join('')}</tbody></table></div>
    <h4>Governed-cycle preview</h4>
    <div class="hpwb-table-wrap"><table class="hpwb-table hpwb-transient-bulk-preview-table"><thead><tr><th>Cycle</th><th>From</th><th>To</th><th>Lifetime n</th><th>Cycles/year</th><th>Category</th><th>Preview ΔP MPa</th></tr></thead><tbody>${(preview.transitions ?? []).map((row) => `<tr><td><strong>${esc(row.cycleId)}</strong></td><td>${esc(row.fromStateId)}</td><td>${esc(row.toStateId)}</td><td>${Number.isFinite(row.totalCycles) ? row.totalCycles.toLocaleString() : '—'}</td><td>${Number.isFinite(row.cyclesPerYear) ? row.cyclesPerYear.toLocaleString() : '—'}</td><td>${esc(row.category)}</td><td>${fmt(row.previewPressureRangeMpa)}</td></tr>`).join('')}</tbody></table></div>`;
}

function editorHtml(state) {
  const stateHeader = HP_PIPING_CLASS_STATE_BULK_HEADERS.join(',');
  const cycleHeader = HP_PIPING_CLASS_CYCLE_BULK_HEADERS.join(',');
  return `<summary>Paste / import operating states + governed cycles</summary>
    <p class="hpwb-muted">Uses the current Spectrum ID above. Applying replaces this class spectrum's state/cycle tables. Existing external Seq/N rows are retained only when cycle ID, from-state, to-state and the referenced state pressure/material/structural temperatures remain exactly unchanged.</p>
    <div class="hpwb-transient-bulk-grid">
      <div><strong>Operating states</strong><span class="hpwb-transient-bulk-contract">${esc(stateHeader)}</span><textarea data-hpwb-transient-states spellcheck="false" placeholder="${esc(stateHeader)}\nLOW,2,40,40\nHIGH,20,80,80">${esc(state.statesText ?? '')}</textarea><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-transient-action="load-states" type="button">Load states CSV / TSV</button></div></div>
      <div><strong>Governed cycles</strong><span class="hpwb-transient-bulk-contract">${esc(cycleHeader)}</span><textarea data-hpwb-transient-cycles spellcheck="false" placeholder="${esc(cycleHeader)}\nC1,LOW,HIGH,500,25,PRESSURE_CYCLE,OPS-001">${esc(state.cyclesText ?? '')}</textarea><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-transient-action="load-cycles" type="button">Load cycles CSV / TSV</button></div></div>
    </div>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">No Seq, N or KD-3 engineering quantity is inferred here. After import, add/refresh external results in KD Review.</span><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-transient-action="validate" type="button">Validate spectrum</button><button class="hpwb-button primary" data-hpwb-transient-action="apply" type="button">Apply + recalculate</button></div></div>
    <input class="hpwb-hidden" data-hpwb-transient-file="states" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain">
    <input class="hpwb-hidden" data-hpwb-transient-file="cycles" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain">
    <div data-hpwb-transient-preview>${previewHtml(state.preview, state.applied)}</div>`;
}

function transientSignature(project) {
  return JSON.stringify({
    spectrumId: project?.transient?.spectrum?.spectrumId ?? null,
    states: (project?.transient?.states ?? []).map((row) => [row.stateId, row.pressureMpa, row.materialTemperatureC, row.structuralTemperatureC]),
    transitions: (project?.transient?.transitions ?? []).map((row) => [row.cycleId, row.fromStateId, row.toStateId, row.totalCycles, row.cyclesPerYear ?? null, row.category ?? '', row.provenanceId ?? null]),
    evidence: (project?.fatigueEvidence ?? []).map((pkg) => [pkg.productId, (pkg.externalResults ?? []).map((row) => [row.cycleId, row.fromStateId, row.toStateId])]),
  });
}

async function waitForImportedProject(expected, timeoutMs = 3000) {
  const signature = transientSignature(expected);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = readStoredProject();
    if (current && transientSignature(current) === signature) return current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for the existing HP project-import controller to accept the transient spectrum.');
}

export function installHpPipingClassTransientBulkEnhancer(container, options = {}) {
  ensureStyles();
  let state = { statesText: '', cyclesText: '', preview: null, applied: false };
  let contextProject = cloneProject(options?.context?.hpPipingClassProject ?? null);

  function currentProject() {
    return contextProject ?? readStoredProject();
  }

  function setState(next) {
    state = { ...state, ...next };
    const editor = container.querySelector('[data-hpwb-transient-editor]');
    if (!editor) return;
    editor.open = true;
    const statesArea = editor.querySelector('[data-hpwb-transient-states]');
    const cyclesArea = editor.querySelector('[data-hpwb-transient-cycles]');
    if (statesArea && statesArea.value !== state.statesText) statesArea.value = state.statesText;
    if (cyclesArea && cyclesArea.value !== state.cyclesText) cyclesArea.value = state.cyclesText;
    const preview = editor.querySelector('[data-hpwb-transient-preview]');
    if (preview) preview.innerHTML = previewHtml(state.preview, state.applied);
  }

  function validate() {
    try {
      const preview = previewHpPipingClassTransientBulkInput(currentProject(), { statesText: state.statesText, cyclesText: state.cyclesText });
      setState({ preview, applied: false });
      return preview;
    } catch (error) {
      const preview = { ok: false, issues: [{ code: 'TRANSIENT_BULK_PREVIEW_FAILED', message: error.message }], states: [], transitions: [], summary: {} };
      setState({ preview, applied: false });
      return preview;
    }
  }

  async function apply() {
    const result = applyHpPipingClassTransientBulkInput(currentProject(), { statesText: state.statesText, cyclesText: state.cyclesText });
    setState({ preview: result, applied: false });
    if (!result.ok || !result.applied) return;
    const input = container.querySelector('[data-hpwb-file]');
    if (!input || typeof DataTransfer === 'undefined' || typeof File === 'undefined') {
      setState({ preview: { ...result, ok: false, issues: [{ code: 'TRANSIENT_BULK_IMPORT_BRIDGE_UNAVAILABLE', message: 'Browser file-import bridge is unavailable; project was not changed.' }] }, applied: false });
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([serializeHpPipingClassWorkspaceProject(result.project)], 'hp-transient-spectrum-import.json', { type: 'application/json' }));
    input.files = transfer.files;
    contextProject = null;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForImportedProject(result.project);
    state = { ...state, preview: result, applied: true };
    inject();
    container.querySelector('[data-hpwb-action="calculate"]')?.click();
  }

  async function loadFile(kind, file) {
    try {
      const content = await file.text();
      if (kind === 'states') state = { ...state, statesText: content, preview: null, applied: false };
      else state = { ...state, cyclesText: content, preview: null, applied: false };
      inject();
      setState(state);
    } catch (error) {
      setState({ preview: { ok: false, issues: [{ code: 'TRANSIENT_BULK_FILE_READ_FAILED', message: error.message }], states: [], transitions: [], summary: {} }, applied: false });
    }
  }

  function inject() {
    const panel = container.querySelector('.hpwb-panel');
    const isCycles = panel?.querySelector('.hpwb-panel-heading h3')?.textContent?.trim() === 'Pressure Cycles';
    if (!isCycles || panel.querySelector('[data-hpwb-transient-editor]')) return;
    const statesToolbar = [...panel.querySelectorAll('.hpwb-section-toolbar')].find((row) => row.querySelector('h4')?.textContent?.trim() === 'Operating states');
    if (!statesToolbar) return;
    const editor = document.createElement('details');
    editor.className = 'hpwb-details hpwb-transient-bulk';
    editor.dataset.hpwbTransientEditor = 'true';
    editor.open = Boolean(state.preview);
    editor.innerHTML = editorHtml(state);
    statesToolbar.before(editor);
  }

  function invalidate(message = 'Project transient inputs changed. Revalidate the spectrum before applying.') {
    contextProject = null;
    if (!state.preview) return;
    state = { ...state, preview: null, applied: false };
    const target = container.querySelector('[data-hpwb-transient-preview]');
    if (target) target.innerHTML = `<div class="hpwb-muted">${esc(message)}</div>`;
  }

  function onInput(event) {
    const statesArea = event.target.closest('[data-hpwb-transient-states]');
    if (statesArea) {
      state = { ...state, statesText: statesArea.value, preview: null, applied: false };
      return;
    }
    const cyclesArea = event.target.closest('[data-hpwb-transient-cycles]');
    if (cyclesArea) {
      state = { ...state, cyclesText: cyclesArea.value, preview: null, applied: false };
      return;
    }
    if (event.target.closest('[data-hpwb-bind]')) invalidate();
  }

  function onClick(event) {
    const action = event.target.closest('[data-hpwb-transient-action]')?.dataset.hpwbTransientAction;
    if (action) {
      if (action === 'load-states') container.querySelector('[data-hpwb-transient-file="states"]')?.click();
      else if (action === 'load-cycles') container.querySelector('[data-hpwb-transient-file="cycles"]')?.click();
      else if (action === 'validate') validate();
      else if (action === 'apply') apply().catch((error) => setState({ preview: { ok: false, issues: [{ code: 'TRANSIENT_BULK_APPLY_FAILED', message: error.message }], states: [], transitions: [], summary: {} }, applied: false }));
      return;
    }
    const baseAction = event.target.closest('[data-hpwb-action]')?.dataset.hpwbAction;
    if (['load-sample', 'new-project', 'import-project'].includes(baseAction)) {
      contextProject = null;
      state = { statesText: '', cyclesText: '', preview: null, applied: false };
    } else if (['add-state', 'remove-state', 'add-transition', 'remove-transition'].includes(baseAction)) invalidate();
  }

  function onChange(event) {
    const input = event.target.closest('[data-hpwb-transient-file]');
    if (!input?.files?.[0]) return;
    const kind = input.dataset.hpwbTransientFile;
    loadFile(kind, input.files[0]).finally(() => { input.value = ''; });
  }

  const observer = new MutationObserver(inject);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('input', onInput);
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  inject();

  return () => {
    observer.disconnect();
    container.removeEventListener('input', onInput);
    container.removeEventListener('click', onClick);
    container.removeEventListener('change', onChange);
  };
}
