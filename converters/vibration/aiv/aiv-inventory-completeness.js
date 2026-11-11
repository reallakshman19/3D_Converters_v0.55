export const AIV_INVENTORY_ATTESTATION_SCHEMA = 'AivWeldedDiscontinuityInventoryAttestation.v1';
export const AIV_INVENTORY_VERIFICATION_SCHEMA = 'AivWeldedDiscontinuityInventoryVerification.v1';
export const AIV_INVENTORY_REQUIRED_EXTENT = 'ALL_RELEVANT_WELDED_DISCONTINUITIES_DOWNSTREAM_TO_FIRST_MAJOR_VESSEL';
export const AIV_INVENTORY_TERMINAL_ROLE = 'FIRST_MAJOR_VESSEL';

const ASSESSMENT_ELEMENT_TYPES = new Set(['OLET', 'TEE', 'SUPPORT', 'WELD']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) { return String(value ?? '').trim(); }
function uniqueSorted(values) {
  return [...new Set((values ?? []).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
function sameStrings(left, right) {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}
function validIsoTimestamp(value) {
  const raw = text(value);
  return raw.includes('T') && Number.isFinite(Date.parse(raw));
}
function validRevision(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function buildAivInventoryCompletenessScopeCandidates({ topology, relationships = [] } = {}) {
  if (topology?.schema !== 'AivFlareNetworkTopologyExchange.v1') return deepFreeze([]);
  const elementById = new Map((topology.elements ?? []).map((item) => [item.canonicalId, item]));
  const groups = new Map();
  for (const relationship of relationships ?? []) {
    if (relationship?.applicabilityDisposition !== 'APPLICABLE') continue;
    const assessment = elementById.get(relationship.assessmentCanonicalId);
    const line = text(assessment?.line);
    const caseId = text(relationship.caseId);
    if (!line || !caseId) continue;
    const key = JSON.stringify([line, caseId]);
    if (!groups.has(key)) groups.set(key, { line, caseId, sourceCanonicalIds: [], assessmentCanonicalIds: [] });
    const group = groups.get(key);
    group.sourceCanonicalIds.push(relationship.sourceCanonicalId);
    group.assessmentCanonicalIds.push(relationship.assessmentCanonicalId);
  }
  return deepFreeze([...groups.values()]
    .map((item) => ({
      line: item.line,
      caseId: item.caseId,
      sourceCanonicalIds: uniqueSorted(item.sourceCanonicalIds),
      assessmentCanonicalIds: uniqueSorted(item.assessmentCanonicalIds),
    }))
    .sort((a, b) => a.line.localeCompare(b.line) || a.caseId.localeCompare(b.caseId)));
}

export function createAivInventoryCompletenessAttestation({
  topology,
  scope,
  terminalBoundaryCanonicalId,
  evidenceSource,
  evidenceRevision,
  reviewer,
  reviewedAt,
  engineeringInputRevision,
  completenessStatementAccepted = false,
} = {}) {
  if (topology?.schema !== 'AivFlareNetworkTopologyExchange.v1') {
    throw new TypeError('AIV inventory completeness attestation requires readiness-qualified flare-network topology.');
  }
  const line = text(scope?.line);
  const caseId = text(scope?.caseId);
  if (!line || !caseId) throw new TypeError('AIV inventory completeness attestation requires line and operating case.');
  if (!validRevision(engineeringInputRevision)) {
    throw new TypeError('AIV inventory completeness attestation requires a valid engineering input revision.');
  }
  const boundaryId = text(terminalBoundaryCanonicalId);
  const boundary = topology.elements?.find((item) => item.canonicalId === boundaryId);
  if (!boundaryId || boundary?.type !== 'BOUNDARY') {
    throw new TypeError('AIV inventory completeness attestation terminal must identify a BOUNDARY node.');
  }
  if (text(boundary.line) !== line) {
    throw new Error('AIV_INVENTORY_BOUNDARY_LINE_MISMATCH: terminal boundary must be on the attested line.');
  }
  if (!text(evidenceSource) || !text(evidenceRevision) || !text(reviewer)) {
    throw new TypeError('AIV inventory completeness attestation requires evidence source, revision and reviewer.');
  }
  if (!validIsoTimestamp(reviewedAt)) {
    throw new TypeError('AIV inventory completeness attestation requires an ISO reviewedAt timestamp.');
  }
  if (completenessStatementAccepted !== true) {
    throw new Error('AIV_INVENTORY_COMPLETENESS_STATEMENT_REQUIRED: engineer must explicitly attest that the complete required extent is represented.');
  }
  const sourceCanonicalIds = uniqueSorted(scope.sourceCanonicalIds);
  const assessmentCanonicalIds = uniqueSorted(scope.assessmentCanonicalIds);
  if (!sourceCanonicalIds.length || !assessmentCanonicalIds.length) {
    throw new TypeError('AIV inventory completeness attestation requires source and assessment identities.');
  }
  return deepFreeze({
    schema: AIV_INVENTORY_ATTESTATION_SCHEMA,
    methodId: 'VIB.AIV.ACOUSTIC',
    engineeringInputRevision: Number(engineeringInputRevision),
    networkId: text(topology.networkId),
    networkRevision: text(topology.revision),
    line,
    caseId,
    sourceCanonicalIds,
    assessmentCanonicalIds,
    terminalBoundaryCanonicalId: boundaryId,
    terminalBoundaryRole: AIV_INVENTORY_TERMINAL_ROLE,
    requiredExtent: AIV_INVENTORY_REQUIRED_EXTENT,
    completenessStatementAccepted: true,
    evidence: {
      source: text(evidenceSource),
      revision: text(evidenceRevision),
      reviewer: text(reviewer),
      reviewedAt: new Date(reviewedAt).toISOString(),
    },
    authority: {
      evidencePurpose: 'WELDED_DISCONTINUITY_INVENTORY_COMPLETENESS_ONLY',
      screeningAuthorityPromotionApplied: false,
      designAuthority: false,
    },
  });
}

function outgoingSegments(topology) {
  const map = new Map();
  for (const segment of topology?.segments ?? []) {
    if (!map.has(segment.fromNodeId)) map.set(segment.fromNodeId, []);
    map.get(segment.fromNodeId).push(segment);
  }
  for (const rows of map.values()) rows.sort((a, b) => String(a.segmentId).localeCompare(String(b.segmentId)));
  return map;
}

function findDirectedPaths(topology, fromNodeId, toNodeId, maxPaths = 2) {
  const outgoing = outgoingSegments(topology);
  const paths = [];
  const visit = (nodeId, visited, segments) => {
    if (paths.length >= maxPaths) return;
    for (const segment of outgoing.get(nodeId) ?? []) {
      if (visited.has(segment.toNodeId)) continue;
      const next = [...segments, segment];
      if (segment.toNodeId === toNodeId) {
        paths.push(next);
        if (paths.length >= maxPaths) return;
      } else {
        const nextVisited = new Set(visited);
        nextVisited.add(segment.toNodeId);
        visit(segment.toNodeId, nextVisited, next);
      }
      if (paths.length >= maxPaths) return;
    }
  };
  visit(fromNodeId, new Set([fromNodeId]), []);
  return paths;
}

function verification({ attestation, topology, line, caseId, sourceIds, assessmentIds, currentInputRevision }) {
  const reasons = [];
  if (attestation?.schema !== AIV_INVENTORY_ATTESTATION_SCHEMA) reasons.push('ATTESTATION_MISSING_OR_INVALID');
  if (topology?.schema !== 'AivFlareNetworkTopologyExchange.v1') reasons.push('FLARE_NETWORK_TOPOLOGY_REQUIRED');
  if (!validRevision(currentInputRevision) || Number(attestation?.engineeringInputRevision) !== Number(currentInputRevision)) {
    reasons.push('ENGINEERING_INPUT_REVISION_STALE');
  }
  if (text(attestation?.networkId) !== text(topology?.networkId) || text(attestation?.networkRevision) !== text(topology?.revision)) {
    reasons.push('NETWORK_IDENTITY_MISMATCH');
  }
  if (text(attestation?.line) !== line || text(attestation?.caseId) !== caseId) reasons.push('LINE_CASE_MISMATCH');
  if (!sameStrings(attestation?.sourceCanonicalIds, sourceIds)) reasons.push('SOURCE_IDENTITY_SET_MISMATCH');
  if (!sameStrings(attestation?.assessmentCanonicalIds, assessmentIds)) reasons.push('ASSESSMENT_IDENTITY_SET_MISMATCH');
  if (attestation?.terminalBoundaryRole !== AIV_INVENTORY_TERMINAL_ROLE
      || attestation?.requiredExtent !== AIV_INVENTORY_REQUIRED_EXTENT
      || attestation?.completenessStatementAccepted !== true) {
    reasons.push('COMPLETENESS_STATEMENT_INVALID');
  }
  if (!text(attestation?.evidence?.source) || !text(attestation?.evidence?.revision)
      || !text(attestation?.evidence?.reviewer) || !validIsoTimestamp(attestation?.evidence?.reviewedAt)) {
    reasons.push('PROVENANCE_INCOMPLETE');
  }
  const boundaryId = text(attestation?.terminalBoundaryCanonicalId);
  const elements = topology?.elements ?? [];
  const elementById = new Map(elements.map((item) => [item.canonicalId, item]));
  const boundary = elementById.get(boundaryId);
  if (!boundaryId || boundary?.type !== 'BOUNDARY') reasons.push('TERMINAL_BOUNDARY_INVALID');
  if (boundary && text(boundary.line) !== line) reasons.push('TERMINAL_BOUNDARY_LINE_MISMATCH');

  const pathNodeIds = new Set();
  if (reasons.length === 0) {
    for (const sourceId of sourceIds) {
      const paths = findDirectedPaths(topology, sourceId, boundaryId, 2);
      if (paths.length === 0) {
        reasons.push(`SOURCE_TO_BOUNDARY_DISCONNECTED:${sourceId}`);
        continue;
      }
      if (paths.length > 1) {
        reasons.push(`SOURCE_TO_BOUNDARY_AMBIGUOUS:${sourceId}`);
        continue;
      }
      pathNodeIds.add(sourceId);
      for (const segment of paths[0]) pathNodeIds.add(segment.toNodeId);
    }
  }

  if (reasons.length === 0) {
    const offPage = [...pathNodeIds].filter((id) => elementById.get(id)?.type === 'OFF_PAGE');
    if (offPage.length) reasons.push(`OFF_PAGE_BOUNDARY_IN_SCOPE:${offPage.sort().join(',')}`);
    const topologyAssessments = [...pathNodeIds]
      .filter((id) => {
        const element = elementById.get(id);
        return ASSESSMENT_ELEMENT_TYPES.has(element?.type) && text(element?.line) === line;
      });
    if (!sameStrings(topologyAssessments, assessmentIds)) reasons.push('TOPOLOGY_ASSESSMENT_SET_MISMATCH');
  }

  const verified = reasons.length === 0;
  return deepFreeze({
    schema: AIV_INVENTORY_VERIFICATION_SCHEMA,
    methodId: 'VIB.AIV.ACOUSTIC',
    line,
    caseId,
    status: verified ? 'VERIFIED_COMPLETE' : 'NOT_VERIFIED',
    verifiedComplete: verified,
    requiredExtent: AIV_INVENTORY_REQUIRED_EXTENT,
    engineeringInputRevision: validRevision(currentInputRevision) ? Number(currentInputRevision) : null,
    terminalBoundaryCanonicalId: boundaryId || null,
    sourceCanonicalIds: uniqueSorted(sourceIds),
    assessmentCanonicalIds: uniqueSorted(assessmentIds),
    reasons: uniqueSorted(reasons),
    evidence: verified ? attestation.evidence : null,
    authority: {
      establishesInventoryCompleteness: verified,
      screeningAuthorityPromotionApplied: false,
      lineCaseAuthoritativeForScreening: false,
      designAuthority: false,
    },
  });
}

export function verifyAivInventoryCompletenessForLineCase({
  attestations = [],
  topology = null,
  line,
  caseId,
  sourceCanonicalIds = [],
  assessmentCanonicalIds = [],
  currentInputRevision = null,
} = {}) {
  const normalizedLine = text(line);
  const normalizedCase = text(caseId);
  const matches = (attestations ?? []).filter((item) => (
    text(item?.line) === normalizedLine && text(item?.caseId) === normalizedCase
  ));
  if (matches.length !== 1) {
    return deepFreeze({
      schema: AIV_INVENTORY_VERIFICATION_SCHEMA,
      methodId: 'VIB.AIV.ACOUSTIC',
      line: normalizedLine,
      caseId: normalizedCase,
      status: 'NOT_VERIFIED',
      verifiedComplete: false,
      requiredExtent: AIV_INVENTORY_REQUIRED_EXTENT,
      engineeringInputRevision: validRevision(currentInputRevision) ? Number(currentInputRevision) : null,
      terminalBoundaryCanonicalId: null,
      sourceCanonicalIds: uniqueSorted(sourceCanonicalIds),
      assessmentCanonicalIds: uniqueSorted(assessmentCanonicalIds),
      reasons: [matches.length === 0 ? 'ATTESTATION_MISSING' : 'ATTESTATION_AMBIGUOUS'],
      evidence: null,
      authority: {
        establishesInventoryCompleteness: false,
        screeningAuthorityPromotionApplied: false,
        lineCaseAuthoritativeForScreening: false,
        designAuthority: false,
      },
    });
  }
  return verification({
    attestation: matches[0],
    topology,
    line: normalizedLine,
    caseId: normalizedCase,
    sourceIds: uniqueSorted(sourceCanonicalIds),
    assessmentIds: uniqueSorted(assessmentCanonicalIds),
    currentInputRevision,
  });
}
