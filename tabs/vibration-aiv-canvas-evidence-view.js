import { isAivLineageCurrent } from './vibration-aiv-engineering-revision.js';

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function currentAttestationCount(state) {
  return (state?.inventoryCompletenessAttestations ?? []).filter((item) => (
    Number(item?.engineeringInputRevision) === Number(state?.inputRevision)
  )).length;
}

export function renderAivCanvasProjectionCoverageHtml(projection = {}) {
  const coverage = projection?.projectionCoverage;
  if (!coverage || coverage.omittedTotal === 0) return '';
  const omitted = coverage.omittedRows ?? {};
  return `<div class="aivq-banner is-warning" data-aiv-canvas-projection-omissions="true" role="status">
    <strong>Canvas does not represent ${esc(coverage.omittedTotal)} incomplete engineering row(s).</strong>
    <span>Sources ${esc(omitted.sources ?? 0)} · Assessments ${esc(omitted.assessments ?? 0)} · Relationships ${esc(omitted.relationships ?? 0)}. Missing engineering identity is not converted into placeholder nodes; resolve the source rows before treating the graph as visually complete.</span>
  </div>`;
}

export function renderAivCanvasInventoryEvidenceHtml(state = {}) {
  const screeningCurrent = isAivLineageCurrent(state, 'screening');
  const result = screeningCurrent ? state.screeningResult?.evidence?.domainResult : null;
  const inventoryState = result?.lineCaseAssessmentInventoryCompleteness ?? 'UNVERIFIED';
  const verified = inventoryState === 'VERIFIED_COMPLETE';
  const attestations = currentAttestationCount(state);
  const status = screeningCurrent ? inventoryState : 'NOT_CURRENT · RUN SCREENING';
  const className = verified ? 'is-qualified' : 'is-warning';
  return `<div class="aivq-banner ${className}" data-aiv-canvas-inventory-evidence="true" role="status">
    <strong>Welded-discontinuity inventory · ${esc(status)}</strong>
    <span>Current-revision attestations: ${esc(attestations)}. This is completeness evidence only. AIV line/case screening authority remains NOT_AUTHORIZED and design authority remains false.</span>
  </div>`;
}
