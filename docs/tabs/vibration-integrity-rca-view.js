import { buildVibrationRcaAuthoringModel } from './vibration-integrity-rca-controller.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function option(value, current, label = value) {
  return `<option value="${esc(value)}"${current === value ? ' selected' : ''}>${esc(label)}</option>`;
}

function evidenceRows(entry, draft) {
  if (!entry.verificationRecords.length) {
    return '<p class="vi-muted">No project-scoped verification records are available for this exact action occurrence.</p>';
  }
  return `<div class="vi-table-wrap"><table class="vi-table"><thead><tr>
    <th>Verification</th><th>Status</th><th>Evidence for</th><th>Evidence against</th>
  </tr></thead><tbody>${entry.verificationRecords.map((record) => {
    const id = record.recordId;
    const attachment = record.attachment;
    return `<tr>
      <td><strong>${esc(attachment.requirement.requirementId)}</strong><br><small>${esc(id)}</small></td>
      <td>${esc(attachment.verificationStatus.state)}</td>
      <td><input type="checkbox" data-vi-rca-evidence="FOR" value="${esc(id)}"${draft.evidenceForRecordIds?.includes(id) ? ' checked' : ''}></td>
      <td><input type="checkbox" data-vi-rca-evidence="AGAINST" value="${esc(id)}"${draft.evidenceAgainstRecordIds?.includes(id) ? ' checked' : ''}></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function editor(entry, model) {
  const draft = model.draft;
  const outcomes = ['NO_CONCLUSION', ...model.conclusionOutcomes];
  return `<div class="vi-editor" data-vi-rca-editor="${esc(entry.occurrenceId)}">
    <div class="vi-section-head"><div><h4>RCA hypothesis</h4>
      <p>Engineer-authored investigation only. The software does not infer or confirm root cause. Reuse a hypothesis ID to append a new immutable revision as evidence or the engineer conclusion evolves.</p></div></div>
    <div class="vi-form-grid">
      <label>Hypothesis ID<input data-vi-rca-field="hypothesisId" value="${esc(draft.hypothesisId)}" placeholder="RCA-HYP-001"></label>
      <label>Conclusion<select data-vi-rca-field="conclusionOutcome">${outcomes.map((value) => option(value, draft.conclusionOutcome, value.replaceAll('_', ' '))).join('')}</select></label>
      <label class="vi-form-span">Hypothesis statement<textarea data-vi-rca-field="statement" rows="3" placeholder="State the physical causal hypothesis to be tested.">${esc(draft.statement)}</textarea></label>
      <label>Engineer ID<input data-vi-rca-field="engineerId" value="${esc(draft.engineerId)}" placeholder="Required only for a conclusion"></label>
      <label>Conclusion reason<input data-vi-rca-field="conclusionReason" value="${esc(draft.conclusionReason)}" placeholder="Required only for a conclusion"></label>
    </div>
    <h5>Verification evidence for / against</h5>
    ${evidenceRows(entry, draft)}
    <div class="vi-actions">
      <button type="button" class="vi-btn vi-btn-primary" data-vi-rca-submit>Record RCA hypothesis</button>
      <button type="button" class="vi-btn" data-vi-rca-cancel>Cancel</button>
    </div>
  </div>`;
}

function history(entry) {
  if (!entry.rcaRecords.length) return '<span class="vi-muted">No RCA hypothesis recorded.</span>';
  return entry.rcaRecords.slice().reverse().map((record) => {
    const hypothesis = record.hypothesis;
    return `<div class="vi-inline-note" data-vi-rca-record="${esc(record.recordId)}">
      <strong>${esc(hypothesis.hypothesisId)} · rev ${esc(record.hypothesisRevision)}</strong> — ${esc(hypothesis.statement)}
      <br><small>State: ${esc(hypothesis.state)} · evidence ${esc(hypothesis.evidence.length)} · conclusion ${esc(hypothesis.conclusion?.outcome ?? 'NONE')}</small>
    </div>`;
  }).join('');
}

export function renderVibrationRcaPanel(state = {}) {
  const model = buildVibrationRcaAuthoringModel(state);
  if (!model.actions.length) return '';
  return `<section class="vi-card" data-vi-rca-panel>
    <div class="vi-section-head"><div><h3>Root-cause investigation</h3>
      <p>Evidence-linked M15 investigation. Hypotheses and engineer conclusions cannot alter screening, applicability, action completion, design, code or safety authority.</p></div>
      <span class="vi-badge">RCA · engineer attestation only</span>
    </div>
    ${!model.handoff ? '<div class="vi-callout">Load/select a governed vibration project to bind RCA evidence to project identity.</div>' : ''}
    ${model.actions.map((entry) => `<article class="vi-subcard" data-vi-rca-action="${esc(entry.occurrenceId)}">
      <div class="vi-section-head"><div><h4>${esc(entry.action.mechanismId)} · ${esc(entry.action.scope.line)} / ${esc(entry.action.scope.caseId)}</h4>
        <p>Verification records: ${esc(entry.verificationRecords.length)} · accepted: ${esc(entry.acceptedVerificationCount)} · RCA revisions: ${esc(entry.rcaRecords.length)}</p></div>
        <button type="button" class="vi-btn" data-vi-rca-open="${esc(entry.occurrenceId)}"${entry.authorable ? '' : ' disabled'}>Add RCA hypothesis</button>
      </div>
      ${history(entry)}
      ${model.editor?.occurrenceId === entry.occurrenceId ? editor(entry, model) : ''}
    </article>`).join('')}
  </section>`;
}
