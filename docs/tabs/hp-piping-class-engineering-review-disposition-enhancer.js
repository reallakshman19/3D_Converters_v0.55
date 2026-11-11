import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { validateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import { buildHpPipingClassEngineeringReviewReport } from './hp-piping-class-engineering-review-report.js';
import {
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION,
  HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION,
  appendHpPipingClassReviewDisposition,
  buildHpPipingClassReviewDispositionPackage,
  createHpPipingClassReviewDispositionLedger,
  parseHpPipingClassReviewDispositionLedger,
  serializeHpPipingClassReviewDispositionPackageJson,
  summarizeHpPipingClassReviewDisposition,
  verifyHpPipingClassReviewDispositionPackage,
} from './hp-piping-class-engineering-review-disposition.js';

export const HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY = 'format-converters.hpPipingClassEngineeringReviewDisposition.v2';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_LEGACY_STORAGE_KEY = 'format-converters.hpPipingClassEngineeringReviewDisposition.v1';

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

export function readHpPipingClassReviewDispositionLedgerFromStorage(storage = globalThis.localStorage) {
  const currentRaw = storage?.getItem(HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY);
  const legacyRaw = storage?.getItem(HP_PIPING_CLASS_REVIEW_DISPOSITION_LEGACY_STORAGE_KEY);
  if (currentRaw && legacyRaw) {
    throw new Error('Both v1 and v2 HP review custody stores exist. Resolve custody explicitly before recording another disposition.');
  }
  if (currentRaw) {
    const ledger = parseHpPipingClassReviewDispositionLedger(currentRaw);
    if (ledger.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION) {
      throw new Error('The v2 HP review custody storage key contains a non-v2 ledger.');
    }
    return ledger;
  }
  if (legacyRaw) {
    const ledger = parseHpPipingClassReviewDispositionLedger(legacyRaw);
    if (ledger.schemaVersion !== HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_V1_VERSION) {
      throw new Error('The legacy HP review custody storage key contains a non-v1 ledger.');
    }
    return ledger;
  }
  return createHpPipingClassReviewDispositionLedger();
}

export function writeHpPipingClassReviewDispositionLedgerToStorage(ledgerValue, storage = globalThis.localStorage) {
  const ledger = parseHpPipingClassReviewDispositionLedger(ledgerValue);
  const key = ledger.schemaVersion === HP_PIPING_CLASS_REVIEW_DISPOSITION_LEDGER_VERSION
    ? HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY
    : HP_PIPING_CLASS_REVIEW_DISPOSITION_LEGACY_STORAGE_KEY;
  storage?.setItem(key, JSON.stringify(ledger));
  return key;
}

function readLedger() {
  return readHpPipingClassReviewDispositionLedgerFromStorage();
}

function writeLedger(ledger) {
  writeHpPipingClassReviewDispositionLedgerToStorage(ledger);
}

function safe(value, fallback) {
  return String(value || fallback).replace(/[^a-z0-9_-]+/gi, '-');
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

function filename(project) {
  return `${safe(project?.metadata?.classId, 'hp-piping-class')}-${safe(project?.metadata?.revision, 'draft')}.hp-review-disposition.json`;
}

function cardHtml() {
  return `<section class="hpwb-card hpwb-review-disposition" data-hpwb-review-disposition="true">
    <div class="hpwb-section-toolbar"><div><h4>Engineering review disposition</h4><p>Append-only custody bound to the exact SHA-256 of the canonical review report. New custody uses a tamper-evident v2 SHA-256 entry chain.</p></div><span class="hpwb-badge warn">REVIEW CUSTODY ONLY</span></div>
    <div class="hpwb-notice warn"><strong>Identity boundary:</strong> reviewer/checker names are user-declared. The report hash and v2 entry chain provide content self-consistency/tamper evidence only; this is not a digital signature, trusted timestamp, PKI identity, Code approval, design approval, or release authorization.</div>
    <div data-hpwb-review-disposition-summary class="hpwb-muted">Resolving current report binding…</div>
    <div class="hpwb-grid two" style="margin-top:10px">
      <label class="hpwb-field"><span>Reviewer / checker identity</span><input data-hpwb-review-disposition-actor type="text" placeholder="ENGINEER_B"></label>
      <label class="hpwb-field"><span>Role</span><select data-hpwb-review-disposition-role><option value="CHECKER">Checker</option><option value="REVIEWER">Reviewer</option></select></label>
    </div>
    <label class="hpwb-field" style="margin-top:10px"><span>Disposition</span><select data-hpwb-review-disposition-value>
      <option value="NO_OBJECTION_FOR_ENGINEERING_REVIEW">No objection for engineering review</option>
      <option value="COMMENTS_RECORDED">Comments recorded</option>
      <option value="REJECTED_FOR_ENGINEERING_REVIEW">Rejected for engineering review</option>
    </select></label>
    <label class="hpwb-field" style="margin-top:10px"><span>Comment</span><textarea data-hpwb-review-disposition-comment class="hpwb-bulk-input" style="min-height:88px" placeholder="Required for comments/rejection; optional for no-objection."></textarea></label>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">Records cannot be edited or deleted here. A changed report receives a new hash and prior records become historical.</span><div class="hpwb-actions"><button class="hpwb-button primary" data-hpwb-review-disposition-action="record" type="button">Record disposition</button><button class="hpwb-button" data-hpwb-review-disposition-action="export" type="button">Export review package JSON</button></div></div>
    <div data-hpwb-review-disposition-status></div>
  </section>`;
}

function summaryHtml(summary) {
  const digest = summary.reportSha256 ? `${summary.reportSha256.slice(0, 16)}…` : '—';
  const current = summary.currentDisposition === 'PENDING_REVIEW' ? 'PENDING REVIEW' : summary.currentDisposition;
  const actor = summary.currentActor ? ` · ${esc(summary.currentRole)} ${esc(summary.currentActor)}` : '';
  return `<div class="hpwb-notice ${summary.currentDisposition === 'REJECTED_FOR_ENGINEERING_REVIEW' ? 'error' : summary.currentDisposition === 'PENDING_REVIEW' ? 'warn' : 'good'}"><strong>${esc(current)}</strong>${actor}<br><span class="hpwb-code">report SHA-256 ${esc(digest)}</span> · ${summary.currentRecordCount} current record(s) · ${summary.historicalRecordCount} historical record(s).</div>`;
}

function setStatus(card, kind, message) {
  const target = card?.querySelector('[data-hpwb-review-disposition-status]');
  if (!target) return;
  target.className = `hpwb-notice ${kind}`;
  target.innerHTML = message;
}

export function installHpPipingClassEngineeringReviewDispositionEnhancer(container, options = {}) {
  let contextProject = cloneProject(options?.context?.hpPipingClassProject ?? null);
  let refreshToken = 0;

  function currentProject() {
    return readStoredProject() ?? contextProject;
  }

  function currentReport() {
    const project = currentProject();
    if (!project) throw new Error('Current HP Piping Class project is unavailable.');
    const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
    if (!validation.ok) throw new Error(`Current project has ${validation.issues?.length ?? 0} production-review blocker(s).`);
    const result = evaluateHpPipingClassProject(project, { includeEvidence: true });
    if (!result.ok) throw new Error(`Canonical HP review did not complete: ${result.projectState || 'CALCULATION_BLOCKED'}.`);
    return { project, report: buildHpPipingClassEngineeringReviewReport(project, result) };
  }

  async function refresh() {
    const token = ++refreshToken;
    const card = container.querySelector('[data-hpwb-review-disposition="true"]');
    if (!card) return;
    try {
      const { report } = currentReport();
      const summary = await summarizeHpPipingClassReviewDisposition(readLedger(), report);
      if (token !== refreshToken) return;
      const target = card.querySelector('[data-hpwb-review-disposition-summary]');
      if (target) target.innerHTML = summaryHtml(summary);
    } catch (error) {
      if (token !== refreshToken) return;
      const target = card.querySelector('[data-hpwb-review-disposition-summary]');
      if (target) target.innerHTML = `<div class="hpwb-notice error"><strong>Review disposition unavailable.</strong> ${esc(error.message)}</div>`;
    }
  }

  function inject() {
    const matrix = container.querySelector('[data-hpwb-class-result-matrix="true"]');
    if (!matrix || container.querySelector('[data-hpwb-review-disposition="true"]')) return;
    matrix.insertAdjacentHTML('afterend', cardHtml());
    refresh();
  }

  async function record(card) {
    const { report } = currentReport();
    const input = {
      actor: card.querySelector('[data-hpwb-review-disposition-actor]')?.value,
      role: card.querySelector('[data-hpwb-review-disposition-role]')?.value,
      disposition: card.querySelector('[data-hpwb-review-disposition-value]')?.value,
      comment: card.querySelector('[data-hpwb-review-disposition-comment]')?.value,
      recordedAt: new Date().toISOString(),
    };
    const next = await appendHpPipingClassReviewDisposition(readLedger(), report, input);
    writeLedger(next);
    const latest = next.entries.at(-1);
    const integrity = latest.entrySha256 ? ` · entry SHA-256 ${esc(latest.entrySha256.slice(0, 16))}…` : ' · legacy v1 custody';
    setStatus(card, 'good', `<strong>Disposition recorded.</strong> ${esc(latest.entryId)}${integrity}. <span class="hpwb-muted">Declared identity only; No design-release or Code authority granted.</span>`);
    await refresh();
  }

  async function exportPackage(card) {
    const { project, report } = currentReport();
    const pkg = await buildHpPipingClassReviewDispositionPackage(report, readLedger());
    const verified = await verifyHpPipingClassReviewDispositionPackage(pkg);
    if (!verified.ok) throw new Error(`Review package verification failed: ${verified.error}`);
    downloadText(filename(project), serializeHpPipingClassReviewDispositionPackageJson(pkg), 'application/json;charset=utf-8');
    const chain = verified.ledgerHeadSha256 ? ` · chain head ${esc(verified.ledgerHeadSha256.slice(0, 16))}…` : ' · legacy v1 ledger';
    setStatus(card, 'good', `<strong>Review package verified.</strong> report SHA-256 ${esc(verified.reportSha256.slice(0, 16))}…${chain} · ${verified.currentRecordCount} current record(s) · ${verified.historicalRecordCount} historical record(s). <span class="hpwb-muted">Content self-consistency verified; actor identity is user-declared.</span>`);
  }

  async function onClick(event) {
    const action = event.target.closest('[data-hpwb-review-disposition-action]')?.dataset.hpwbReviewDispositionAction;
    if (!action) return;
    const card = event.target.closest('[data-hpwb-review-disposition="true"]');
    try {
      if (action === 'record') await record(card);
      else if (action === 'export') await exportPackage(card);
    } catch (error) {
      setStatus(card, 'error', `<strong>Review disposition blocked.</strong> ${esc(error.message)}`);
    }
  }

  function onInput(event) {
    if (!event.target.closest('[data-hpwb-bind]')) return;
    contextProject = null;
    queueMicrotask(refresh);
  }

  function onChange(event) {
    if (event.target.matches('[data-hpwb-file]')) {
      contextProject = null;
      queueMicrotask(refresh);
    }
  }

  const observer = new MutationObserver(inject);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  inject();

  return () => {
    refreshToken += 1;
    observer.disconnect();
    container.removeEventListener('click', onClick);
    container.removeEventListener('input', onInput);
    container.removeEventListener('change', onChange);
  };
}
