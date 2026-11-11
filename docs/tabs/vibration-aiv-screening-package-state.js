import { isAivLineageCurrent } from './vibration-aiv-engineering-revision.js';

export function isAivCurrentScreeningPackageState(state = {}) {
  return Boolean(
    state?.screeningResult?.ok
    && state.readinessEnvelope
    && isAivLineageCurrent(state, 'screening')
  );
}

export function buildAivScreeningPackageInputFromState(state = {}) {
  if (!isAivCurrentScreeningPackageState(state)) return null;
  const envelope = state.readinessEnvelope;
  return Object.freeze({
    result: state.screeningResult.evidence.domainResult,
    sources: envelope.sources,
    assessments: envelope.assessments,
    relationships: envelope.sourceAssessments,
    topology: envelope.exchange,
    assumptionProfile: state.assumptionProfile,
    assumptionResolution: state.assumptionResolution,
    flareNetwork: state.flareNetworkActive ? state.flareNetwork : null,
    generatedInputSet: state.flareNetworkActive ? state.generatedInputSet : null,
    eitImportEvidence: state.eitImport?.evidence ?? null,
    inventoryCompletenessAttestations: state.inventoryCompletenessAttestations ?? [],
    engineeringInputRevision: state.inputRevision,
  });
}
