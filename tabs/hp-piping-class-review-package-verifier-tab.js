import {
  serializeHpPipingClassReviewPackageVerificationReceipt,
  verifyHpPipingClassReviewPackageJson,
} from './hp-piping-class-review-package-verifier.js';
import { HP_PIPING_CLASS_REVIEW_CHAIN_INTEGRITY } from './hp-piping-class-engineering-review-disposition.js';

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function fmt(value, digits = 5) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'; }
function ensureStyles() {
  if (document.querySelector('style[data-hp-review-package-verifier-style="true"]')) return;
  const style = document.createElement('style');
  style.dataset.hpReviewPackageVerifierStyle = 'true';
  style.textContent = `
    .hp-review-verify{padding:18px;display:grid;gap:14px}.hp-review-verify h2,.hp-review-verify h3{margin:0}.hp-review-verify-card{border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:14px;background:rgba(15,23,42,.3)}
    .hp-review-verify textarea{width:100%;min-height:210px;resize:vertical;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.25);border-radius:8px;padding:10px}.hp-review-verify textarea.compact{min-height:118px}.hp-review-verify-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.hp-review-verify button{font:inherit;color:inherit;border:1px solid rgba(148,163,184,.3);background:rgba(148,163,184,.12);border-radius:8px;padding:8px 11px;cursor:pointer}.hp-review-verify button.primary{font-weight:750;background:rgba(59,130,246,.22)}
    .hp-review-verify-notice{border:1px solid rgba(148,163,184,.25);border-radius:8px;padding:10px 12px}.hp-review-verify-notice.good{border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.08)}.hp-review-verify-notice.warn{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.08)}.hp-review-verify-notice.error{border-color:rgba(239,68,68,.55);background:rgba(239,68,68,.08)}
    .hp-review-verify-grid{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:8px}.hp-review-verify-metric{border:1px solid rgba(148,163,184,.18);border-radius:8px;padding:10px}.hp-review-verify-metric small{display:block;opacity:.72}.hp-review-verify-metric strong{display:block;margin-top:3px;overflow-wrap:anywhere}.hp-review-verify-table-wrap{overflow:auto}.hp-review-verify table{width:100%;border-collapse:collapse;font-size:12px;min-width:760px}.hp-review-verify th,.hp-review-verify td{border:1px solid rgba(148,163,184,.22);padding:6px 7px;text-align:left;vertical-align:top}.hp-review-verify th{background:rgba(148,163,184,.1)}.hp-review-verify-code{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.hp-review-verify-muted{opacity:.72}@media(max-width:850px){.hp-review-verify-grid{grid-template-columns:repeat(2,minmax(120px,1fr))}}
  `;
  document.head.appendChild(style);
}
function trustRows(receipt) {
  const trust = receipt?.trust ?? {};
  const rows = [
    ['Report SHA-256 binding', trust.reportContentSha256Binding],
    ['Embedded report schema round trip', trust.embeddedReportSchemaRoundTrip],
    ['Ledger structural validation', trust.ledgerStructuralValidation],
    ['Stored summary recomputation', trust.storedSummaryRecomputation],
    ['V2 entry/hash-chain integrity', trust.ledgerEntryCryptographicIntegrity],
    ['Legacy v1 entry integrity', trust.legacyV1EntryCryptographicIntegrity],
    ['External checkpoint verification', trust.externalCheckpointVerification],
    ['Reviewer identity authentication', trust.reviewerIdentityAuthentication],
    ['Digital signature', trust.digitalSignature === false ? 'FALSE / NOT PRESENT' : String(trust.digitalSignature)],
    ['Native CORE KD-3 qualified', trust.nativeCoreKd3Qualified === false ? 'FALSE' : String(trust.nativeCoreKd3Qualified)],
    ['Code compliance', trust.codeCompliance === false ? 'NOT ESTABLISHED' : String(trust.codeCompliance)],
    ['Design authority', trust.designAuthority === false ? 'NOT GRANTED' : String(trust.designAuthority)],
    ['Release authority', trust.releaseAuthority === false ? 'NOT GRANTED' : String(trust.releaseAuthority)],
  ];
  return rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td class="hp-review-verify-code">${esc(value ?? '—')}</td></tr>`).join('');
}

function allLedgerEntries(result) {
  if (result.package?.schemaVersion?.endsWith('/v2')) {
    return [
      ...(result.ledger?.legacyV1Ledger?.entries ?? []).map((entry) => ({ ...entry, integrityClass: 'LEGACY_V1_UNSEALED' })),
      ...(result.ledger?.entries ?? []).map((entry) => ({ ...entry, integrityClass: 'HASH_CHAIN_V2' })),
    ];
  }
  return (result.ledger?.entries ?? []).map((entry) => ({ ...entry, integrityClass: 'LEGACY_V1_UNSEALED' }));
}
function ledgerRows(result) {
  const currentIds = new Set((result.currentEntries ?? []).map((entry) => entry.entryId));
  const rows = allLedgerEntries(result);
  if (!rows.length) return '<tr><td colspan="11">No review-disposition entries in this package.</td></tr>';
  return rows.map((entry) => `<tr>
    <td>${esc(entry.sequence)}</td><td>${currentIds.has(entry.entryId) ? '<strong>CURRENT</strong>' : 'HISTORICAL'}</td>
    <td>${esc(entry.integrityClass)}</td><td>${esc(entry.role)}</td><td>${esc(entry.actor)}</td><td>${esc(entry.disposition)}</td><td>${esc(entry.recordedAt)}</td>
    <td>${esc(entry.comment ?? '—')}</td><td class="hp-review-verify-code">${esc(String(entry.reportSha256 ?? '').slice(0, 16))}…</td>
    <td class="hp-review-verify-code">${entry.entrySha256 ? `${esc(entry.entrySha256.slice(0, 16))}…` : '—'}</td>
    <td>${esc(entry.authority?.actorIdentityAuthority ?? '—')}</td>
  </tr>`).join('');
}
function productRows(result) {
  const rows = result.package?.report?.productResults ?? [];
  if (!rows.length) return '<tr><td colspan="7">No product result rows in embedded report.</td></tr>';
  return rows.map((row) => `<tr><td><strong>${esc(row.productId)}</strong></td><td>${esc(row.reviewPriority ?? '—')}</td><td>${row.staticPass === true ? 'PASS' : row.staticPass === false ? 'FAIL' : '—'}</td><td>${fmt(row.requiredNominalThicknessMm)}</td><td>${fmt(row.pressureRatingMpa)}</td><td>${fmt(row.cumulativeUsage, 6)}</td><td>${esc(row.engineeringState ?? '—')}</td></tr>`).join('');
}

function verificationHeadline(receipt) {
  if (receipt.trust?.externalCheckpointVerification === 'PASS') {
    return '<strong>PACKAGE + CHECKPOINT VERIFIED.</strong> Internal chain arithmetic is valid and the retained chain prefix matches the separately supplied checkpoint.';
  }
  if (receipt.packageSchemaVersion?.endsWith('/v2')) {
    return '<strong>PACKAGE INTERNAL CONSISTENCY VERIFIED.</strong> V2 entry hashes and predecessor links are internally consistent. No external checkpoint was supplied.';
  }
  return '<strong>PACKAGE SELF-CONSISTENCY VERIFIED.</strong> Report hash, embedded report schema, ledger structure and stored summary match fresh recomputation.';
}

function verifiedHtml(result) {
  const receipt = result.receipt;
  const report = result.package.report;
  const basis = report.classBasis ?? {};
  const isV2 = receipt.packageSchemaVersion?.endsWith('/v2');
  const checkpoint = receipt.checkpointVerification;
  return `<div class="hp-review-verify-notice good">${verificationHeadline(receipt)}</div>
    <div class="hp-review-verify-notice warn"><strong>Verification limit:</strong> ${isV2 ? 'A self-contained SHA-256 chain can be recomputed if the complete package is rewritten; external checkpoint evidence depends on independent trusted checkpoint custody. ' : 'V1 entries are not hash-chained. '}Reviewer/checker identity is user-declared; this verifier does not prove actor authenticity, Code compliance, design approval or release authority.</div>
    <section class="hp-review-verify-card"><h3>Package identity</h3><div class="hp-review-verify-grid" style="margin-top:10px">
      <div class="hp-review-verify-metric"><small>Project</small><strong>${esc(receipt.identity.projectId)}</strong></div>
      <div class="hp-review-verify-metric"><small>Class</small><strong>${esc(receipt.identity.classId)}</strong></div>
      <div class="hp-review-verify-metric"><small>Revision</small><strong>${esc(receipt.identity.revision)}</strong></div>
      <div class="hp-review-verify-metric"><small>Current disposition</small><strong>${esc(receipt.currentDisposition)}</strong></div>
      <div class="hp-review-verify-metric"><small>Design pressure</small><strong>${fmt(basis.designPressureMpa)} MPa</strong></div>
      <div class="hp-review-verify-metric"><small>Project state</small><strong>${esc(receipt.projectState ?? '—')}</strong></div>
      <div class="hp-review-verify-metric"><small>Current / historical</small><strong>${esc(receipt.currentRecordCount)} / ${esc(receipt.historicalRecordCount)}</strong></div>
      <div class="hp-review-verify-metric"><small>V2 / legacy v1 records</small><strong>${esc(receipt.hashChainedV2RecordCount ?? 0)} / ${esc(receipt.legacyV1RecordCount ?? 0)}</strong></div>
    </div><p class="hp-review-verify-code">Report SHA-256 ${esc(receipt.reportSha256)}</p>${receipt.chainHeadSha256 ? `<p class="hp-review-verify-code">Chain head ${esc(receipt.chainHeadSha256)}</p>` : ''}${checkpoint?.ok ? `<p class="hp-review-verify-code">Checkpoint prefix ${esc(checkpoint.checkpointChainHeadSha256)} · ${checkpoint.checkpointRecordCount} v2 record(s) retained · ${checkpoint.appendedSinceCheckpoint} appended since checkpoint.</p>` : ''}</section>
    <section class="hp-review-verify-card"><h3>What this verification proves</h3><div class="hp-review-verify-table-wrap" style="margin-top:10px"><table><tbody>${trustRows(receipt)}</tbody></table></div></section>
    <section class="hp-review-verify-card"><h3>Review custody ledger</h3><p class="hp-review-verify-muted">CURRENT means the entry binds to the exact embedded report hash and identity. HASH_CHAIN_V2 means internal chain arithmetic is valid; it does not mean the actor is authenticated or the design is approved.</p><div class="hp-review-verify-table-wrap"><table><thead><tr><th>#</th><th>Binding</th><th>Integrity class</th><th>Role</th><th>Declared actor</th><th>Disposition</th><th>Recorded</th><th>Comment</th><th>Report hash</th><th>Entry hash</th><th>Identity authority</th></tr></thead><tbody>${ledgerRows(result)}</tbody></table></div></section>
    <section class="hp-review-verify-card"><h3>Embedded engineering result summary</h3><div class="hp-review-verify-table-wrap" style="margin-top:10px"><table><thead><tr><th>Product</th><th>Review priority</th><th>Static</th><th>Required nominal mm</th><th>P-rating MPa</th><th>U</th><th>Engineering state</th></tr></thead><tbody>${productRows(result)}</tbody></table></div></section>
    <section class="hp-review-verify-card"><h3>Verifier limitations</h3><ul>${receipt.limitations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>`;
}
function failedHtml(result) { return `<div class="hp-review-verify-notice error"><strong>PACKAGE VERIFICATION BLOCKED.</strong><ul>${(result.issues ?? []).map((item) => `<li><span class="hp-review-verify-code">${esc(item.code)}</span> · ${esc(item.message)}</li>`).join('')}</ul></div>`; }
function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function renderHpPipingClassReviewPackageVerifierTab(container) {
  ensureStyles();
  let state = { text: '', checkpointText: '', result: null };
  container.innerHTML = `<div class="hp-review-verify">
    <section class="hp-review-verify-card"><h2>HP Review Package Verify</h2><p>Independent, read-only verification of review-disposition package v1 or v2. This tool does not import or modify the HP engineering project.</p>
      <label><strong>Review package JSON</strong><textarea data-hp-review-package-text spellcheck="false" placeholder="Paste exported *.hp-review-disposition*.json here"></textarea></label>
      <div class="hp-review-verify-actions"><button type="button" data-hp-review-package-action="load">Load package JSON</button></div>
      <input type="file" hidden data-hp-review-package-file accept=".json,application/json,text/json">
      <label style="display:block;margin-top:12px"><strong>Optional independently retained v2 checkpoint</strong><span class="hp-review-verify-muted"> · only use a checkpoint obtained from separate trusted custody</span><textarea class="compact" data-hp-review-checkpoint-text spellcheck="false" placeholder="Optional *.hp-review-checkpoint.json"></textarea></label>
      <div class="hp-review-verify-actions"><button type="button" data-hp-review-package-action="load-checkpoint">Load checkpoint JSON</button><button type="button" class="primary" data-hp-review-package-action="verify">Verify package</button><button type="button" data-hp-review-package-action="receipt" disabled>Export verification receipt</button></div>
      <input type="file" hidden data-hp-review-checkpoint-file accept=".json,application/json,text/json">
    </section>
    <div data-hp-review-package-result><div class="hp-review-verify-notice warn">No package verified yet.</div></div>
  </div>`;

  const area = container.querySelector('[data-hp-review-package-text]');
  const checkpointArea = container.querySelector('[data-hp-review-checkpoint-text]');
  const resultTarget = container.querySelector('[data-hp-review-package-result]');
  const receiptButton = container.querySelector('[data-hp-review-package-action="receipt"]');
  const fileInput = container.querySelector('[data-hp-review-package-file]');
  const checkpointInput = container.querySelector('[data-hp-review-checkpoint-file]');

  function renderResult() {
    receiptButton.disabled = !state.result?.ok;
    resultTarget.innerHTML = !state.result
      ? '<div class="hp-review-verify-notice warn">No package verified yet.</div>'
      : state.result.ok ? verifiedHtml(state.result) : failedHtml(state.result);
  }

  async function verify() {
    state = {
      text: area.value,
      checkpointText: checkpointArea.value,
      result: await verifyHpPipingClassReviewPackageJson(area.value, {
        checkpointText: checkpointArea.value,
      }),
    };
    renderResult();
  }

  async function loadFile(input, target, verifyAfter) {
    const file = input.files?.[0];
    if (!file) return;
    target.value = await file.text();
    state = { text: area.value, checkpointText: checkpointArea.value, result: null };
    renderResult();
    if (verifyAfter) await verify();
    input.value = '';
  }

  async function onClick(event) {
    const action = event.target.closest('[data-hp-review-package-action]')?.dataset.hpReviewPackageAction;
    if (!action) return;
    if (action === 'load') fileInput.click();
    else if (action === 'load-checkpoint') checkpointInput.click();
    else if (action === 'verify') await verify();
    else if (action === 'receipt' && state.result?.ok) {
      const id = state.result.receipt.identity;
      const name = `${id.classId || 'hp-piping-class'}-${id.revision || 'review'}.hp-review-package-verification.json`;
      downloadText(name, serializeHpPipingClassReviewPackageVerificationReceipt(state.result.receipt));
    }
  }

  async function onChange(event) {
    if (event.target === fileInput) await loadFile(fileInput, area, true);
    else if (event.target === checkpointInput) await loadFile(checkpointInput, checkpointArea, true);
  }

  function onInput(event) {
    if (event.target !== area && event.target !== checkpointArea) return;
    state = { text: area.value, checkpointText: checkpointArea.value, result: null };
    renderResult();
  }

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('input', onInput);
  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('change', onChange);
    container.removeEventListener('input', onInput);
    container.innerHTML = '';
  };
}
