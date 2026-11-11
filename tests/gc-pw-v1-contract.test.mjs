import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  SCHEMA_VERSION, ContractError, canonicalJson, digestCanonical, digestUtf8, assertContentDigest, makeBasisRef, assertBasisDigest,
  validateBasisRef, validateFactRecord, validateProposal, validateDecisionCommand,
  validateDecisionBatch, validatePage, assertCompletePopulation, validateJobEvent, validateSnapshotRef,
} from '../contracts/gc-pw-v1/contract.mjs';

// Node 18 and browser workers expose WebCrypto differently. No production Node dependency.
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
const sha = (letter = 'a') => letter.repeat(64);
const fails = (fn, code) => assert.throws(fn, (error) =>
  error instanceof ContractError && error.code === code, code);
async function fixture(fields = {}) {
  const payload = {
    domainId: 'xml-cii/2019',
    sourceRefs: [{ sourceId: 'PL-01', sha256: sha('a'), mediaType: 'application/xml' }],
    selectionSha256: sha('b'), stagedSourceSha256: sha('c'),
    masters: {
      lineList: { datasetId: 'line-v1', revision: 3, sha256: sha('d'), mappingSha256: sha('e'), rowCount: 385 },
      pipingClass: { datasetId: 'class-v1', revision: 7, sha256: sha('f'), mappingSha256: sha('1'), rowCount: 10699 },
      materialMap: { datasetId: 'material-v1', revision: 1, sha256: sha('2'), mappingSha256: sha('3'), rowCount: 383 },
      weight: { datasetId: 'weight-v1', revision: 2, sha256: sha('4'), mappingSha256: sha('5'), rowCount: 1595 },
    },
    configSha256: sha('6'), overridesSha256: sha('7'),
    scope: [{ sourceId: 'PL-01', selectionRef: 'all-branches' }],
    ...fields,
  };
  return makeBasisRef(payload);
}
function fact(basisId, occurrenceId = 'PL-01/branch:0/node:0') {
  return {
    schemaVersion: SCHEMA_VERSION, domainId: 'xml-cii/2019', basisId,
    subjectType: 'component', sourceId: 'PL-01', occurrenceId,
    fieldId: 'rating', value: '150', unit: null, authority: 'exact-master',
    provenance: [{ sourceRef: 'pipingClass', locator: 'sheet#116' }], diagnostics: [],
  };
}
function proposal(basisId) {
  return {
    basisId, occurrenceId: 'PL-01/branch:0/node:0', proposalId: 'p1',
    domainId: 'xml-cii/2019', value: 15, unit: 'kg', method: 'exact-bore-rating-length',
    ranking: 0, qualified: true, eligibilityReasons: ['rating match'],
    evidenceRefs: ['weight:row:55'], scoringRevision: 'rank-v1',
  };
}
function command(basisId, action = 'accept-proposal') {
  return {
    commandId: 'accept-1', basisId, scopeId: 'PL-01', occurrenceId: 'PL-01/branch:0/node:0',
    expectedDecisionRevision: 'rev-1', action,
    ...(action === 'accept-proposal' ? { proposalId: 'p1' } : {}),
    ...(action === 'enter-manual' || action === 'final-override' ? { value: 120.73401, unit: 'kg' } : {}),
  };
}
function page(basisId, ids, nextCursor = null, totalCount = 2, complete = true) {
  return { schemaVersion: SCHEMA_VERSION, basisId, items: ids.map(id => ({ id })), totalCount, nextCursor, complete };
}

test('canonical JSON has stable property order and rejects unsafe/nonfinite inputs', async () => {
  assert.equal(canonicalJson({ b: 2, a: { y: 9, x: 8 } }), canonicalJson({ a: { x: 8, y: 9 }, b: 2 }));
  assert.equal(await digestCanonical({ a: 1, b: 2 }), await digestCanonical({ b: 2, a: 1 }));
  fails(() => canonicalJson({ weight: NaN }), 'NONFINITE_NUMBER');
  fails(() => canonicalJson({ weight: Infinity }), 'NONFINITE_NUMBER');
  fails(() => canonicalJson({ row: undefined }), 'OBJECT_REQUIRED');
  fails(() => canonicalJson(JSON.parse('{"__proto__":{"polluted":true}}')), 'UNSAFE_KEY');
  const circular = { a: null }; circular.a = circular;
  fails(() => canonicalJson(circular), 'CYCLIC_INPUT');
  const sparse = new Array(2); sparse[0] = 1;
  fails(() => canonicalJson(sparse), 'SPARSE_ARRAY');
});

test('source bytes of identical length have distinct SHA-256; declared contents are attested', async () => {
  const oldText = '<a>150</a>', newText = '<a>300</a>';
  assert.equal(oldText.length, newText.length);
  const oldHash = await digestUtf8(oldText), changedHash = await digestUtf8(newText);
  assert.notEqual(oldHash, changedHash);
  assert.equal(await assertContentDigest(oldText, oldHash), oldHash);
  await assert.rejects(() => assertContentDigest(newText, oldHash),
    (error) => error.code === 'CONTENT_DIGEST_MISMATCH');
  const oldBasis = await fixture({ sourceRefs: [{ sourceId: 'PL-01', sha256: oldHash, mediaType: 'application/xml' }] });
  const newBasis = await fixture({ sourceRefs: [{ sourceId: 'PL-01', sha256: changedHash, mediaType: 'application/xml' }] });
  assert.notEqual(oldBasis.basisId, newBasis.basisId);
});

test('full-content SHA basis validates at owner master scale, not by file length or row count', async () => {
  const first = await fixture();
  assert.equal(first.masters.pipingClass.rowCount, 10699);
  assert.equal((await assertBasisDigest(first)).basisId, first.basisId);
  const changedSource = await fixture({ sourceRefs: [{ sourceId: 'PL-01', sha256: sha('8'), mediaType: 'application/xml' }] });
  const changedMaster = await fixture({
    masters: { ...first.masters, weight: { ...first.masters.weight, sha256: sha('9') } },
  });
  assert.notEqual(changedSource.basisId, first.basisId);
  assert.notEqual(changedMaster.basisId, first.basisId);
  assert.equal(changedMaster.masters.weight.rowCount, first.masters.weight.rowCount);
  await assert.rejects(() => assertBasisDigest({ ...first, sourceRefs: changedSource.sourceRefs }),
    (error) => error.code === 'STALE_BASIS');
});

test('basis rejects duplicate source IDs/scopes and malformed authoritative descriptors', async () => {
  const base = await fixture();
  fails(() => validateBasisRef({ ...base, sourceRefs: [...base.sourceRefs, ...base.sourceRefs] }), 'DUPLICATE_SOURCE');
  fails(() => validateBasisRef({ ...base, scope: [...base.scope, ...base.scope] }), 'DUPLICATE_SCOPE');
  fails(() => validateBasisRef({ ...base, scope: [{ sourceId: 'foreign', selectionRef: 'all' }] }), 'UNKNOWN_SOURCE');
  fails(() => validateBasisRef({ ...base, masters: { weight: { ...base.masters.weight, sha256: 'same-length-not-a-digest' } } }), 'SHA256_REQUIRED');
  fails(() => validateBasisRef({ ...base, schemaVersion: 'gc-pw/2.0' }), 'UNSUPPORTED_SCHEMA_VERSION');
  fails(() => validateBasisRef({ ...base, masters: { weight: { ...base.masters.weight, revision: {} } } }), 'INVALID_REVISION');
  await assert.rejects(() => fixture({ schemaVersion: 'gc-pw/2.0' }), (error) => error.code === 'UNSUPPORTED_SCHEMA_VERSION');
});

test('portable non-XML FactRecord, no DOM/engine dependency', async () => {
  const basis = await fixture({
    domainId: 'generic/measurement',
    sourceRefs: [{ sourceId: 'calibration', sha256: sha('1'), mediaType: 'application/json' }],
    masters: {}, scope: [{ sourceId: 'calibration', selectionRef: 'all' }], stagedSourceSha256: null,
  });
  await assertBasisDigest(basis);
  const sample = {
    schemaVersion: SCHEMA_VERSION, domainId: 'generic/measurement', basisId: basis.basisId,
    subjectType: 'instrument', sourceId: 'calibration', occurrenceId: 'instrument:0',
    fieldId: 'pressure', value: 12.5, unit: 'bar', authority: 'source',
    provenance: [{ sourceRef: 'calibration', locator: 'instrument/0/pressure' }], diagnostics: [],
  };
  assert.equal(validateFactRecord(JSON.parse(JSON.stringify(sample)), basis.basisId).value, 12.5);
});

test('cross-basis facts, unresolved authority, bad value and stale rank proposals are rejected', async () => {
  const base = await fixture(), record = fact(base.basisId);
  validateFactRecord(record, base.basisId);
  fails(() => validateFactRecord(record, sha('0')), 'CROSS_BASIS_FACT');
  fails(() => validateFactRecord({ ...record, authority: 'unresolved', value: 0 }), 'UNRESOLVED_MUST_BE_NULL');
  fails(() => validateFactRecord({ ...record, value: NaN }), 'NONFINITE_NUMBER');
  validateProposal(proposal(base.basisId), base.basisId);
  fails(() => validateProposal(proposal(base.basisId), sha('0')), 'CROSS_BASIS_PROPOSAL');
  fails(() => validateProposal({ ...proposal(base.basisId), value: 0 }), 'INVALID_PROPOSAL_VALUE');
  fails(() => validateProposal({ ...proposal(base.basisId), qualified: 'true' }), 'INVALID_QUALIFICATION');
});

test('proposed values cannot be accepted without explicit proposal ID or manual quantity', async () => {
  const basis = await fixture();
  const accepted = command(basis.basisId);
  validateDecisionCommand(accepted);
  fails(() => validateDecisionCommand({ ...accepted, proposalId: '' }), 'STRING_REQUIRED');
  const manual = command(basis.basisId, 'enter-manual');
  assert.equal(validateDecisionCommand(manual).value, 120.73401);
  fails(() => validateDecisionCommand({ ...manual, value: 0 }), 'INVALID_MANUAL_VALUE');
  fails(() => validateDecisionBatch([{ ...accepted, basisId: sha('0') }], basis.basisId, 'PL-01'), 'CROSS_BASIS_DECISION');
  fails(() => validateDecisionBatch([{ ...accepted, scopeId: 'PL-06' }], basis.basisId, 'PL-01'), 'CROSS_SCOPE_DECISION');
  fails(() => validateDecisionBatch([accepted, { ...accepted, commandId: 'again' }], basis.basisId, 'PL-01'),
    'DUPLICATE_OCCURRENCE_DECISION');
  fails(() => validateDecisionBatch([accepted, accepted], basis.basisId, 'PL-01'), 'DUPLICATE_COMMAND');
});

test('complete population is all selected occurrences, never only visible page', async () => {
  const basis = await fixture();
  const a = page(basis.basisId, ['branch:0'], 'next');
  const b = page(basis.basisId, ['branch:1']);
  assert.deepEqual(assertCompletePopulation([a, b], basis.basisId, item => item.id, 2),
    { basisId: basis.basisId, totalCount: 2, verifiedCount: 2 });
  fails(() => assertCompletePopulation([a], basis.basisId, item => item.id, 2), 'TRUNCATED_POPULATION');
  fails(() => assertCompletePopulation([page(basis.basisId, ['branch:0'])], basis.basisId, item => item.id, 2),
    'INCOMPLETE_POPULATION');
  fails(() => assertCompletePopulation([a, { ...b, complete: false }], basis.basisId, item => item.id, 2),
    'INCOMPLETE_BASIS');
  fails(() => assertCompletePopulation([a, { ...b, items: [{ id: 'branch:0' }] }], basis.basisId, item => item.id, 2),
    'DUPLICATE_RESULT_IDENTITY');
  fails(() => assertCompletePopulation([a, b], basis.basisId, item => item.id, 3), 'SOURCE_POPULATION_MISMATCH');
  fails(() => validatePage({ ...a, basisId: sha('0') }, basis.basisId), 'CROSS_BASIS_PAGE');
});

test('worker progress cannot claim false completion or return an expired basis', async () => {
  const basis = await fixture();
  const event = { requestId: 'job-1', basisId: basis.basisId, stage: 'indexed-lookup',
    completed: 5, total: 6, event: 'progress' };
  validateJobEvent(event, basis.basisId);
  fails(() => validateJobEvent({ ...event, event: 'completed' }, basis.basisId), 'FALSE_JOB_COMPLETION');
  fails(() => validateJobEvent({ ...event, completed: 7 }, basis.basisId), 'PROGRESS_OVERFLOW');
  fails(() => validateJobEvent(event, sha('0')), 'STALE_JOB');
  fails(() => validateJobEvent({ ...event, event: 'failed' }, basis.basisId), 'OBJECT_REQUIRED');
});

test('X004 Preview, Match-1 and Match-2 remain distinct frozen named snapshots', async () => {
  const basis = await fixture();
  for (const stage of ['preview', 'RigidMatch1', 'Rigidmatch2']) {
    validateSnapshotRef({ snapshotId: stage + ':rev-1', basisId: basis.basisId,
      stage, contentSha256: sha('c'), revision: 'rev-1' }, basis.basisId);
  }
  fails(() => validateSnapshotRef({
    snapshotId: 'bad', basisId: basis.basisId, stage: 'RigidMatch3',
    contentSha256: sha('c'), revision: 'rev-1',
  }, basis.basisId), 'INVALID_FREEZE_STAGE');
  fails(() => validateSnapshotRef({
    snapshotId: 'bad', basisId: basis.basisId, stage: 'preview',
    contentSha256: sha('c'), revision: 'rev-1',
  }, sha('0')), 'CROSS_BASIS_SNAPSHOT');
});
