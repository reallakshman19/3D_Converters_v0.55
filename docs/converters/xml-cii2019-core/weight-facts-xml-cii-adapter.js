// Read-only XML-CII compatibility adapter. The canonical Preview fact producer replaces
// this adapter without changing the portable ledger or the existing ranking algorithm.
import { rankXmlCiiWeightCandidates } from './weight-valve-hints.js';
import { evaluateCandidateEligibility } from './weight-family-eligibility.js';
import {decodePhysicalOccurrenceId} from '../../contracts/gc-pw-v1/occurrence-bridge.mjs';
import { applyXmlCiiFlangeWeightFallbackToIssue } from './flange-weight-fallback.js';
import { WEIGHT_SCHEMA } from './weight-facts-review-service.js';
const ID = 'xml-cii/2019';
const toText = (x) => x === undefined || x === null ? '' : String(x).trim();
const num = (x) => x === '' || x === null || x === undefined ? null : (Number.isFinite(Number(x)) ? Number(x) : null);
const fields = Object.freeze({
  'bore.mm': 'boreMm', 'rating': 'rating', 'length.mm': 'lengthMm',
  'node.name': 'nodeName', 'component.type': 'componentType',
  'component.ref': 'componentRefNo', 'dtxr': 'dtxr',
  'mass.kg': 'originalWeight', 'legacy.key': 'key',
  'branch.name': 'branchName', 'node.number': 'nodeNumber',
});
function record(basis, sourceId, occurrenceId, fieldId, value, authority, unit, locator, diagnostics = []) {
  return { schemaVersion: WEIGHT_SCHEMA, domainId: ID, basisId: basis.basisId,
    subjectType: 'physical-component', sourceId, occurrenceId, fieldId, value,
    unit, authority, provenance: [{ sourceRef: sourceId, locator, ruleId: 'xml-cii-legacy-weight-read-only/v1' }],
    diagnostics, extensions: { adapter: 'legacy-read-only' } };
}
export function legacyXmlCiiWeightFacts(rows, basis, sourceId) {
  if (basis?.domainId !== ID || !basis.scope?.some((s) => s.sourceId === sourceId)) throw new Error('XML-CII source outside InputBasis');
  if (!Array.isArray(rows)) throw new TypeError('Legacy weight rows required');
  const out = [], identities = new Set();
  rows.forEach((row, index) => {
    // A branch name or NodeNumber=-1 is NEVER a primary occurrence identity.
    // The canonical producer supplies stable source/branch/node ordinals.
    const branch = row.branchOccurrenceIndex ?? row.branchOrdinal ?? index;
    const ordinal = row.nodeOrdinal ?? row.nodeIndex ?? index;
    const occurrenceId = sourceId + '/branch:' + branch + '/physical:' + ordinal;
    if (identities.has(occurrenceId)) throw new Error('Duplicate physical component occurrence: ' + occurrenceId);
    identities.add(occurrenceId);
    const uncertain = row.nodeOrdinal === undefined || row.branchOccurrenceIndex === undefined;
    const diagnostic = uncertain ? ['legacy-row-order identity; snapshot must be rebuilt after any source reordering'] : [];
    const locator = 'row:' + index + '/node:' + toText(row.nodeNumber);
    for (const [fieldId, property] of Object.entries(fields)) {
      let value = row[property], authority = 'derived', unit = null;
      if (fieldId === 'bore.mm' || fieldId === 'length.mm') { value = num(value); unit = 'mm'; }
      else if (fieldId === 'mass.kg') { value = num(value); unit = 'kg'; authority = value !== null && value > 0 ? 'source' : 'unresolved'; if (authority === 'unresolved') value = null; }
      else value = toText(value);
      if (value === null || value === '') { authority = 'unresolved'; value = null; }
      // Rating is read-only here: Preview/override is the normal rating authority.
      if (fieldId === 'rating' && value !== '') authority = row.ratingSource === 'weight-match-manual' ? 'manual' : 'derived';
      out.push(record(basis, sourceId, occurrenceId, fieldId, value, authority, unit, locator, diagnostic));
    }
  });
  return out;
}
function fromFacts(records) {
  const out = {};
  for (const fact of records) {
    const property = fields[fact.fieldId];
    if (property) out[property] = ['conflict', 'unresolved', 'proposed'].includes(fact.authority) ? null : fact.value;
  }
  return out;
}
/**
 * Canonical P4 facts deliberately contain only seven fields. The independently
 * attested original component signature carries NodeName within occurrenceId.
 * Do NOT infer a source family from the candidate or derived master DTXR.
 */
function sourceFamilyContext(records){
 const source=fromFacts(records),id=records[0]?.occurrenceId;
 if(typeof id!=='string'||!id.startsWith('['))return source; // Legacy read-only facts
 const original=decodePhysicalOccurrenceId(id);
 let signature;
 try{signature=JSON.parse(original.componentSignature);}catch{throw new Error('SOURCE_FAMILY_SIGNATURE_INVALID');}
 if(!Array.isArray(signature)||signature.length!==4||
    signature.some(x=>typeof x!=='string'))
   throw new Error('SOURCE_FAMILY_SIGNATURE_INVALID');
 const [componentType,componentRefNo,,nodeName]=signature;
 if(source.componentType&&source.componentType!==componentType||
    source.componentRefNo&&source.componentRefNo!==componentRefNo||
    source.nodeName&&source.nodeName!==nodeName)
   throw new Error('SOURCE_FAMILY_SIGNATURE_FACT_DRIFT');
 return {...source,componentType,nodeName};
}
function candidateSummary(c, masterRowIndex = -1) {
  return {
    type: toText(c.type || c.valveType), typeDesc: toText(c.typeDesc),
    masterRowOrdinal: masterRowIndex >= 0 ? masterRowIndex : null,
    masterRowId: toText(c.rowData?.id ?? c.rowData?.Id ?? c.rowData?.rowId),
    rowBore: num(c.rowBore), rowRating: toText(c.rowRating),
    rowLength: num(c.rowLength), masterWeight: num(c.masterWeight),
    lengthDelta: num(c.lengthDelta), lengthQualified: !!c.lengthQualified,
    preferred: !!c.preferred, inferred: !!c.inferredWeight,
    weightMethod: toText(c.weightMethod), extrapolationRatio: num(c.extrapolationRatio),
    lengthToleranceMm: num(c.lengthToleranceMm), nodeHint: toText(c.valveHintLabel),
    semanticReason: toText(c.semanticReason), semanticSource: toText(c.semanticSource),
    factor: !!c.specialFactorRule, specialFactorCode: toText(c.specialFactorCode),
    flangeFallback: !!c.flangeWeightFallback, oddEntry: !!c.oddEntry,
    warning: toText(c.weightWarning), rejectedReason: toText(c.rejectedReason),
    score: num(c.score), semanticTier: num(c.semanticTier),
  };
}
function rankedFromFacts(records, config) {
  const values = fromFacts(records);
  if (values.boreMm === null || values.lengthMm === null || !values.rating) return { candidates: [], rejectedCandidates: [] };
  // Reuse the *existing* mature bore/rating index and ranking; never derive
  // XML geometry or re-resolve Preview Rating in the weight scorer.
  const rank = rankXmlCiiWeightCandidates({
    boreMm: values.boreMm, lengthMm: values.lengthMm, rating: values.rating,
    nodeName: values.nodeName, componentType: values.componentType,
    componentRefNo: values.componentRefNo, dtxr: values.dtxr,
  }, config, { includeRejected: true });
  const amended = applyXmlCiiFlangeWeightFallbackToIssue({ ...values,
    candidates: rank.candidates.slice(0, 5), rejectedCandidates: rank.rejectedCandidates }, config);
  // Legacy flange fallback marks the issue rather than the candidate.
  // Preserve that provenance on the proposal without changing its mass.
  const candidates = amended.flangeWeightFallback
    ? (amended.candidates || []).map((candidate) => ({ ...candidate, flangeWeightFallback: true }))
    : (amended.candidates || []);
  return { candidates, rejectedCandidates: amended.rejectedCandidates || [] };
}
// One direct-exact eligibility rule for proposal authority and Final UI bulk actions.
// Keep the mature ranking untouched; qualification governs user acceptance only.
export function isXmlCiiDirectQualifiedCandidate(candidate, sourceContext) {
  return evaluateCandidateEligibility(sourceContext, candidate).qualified;
}
export function createXmlCiiFactWeightScorer(config, scoringRevision = 'xml-cii-weight-rank/v1') {
  // A proposal's master identity cannot drift through a mutable host config or
  // the legacy ranker's WeakMap index while an acceptance popup is open.
  const pinnedConfig = JSON.parse(JSON.stringify(config || {}));
  const masterRows = Array.isArray(pinnedConfig?.weight?.masterRows) ? pinnedConfig.weight.masterRows : [];
  const rowIndices = new Map(masterRows.map((row, index) => [row, index]));
  const rowOrdinal = (candidate) => rowIndices.get(candidate?.rowData) ?? -1;
  const scorer = (records, basis) => {
    const identity = records[0];
    if (!identity || basis.domainId !== ID || identity.domainId !== ID) throw new Error('XML-CII scorer requires matching FactRecord domain');
    const ranking = rankedFromFacts(records, pinnedConfig);
    const source = sourceFamilyContext(records);
    return ranking.candidates.slice(0, 5).flatMap((candidate, index) => {
      const value = num(candidate.selectedWeight ?? candidate.suggestedWeight ?? candidate.weight);
      if (value === null || value <= 0 || candidate.zeroFallback) return [];
      const evaluated = evaluateCandidateEligibility(source, candidate);
      const differingPorts=records.find(f=>f.fieldId==='bore.mm')
        ?.extensions?.componentBody?.portDimensionsDiffer===true;
      const eligibility=differingPorts?{...evaluated,qualified:false,
        reasons:[...evaluated.reasons,'COMPONENT_PORT_DIMENSIONS_DIFFER_REVIEW_REQUIRED']}:evaluated;
      return [{
        basisId: basis.basisId, domainId: ID, occurrenceId: identity.occurrenceId,
        proposalId: [basis.basisId, identity.occurrenceId, scoringRevision,
          'master-row:' + rowOrdinal(candidate), 'rank:' + (index + 1),
          'method:' + (candidate.weightMethod || 'master'), 'kg:' + value].join('/'),
        value, unit: 'kg', method: candidate.weightMethod || 'master',
        ranking: index + 1, qualified: eligibility.qualified,
        eligibilityReasons: [eligibility.qualified ? 'exact-bore-rating-length' : 'explicit-review-required',
          ...eligibility.reasons, candidate.weightWarning || ''].filter(Boolean),
        evidenceRefs: [basis.basisId, basis.masters?.weight?.sha256 || '', identity.sourceId,
          rowOrdinal(candidate) < 0 ? 'weight:derived-fallback' : 'weight:master-row:' + rowOrdinal(candidate)].filter(Boolean),
        scoringRevision,
        extensions: { candidate: candidateSummary(candidate, rowOrdinal(candidate)),
          familyEligibility: eligibility,
          rejectedCandidates: index === 0 ? ranking.rejectedCandidates.map(c => candidateSummary(c, rowOrdinal(c))) : [] },
      }];
    });
  };
  scorer.audit = (records, basis) => ({ basisId: basis.basisId, occurrenceId: records[0]?.occurrenceId,
    ...(() => { const ranking = rankedFromFacts(records, pinnedConfig); return { rejectedCandidates: ranking.rejectedCandidates.map(c => candidateSummary(c, rowOrdinal(c))), candidateCount: ranking.candidates.length }; })() });
  return scorer;
}
