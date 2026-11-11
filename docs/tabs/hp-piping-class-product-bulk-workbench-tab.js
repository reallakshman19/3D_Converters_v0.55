import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
  serializeHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { renderHpPipingClassWorkbenchTab as renderKdWorkbench } from './hp-piping-class-kd-bulk-workbench-tab.js';
import {
  HP_PIPING_CLASS_PRODUCT_BULK_HEADERS,
  applyHpPipingClassProductBulkInput,
  previewHpPipingClassProductBulkInput,
} from './hp-piping-class-product-bulk-input.js';

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
  if (document.querySelector('style[data-hp-product-bulk-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.hpProductBulkStyle = 'true';
  style.textContent = `
    .hpwb-product-bulk{margin:8px 0 12px}.hpwb-product-bulk textarea{width:100%;min-height:180px;resize:vertical;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(2,6,23,.52);border:1px solid rgba(148,163,184,.23);border-radius:8px;padding:10px;line-height:1.45}
    .hpwb-product-bulk-contract{display:block;margin:6px 0;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#93c5fd;overflow-wrap:anywhere}.hpwb-product-bulk-preview-table{min-width:1180px}.hpwb-product-bulk-preview-table td,.hpwb-product-bulk-preview-table th{white-space:nowrap}.hpwb-product-bulk-nps{min-width:92px}
  `;
  document.head.appendChild(style);
}

function previewHtml(preview, applied = false) {
  if (!preview) return '<div class="hpwb-muted">Validate the matrix before applying it.</div>';
  if (!preview.ok) {
    return `<div class="hpwb-notice error"><strong>Product matrix blocked · ${preview.issues?.length ?? 0} issue(s).</strong><ul>${(preview.issues ?? []).slice(0, 12).map((item) => `<li><span class="hpwb-code">${esc(item.code)}</span> · ${esc(item.message)}</li>`).join('')}</ul></div>`;
  }
  const plan = preview.plan ?? {};
  const summary = preview.summary ?? {};
  const rows = preview.rows ?? [];
  return `<div class="hpwb-notice good"><strong>${applied ? 'Product matrix applied.' : 'Product matrix valid.'}</strong> ${summary.parsedRows ?? 0} direct product(s) · ${summary.governedProductsPreserved ?? 0} governed product(s) preserved · ${summary.removedDirectProducts ?? 0} existing direct product(s) removed.${applied ? ' Review calculation requested through the existing canonical workbench action.' : ''}</div>
    <div class="hpwb-notice"><strong>Class allowance custody:</strong> internal ${fmt(preview.classBasisPatch?.internalAllowanceMm)} mm · external ${fmt(preview.classBasisPatch?.externalAllowanceMm)} mm. These values are class-level and must be identical on every imported row. Design pressure remains the class-level field above and is not inferred from this table.</div>
    ${plan.removedFatigueProductIds?.length ? `<div class="hpwb-notice warn"><strong>Relational cleanup:</strong> fatigue package(s) removed with deleted direct products: ${esc(plan.removedFatigueProductIds.join(', '))}.</div>` : ''}
    <div class="hpwb-table-wrap"><table class="hpwb-table hpwb-product-bulk-preview-table"><thead><tr><th>Product</th><th>Nominal size</th><th>OD mm</th><th>S MPa</th><th>Nominal wall</th><th>Minus tol %</th><th>Min manufactured</th><th>Effective net</th><th>Fatigue wall basis</th><th>Projected EOL</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.productId)}</strong></td><td>${esc(row.nominalSize)}</td><td>${fmt(row.outsideDiameterMm)}</td><td>${fmt(row.allowableStressMpa)}</td><td>${fmt(row.nominalWallMm)}</td><td>${fmt(row.minusTolerancePct, 3)}</td><td>${fmt(row.minimumAsManufacturedWallMm)}</td><td><strong>${fmt(row.effectiveNetWallMm)}</strong></td><td>${esc(row.fatigueWallBasis)}</td><td>${fmt(row.projectedEndOfLifeWallMm)}</td></tr>`).join('')}</tbody></table></div>`;
}

function editorHtml(state) {
  const header = HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.join(',');
  return `<summary>Paste / import direct-input product matrix</summary>
    <p class="hpwb-muted">Bulk import owns direct engineering-input products only. Governed/master products remain read-only and are preserved. Matching fatigue packages are retained by exact product ID.</p>
    <span class="hpwb-product-bulk-contract">${esc(header)}</span>
    <textarea data-hpwb-product-bulk spellcheck="false" placeholder="${esc(header)}\nNPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,">${esc(state.text ?? '')}</textarea>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">Preview computes minimum-manufactured and effective-net wall before any project mutation.</span><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-product-bulk-action="load" type="button">Load CSV / TSV</button><button class="hpwb-button" data-hpwb-product-bulk-action="validate" type="button">Validate matrix</button><button class="hpwb-button primary" data-hpwb-product-bulk-action="apply" type="button">Apply + batch calculate</button></div></div>
    <input class="hpwb-hidden" data-hpwb-product-bulk-file type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain">
    <div data-hpwb-product-bulk-preview>${previewHtml(state.preview, state.applied)}</div>`;
}

function directProductTable(container) {
  const remove = container.querySelector('[data-hpwb-action="remove-product"]');
  return remove?.closest('table') ?? null;
}

function injectNominalSizeColumn(container, project) {
  const table = directProductTable(container);
  if (!table || table.dataset.hpwbNominalSizeColumn === 'true') return;
  const headerRow = table.querySelector('thead tr');
  const firstHeader = headerRow?.children?.[0];
  if (firstHeader) firstHeader.insertAdjacentHTML('afterend', '<th>Nominal size</th>');
  table.querySelectorAll('tbody tr').forEach((row) => {
    const remove = row.querySelector('[data-hpwb-action="remove-product"][data-index]');
    if (!remove) return;
    const index = Number(remove.dataset.index);
    const product = project?.products?.[index] ?? {};
    const firstCell = row.children?.[0];
    if (!firstCell) return;
    const cell = document.createElement('td');
    cell.className = 'hpwb-product-bulk-nps';
    cell.innerHTML = `<input data-hpwb-bind="products.${index}.nominalSize" data-hpwb-type="text" value="${esc(product.nominalSize ?? '')}" placeholder="NPS 4">`;
    firstCell.insertAdjacentElement('afterend', cell);
  });
  table.dataset.hpwbNominalSizeColumn = 'true';
}

function projectSignature(project) {
  return JSON.stringify({
    products: (project?.products ?? []).map((row) => [row.productId, row.calculationBasis?.mode, row.calculationBasis?.outsideDiameterMm, row.calculationBasis?.nominalWallMm]),
    internalAllowanceMm: project?.classBasis?.internalAllowanceMm,
    externalAllowanceMm: project?.classBasis?.externalAllowanceMm,
  });
}

async function waitForImportedProject(expected, timeoutMs = 3000) {
  const expectedSignature = projectSignature(expected);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = readStoredProject();
    if (current && projectSignature(current) === expectedSignature) return current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for the existing HP project-import controller to accept the bulk matrix.');
}

export function renderHpPipingClassWorkbenchTab(container, options = {}) {
  ensureStyles();
  const destroyBase = renderKdWorkbench(container, options);
  let state = { text: '', preview: null, applied: false };
  let contextProject = cloneProject(options?.context?.hpPipingClassProject ?? null);

  function currentProject() {
    return contextProject ?? readStoredProject();
  }

  function setState(next) {
    state = { ...state, ...next };
    const editor = container.querySelector('[data-hpwb-product-bulk-editor]');
    if (!editor) return;
    editor.open = true;
    const area = editor.querySelector('[data-hpwb-product-bulk]');
    if (area && area.value !== state.text) area.value = state.text;
    const preview = editor.querySelector('[data-hpwb-product-bulk-preview]');
    if (preview) preview.innerHTML = previewHtml(state.preview, state.applied);
  }

  function validate(text) {
    try {
      const preview = previewHpPipingClassProductBulkInput(currentProject(), text);
      setState({ text, preview, applied: false });
      return preview;
    } catch (error) {
      const preview = { ok: false, issues: [{ code: 'PRODUCT_BULK_PREVIEW_FAILED', message: error.message }], rows: [], summary: {} };
      setState({ text, preview, applied: false });
      return preview;
    }
  }

  async function apply(text) {
    const project = currentProject();
    const result = applyHpPipingClassProductBulkInput(project, text);
    setState({ text, preview: result, applied: false });
    if (!result.ok || !result.applied) return;
    const input = container.querySelector('[data-hpwb-file]');
    if (!input || typeof DataTransfer === 'undefined' || typeof File === 'undefined') {
      setState({ preview: { ...result, ok: false, issues: [{ code: 'PRODUCT_BULK_IMPORT_BRIDGE_UNAVAILABLE', message: 'Browser file-import bridge is unavailable; project was not changed.' }] }, applied: false });
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([
      serializeHpPipingClassWorkspaceProject(result.project),
    ], 'hp-product-matrix-import.json', { type: 'application/json' }));
    input.files = transfer.files;
    contextProject = null;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForImportedProject(result.project);
    state = { text, preview: result, applied: true };
    inject();
    container.querySelector('[data-hpwb-action="calculate"]')?.click();
  }

  async function loadFile(file) {
    try {
      validate(await file.text());
    } catch (error) {
      setState({ text: '', preview: { ok: false, issues: [{ code: 'PRODUCT_BULK_FILE_READ_FAILED', message: error.message }], rows: [], summary: {} }, applied: false });
    }
  }

  function inject() {
    const panel = container.querySelector('.hpwb-panel');
    const isDesign = panel?.querySelector('.hpwb-panel-heading h3')?.textContent?.trim() === 'Design Basis';
    if (!isDesign) return;
    const project = currentProject();
    injectNominalSizeColumn(container, project);
    if (panel.querySelector('[data-hpwb-product-bulk-editor]')) return;
    const addButton = panel.querySelector('[data-hpwb-action="add-product"]');
    const toolbar = addButton?.closest('.hpwb-section-toolbar');
    if (!toolbar) return;
    const editor = document.createElement('details');
    editor.className = 'hpwb-details hpwb-product-bulk';
    editor.dataset.hpwbProductBulkEditor = 'true';
    editor.open = Boolean(state.preview);
    editor.innerHTML = editorHtml(state);
    toolbar.after(editor);
  }

  function onInput(event) {
    const area = event.target.closest('[data-hpwb-product-bulk]');
    if (area) {
      state = { text: area.value, preview: null, applied: false };
      return;
    }
    if (event.target.closest('[data-hpwb-bind]')) {
      contextProject = null;
      if (state.preview) {
        state = { ...state, preview: null, applied: false };
        const target = container.querySelector('[data-hpwb-product-bulk-preview]');
        if (target) target.innerHTML = '<div class="hpwb-muted">Project inputs changed. Revalidate the product matrix before applying.</div>';
      }
    }
  }

  function onClick(event) {
    const action = event.target.closest('[data-hpwb-product-bulk-action]')?.dataset.hpwbProductBulkAction;
    if (action) {
      const text = container.querySelector('[data-hpwb-product-bulk]')?.value ?? state.text;
      if (action === 'load') container.querySelector('[data-hpwb-product-bulk-file]')?.click();
      else if (action === 'validate') validate(text);
      else if (action === 'apply') apply(text).catch((error) => setState({ preview: { ok: false, issues: [{ code: 'PRODUCT_BULK_APPLY_FAILED', message: error.message }], rows: [], summary: {} }, applied: false }));
      return;
    }
    const baseAction = event.target.closest('[data-hpwb-action]')?.dataset.hpwbAction;
    if (['load-sample', 'new-project', 'import-project'].includes(baseAction)) {
      contextProject = null;
      state = { text: '', preview: null, applied: false };
    }
  }

  function onChange(event) {
    const input = event.target.closest('[data-hpwb-product-bulk-file]');
    if (!input?.files?.[0]) return;
    loadFile(input.files[0]).finally(() => { input.value = ''; });
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
    destroyBase?.();
  };
}
