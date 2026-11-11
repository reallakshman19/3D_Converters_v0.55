import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderHpPipingClassProductionReadinessHtml,
  renderHpPipingClassProductionResultHtml,
  summarizeHpPipingClassProductionReadiness,
} from '../tabs/hp-piping-class-production-review-view.js';

function productResult() {
  return {
    productId: 'NPS4-S160',
    basisMode: 'DIRECT_ENGINEERING_INPUT',
    calculationOk: true,
    engineeringState: 'REVIEW_COMPLETE_NOT_AUTHORIZED',
    selectedFatigueWallBasis: 'END_OF_LIFE_EFFECTIVE',
    selectedFatigueWallMm: 8.80375,
    assessment: {
      staticPass: true,
      fatigueEvaluated: true,
      fatigueUsageWithinUnity: true,
      cumulativeUsage: 0.05,
    },
    calculations: {
      static: {
        outputs: {
          pressureDesignThicknessMm: 7.7103934983403475,
          requiredMinimumThicknessMm: 10.710393498340348,
          requiredNominalThicknessMm: 12.240449712388969,
          minimumAsManufacturedThicknessMm: 11.80375,
          effectiveNetWallMm: 8.80375,
          pressureRatingMpa: 23.086120852009273,
          pressureRatingMargin: 1.1543060426004637,
          minimumWallMarginMm: 1.0933565016596522,
        },
        warnings: [{ code: 'PRODUCTION_REVIEW_NOT_DESIGN_AUTHORITY', message: 'Static review only.' }],
      },
      wallState: {
        outputs: {
          nominalWallMm: 13.49,
          minimumAsManufacturedWallMm: 11.80375,
          beginOfLifeConservativeWallMm: 11.80375,
          reservedServiceLossMm: 3,
          endOfLifeEffectiveWallMm: 8.80375,
        },
      },
      fatigue: {
        outputs: {
          evidenceIssueCount: 1,
          cumulativeUsage: 0.05,
          usageLimit: 1,
          usageWithinUnity: true,
          cycles: [{
            cycleId: 'C1',
            locationId: 'BORE_INNER_SURFACE',
            fromStateId: 'LOW',
            toStateId: 'HIGH',
            appliedCycles: 500,
            pressureRangeMpa: 18,
            coreSaltMpa: 63.29949581051363,
            userSaltMpa: 63.29949581051363,
            saltCrossCheckStatus: 'MATCH',
            equivalentAlternatingStressMpa: 70,
            permissibleCycles: 10000,
            zeroDamage: false,
            usage: 0.05,
          }],
        },
        warnings: [{ code: 'EXTERNAL_KD3_EVIDENCE_ADVISORY', message: 'Evidence completion deferred.' }],
      },
    },
  };
}

function result() {
  return {
    ok: true,
    orchestratorVersion: 'hp-piping-class-orchestrator/v1',
    projectVersion: 'hp-piping-class-project/v2',
    projectState: 'CALCULATED_NOT_AUTHORIZED',
    projectIdentity: { projectId: 'HP-1', classId: 'CLASS-2500-HP', revision: 'R1' },
    authority: { nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false },
    summary: { totalProducts: 1 },
    warnings: [],
    advisories: [],
    products: [productResult()],
  };
}

test('production readiness separates blockers from advisory method identity', () => {
  const advisoryOnly = {
    ok: true,
    validationPolicy: 'PRODUCTION_REVIEW',
    issues: [],
    advisories: [{ path: 'methodManifest.b313Edition', code: 'METHOD_IDENTITY_REQUIRED', message: 'B31.3 edition is required.' }],
  };
  const summary = summarizeHpPipingClassProductionReadiness(advisoryOnly);
  assert.equal(summary.readyToCalculate, true);
  assert.equal(summary.blockingIssues.length, 0);
  assert.equal(summary.advisories.length, 1);
  const html = renderHpPipingClassProductionReadinessHtml(advisoryOnly);
  assert.match(html, /Calculation available/);
  assert.match(html, /METHOD_IDENTITY_REQUIRED/);
  assert.match(html, /do not block/);
  assert.doesNotMatch(html, /calculation blocker\(s\)/);
});

test('production readiness keeps structural invalidity visually blocking', () => {
  const html = renderHpPipingClassProductionReadinessHtml({
    ok: false,
    validationPolicy: 'PRODUCTION_REVIEW',
    issues: [{ path: 'classBasis.designPressureMpa', code: 'CLASS_BASIS_INVALID', message: 'Design pressure must be > 0 MPa.' }],
    advisories: [],
  });
  assert.match(html, /1 calculation blocker/);
  assert.match(html, /CLASS_BASIS_INVALID/);
  assert.match(html, /hpwb-notice error/);
});

test('production result ledger exposes class matrix plus static, wall and fatigue numerical chain', () => {
  const html = renderHpPipingClassProductionResultHtml(result());
  for (const token of [
    'Production engineering-review ledger',
    'Class-wide result matrix',
    'Export results CSV',
    'Export results JSON',
    'Verify round trip',
    'Highest review priority',
    'NPS4-S160',
    '1.154306',
    '0.050000',
    'Pressure-design thickness',
    '7.71039 mm',
    'Calculated pressure rating',
    '23.08612 MPa',
    'End-of-life effective wall',
    '8.80375 mm',
    'Pressure-cycle fatigue ledger',
    '63.299496',
    '70.000000',
    '10,000',
  ]) assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /REVIEW ONLY · NO DESIGN AUTHORITY/);
  assert.match(html, /reporting aid only/);
});

test('matrix honors filter/sort state and displays round-trip result', () => {
  const html = renderHpPipingClassProductionResultHtml(result(), {
    filter: 'fatigueEvaluated',
    sortBy: 'cumulativeUsage',
    roundTrip: { ok: true, jsonOk: true, csvOk: true, productRowCount: 1, cycleRowCount: 1 },
  });
  assert.match(html, /value="fatigueEvaluated" selected/);
  assert.match(html, /value="cumulativeUsage" selected/);
  assert.match(html, /Round trip PASS/);
  assert.match(html, /JSON PASS · CSV PASS/);
});

test('calculation warnings are shown as advisory and never promote authority', () => {
  const withWarnings = result();
  withWarnings.warnings = [{ code: 'PROJECT_REVIEW_WARNING', message: 'Project warning.' }];
  const html = renderHpPipingClassProductionResultHtml(withWarnings);
  assert.match(html, /PROJECT_REVIEW_WARNING/);
  assert.match(html, /PRODUCTION_REVIEW_NOT_DESIGN_AUTHORITY/);
  assert.match(html, /EXTERNAL_KD3_EVIDENCE_ADVISORY/);
  assert.doesNotMatch(html, /DESIGN AUTHORITY · TRUE/);
});

test('blocked evaluator does not render a misleading numerical ledger or export matrix', () => {
  const html = renderHpPipingClassProductionResultHtml({ ok: false, projectState: 'CALCULATION_BLOCKED', products: [] });
  assert.match(html, /CALCULATION_BLOCKED/);
  assert.match(html, /No production result ledger/);
  assert.doesNotMatch(html, /Static pressure ledger/);
  assert.doesNotMatch(html, /Export results CSV/);
});
