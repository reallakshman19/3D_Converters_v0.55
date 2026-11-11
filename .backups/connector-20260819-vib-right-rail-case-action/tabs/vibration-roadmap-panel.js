import { buildVibrationRoadmapWorkflowPresentation } from './vibration-roadmap-workflow-view.js';

const STATUS_LABELS = Object.freeze({
  AVAILABLE: 'Available',
  DATA: 'Data',
  IMPORTED: 'Imported',
  CURRENT_RESULT: 'Current',
  STALE: 'Stale',
  ATTENTION: 'Attention',
  ACTION: 'Action',
  NOT_APPLICABLE: 'Not applicable',
});

const ASSESSMENT_ACTION_LABELS = Object.freeze({
  RESTORE_IDENTIFICATION_RESOLUTION: 'Restore identification resolution',
  AUTHOR_T1_IDENTIFICATION: 'Author T1 identification',
  COMPLETE_T1_IDENTIFICATION_EVIDENCE: 'Complete T1 identification evidence',
  CORRECT_T1_IDENTIFICATION_EVIDENCE: 'Correct T1 identification evidence',
  AUTHOR_MISSING_MECHANISM_IDENTIFICATIONS: 'Identify remaining mechanisms',
  RESOLVE_T1_IDENTIFICATION_DISPOSITIONS: 'Resolve T1 dispositions',
  COMPLETE_REQUIRED_ASSESSMENTS: 'Complete required assessments',
  REVIEW_ASSESSMENT_GAPS: 'Review assessment gaps',
  REVIEW_COMPLETE_ASSESSMENT_EVIDENCE: 'Review complete assessment evidence',
  REVIEW_NOT_APPLICABLE_EVIDENCE: 'Review not-applicable evidence',
});

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function targetAttributes(node) {
  if (node.target?.type === 'CALCULATION' && node.target.calculationId) {
    return ` data-calc-id="${esc(node.target.calculationId)}"`;
  }
  if (node.target?.type === 'WORKSPACE' && node.target.workspaceId) {
    return ` data-vibration-workspace-id="${esc(node.target.workspaceId)}"`;
  }
  return '';
}

function sourceLine(node) {
  const source = node.source;
  if (!source) return '';
  const title = source.reason ? ` title="${esc(source.reason)}"` : '';
  return `<small class="vibration-roadmap-source" data-source-status="${esc(source.status)}"${title}>${esc(source.displayLabel)}</small>`;
}

function renderNode(node, activeCalculationId) {
  const label = STATUS_LABELS[node.status] ?? node.status;
  const detail = node.detail ? `<small>${esc(node.detail)}</small>` : '';
  const disabled = node.target ? '' : ' aria-disabled="true"';
  const active = node.target?.calculationId === activeCalculationId ? ' is-active' : '';
  return `<button type="button" class="vibration-roadmap-node${active}" data-roadmap-status="${esc(node.status)}"${targetAttributes(node)}${disabled}><span><strong>${esc(node.label)}</strong><small>${esc(node.specialty)}</small>${sourceLine(node)}</span><span class="vibration-roadmap-status">${esc(label)}${detail}</span></button>`;
}

function scopeGroups(nodes) {
  const order = ['MAINLINE', 'BRANCH_ATTACHMENT', 'CROSS_BOUNDARY', 'CROSS_SCOPE'];
  return order.map((scope) => ({ scope, nodes: nodes.filter((node) => node.scope === scope) }))
    .filter((group) => group.nodes.length);
}

function scopeLabel(scope) {
  return {
    MAINLINE: 'Mainline',
    BRANCH_ATTACHMENT: 'Branch / attachment',
    CROSS_BOUNDARY: 'Cross-boundary',
    CROSS_SCOPE: 'General',
  }[scope] ?? scope;
}

function renderPhase(phase, activeCalculationId, focusPhaseId) {
  const body = scopeGroups(phase.nodes).map((group) => (
    `<div class="vibration-roadmap-scope"><h4>${esc(scopeLabel(group.scope))}</h4>${group.nodes.map((node) => renderNode(node, activeCalculationId)).join('')}</div>`
  )).join('');
  const focus = phase.id === focusPhaseId ? ' is-workflow-focus' : '';
  return `<section class="vibration-roadmap-phase${focus}" data-roadmap-phase="${esc(phase.id)}" data-workflow-phase-state="${esc(phase.state)}"><div class="vibration-roadmap-phase-head"><span class="vibration-roadmap-step">${phase.step}</span><h3>${esc(phase.label)}</h3><small>${esc(phase.stateLabel)}</small></div>${body}</section>`;
}

function projectTools(context) {
  const lines = context?.projectLines ?? [];
  const title = context?.projectTitle || 'No project loaded';
  const linePicker = lines.length ? `<label>Current line<select data-roadmap-line-select>${lines.map((line) => `<option value="${esc(line.lineId)}" ${line.lineId === context.lineId ? 'selected' : ''}>${esc(line.label)}</option>`).join('')}</select></label>` : '';
  const message = context?.projectMessage
    ? `<div class="vibration-roadmap-message" data-kind="${esc(context.projectMessageKind ?? 'info')}">${esc(context.projectMessage)}</div>` : '';
  return `<section class="vibration-roadmap-project"><div class="vibration-roadmap-project-title"><small>Current project</small><strong>${esc(title)}</strong><small>Project persistence only · imported results require registered rerun</small></div>${linePicker}<div class="vibration-roadmap-project-actions"><button type="button" data-roadmap-action="import-eit">Import EI .eit</button><button type="button" data-roadmap-action="open-project">Open project</button><button type="button" data-roadmap-action="save-project" ${context?.projectId ? '' : 'disabled'}>Save project</button><input type="file" accept=".eit,application/json" data-roadmap-eit-file hidden><input type="file" accept=".vibproj,application/json" data-roadmap-project-file hidden></div>${message}</section>`;
}

function governedSelectedAssessment(context) {
  const selected = context?.selectedAssessment;
  const status = selected?.lineCaseAssessmentStatus;
  const selectedAuthority = selected?.authority;
  const statusAuthority = status?.authority;
  const valid = selected?.schema === 'VibrationIntegrityRoadmapAssessmentContext.v1'
    && selectedAuthority?.purpose === 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY'
    && selectedAuthority?.determinesApplicability === false
    && selectedAuthority?.determinesCompleteness === false
    && selectedAuthority?.createsCaseIdentity === false
    && selectedAuthority?.persistenceAuthority === 'NONE'
    && status?.schema === 'VibrationLineCaseAssessmentStatus.v1'
    && statusAuthority?.purpose === 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY'
    && statusAuthority?.determinesApplicability === false
    && statusAuthority?.determinesCompleteness === false;
  return valid ? status : null;
}

function renderSelectedAssessment(context) {
  const status = governedSelectedAssessment(context);
  if (!status) return '';
  const scope = status.scope ?? {};
  const caseLabel = scope.caseId || 'No case ID';
  const action = ASSESSMENT_ACTION_LABELS[status.nextActionCode] ?? status.nextActionCode;
  const evidence = `EI ${status.completeness?.state ?? 'UNKNOWN'} · Screening ${status.screeningEvidence?.state ?? 'NONE'}`;
  return `<section class="vibration-roadmap-assessment" data-line-case-workflow-state="${esc(status.state)}"><small class="vibration-roadmap-eyebrow">Selected assessment</small><strong>${esc(scope.line)} · ${esc(caseLabel)}</strong><span class="vibration-roadmap-assessment-id">${esc(scope.canonicalId)}</span><span class="vibration-roadmap-focus-status">${esc(status.state)}</span><small class="vibration-roadmap-eyebrow">Case next action</small><span>${esc(action)}</span><small>${esc(evidence)}</small><small>Exact register scope · project mapping not asserted · workflow projection only</small></section>`;
}

function renderNextAttention(workflow) {
  const next = workflow.nextAttention;
  if (!next) {
    return `<section class="vibration-roadmap-focus"><small class="vibration-roadmap-eyebrow">Workflow focus</small><strong>No roadmap attention flag</strong><span>Use the phase list to continue. This does not mean the assessment is complete.</span></section>`;
  }
  const node = next.node;
  const status = STATUS_LABELS[node.status] ?? node.status;
  const detail = node.detail ? `<span>${esc(node.detail)}</span>` : '';
  const action = node.target
    ? `<button type="button" class="vibration-roadmap-focus-action"${targetAttributes(node)}>Open task</button>`
    : '<small>No direct workspace target is registered for this roadmap item.</small>';
  return `<section class="vibration-roadmap-focus" data-workflow-focus-phase="${esc(next.phaseId)}"><small class="vibration-roadmap-eyebrow">Next attention · ${esc(next.phaseLabel)}</small><strong>${esc(node.label)}</strong><span class="vibration-roadmap-focus-status">${esc(status)}</span>${detail}${action}</section>`;
}

function numericWidth(width) {
  const value = Number(width);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function resizeHandle(collapsed) {
  return collapsed ? '' : '<div class="vibration-roadmap-resize" data-roadmap-resize role="separator" aria-orientation="vertical" aria-label="Resize vibration roadmap" tabindex="0"></div>';
}

export function renderVibrationRoadmapPanel(projection, { collapsed = false, width = null } = {}) {
  if (projection?.schema !== 'VibrationRoadmapProjection.v1') {
    throw new TypeError('Vibration roadmap panel requires VibrationRoadmapProjection.v1.');
  }
  const workflow = buildVibrationRoadmapWorkflowPresentation(projection);
  const activeCalculationId = projection.context?.calculationId ?? null;
  const collapsedClass = collapsed ? ' is-collapsed' : '';
  const panelWidth = numericWidth(width);
  const widthAttribute = panelWidth == null ? '' : ` data-roadmap-width="${panelWidth}"`;
  const phases = workflow.phases.map((phase) => renderPhase(
    phase, activeCalculationId, workflow.focusPhaseId,
  )).join('');
  return `<aside class="vibration-roadmap-panel${collapsedClass}" data-vibration-roadmap-panel${widthAttribute}>${resizeHandle(collapsed)}<header><div><strong>Vibration Assessment</strong><small>Right-panel workflow guidance · no applicability, completeness, screening or design authority</small></div><button type="button" class="vibration-roadmap-collapse" data-roadmap-collapse aria-label="${collapsed ? 'Expand' : 'Collapse'} vibration roadmap">${collapsed ? '‹' : '›'}</button></header><div class="vibration-roadmap-scroll">${projectTools(projection.context)}${renderSelectedAssessment(projection.context)}${renderNextAttention(workflow)}<div class="vibration-roadmap-workflow-label"><strong>Workflow</strong><small>Existing governed roadmap states · phase labels are not completion claims</small></div>${phases}</div></aside>`;
}

export function mountVibrationRoadmapPanel(host, projection, options = {}) {
  if (!host) throw new TypeError('Vibration roadmap panel host is required.');
  host.innerHTML = renderVibrationRoadmapPanel(projection, options);
  return () => { host.innerHTML = ''; };
}
