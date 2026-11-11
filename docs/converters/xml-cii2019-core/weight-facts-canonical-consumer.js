// GC-PW verified canonical occurrence bridge -> Weight decision consumer.
// Browserless; no XML parsing, Preview geometry or HTTP in this module.
import { canonicalJson, digestUtf8, digestCanonical } from '../../contracts/gc-pw-v1/contract.mjs';
import {
  physicalOccurrenceId, verifyPhysicalFactPages, toWeightFacts,
} from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import { createAttestedWeightReviewService } from './weight-facts-attested-session.js';

function independentCustody(basis, live, physicalOccurrences) {
  const sourceTexts = { ...live.sources };
  const occurrenceIdsBySource = {};
  for (const ref of basis.sourceRefs) occurrenceIdsBySource[ref.sourceId] = [];
  for (const occurrence of physicalOccurrences) {
    // The bridge has already validated membership against the independently
    // enumerated original nodes. Never infer identities from rendered facts.
    occurrenceIdsBySource[occurrence.sourceId].push(physicalOccurrenceId(occurrence));
  }
  const masters = {};
  for (const key of Object.keys(basis.masters)) {
    masters[key] = {
      datasetText: canonicalJson(live.masters[key].rows),
      mappingText: canonicalJson(live.masters[key].mapping ?? null),
    };
  }
  return {
    sourceTexts,
    selectionText: canonicalJson(live.selection),
    stagedSourceText: live.stagedSource,
    configText: canonicalJson(live.config ?? null),
    overridesText: canonicalJson(live.overrides ?? null),
    masters,
    occurrenceIdsBySource,
  };
}

export function createCanonicalWeightFactSession({ score, digestReview } = {}) {
  const core = createAttestedWeightReviewService({
    score, digestReview, digestUtf8, digestCanonical,
  });
  const {
    openBasis: _unsafeOpen, openBasisJob: _unsafeJob,
    subscribeJob: _unsafeSubscribe, awaitJob: _unsafeAwait,
    cancelJob: _unsafeCancel, ...review
  } = core;
  return Object.freeze({
    ...review,
    async openCanonicalFacts(input) {
      // Copy the complete trusted input before the first await to prevent
      // concurrent host mutation across the bridge and Weight attestations.
      const leased = JSON.parse(canonicalJson(input));
      const { basis, live, physicalOccurrences } = leased;
      const projected = await verifyPhysicalFactPages({
        ...leased, expectedSubjectType: 'physical-component',
      });
      const attested = await core.openBasis(basis, {
        facts: toWeightFacts(projected),
        custody: independentCustody(basis, live, physicalOccurrences),
      });
      return {
        ...attested,
        verifiedOriginalCount: projected.verifiedOriginalCount,
        verifiedPhysicalCount: projected.verifiedPhysicalCount,
        verifiedFactCount: projected.verifiedFactCount,
      };
    },
  });
}
