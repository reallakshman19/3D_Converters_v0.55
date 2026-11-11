import { buildVibrationActionVerificationAuthoringModel } from './vibration-integrity-action-verification-controller.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function checked(values, value) {
  return values?.includes(value) ? ' checked' : '';
}

function option(value, current) {
  return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(value)}</option>`;
}

function actionRows(model) {
  if (!model.actions.length) {
    return '<tr><td colspan="7" class="vi-table-empty">No current source-backed required actions.</td></tr>';
  }
  return model.actions.map((entry) => {
    const latest = entry.latestRecord?.attachment ?? null;
    const state = latest?.verificationStatus?.state ?? 'NOT_RECORDED';
    const evidence = `${entry.sessions.length} session(s) · ${entry.products.length} product(s)`;
    return `<tr>
      <td>${esc(entry.action.mechanismId)}</td>
      <td class="vi-mono">${esc(entry.action.scope.line)} / ${esc(entry.action.scope.caseId)}</td>
      <td>${esc(entry.action.title)}</td>
      <td>${esc(evidence)}</td>
      <td>${esc(entry.attachmentCount)}</td>
      <td>${esc(state)}</td>
      <td><button type="button" class="vi-btn" data-vi-action-verification-open="${esc(entry.occurrenceId)}"${entry.authorable ? '' : ' disabled'}>Record verification</button></td>
    </tr>`;
  }).join('');
}

function checkboxList(values, selected, group, labeler = (value) => value) {
  if (!values.length) return '<span class="vi-muted">None available for the exact scenario snapshot.</span>';
  return `<div class="vi-check-list">${values.map((value) => `<label><input type="checkbox" data-vi-action-verification-selection="${esc(group)}" value="${esc(value)}"${checked(selected, value)}> ${esc(labeler(value))}</label>`).join('')}</div>`;
}

function editor(model) {
  if (!model.editor) return '';
  const entry = model.actions.find((item) => item.occurrenceId === model.editor.occurrenceId);
  if (!entry) return '<div class="vi-banner bad"><strong>Verification editor is stale.</strong><span>Close and reopen it from the current action occurrence.</span></div>';
  const draft = model.draft;
  const sessionIds = entry.sessions.map((session) => session.sessionId);
  const productIds = entry.products.map((product) => product.productId);
  const productById = new Map(entry.products.map((product) => [product.productId, product]));
  return `<section class="vi-card" data-vi-action-verification-editor="${esc(model.editor.occurrenceId)}">
    <div class="vi-section-head"><div><h4>Verification record editor</h4><p>Bound to the exact action occurrence and current project measurement-evidence revision. This editor cannot complete or reopen the action.</p></div></div>
    <div class="vi-form-grid">
      <label>Requirement ID<input data-vi-action-verification-field="requirementId" value="${esc(draft.requirementId)}" placeholder="VERIFY-FIT-001"></label>
      <label>Requirement type<select data-vi-action-verification-field="requirementType">${model.requirementTypes.map((value) => option(value, draft.requirementType)).join('')}</select></label>
      <label class="vi-span-2">Requirement reason<textarea data-vi-action-verification-field="requirementReason">${esc(draft.requirementReason)}</textarea></label>
    </div>
    <div class="vi-field-group"><strong>Required signal products</strong>${checkboxList(model.productTypes, draft.requiredProductTypes, 'requiredProductTypes')}</div>
    <div class="vi-import-facts"><span>Exact-scope sessions: <strong>${esc(entry.sessions.length)}</strong></span><span>Exact-scope products: <strong>${esc(entry.products.length)}</strong></span><span>Available types: <strong>${esc(entry.availableProductTypes.join(', ') || 'none')}</strong></span></div>
    <label class="vi-check"><input type="checkbox" data-vi-action-verification-field="includeDisposition"${draft.includeDisposition ? ' checked' : ''}> Record engineer verification disposition now</label>
    ${draft.includeDisposition ? `<div class="vi-form-grid">
      <label>Disposition ID<input data-vi-action-verification-field="dispositionId" value="${esc(draft.dispositionId)}" placeholder="DISP-001"></label>
      <label>Outcome<select data-vi-action-verification-field="dispositionOutcome">${model.dispositionOutcomes.map((value) => option(value, draft.dispositionOutcome)).join('')}</select></label>
      <label>Reviewer ID<input data-vi-action-verification-field="reviewerId" value="${esc(draft.reviewerId)}"></label>
      <label class="vi-span-2">Disposition reason<textarea data-vi-action-verification-field="dispositionReason">${esc(draft.dispositionReason)}</textarea></label>
    </div>
    <div class="vi-field-group"><strong>Referenced measurement sessions</strong>${checkboxList(sessionIds, draft.sessionIds, 'sessionIds')}</div>
    <div class="vi-field-group"><strong>Referenced signal products</strong>${checkboxList(productIds, draft.productIds, 'productIds', (id) => `${id} · ${productById.get(id)?.productType ?? ''}`)}</div>` : ''}
    <div class="vi-actions"><button type="button" class="vi-btn primary" data-vi-action-verification-submit>Append verification attachment</button><button type="button" class="vi-btn" data-vi-action-verification-cancel>Cancel</button></div>
  </section>`;
}

export function renderVibrationActionVerificationPanel(state = {}) {
  let model;
  try { model = buildVibrationActionVerificationAuthoringModel(state); }
  catch (error) {
    return `<section class="vi-card"><div class="vi-banner bad"><strong>Verification custody unavailable.</strong><span>${esc(error?.message || error)}</span></div></section>`;
  }
  const project = model.handoff?.projectId ?? 'NO PROJECT EVIDENCE HANDOFF';
  const status = model.enabled ? 'CURRENT RUN + PROJECT EVIDENCE' : 'READ ONLY / NOT AUTHORABLE';
  return `<section class="vi-card" data-vi-action-verification-panel>
    <div class="vi-section-head"><div><h3>Measurement / verification evidence</h3><p>Attach governed project measurement evidence to an exact required-action occurrence. Verification status is delegated to the existing verification engine and never closes the action automatically.</p></div><div class="vi-authority"><strong>${esc(status)}</strong><span>NOT SCREENING / COMPLETION / DESIGN AUTHORITY</span></div></div>
    <div class="vi-import-facts"><span>Project: <strong>${esc(project)}</strong></span><span>Attachment records: <strong>${esc(model.ledger.records.length)}</strong></span></div>
    <div class="vi-table-wrap"><table class="vi-table"><thead><tr><th>Mechanism</th><th>Scope</th><th>Required action</th><th>Exact-scope evidence</th><th>Records</th><th>Latest verification</th><th>Action</th></tr></thead><tbody>${actionRows(model)}</tbody></table></div>
  </section>${editor(model)}`;
}
