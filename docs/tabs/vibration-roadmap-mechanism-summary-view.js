import { isGovernedVibrationRoadmapMechanismSummary } from './vibration-roadmap-mechanism-summary.js';

const GROUP_ORDER = Object.freeze([
  'MAIN_LINE_SECTION',
  'DEADLEG_BRANCH',
  'AIV_SOURCE_ASSESSMENT_PAIR',
  'TRANSIENT_EVENT_PATH',
  'SPECIALIST_SYSTEM',
  'SBC_CONNECTION',
  'INTRUSIVE_ELEMENT',
  'UNCLASSIFIED',
]);

const GROUP_LABELS = Object.freeze({
  MAIN_LINE_SECTION: 'Main-line mechanisms',
  DEADLEG_BRANCH: 'Deadleg branches',
  AIV_SOURCE_ASSESSMENT_PAIR: 'AIV assessments',
  TRANSIENT_EVENT_PATH: 'Transient event paths',
  SPECIALIST_SYSTEM: 'Specialist mechanisms',
  SBC_CONNECTION: 'Small-bore connections',
  INTRUSIVE_ELEMENT: 'Intrusive elements',
  UNCLASSIFIED: 'Identification pending / unclassified',
});

const STATE_LABELS = Object.freeze({
  IDENTIFICATION_MISSING: 'Identify',
  IDENTIFICATION_UNRESOLVED: 'Resolve',
  IDENTIFICATION_UNKNOWN: 'Unknown',
  NOT_APPLICABLE: 'N/A',
  ASSESSMENT_COMPLETE: 'Complete',
  REQUIRED_NOT_IMPLEMENTED: 'Method unavailable',
  REQUIRED_NOT_READY: 'Not ready',
  INPUTS_REQUIRED: 'Inputs required',
  NOT_EVALUATED: 'Not evaluated',
  STALE_RESULT: 'Stale',
  CANDIDATE_ONLY: 'Candidate only',
  REVIEW_REQUIRED: 'Review',
  APPLICABILITY_UNKNOWN: 'Applicability unknown',
  READY_NOT_EXECUTED: 'Ready to run',
  CONTRADICTION: 'Contradiction',
  REQUIRED_INCOMPLETE: 'Incomplete',
});

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function groupKey(item) {
  return GROUP_LABELS[item.assessmentUnitType] ? item.assessmentUnitType : 'UNCLASSIFIED';
}

function grouped(items) {
  return GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => groupKey(item) === group) }))
    .filter((entry) => entry.items.length);
}

function resultLine(item) {
  const values = [];
  if (item.lof != null) values.push(`LOF ${item.lof}`);
  if (item.qualificationState) values.push(item.qualificationState);
  if (item.resultState) values.push(item.resultState);
  return values.length ? `<small>${esc(values.join(' · '))}</small>` : '';
}

function sourceLine(item) {
  if (!item.sourceLabel) return '';
  const reason = item.sourceReason ? ` title="${esc(item.sourceReason)}"` : '';
  return `<small data-mechanism-source-status="${esc(item.sourceStatus ?? 'UNRESOLVED')}"${reason}>${esc(item.sourceLabel)}</small>`;
}

function mechanismRow(item) {
  const stateLabel = STATE_LABELS[item.state] ?? item.state;
  const disposition = `${item.disposition}${item.coverageReason ? ` · ${item.coverageReason}` : ''}`;
  return `<div class="vibration-roadmap-mechanism" data-mechanism-id="${esc(item.mechanismId)}" data-mechanism-state="${esc(item.state)}"><div><strong>${esc(item.label)}</strong>${sourceLine(item)}<small>${esc(disposition)}</small>${resultLine(item)}</div><div class="vibration-roadmap-mechanism-state"><span>${esc(stateLabel)}</span><small>${esc(item.nextAction)}</small></div></div>`;
}

function summaryCounts(summary) {
  const counts = summary.counts;
  return `<div class="vibration-roadmap-mechanism-counts"><span>Required <strong>${esc(counts.required)}</strong></span><span>Complete <strong>${esc(counts.complete)}</strong></span><span>Incomplete <strong>${esc(counts.incomplete)}</strong></span><span>N/A <strong>${esc(counts.notApplicable)}</strong></span></div>`;
}

export function renderVibrationRoadmapMechanismSummary(summary) {
  if (!isGovernedVibrationRoadmapMechanismSummary(summary)) return '';
  const groups = grouped(summary.items).map((entry) => (
    `<div class="vibration-roadmap-mechanism-group"><h4>${esc(GROUP_LABELS[entry.group])}</h4>${entry.items.map(mechanismRow).join('')}</div>`
  )).join('');
  const scopeLabel = `${summary.counts.total}-mechanism scope · guidance only`;
  return `<section class="vibration-roadmap-mechanism-summary" data-guidance-only="true"><div class="vibration-roadmap-workflow-label"><strong>Mechanism guidance</strong><small>${esc(scopeLabel)}</small></div>${summaryCounts(summary)}<small class="vibration-roadmap-mechanism-rule">Advisory/linking only. These states are projected from upstream engineering contracts and do not block execution, navigation, calculation, or persistence.</small>${groups}</section>`;
}
