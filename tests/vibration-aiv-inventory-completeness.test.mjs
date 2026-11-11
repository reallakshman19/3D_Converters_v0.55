import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIV_INVENTORY_REQUIRED_EXTENT,
  buildAivInventoryCompletenessScopeCandidates,
  createAivInventoryCompletenessAttestation,
  verifyAivInventoryCompletenessForLineCase,
} from '../converters/vibration/aiv/aiv-inventory-completeness.js';
import { aggregateAivAssessmentResultsToLineCases } from '../converters/vibration/aiv/aiv-line-aggregation.js';

function topology({ extraAssessment = false, ambiguous = false, offPage = false } = {}) {
  const elements = [
    { canonicalId: 'SRC-1', type: 'VALV', line: 'L-1' },
    { canonicalId: 'A-1', type: 'OLET', line: 'L-1' },
    ...(extraAssessment ? [{ canonicalId: 'A-2', type: 'TEE', line: 'L-1' }] : []),
    ...(offPage ? [{ canonicalId: 'OP-1', type: 'OFF_PAGE', line: 'L-1' }] : []),
    ...(ambiguous ? [{ canonicalId: 'J-ALT', type: 'JUNCTION', line: 'L-1' }] : []),
    { canonicalId: 'V-1', type: 'BOUNDARY', line: 'L-1' },
  ];
  const main = ['SRC-1', 'A-1', ...(extraAssessment ? ['A-2'] : []), ...(offPage ? ['OP-1'] : []), 'V-1'];
  const segments = main.slice(0, -1).map((fromNodeId, index) => ({
    segmentId: `S-${index + 1}`,
    fromNodeId,
    toNodeId: main[index + 1],
    line: 'L-1',
  }));
  if (ambiguous) {
    segments.push(
      { segmentId: 'S-ALT-1', fromNodeId: 'SRC-1', toNodeId: 'J-ALT', line: 'L-1' },
      { segmentId: 'S-ALT-2', fromNodeId: 'J-ALT', toNodeId: 'V-1', line: 'L-1' },
    );
  }
  return Object.freeze({
    schema: 'AivFlareNetworkTopologyExchange.v1',
    networkId: 'NET-1',
    revision: 'R1',
    elements,
    segments,
  });
}

function scope() {
  return Object.freeze({
    line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'],
  });
}

function attestation(topologyValue = topology(), overrides = {}) {
  return createAivInventoryCompletenessAttestation({
    topology: topologyValue,
    scope: scope(),
    terminalBoundaryCanonicalId: 'V-1',
    evidenceSource: 'P&ID-1001',
    evidenceRevision: 'Rev C',
    reviewer: 'Vibration Engineer',
    reviewedAt: '2026-08-18T15:30:00Z',
    engineeringInputRevision: 7,
    completenessStatementAccepted: true,
    ...overrides,
  });
}

function result(id = 'A-1', lof = 0.29) {
  return Object.freeze({
    schema: 'AivAssessmentResult.v1',
    resultScope: 'ASSESSMENT',
    calculationId: 'VIB.AIV.ACOUSTIC',
    status: 'SCREENING_CALCULATED',
    assessmentCanonicalId: id,
    line: 'L-1',
    caseId: 'CASE-1',
    contributingSourceCanonicalIds: ['SRC-1'],
    lof,
    authority: {
      calculationState: 'IMPLEMENTED', qualificationState: 'SCREENING',
      screeningAuthority: 'AUTHORIZED', designAuthority: false,
    },
  });
}

test('scope candidates are derived from applicable relationships and topology line identity', () => {
  const candidates = buildAivInventoryCompletenessScopeCandidates({
    topology: topology(),
    relationships: [{
      sourceCanonicalId: 'SRC-1', assessmentCanonicalId: 'A-1', caseId: 'CASE-1', applicabilityDisposition: 'APPLICABLE',
    }],
  });
  assert.deepEqual(candidates, [scope()]);
});

test('attestation requires explicit engineer statement and provenance', () => {
  assert.throws(
    () => createAivInventoryCompletenessAttestation({
      topology: topology(), scope: scope(), terminalBoundaryCanonicalId: 'V-1',
      evidenceSource: 'P&ID-1001', evidenceRevision: 'Rev C', reviewer: 'Engineer',
      reviewedAt: '2026-08-18T15:30:00Z', engineeringInputRevision: 7,
      completenessStatementAccepted: false,
    }),
    /COMPLETENESS_STATEMENT_REQUIRED/u,
  );
  assert.equal(attestation().requiredExtent, AIV_INVENTORY_REQUIRED_EXTENT);
});

test('exact topology, revision, source/assessment set and first-major-vessel attestation verify completeness', () => {
  const receipt = verifyAivInventoryCompletenessForLineCase({
    attestations: [attestation()],
    topology: topology(),
    line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'], currentInputRevision: 7,
  });
  assert.equal(receipt.status, 'VERIFIED_COMPLETE');
  assert.equal(receipt.verifiedComplete, true);
  assert.equal(receipt.authority.screeningAuthorityPromotionApplied, false);
  assert.equal(receipt.authority.lineCaseAuthoritativeForScreening, false);
});

test('engineering edit makes accepted inventory evidence stale', () => {
  const receipt = verifyAivInventoryCompletenessForLineCase({
    attestations: [attestation()], topology: topology(), line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'], currentInputRevision: 8,
  });
  assert.equal(receipt.verifiedComplete, false);
  assert.ok(receipt.reasons.includes('ENGINEERING_INPUT_REVISION_STALE'));
});

test('an additional welded discontinuity in the physical topology blocks completeness when it lacks a current assessment result', () => {
  const value = topology({ extraAssessment: true });
  const receipt = verifyAivInventoryCompletenessForLineCase({
    attestations: [attestation(value)], topology: value, line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'], currentInputRevision: 7,
  });
  assert.equal(receipt.verifiedComplete, false);
  assert.ok(receipt.reasons.includes('TOPOLOGY_ASSESSMENT_SET_MISMATCH'));
});

test('ambiguous source-to-boundary routing fails closed', () => {
  const value = topology({ ambiguous: true });
  const receipt = verifyAivInventoryCompletenessForLineCase({
    attestations: [attestation(value)], topology: value, line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'], currentInputRevision: 7,
  });
  assert.equal(receipt.verifiedComplete, false);
  assert.ok(receipt.reasons.includes('SOURCE_TO_BOUNDARY_AMBIGUOUS:SRC-1'));
});

test('off-page topology inside the attested extent fails closed', () => {
  const value = topology({ offPage: true });
  const receipt = verifyAivInventoryCompletenessForLineCase({
    attestations: [attestation(value)], topology: value, line: 'L-1', caseId: 'CASE-1',
    sourceCanonicalIds: ['SRC-1'], assessmentCanonicalIds: ['A-1'], currentInputRevision: 7,
  });
  assert.equal(receipt.verifiedComplete, false);
  assert.match(receipt.reasons.join(';'), /OFF_PAGE_BOUNDARY_IN_SCOPE/u);
});

test('Stage 9 records verified inventory completeness without promoting line screening authority', () => {
  const summaries = aggregateAivAssessmentResultsToLineCases([result()], {
    qualificationMode: 'screening',
    topology: topology(),
    inventoryCompletenessAttestations: [attestation()],
    engineeringInputRevision: 7,
  });
  assert.equal(summaries[0].assessmentInventoryCompleteness, 'VERIFIED_COMPLETE');
  assert.equal(summaries[0].assessmentInventoryVerification.verifiedComplete, true);
  assert.equal(summaries[0].authoritativeForScreening, false);
  assert.equal(summaries[0].screeningAuthorityBlocker, 'AIV_LINE_CASE_SCREENING_AUTHORITY_NOT_PROMOTED');
  assert.equal(summaries[0].authority.screeningAuthority, 'NOT_AUTHORIZED');
});
