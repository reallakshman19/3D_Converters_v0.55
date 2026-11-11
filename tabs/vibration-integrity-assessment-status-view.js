import { buildVibrationCompletenessPresentation } from './vibration-integrity-completeness-presentation.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderVibrationLineCaseAssessmentStatusCell(status) {
  const errors = status.identificationEvidence.errors.length
    ? `<small class="vi-mono">${esc(status.identificationEvidence.errors.join('; '))}</small>`
    : '';
  const detail = [
    `T1 ${status.identificationEvidence.status}`,
    `EI ${status.completeness.state}`,
    `Screening ${status.screeningEvidence.state}`,
  ].join(' · ');
  return `<strong>${esc(status.state)}</strong><small>${esc(status.nextActionCode)}</small><small class="vi-mono">${esc(detail)}</small>${errors}`;
}

export function renderVibrationAssessmentCompletenessCell(matrix) {
  const completeness = matrix.assessmentCompleteness;
  const presentation = buildVibrationCompletenessPresentation({
    completeness,
    screeningGoverning: matrix.screeningGoverning,
    candidateGoverning: matrix.candidateGoverning,
  });
  const reasons = Array.isArray(completeness?.reasons) && completeness.reasons.length
    ? completeness.reasons
    : ['IDENTIFICATION_EVIDENCE_MISSING'];
  const detail = reasons.length ? `<small class="vi-mono">${esc(reasons.join('; '))}</small>` : '';
  return `<strong>${esc(presentation.headline)}</strong><small>${esc(presentation.coverageSummary)}</small>${detail}`;
}
