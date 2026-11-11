// GC-PW/1.0 Preview P2.1: portable, DOM/transport-free fact custody and read pages.
// The actual engineering resolver and local worker are separate P2.2 responsibilities.
// The caller MUST inject the integrator's read-only GC-PW validator ports.
export class PreviewFactReadError extends Error {
  constructor(code, message) { super(message); this.name = 'PreviewFactReadError'; this.code = code; }
}
const requireThat = (ok, code, why) => {
  if (!ok) throw new PreviewFactReadError(code, why);
};
function freezeDeep(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    for (const child of Object.values(v)) freezeDeep(child);
    Object.freeze(v);
  }
  return v;
}
function assertPorts(ports) {
  for (const port of ['assertBasisDigest', 'canonicalJson', 'digestCanonical',
    'validateFactRecord', 'validatePage']) {
    requireThat(typeof ports?.[port] === 'function', 'MISSING_VALIDATOR_PORT',
      'Required GC-PW/1.0 validator export: ' + port);
  }
}
function validateId(id, what) {
  requireThat(typeof id === 'string' && id.trim().length > 0,
    'INVALID_ID', what + ' must be non-empty');
  return id;
}
function snapshotCopy(value, ports) {
  // Contract canonicalJson rejects cyclic/unsafe/unserializable input.
  return freezeDeep(JSON.parse(ports.canonicalJson(value)));
}
function sourceRecord(basisId, occurrence, fieldId, raw) {
  const missing = raw == null || String(raw).trim() === '';
  return {
    schemaVersion:'gc-pw/1.0', domainId:'xml-cii/2019', basisId,
    subjectType:occurrence.subjectType,
    sourceId:occurrence.sourceId, occurrenceId:occurrence.occurrenceId,
    fieldId, value:missing ? null : raw, unit:null,
    authority:missing ? 'unresolved' : 'source',
    provenance:occurrence.provenance.map(p => ({sourceRef:p.sourceRef,locator:p.locator})),
    diagnostics:missing ? ['SOURCE_FIELD_MISSING:' + fieldId] : [],
    extensions:{valueKind:'source', originalValue:missing ? null : raw},
  };
}
/**
 * Convert a checked XML source occurrence projection into explicit SOURCE facts.
 * Never resolve Rating, Piping Class, B31.3, wall, material, or weight here.
 * Each branch/node receives an occurrence marker, including blank/negative IDs.
 */
export function buildXmlCiiSourceFactRecords({basisId, projection}) {
  validateId(basisId,'basisId');
  requireThat(projection?.schemaVersion === 'gc-pw/1.0' && projection?.domainId === 'xml-cii/2019',
    'INVALID_SOURCE_PROJECTION', 'Expected verified XML-CII occurrence projection');
  requireThat(Array.isArray(projection.branches) && Array.isArray(projection.nodes),
    'INVALID_SOURCE_PROJECTION', 'Both branch and node occurrences must be present');
  requireThat(projection.branchCount === projection.branches.length &&
    projection.nodeCount === projection.nodes.length,'SOURCE_COUNT_MISMATCH',
    'Source projection counts must match all source occurrences');
  const records = [];
  for (const occurrence of [...projection.branches, ...projection.nodes]) {
    validateId(occurrence.sourceId,'sourceId');
    validateId(occurrence.occurrenceId,'occurrenceId');
    requireThat(Array.isArray(occurrence.provenance) && occurrence.provenance.length > 0,
      'MISSING_PROVENANCE', 'Occurrence has no original source provenance');
    records.push(sourceRecord(basisId,occurrence,'source.occurrence',true));
    if (occurrence.subjectType === 'branch') {
      records.push(sourceRecord(basisId,occurrence,'source.branchName',occurrence.branchName));
    } else if (occurrence.subjectType === 'node') {
      for (const [fieldId, key] of [
        ['source.nodeNumber','nodeNumber'], ['source.componentType','componentType'],
        ['source.componentRefNo','componentRefNo'], ['source.endpoint','endpoint'],
      ]) records.push(sourceRecord(basisId,occurrence,fieldId,occurrence[key]));
    } else throw new PreviewFactReadError('UNKNOWN_SUBJECT_TYPE','Unsupported XML occurrence');
  }
  return records;
}
function recordKey(r) { return JSON.stringify([r.subjectType,r.sourceId,r.occurrenceId,r.fieldId]); }
function occurrenceKey(r) { return JSON.stringify([r.sourceId,r.occurrenceId]); }
function validateEngineeringFields(required, identities, recordKeys) {
  requireThat(required && typeof required === 'object', 'ENGINEERING_FIELDS_REQUIRED',
    'Independent engineering field requirements are mandatory');
  const allIdentities=[...identities];
  const types=new Set(allIdentities.map(item=>item.subjectType));
  for (const subjectType of types) {
    const fields=required[subjectType];
    requireThat(Array.isArray(fields) && fields.some(field => typeof field === 'string'
      && field.length > 0 && !field.startsWith('source.')),
      'ENGINEERING_FIELDS_REQUIRED','At least one non-source field must be required for '+subjectType);
  }
  for (const r of allIdentities) {
    for (const fieldId of required[r.subjectType]) {
      requireThat(recordKeys.has(recordKey({...r,fieldId})),
        'REQUIRED_ENGINEERING_FACT_MISSING','Missing '+r.subjectType+' '+fieldId+' fact at '+r.occurrenceId);
    }
  }
}
/**
 * Open one fixed-basis immutable projection. expectedOccurrences MUST be an
 * independently prepared raw source/selection census, never copied from facts.
 * No engineering completion is asserted without an external verification port
 * AND complete per-occurrence non-source required-field coverage.
 */
export async function openPreviewFactReadModel({
  basis, expectedOccurrences, records, ports,
  requiredEngineeringFields = null, verifyEngineeringComplete = null,
} = {}) {
  assertPorts(ports);
  await ports.assertBasisDigest(basis); // full SHA-256; no stale basis accepted
  requireThat(Array.isArray(expectedOccurrences) && expectedOccurrences.length > 0,
    'EXPECTED_SOURCE_REQUIRED','Independent selected source occurrence census is required');
  requireThat(Array.isArray(records), 'FACTS_REQUIRED', 'FactRecord array is required');
  const expected = new Map();
  for (const raw of expectedOccurrences) {
    const subjectType=validateId(raw?.subjectType,'subjectType');
    // Portable core: e.g. instrument, beam, support, branch, node.
    // XML-only subject restrictions belong to buildXmlCiiSourceFactRecords().
    const id=occurrenceKey({sourceId:validateId(raw?.sourceId,'sourceId'),
      occurrenceId:validateId(raw?.occurrenceId,'occurrenceId')});
    requireThat(!expected.has(id),'DUPLICATE_EXPECTED_OCCURRENCE','Expected occurrence repeated');
    expected.set(id,{subjectType,sourceId:raw.sourceId,occurrenceId:raw.occurrenceId});
  }
  const rawFacts = new Map(), present = new Set();
  for (const fact of records) {
    ports.validateFactRecord(fact,basis.basisId);
    requireThat(fact.domainId === basis.domainId, 'DOMAIN_MISMATCH','Fact is from another domain');
    const occurrence=occurrenceKey(fact);
    const known=expected.get(occurrence);
    requireThat(known && known.subjectType === fact.subjectType,
      'UNSELECTED_OCCURRENCE','Fact references unselected/wrong original source occurrence');
    const key=recordKey(fact);
    requireThat(!rawFacts.has(key),'DUPLICATE_FIELD_FACT','Duplicate subject/field FactRecord');
    rawFacts.set(key,fact);
    if (fact.fieldId === 'source.occurrence') {
      requireThat(fact.authority === 'source' && fact.value === true,
        'INVALID_OCCURRENCE_MARKER','Selected original occurrence cannot be inferred or proposed');
      present.add(occurrence);
    }
  }
  requireThat(present.size === expected.size,
    'INCOMPLETE_SELECTED_POPULATION','One or more selected source occurrences have no source FactRecord');
  // Caller cannot inflate counts by inventing extra facts for unselected sources.
  const sourceIds=new Set(basis.sourceRefs.map(x=>x.sourceId));
  for (const item of expected.values()) {
    requireThat(sourceIds.has(item.sourceId),'SOURCE_OUTSIDE_BASIS','Source missing from InputBasis');
  }
  const verifiedFacts=snapshotCopy([...rawFacts.values()],ports);
  const expectedList=snapshotCopy([...expected.values()],ports);
  const snapshotId=await ports.digestCanonical({
    schemaVersion:'gc-pw/1.0',basisId:basis.basisId,expectedOccurrences:expectedList,records:verifiedFacts,
  });
  let engineeringReady=false;
  if (verifyEngineeringComplete !== null) {
    requireThat(typeof verifyEngineeringComplete === 'function','INVALID_COMPLETION_PORT',
      'Engineering verification must be an explicit function');
    validateEngineeringFields(requiredEngineeringFields, expected.values(),rawFacts);
    engineeringReady=(await verifyEngineeringComplete({
      basisId:basis.basisId, snapshotId, expectedOccurrences:expectedList, records:verifiedFacts,
    })) === true;
  }
  const info=freezeDeep({
    schemaVersion:'gc-pw/1.0',basisId:basis.basisId,snapshotId,
    computationStage:engineeringReady?'engineering-verified':'source-custody-only',
    engineeringReady,expectedOccurrenceCount:expected.size,totalFactCount:verifiedFacts.length,
  });
  // Build each filtered view once; scrolling subsequent pages does not repeat
  // an O(all facts) scan for every 200-item window.
  const queryCache=new Map();
  return Object.freeze({
    info,
    async getFacts({basisId, cursor = null, limit = 100,
      sourceId = null, subjectType = null, fieldId = null} = {}) {
      requireThat(basisId === info.basisId,'CROSS_BASIS_QUERY','Read must use exact immutable InputBasis');
      requireThat(Number.isSafeInteger(limit) && limit >= 1 && limit <= 200,
        'INVALID_PAGE_SIZE','Page size must be 1–200, never a total-universe cutoff');
      for (const [name,value] of [['sourceId',sourceId],['subjectType',subjectType],['fieldId',fieldId]]) {
        requireThat(value === null || typeof value === 'string' && value.trim().length > 0,
          'INVALID_FILTER',name+' must be null or nonempty text');
      }
      const query={sourceId,subjectType,fieldId};
      const queryHash=await ports.digestCanonical(query);
      const filterKey=JSON.stringify(query);
      if (!queryCache.has(filterKey)) {
        if (queryCache.size >= 16) queryCache.clear(); // bounded local index memory
        queryCache.set(filterKey,verifiedFacts.filter(r => (sourceId === null || r.sourceId === sourceId)
          && (subjectType === null || r.subjectType === subjectType)
          && (fieldId === null || r.fieldId === fieldId)));
      }
      const filtered=queryCache.get(filterKey);
      let offset=0;
      if (cursor !== null) {
        requireThat(typeof cursor === 'string','INVALID_CURSOR','Cursor must be opaque string');
        let decoded;
        try { decoded=JSON.parse(cursor); } catch {
          throw new PreviewFactReadError('INVALID_CURSOR','Malformed cursor');
        }
        requireThat(decoded?.snapshotId === snapshotId && decoded.queryHash === queryHash &&
          Number.isSafeInteger(decoded.offset) && decoded.offset > 0 &&
          decoded.offset < filtered.length, 'STALE_OR_WRONG_CURSOR',
          'Cursor belongs to a different snapshot/query or is out of range');
        const proof=await ports.digestCanonical({snapshotId,queryHash,offset:decoded.offset});
        requireThat(proof === decoded.proof,'INVALID_CURSOR_PROOF','Cursor contents changed');
        offset=decoded.offset;
      }
      const end=Math.min(offset+limit,filtered.length);
      const nextCursor=end < filtered.length
        ? JSON.stringify({snapshotId,queryHash,offset:end,
            proof:await ports.digestCanonical({snapshotId,queryHash,offset:end})})
        : null;
      const page={schemaVersion:'gc-pw/1.0',basisId:info.basisId,
        items:filtered.slice(offset,end),totalCount:filtered.length,nextCursor,
        complete:engineeringReady};
      ports.validatePage(page,info.basisId);
      return freezeDeep(page);
    },
  });
}
