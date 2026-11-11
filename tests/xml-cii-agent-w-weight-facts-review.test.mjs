import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { withXmlCiiRigidWeightMatch1, resolveXmlCiiRigidWeight } from '../converters/xml-cii2019-core/rigid-weight-authority.js';
import { createWeightReviewService, WEIGHT_SCHEMA } from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import { legacyXmlCiiWeightFacts, createXmlCiiFactWeightScorer, isXmlCiiDirectQualifiedCandidate } from '../converters/xml-cii2019-core/weight-facts-xml-cii-adapter.js';
import { weightMatchContentFingerprint } from '../converters/xml-cii2019-core/weight-facts-cache-custody.js';
import { planExactSourceWeightCommands, commitExactSourceWeightCommands } from '../converters/xml-cii2019-core/weight-facts-bulk-decisions.js';
import { planVerifiedModeAExactMatch1, commitVerifiedModeAExactMatch1 } from '../converters/xml-cii2019-core/weight-facts-mode-a-exact-actions.js';
import { planVerifiedFinalMatch2, commitVerifiedFinalMatch2 } from '../converters/xml-cii2019-core/weight-facts-final-review-actions.js';
import { readVerifiedIndividualWeightReview, commitVerifiedIndividualWeightReview } from '../converters/xml-cii2019-core/weight-facts-individual-review.js';
import { openVerifiedIndividualWeightReviewDialog } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-individual-dialog.js';
import { assertWeightInputCustody, createAttestedWeightReviewService } from '../converters/xml-cii2019-core/weight-facts-attested-session.js';

const hash = (v) => createHash('sha256').update(String(v)).digest('hex');
function basis(domainId = 'xml-cii/2019', sources = ['one'], master = 'master-v1') {
  return { schemaVersion: WEIGHT_SCHEMA, domainId, basisId: hash(domainId + sources.join(',') + master),
    sourceRefs: sources.map((sourceId) => ({ sourceId, sha256: hash('source-' + sourceId), mediaType: 'application/xml' })),
    selectionSha256: hash('selection'), stagedSourceSha256: null,
    masters: { weight: { datasetId: 'w', revision: master, sha256: hash(master), mappingSha256: hash('mapping'), rowCount: 1595 } },
    configSha256: hash('config'), overridesSha256: hash('overrides'),
    scope: sources.map((sourceId) => ({ sourceId, selectionRef: 'all' })) };
}
function fixture(b, source = 'one', weight = null, index = 0) {
  return legacyXmlCiiWeightFacts([{ key: 'BR::-1', branchName: 'BR', nodeNumber: '-1',
    branchOccurrenceIndex: index, nodeOrdinal: 0, boreMm: 100, rating: '150',
    lengthMm: 100, nodeName: 'VGT-1', componentType: 'VALV', dtxr: 'GATE',
    originalWeight: weight }], b, source);
}
function oracleScore(records, b) {
  return [{ basisId: b.basisId, domainId: b.domainId, occurrenceId: records[0].occurrenceId,
    proposalId: b.basisId + '/15', unit: 'kg', value: 15, method: 'exact-master',
    ranking: 1, qualified: true, scoringRevision: 'oracle-v1',
    eligibilityReasons: ['bore-rating-length'], evidenceRefs: [b.masters.weight.sha256] }];
}
function command(b, id, action, revision = null, overrides = {}) {
  return { commandId: id, basisId: b.basisId, scopeId: 'one',
    occurrenceId: 'one/branch:0/physical:0', expectedDecisionRevision: revision, action, ...overrides };
}
const throws = (fn, code) => assert.throws(fn, (e) => e.code === code, 'expected ' + code);

test('59 kg source never becomes proposed 15 kg without explicit Match-1 acceptance', () => {
  const b = basis(), service = createWeightReviewService({ score: oracleScore });
  service.openBasis(b, { facts: fixture(b, 'one', 59) });
  const proposed = service.getProposals({ basisId: b.basisId, occurrenceIds: ['one/branch:0/physical:0'] });
  assert.equal(proposed.items[0].value, 15);
  assert.equal(service.getSnapshot({ basisId: b.basisId, stage: 'RigidMatch1' }).length, 0);
  assert.equal(service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [],
    outputBasis: { components: [{ sourceId: 'one', occurrenceId: 'one/branch:0/physical:0',
      children: [{ childId: 'A', kg: 29 }, { childId: 'B', kg: 30 }] }] } }).verified, true);
  const accept = command(b, 'accept15', 'accept-proposal', null, { proposalId: proposed.items[0].proposalId });
  const result = service.applyDecisions({ basisId: b.basisId, scopeId: 'one', commands: [accept] });
  assert.equal(result[0].state, 'accepted');
  assert.deepEqual(service.applyDecisions({ basisId: b.basisId, scopeId: 'one', commands: [accept] }), result);
  const frozen = service.freezeSnapshot({ basisId: b.basisId, scopeId: 'one',
    stage: 'RigidMatch1', expectedDecisionRevision: result[0].decisionRevision });
  assert.equal(frozen.decisions[accept.occurrenceId].value, 15);
  throws(() => service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [frozen.snapshotRef],
    outputBasis: { components: [{ sourceId: 'one', occurrenceId: accept.occurrenceId, children: [{ childId: 'A', kg: 59 }] }] } }), 'MASS_NOT_CONSERVED');
});

test('Final Match-2 is distinct, revisioned, idempotent, and changes require reasons', () => {
  const b = basis(), service = createWeightReviewService({ score: oracleScore });
  service.openBasis(b, { facts: fixture(b) });
  const m = service.applyDecisions({ basisId: b.basisId, scopeId: 'one', commands: [
    command(b, 'manual20', 'enter-manual', null, { value: 20, unit: 'kg' })] })[0];
  const s1 = service.freezeSnapshot({ basisId: b.basisId, scopeId: 'one', stage: 'RigidMatch1', expectedDecisionRevision: m.decisionRevision });
  const f = service.applyDecisions({ basisId: b.basisId, scopeId: 'one', stage: 'Rigidmatch2', commands: [
    command(b, 'final22', 'final-override', null, { value: 22, unit: 'kg' })] })[0];
  const s2 = service.freezeSnapshot({ basisId: b.basisId, scopeId: 'one', stage: 'Rigidmatch2', expectedDecisionRevision: f.decisionRevision });
  const outputBasis = { components: [{ sourceId: 'one', occurrenceId: 'one/branch:0/physical:0',
    children: [{ childId: 'a', kg: 10 }, { childId: 'b', kg: 12 }], output: { unit: 'cii-force', scale: 10, value: 220 } }] };
  assert.equal(service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [s1.snapshotRef, s2.snapshotRef], outputBasis }).verified, true);
  throws(() => service.applyDecisions({ basisId: b.basisId, scopeId: 'one', stage: 'Rigidmatch2',
    commands: [command(b, 'replace23', 'final-override', f.decisionRevision, { value: 23, unit: 'kg' })],
    expectedDecisionRevision: f.decisionRevision }), 'OVERWRITE_REQUIRES_REASON');
  service.applyDecisions({ basisId: b.basisId, scopeId: 'one', stage: 'Rigidmatch2',
    commands: [command(b, 'replace23', 'final-override', f.decisionRevision, { value: 23, unit: 'kg', reason: 'engineer approved' })],
    expectedDecisionRevision: f.decisionRevision });
  throws(() => service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [s2.snapshotRef], outputBasis }), 'STALE_SNAPSHOT');
});

test('source isolation, duplicate NodeNumber=-1, Mode B lineage, atomicity and conflict fences', () => {
  const b = basis('xml-cii/2019', ['one', 'two']);
  const facts = [...fixture(b, 'one'), ...fixture(b, 'one', null, 1), ...fixture(b, 'two')];
  const ids = new Set(facts.map((f) => f.occurrenceId));
  assert.equal(ids.size, 3);
  const service = createWeightReviewService({ score: oracleScore });
  service.openBasis(b, { facts });
  throws(() => service.applyDecisions({ basisId: b.basisId, scopeId: 'one', commands: [
    command(b, 'ok', 'enter-manual', null, { value: 12, unit: 'kg' }),
    { ...command(b, 'wrong', 'enter-manual', null, { value: 12, unit: 'kg' }), occurrenceId: 'two/branch:0/physical:0' },
  ] }), 'IDENTITY_CONFLICT');
  const accepted = service.applyDecisions({ basisId: b.basisId, scopeId: 'one',
    commands: [command(b, 'after-atomic', 'enter-manual', null, { value: 12, unit: 'kg' })] })[0];
  assert.equal(accepted.decisionRevision, 'm1');
  throws(() => service.applyDecisions({ basisId: b.basisId, scopeId: 'one',
    commands: [command(b, 'stale', 'enter-manual', null, { value: 13, unit: 'kg' })] }), 'STALE_DECISION');
  const first = service.getFacts({ basisId: b.basisId, sourceId: 'one', limit: 2 });
  assert.equal(first.items.length, 2);
  assert.equal(first.totalCount, fixture(b, 'one').length * 2);
  assert.equal(service.getFacts({ basisId: b.basisId, sourceId: 'one', cursor: first.nextCursor, limit: 500 }).complete, true);
});

test('changed master same row count or source contents cannot masquerade as old basis', () => {
  const b = basis(), service = createWeightReviewService({ score: oracleScore });
  service.openBasis(b, { facts: fixture(b) });
  const changed = basis('xml-cii/2019', ['one'], 'master-v2');
  throws(() => service.applyDecisions({ basisId: changed.basisId, scopeId: 'one',
    commands: [command(changed, 'stale', 'enter-manual', null, { value: 20, unit: 'kg' })] }), 'UNKNOWN_BASIS');
  throws(() => service.openBasis(b, { facts: fixture(b, 'one', 59) }), 'BASIS_COLLISION');
  const broken = fixture(b);
  broken[0].value = Number.POSITIVE_INFINITY;
  throws(() => service.openBasis(b, { facts: broken }), 'INVALID_NUMBER');
});

test('conversion input 1207.3401/10 kg remains mass without extra conversion', () => {
  const b = basis(), physicalKg = 1207.3401 / 10;
  const service = createWeightReviewService({ score: oracleScore });
  service.openBasis(b, { facts: fixture(b, 'one', physicalKg) });
  assert.ok(Math.abs(physicalKg - 120.73401) < 1e-10);
  assert.equal(service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [], outputBasis: {
    components: [{ sourceId: 'one', occurrenceId: 'one/branch:0/physical:0',
      children: [{ childId: 'only', kg: physicalKg }], output: { unit: 'cii-force', scale: 10, value: 1207.3401 } }],
  } }).verified, true);
  throws(() => service.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [], outputBasis: {
    components: [{ sourceId: 'one', occurrenceId: 'one/branch:0/physical:0',
      children: [{ childId: 'only', kg: physicalKg }], output: { unit: 'cii-force', scale: 10, value: 12073.401 } }],
  } }), 'DOUBLE_CONVERSION');
});

test('existing indexed ranker: ±6 mm, top five, inferred not exact, 1595-row synthetic scale', () => {
  const b = basis();
  const masterRows = Array.from({ length: 1595 }, (_, i) => ({
    boreMm: i < 10 ? 100 : 200, rating: i < 10 ? '150' : '300',
    lengthMm: i < 10 ? 100 + i : 500, weight: 15 + i,
    type: 'VALVE', typeDesc: 'Gate Valve', id: i,
  }));
  const score = createXmlCiiFactWeightScorer({ weight: { masterRows, valveHintLengthToleranceMm: 6 } });
  const service = createWeightReviewService({ score });
  const t0 = performance.now();
  service.openBasis(b, { facts: fixture(b) });
  const proposals = service.getProposals({ basisId: b.basisId, occurrenceIds: ['one/branch:0/physical:0'], limit: 5 });
  assert.equal(proposals.items.length, 5);
  assert.ok(proposals.items.every((p) => p.value > 0 && p.unit === 'kg'));
  assert.equal(proposals.items[0].value, 15);
  assert.equal(proposals.items.filter((p) => p.qualified).length, 1);
  assert.equal(proposals.items.filter((p) => !p.qualified).length, 4);
  assert.ok(proposals.items.slice(1).every((p) =>
    p.method === 'length-extrapolated' && p.eligibilityReasons.includes('explicit-review-required')));
  // ±6mm ranking preserves five display candidates; only the 100mm master
  // has unscaled direct mass. Nearby rows are displayed but require engineer acceptance.
  const ms = performance.now() - t0;
  assert.ok(Number.isFinite(ms));
  console.log('SYNTHETIC_1595_WEIGHT_RANK_MS=' + ms.toFixed(2) + ' (NOT owner-scale browser evidence)');
});

test('non-XML facts use identical transactions and never import XML schema', () => {
  const b = basis('synthetic/mechanical-v1', ['one']);
  const f = [{ schemaVersion: WEIGHT_SCHEMA, domainId: b.domainId, basisId: b.basisId,
    subjectType: 'machine-part', sourceId: 'one', occurrenceId: 'one/part-1', fieldId: 'mass.kg',
    value: null, authority: 'unresolved', provenance: [{ sourceRef: 'one' }], diagnostics: [] }];
  const service = createWeightReviewService({ score: () => [] });
  service.openBasis(b, { facts: f });
  const c = { ...command(b, 'manual', 'enter-manual', null, { value: 7, unit: 'kg' }), occurrenceId: 'one/part-1' };
  const result = service.applyDecisions({ basisId: b.basisId, scopeId: 'one', commands: [c] });
  assert.equal(result[0].state, 'accepted');
  assert.equal(service.freezeSnapshot({ basisId: b.basisId, scopeId: 'one',
    stage: 'RigidMatch1', expectedDecisionRevision: result[0].decisionRevision }).decisions['one/part-1'].value, 7);
});

test('candidate audit retains length-rejected semantics and unresolved Rating never scores', () => {
  const b = basis();
  const config = { weight: { masterRows: [
    { boreMm: 100, rating: '150', lengthMm: 106, weight: 9, typeDesc: 'Gate Valve' },
    { boreMm: 100, rating: '150', lengthMm: 106.1, weight: 10, typeDesc: 'Gate Valve' },
  ], valveHintLengthToleranceMm: 6 } };
  const service = createWeightReviewService({ score: createXmlCiiFactWeightScorer(config) });
  const facts = fixture(b);
  service.openBasis(b, { facts });
  const proposals = service.getProposals({ basisId: b.basisId, occurrenceIds: ['one/branch:0/physical:0'] });
  assert.equal(proposals.items[0].value, 8.491); // existing length extrapolation: round(9 * 100 / 106, 3)
  const rejected = service.getCandidateAudit({ basisId: b.basisId, occurrenceId: 'one/branch:0/physical:0' }).rejectedCandidates;
  assert.ok(rejected.some((c) => c.rowLength === 106.1 && c.rejectedReason.includes('length failed')));
  const blocked = createWeightReviewService({ score: createXmlCiiFactWeightScorer(config) });
  const conflict = facts.map((f) => f.fieldId === 'rating' ? { ...f, authority: 'conflict', value: null, diagnostics: ['unresolved Rating'] } : f);
  blocked.openBasis(b, { facts: conflict });
  assert.equal(blocked.getProposals({ basisId: b.basisId, occurrenceIds: ['one/branch:0/physical:0'] }).items.length, 0);
});

test('cancelled asynchronous fact job fences late worker completion; incomplete run fails', async () => {
  const b = basis();
  const service = createWeightReviewService({ score: oracleScore });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  service.openBasisJob(b, { requestId: 'worker-001', loadFacts: async () => gate });
  assert.equal(service.subscribeJob('worker-001').event, 'progress');
  service.cancelJob('worker-001');
  release(fixture(b, 'one', 59));
  assert.equal((await service.awaitJob('worker-001')).event, 'cancelled');
  throws(() => service.getFacts({ basisId: b.basisId }), 'UNKNOWN_BASIS');
  const newer = createWeightReviewService({ score: oracleScore });
  newer.openBasis(b, { facts: [...fixture(b, 'one', 59), ...fixture(b, 'one', 60, 1)] });
  throws(() => newer.verifyRun({ basisId: b.basisId, reviewedSnapshotIds: [], outputBasis: {
    components: [{ sourceId: 'one', occurrenceId: 'one/branch:0/physical:0',
      children: [{ childId: 'only', kg: 59 }] }],
  } }), 'INCOMPLETE_RUN');
});

test('strict GC-PW unresolved value and command uniqueness enforcement', () => {
  const b = basis(), score = createXmlCiiFactWeightScorer({weight: {masterRows: []}});
  const service = createWeightReviewService({ score });
  const facts = fixture(b);
  assert.ok(facts.filter(f => f.authority === 'unresolved').every(f => f.value === null));
  const invalid = facts.map(f => f.fieldId === 'component.ref' ? {...f, authority: 'conflict', value: 'fake'} : f);
  throws(() => service.openBasis(b, { facts: invalid }), 'INVALID_FACT');
  service.openBasis(b, { facts });
  const page = service.getFacts({basisId: b.basisId, limit: 2});
  assert.equal(page.complete, true); // computation complete while nextCursor still represents more display pages
  assert.ok(page.nextCursor);
  throws(() => service.applyDecisions({basisId: b.basisId, scopeId: 'one',
    commands: [
      command(b, 'same', 'enter-manual', null, {value: 11, unit: 'kg'}),
      {...command(b, 'same', 'enter-manual', null, {value: 11, unit: 'kg'}), occurrenceId: 'one/branch:0/physical:0'},
    ]}), 'DUPLICATE_COMMAND');
});

test('Match-1 later edit leaves separately accepted Final Match-2 and precedence unchanged', () => {
  const before = { overrides: { rigidWeightFinal: { 'B::12': 59 }, rigidWeightMatch1: { 'B::12': 15 } } };
  const later = withXmlCiiRigidWeightMatch1(before, { 'B::12': 20 }, {
    'B::12': { schema: 'xml-cii-rigid-weight-match1-provenance/v1', acceptanceMethod: 'manual' },
  });
  assert.equal(later.overrides.rigidWeightFinal['B::12'], 59);
  assert.equal(later.overrides.rigidWeightMatch1['B::12'], 20);
  assert.equal(resolveXmlCiiRigidWeight(later, ['B::12']).weightKg, 59);
  assert.equal(before.overrides.rigidWeightMatch1['B::12'], 15);
});

test('Phase-6 and Final-review UI leave unselected weight proposals outside accepted inputs', () => {
  const renderer = fs.readFileSync(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
  const final = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js', import.meta.url), 'utf8');
  const match1 = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', import.meta.url), 'utf8');
  assert.ok(renderer.includes("const initial = issue.weight && issue.weight > 0 ? issue.weight : '';"));
  assert.ok(renderer.includes('weightMatchContentFingerprint({'));
  assert.ok(!renderer.includes('wmCacheFingerprint('));
  assert.ok(final.includes('value="${attr(issue.acceptedWeight ?? \'\')}"'));
  assert.ok(match1.includes('withXmlCiiRigidWeightMatch1(clean, { ...candidates, ...manual }, proposalMeta)'));
  assert.ok(!match1.includes('withXmlCiiRigidWeightFinal(withXmlCiiRigidWeightMatch1'));
  assert.ok(final.includes('isXmlCiiDirectQualifiedCandidate(best, row)'));
  assert.ok(!final.includes('function isDirectQualifiedCandidate(candidate)'));
  assert.ok(final.includes('const nextEntries = [];'));
  assert.ok(final.includes('workingEntries.splice(0, workingEntries.length, ...nextEntries)'));
  assert.ok(final.includes('Refresh failed; previous suggestions preserved.'));
});

test('scorer pins master rows against in-place mutation; proposal custody contains row and method', () => {
  const b = basis(), config = { weight: {masterRows: [
    {id: 'valve-row-77', boreMm: 100, rating: '150', lengthMm: 100, weight: 15, typeDesc: 'Gate Valve'},
  ] } };
  const score = createXmlCiiFactWeightScorer(config, 'rank-rev-1');
  config.weight.masterRows[0].weight = 99;
  config.weight.masterRows[0].rating = '300';
  const service = createWeightReviewService({score});
  service.openBasis(b, {facts: fixture(b)});
  const p = service.getProposals({basisId: b.basisId}).items[0];
  assert.equal(p.value, 15);
  assert.equal(service.getCandidateAudit({basisId:b.basisId, occurrenceId:'one/branch:0/physical:0'}).candidateCount, 1);
  assert.equal(p.extensions.candidate.masterRowOrdinal, 0);
  assert.equal(p.extensions.candidate.masterRowId, 'valve-row-77');
  assert.ok(p.evidenceRefs.includes('weight:master-row:0'));
  assert.ok(p.proposalId.includes('rank-rev-1'));
  config.weight.masterRows[0].rating = '150'; // a new scorer represents the changed master and must require a new basis
  const refreshed = createXmlCiiFactWeightScorer(config, 'rank-rev-2')(fixture(b), b)[0];
  assert.equal(refreshed.value, 99);
  assert.ok(refreshed.proposalId !== p.proposalId);
  throws(() => service.applyDecisions({basisId: b.basisId, scopeId:'one',
    commands: [command(b, 'stale-scoring', 'accept-proposal', null, {proposalId: refreshed.proposalId})],
  }), 'STALE_PROPOSAL');
});

test('same-bore Rating flange fallback remains explicitly proposed; not auto-accepted', () => {
  const b = basis();
  const facts = legacyXmlCiiWeightFacts([{
    key: 'BR::3', branchOccurrenceIndex:0, nodeOrdinal:0,
    boreMm:100, rating:'150', lengthMm:150, nodeName:'FLAN1', componentType:'FLAN',
    originalWeight: null,
  }], b, 'one');
  const score = createXmlCiiFactWeightScorer({ weight: { masterRows:[
    { id:'flange-master', boreMm:100, rating:'150', lengthMm:100, weight:20, typeDesc:'Flange' },
  ] } });
  const service = createWeightReviewService({score});
  service.openBasis(b,{facts});
  const p = service.getProposals({basisId: b.basisId}).items[0];
  assert.equal(p.value,30);
  assert.equal(p.qualified,false);
  assert.equal(p.extensions.candidate.flangeFallback,true);
  throws(() => service.verifyRun({basisId: b.basisId,reviewedSnapshotIds:[],
    outputBasis:{components:[{sourceId:'one',occurrenceId:'one/branch:0/physical:0',
      children:[{childId:'flan',kg:30}]}]}}), 'UNRESOLVED_WEIGHT');
});

test('sealed review state survives reopening, rejects tampering and respects both snapshots', async () => {
  const canonical = (value) => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  };
  const digestReview = async (value) => createHash('sha256').update(canonical(value)).digest('hex');
  const b = basis(), facts = fixture(b);
  const service = createWeightReviewService({ score: oracleScore, digestReview });
  service.openBasis(b, { facts });
  const m = service.applyDecisions({basisId:b.basisId,scopeId:'one',
    commands:[command(b,'persist-match1','enter-manual',null,{value:20,unit:'kg'})]})[0];
  const frozenMatch1 = service.freezeSnapshot({basisId:b.basisId,scopeId:'one',stage:'RigidMatch1',
    expectedDecisionRevision:m.decisionRevision});
  const f2 = service.applyDecisions({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2',
    commands:[command(b,'persist-final','final-override',null,{value:22,unit:'kg'})]})[0];
  const frozenFinal = service.freezeSnapshot({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2',
    expectedDecisionRevision:f2.decisionRevision});
  const sealed = await service.exportReviewState({basisId:b.basisId});
  assert.ok(/^[a-f0-9]{64}$/.test(sealed.contentSha256));
  assert.equal(sealed.reviewStates.length,2);
  const reopened = createWeightReviewService({score:oracleScore,digestReview});
  reopened.openBasis(b,{facts});
  assert.equal((await reopened.restoreReviewState({basisId:b.basisId,payload:sealed})).restoredSnapshots,2);
  assert.equal((await reopened.restoreReviewState({basisId:b.basisId,payload:sealed})).restoredStages,2);
  assert.equal(reopened.verifyRun({basisId:b.basisId,
    reviewedSnapshotIds:[frozenMatch1.snapshotRef,frozenFinal.snapshotRef],
    outputBasis:{components:[{sourceId:'one',occurrenceId:'one/branch:0/physical:0',
      children:[{childId:'P1',kg:10},{childId:'P2',kg:12}],output:{unit:'cii-force',scale:10,value:220}}]}}).verified,true);
  const tampered = JSON.parse(JSON.stringify(sealed));
  tampered.reviewStates[1].decisions['one/branch:0/physical:0'].value=59;
  await assert.rejects(() => reopened.restoreReviewState({basisId:b.basisId,payload:tampered}),
    e => e.code === 'REVIEW_DIGEST_MISMATCH');
  const rehashed = JSON.parse(JSON.stringify(tampered));
  const {contentSha256: _oldDigest,...body}=rehashed;
  rehashed.contentSha256 = await digestReview(body);
  await assert.rejects(() => reopened.restoreReviewState({basisId:b.basisId,payload:rehashed}),
    e => ['RESTORE_COLLISION','INVALID_REVIEW_WEIGHT'].includes(e.code));
});

test('inferred or fallback proposals need documented manual review before Match-1 acceptance', () => {
  const b = basis();
  const inferred = (records, currentBasis) => oracleScore(records, currentBasis).map(p => ({
    ...p, qualified: false, method: 'length-extrapolated',
    eligibilityReasons: ['inferred: outside exact ±6 mm length qualification'],
  }));
  const service = createWeightReviewService({score: inferred});
  service.openBasis(b, {facts:fixture(b)});
  const proposalId = service.getProposals({basisId:b.basisId}).items[0].proposalId;
  throws(() => service.applyDecisions({basisId:b.basisId,scopeId:'one',
    commands:[command(b,'inferred-no-reason','accept-proposal',null,{proposalId})],
  }), 'UNQUALIFIED_PROPOSAL');
  const committed = service.applyDecisions({basisId:b.basisId,scopeId:'one',
    commands:[command(b,'inferred-reviewed','accept-proposal',null,{
      proposalId,reason:'Engineer reviewed extrapolated master length and approved 15 kg',
    })]})[0];
  assert.equal(committed.state,'accepted');
  assert.equal(committed.decisionRevision,'m1'); // rejected transaction changed nothing
});

test('a rehashed forged Final snapshot cannot gain authority; physical facts require full run coverage', async () => {
  const canonical = (value) => Array.isArray(value)
    ? '[' + value.map(canonical).join(',') + ']'
    : value && typeof value === 'object'
      ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}'
      : JSON.stringify(value);
  const digestReview = async payload => createHash('sha256').update(canonical(payload)).digest('hex');
  const b = basis(), facts = fixture(b);
  const service = createWeightReviewService({score:oracleScore,digestReview});
  service.openBasis(b,{facts});
  const final = service.applyDecisions({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2',
    commands:[command(b,'final-legitimate','final-override',null,{value:22,unit:'kg'})]})[0];
  service.freezeSnapshot({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2',
    expectedDecisionRevision:final.decisionRevision});
  const forged = await service.exportReviewState({basisId:b.basisId});
  forged.frozenSnapshots[0].decisions['one/branch:0/physical:0'].value = 59;
  const {contentSha256:_old,...body} = forged;
  forged.contentSha256 = await digestReview(body);
  const reopened = createWeightReviewService({score:oracleScore,digestReview});
  reopened.openBasis(b,{facts});
  await assert.rejects(() => reopened.restoreReviewState({basisId:b.basisId,payload:forged}),
    error => error.code === 'SNAPSHOT_LEDGER_MISMATCH');
  const missingMassFact = facts.filter(f => f.fieldId !== 'mass.kg');
  const coverage = createWeightReviewService({score:oracleScore});
  coverage.openBasis(b,{facts:missingMassFact});
  throws(() => coverage.verifyRun({basisId:b.basisId,reviewedSnapshotIds:[],
    outputBasis:{components:[]}}), 'INCOMPLETE_RUN');
});

test('content-SHA cache custody rejects same-size source/staged/master changes and missing worker digests', async () => {
  const input = { xmlText: '<Node>A</Node>', stagedJsonText: '{"weight":15}',
    masterRows: [{boreMm:100,rating:'150',weight:15}],
    config: {weight:{rule:'exact'}}, ratingMode:'preview', snapshot:{revision:'pv-1',rating:'150'} };
  const fingerprint = await weightMatchContentFingerprint(input);
  assert.match(fingerprint, /^gc-pw-wm-sha256\/1:[a-f0-9]{64}$/);
  const changedXml = await weightMatchContentFingerprint({...input, xmlText:'<Node>B</Node>'});
  const changedStaged = await weightMatchContentFingerprint({...input, stagedJsonText:'{"weight":16}'});
  const changedMaster = await weightMatchContentFingerprint({...input, masterRows:[{boreMm:100,rating:'150',weight:16}]});
  assert.notEqual(fingerprint, changedXml);
  assert.notEqual(fingerprint, changedStaged);
  assert.notEqual(fingerprint, changedMaster);
  assert.equal(await weightMatchContentFingerprint({...input, masterRows:null,
    masterRef:{datasetId:'weight',rowCount:1595,masterFingerprint:'weak-legacy-value'}}),null);
  const validWorker = {...input,masterRows:null,
    masterRef:{datasetId:'weight',sha256:hash('row-content'),mappingSha256:hash('mapping'),revision:7}};
  const first = await weightMatchContentFingerprint(validWorker);
  const second = await weightMatchContentFingerprint({...validWorker,
    masterRef:{...validWorker.masterRef,sha256:hash('same-size-changed-master')}});
  assert.notEqual(first,second);
});

test('all-source exact bulk planner covers off-page physical facts, preserves source and prior acceptances', () => {
  const b = basis(), facts = [];
  for (let i = 0; i < 610; i++) facts.push(...fixture(b, 'one', i === 0 ? 59 : null, i));
  const service = createWeightReviewService({score:oracleScore});
  service.openBasis(b,{facts});
  const manual = service.applyDecisions({basisId:b.basisId,scopeId:'one',
    commands:[{...command(b,'already-manual','enter-manual',null,{value:20,unit:'kg'}),
      occurrenceId:'one/branch:1/physical:0'}]})[0];
  const visibleFirstPage = service.getFacts({basisId:b.basisId,sourceId:'one',limit:5});
  assert.equal(visibleFirstPage.items.length,5);
  assert.ok(visibleFirstPage.nextCursor);
  const planned = planExactSourceWeightCommands(service,{basisId:b.basisId,scopeId:'one',pageSize:113});
  assert.equal(planned.physicalCount,610);
  assert.equal(planned.preservedSourceWeights,1);
  assert.equal(planned.alreadyReviewed,1);
  assert.equal(planned.qualified,608); // unlike the visible 5 FactRecords
  assert.equal(planned.unresolved,0);
  assert.equal(new Set(planned.commands.map(x=>x.occurrenceId)).size,608);
  assert.ok(planned.commands.every(c=>c.action==='accept-proposal' &&
    c.expectedDecisionRevision===manual.decisionRevision));
  assert.equal(service.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,'m1');
  const results = commitExactSourceWeightCommands(service,planned);
  assert.equal(results.length,608);
  const state = service.getDecisionState({basisId:b.basisId,scopeId:'one'});
  assert.equal(state.decisionRevision,'m2');
  assert.equal(Object.keys(state.decisions).length,609);
  assert.equal(state.decisions['one/branch:1/physical:0'].value,20);
  assert.equal(state.decisions['one/branch:0/physical:0'],undefined); // preserve original XML 59kg
  assert.equal(planExactSourceWeightCommands(service,{basisId:b.basisId,scopeId:'one'}).qualified,0);
  const replay = { ...planned, commands: planned.commands.map(c=>({...c})) };
  assert.deepEqual(commitExactSourceWeightCommands(service,replay),results); // idempotent click retry
});

function canonicalSha(value) {
  const ordered = input => Array.isArray(input) ? input.map(ordered)
    : input && typeof input === 'object'
      ? Object.fromEntries(Object.keys(input).sort().map(key => [key, ordered(input[key])]))
      : input;
  return hash(JSON.stringify(ordered(value)));
}
function attestedFixture() {
  const custody = {
    sourceTexts: { one: '<Node number="-1">A</Node>' },
    selectionText: '{"source":"one"}',
    stagedSourceText: null,
    configText: '{"rating":"150"}',
    overridesText: '{}',
    masters: { weight: {datasetText:'[{"kg":15}]',mappingText:'{"mass":"kg"}'} },
    occurrenceIdsBySource: {one:['["one",0,0,"valve-A"]','["one",0,1,"valve-B"]']},
  };
  const b = {
    schemaVersion: WEIGHT_SCHEMA, domainId:'xml-cii/2019',
    sourceRefs:[{sourceId:'one',sha256:hash(custody.sourceTexts.one),mediaType:'application/xml'}],
    selectionSha256:hash(custody.selectionText),stagedSourceSha256:null,
    masters:{weight:{datasetId:'w',revision:1,sha256:hash(custody.masters.weight.datasetText),
      mappingSha256:hash(custody.masters.weight.mappingText),rowCount:1}},
    configSha256:hash(custody.configText),overridesSha256:hash(custody.overridesText),
    scope:[{sourceId:'one',selectionRef:'selected'}],
  };
  b.basisId = canonicalSha(b);
  const facts = custody.occurrenceIdsBySource.one.map(occurrenceId => ({
    schemaVersion:WEIGHT_SCHEMA,domainId:b.domainId,basisId:b.basisId,
    subjectType:'physical-component',sourceId:'one',occurrenceId,fieldId:'mass.kg',
    authority:'unresolved',value:null,unit:'kg',
    provenance:[{sourceRef:'one',locator:'source-ordinal'}],diagnostics:[],
  }));
  const service = () => createAttestedWeightReviewService({
    score:oracleScore,digestUtf8:async text => hash(text),
    digestCanonical:async value => canonicalSha(value),
  });
  return {b,custody,facts,service};
}

test('U1 attested facts cannot open without exact canonical basis/content and selected identity', async () => {
  const {b,custody,facts,service} = attestedFixture();
  const weight = service();
  assert.equal(typeof weight.openBasisJob,'function'); // strict attested job replaces the unverified mock path
  const opened = await weight.openBasis(b,{facts,custody});
  assert.equal(opened.attestation.physicalCount,2);
  assert.equal(weight.getFacts({basisId:b.basisId,subjectType:'physical-component'}).totalCount,2);
  const changed = {...custody,sourceTexts:{one:'<Node number="-1">B</Node>'}};
  assert.equal(changed.sourceTexts.one.length,custody.sourceTexts.one.length);
  await assert.rejects(() => service().openBasis(b,{facts,custody:changed}),
    e=>e.code==='INPUT_DIGEST_MISMATCH');
  const alteredMaster = {...custody,masters:{weight:{...custody.masters.weight,
    datasetText:'[{"kg":16}]'}}};
  await assert.rejects(() => service().openBasis(b,{facts,custody:alteredMaster}),
    e=>e.code==='INPUT_DIGEST_MISMATCH');
  const changedMapping = {...custody,masters:{weight:{...custody.masters.weight,
    mappingText:'{"mass":"lb"}'}}};
  await assert.rejects(() => service().openBasis(b,{facts,custody:changedMapping}),
    e=>e.code==='INPUT_DIGEST_MISMATCH');
  await assert.rejects(() => service().openBasis({...b,basisId:hash('not canonical')},{facts,custody}),
    e=>e.code==='BASIS_DIGEST_MISMATCH');
  await assert.rejects(() => service().openBasis(b,{facts,custody:{...custody,sourceTexts:{one:custody.sourceTexts.one,two:'extra'}}}),
    e=>e.code==='CUSTODY_SCOPE_MISMATCH');
});

test('U1 strict review rejects legacy row-index identities and incomplete/duplicate original custody', async () => {
  const {b,custody,facts,service} = attestedFixture();
  const incomplete = {...custody,occurrenceIdsBySource:{one:[custody.occurrenceIdsBySource.one[0]]}};
  await assert.rejects(() => service().openBasis(b,{facts,custody:incomplete}),
    e=>e.code==='POPULATION_MISMATCH');
  const duplicate = {...custody,occurrenceIdsBySource:{one:[facts[0].occurrenceId,facts[0].occurrenceId]}};
  await assert.rejects(() => service().openBasis(b,{facts,custody:duplicate}),
    e=>e.code==='POPULATION_MISMATCH');
  const legacy = legacyXmlCiiWeightFacts([{branchName:'B',nodeNumber:'-1',boreMm:100,
    rating:'150',lengthMm:100,componentType:'VALV'}],b,'one');
  await assert.rejects(() => service().openBasis(b,{facts:legacy,custody}),
    e=>e.code==='LEGACY_ONLY_FACT');
  assert.equal((await assertWeightInputCustody(b,facts,custody,{
    digestUtf8:async text=>hash(text),digestCanonical:async value=>canonicalSha(value)})).sourceCount,1);
  const strict=service();
  await strict.openBasis(b,{facts,custody});
  const decision=strict.applyDecisions({basisId:b.basisId,scopeId:'one',stage:'RigidMatch1',
    commands:[{commandId:'review-1',basisId:b.basisId,scopeId:'one',
      occurrenceId:facts[0].occurrenceId,action:'enter-manual',
      expectedDecisionRevision:null,value:22,unit:'kg'}]})[0];
  assert.equal(decision.state,'accepted');
  assert.equal(strict.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisions[facts[0].occurrenceId].value,22);
});

test('U1 attested asynchronous jobs fence cancel, stale worker replies and wrong content', async () => {
  const {b,custody,facts,service} = attestedFixture();
  const weight = service();
  let release;
  const late = new Promise(resolve => { release = resolve; });
  weight.openBasisJob(b,{requestId:'old-master',loadFacts:async()=>late});
  assert.equal(weight.subscribeJob('old-master').event,'progress');
  weight.openBasisJob(b,{requestId:'latest-master',loadFacts:async()=>({facts,custody})});
  release({facts,custody});
  assert.equal((await weight.awaitJob('old-master')).event,'cancelled');
  const latest = await weight.awaitJob('latest-master');
  assert.equal(latest.event,'completed');
  assert.equal(latest.completed,2);
  assert.equal(weight.getFacts({basisId:b.basisId}).totalCount,2);
  assert.throws(() => weight.openBasisJob(b,{requestId:'latest-master',loadFacts:async()=>({facts,custody})}),
    e=>e.code==='JOB_COLLISION');

  const broken = service();
  const corrupt = {...custody,sourceTexts:{one:'<Node number="-1">B</Node>'}};
  broken.openBasisJob(b,{requestId:'wrong-digest',loadFacts:async()=>({facts,custody:corrupt})});
  const failed = await broken.awaitJob('wrong-digest');
  assert.equal(failed.event,'failed');
  assert.equal(failed.error.code,'INPUT_DIGEST_MISMATCH');
  assert.throws(() => broken.getFacts({basisId:b.basisId}),e=>e.code==='UNKNOWN_BASIS');

  let unlock;
  const blocked = new Promise(resolve => {unlock=resolve;});
  const cancelled = service();
  cancelled.openBasisJob(b,{requestId:'cancel-before-complete',loadFacts:async()=>blocked});
  assert.equal(cancelled.cancelJob('cancel-before-complete').event,'cancelled');
  unlock({facts,custody});
  assert.equal((await cancelled.awaitJob('cancel-before-complete')).event,'cancelled');
  assert.throws(() => cancelled.getFacts({basisId:b.basisId}),e=>e.code==='UNKNOWN_BASIS');
});

test('U1 strict canonical session keeps portable non-XML domain and explicit source isolation', async () => {
  const {b,custody,facts} = attestedFixture();
  const domain='synthetic/mechanical-v1';
  const bytes={...custody,masters:{},occurrenceIdsBySource:{one:['one/part:0']}};
  const base={...b,domainId:domain,masters:{},sourceRefs:[{...b.sourceRefs[0],mediaType:'application/json'}]};
  delete base.basisId;
  base.basisId=canonicalSha(base);
  const f=[{...facts[0],domainId:domain,basisId:base.basisId,occurrenceId:'one/part:0',
    subjectType:'physical-component',fieldId:'mass.kg',value:null,authority:'unresolved'}];
  const strict=createAttestedWeightReviewService({score:()=>[],
    digestUtf8:async text=>hash(text),digestCanonical:async value=>canonicalSha(value)});
  await strict.openBasis(base,{facts:f,custody:bytes});
  const cmd={commandId:'accept-non-xml',basisId:base.basisId,scopeId:'one',
    occurrenceId:'one/part:0',action:'enter-manual',expectedDecisionRevision:null,value:7,unit:'kg'};
  const result=strict.applyDecisions({basisId:base.basisId,scopeId:'one',commands:[cmd]});
  assert.equal(result[0].state,'accepted');
  assert.equal(strict.getDecisionState({basisId:base.basisId,scopeId:'one'}).decisions['one/part:0'].value,7);
});

test('U1 strict Mode A and Mode B source lineage isolates duplicate negative node labels', async () => {
  const {b,custody,facts,service} = attestedFixture();
  const sourceTwo = '<Node number="-1">B</Node>'; // repeated legacy NodeNumber is not identity
  const idTwo = '["two",0,0,"valve-A"]';
  const combined = {...b};
  delete combined.basisId;
  combined.sourceRefs=[...b.sourceRefs,{sourceId:'two',sha256:hash(sourceTwo),mediaType:'application/xml'}];
  combined.scope=[...b.scope,{sourceId:'two',selectionRef:'selected'}];
  combined.basisId=canonicalSha(combined);
  const proof={...custody,sourceTexts:{...custody.sourceTexts,two:sourceTwo},
    occurrenceIdsBySource:{...custody.occurrenceIdsBySource,two:[idTwo]}};
  const rows=[
    ...facts.map(f=>({...f,basisId:combined.basisId})),
    {...facts[0],basisId:combined.basisId,sourceId:'two',occurrenceId:idTwo,
      provenance:[{sourceRef:'two',locator:'branch:0/node:0'}]},
  ];
  const strict=service();
  const opened=await strict.openBasis(combined,{facts:rows,custody:proof});
  assert.equal(opened.attestation.sourceCount,2);
  assert.equal(opened.attestation.physicalCount,3);
  const first=strict.applyDecisions({basisId:combined.basisId,scopeId:'one',
    commands:[{commandId:'one-accepted',basisId:combined.basisId,scopeId:'one',
      occurrenceId:rows[0].occurrenceId,action:'enter-manual',expectedDecisionRevision:null,
      value:59,unit:'kg'}]});
  assert.equal(first[0].state,'accepted');
  assert.equal(strict.getDecisionState({basisId:combined.basisId,scopeId:'two'}).decisionRevision,null);
  assert.throws(()=>strict.applyDecisions({basisId:combined.basisId,scopeId:'one',
    commands:[{commandId:'two-leak',basisId:combined.basisId,scopeId:'one',
      occurrenceId:idTwo,action:'enter-manual',expectedDecisionRevision:first[0].decisionRevision,
      value:15,unit:'kg'}],expectedDecisionRevision:first[0].decisionRevision}),
    e=>e.code==='IDENTITY_CONFLICT');
  const missing={...proof,occurrenceIdsBySource:{one:proof.occurrenceIdsBySource.one,two:[]}};
  await assert.rejects(()=>service().openBasis(combined,{facts:rows,custody:missing}),
    e=>e.code==='POPULATION_MISMATCH');
  const aliased={...rows, 0:{...rows[0],occurrenceId:idTwo}}; // fabricate same cross-source physical identity
  await assert.rejects(()=>service().openBasis(combined,{
    facts:[aliased[0],...rows.slice(1)],
    custody:{...proof,occurrenceIdsBySource:{one:[idTwo,rows[1].occurrenceId],two:[idTwo]}},
  }),e=>e.code==='IDENTITY_CONFLICT');
});

test('U2 exact qualification cannot silently promote preferred special factors or inferred methods', () => {
  const exact={preferred:true,lengthQualified:true,ratingExact:true,weightMethod:'master',
    weight:15,typeDesc:'Gate Valve',inferredWeight:false,flangeWeightFallback:false};
  assert.equal(isXmlCiiDirectQualifiedCandidate(exact,{nodeName:'VGT-1',dtxr:'GATE VALVE'}),true);
  for (const extension of [
    {specialFactorRule:true}, {flangeWeightFallback:true}, {fallbackSuggestion:true},
    {oddEntry:true}, {inferredWeight:true}, {zeroFallback:true},
    {lengthQualified:false}, {ratingExact:false},
    {weightMethod:'length-interpolated'}, {weightMethod:'length-extrapolated'},
    {weightMethod:'special-factor'}, {preferred:false},
  ]) assert.equal(isXmlCiiDirectQualifiedCandidate({...exact,...extension}),false,
    'unqualified candidate should require explicit review: '+JSON.stringify(extension));
  const b=basis();
  const scored=createXmlCiiFactWeightScorer({weight:{masterRows:[
    {id:'row-1',boreMm:100,rating:'150',lengthMm:100,weight:15,typeDesc:'Gate Valve'},
  ]}})(fixture(b),b);
  assert.equal(scored[0].qualified,true); // preserve direct exact master outcome
  assert.equal(scored[0].eligibilityReasons[0],'exact-bore-rating-length');
});

test('U2 held-out mini-master oracle: DTXR gate rank, exact 100, extrapolated 106 and rejected 106.1', () => {
  // Hand-stated engineering oracle, independent of the application's ranked output:
  // 100 mm gate = 15 kg direct; 106 mm gate = 9 * (100/106) = 8.491 kg
  // when extrapolation is enabled; 106.1 mm is OUTSIDE the ±6 mm gate.
  // Same-bore different Rating and same-Rating different bore cannot qualify.
  const b = basis();
  const rows = [
    {id:'gate-exact-100',boreMm:100,rating:'150',lengthMm:100,weight:15,typeDesc:'Gate Valve'},
    {id:'gate-near-106',boreMm:100,rating:'150',lengthMm:106,weight:9,typeDesc:'Gate Valve'},
    {id:'gate-rejected-106.1',boreMm:100,rating:'150',lengthMm:106.1,weight:10,typeDesc:'Gate Valve'},
    {id:'ball-exact',boreMm:100,rating:'150',lengthMm:100,weight:30,typeDesc:'Ball Valve'},
    {id:'wrong-rating',boreMm:100,rating:'300',lengthMm:100,weight:500,typeDesc:'Gate Valve'},
    {id:'wrong-bore',boreMm:200,rating:'150',lengthMm:100,weight:600,typeDesc:'Gate Valve'},
  ];
  const service = createWeightReviewService({score:createXmlCiiFactWeightScorer({
    weight:{masterRows:rows,valveHintLengthToleranceMm:6,useWeightExtrapolation:true}
  },'golden-mini-v1')});
  const physical = fixture(b);
  service.openBasis(b,{facts:physical});
  const proposed = service.getProposals({basisId:b.basisId}).items;
  assert.equal(proposed[0].extensions.candidate.masterRowId,'gate-exact-100');
  assert.equal(proposed[0].value,15);
  assert.equal(proposed[0].qualified,true);
  assert.equal(proposed[1].extensions.candidate.masterRowId,'gate-near-106');
  assert.equal(proposed[1].value,8.491);
  assert.equal(proposed[1].method,'length-extrapolated');
  assert.equal(proposed[1].qualified,false);
  assert.ok(proposed.every(p=>p.value!==500 && p.value!==600));
  assert.ok(!proposed.some(p=>p.extensions.candidate.masterRowId==='gate-rejected-106.1'));
  const audit = service.getCandidateAudit({basisId:b.basisId,occurrenceId:physical[0].occurrenceId});
  assert.ok(audit.rejectedCandidates.some(row=>
    row.masterRowId==='gate-rejected-106.1' && /length failed/.test(row.rejectedReason)));
  // The proposed value is NOT an accepted Match-1 decision.
  assert.equal(service.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
});

test('U2 held-out emergency factor: 20 kg control master proposes 40 kg, never exact bulk', () => {
  const b = basis();
  const records = legacyXmlCiiWeightFacts([{
    key:'B::-1',branchOccurrenceIndex:0,nodeOrdinal:0,boreMm:100,rating:'150',
    lengthMm:100,nodeName:'EMERGENCY-UZV-1',componentType:'VALV',
    dtxr:'EMERGENCY UZV',originalWeight:null,
  }],b,'one');
  const service = createWeightReviewService({score:createXmlCiiFactWeightScorer({
    weight:{masterRows:[{id:'control-20',boreMm:100,rating:'150',
      lengthMm:100,weight:20,typeDesc:'Control Valve'}]}
  },'golden-factor-v1')});
  service.openBasis(b,{facts:records});
  const p = service.getProposals({basisId:b.basisId}).items[0];
  assert.equal(p.value,40); // independent 20 kg × rule factor 2
  assert.equal(p.method,'special-factor');
  assert.equal(p.qualified,false);
  assert.equal(p.extensions.candidate.factor,true);
  throws(()=>service.applyDecisions({basisId:b.basisId,scopeId:'one',commands:[
    command(b,'factor-without-review','accept-proposal',null,{proposalId:p.proposalId})
  ]}),'UNQUALIFIED_PROPOSAL');
  const accepted=service.applyDecisions({basisId:b.basisId,scopeId:'one',commands:[
    command(b,'factor-with-review','accept-proposal',null,{proposalId:p.proposalId,
      reason:'Engineer reviewed UZV emergency factor against source Valve and Rating.'})
  ]});
  assert.equal(accepted[0].state,'accepted');
  assert.equal(service.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisions[records[0].occurrenceId].value,40);
});

test('U5 explicit verified Mode A Match-1 uses all off-page occurrences without overwriting source mass', () => {
  const b=basis('xml-cii/2019',['one','two']),facts=[];
  for(let i=0;i<512;i++) {
    const source=i<510?'one':'two';
    facts.push({schemaVersion:WEIGHT_SCHEMA,basisId:b.basisId,domainId:b.domainId,
      subjectType:'physical-component',sourceId:source,
      occurrenceId:JSON.stringify([source,0,i,'valve-'+i]),fieldId:'mass.kg',
      authority:i===0?'source':'unresolved',value:i===0?59:null,unit:'kg',
      provenance:[{sourceRef:source,locator:'original ordinal'}],diagnostics:[]});
  }
  const review=createWeightReviewService({score:oracleScore});
  review.openBasis(b,{facts});
  const session={basis:b,review,openedFacts:facts.length};
  const plan=planVerifiedModeAExactMatch1(session);
  assert.equal(plan.physicalCount,512);
  assert.equal(plan.preservedSourceWeights,1);
  assert.equal(plan.qualified,511);
  assert.equal(plan.plans[0].commands.length,509); // beyond first 100 visible rows
  assert.equal(plan.plans[1].commands.length,2);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
  const result=commitVerifiedModeAExactMatch1(session,plan);
  assert.equal(result.accepted,511);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisions[facts[0].occurrenceId],undefined);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'two'}).decisions[facts.at(-1).occurrenceId].value,15);
  assert.equal(planVerifiedModeAExactMatch1(session).qualified,0);
});

test('U5 preflight fences stale later-source revision and tampered bulk acceptance before first source', () => {
  const b=basis('xml-cii/2019',['one','two']);
  const facts=[...fixture(b,'one'),...fixture(b,'two')];
  const review=createWeightReviewService({score:oracleScore});
  review.openBasis(b,{facts});
  const session={basis:b,review,openedFacts:facts.length};
  const stale=planVerifiedModeAExactMatch1(session);
  const c={commandId:'source2-manual',basisId:b.basisId,scopeId:'two',
    occurrenceId:facts.at(-1).occurrenceId,expectedDecisionRevision:null,
    action:'enter-manual',value:22,unit:'kg'};
  review.applyDecisions({basisId:b.basisId,scopeId:'two',commands:[c]});
  throws(()=>commitVerifiedModeAExactMatch1(session,stale),'STALE_REVIEW_PLAN');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
  const fresh=planVerifiedModeAExactMatch1(session);
  const tampered=JSON.parse(JSON.stringify(fresh));
  tampered.plans[0].commands[0].action='enter-manual';
  tampered.plans[0].commands[0].value=777;
  tampered.plans[0].commands[0].unit='kg';
  throws(()=>commitVerifiedModeAExactMatch1(session,tampered),'STALE_REVIEW_PLAN');
  throws(()=>planVerifiedModeAExactMatch1({basis:b,review}),'VERIFIED_SESSION_REQUIRED');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
});

test('U5 optional owned Mode A toolbar does not legacy-persist a verified canonical session', () => {
  const ui=fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-weight-tools.js',import.meta.url),'utf8');
  assert.ok(ui.includes('options.canonicalSession'));
  assert.ok(ui.includes('commitVerifiedModeAExactMatch1(options.canonicalSession, plan)'));
  assert.ok(ui.includes('Do NOT write legacy rigidWeight overrides'));
  assert.ok(ui.includes('if (dtxrMode) throw new Error'));
});

test('U6 source 59 kg, Match-1 20 kg, and explicit Final 22 kg have separate frozen authority', () => {
  const b=basis('xml-cii/2019',['one','two']),facts=[...fixture(b,'one',59),...fixture(b,'two')];
  const review=createWeightReviewService({score:oracleScore});
  review.openBasis(b,{facts});
  const session={basis:b,review,openedFacts:facts.length},idTwo=facts.at(-1).occurrenceId;
  throws(()=>planVerifiedFinalMatch2(session,[]),'INCOMPLETE_FINAL_REVIEW');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'two',stage:'Rigidmatch2'}).decisionRevision,null);
  const m=review.applyDecisions({basisId:b.basisId,scopeId:'two',stage:'RigidMatch1',commands:[{
    commandId:'match1-20',basisId:b.basisId,scopeId:'two',occurrenceId:idTwo,
    expectedDecisionRevision:null,action:'enter-manual',value:20,unit:'kg',
  }]})[0];
  const frozenMatch1=review.freezeSnapshot({basisId:b.basisId,scopeId:'two',
    stage:'RigidMatch1',expectedDecisionRevision:m.decisionRevision});
  const withoutFinal=planVerifiedFinalMatch2(session,[]);
  assert.equal(withoutFinal.retained,2);
  assert.equal(withoutFinal.overrides,0); // Match-1 20 is NOT Final 22
  const choices=[{sourceId:'two',occurrenceId:idTwo,value:22,unit:'kg',
    reason:'Engineer explicitly approved 22 kg for Final Rigid Match-2.'}];
  const planned=planVerifiedFinalMatch2(session,choices);
  assert.equal(planned.retained,1);
  assert.equal(planned.overrides,1);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'two',stage:'Rigidmatch2'}).decisionRevision,null);
  const applied=commitVerifiedFinalMatch2(session,planned);
  assert.equal(applied.acceptedOverrides,1);
  assert.equal(applied.finalSnapshots.length,2);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'two',stage:'RigidMatch1'}).decisions[idTwo].value,20);
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'two',stage:'Rigidmatch2'}).decisions[idTwo].value,22);
  const reviewed=[frozenMatch1.snapshotRef,...applied.finalSnapshots.map(s=>s.snapshotRef)];
  const output={components:[
    {sourceId:'one',occurrenceId:facts[0].occurrenceId,
      children:[{childId:'A',kg:29},{childId:'B',kg:30}],
      output:{unit:'cii-force',scale:10,value:590}},
    {sourceId:'two',occurrenceId:idTwo,
      children:[{childId:'C',kg:10},{childId:'D',kg:12}],
      output:{unit:'cii-force',scale:10,value:220}},
  ]};
  assert.equal(review.verifyRun({basisId:b.basisId,reviewedSnapshotIds:reviewed,outputBasis:output}).verified,true);
  const wrong=structuredClone(output);wrong.components[1].children[1].kg=10;
  throws(()=>review.verifyRun({basisId:b.basisId,reviewedSnapshotIds:reviewed,outputBasis:wrong}),'MASS_NOT_CONSERVED');
});

test('U6 Final stage rejects missing reason, out-of-scope IDs and stale later source before mutation', () => {
  const b=basis('xml-cii/2019',['one','two']),facts=[...fixture(b,'one',59),...fixture(b,'two',60)];
  const review=createWeightReviewService({score:oracleScore});
  review.openBasis(b,{facts});
  const session={basis:b,review,openedFacts:facts.length};
  const one=facts[0].occurrenceId,two=facts.at(-1).occurrenceId;
  throws(()=>planVerifiedFinalMatch2(session,[{sourceId:'one',occurrenceId:one,value:22}]),
    'ENGINEERING_FINAL_REASON_REQUIRED');
  throws(()=>planVerifiedFinalMatch2(session,[{sourceId:'one',occurrenceId:'fake',value:22,
    reason:'explicit check'}]),'UNKNOWN_FINAL_OCCURRENCE');
  throws(()=>planVerifiedFinalMatch2(session,[
    {sourceId:'one',occurrenceId:one,value:22,reason:'review A'},
    {sourceId:'one',occurrenceId:one,value:23,reason:'review B'}
  ]),'DUPLICATE_FINAL_CHOICE');
  const choice=[
    {sourceId:'one',occurrenceId:one,value:22,reason:'Explicit first source Final approval'},
    {sourceId:'two',occurrenceId:two,value:23,reason:'Explicit second source Final approval'},
  ];
  const stale=planVerifiedFinalMatch2(session,choice);
  review.applyDecisions({basisId:b.basisId,scopeId:'two',commands:[{
    commandId:'late-match1-change',basisId:b.basisId,scopeId:'two',
    occurrenceId:two,expectedDecisionRevision:null,action:'enter-manual',value:61,unit:'kg',
  }]});
  throws(()=>commitVerifiedFinalMatch2(session,stale),'STALE_FINAL_REVIEW');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2'}).decisionRevision,null);
  const current=planVerifiedFinalMatch2(session,choice),tampered=structuredClone(current);
  tampered.plans[0].commands[0].value=500;
  throws(()=>commitVerifiedFinalMatch2(session,tampered),'STALE_FINAL_REVIEW');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2'}).decisionRevision,null);
});

test('U6 Final review cannot silently use unaccepted proposed 15 kg as physical mass', () => {
  const b=basis(),review=createWeightReviewService({score:oracleScore});
  review.openBasis(b,{facts:fixture(b)});
  const session={basis:b,review,openedFacts:13};
  const proposal=review.getProposals({basisId:b.basisId}).items[0];
  assert.equal(proposal.value,15);
  throws(()=>planVerifiedFinalMatch2(session,[]),'INCOMPLETE_FINAL_REVIEW');
  assert.equal(review.getDecisionState({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2'}).decisionRevision,null);
});

function individualCase({score=oracleScore,sourceWeight=null}={}) {
  const b=basis('xml-cii/2019',['one','two']);
  const id=JSON.stringify(['one',0,0,'gate-v1']);
  const other=JSON.stringify(['two',0,0,'gate-v1']);
  const row=(sourceId,occurrenceId,value)=>({
    schemaVersion:WEIGHT_SCHEMA,domainId:b.domainId,basisId:b.basisId,
    subjectType:'physical-component',sourceId,occurrenceId,fieldId:'mass.kg',
    authority:value===null?'unresolved':'source',value,unit:'kg',
    provenance:[{sourceRef:sourceId,locator:'original/0/0'}],diagnostics:[],
  });
  const review=createWeightReviewService({score});
  review.openBasis(b,{facts:[row('one',id,sourceWeight),row('two',other,null)]});
  return {basis:b,review,openedFacts:2,id,other};
}

test('U4 individual canonical exact proposal needs explicit action, and changing 59kg source needs reason',()=>{
  const session=individualCase({sourceWeight:59}),id=session.id,b=session.basis;
  const view=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id});
  assert.equal(view.sourceKg,59);
  assert.equal(view.effectiveKg,59);
  assert.equal(view.proposals[0].value,15);
  assert.equal(view.proposals[0].qualified,true);
  assert.equal(session.review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
  throws(()=>commitVerifiedIndividualWeightReview(session,view,
    {action:'accept-proposal',proposalId:view.proposals[0].proposalId}),'SOURCE_OVERRIDE_REASON_REQUIRED');
  const applied=commitVerifiedIndividualWeightReview(session,view,
    {action:'accept-proposal',proposalId:view.proposals[0].proposalId,
      reason:'Engineering reviewed a corrected 15 kg master against original 59 kg source.'});
  assert.equal(applied.result.state,'accepted');
  assert.equal(applied.view.match1Kg,15);
  assert.equal(applied.view.sourceKg,59);
  assert.equal(applied.snapshot.stage,'RigidMatch1');
  assert.equal(applied.snapshot.decisions[id].value,15);
  assert.equal(session.review.getDecisionState({basisId:b.basisId,scopeId:'two'}).decisionRevision,null);
  throws(()=>commitVerifiedIndividualWeightReview(session,view,
    {action:'reject',reason:'old view cannot overwrite accepted'}),'STALE_INDIVIDUAL_REVIEW');
});

test('U4 individual inferred/factor suggestion requires a reason, manual and Final stages remain distinct',()=>{
  const inferred=(rows,b)=>oracleScore(rows,b).map(p=>({...p,qualified:false,method:'special-factor'}));
  const session=individualCase({score:inferred}),id=session.id,b=session.basis;
  const view=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id});
  throws(()=>commitVerifiedIndividualWeightReview(session,view,
    {action:'accept-proposal',proposalId:view.proposals[0].proposalId}),'UNQUALIFIED_PROPOSAL');
  throws(()=>commitVerifiedIndividualWeightReview(session,view,
    {action:'accept-proposal',proposalId:'forged',reason:'reviewed'}),'STALE_PROPOSAL');
  const m=commitVerifiedIndividualWeightReview(session,view,
    {action:'enter-manual',value:20,unit:'kg',reason:'Verified physical valve mass from engineer.'});
  assert.equal(m.view.match1Kg,20);
  const f=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id,stage:'Rigidmatch2'});
  assert.equal(f.effectiveKg,20);
  throws(()=>commitVerifiedIndividualWeightReview(session,f,
    {action:'accept-proposal',proposalId:view.proposals[0].proposalId}),'STAGE_CONFLICT');
  throws(()=>commitVerifiedIndividualWeightReview(session,f,
    {action:'final-override',value:22,unit:'kg'}),'ENGINEERING_REASON_REQUIRED');
  const final=commitVerifiedIndividualWeightReview(session,f,
    {action:'final-override',value:22,unit:'kg',
      reason:'Final Rigid review selects 22 kg independent of Match-1.'});
  assert.equal(final.snapshot.stage,'Rigidmatch2');
  assert.equal(final.view.match1Kg,20);
  assert.equal(final.view.finalKg,22);
  assert.equal(final.view.effectiveKg,22);
  const output={components:[
    {sourceId:'one',occurrenceId:id,children:[{childId:'a',kg:10},{childId:'b',kg:12}],
      output:{unit:'cii-force',scale:10,value:220}},
    {sourceId:'two',occurrenceId:session.other,children:[{childId:'c',kg:15}],
      output:{unit:'cii-force',scale:10,value:150}},
  ]};
  // A proposal for source two is still NOT accepted, despite being ranked.
  throws(()=>session.review.verifyRun({basisId:b.basisId,
    reviewedSnapshotIds:[m.snapshot.snapshotRef,final.snapshot.snapshotRef],outputBasis:output}),'UNRESOLVED_WEIGHT');
});

test('U4 individual Reject/Defer leave physical mass unresolved and revisions are source- and stage-scoped',()=>{
  const session=individualCase(),id=session.id,b=session.basis;
  const original=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id});
  throws(()=>commitVerifiedIndividualWeightReview(session,original,{action:'defer'}),'ENGINEERING_REASON_REQUIRED');
  const deferred=commitVerifiedIndividualWeightReview(session,original,
    {action:'defer',reason:'Await independent original source valve mass.'});
  assert.equal(deferred.result.state,'deferred');
  const final=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id,stage:'Rigidmatch2'});
  assert.equal(final.stageRevision,null);
  assert.equal(final.match1Revision,'m1');
  assert.equal(final.effectiveKg,null);
  const rejected=commitVerifiedIndividualWeightReview(session,final,
    {action:'reject',reason:'Final review cannot accept missing mass.'});
  assert.equal(rejected.result.state,'rejected');
  assert.equal(rejected.snapshot.stage,'Rigidmatch2');
  assert.equal(rejected.view.effectiveKg,null);
  throws(()=>readVerifiedIndividualWeightReview(session,{sourceId:'two',occurrenceId:id}),
    'SOURCE_SCOPE_CONFLICT');
  throws(()=>readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:'one/branch:0/physical:0'}),
    'NONCANONICAL_WEIGHT_OCCURRENCE');
});

test('U4 view invalidated by other stage revision; no cross-stage CAS bypass',()=>{
  const session=individualCase(),id=session.id,b=session.basis;
  const stale=readVerifiedIndividualWeightReview(session,{sourceId:'one',occurrenceId:id,stage:'RigidMatch1'});
  session.review.applyDecisions({basisId:b.basisId,scopeId:'one',stage:'Rigidmatch2',commands:[{
    commandId:'out-of-band-final',basisId:b.basisId,scopeId:'one',occurrenceId:id,
    expectedDecisionRevision:null,action:'final-override',value:22,unit:'kg',
    reason:'Out-of-band reviewed Final change.'
  }]});
  throws(()=>commitVerifiedIndividualWeightReview(session,stale,
    {action:'enter-manual',value:15,unit:'kg',reason:'Old Match-1 view.'}),
    'STALE_INDIVIDUAL_REVIEW');
  assert.equal(session.review.getDecisionState({basisId:b.basisId,scopeId:'one',stage:'RigidMatch1'}).decisionRevision,null);
  throws(()=>readVerifiedIndividualWeightReview({basis:b,review:session.review},
    {sourceId:'one',occurrenceId:id}),'VERIFIED_SESSION_REQUIRED');
});

test('U4 individual dialog cancel never commits; explicit Match1 then Final clicks freeze distinct snapshots',async()=>{
  class FakeElement {
    constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.listeners={};
      this.value='';this.disabled=false;this.textContent='';this.attrs={};this.removed=false;}
    appendChild(element){this.children.push(element);element.parent=this;return element;}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(name,callback){this.listeners[name]=callback;}
    click(){this.listeners.click?.();}
    remove(){this.removed=true;this.parent&&(this.parent.children=this.parent.children.filter(e=>e!==this));}
    focus(){}
    walk(){return [this,...this.children.flatMap(x=>x.walk())];}
  }
  const body=new FakeElement('body'),documentRef={body,createElement:tag=>new FakeElement(tag)};
  const session=individualCase(),id=session.id,b=session.basis;
  const cancelled=openVerifiedIndividualWeightReviewDialog({session,sourceId:'one',occurrenceId:id,documentRef});
  assert.equal(session.review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
  body.walk().find(x=>x.tag==='button'&&x.textContent==='Cancel').click();
  assert.equal((await cancelled).cancelled,true);
  assert.equal(session.review.getDecisionState({basisId:b.basisId,scopeId:'one'}).decisionRevision,null);
  const started=openVerifiedIndividualWeightReviewDialog({session,sourceId:'one',occurrenceId:id,documentRef});
  const select=body.walk().find(x=>x.tag==='select');
  select.value=session.review.getProposals({basisId:b.basisId,occurrenceIds:[id]}).items[0].proposalId;
  body.walk().find(x=>x.tag==='button'&&x.textContent==='Accept selected proposal').click();
  const accepted=await started;
  assert.equal(accepted.cancelled,false);
  assert.equal(accepted.snapshot.stage,'RigidMatch1');
  assert.equal(accepted.view.match1Kg,15);
  const final=openVerifiedIndividualWeightReviewDialog({session,sourceId:'one',occurrenceId:id,
    stage:'Rigidmatch2',documentRef});
  const options=body.walk().find(x=>x.tag==='select');
  assert.equal(options.disabled,true);
  body.walk().find(x=>x.tag==='input').value='22';
  body.walk().find(x=>x.tag==='textarea').value='Engineer accepted final actual 22 kg.';
  body.walk().find(x=>x.tag==='button'&&x.textContent==='Accept Final kg').click();
  const finalized=await final;
  assert.equal(finalized.snapshot.stage,'Rigidmatch2');
  assert.equal(finalized.view.match1Kg,15);
  assert.equal(finalized.view.finalKg,22);
  assert.equal(body.children.length,0);
});

test('U4 single Weight panel binds only injected canonical original occurrence and keeps Final separate',()=>{
  const panel=fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',import.meta.url),'utf8');
  assert.ok(panel.includes('options.canonicalIndividual || null'));
  assert.ok(panel.includes('readVerifiedIndividualWeightReview(canonicalIndividual.session'));
  assert.ok(panel.includes("stage: 'RigidMatch1'"));
  assert.ok(panel.includes('openVerifiedIndividualWeightReviewDialog({'));
  assert.ok(panel.includes('decision.snapshot.revision'));
  assert.ok(panel.includes('Separate Final review and shared CII Run approval are still required.'));
  assert.ok(!panel.includes("nodeNumber: canonicalIndividual"));
});
