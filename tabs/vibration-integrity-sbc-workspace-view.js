import { buildSbcWorkspaceProjection } from './vibration-integrity-sbc-workspace-model.js?v=20260819-sbc-connection-authoring-1';
import { renderSbcConnectionAuthoringPanel } from './vibration-integrity-sbc-connection-view.js?v=20260819-sbc-connection-authoring-1';
import { renderSbcType3UserInputPanel } from './vibration-integrity-sbc-type3-view.js?v=20260815-sbc-pf05-cache-1';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function statusText(type) {
  if (type.isType3) return 'CANDIDATE PATH · CURVES QUARANTINED';
  return 'RESERVED · NUMERICAL EXECUTION BLOCKED';
}

function typeButton(type) {
  const selected = type.selected ? ' is-active' : '';
  return `<button type="button" class="vi-detail-tab${selected}" data-vi-sbc-workspace-type="${esc(type.typeId)}">
    <strong>${esc(type.typeId.replace('_', ' '))}</strong><small>${esc(statusText(type))}</small>
  </button>`;
}

function list(items, empty = 'None declared') {
  if (!items?.length) return `<span class="vi-empty">${esc(empty)}</span>`;
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function selectedTypePanel(projection) {
  const type = projection.types.find((item) => item.selected);
  if (!type) {
    return `<section class="vi-card vi-empty-state">
      <h3>Explicit SBC type confirmation required</h3>
      <p>Select Type 1, 2, 3 or 4. Automatic type classification is intentionally disabled until the governed method is frozen.</p>
    </section>`;
  }
  return `<section class="vi-card">
    <div class="vi-section-head"><div><h3>${esc(type.typeId.replace('_', ' '))} · qualification readiness</h3>
      <p>Structural/source readiness only. Selecting a type does not authorize numerical execution.</p></div>
      <div class="vi-authority"><strong>${esc(type.lifecycleState)}</strong><span>${esc(statusText(type))}</span></div></div>
    ${type.curveQuarantine ? `<div class="vi-banner warn"><strong>TYPE-3 CURVE SOURCE CONFLICT</strong><span>T3 figure data remain quarantined. D7 is validation evidence, never curve calibration input.</span></div>` : ''}
    <div class="vi-summary">
      <div class="vi-metric"><small>Published B1</small><strong>${esc(type.publishedBenchmark)}</strong></div>
      <div class="vi-metric"><small>Independent B2</small><strong>${type.independentBenchmarkRequired ? 'REQUIRED' : '—'}</strong></div>
      <div class="vi-metric"><small>Classification</small><strong>${esc(type.classificationStatus)}</strong></div>
      <div class="vi-metric"><small>Input contract</small><strong>${esc(type.inputContractStatus)}</strong></div>
    </div>
    <div class="vi-detail-grid">
      <div><h4>Required structural fields</h4>${list(type.requiredFields)}</div>
      <div><h4>Current blockers</h4>${list(type.blockedBy)}</div>
    </div>
    <h4>Engineering notes</h4>${list(type.notes)}
    <p class="vi-mono">Next qualified implementation seam: ${esc(type.nextImplementationSeam)}</p>
    ${type.executionAllowed || type.numericalExecutionAllowed
      ? ''
      : '<button type="button" class="vi-btn" disabled>Numerical execution blocked by qualification gates</button>'}
  </section>`;
}

function mainLinePanel(projection) {
  const requirement = projection.mainLineRequirement;
  return `<section class="vi-card">
    <div class="vi-section-head"><div><h3>Main-line assessment dependency</h3><p>SBC is a T3 continuation. It consumes the qualified EI main-line assessment; it does not use FIT alone as its main-line authority.</p></div></div>
    <div class="vi-summary">
      <div class="vi-metric"><small>Required source contract</small><strong>${esc(requirement.sourceContract)}</strong></div>
      <div class="vi-metric"><small>FIT-only accepted</small><strong>${requirement.fitOnlyAccepted ? 'YES' : 'NO'}</strong></div>
      <div class="vi-metric"><small>Assessment completeness</small><strong>${requirement.assessmentCompletenessRequired ? 'REQUIRED' : 'NOT REQUIRED'}</strong></div>
    </div>
  </section>`;
}

export function renderSbcConnectionWorkspace(state) {
  const projection = buildSbcWorkspaceProjection(state);
  const selected = projection.types.find((item) => item.selected);
  return `<div class="vi-root">
    <header class="vi-header"><div><h2>Small-Bore Connections</h2><p>Connection-centric EI SBC assessment workspace for governed Type 1–4 qualification and evidence.</p></div>
      <div class="vi-authority"><strong>${esc(projection.lifecycleState)}</strong><span>FULL VERTICAL · SCREENING NOT AUTHORIZED · DESIGN AUTHORITY FALSE</span></div></header>
    <div class="vi-banner warn"><strong>Qualification boundary.</strong><span>The full SBC vertical remains RESERVED. Type 1/2/4 have no authorized numerical execution. Type 3 remains candidate-only and its T3 curves remain quarantined.</span></div>
    <section class="vi-card">
      <div class="vi-import-facts"><span>Calculation: <strong class="vi-mono">${esc(projection.calculationId)}</strong></span><span>Assessment unit: <strong>${esc(projection.assessmentUnitType)}</strong></span><span>Automatic type classification: <strong>OFF</strong></span></div>
      <div class="vi-filterbar"><label>Connection / facility scope<input class="vi-cell-input" data-vi-sbc-workspace-scope value="${esc(projection.scopeId)}" placeholder="Select from facility register or enter exact scope"></label></div>
      <nav class="vi-detail-tabs" aria-label="SBC type selection">${projection.types.map(typeButton).join('')}</nav>
    </section>
    ${mainLinePanel(projection)}
    ${selectedTypePanel(projection)}
    ${selected ? renderSbcConnectionAuthoringPanel(state, selected.typeId) : ''}
    ${selected?.isType3 ? renderSbcType3UserInputPanel(state) : ''}
  </div>`;
}
