import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_RESULT_EXPORT_VERSION,
  buildHpPipingClassResultExport,
  filterHpPipingClassResultRows,
  parseHpPipingClassResultCsv,
  parseHpPipingClassResultJson,
  serializeHpPipingClassResultCsv,
  serializeHpPipingClassResultJson,
  sortHpPipingClassResultRows,
  verifyHpPipingClassResultRoundTrip,
} from '../tabs/hp-piping-class-result-export.js';

function product({ id, staticPass = true, ratingMargin = 1.2, usage = null, cycleUsage = null, calculationOk = true } = {}) {
  const fatigueEvaluated = usage !== null;
  return {
    productId: id,
    basisMode: 'DIRECT_ENGINEERING_INPUT',
    engineeringState: calculationOk ? staticPass ? 'REVIEW_COMPLETE_NOT_AUTHORIZED' : 'STATIC_REFERENCE_FAIL' : 'CALCULATION_BLOCKED',
    calculationOk,
    selectedFatigueWallBasis: 'END_OF_LIFE_EFFECTIVE',
    selectedFatigueWallMm: 8.80375,
    assessment: {
      staticPass,
      fatigueEvaluated,
      fatigueUsageWithinUnity: fatigueEvaluated ? usage <= 1 : null,
      cumulativeUsage: usage,
    },
    calculations: {
      static: { outputs: {
        pressureDesignThicknessMm: 7.7103934983403475,
        requiredMinimumThicknessMm: 10.710393498340348,
        requiredNominalThicknessMm: 12.240449712388969,
        minimumAsManufacturedThicknessMm: 11.80375,
        effectiveNetWallMm: 8.80375,
        pressureRatingMpa: 20 * ratingMargin,
        pressureRatingMargin: ratingMargin,
        minimumWallMarginMm: 1.0933565016596522,
      } },
      wallState: { outputs: {
        nominalWallMm: 13.49,
        minimumAsManufacturedWallMm: 11.80375,
        beginOfLifeConservativeWallMm: 11.80375,
        reservedServiceLossMm: 3,
        endOfLifeEffectiveWallMm: 8.80375,
      } },
      fatigue: fatigueEvaluated ? { outputs: {
        cumulativeUsage: usage,
        usageLimit: 1,
        usageWithinUnity: usage <= 1,
        evidenceIssueCount: 0,
        independentCheckComplete: false,
        referenceStatus: 'REVIEW_ONLY',
        cycles: [{
          cycleId: `${id}-C1`, locationId: 'BORE', fromStateId: 'LOW', toStateId: 'HIGH',
          appliedCycles: 500, pressureRangeMpa: 18, coreSaltMpa: 63.29949581051363,
          userSaltMpa: 63.29949581051363, saltCrossCheckStatus: 'MATCH', saltRelativeDifference: 0,
          equivalentAlternatingStressMpa: 70, permissibleCycles: 10000, zeroDamage: false,
          usage: cycleUsage ?? usage, evidence: { status: 'ADVISORY_COMPLETE' },
        }],
      } } : { ok: true, state: 'NOT_EVALUATED' },
    },
  };
}

function result() {
  return {
    ok: true,
    orchestratorVersion: 'hp-piping-class-orchestrator/v1',
    projectVersion: 'hp-piping-class-project/v2',
    projectState: 'CALCULATED_NOT_AUTHORIZED',
    projectIdentity: { projectId: 'HP-EXPORT-1', classId: 'CLASS-2500-HP', revision: 'R1' },
    authority: { nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false },
    summary: { totalProducts: 4 },
    products: [
      product({ id: 'P-OK', usage: 0.2, ratingMargin: 1.3 }),
      product({ id: 'P-FAT', usage: 1.2, ratingMargin: 1.4 }),
      product({ id: 'P-STATIC', staticPass: false, ratingMargin: 0.9 }),
      product({ id: 'P-BLOCK', calculationOk: false, staticPass: null, ratingMargin: null }),
    ],
  };
}

test('bundle projects one canonical product row and cycle row contract', () => {
  const bundle = buildHpPipingClassResultExport(result());
  assert.equal(bundle.schemaVersion, HP_PIPING_CLASS_RESULT_EXPORT_VERSION);
  assert.equal(bundle.productRows.length, 4);
  assert.equal(bundle.cycleRows.length, 2);
  const ok = bundle.productRows.find((row) => row.productId === 'P-OK');
  assert.equal(ok.governingCycleId, 'P-OK-C1');
  assert.equal(ok.maximumCycleUsage, 0.2);
  assert.equal(ok.pressureRatingMargin, 1.3);
  assert.equal(bundle.authority.canUseForDesignAuthority, false);
});

test('review-priority sort and filters are deterministic and explicitly non-authority data', () => {
  const rows = buildHpPipingClassResultExport(result()).productRows;
  assert.deepEqual(sortHpPipingClassResultRows(rows).map((row) => row.productId), ['P-BLOCK', 'P-STATIC', 'P-FAT', 'P-OK']);
  assert.deepEqual(filterHpPipingClassResultRows(rows, 'needsAttention').map((row) => row.productId), ['P-FAT', 'P-STATIC', 'P-BLOCK']);
  assert.deepEqual(sortHpPipingClassResultRows(rows, 'cumulativeUsage').slice(0, 2).map((row) => row.productId), ['P-FAT', 'P-OK']);
  assert.deepEqual(sortHpPipingClassResultRows(rows, 'pressureRatingMargin').slice(0, 3).map((row) => row.productId), ['P-STATIC', 'P-OK', 'P-FAT']);
});

test('JSON and CSV exports round-trip through their canonical parsers', () => {
  const bundle = buildHpPipingClassResultExport(result());
  const json = serializeHpPipingClassResultJson(bundle);
  const csv = serializeHpPipingClassResultCsv(bundle);
  assert.deepEqual(parseHpPipingClassResultJson(json), JSON.parse(JSON.stringify(bundle)));
  const csvRows = parseHpPipingClassResultCsv(csv);
  assert.equal(csvRows.length, 4);
  assert(csv.includes('productId'));
  assert(csv.includes('coreSaltMpa'));
  assert(csv.includes('P-FAT-C1'));
  const verified = verifyHpPipingClassResultRoundTrip(bundle);
  assert.deepEqual(verified, {
    ok: true,
    jsonOk: true,
    csvOk: true,
    productRowCount: 4,
    cycleRowCount: 2,
    csvRowCount: 4,
  });
});

test('export fails closed for incomplete results and malformed CSV schema', () => {
  assert.throws(() => buildHpPipingClassResultExport({ ok: false }), /completed HP Piping Class review result/);
  assert.throws(() => parseHpPipingClassResultCsv('bad,header\r\n1,2\r\n'), /header does not match/);
  assert.throws(() => parseHpPipingClassResultJson('{"schemaVersion":"wrong"}'), /Unsupported HP result export schema/);
});
