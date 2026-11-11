import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { validateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import {
  buildHpPipingClassEngineeringReviewReport,
  serializeHpPipingClassEngineeringReviewReportHtml,
  serializeHpPipingClassEngineeringReviewReportJson,
  verifyHpPipingClassEngineeringReviewReportRoundTrip,
} from './hp-piping-class-engineering-review-report.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function cloneProject(project) {
  return project == null ? null : parseHpPipingClassWorkspaceProject(JSON.stringify(project));
}

function readStoredProject() {
  const raw = globalThis.localStorage?.getItem(HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY);
  return raw ? parseHpPipingClassWorkspaceProject(raw) : null;
}

function safe(value, fallback) {
  return String(value || fallback).replace(/[^a-z0-9_-]+/gi, '-');
}

function filename(project, extension) {
  return `${safe(project?.metadata?.classId, 'hp-piping-class')}-${safe(project?.metadata?.revision, 'draft')}.hp-engineering-review.${extension}`;
}

function downloadText(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function setStatus(container, kind, message) {
  let target = container.querySelector('[data-hpwb-engineering-report-status]');
  const matrix = container.querySelector('[data-hpwb-class-result-matrix="true"]');
  if (!matrix) return;
  if (!target) {
    target = document.createElement('div');
    target.dataset.hpwbEngineeringReportStatus = 'true';
    matrix.querySelector('.hpwb-section-toolbar')?.after(target);
  }
  target.className = `hpwb-notice ${kind}`;
  target.innerHTML = message;
}

export function installHpPipingClassEngineeringReviewReportEnhancer(container, options = {}) {
  let contextProject = cloneProject(options?.context?.hpPipingClassProject ?? null);

  function currentProject() {
    const stored = readStoredProject();
    if (stored) return stored;
    if (contextProject) return cloneProject(contextProject);
    throw new Error('Current HP Piping Class project is not available in workspace storage or route context.');
  }

  function buildCurrentReport() {
    const project = currentProject();
    const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
    if (!validation.ok) {
      const error = new Error(`Current project has ${validation.issues?.length ?? 0} production-review validation blocker(s).`);
      error.code = 'HP_ENGINEERING_REPORT_PROJECT_BLOCKED';
      throw error;
    }
    const result = evaluateHpPipingClassProject(project, { includeEvidence: true });
    if (!result.ok) {
      const error = new Error(`Canonical HP review did not complete: ${result.projectState || 'CALCULATION_BLOCKED'}.`);
      error.code = 'HP_ENGINEERING_REPORT_CALCULATION_BLOCKED';
      throw error;
    }
    const report = buildHpPipingClassEngineeringReviewReport(project, result);
    const verified = verifyHpPipingClassEngineeringReviewReportRoundTrip(report);
    if (!verified.ok) {
      const error = new Error(`Engineering-review report JSON round trip failed${verified.error ? `: ${verified.error}` : '.'}`);
      error.code = 'HP_ENGINEERING_REPORT_ROUNDTRIP_FAILED';
      throw error;
    }
    return { project, report, verified };
  }

  function inject() {
    const matrix = container.querySelector('[data-hpwb-class-result-matrix="true"]');
    const actions = matrix?.querySelector('.hpwb-section-toolbar .hpwb-actions');
    if (!actions || actions.querySelector('[data-hpwb-engineering-report-action]')) return;
    const html = document.createElement('button');
    html.className = 'hpwb-button';
    html.type = 'button';
    html.dataset.hpwbEngineeringReportAction = 'html';
    html.textContent = 'Export review HTML';
    const json = document.createElement('button');
    json.className = 'hpwb-button';
    json.type = 'button';
    json.dataset.hpwbEngineeringReportAction = 'json';
    json.textContent = 'Export review JSON';
    actions.append(html, json);
  }

  function onInput(event) {
    if (event.target.closest('[data-hpwb-bind]')) contextProject = null;
  }

  function onChange(event) {
    if (event.target.matches('[data-hpwb-file]')) contextProject = null;
  }

  function onClick(event) {
    const action = event.target.closest('[data-hpwb-engineering-report-action]')?.dataset.hpwbEngineeringReportAction;
    if (!action) return;
    try {
      const { project, report, verified } = buildCurrentReport();
      if (action === 'html') {
        downloadText(filename(project, 'html'), serializeHpPipingClassEngineeringReviewReportHtml(report), 'text/html;charset=utf-8');
      } else if (action === 'json') {
        downloadText(filename(project, 'json'), serializeHpPipingClassEngineeringReviewReportJson(report), 'application/json;charset=utf-8');
      }
      setStatus(container, 'good', `<strong>Engineering-review report verified.</strong> JSON round trip PASS · ${verified.productCount} product(s) · ${verified.cycleCount} cycle row(s) · ${verified.custodyRowCount} external KD custody row(s). <span class="hpwb-muted">REVIEW ONLY · NO DESIGN AUTHORITY.</span>`);
    } catch (error) {
      setStatus(container, 'error', `<strong>Engineering-review report blocked.</strong> <span class="hpwb-code">${esc(error.code || 'HP_ENGINEERING_REPORT_BLOCKED')}</span> · ${esc(error.message)}`);
    }
  }

  const observer = new MutationObserver(inject);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  container.addEventListener('click', onClick);
  inject();
  return () => {
    observer.disconnect();
    container.removeEventListener('input', onInput);
    container.removeEventListener('change', onChange);
    container.removeEventListener('click', onClick);
  };
}
