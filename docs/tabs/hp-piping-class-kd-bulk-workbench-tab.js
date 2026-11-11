import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { validateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import { renderHpPipingClassWorkbenchTab as renderBaseWorkbench } from './hp-piping-class-workbench-tab.js';
import {
  HP_PIPING_CLASS_KD_BULK_HEADERS,
  previewHpPipingClassKdBulkInput,
} from './hp-piping-class-kd-bulk-input.js';
import {
  buildHpPipingClassResultExport,
  serializeHpPipingClassResultCsv,
  serializeHpPipingClassResultJson,
  verifyHpPipingClassResultRoundTrip,
} from './hp-piping-class-result-export.js';
import {
  renderHpPipingClassProductionReadinessHtml,
  renderHpPipingClassProductionResultHtml,
} from './hp-piping-class-production-review-view.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readProject() {
  const raw = globalThis.localStorage?.getItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY);
  if (!raw) throw new Error('Current HP Piping Class project is not available in workspace storage.');
  return parseHpPipingClassWorkspaceProject(raw);
}

function ensureBulkStyles() {
  if (document.querySelector('style[data-hp-kd-bulk-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.hpKdBulkStyle = 'true';
  style.textContent = `
    .hpwb-bulk-input{width:100%;min-height:135px;resize:vertical;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(2,6,23,.52);border:1px solid rgba(148,163,184,.23);border-radius:8px;padding:10px;line-height:1.45}
    .hpwb-bulk-contract{display:block;margin:6px 0;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd;overflow-wrap:anywhere}
    .hpwb-production-readiness{margin-bottom:12px}.hpwb-production-readiness .hpwb-notice{margin:0}
    .hpwb-production-review{margin-top:14px}.hpwb-production-ledger-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hpwb-production-ledger-grid h4,.hpwb-production-review>section>h4{margin:0 0 7px}.hpwb-production-table{min-width:440px}.hpwb-production-cycle-table{min-width:1180px}.hpwb-production-product{margin-top:12px}.hpwb-production-metrics{grid-template-columns:repeat(5,minmax(120px,1fr))}.hpwb-code{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd}.hpwb-class-result-table{min-width:1250px}.hpwb-class-matrix{margin-top:12px}
    @media(max-width:980px){.hpwb-production-ledger-grid{grid-template-columns:1fr}.hpwb-production-metrics{grid-template-columns:repeat(2,minmax(140px,1fr))}}
    @media(max-width:680px){.hpwb-production-metrics{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function issuePreview(message) {
  return { ok: false, issues: [{ message }], summary: { governedCycles: 0, parsedRows: 0 }, delimiter: null };
}

function previewHtml(preview) {
  if (!preview) return '';
  if (preview.ok) {
    return `<div class="hpwb-notice good"><strong>Bulk table valid.</strong> ${preview.summary.parsedRows} / ${preview.summary.governedCycles} governed cycles matched · ${esc(preview.delimiter)}.</div>`;
  }
  return `<div class="hpwb-notice error"><strong>Bulk table blocked.</strong><ul>${(preview.issues ?? []).slice(0, 8).map((item) => `<li>${esc(item.message)}</li>`).join('')}</ul></div>`;
}

function editorHtml(evidenceIndex, state) {
  const header = HP_PIPING_CLASS_KD_BULK_HEADERS.join(',');
  return `<summary>Paste / import Seq-N table</summary>
    <span class="hpwb-muted">Complete governed cycle set only. CSV or tab-separated input. Audit basis stays separate.</span>
    <span class="hpwb-bulk-contract">${esc(header)}</span>
    <textarea class="hpwb-bulk-input" data-hpwb-kd-bulk="${evidenceIndex}" spellcheck="false" placeholder="${esc(header)}\nCYCLE-1,NOZZLE-A,63.2995,75.0,100000">${esc(state?.text ?? '')}</textarea>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">Validation is fail-closed before working values are written.</span><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-kd-bulk-action="load" data-evidence-index="${evidenceIndex}" type="button">Load CSV / TSV</button><button class="hpwb-button" data-hpwb-kd-bulk-action="validate" data-evidence-index="${evidenceIndex}" type="button">Validate table</button><button class="hpwb-button primary" data-hpwb-kd-bulk-action="apply" data-evidence-index="${evidenceIndex}" type="button">Apply + calculate</button></div></div>
    <input class="hpwb-hidden" data-hpwb-kd-bulk-file="${evidenceIndex}" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain">
    <div data-hpwb-kd-bulk-preview>${previewHtml(state?.preview)}</div>`;
}

function packageCard(container, evidenceIndex) {
  const remove = container.querySelector(`[data-hpwb-action="remove-evidence"][data-evidence-index="${evidenceIndex}"]`);
  return remove?.closest('.hpwb-card') ?? null;
}

function currentRows(container, evidenceIndex) {
  const card = packageCard(container, evidenceIndex);
  const rows = [...(card?.querySelectorAll('table.hpwb-table.compact tbody tr') ?? [])];
  return rows.map((row) => ({
    cycleId: row.querySelector('td strong')?.textContent?.trim() ?? '',
    row,
  }));
}

function rowIntegrity(project, evidenceIndex) {
  const pkg = project?.fatigueEvidence?.[evidenceIndex];
  if (!pkg) return { ok: false, message: 'Selected KD review product no longer exists.' };
  const governed = new Set((project.transient?.transitions ?? []).map((row) => String(row?.cycleId ?? '').trim()).filter(Boolean));
  const seen = new Set();
  for (const row of pkg.externalResults ?? []) {
    const cycleId = String(row?.cycleId ?? '').trim();
    if (!governed.has(cycleId)) return { ok: false, message: `Existing KD row ${cycleId || '(blank)'} is not a governed cycle.` };
    if (seen.has(cycleId)) return { ok: false, message: `Existing KD row ${cycleId} is duplicated.` };
    seen.add(cycleId);
  }
  return { ok: true, missing: [...governed].filter((cycleId) => !seen.has(cycleId)) };
}

function setInput(input, value) {
  input.value = value == null ? '' : String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function assignmentsForRows(container, evidenceIndex, preview) {
  const byCycle = new Map(currentRows(container, evidenceIndex).map((entry) => [entry.cycleId, entry.row]));
  const assignments = [];
  for (const item of preview.rows) {
    const row = byCycle.get(item.cycleId);
    if (!row) return { ok: false, message: `KD working row ${item.cycleId} is unavailable after governed-row creation.` };
    const fields = {
      locationId: row.querySelector('input[data-hpwb-bind$=".locationId"]'),
      userSalt: row.querySelector('input[data-hpwb-bind$=".userAlternatingStressIntensityMpa"]'),
      seq: row.querySelector('input[data-hpwb-bind$=".equivalentAlternatingStressMpa"]'),
      permissible: row.querySelector('input[data-hpwb-bind$=".permissibleCycles"]'),
    };
    if (Object.values(fields).some((input) => !input)) return { ok: false, message: `KD working row ${item.cycleId} is missing an editable bulk field.` };
    assignments.push(
      [fields.locationId, item.locationId],
      [fields.userSalt, item.userAlternatingStressIntensityMpa],
      [fields.seq, item.equivalentAlternatingStressMpa],
      [fields.permissible, item.permissibleCycles],
    );
  }
  return { ok: true, assignments };
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function resultFilename(project, extension) {
  const safe = (value, fallback) => String(value || fallback).replace(/[^a-z0-9_-]+/gi, '-');
  const classId = safe(project?.metadata?.classId, 'hp-piping-class');
  const revision = safe(project?.metadata?.revision, 'draft');
  return `${classId}-${revision}.hp-review-results.${extension}`;
}

export function renderHpPipingClassWorkbenchTab(container, options = {}) {
  ensureBulkStyles();
  const drafts = new Map();
  let contextProject = options?.context?.hpPipingClassProject ?? null;
  let latestReview = null;
  const resultView = { filter: 'all', sortBy: 'reviewPriority', roundTrip: null };
  const destroyBase = renderBaseWorkbench(container, options);

  function currentProject() {
    return contextProject
      ? parseHpPipingClassWorkspaceProject(JSON.stringify(contextProject))
      : readProject();
  }

  function clearReview() {
    latestReview = null;
    resultView.roundTrip = null;
  }

  function refreshLatestReview() {
    try {
      const project = currentProject();
      const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
      latestReview = validation.ok
        ? evaluateHpPipingClassProject(project, { includeEvidence: true })
        : null;
      resultView.roundTrip = null;
    } catch {
      clearReview();
    }
    return latestReview;
  }

  function exportResult(kind) {
    if (!latestReview?.ok) return;
    const bundle = buildHpPipingClassResultExport(latestReview);
    const verified = verifyHpPipingClassResultRoundTrip(bundle);
    resultView.roundTrip = verified;
    injectProductionReview();
    if (!verified.ok) return;
    const project = currentProject();
    if (kind === 'csv') {
      downloadText(resultFilename(project, 'csv'), serializeHpPipingClassResultCsv(bundle), 'text/csv;charset=utf-8');
    } else {
      downloadText(resultFilename(project, 'json'), serializeHpPipingClassResultJson(bundle), 'application/json;charset=utf-8');
    }
  }

  function injectProductionReview() {
    const root = container.querySelector('.hpwb');
    const workflow = container.querySelector('[data-hpwb-workflow]');
    if (!root || !workflow) return;
    let project;
    try { project = currentProject(); } catch { return; }
    const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
    const readinessHtml = renderHpPipingClassProductionReadinessHtml(validation);
    let readiness = root.querySelector('[data-hpwb-production-readiness]');
    if (!readiness) {
      readiness = document.createElement('div');
      readiness.className = 'hpwb-production-readiness';
      readiness.dataset.hpwbProductionReadiness = 'true';
      workflow.before(readiness);
    }
    if (readiness.innerHTML !== readinessHtml) readiness.innerHTML = readinessHtml;

    const panel = container.querySelector('.hpwb-panel');
    const isEnvelope = panel?.querySelector('.hpwb-panel-heading h3')?.textContent?.trim() === 'Review Envelope';
    let detail = panel?.querySelector('[data-hpwb-production-results]') ?? null;
    if (!isEnvelope || !latestReview) {
      detail?.remove();
      return;
    }
    const resultHtml = renderHpPipingClassProductionResultHtml(latestReview, resultView);
    if (!detail) {
      detail = document.createElement('div');
      detail.dataset.hpwbProductionResults = 'true';
      panel.querySelector('.hpwb-foot-actions')?.before(detail);
    }
    if (detail.innerHTML !== resultHtml) detail.innerHTML = resultHtml;
  }

  function setPreview(evidenceIndex, text, preview) {
    drafts.set(evidenceIndex, { text, preview });
    const editor = container.querySelector(`[data-hpwb-kd-bulk-editor="${evidenceIndex}"]`);
    if (editor) {
      editor.open = true;
      const area = editor.querySelector('[data-hpwb-kd-bulk]');
      if (area && area.value !== text) area.value = text;
      const target = editor.querySelector('[data-hpwb-kd-bulk-preview]');
      if (target) target.innerHTML = previewHtml(preview);
    }
  }

  function validate(evidenceIndex, text) {
    try {
      const preview = previewHpPipingClassKdBulkInput(currentProject(), evidenceIndex, text);
      setPreview(evidenceIndex, text, preview);
      return preview;
    } catch (error) {
      const preview = issuePreview(error.message);
      setPreview(evidenceIndex, text, preview);
      return preview;
    }
  }

  function injectEditors() {
    container.querySelectorAll('[data-hpwb-action="remove-evidence"][data-evidence-index]').forEach((button) => {
      const evidenceIndex = Number(button.dataset.evidenceIndex);
      const card = button.closest('.hpwb-card');
      if (!card || card.querySelector(`[data-hpwb-kd-bulk-editor="${evidenceIndex}"]`)) return;
      const editor = document.createElement('details');
      editor.className = 'hpwb-details';
      editor.dataset.hpwbKdBulkEditor = String(evidenceIndex);
      const state = drafts.get(evidenceIndex);
      if (state?.preview) editor.open = true;
      editor.innerHTML = editorHtml(evidenceIndex, state);
      card.querySelector('.hpwb-section-toolbar')?.after(editor);
    });
    injectProductionReview();
  }

  function apply(evidenceIndex, text) {
    const project = currentProject();
    const preview = previewHpPipingClassKdBulkInput(project, evidenceIndex, text);
    if (!preview.ok) { setPreview(evidenceIndex, text, preview); return; }
    const integrity = rowIntegrity(project, evidenceIndex);
    if (!integrity.ok) { setPreview(evidenceIndex, text, issuePreview(integrity.message)); return; }
    if (integrity.missing.length) {
      packageCard(container, evidenceIndex)?.querySelector('[data-hpwb-action="add-all-external-results"]')?.click();
    }
    const mapped = assignmentsForRows(container, evidenceIndex, preview);
    if (!mapped.ok) { setPreview(evidenceIndex, text, issuePreview(mapped.message)); return; }
    mapped.assignments.forEach(([input, value]) => setInput(input, value));
    drafts.delete(evidenceIndex);
    container.querySelector('[data-hpwb-action="calculate"]')?.click();
  }

  async function loadFile(file, evidenceIndex) {
    try {
      const text = await file.text();
      validate(evidenceIndex, text);
    } catch (error) {
      setPreview(evidenceIndex, '', issuePreview(error.message));
    }
  }

  function onInput(event) {
    const area = event.target.closest('[data-hpwb-kd-bulk]');
    if (area) {
      drafts.set(Number(area.dataset.hpwbKdBulk), { text: area.value, preview: null });
      return;
    }
    if (event.target.closest('[data-hpwb-bind]')) {
      contextProject = null;
      clearReview();
      queueMicrotask(injectProductionReview);
    }
  }

  function onClick(event) {
    const resultAction = event.target.closest('[data-hpwb-result-action]')?.dataset.hpwbResultAction;
    if (resultAction) {
      if (!latestReview?.ok) return;
      if (resultAction === 'verify-roundtrip') {
        resultView.roundTrip = verifyHpPipingClassResultRoundTrip(buildHpPipingClassResultExport(latestReview));
        injectProductionReview();
      } else if (resultAction === 'export-csv') exportResult('csv');
      else if (resultAction === 'export-json') exportResult('json');
      return;
    }

    const target = event.target.closest('[data-hpwb-kd-bulk-action]');
    if (!target) {
      const baseAction = event.target.closest('[data-hpwb-action]')?.dataset.hpwbAction;
      if (['remove-product', 'remove-evidence', 'load-sample', 'new-project'].includes(baseAction)) drafts.clear();
      if (['add-product', 'remove-product', 'add-state', 'remove-state', 'add-transition', 'remove-transition', 'add-evidence', 'remove-evidence', 'add-external-result', 'add-all-external-results', 'copy-external-basis', 'remove-external-result', 'load-sample', 'new-project'].includes(baseAction)) {
        contextProject = null;
        clearReview();
      }
      if (baseAction === 'calculate' || baseAction === 'load-sample') {
        if (baseAction === 'load-sample') contextProject = null;
        refreshLatestReview();
      }
      queueMicrotask(injectProductionReview);
      return;
    }
    const evidenceIndex = Number(target.dataset.evidenceIndex);
    const area = container.querySelector(`[data-hpwb-kd-bulk="${evidenceIndex}"]`);
    const text = area?.value ?? drafts.get(evidenceIndex)?.text ?? '';
    if (target.dataset.hpwbKdBulkAction === 'load') {
      container.querySelector(`[data-hpwb-kd-bulk-file="${evidenceIndex}"]`)?.click();
    } else if (target.dataset.hpwbKdBulkAction === 'validate') validate(evidenceIndex, text);
    else if (target.dataset.hpwbKdBulkAction === 'apply') apply(evidenceIndex, text);
  }

  function onChange(event) {
    if (event.target.matches('[data-hpwb-result-filter]')) {
      resultView.filter = event.target.value;
      injectProductionReview();
      return;
    }
    if (event.target.matches('[data-hpwb-result-sort]')) {
      resultView.sortBy = event.target.value;
      injectProductionReview();
      return;
    }
    if (event.target.matches('[data-hpwb-file]') && event.target.files?.[0]) {
      contextProject = null;
      clearReview();
    }
    const input = event.target.closest('[data-hpwb-kd-bulk-file]');
    if (!input?.files?.[0]) return;
    const evidenceIndex = Number(input.dataset.hpwbKdBulkFile);
    loadFile(input.files[0], evidenceIndex).finally(() => { input.value = ''; });
  }

  try {
    if (currentProject()?.metadata?.referenceSampleId) refreshLatestReview();
  } catch {}

  const observer = new MutationObserver(injectEditors);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('input', onInput);
  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  injectEditors();

  return () => {
    observer.disconnect();
    container.removeEventListener('input', onInput);
    container.removeEventListener('click', onClick);
    container.removeEventListener('change', onChange);
    destroyBase?.();
  };
}
