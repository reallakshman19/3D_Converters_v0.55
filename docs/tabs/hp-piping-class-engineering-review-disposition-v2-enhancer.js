import {
  HP_PIPING_CLASS_WORKSPACE_STORAGE_KEY,
  parseHpPipingClassWorkspaceProject,
} from './hp-piping-class-workspace-controller.js';
import { validateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-project.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import { buildHpPipingClassEngineeringReviewReport } from './hp-piping-class-engineering-review-report.js';
import {
  appendHpPipingClassReviewDispositionV2,
  resolveHpPipingClassReviewDispositionLedgerV2,
  summarizeHpPipingClassReviewDispositionV2,
} from './hp-piping-class-engineering-review-disposition-v2.js';
import {
  buildHpPipingClassReviewDispositionCheckpointV2,
  buildHpPipingClassReviewDispositionPackageV2,
  serializeHpPipingClassReviewDispositionCheckpointV2Json,
  serializeHpPipingClassReviewDispositionPackageV2Json,
  verifyHpPipingClassReviewDispositionPackageV2,
} from './hp-piping-class-engineering-review-disposition-package-v2.js';

export const HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V1 =
  'format-converters.hpPipingClassEngineeringReviewDisposition.v1';
export const HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V2 =
  'format-converters.hpPipingClassEngineeringReviewDisposition.v2';

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

async function readLedgerV2() {
  const v2 = globalThis.localStorage?.getItem(HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V2);
  const v1 = globalThis.localStorage?.getItem(HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V1);
  return resolveHpPipingClassReviewDispositionLedgerV2({ v2Value: v2, v1Value: v1 });
}

function writeLedgerV2(ledger) {
  globalThis.localStorage?.setItem(
    HP_PIPING_CLASS_REVIEW_DISPOSITION_STORAGE_KEY_V2,
    JSON.stringify(ledger),
  );
}

function safe(value, fallback) {
  return String(value || fallback).replace(/[^a-z0-9_-]+/gi, '-');
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function packageFilename(project) {
  return `${safe(project?.metadata?.classId, 'hp-piping-class')}-${safe(project?.metadata?.revision, 'draft')}.hp-review-disposition-v2.json`;
}

function checkpointFilename(project) {
  return `${safe(project?.metadata?.classId, 'hp-piping-class')}-${safe(project?.metadata?.revision, 'draft')}.hp-review-checkpoint.json`;
}

function cardHtml() {
  return `<section class="hpwb-card hpwb-review-disposition" data-hpwb-review-disposition-v2="true">
    <div class="hpwb-section-toolbar"><div><h4>Engineering review disposition · v2 chain</h4><p>New records are SHA-256 chained. Legacy v1 records are preserved as an anchored snapshot, not retroactively authenticated.</p></div><span class="hpwb-badge warn">REVIEW CUSTODY ONLY</span></div>
    <div class="hpwb-notice warn"><strong>Security boundary:</strong> a self-contained hash chain proves internal consistency only. Retain the exported checkpoint independently if you need later tamper evidence. Reviewer/checker identity remains user-declared; no PKI/e-signature, design-release, or Code authority is granted.</div>
    <div data-hpwb-review-disposition-summary-v2 class="hpwb-muted">Resolving current report binding and chain state…</div>
    <div class="hpwb-grid two" style="margin-top:10px">
      <label class="hpwb-field"><span>Reviewer / checker identity</span><input data-hpwb-review-disposition-actor-v2 type="text" placeholder="ENGINEER_B"></label>
      <label class="hpwb-field"><span>Role</span><select data-hpwb-review-disposition-role-v2><option value="CHECKER">Checker</option><option value="REVIEWER">Reviewer</option></select></label>
    </div>
    <label class="hpwb-field" style="margin-top:10px"><span>Disposition</span><select data-hpwb-review-disposition-value-v2>
      <option value="NO_OBJECTION_FOR_ENGINEERING_REVIEW">No objection for engineering review</option>
      <option value="COMMENTS_RECORDED">Comments recorded</option>
      <option value="REJECTED_FOR_ENGINEERING_REVIEW">Rejected for engineering review</option>
    </select></label>
    <label class="hpwb-field" style="margin-top:10px"><span>Comment</span><textarea data-hpwb-review-disposition-comment-v2 class="hpwb-bulk-input" style="min-height:88px" placeholder="Required for comments/rejection; optional for no-objection."></textarea></label>
    <div class="hpwb-section-toolbar"><span class="hpwb-muted">V2 records cannot be edited or deleted here. Export checkpoints to independent custody when a review milestone must be frozen.</span><div class="hpwb-actions"><button class="hpwb-button primary" data-hpwb-review-disposition-v2-action="record" type="button">Record v2 disposition</button><button class="hpwb-button" data-hpwb-review-disposition-v2-action="export" type="button">Export v2 review package</button><button class="hpwb-button" data-hpwb-review-disposition-v2-action="checkpoint" type="button">Export chain checkpoint</button></div></div>
    <div data-hpwb-review-disposition-status-v2></div>
  </section>`;
}

function summaryHtml(summary) {
  const digest = summary.reportSha256 ? `${summary.reportSha256.slice(0, 16)}…` : '—';
  const head = summary.chainHeadSha256 ? `${summary.chainHeadSha256.slice(0, 16)}…` : '—';
  const current = summary.currentDisposition === 'PENDING_REVIEW'
    ? 'PENDING REVIEW'
    : summary.currentDisposition;
  const actor = summary.currentActor ? ` · ${esc(summary.currentRole)} ${esc(summary.currentActor)}` : '';
  const integrity = summary.currentEntryIntegrity === 'HASH_CHAIN_V2'
    ? 'HASH_CHAIN_V2 / internal consistency'
    : summary.currentEntryIntegrity === 'LEGACY_V1_UNSEALED'
      ? 'LEGACY_V1_UNSEALED'
      : 'NO CURRENT RECORD';
  return `<div class="hpwb-notice ${summary.currentDisposition === 'REJECTED_FOR_ENGINEERING_REVIEW' ? 'error' : summary.currentDisposition === 'PENDING_REVIEW' ? 'warn' : 'good'}"><strong>${esc(current)}</strong>${actor}<br><span class="hpwb-code">report SHA-256 ${esc(digest)}</span> · ${esc(integrity)}<br><span class="hpwb-code">chain head ${esc(head)}</span> · ${summary.hashChainedV2RecordCount} v2 chained · ${summary.legacyV1RecordCount} legacy v1 · ${summary.historicalRecordCount} historical.</div>`;
}

function setStatus(card, kind, message) {
  const target = card?.querySelector('[data-hpwb-review-disposition-status-v2]');
  if (!target) return;
  target.className = `hpwb-notice ${kind}`;
  target.innerHTML = message;
}

export function installHpPipingClassEngineeringReviewDispositionV2Enhancer(container, options = {}) {
  let contextProject = cloneProject(options?.context?.hpPipingClassProject ?? null);
  let refreshToken = 0;

  function currentProject() {
    return readStoredProject() ?? contextProject;
  }

  function currentReport() {
    const project = currentProject();
    if (!project) throw new Error('Current HP Piping Class project is unavailable.');
    const validation = validateHpPipingClassProject(project, { validationPolicy: 'PRODUCTION_REVIEW' });
    if (!validation.ok) {
      throw new Error(`Current project has ${validation.issues?.length ?? 0} production-review blocker(s).`);
    }
    const result = evaluateHpPipingClassProject(project, { includeEvidence: true });
    if (!result.ok) {
      throw new Error(`Canonical HP review did not complete: ${result.projectState || 'CALCULATION_BLOCKED'}.`);
    }
    return { project, report: buildHpPipingClassEngineeringReviewReport(project, result) };
  }

  async function refresh() {
    const token = ++refreshToken;
    const card = container.querySelector('[data-hpwb-review-disposition-v2="true"]');
    if (!card) return;
    try {
      const { report } = currentReport();
      const summary = await summarizeHpPipingClassReviewDispositionV2(await readLedgerV2(), report);
      if (token !== refreshToken) return;
      const target = card.querySelector('[data-hpwb-review-disposition-summary-v2]');
      if (target) target.innerHTML = summaryHtml(summary);
    } catch (error) {
      if (token !== refreshToken) return;
      const target = card.querySelector('[data-hpwb-review-disposition-summary-v2]');
      if (target) target.innerHTML = `<div class="hpwb-notice error"><strong>Review disposition unavailable.</strong> ${esc(error.message)}</div>`;
    }
  }

  function inject() {
    const matrix = container.querySelector('[data-hpwb-class-result-matrix="true"]');
    if (!matrix || container.querySelector('[data-hpwb-review-disposition-v2="true"]')) return;
    matrix.insertAdjacentHTML('afterend', cardHtml());
    refresh();
  }

  async function record(card) {
    const { report } = currentReport();
    const next = await appendHpPipingClassReviewDispositionV2(await readLedgerV2(), report, {
      actor: card.querySelector('[data-hpwb-review-disposition-actor-v2]')?.value,
      role: card.querySelector('[data-hpwb-review-disposition-role-v2]')?.value,
      disposition: card.querySelector('[data-hpwb-review-disposition-value-v2]')?.value,
      comment: card.querySelector('[data-hpwb-review-disposition-comment-v2]')?.value,
      recordedAt: new Date().toISOString(),
    });
    writeLedgerV2(next);
    const latest = next.entries.at(-1);
    setStatus(card, 'good', `<strong>V2 disposition recorded.</strong> ${esc(latest.entryId)} · entry hash <span class="hpwb-code">${esc(latest.entrySha256.slice(0, 16))}…</span>. <span class="hpwb-muted">Internal chain consistency only unless checked against an independently retained checkpoint.</span>`);
    await refresh();
  }

  async function exportPackage(card) {
    const { project, report } = currentReport();
    const pkg = await buildHpPipingClassReviewDispositionPackageV2(report, await readLedgerV2());
    const verified = await verifyHpPipingClassReviewDispositionPackageV2(pkg);
    if (!verified.ok) throw new Error(`Review package verification failed: ${verified.error}`);
    downloadText(packageFilename(project), serializeHpPipingClassReviewDispositionPackageV2Json(pkg));
    setStatus(card, 'good', `<strong>V2 review package internally verified.</strong> ${verified.hashChainedV2RecordCount} v2 chained record(s), ${verified.legacyV1RecordCount} legacy v1 record(s). <span class="hpwb-muted">This does not authenticate the declared actor.</span>`);
  }

  async function exportCheckpoint(card) {
    const { project } = currentReport();
    const checkpoint = await buildHpPipingClassReviewDispositionCheckpointV2(await readLedgerV2());
    downloadText(checkpointFilename(project), serializeHpPipingClassReviewDispositionCheckpointV2Json(checkpoint));
    setStatus(card, 'warn', '<strong>Chain checkpoint exported.</strong> Retain this file independently from the review package. Its value as tamper evidence depends on separate trusted custody; it is not a signature.');
  }

  async function onClick(event) {
    const action = event.target.closest('[data-hpwb-review-disposition-v2-action]')?.dataset.hpwbReviewDispositionV2Action;
    if (!action) return;
    const card = event.target.closest('[data-hpwb-review-disposition-v2="true"]');
    try {
      if (action === 'record') await record(card);
      else if (action === 'export') await exportPackage(card);
      else if (action === 'checkpoint') await exportCheckpoint(card);
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
