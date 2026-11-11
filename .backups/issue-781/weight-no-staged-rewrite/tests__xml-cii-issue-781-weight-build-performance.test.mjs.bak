import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  rankXmlCiiWeightCandidates,
  weightMasterEligibleRows,
} from '../converters/xml-cii2019-core/weight-valve-hints.js';
import { buildPipingClassIndex } from '../converters/xml-cii2019-core/piping-class-resolver.js';

function normRating(value) {
  return String(value ?? '').replace(/#/g, '').trim().toUpperCase();
}
function boreOf(row) {
  for (const key of ['boreMm', 'convertedBore', 'Converted Bore', 'bore', 'Bore', 'BORE', 'DN', 'NB', 'NPS']) {
    const match = String(row?.[key] ?? row?._raw?.[key] ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (match && Number.isFinite(Number(match[0]))) return Number(match[0]);
  }
  return null;
}
function ratingOf(row) {
  for (const key of ['ratingClass', 'rating', 'Rating', 'RATING', 'Class', 'CLASS', 'Pressure Class']) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (String(value ?? '').trim()) return normRating(value);
  }
  return '';
}
function bruteEligible(rows, bore, rating) {
  const wanted = normRating(rating);
  return rows.filter((row) => {
    const rowBore = boreOf(row);
    if (!Number.isFinite(rowBore) || Math.abs(rowBore - Number(bore)) >= 1) return false;
    const rowRating = ratingOf(row);
    const exact = rowRating === wanted;
    const partial = !exact && rowRating && wanted && (rowRating.includes(wanted) || wanted.includes(rowRating));
    return exact || partial;
  });
}
function signature(result) {
  return {
    candidates: (result.candidates || []).map((row) => [row.rowData?.id, row.selectedWeight, row.weightMethod, row.preferred, row.semanticTier, row.lengthDelta]),
    rejected: (result.rejectedCandidates || []).map((row) => [row.rowData?.id, row.selectedWeight, row.weightMethod, row.semanticPotentialTier, row.lengthDelta]),
    best: result.best?.rowData?.id || null,
  };
}

test('indexed Weight eligibility preserves exact existing bore/rating semantics and source order', () => {
  const rows = [
    { id: 'far-bore', boreMm: 98.99, rating: '150', lengthMm: 100, weight: 1, typeDesc: 'Gate Valve' },
    { id: 'exact', boreMm: 100, rating: '150', lengthMm: 100, weight: 10, typeDesc: 'Gate Valve' },
    { id: 'partial', boreMm: 100.4, rating: 'CL150', lengthMm: 101, weight: 11, typeDesc: 'Gate Valve' },
    { id: 'boundary-in', boreMm: 100.999, rating: '150', lengthMm: 102, weight: 12, typeDesc: 'Gate Valve' },
    { id: 'boundary-out', boreMm: 101, rating: '150', lengthMm: 103, weight: 13, typeDesc: 'Gate Valve' },
    { id: 'wrong-rating', boreMm: 100, rating: '300', lengthMm: 100, weight: 14, typeDesc: 'Gate Valve' },
  ];
  const expected = bruteEligible(rows, 100, '150');
  const actual = weightMasterEligibleRows(rows, 100, '150');
  assert.deepEqual(actual.map((row) => row.id), expected.map((row) => row.id));
});

test('indexed full-master ranking is semantically identical to brute-force eligible subset ranking', () => {
  const rows = [
    { id: 'noise-1', boreMm: 50, rating: '150', lengthMm: 100, weight: 3, typeDesc: 'Gate Valve' },
    { id: 'exact-gate', boreMm: 100, rating: '150', lengthMm: 100, weight: 10, typeDesc: 'Gate Valve' },
    { id: 'partial-ball', boreMm: 100.2, rating: 'CL150', lengthMm: 101, weight: 11, typeDesc: 'Ball Valve' },
    { id: 'rejected-gate', boreMm: 100, rating: '150', lengthMm: 140, weight: 15, typeDesc: 'Gate Valve' },
    { id: 'noise-2', boreMm: 100, rating: '300', lengthMm: 100, weight: 30, typeDesc: 'Gate Valve' },
  ];
  const context = { boreMm: 100, rating: '150', lengthMm: 100, nodeName: 'VGT-01', componentType: 'VALV' };
  const config = { weight: { masterRows: rows, valveHintLengthToleranceMm: 6 } };
  const full = rankXmlCiiWeightCandidates(context, config, { includeRejected: true });
  const subset = bruteEligible(rows, context.boreMm, context.rating);
  const brute = rankXmlCiiWeightCandidates(context, { weight: { ...config.weight, masterRows: subset } }, { includeRejected: true });
  assert.deepEqual(signature(full), signature(brute));
});

test('repeated ranking reuses the master eligibility index instead of rescanning 10k master rows', () => {
  let accesses = 0;
  const rows = Array.from({ length: 10000 }, (_, index) => {
    const bore = index * 3;
    return {
      id: `row-${index}`,
      get boreMm() { accesses += 1; return bore; },
      get rating() { accesses += 1; return '150'; },
      lengthMm: 100,
      weight: 10 + index / 100,
      typeDesc: 'Gate Valve',
    };
  });
  const context = { boreMm: 15000, rating: '150', lengthMm: 100, componentType: 'VALV' };
  const config = { weight: { masterRows: rows, valveHintLengthToleranceMm: 6 } };
  rankXmlCiiWeightCandidates(context, config, { includeRejected: true });
  accesses = 0;
  const result = rankXmlCiiWeightCandidates(context, config, { includeRejected: true });
  assert.ok(result.candidates.length > 0);
  assert.ok(accesses < 100, `expected indexed repeat scan below 100 getter reads, received ${accesses}`);
});

test('normal Build Weight Data no longer arms empirical validation; Build report remains explicit authority', () => {
  const report = fs.readFileSync('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js', 'utf8');
  const pendingAssignments = report.match(/__xmlCiiPendingValidation\s*=\s*true/g) || [];
  assert.equal(pendingAssignments.length, 1, 'only explicit Build report may arm empirical validation');
  assert.match(report, /section\.querySelector\('\[data-ewv-build\]'\)\?\.addEventListener\('click',[\s\S]*?__xmlCiiPendingValidation\s*=\s*true[\s\S]*?refresh\.click\(\)/);
  assert.doesNotMatch(report, /card\.addEventListener\('click',[\s\S]{0,300}#mc-wm-refresh/);
});

test('shared Weight Match compute is single-flight and exposes busy state', () => {
  const renderer = fs.readFileSync('tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', 'utf8');
  assert.match(renderer, /const computeCore = async \(opts = \{\}\) => \{/);
  assert.match(renderer, /let activeComputePromise = null;/);
  assert.match(renderer, /if \(activeComputePromise\)[\s\S]*?return activeComputePromise;/);
  assert.match(renderer, /refreshEl\.disabled = true;/);
  assert.match(renderer, /refreshEl\.dataset\.wmBusy = 'true';/);
  assert.match(renderer, /computeCore\(opts\)\.finally\(\(\) => \{/);
  assert.match(renderer, /refreshEl\.disabled = false;/);
});


test('standalone Weight Build delegates basis to the worker without changing the fallback authority path', () => {
  const enrichment = fs.readFileSync('tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js', 'utf8');
  const renderer = fs.readFileSync('tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', 'utf8');
  const adapter = fs.readFileSync('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', 'utf8');
  const start = enrichment.indexOf('export function prepareXmlCiiWeightMatchGeometry');
  const end = enrichment.indexOf('export async function enrichXmlForCii2019', start);
  const fastPath = enrichment.slice(start, end);

  assert.ok(start >= 0 && end > start, 'Weight fast-path export must exist');
  assert.match(fastPath, /annotateInlineElementLengths/);
  assert.match(fastPath, /applyCondenseRigidOption/);
  assert.doesNotMatch(fastPath, /enrichXmlForCii2019Base|buildStagedSupportIndex|loadXmlCiiWeightMasterRows/);
  assert.match(renderer, /typeof prepareWeightBasis === 'function'/);
  assert.match(renderer, /Preparing Weight Match basis in worker/);
  assert.match(renderer, /prepareXmlCiiWeightMatchGeometry/, 'legacy/helper fallback remains available');
  assert.match(adapter, /prepareMasterDatasetWeightBasis/);
  assert.match(adapter, /prepareWeightBasis: async/);
  assert.doesNotMatch(adapter, /loadParentWeightMatchModules/);
  assert.match(adapter, /renderer\.bindXmlCiiWeightMatchPhase/);
});


test('Piping Class index construction is linear in row count and preserves class order', () => {
  const rows = Array.from({ length: 20000 }, (_, index) => ({
    pipingClass: `PC-${index}`,
    convertedBore: 100,
  }));
  const index = buildPipingClassIndex(rows);
  assert.equal(index.rows.length, rows.length);
  assert.equal(index.knownClasses.length, rows.length);
  assert.equal(index.knownClasses[0], 'PC-0');
  assert.equal(index.knownClasses.at(-1), 'PC-19999');

  const source = fs.readFileSync('converters/xml-cii2019-core/piping-class-resolver.js', 'utf8');
  const start = source.indexOf('export function buildPipingClassIndex');
  const end = source.indexOf('\nfunction normalizeComponentType', start);
  const body = source.slice(start, end);
  assert.match(body, /knownClassKeys = new Set/);
  assert.doesNotMatch(body, /knownClasses\.some/);
});

test('Weight basis skips master resolution and rejects known non-review nodes before DTXR lookup', () => {
  const model = fs.readFileSync('converters/xml-cii2019-core/weight-match-model.js', 'utf8');
  const start = model.indexOf('function collectWeightRows');
  const end = model.indexOf('\nexport function collectXmlCiiWeightMatchBasisRows', start);
  const collector = model.slice(start, end);
  assert.match(collector, /lightweightBasis \? null : buildPipingClassIndex/);
  assert.match(collector, /lightweightBasis \? null : buildWeightLineListIndex/);
  assert.match(collector, /isKnownNonWeightReviewType\(componentType\)[\s\S]*?resolveWeightDtxr/);
  assert.match(collector, /dtxrContext \|\|= buildDtxrContext/);
});

test('Weight Line List lookup is indexed once per collection', () => {
  const model = fs.readFileSync('converters/xml-cii2019-core/weight-match-model.js', 'utf8');
  assert.match(model, /function buildWeightLineListIndex/);
  assert.match(model, /const lineListIndex = lightweightBasis \? null : buildWeightLineListIndex\(config\)/);
  const start = model.indexOf('function lineListRowForBranch');
  const end = model.indexOf('\nfunction looksLikeNpsToken', start);
  const lookup = model.slice(start, end);
  assert.match(lookup, /lineListIndex\?\.get\(wanted\)/);
  assert.doesNotMatch(lookup, /for \(const row of rows\)/);
});

test('Weight forward element length scan is linear rather than backward rescanning', () => {
  const model = fs.readFileSync('converters/xml-cii2019-core/weight-match-model.js', 'utf8');
  const start = model.indexOf('export function xmlCiiForwardElementLengths');
  const end = model.indexOf('\nconst OD_TO_DN', start);
  const scan = model.slice(start, end);
  assert.match(scan, /previousPositivePosition/);
  assert.doesNotMatch(scan, /for \(let i = j - 1/);
});

test('modified Weight Build runtime files remain byte-identical to docs mirrors', () => {
  for (const path of [
    'converters/xml-cii2019-core/weight-valve-hints.js',
    'converters/xml-cii2019-core/weight-match-model.js',
    'converters/xml-cii2019-core/piping-class-resolver.js',
    'tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js',
    'tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
    'tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js',
    'tabs/xml-cii-2019-standalone/workers/weight-basis-service.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js',
  ]) {
    assert.equal(fs.readFileSync(path, 'utf8'), fs.readFileSync(`docs/${path}`, 'utf8'), path);
  }
});
