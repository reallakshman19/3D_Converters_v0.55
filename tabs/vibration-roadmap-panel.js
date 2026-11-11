import { isVibrationRoadmapNavigationDiagnostic } from './vibration-roadmap-navigation-diagnostic.js';
import { renderVibrationRoadmapMechanismSummary } from './vibration-roadmap-mechanism-summary-view.js';
import { buildVibrationRoadmapWorkflowPresentation } from './vibration-roadmap-workflow-view.js';
import { resolveVibrationCaseActionWorkspace } from './vibration-roadmap-workspace-routing.js';
import {
  formatVibrationRoadmapScopeChoiceLabel,
  isGovernedVibrationRoadmapScopeChoices,
} from './vibration-roadmap-scope-selection.js';

const ROADMAP_PANEL_ID = 'vibration-roadmap-panel';
const ROADMAP_HEADING_ID = 'vibration-roadmap-heading';
const ROADMAP_CONTENT_ID = 'vibration-roadmap-content';
const ROADMAP_MIN_WIDTH = 260;
const ROADMAP_DEFAULT_WIDTH = 320;
const ROADMAP_MAX_WIDTH = 520;

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

function nodeBody(node, label) {
  const detail = node.detail ? `<small>${esc(node.detail)}</small>` : '';
  return `<span><strong>${esc(node.label)}</strong><small>${esc(node.specialty)}</small>${sourceLine(node)}</span><span class="vibration-roadmap-status">${esc(label)}${detail}</span>`;
}

function renderNode(node, activeCalculationId) {
  const label = STATUS_LABELS[node.status] ?? node.status;
  const active = node.target?.calculationId === activeCalculationId ? ' is-active' : '';
  const common = `class="vibration-roadmap-node${active}${node.target ? '' : ' is-informational'}" data-roadmap-node-id="${esc(node.id)}" data-roadmap-status="${esc(node.status)}"${targetAttributes(node)}`;
  if (!node.target) return `<div ${common}>${nodeBody(node, label)}</div>`;
  return `<button type="button" ${common}>${nodeBody(node, label)}</button>`;
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

function liveFeedbackAttributes(kind) {
  return kind === 'error'
    ? ' role="alert" aria-live="assertive" aria-atomic="true"'
    : ' role="status" aria-live="polite" aria-atomic="true"';
}

function projectTools(context) {
  const lines = context?.projectLines ?? [];
  const title = context?.projectTitle || 'No project loaded';
  const linePicker = lines.length ? `<label>Current line<select data-roadmap-line-select>${lines.map((line) => `<option value="${esc(line.lineId)}" ${line.lineId === context.lineId ? 'selected' : ''}>${esc(line.label)}</option>`).join('')}</select></label>` : '';
  const messageKind = context?.projectMessageKind ?? 'info';
  const message = context?.projectMessage
    ? `<div class="vibration-roadmap-message" data-kind="${esc(messageKind)}"${liveFeedbackAttributes(messageKind)}>${esc(context.projectMessage)}</div>` : '';
  return `<section class="vibration-roadmap-project"><div class="vibration-roadmap-project-title"><small>Current project</small><strong>${esc(title)}</strong><small>Project persistence only · imported results require registered rerun</small></div>${linePicker}<div class="vibration-roadmap-project-actions"><button type="button" data-roadmap-action="import-eit">Import EI .eit</button><button type="button" data-roadmap-action="open-project">Open project</button><button type="button" data-roadmap-action="save-project" ${context?.projectId ? '' : 'disabled'}>Save project</button><input type="file" accept=".eit,application/json" data-roadmap-eit-file hidden><input type="file" accept=".vibproj,application/json" data-roadmap-project-file hidden></div>${message}</section>`;
}

function navigationFeedback(context) {
  const diagnostic = context?.navigationDiagnostic;
  if (!isVibrationRoadmapNavigationDiagnostic(diagnostic)) return '';
  return `<div class="vibration-roadmap-message vibration-roadmap-navigation-message" data-kind="error" data-roadmap-navigation-message data-roadmap-navigation-code="${esc(diagnostic.code)}" role="alert" aria-live="assertive" aria-atomic="true"><strong>Navigation unavailable</strong><span>${esc(diagnostic.message)}</span><small>UI routing diagnostic only · no engineering authority and no calculation blocking.</small></div>`;
}

function selectedAssessmentValidation(context) {
  const selected = context?.selectedAssessment;
  if (selected == null) return Object.freeze({ status: null, diagnosticCode: null });
  if (selected?.schema !== 'VibrationIntegrityRoadmapAssessmentContext.v1') {
    return Object.freeze({ status: null, diagnosticCode: 'VIBRATION_ROADMAP_SELECTED_ASSESSMENT_SCHEMA_INVALID' });
  }
  const selectedAuthority = selected.authority;
  if (selectedAuthority?.purpose !== 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY'
    || selectedAuthority?.determinesApplicability !== false
    || selectedAuthority?.determinesCompleteness !== false
    || selectedAuthority?.createsCaseIdentity !== false
    || selectedAuthority?.persistenceAuthority !== 'NONE') {
    return Object.freeze({ status: null, diagnosticCode: 'VIBRATION_ROADMAP_SELECTED_ASSESSMENT_AUTHORITY_INVALID' });
  }
  const status = selected.lineCaseAssessmentStatus;
  if (status?.schema !== 'VibrationLineCaseAssessmentStatus.v1') {
    return Object.freeze({ status: null, diagnosticCode: 'VIBRATION_ROADMAP_LINE_CASE_STATUS_SCHEMA_INVALID' });
  }
  const statusAuthority = status.authority;
  if (statusAuthority?.purpose !== 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY'
    || statusAuthority?.determinesApplicability !== false
    || statusAuthority?.determinesCompleteness !== false) {
    return Object.freeze({ status: null, diagnosticCode: 'VIBRATION_ROADMAP_LINE_CASE_STATUS_AUTHORITY_INVALID' });
  }
  return Object.freeze({ status, diagnosticCode: null });
}

function assessmentScopeSelector(context) {
  const scopes = context?.selectedAssessment?.scopeChoices;
  if (!isGovernedVibrationRoadmapScopeChoices(scopes) || scopes.choices.length < 2) return '';
  const options = scopes.choices.map((choice) => {
    const label = formatVibrationRoadmapScopeChoiceLabel(choice);
    return `<option value="${esc(choice.rowKey)}" ${choice.rowKey === scopes.selectedRowKey ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `<label>Assessment scope<select data-roadmap-assessment-select>${options}</select></label>`;
}

function selectedAssessmentAction(status) {
  const route = resolveVibrationCaseActionWorkspace(status.nextActionCode);
  if (!route) return '<small>No central workspace route is registered for this case action.</small>';
  return `<button type="button" class="vibration-roadmap-focus-action" data-vibration-workspace-id="${esc(route.workspaceId)}" data-vibration-workflow-action="${esc(route.actionCode)}">Open case task</button>`;
}

function selectedAssessmentDiagnostic(validation) {
  if (!validation?.diagnosticCode) return '';
  return `<section class="vibration-roadmap-assessment-diagnostic" data-selected-assessment-diagnostic data-selected-assessment-diagnostic-code="${esc(validation.diagnosticCode)}" role="status" aria-live="polite" aria-atomic="true"><strong>Selected assessment context unavailable</strong><span>The right-rail projection rejected the selected-assessment authority envelope and remained fail-closed.</span><small>${esc(validation.diagnosticCode)} · UI diagnostic only · no applicability, completeness, screening, design or calculation authority.</small></section>`;
}

function renderSelectedAssessment(context, validation) {
  const status = validation?.status;
  if (!status) return '';
  const scope = status.scope ?? {};
  const caseLabel = scope.caseId || 'No case ID';
  const action = ASSESSMENT_ACTION_LABELS[status.nextActionCode] ?? status.nextActionCode;
  const evidence = `EI ${status.completeness?.state ?? 'UNKNOWN'} · Screening ${status.screeningEvidence?.state ?? 'NONE'}`;
  return `<section class="vibration-roadmap-assessment" data-line-case-workflow-state="${esc(status.state)}"><small class="vibration-roadmap-eyebrow">Selected assessment</small><strong>${esc(scope.line)} · ${esc(caseLabel)}</strong><span class="vibration-roadmap-assessment-id">${esc(scope.canonicalId)}</span>${assessmentScopeSelector(context)}<span class="vibration-roadmap-focus-status">${esc(status.state)}</span><small class="vibration-roadmap-eyebrow">Case next action</small><span>${esc(action)}</span>${selectedAssessmentAction(status)}<small>${esc(evidence)}</small><small>Exact register scope · project mapping not asserted · workflow projection only</small></section>`;
}

function renderSelectedMechanisms(context, validation) {
  if (!validation?.status) return '';
  return renderVibrationRoadmapMechanismSummary(context?.selectedAssessment?.mechanismSummary);
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

function resizeHandle(collapsed, width) {
  if (collapsed) return '';
  const currentWidth = width ?? ROADMAP_DEFAULT_WIDTH;
  return `<div class="vibration-roadmap-resize" data-roadmap-resize role="separator" aria-orientation="vertical" aria-label="Resize vibration roadmap" aria-valuemin="${ROADMAP_MIN_WIDTH}" aria-valuemax="${ROADMAP_MAX_WIDTH}" aria-valuenow="${currentWidth}" aria-valuetext="${currentWidth} pixels" aria-controls="${ROADMAP_PANEL_ID}" tabindex="0"></div>`;
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
  const assessmentValidation = selectedAssessmentValidation(projection.context);
  return `<aside id="${ROADMAP_PANEL_ID}" class="vibration-roadmap-panel${collapsedClass}" data-vibration-roadmap-panel${widthAttribute} aria-labelledby="${ROADMAP_HEADING_ID}">${resizeHandle(collapsed, panelWidth)}<header><div><strong id="${ROADMAP_HEADING_ID}">Vibration Assessment</strong><small>Right-panel workflow guidance · no applicability, completeness, screening or design authority</small></div><button type="button" class="vibration-roadmap-collapse" data-roadmap-collapse aria-label="${collapsed ? 'Expand' : 'Collapse'} vibration roadmap" aria-expanded="${collapsed ? 'false' : 'true'}" aria-controls="${ROADMAP_CONTENT_ID}">${collapsed ? '‹' : '›'}</button></header><div id="${ROADMAP_CONTENT_ID}" class="vibration-roadmap-scroll">${projectTools(projection.context)}${navigationFeedback(projection.context)}${selectedAssessmentDiagnostic(assessmentValidation)}${renderSelectedAssessment(projection.context, assessmentValidation)}${renderSelectedMechanisms(projection.context, assessmentValidation)}${renderNextAttention(workflow)}<div class="vibration-roadmap-workflow-label"><strong>Workflow</strong><small>Existing governed roadmap states · phase labels are not completion claims</small></div>${phases}</div></aside>`;
}

export function mountVibrationRoadmapPanel(host, projection, options = {}) {
  if (!host) throw new TypeError('Vibration roadmap panel host is required.');
  host.innerHTML = renderVibrationRoadmapPanel(projection, options);
  return () => { host.innerHTML = ''; };
}
