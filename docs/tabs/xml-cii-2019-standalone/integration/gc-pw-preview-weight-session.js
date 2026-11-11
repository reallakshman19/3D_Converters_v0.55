// XML-CII domain adapter: use the real merged Preview Basis, GC-PW full-population
// bridge, and production-bound Weight Review service. No DOM, worker or writer bypass.
// Producer callback MUST be supplied by the actual Preview fact pipeline.
import {
  createPreviewBasis,
} from '../ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {
  verifyPhysicalFactPages, toWeightFacts,
} from '../../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {
  canonicalJson, digestUtf8, digestCanonical, assertBasisDigest,
} from '../../../contracts/gc-pw-v1/contract.mjs';
import {
  createAttestedWeightReviewService,
} from '../../../converters/xml-cii2019-core/weight-facts-attested-session.js';
import {
  createXmlCiiFactWeightScorer,
} from '../../../converters/xml-cii2019-core/weight-facts-xml-cii-adapter.js';

const DOMAIN = 'xml-cii/2019';
export class GcPwSessionError extends Error {
  constructor(code, detail) {
    super(code + ': ' + detail);
    this.name = 'GcPwSessionError';
    this.code = code;
    this.retryable = false;
  }
}
const reject = (code, detail) => { throw new GcPwSessionError(code, detail); };
const required = (valid, code, detail) => { if (!valid) reject(code, detail); };
const asString = (value, path) => {
  required(typeof value === 'string', 'TEXT_REQUIRED', path);
  return value;
};
const asObject = (value, path) => {
  required(value && typeof value === 'object' && !Array.isArray(value), 'OBJECT_REQUIRED', path);
  return value;
};

function custodyForWeight({ basis, live, physicalOccurrences }) {
  // The attested Weight session checks the ACTUAL source/master text against
  // hashes created by Preview, independently from the common occurrence bridge.
  const sourceTexts = Object.fromEntries(Object.entries(live.sources)
    .map(([sourceId, value]) => [sourceId, asString(value, 'sources.' + sourceId)]));
  const masters = Object.fromEntries(Object.entries(live.masters)
    .map(([name, value]) => [name, {
      datasetText: canonicalJson(value.rows),
      mappingText: canonicalJson(value.mapping ?? null),
    }]));
  const occurrenceIdsBySource = Object.fromEntries(
    basis.sourceRefs.map(({ sourceId }) => [sourceId, []]));
  for (const item of physicalOccurrences) {
    const id = JSON.stringify([item.sourceId, item.branchOccurrenceIndex,
      item.nodeOrdinal, item.componentSignature]);
    // The bridge will verify that id is canonical before any Weight open.
    required(Object.hasOwn(occurrenceIdsBySource, item.sourceId),
      'UNSELECTED_SOURCE', item.sourceId);
    occurrenceIdsBySource[item.sourceId].push(id);
  }
  return {
    sourceTexts,
    masters,
    selectionText: canonicalJson(live.selection),
    stagedSourceText: live.stagedSource,
    configText: canonicalJson(live.config ?? null),
    overridesText: canonicalJson(live.overrides ?? null),
    occurrenceIdsBySource,
  };
}

// A real producer must return completed, basis-pinned Page<FactRecord>[].
// This is a typed integration entrypoint, NOT a synchronous Preview fallback.
export async function openGcPwPreviewWeightSession({
  sources, masters, selection, stagedSource = null, config = {}, overrides = {},
  originalOccurrences, expectedOriginalCount, physicalOccurrences,
  requiredFieldIds, requestId, loadFactPages, scoringConfig,
} = {}) {
  required(Array.isArray(sources) && sources.length > 0,
    'MISSING_SOURCES', 'At least one original XML source');
  required(Array.isArray(selection) && selection.length > 0,
    'MISSING_SELECTION', 'Selected source scope');
  required(asObject(masters, 'masters'), 'MISSING_MASTERS', 'Masters');
  required(Array.isArray(physicalOccurrences), 'MISSING_PHYSICAL', 'Canonical physical occurrence list');
  required(typeof loadFactPages === 'function', 'MISSING_WORKER_PRODUCER',
    'Cannot create an authoritative session without the fact read-model producer');
  required(typeof requestId === 'string' && requestId.trim().length > 0,
    'INVALID_REQUEST_ID', 'Caller-issued unique worker request ID');
  const basis = await createPreviewBasis({
    domainId: DOMAIN, sources, selection, masters,
    stagedSource, config, overrides, sha256: digestUtf8,
  });
  await assertBasisDigest(basis);

  // Actual loaded source+master buffers are not copied from legacy caches or
  // an inferred element count; changing them during async work is detected.
  // Re-read mutable caller-controlled source objects after the worker returns;
  // do not silently attest a stale string captured before an asynchronous edit.
  const readLive = () => ({
    sources: Object.fromEntries(sources.map(item => [item.sourceId, item.text])),
    masters, selection, stagedSource, config, overrides,
  });
  const scorer = createXmlCiiFactWeightScorer(scoringConfig ?? config);
  // The portable service already supports a SHA-256-attested review command
  // ledger. Enable read-only export *inside* the source-held Worker so a
  // decision-provenance audit can distinguish actual accepted commands from
  // draft UI proposals, without adding a second review store.
  const review = createAttestedWeightReviewService({
    score: scorer, digestUtf8, digestCanonical,digestReview:digestCanonical,
  });
  const job = review.openBasisJob(basis, {
    requestId,
    loadFacts: async ({ basis: candidate, requestId: active, report, isCancelled }) => {
      required(candidate.basisId === basis.basisId, 'BASIS_MISMATCH',
        'Weight worker must read the Preview-approved source/master revision');
      if (isCancelled()) reject('CANCELLED', 'Source fact job was cancelled');
      const pages = await loadFactPages({
        basis: candidate, requestId: active, report, isCancelled,
        sourceRefs: candidate.sourceRefs,
      });
      if (isCancelled()) reject('CANCELLED', 'Stale source fact page job');
      const projection = await verifyPhysicalFactPages({
        basis, live: readLive(), originalOccurrences, expectedOriginalCount,
        physicalOccurrences, requiredFieldIds,
        expectedSubjectType: 'physical-component', pages,
      });
      if (isCancelled()) reject('CANCELLED', 'Stale verified source facts');
      // Separate content attestation is repeated in Weight's production wrapper.
      return {
        facts: toWeightFacts(projection),
        custody: custodyForWeight({ basis, live: readLive(), physicalOccurrences }),
      };
    },
  });
  const report = () => review.subscribeJob(job.requestId);
  return Object.freeze({
    basisId: basis.basisId,
    requestId: job.requestId,
    subscribeJob: report,
    cancel: () => review.cancelJob(job.requestId),
    async awaitReady() {
      const terminal = await review.awaitJob(job.requestId);
      if (terminal.event !== 'completed') {
        reject(terminal.error?.code ?? (terminal.event === 'cancelled' ? 'CANCELLED' : 'INCOMPLETE_JOB'),
          terminal.error?.message ?? ('Weight review facts not opened: ' + terminal.event));
      }
      const publicFacts = review.getFacts({ basisId: basis.basisId, subjectType: 'physical-component' });
      required(publicFacts.complete && publicFacts.totalCount > 0,
        'EMPTY_FACT_SESSION', 'No source fact fields were opened for review');
      // Returning the actual review service is safe only after both gates passed.
      // It still requires explicit CAS commands to accept Match-1 / Final decisions.
      return Object.freeze({ basis, review, openedFacts: publicFacts.totalCount });
    },
  });
}
