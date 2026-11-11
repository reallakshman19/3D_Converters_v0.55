import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
  serializeHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION } from './hp-piping-class-intake-package.js';
import {
  applyHpPipingClassIntakePackageForReview,
  previewHpPipingClassIntakePackageForReview,
} from './hp-piping-class-intake-package-review.js';
import {
  buildHpPipingClassIntakePackageExport,
  compareHpPipingClassIntakeReplacement,
} from './hp-piping-class-intake-package-roundtrip.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function readStoredProject() {
  const raw = globalThis.localStorage?.getItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY);
  return raw ? parseHpPipingClassWorkspaceProject(raw) : null;
}

function signature(project) {
  return JSON.stringify({
    metadata: project?.metadata ?? {},
    classBasis: project?.classBasis ?? {},
    products: (project?.products ?? []).map((row) => [row.productId, row.nominalSize, row.calculationBasis, row.wallState]),
    spectrum: project?.transient?.spectrum ?? null,
    states: (project?.transient?.states ?? []).map((row) => [row.stateId, row.pressureMpa, row.materialTemperatureC, row.structuralTemperatureC]),
    cycles: (project?.transient?.transitions ?? []).map((row) => [row.cycleId, row.fromStateId, row.toStateId, row.totalCycles, row.cyclesPerYear ?? null, row.category ?? '', row.provenanceId ?? null]),
    evidence: (project?.fatigueEvidence ?? []).map((pkg) => [pkg.productId, (pkg.externalResults ?? []).map((row) => [row.cycleId, row.locationId, row.userAlternatingStressIntensityMpa ?? null, row.equivalentAlternatingStressMpa, row.permissibleCycles ?? null])]),
  });
}

async function waitForImportedProject(expected, timeoutMs = 3000) {
  const expectedSignature = signature(expected);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = readStoredProject();
    if (current && signature(current) === expectedSignature) return current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for the existing HP workspace controller to accept the class intake package.');
}

function ensureStyles() {
  if (document.querySelector('style[data-hp-intake-package-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.hpIntakePackageStyle = 'true';
  style.textContent = `
    .hpwb-intake-package{margin:10px 0 14px}.hpwb-intake-package textarea{width:100%;min-height:180px;resize:vertical;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(2,6,23,.52);border:1px solid rgba(148,163,184,.23);border-radius:8px;padding:10px;line-height:1.45}.hpwb-intake-package-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin:10px 0}.hpwb-intake-package-summary>div{border:1px solid rgba(148,163,184,.15);border-radius:9px;padding:8px}.hpwb-intake-package-summary span{display:block;font-size:10px;color:var(--text-muted,#9aa8b8)}.hpwb-intake-package-summary strong{display:block;margin-top:3px}.hpwb-intake-impact-table{min-width:920px}.hpwb-intake-impact-table td,.hpwb-intake-impact-table th{white-space:nowrap}@media(max-width:760px){.hpwb-intake-package-summary{grid-template-columns:repeat(2,minmax(120px,1fr))}}
  `;
  document.head.appendChild(style);
}

function impactHtml(impact) {
  if (!impact) return '';
  if (!impact.changed) return '<div class="hpwb-notice good"><strong>Replacement impact:</strong> no package-owned engineering-input changes versus the current workspace.</div>';
  const s = impact.summary ?? {};
  const tone = impact.highImpact ? 'warn' : '';
  return `<div class="hpwb-notice ${tone}"><strong>Replacement impact · ${s.totalChanges ?? 0} change(s).</strong> Structure ${s.STRUCTURE ?? 0} · method basis ${s.METHOD_BASIS ?? 0} · stress basis ${s.STRESS_BASIS ?? 0} · fatigue basis ${s.FATIGUE_BASIS ?? 0} · damage basis ${s.DAMAGE_BASIS ?? 0} · identity ${s.IDENTITY ?? 0} · custody ${s.CUSTODY ?? 0}.${impact.highImpact ? ' Re-check the highlighted engineering basis before Apply.' : ''}</div>
    <div class="hpwb-table-wrap"><table class="hpwb-table hpwb-intake-impact-table"><thead><tr><th>Impact</th><th>Domain</th><th>ID</th><th>Field</th><th>Current</th><th>Package</th></tr></thead><tbody>${(impact.changes ?? []).slice(0, 20).map((row) => `<tr><td><span class="hpwb-code">${esc(row.impact)}</span></td><td>${esc(row.domain)}</td><td>${esc(row.id)}</td><td>${esc(row.field)}</td><td>${esc(row.before)}</td><td>${esc(row.after)}</td></tr>`).join('')}</tbody></table></div>${(impact.changes ?? []).length > 20 ? `<div class="hpwb-muted">Showing first 20 of ${impact.changes.length} changes.</div>` : ''}`;
}

function previewHtml(preview, applied = false) {
  if (!preview) return '<div class="hpwb-muted">Load, paste, or export one class package, then validate it against the current workspace before applying.</div>';
  if (!preview.ok) {
    return `<div class="hpwb-notice error"><strong>Class package blocked · ${preview.issues?.length ?? 0} issue(s).</strong><ul>${(preview.issues ?? []).slice(0, 16).map((row) => `<li><span class="hpwb-code">${esc(row.code)}</span> · ${esc(row.message)}</li>`).join('')}</ul></div>`;
  }
  const s = preview.summary ?? {};
  return `<div class="hpwb-notice good"><strong>${applied ? 'Class package applied.' : 'Class package valid against the current workspace snapshot.'}</strong> ${esc(s.classId)} · revision ${esc(s.revision)} · spectrum ${esc(s.spectrumId)} · canonical state ${esc(s.canonicalProjectState)}.${applied ? ' Review calculation requested through the existing canonical workbench action.' : ''}</div>
    <div class="hpwb-intake-package-summary">
      <div><span>Products</span><strong>${s.products ?? 0}</strong></div><div><span>Operating states</span><strong>${s.states ?? 0}</strong></div>
      <div><span>Governed cycles</span><strong>${s.cycles ?? 0}</strong></div><div><span>KD products / rows</span><strong>${s.kdProducts ?? 0} / ${s.kdRows ?? 0}</strong></div>
      <div><span>Design pressure</span><strong>${Number.isFinite(s.designPressureMpa) ? `${s.designPressureMpa} MPa` : '—'}</strong></div>
      <div><span>Static reference fails</span><strong>${s.staticReferenceFailed ?? 0}</strong></div><div><span>Fatigue U &gt; 1</span><strong>${s.fatigueExceedsUnity ?? 0}</strong></div>
      <div><span>Authority</span><strong>REVIEW ONLY</strong></div>
    </div>${impactHtml(preview.impact)}
    ${(preview.advisories ?? []).length ? `<div class="hpwb-notice warn"><strong>${preview.advisories.length} advisory item(s).</strong> Advisories remain review-only and do not promote Code/design authority.</div>` : ''}`;
}

function editorHtml(state) {
  return `<summary>Single-file HP class intake package</summary>
    <p class="hpwb-muted">One ${esc(HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION)} JSON package delegates product, state/cycle and per-product KD rows to the existing bulk validators, then runs the assembled project through the canonical HP orchestrator before admission. Authority fields are forbidden in the package.</p>
    <div class="hpwb-notice warn"><strong>Replacement import:</strong> Apply replaces the current HP Piping Class workspace project with the package project. It is not a merge or patch operation. Apply is enabled logically only after validation against the unchanged current workspace snapshot.</div>
    <textarea data-hpwb-intake-package-text spellcheck="false" placeholder='{"schemaVersion":"${esc(HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION)}", ...}'>${esc(state.text ?? '')}</textarea>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">Editable-package export is lossless only for the v1 representable surface. Governed basis packages or external KD calculation-basis custody fail closed instead of being silently discarded.</span><div class="hpwb-actions"><button class="hpwb-button" data-hpwb-intake-package-action="export" type="button">Export editable package</button><button class="hpwb-button" data-hpwb-intake-package-action="load" type="button">Load package JSON</button><button class="hpwb-button" data-hpwb-intake-package-action="validate" type="button">Validate + compare</button><button class="hpwb-button primary" data-hpwb-intake-package-action="apply" type="button">Apply + calculate</button></div></div>
    <input class="hpwb-hidden" data-hpwb-intake-package-file type="file" accept="application/json,.json"><div data-hpwb-intake-package-preview>${previewHtml(state.preview, state.applied)}</div>`;
}

function downloadText(textValue, project) {
  const classId = String(project?.metadata?.classId || 'hp-class').replace(/[^a-z0-9_-]+/gi, '-');
  const revision = String(project?.metadata?.revision || 'draft').replace(/[^a-z0-9_-]+/gi, '-');
  const blob = new Blob([textValue], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${classId}-${revision}.hp-intake-package.json`; link.click(); URL.revokeObjectURL(url);
}

export function installHpPipingClassIntakePackageEnhancer(container) {
  ensureStyles();
  let state = { text: '', preview: null, applied: false, validatedText: null, validatedCurrentSignature: null };

  function setState(next) {
    state = { ...state, ...next };
    const editor = container.querySelector('[data-hpwb-intake-package-editor]');
    if (!editor) return;
    editor.open = true;
    const area = editor.querySelector('[data-hpwb-intake-package-text]');
    if (area && area.value !== state.text) area.value = state.text;
    const target = editor.querySelector('[data-hpwb-intake-package-preview]');
    if (target) target.innerHTML = previewHtml(state.preview, state.applied);
  }

  function validate(textValue = state.text) {
    const current = readStoredProject();
    let preview = previewHpPipingClassIntakePackageForReview(textValue);
    if (preview.ok) preview = { ...preview, impact: compareHpPipingClassIntakeReplacement(current, preview.project) };
    setState({ text: textValue, preview, applied: false, validatedText: preview.ok ? textValue : null, validatedCurrentSignature: preview.ok ? signature(current) : null });
    return preview;
  }

  async function apply(textValue = state.text) {
    const currentSignature = signature(readStoredProject());
    if (!state.preview?.ok || state.validatedText !== textValue || state.validatedCurrentSignature !== currentSignature) {
      setState({ preview: { ok: false, issues: [{ code: 'INTAKE_PACKAGE_REVALIDATION_REQUIRED', message: 'Validate + compare this exact package against the unchanged current workspace before Apply.' }], summary: {} }, applied: false, validatedText: null, validatedCurrentSignature: null });
      return;
    }
    let result = applyHpPipingClassIntakePackageForReview(textValue);
    if (result.ok) result = { ...result, impact: compareHpPipingClassIntakeReplacement(readStoredProject(), result.project) };
    setState({ text: textValue, preview: result, applied: false });
    if (!result.ok || !result.applied) return;
    const projectInput = container.querySelector('[data-hpwb-file]');
    if (!projectInput || typeof DataTransfer === 'undefined' || typeof File === 'undefined') {
      setState({ preview: { ...result, ok: false, issues: [{ code: 'INTAKE_PACKAGE_IMPORT_BRIDGE_UNAVAILABLE', message: 'Browser file-import bridge is unavailable; project was not changed.' }] }, applied: false });
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([serializeHpPipingClassWorkspaceProject(result.project)], 'hp-class-intake-import.json', { type: 'application/json' }));
    projectInput.files = transfer.files;
    projectInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForImportedProject(result.project);
    state = { ...state, text: textValue, preview: result, applied: true, validatedCurrentSignature: signature(result.project) };
    inject(); setState(state);
    container.querySelector('[data-hpwb-action="calculate"]')?.click();
  }

  function exportCurrent() {
    const current = readStoredProject();
    const built = buildHpPipingClassIntakePackageExport(current);
    if (!built.ok) {
      setState({ preview: { ok: false, issues: built.issues ?? [], summary: {} }, applied: false, validatedText: null, validatedCurrentSignature: null });
      return;
    }
    const preview = validate(built.serialized);
    if (preview.ok) downloadText(built.serialized, current);
  }

  async function loadFile(file) {
    try { validate(await file.text()); }
    catch (error) { setState({ text: '', preview: { ok: false, issues: [{ code: 'INTAKE_PACKAGE_FILE_READ_FAILED', message: error.message }], summary: {} }, applied: false, validatedText: null, validatedCurrentSignature: null }); }
  }

  function inject() {
    const workbench = container.querySelector('[data-hp-piping-class-workbench="true"]');
    if (!workbench || workbench.querySelector('[data-hpwb-intake-package-editor]')) return;
    const toolbar = workbench.querySelector('.hpwb-toolbar');
    if (!toolbar) return;
    const editor = document.createElement('details');
    editor.className = 'hpwb-details hpwb-intake-package';
    editor.dataset.hpwbIntakePackageEditor = 'true';
    editor.open = Boolean(state.preview);
    editor.innerHTML = editorHtml(state);
    toolbar.after(editor);
  }

  function invalidateComparison(message = 'Workspace changed. Validate + compare the package again before Apply.') {
    state = { ...state, preview: null, applied: false, validatedText: null, validatedCurrentSignature: null };
    const target = container.querySelector('[data-hpwb-intake-package-preview]');
    if (target) target.innerHTML = `<div class="hpwb-muted">${esc(message)}</div>`;
  }

  function onInput(event) {
    const area = event.target.closest('[data-hpwb-intake-package-text]');
    if (area) state = { ...state, text: area.value, preview: null, applied: false, validatedText: null, validatedCurrentSignature: null };
    else if (event.target.closest('[data-hpwb-bind]')) invalidateComparison();
  }

  function onClick(event) {
    const action = event.target.closest('[data-hpwb-intake-package-action]')?.dataset.hpwbIntakePackageAction;
    if (action) {
      const textValue = container.querySelector('[data-hpwb-intake-package-text]')?.value ?? state.text;
      if (action === 'export') exportCurrent();
      else if (action === 'load') container.querySelector('[data-hpwb-intake-package-file]')?.click();
      else if (action === 'validate') validate(textValue);
      else if (action === 'apply') apply(textValue).catch((error) => setState({ preview: { ok: false, issues: [{ code: 'INTAKE_PACKAGE_APPLY_FAILED', message: error.message }], summary: {} }, applied: false, validatedText: null, validatedCurrentSignature: null }));
      return;
    }
    const baseAction = event.target.closest('[data-hpwb-action]')?.dataset.hpwbAction;
    if (baseAction && !['calculate', 'export-project'].includes(baseAction)) invalidateComparison();
  }

  function onChange(event) {
    const input = event.target.closest('[data-hpwb-intake-package-file]');
    if (!input?.files?.[0]) return;
    loadFile(input.files[0]).finally(() => { input.value = ''; });
  }

  const observer = new MutationObserver(inject);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('input', onInput); container.addEventListener('click', onClick); container.addEventListener('change', onChange); inject();
  return () => { observer.disconnect(); container.removeEventListener('input', onInput); container.removeEventListener('click', onClick); container.removeEventListener('change', onChange); };
}
