import { buildVibrationActionCompletionAuthoringModel } from './vibration-integrity-action-completion-controller.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function actionRows(model) {
  if (!model.actions.length) {
    return '<tr><td colspan="7" class="vi-table-empty">No current required actions are available.</td></tr>';
  }
  return model.actions.map(({ action, occurrenceId, authorable, nextTransition }) => {
    const latest = action.latestCompletion;
    const actionButton = authorable
      ? `<button type="button" class="vi-btn" data-vi-action-completion-open="${esc(occurrenceId)}">${nextTransition === 'REOPEN' ? 'Reopen' : 'Record completion'}</button>`
      : '<span class="vi-empty">Not authorable</span>';
    return `<tr>
      <td>${esc(action.module)}</td>
      <td>${esc(action.scope.line)} · ${esc(action.scope.caseId)}<small class="vi-mono">${esc(action.scope.canonicalId)}</small></td>
      <td>${esc(action.actionKey)}</td>
      <td>${esc(action.obligation)}</td>
      <td><strong>${esc(action.completionState)}</strong></td>
      <td>${latest ? `${esc(latest.actorId)}<small class="vi-mono">${esc(latest.recordedAt)}</small>` : '<span class="vi-empty">—</span>'}</td>
      <td>${actionButton}</td>
    </tr>`;
  }).join('');
}

function editor(model) {
  if (!model.editor) return '';
  const transition = model.editor.transition;
  const draft = model.draft;
  return `<section class="vi-card" data-vi-action-completion-editor="${esc(model.editor.occurrenceId)}">
    <div class="vi-section-head"><div><h3>${transition === 'REOPEN' ? 'Reopen required action' : 'Record action completion'}</h3>
      <p>This record is caller attestation only. It does not change screening, completeness, governing or design authority.</p></div></div>
    <div class="vi-import-facts"><span>Action: <strong class="vi-mono">${esc(model.editor.actionId)}</strong></span><span>Transition: <strong>${esc(transition)}</strong></span><span>Sequence: <strong>${esc(model.editor.sequence)}</strong></span></div>
    <div class="vi-form-grid">
      <label>Actor ID<input type="text" data-vi-action-completion-field="actorId" value="${esc(draft.actorId)}" autocomplete="off" /></label>
      <label>Reason<textarea data-vi-action-completion-field="reason" rows="3">${esc(draft.reason)}</textarea></label>
      <label>Evidence references<textarea data-vi-action-completion-field="evidenceRefs" rows="3" placeholder="One or more document / measurement / verification references">${esc(draft.evidenceRefs)}</textarea></label>
    </div>
    <div class="vi-actions">
      <button type="button" class="vi-btn primary" data-vi-action-completion-submit>${transition === 'REOPEN' ? 'Record reopen' : 'Record completion'}</button>
      <button type="button" class="vi-btn" data-vi-action-completion-cancel>Cancel</button>
    </div>
    ${transition === 'COMPLETE' ? '<p class="vi-note">Completion requires at least one evidence reference.</p>' : '<p class="vi-note">Evidence references are optional for reopening but the reason remains mandatory.</p>'}
  </section>`;
}

export function renderVibrationActionCompletionPanel(state = {}) {
  const model = buildVibrationActionCompletionAuthoringModel(state);
  const foreignCount = model.lifecycle.foreignCompletionRecords.length;
  const conflictCount = model.lifecycle.sourceConflicts.length;
  return `<section class="vi-card" data-vi-action-completion-authoring>
    <div class="vi-section-head"><div><h3>Required action completion</h3>
      <p>Append-only completion and reopen records for source-backed required actions. Lifecycle state is derived from the governed ledger; this panel never mutates completion state directly.</p></div></div>
    <div class="vi-summary">
      <div class="vi-metric"><small>Current actions</small><strong>${esc(model.lifecycle.summary.currentActionCount)}</strong></div>
      <div class="vi-metric"><small>Open findings</small><strong>${esc(model.lifecycle.summary.openFindingCount)}</strong></div>
      <div class="vi-metric"><small>Resolved findings</small><strong>${esc(model.lifecycle.summary.resolvedFindingCount)}</strong></div>
      <div class="vi-metric"><small>Completion records</small><strong>${esc(model.lifecycle.summary.appliedCompletionRecordCount)}</strong></div>
    </div>
    ${!model.enabled ? '<div class="vi-banner warn"><strong>Current facility run required.</strong><span>Completion authoring is disabled until a CURRENT_RESULT with exact run/scenario custody exists.</span></div>' : ''}
    ${conflictCount ? `<div class="vi-banner bad"><strong>Action custody conflict.</strong><span>${esc(model.lifecycle.sourceConflicts[0].code)}</span></div>` : ''}
    ${foreignCount ? `<div class="vi-banner warn"><strong>Foreign completion history retained.</strong><span>${esc(foreignCount)} prior-run or prior-snapshot record(s) cannot alter the current action occurrence.</span></div>` : ''}
    <div class="vi-table-wrap"><table class="vi-table"><thead><tr>
      <th>Module</th><th>Scope</th><th>Action</th><th>Obligation</th><th>State</th><th>Latest record</th><th>Author</th>
    </tr></thead><tbody>${actionRows(model)}</tbody></table></div>
  </section>${editor(model)}`;
}
