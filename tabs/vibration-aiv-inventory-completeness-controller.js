import {
  buildAivInventoryCompletenessScopeCandidates,
  createAivInventoryCompletenessAttestation,
} from '../converters/vibration/aiv/aiv-inventory-completeness.js';
import { cancelAivAsyncOperations } from './vibration-aiv-engineering-revision.js';
import { clearCurrentAivScreeningSession } from './vibration-aiv-screening-session.js';

function text(value) { return String(value ?? '').trim(); }
function scopeKey(line, caseId) { return `${line}\u0000${caseId}`; }

function candidates(state) {
  const envelope = state.readinessEnvelope;
  if (!state.flareNetworkActive || envelope?.exchange?.schema !== 'AivFlareNetworkTopologyExchange.v1') return [];
  return buildAivInventoryCompletenessScopeCandidates({
    topology: envelope.exchange,
    relationships: envelope.sourceAssessments,
  });
}

function clearScreeningOnly(state) {
  cancelAivAsyncOperations(state);
  clearCurrentAivScreeningSession();
  state.screeningState = null;
  state.screeningResult = null;
}

function scopeHost(container, line, caseId) {
  return [...container.querySelectorAll('[data-aiv-inventory-scope]')].find((item) => (
    item.dataset.aivInventoryLine === line && item.dataset.aivInventoryCase === caseId
  )) ?? null;
}

function read(host, selector) { return text(host?.querySelector(selector)?.value); }

export function createAivInventoryCompletenessController({ state, render, container } = {}) {
  function accept(target) {
    const button = target?.closest?.('[data-aiv-inventory-line][data-aiv-inventory-case]');
    const line = text(button?.dataset?.aivInventoryLine);
    const caseId = text(button?.dataset?.aivInventoryCase);
    const scope = candidates(state).find((item) => scopeKey(item.line, item.caseId) === scopeKey(line, caseId));
    if (!scope) throw new Error('AIV_INVENTORY_SCOPE_NOT_READY: Recheck readiness before accepting inventory completeness evidence.');
    const host = scopeHost(container, line, caseId);
    if (!host) throw new Error('AIV_INVENTORY_SCOPE_EDITOR_MISSING: Inventory completeness editor is unavailable.');
    const confirmed = host.querySelector('[data-aiv-inventory-confirm]')?.checked === true;
    const attestation = createAivInventoryCompletenessAttestation({
      topology: state.readinessEnvelope.exchange,
      scope,
      terminalBoundaryCanonicalId: read(host, '[data-aiv-inventory-boundary]'),
      evidenceSource: read(host, '[data-aiv-inventory-evidence-source]'),
      evidenceRevision: read(host, '[data-aiv-inventory-evidence-revision]'),
      reviewer: read(host, '[data-aiv-inventory-reviewer]'),
      reviewedAt: read(host, '[data-aiv-inventory-reviewed-at]'),
      engineeringInputRevision: state.inputRevision,
      completenessStatementAccepted: confirmed,
    });
    state.inventoryCompletenessAttestations = [
      ...(state.inventoryCompletenessAttestations ?? []).filter((item) => scopeKey(item.line, item.caseId) !== scopeKey(line, caseId)),
      attestation,
    ];
    clearScreeningOnly(state);
    state.error = null;
  }

  function revoke(target) {
    const button = target?.closest?.('[data-aiv-inventory-line][data-aiv-inventory-case]');
    const line = text(button?.dataset?.aivInventoryLine);
    const caseId = text(button?.dataset?.aivInventoryCase);
    state.inventoryCompletenessAttestations = (state.inventoryCompletenessAttestations ?? [])
      .filter((item) => scopeKey(item.line, item.caseId) !== scopeKey(line, caseId));
    clearScreeningOnly(state);
    state.error = null;
  }

  function handleAction(action, target) {
    if (!['accept-inventory-completeness', 'revoke-inventory-completeness'].includes(action)) return false;
    try {
      if (action === 'accept-inventory-completeness') accept(target);
      else revoke(target);
    } catch (error) {
      state.error = `${error?.code ? `${error.code}: ` : ''}${String(error?.message || error)}`;
    }
    render();
    return true;
  }

  return Object.freeze({ handleAction });
}
