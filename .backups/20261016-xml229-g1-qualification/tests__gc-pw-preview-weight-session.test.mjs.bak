import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { openGcPwPreviewWeightSession } from '../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js';
import { openGcPwPreviewWeightSession as docsOpenGcPwPreviewWeightSession } from '../docs/tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js';
import { readFile } from 'node:fs/promises';
import { physicalOccurrenceId } from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import { createPreviewBasis } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import { assertBasisDigest, digestUtf8, canonicalJson, digestCanonical, validateFactRecord, validatePage } from '../contracts/gc-pw-v1/contract.mjs';
import { openPreviewFactReadModel } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-read-model.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const SRC_A = '<PipeStressExport><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></PipeStressExport>';
const SRC_B = '<PipeStressExport><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></PipeStressExport>';
const FIELDS = ['bore.mm', 'length.mm', 'rating', 'mass.kg', 'component.type', 'component.ref'];
const originalOccurrences = [
  { sourceId: 'PL01', branchOccurrenceIndex: 0, nodeOrdinal: 0 },
  { sourceId: 'PL06', branchOccurrenceIndex: 0, nodeOrdinal: 0 },
];
const physicalOccurrences = [
  { sourceId: 'PL01', branchOccurrenceIndex: 0, nodeOrdinal: 0, componentSignature: 'V-1' },
  { sourceId: 'PL06', branchOccurrenceIndex: 0, nodeOrdinal: 0, componentSignature: 'V-1' },
];
const values = { 'bore.mm': 50, 'length.mm': 110, rating: '150',
  'mass.kg': 59, 'component.type': 'VALVE', 'component.ref': 'V-1' };
function clone(x) { return structuredClone(x); }
function argumentsFor(run = 'jobA') {
  return {
    sources: [
      { sourceId: 'PL01', mediaType: 'application/xml', text: SRC_A },
      { sourceId: 'PL06', mediaType: 'application/xml', text: SRC_B },
    ],
    masters: {
      weight: { datasetId: 'weight-1', revision: 1, rows: [
        { 'RF/RTJ KG': 15, Rating: '150', bore: 50 },
        { 'RF/RTJ KG': 20, Rating: '300', bore: 25 },
      ], mapping: { Weight: 'RF/RTJ KG' } },
    },
    selection: [{ sourceId: 'PL01', selectionRef: 'all' }, { sourceId: 'PL06', selectionRef: 'all' }],
    stagedSource: null, config: { weight: { masterRows: [] } }, overrides: {},
    originalOccurrences: clone(originalOccurrences), expectedOriginalCount: 2,
    physicalOccurrences: clone(physicalOccurrences), requiredFieldIds: FIELDS.slice(),
    requestId: run,
  };
}
function record(basis, physical, field) {
  const occurrenceId = physicalOccurrenceId(physical);
  return {
    schemaVersion: 'gc-pw/1.0', domainId: 'xml-cii/2019', basisId: basis.basisId,
    sourceId: physical.sourceId, occurrenceId, subjectType: 'physical-component',
    fieldId: field, value: values[field],
    unit: field === 'mass.kg' ? 'kg' : field.includes('.mm') ? 'mm' : null,
    authority: 'source',
    provenance: [{ sourceRef: physical.sourceId, locator: 'original-branch:0/node:0' }],
    diagnostics: [],
  };
}
function pages(basis) {
  const all = physicalOccurrences.flatMap(x => FIELDS.map(field => record(basis, x, field)));
  return [
    { schemaVersion: 'gc-pw/1.0', basisId: basis.basisId, items: all.slice(0, 4),
      totalCount: all.length, nextCursor: 'cursor:4', complete: true },
    { schemaVersion: 'gc-pw/1.0', basisId: basis.basisId, items: all.slice(4),
      totalCount: all.length, nextCursor: null, complete: true },
  ];
}
const code = c => e => { assert.equal(e.code, c); return true; };

test('uses real Preview InputBasis, strict occurrence bridge and real attested Weight service', async () => {
  const opts = argumentsFor();
  let readCalls = 0;
  opts.loadFactPages = async ({ basis, requestId, report, isCancelled }) => {
    readCalls++;
    assert.equal(requestId, 'jobA');
    assert.equal(isCancelled(), false);
    await assertBasisDigest(basis);
    report(1, 2);
    return pages(basis);
  };
  const started = await openGcPwPreviewWeightSession(opts);
  const ready = await started.awaitReady();
  assert.equal(readCalls, 1);
  assert.equal(ready.basis.basisId, started.basisId);
  assert.equal(ready.openedFacts, physicalOccurrences.length * FIELDS.length);
  const servicePage = ready.review.getFacts({ basisId: started.basisId, sourceId: 'PL06', limit: 20 });
  assert.equal(servicePage.totalCount, FIELDS.length);
  assert.ok(servicePage.items.every(f => f.sourceId === 'PL06' && f.occurrenceId === physicalOccurrenceId(physicalOccurrences[1])));
  assert.equal(ready.review.getDecisionState({ basisId: started.basisId, scopeId: 'PL06' }).decisionRevision, null);
  assert.equal(started.subscribeJob().event, 'completed');
});

test('Preview InputBasis is identical to independently generated actual merged Preview input', async () => {
  const opts = argumentsFor('basis-match');
  opts.loadFactPages = async ({ basis }) => pages(basis);
  const a = await openGcPwPreviewWeightSession(opts);
  const b = await createPreviewBasis({ domainId: 'xml-cii/2019',
    sources: opts.sources, masters: opts.masters, selection: opts.selection,
    stagedSource: opts.stagedSource, config: opts.config, overrides: opts.overrides, sha256: digestUtf8 });
  assert.equal(a.basisId, b.basisId);
  await a.awaitReady();
});

test('missing actual fact producer is a fail-closed error, never a successful legacy fallback', async () => {
  await assert.rejects(openGcPwPreviewWeightSession(argumentsFor()), code('MISSING_WORKER_PRODUCER'));
});

test('partial page count cannot open Weight service or publish false success', async () => {
  const o = argumentsFor('partial');
  o.loadFactPages = async ({ basis }) => pages(basis).slice(0, 1);
  const s = await openGcPwPreviewWeightSession(o);
  await assert.rejects(s.awaitReady(), code('TRUNCATED_POPULATION'));
  assert.equal(s.subscribeJob().event, 'failed');
});

test('incorrect sourced identity and stale page basis block attested Weight opening', async () => {
  const o = argumentsFor('bad-id');
  o.loadFactPages = async ({ basis }) => {
    const p = pages(basis);
    p[0].items[0].occurrenceId = 'PL01/branch:0/physical:0';
    return p;
  };
  const s = await openGcPwPreviewWeightSession(o);
  await assert.rejects(s.awaitReady(), code('NONCANONICAL_OCCURRENCE'));
  const q = argumentsFor('stale-page');
  q.loadFactPages = async ({ basis }) => {
    const p = pages(basis); p[1].basisId = 'f'.repeat(64); return p;
  };
  const t = await openGcPwPreviewWeightSession(q);
  await assert.rejects(t.awaitReady(), code('CROSS_BASIS_PAGE'));
});

test('mutating real source contents after Preview freeze fails instead of reviving a stale cache', async () => {
  const o = argumentsFor('changed-source');
  o.loadFactPages = async ({ basis }) => {
    o.sources[0].text = '<PipeStressExport><Branch><Node><NodeNumber>-2</NodeNumber></Node></Branch></PipeStressExport>';
    return pages(basis);
  };
  const s = await openGcPwPreviewWeightSession(o);
  // The adapter guards actual read-time custody, so source drift must prevent
  // opening the Weight ledger regardless of its amount or rank.
  await assert.rejects(s.awaitReady(), code('CONTENT_DIGEST_MISMATCH'));
});

test('same master row-count changed content cannot be accepted by Weight', async () => {
  const o = argumentsFor('changed-master');
  o.loadFactPages = async ({ basis }) => {
    o.masters.weight.rows[0]['RF/RTJ KG'] = 999;
    return pages(basis);
  };
  const s = await openGcPwPreviewWeightSession(o);
  await assert.rejects(s.awaitReady(), code('MASTER_CONTENT_DRIFT'));
});

test('cancel pending producer before it replies; stale output cannot materialize reviews', async () => {
  const o = argumentsFor('cancelled');
  let finish;
  o.loadFactPages = async ({ basis }) => {
    await new Promise(resolve => { finish = () => resolve(pages(basis)); });
    return pages(basis);
  };
  const s = await openGcPwPreviewWeightSession(o);
  // openBasisJob invokes the producer in a microtask.
  await Promise.resolve();
  assert.equal(typeof finish, 'function');
  s.cancel();
  finish();
  await assert.rejects(s.awaitReady(), code('CANCELLED'));
  assert.equal(s.subscribeJob().event, 'cancelled');
});

test('rejected producer remains typed failed; no review access or implicit user acceptance', async () => {
  const o = argumentsFor('failure');
  o.loadFactPages = async () => { const error = Error('producer failed'); error.code = 'WORKER_UNAVAILABLE'; throw error; };
  const s = await openGcPwPreviewWeightSession(o);
  await assert.rejects(s.awaitReady(), code('WORKER_UNAVAILABLE'));
  assert.equal(s.subscribeJob().error.code, 'WORKER_UNAVAILABLE');
});

test('one-source physical truncation rejects even if pages have coherent self-count', async () => {
  const o = argumentsFor('physical-omission');
  o.loadFactPages = async ({ basis }) => {
    const p = pages(basis);
    const first = p[0].items.concat(p[1].items).filter(f => f.sourceId === 'PL01');
    return [{ schemaVersion: 'gc-pw/1.0', basisId: basis.basisId, items: first,
      totalCount: first.length, nextCursor: null, complete: true }];
  };
  const s = await openGcPwPreviewWeightSession(o);
  await assert.rejects(s.awaitReady(), code('SOURCE_POPULATION_MISMATCH'));
});

test('deployed docs mirror loads all actual modules and preserves root contract byte parity', async () => {
  for (const item of ['contract.mjs', 'occurrence-bridge.mjs']) {
    const root = await readFile(new URL('../contracts/gc-pw-v1/' + item, import.meta.url), 'utf8');
    const deployed = await readFile(new URL('../docs/contracts/gc-pw-v1/' + item, import.meta.url), 'utf8');
    assert.equal(deployed, root, item + ' must be deployed without semantic drift');
  }
  const root = await readFile(new URL('../tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js', import.meta.url), 'utf8');
  const deployed = await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/integration/gc-pw-preview-weight-session.js', import.meta.url), 'utf8');
  assert.equal(deployed, root, 'domain integration mirror must remain exact source copy');
  const opts = argumentsFor('mirror');
  opts.loadFactPages = async ({ basis }) => pages(basis);
  const session = await docsOpenGcPwPreviewWeightSession(opts);
  const opened = await session.awaitReady();
  assert.equal(opened.openedFacts, physicalOccurrences.length * FIELDS.length);
});

test('actual merged Preview read-model pages feed actual attested Weight session, without duplicate geometry', async () => {
  const o = argumentsFor('real-preview-reader');
  // Source ownership and engineering readiness are independent input claims:
  // in this test the fixture supplies positive facts, not product release truth.
  o.requiredFieldIds = ['source.occurrence', ...FIELDS];
  let previewOpened = null;
  o.loadFactPages = async ({ basis, report, isCancelled }) => {
    const expectedOccurrences = physicalOccurrences.map(p => ({
      sourceId: p.sourceId, occurrenceId: physicalOccurrenceId(p),
      subjectType: 'physical-component',
    }));
    const input = physicalOccurrences.flatMap(p => [
      { ...record(basis, p, 'source.occurrence'), value: true, authority: 'source' },
      ...FIELDS.map(field => record(basis, p, field)),
    ]);
    previewOpened = await openPreviewFactReadModel({
      basis, expectedOccurrences, records: input,
      ports: { assertBasisDigest, canonicalJson, digestCanonical, validateFactRecord, validatePage },
      requiredEngineeringFields: { 'physical-component': ['bore.mm', 'mass.kg'] },
      verifyEngineeringComplete: ({ records }) => records.filter(f => f.fieldId === 'mass.kg').length === 2,
    });
    assert.equal(previewOpened.info.engineeringReady, true);
    const result = [];
    let cursor = null, read = 0;
    do {
      assert.equal(isCancelled(), false);
      const page = await previewOpened.getFacts({ basisId: basis.basisId, subjectType: 'physical-component', cursor, limit: 3 });
      result.push(page);
      read += page.items.length;
      report(read, page.totalCount);
      cursor = page.nextCursor;
    } while (cursor !== null);
    return result;
  };
  const session = await openGcPwPreviewWeightSession(o);
  const result = await session.awaitReady();
  assert.equal(result.openedFacts, physicalOccurrences.length * o.requiredFieldIds.length);
  assert.equal(previewOpened.info.totalFactCount, result.openedFacts);
  assert.equal(result.review.getFacts({ basisId: session.basisId, limit: 50 }).totalCount, result.openedFacts);
  assert.equal(result.review.getDecisionState({ basisId: session.basisId, scopeId: 'PL01' }).decisionRevision, null);
});
