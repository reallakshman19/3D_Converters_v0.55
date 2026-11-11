import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import {
  makeBasisRef, digestCanonical, validateBasisRef,
} from '../contracts/gc-pw-v1/contract.mjs';
import {
  physicalOccurrenceId, decodePhysicalOccurrenceId,
  attestLiveBasis, verifyPhysicalFactPages, toWeightFacts,
} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const hash = v => createHash('sha256').update(v).digest('hex');
const original = [
  { sourceId: 'PL01', branchOccurrenceIndex: 0, nodeOrdinal: 0, nodeNumber: -1 },
  { sourceId: 'PL01', branchOccurrenceIndex: 0, nodeOrdinal: 1, nodeNumber: -1 },
  { sourceId: 'PL06', branchOccurrenceIndex: 0, nodeOrdinal: 0, nodeNumber: -1 },
];
const physical = [
  { sourceId: 'PL01', branchOccurrenceIndex: 0, nodeOrdinal: 0, componentSignature: 'valve-001' },
  { sourceId: 'PL06', branchOccurrenceIndex: 0, nodeOrdinal: 0, componentSignature: 'valve-001' },
];
const fields = ['mass.kg', 'rating', 'size.mm'];

const mutate = value => structuredClone(value);
const failCode = (code) => (error) => { assert.equal(error.code, code); return true; };
function sourceFact(basis, occurrence, fieldId) {
  const id = physicalOccurrenceId(occurrence);
  return {
    schemaVersion: 'gc-pw/1.0', domainId: basis.domainId, basisId: basis.basisId,
    subjectType: 'physical-component', sourceId: occurrence.sourceId, occurrenceId: id,
    fieldId, value: fieldId === 'mass.kg' ? 20 : fieldId === 'size.mm' ? 50 : '150',
    unit: fieldId.endsWith('.kg') ? 'kg' : fieldId.endsWith('.mm') ? 'mm' : null,
    authority: 'source',
    provenance: [{ sourceRef: occurrence.sourceId, locator: 'original-branch/node-ordinal' }],
    diagnostics: [],
  };
}
async function fixture(domainId = 'xml-cii/2019') {
  const live = {
    sources: { PL01: '<Model A="1"/>', PL06: '<Model B="2"/>' },
    selection: [{ sourceId: 'PL01', selectionRef: 'all' },
      { sourceId: 'PL06', selectionRef: 'all' }],
    stagedSource: null,
    masters: {
      pipe: { datasetId: 'pipe-m', revision: 3, rows: [{ nps: 2 }, { nps: 3 }], mapping: { NPS: 'nps' } },
    },
    config: { mode: 'F1' },
    overrides: {},
  };
  const basis = await makeBasisRef({
    domainId,
    sourceRefs: Object.entries(live.sources).map(([sourceId, text]) => ({
      sourceId, sha256: hash(text), mediaType: 'application/xml',
    })),
    selectionSha256: await digestCanonical(live.selection), stagedSourceSha256: null,
    masters: { pipe: {
      datasetId: live.masters.pipe.datasetId,
      revision: live.masters.pipe.revision, rowCount: live.masters.pipe.rows.length,
      sha256: await digestCanonical(live.masters.pipe.rows),
      mappingSha256: await digestCanonical(live.masters.pipe.mapping),
    }},
    configSha256: await digestCanonical(live.config),
    overridesSha256: await digestCanonical(live.overrides),
    scope: live.selection,
  });
  const rows = physical.flatMap(p => fields.map(f => sourceFact(basis, p, f)));
  const pages = [
    { schemaVersion: 'gc-pw/1.0', basisId: basis.basisId, items: rows.slice(0, 3),
      totalCount: rows.length, nextCursor: 'after:3', complete: true },
    { schemaVersion: 'gc-pw/1.0', basisId: basis.basisId, items: rows.slice(3),
      totalCount: rows.length, nextCursor: null, complete: true },
  ];
  return { basis, live, options: {
    basis, live, expectedSubjectType: 'physical-component', originalOccurrences: mutate(original), expectedOriginalCount: 3,
    physicalOccurrences: mutate(physical), requiredFieldIds: fields.slice(), pages,
  }};
}

test('canonical ID agrees with Preview schema, even when NodeNumber=-1 repeats across sources', () => {
  for (const row of physical) {
    const id = physicalOccurrenceId(row);
    assert.equal(id, JSON.stringify([row.sourceId, row.branchOccurrenceIndex, row.nodeOrdinal, row.componentSignature]));
    assert.deepEqual(decodePhysicalOccurrenceId(id).occurrenceId, id);
  }
  assert.notEqual(physicalOccurrenceId(physical[0]), physicalOccurrenceId(physical[1]));
});

test('legacy slash-delimited or row-index-derived identity cannot become accepted source custody', () => {
  assert.throws(() => decodePhysicalOccurrenceId('PL01/branch:0/physical:0'), failCode('NONCANONICAL_OCCURRENCE'));
  assert.throws(() => physicalOccurrenceId({ sourceId: 'PL01', branchOccurrenceIndex: 0,
    nodeOrdinal: undefined, componentSignature: 'valve' }), failCode('INVALID_SOURCE_ORDINAL'));
  assert.throws(() => physicalOccurrenceId({ sourceId: 'PL01', branchOccurrenceIndex: 0,
    nodeOrdinal: 0, componentSignature: '' }), failCode('REQUIRED_STRING'));
});

test('basis full source/master/config contents and chosen selection are cryptographically attested', async () => {
  const { basis, live } = await fixture();
  validateBasisRef(basis);
  assert.equal(await attestLiveBasis({ basis, ...live }), basis.basisId);
});

test('same byte-length changed source fails attestation, without reliance on metadata length', async () => {
  const { basis, live } = await fixture();
  const changed = mutate(live); changed.sources.PL01 = '<Model A="7"/>';
  assert.equal(changed.sources.PL01.length, live.sources.PL01.length);
  await assert.rejects(attestLiveBasis({ basis, ...changed }), failCode('CONTENT_DIGEST_MISMATCH'));
});

test('same-row-count master content drift cannot restore stale facts', async () => {
  const { basis, live } = await fixture();
  const changed = mutate(live); changed.masters.pipe.rows[0].nps = 5;
  assert.equal(changed.masters.pipe.rows.length, live.masters.pipe.rows.length);
  await assert.rejects(attestLiveBasis({ basis, ...changed }), failCode('MASTER_CONTENT_DRIFT'));
});

test('master mapping and revision changes are separate stale gates', async () => {
  const { basis, live } = await fixture();
  const m = mutate(live); m.masters.pipe.mapping.NPS = 'size';
  await assert.rejects(attestLiveBasis({ basis, ...m }), failCode('MASTER_MAPPING_DRIFT'));
  const r = mutate(live); r.masters.pipe.revision = 4;
  await assert.rejects(attestLiveBasis({ basis, ...r }), failCode('MASTER_REVISION_DRIFT'));
});

test('selection, config, override and staged-source changes do not silently reuse basis', async () => {
  const { basis, live } = await fixture();
  const a = mutate(live); a.selection[0].selectionRef = 'half';
  await assert.rejects(attestLiveBasis({ basis, ...a }), failCode('SELECTION_DRIFT'));
  const b = mutate(live); b.config.mode = 'F2';
  await assert.rejects(attestLiveBasis({ basis, ...b }), failCode('CONFIG_DRIFT'));
  const c = mutate(live); c.overrides.mass = 15;
  await assert.rejects(attestLiveBasis({ basis, ...c }), failCode('OVERRIDE_DRIFT'));
  const d = mutate(live); d.stagedSource = '{"edited":true}';
  await assert.rejects(attestLiveBasis({ basis, ...d }), failCode('STAGED_SOURCE_DRIFT'));
});

test('live-evidence payload cannot shadow the independently supplied authoritative basis', async () => {
  const { options } = await fixture();
  const bad = mutate(options);
  bad.live.basis = { ...bad.basis, basisId: 'f'.repeat(64) };
  await assert.rejects(verifyPhysicalFactPages(bad), failCode('LIVE_BASIS_INJECTION'));
});

test('stale forged basisId fails even if all public fields are superficially valid', async () => {
  const { basis, live } = await fixture(); const bad = mutate(basis);
  bad.basisId = 'f'.repeat(64);
  await assert.rejects(attestLiveBasis({ basis: bad, ...live }), failCode('STALE_BASIS'));
});

test('independently supplied source population and physical subset produce immutable Weight FactRecords', async () => {
  const { options } = await fixture();
  const projection = await verifyPhysicalFactPages(options);
  assert.equal(projection.verifiedOriginalCount, 3);
  assert.equal(projection.verifiedPhysicalCount, 2);
  assert.equal(projection.verifiedFactCount, 6);
  const weightFacts = toWeightFacts(projection);
  assert.equal(weightFacts.length, 6);
  assert.equal(weightFacts[0].occurrenceId, physicalOccurrenceId(physical[0]));
  assert.ok(Object.isFrozen(weightFacts[0]));
  assert.throws(() => { weightFacts[0].value = 999; }, TypeError);
  assert.ok(!Object.hasOwn(projection, 'decisions'));
});

test('original source population mismatch and repeated physical identity reject', async () => {
  const { options } = await fixture();
  await assert.rejects(verifyPhysicalFactPages({ ...options, expectedOriginalCount: 4 }),
    failCode('ORIGINAL_POPULATION_MISMATCH'));
  await assert.rejects(verifyPhysicalFactPages({ ...options,
    physicalOccurrences: [physical[0], physical[0]] }), failCode('DUPLICATE_PHYSICAL_OCCURRENCE'));
});

test('physical occurrence not independently present in original XML population rejects', async () => {
  const { options } = await fixture();
  const altered = mutate(options);
  altered.physicalOccurrences[0].nodeOrdinal = 40;
  await assert.rejects(verifyPhysicalFactPages(altered), failCode('PHYSICAL_ORIGINAL_NOT_FOUND'));
});

test('a truncated last page and inconsistent count reject before a false complete', async () => {
  const { options } = await fixture();
  const p = mutate(options); p.pages[1].nextCursor = 'after:6';
  await assert.rejects(verifyPhysicalFactPages(p), failCode('TRUNCATED_POPULATION'));
  const q = mutate(options); q.pages[1].totalCount = 9;
  await assert.rejects(verifyPhysicalFactPages(q), failCode('CHANGED_TOTAL'));
});

test('same ID aliases, extra facts and missing fields reject even if UI looks complete', async () => {
  const { options } = await fixture();
  const dup = mutate(options); dup.pages[1].items[0] = dup.pages[0].items[0];
  await assert.rejects(verifyPhysicalFactPages(dup), failCode('DUPLICATE_RESULT_IDENTITY'));
  const extra = mutate(options); extra.pages[1].items[0].fieldId = 'unknown.extra';
  await assert.rejects(verifyPhysicalFactPages(extra), failCode('UNEXPECTED_FACT_FIELD'));
  const missing = mutate(options); missing.pages[1].items.pop();
  await assert.rejects(verifyPhysicalFactPages(missing), failCode('INCOMPLETE_POPULATION'));
});

test('cross-source fact identities, forged original source, missing provenance and wrong subject reject', async () => {
  const { options } = await fixture();
  const spoof = mutate(options); spoof.pages[0].items[0].sourceId = 'PL06';
  await assert.rejects(verifyPhysicalFactPages(spoof), failCode('UNKNOWN_FACT_OCCURRENCE'));
  const source = mutate(options); source.originalOccurrences[0].sourceId = 'PLXX';
  await assert.rejects(verifyPhysicalFactPages(source), failCode('UNKNOWN_ORIGINAL_SOURCE'));
  const prov = mutate(options); prov.pages[0].items[0].provenance = [{ sourceRef: 'fake' }];
  await assert.rejects(verifyPhysicalFactPages(prov), failCode('MISSING_SOURCE_PROVENANCE'));
  const subj = mutate(options); subj.pages[0].items[0].subjectType = 'pipe';
  await assert.rejects(verifyPhysicalFactPages(subj), failCode('WRONG_FACT_SUBJECT'));
});

test('stale basis FactRecords and proposal authority cannot be silently accepted', async () => {
  const { options } = await fixture();
  const bad = mutate(options); bad.pages[0].items[0].basisId = 'f'.repeat(64);
  await assert.rejects(verifyPhysicalFactPages(bad), failCode('CROSS_BASIS_FACT'));
  const proposed = mutate(options); proposed.pages[0].items[0].authority = 'proposed';
  const projected = await verifyPhysicalFactPages(proposed);
  assert.equal(projected.factRecords[0].authority, 'proposed');
  assert.ok(!Object.hasOwn(projected, 'acceptedMassKg'));
});

test('portability smoke: same bridge validates non-XML domain facts without XML dependencies', async () => {
  const { basis, options } = await fixture('in-memory/test-device');
  const adapted = structuredClone(options);
  adapted.pages.forEach(page => page.items.forEach(item => { item.subjectType = 'device-component'; }));
  const projection = await verifyPhysicalFactPages({ ...adapted, basis, expectedSubjectType: 'device-component' });
  assert.equal(projection.domainId, 'in-memory/test-device');
  assert.equal(projection.verifiedFactCount, 6);
});
