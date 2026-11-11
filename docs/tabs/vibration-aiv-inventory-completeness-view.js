import { buildAivInventoryCompletenessScopeCandidates } from '../converters/vibration/aiv/aiv-inventory-completeness.js';

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function scopeKey(line, caseId) { return `${line}\u0000${caseId}`; }
function acceptedFor(state, scope) {
  return (state.inventoryCompletenessAttestations ?? []).find((item) => (
    scopeKey(item.line, item.caseId) === scopeKey(scope.line, scope.caseId)
      && Number(item.engineeringInputRevision) === Number(state.inputRevision)
  )) ?? null;
}
function option(value, label, selected = false) {
  return `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
}
function scopeRow(state, scope, boundaries) {
  const accepted = acceptedFor(state, scope);
  const evidence = accepted?.evidence ?? {};
  const boundaryOptions = [option('', 'Select first-major-vessel boundary…', !accepted?.terminalBoundaryCanonicalId)]
    .concat(boundaries.map((item) => option(item.canonicalId, `${item.canonicalId} · ${item.tag ?? 'Boundary'}`, item.canonicalId === accepted?.terminalBoundaryCanonicalId)))
    .join('');
  const status = accepted
    ? '<span class="aivq-status ok">ATTESTED · CURRENT INPUT REVISION</span>'
    : '<span class="aivq-status gap">NOT ATTESTED</span>';
  return `<section class="aivq-card" data-aiv-inventory-scope="true" data-aiv-inventory-line="${esc(scope.line)}" data-aiv-inventory-case="${esc(scope.caseId)}">
    <div class="aivq-section-head"><div><h4>Inventory completeness · ${esc(scope.line)} · ${esc(scope.caseId)}</h4><p>Machine scope: ${scope.sourceCanonicalIds.length} source(s), ${scope.assessmentCanonicalIds.length} current welded-discontinuity assessment(s).</p></div>${status}</div>
    <div class="aivq-grid">
      <div><small>Sources</small><strong>${esc(scope.sourceCanonicalIds.join(', '))}</strong></div>
      <div><small>Assessments</small><strong>${esc(scope.assessmentCanonicalIds.join(', '))}</strong></div>
      <label><small>First major vessel boundary</small><select data-aiv-inventory-boundary>${boundaryOptions}</select></label>
      <label><small>Evidence source</small><input data-aiv-inventory-evidence-source value="${esc(evidence.source ?? '')}" placeholder="P&ID / line list / isometric reference"></label>
      <label><small>Evidence revision</small><input data-aiv-inventory-evidence-revision value="${esc(evidence.revision ?? '')}" placeholder="Rev / issue"></label>
      <label><small>Reviewer</small><input data-aiv-inventory-reviewer value="${esc(evidence.reviewer ?? '')}" placeholder="Vibration engineer"></label>
      <label><small>Reviewed at (ISO)</small><input data-aiv-inventory-reviewed-at value="${esc(evidence.reviewedAt ?? '')}" placeholder="2026-08-18T19:30:00+04:00"></label>
    </div>
    <label class="aivq-readiness-note"><input type="checkbox" data-aiv-inventory-confirm${accepted ? ' checked' : ''}> I confirm that all relevant welded discontinuities downstream of the listed AIV sources to this first major vessel are represented as current Assessment nodes for this line/case.</label>
    <div class="aiv-canvas-editor-toolbar">
      <button type="button" class="engineering-console-btn primary" data-aiv-action="accept-inventory-completeness" data-aiv-inventory-line="${esc(scope.line)}" data-aiv-inventory-case="${esc(scope.caseId)}">Accept completeness evidence</button>
      <button type="button" class="engineering-console-btn" data-aiv-action="revoke-inventory-completeness" data-aiv-inventory-line="${esc(scope.line)}" data-aiv-inventory-case="${esc(scope.caseId)}">Revoke</button>
    </div>
    <div class="aivq-readiness-note"><strong>Authority boundary:</strong> acceptance establishes evidence custody only. Stage-9 line/case screening authority remains false until a separate authority-promotion qualification is completed.</div>
  </section>`;
}

export function renderAivInventoryCompletenessHtml(state = {}) {
  const envelope = state.readinessEnvelope;
  if (!state.flareNetworkActive) {
    return '<section class="aivq-card"><h4>Welded-discontinuity inventory completeness</h4><div class="aivq-readiness-note">Completeness verification requires NETWORK_DRIVEN AIV topology. Table/import-only topology can support assessment screening but cannot establish this inventory evidence contract.</div></section>';
  }
  if (envelope?.exchange?.schema !== 'AivFlareNetworkTopologyExchange.v1') {
    return '<section class="aivq-card"><h4>Welded-discontinuity inventory completeness</h4><div class="aivq-readiness-note">Run readiness on the authored flare network before attesting completeness.</div></section>';
  }
  const scopes = buildAivInventoryCompletenessScopeCandidates({
    topology: envelope.exchange,
    relationships: envelope.sourceAssessments,
  });
  const boundaries = (envelope.exchange.elements ?? []).filter((item) => item.type === 'BOUNDARY');
  if (!scopes.length) {
    return '<section class="aivq-card"><h4>Welded-discontinuity inventory completeness</h4><div class="aivq-readiness-note">No applicable line/case inventory scopes are available from current readiness.</div></section>';
  }
  const boundaryWarning = boundaries.length
    ? ''
    : '<div class="aivq-banner is-warning"><strong>No BOUNDARY node available.</strong><span>Add an explicit first-major-vessel BOUNDARY node and connect the directed engineering path before completeness can be attested.</span></div>';
  return `<section class="aivq-card"><div class="aivq-section-head"><div><h4>Welded-discontinuity inventory completeness</h4><p>Human attestation + machine topology verification, bound to engineering input revision ${esc(state.inputRevision)}.</p></div></div>
    ${boundaryWarning}
    <div class="aivq-readiness-note">Any engineering input/topology edit automatically revokes accepted attestations. Ambiguous paths, off-page nodes, stale revisions, missing assessments, or boundary mismatch fail closed.</div>
  </section>${scopes.map((scope) => scopeRow(state, scope, boundaries)).join('')}`;
}
