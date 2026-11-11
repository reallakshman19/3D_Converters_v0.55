import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHpPipingClassEngineeringReviewReport,
  parseHpPipingClassEngineeringReviewReportJson,
  serializeHpPipingClassEngineeringReviewReportHtml,
  serializeHpPipingClassEngineeringReviewReportJson,
  verifyHpPipingClassEngineeringReviewReportRoundTrip,
} from '../tabs/hp-piping-class-engineering-review-report.js';

function project() {
  return {
    schemaVersion: 'hp-piping-class-project/v2',
    canonicalUnits: { length: 'mm', pressure: 'MPa', stress: 'MPa', temperature: 'degC' },
    metadata: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision: 'A' },
    methodManifest: {
      b313Edition: '2024', viii3Edition: '2025', calculationMode: 'USER_CALCULATED_KD3',
      nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false,
    },
    classBasis: { designPressureMpa: 20, internalAllowanceMm: 3, externalAllowanceMm: 0 },
    products: [{
      productId: 'NPS4-S160', nominalSize: 'NPS 4',
      calculationBasis: {
        mode: 'DIRECT_ENGINEERING_INPUT', outsideDiameterMm: 114.3, allowableStressMpa: 138,
        nominalWallMm: 13.49, minusTolerancePct: 12.5,
      },
      wallState: { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' },
    }],
    transient: {
      spectrum: { spectrumId: 'HP-CS-001-SPECTRUM', designLifeYears: 20, preparedBy: 'ENGINEER_A', checkedBy: 'ENGINEER_B' },
      states: [
        { spectrumId: 'HP-CS-001-SPECTRUM', stateId: 'LOW', pressureMpa: 2, materialTemperatureC: 40, structuralTemperatureC: 40 },
        { spectrumId: 'HP-CS-001-SPECTRUM', stateId: 'HIGH', pressureMpa: 20, materialTemperatureC: 200, structuralTemperatureC: 200 },
      ],
      transitions: [{ spectrumId: 'HP-CS-001-SPECTRUM', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 500, category: 'PROCESS_CYCLE', provenanceId: 'OPS-001' }],
    },
    fatigueEvidence: [{
      productId: 'NPS4-S160',
      externalResults: [{
        cycleId: 'C1', locationId: 'BORE_INNER_SURFACE', fromStateId: 'LOW', toStateId: 'HIGH',
        userAlternatingStressIntensityMpa: 63.29949581051363,
        equivalentAlternatingStressMpa: 70,
        permissibleCycles: 10000,
        calculationBasis: {
          code: 'ASME BPVC VIII-3', edition: '2025', methodRef: 'KD-3 external calculation',
          calculationRef: 'HP-FAT-EXT-001', calculatedBy: 'ENGINEER_A', checkedBy: 'ENGINEER_B', checkedAt: '2026-08-16T04:30:00Z',
        },
      }],
    }],
  };
}

function result({ staticPass = true } = {}) {
  const pressureRatingMpa = staticPass ? 23.086120852009273 : 18.20329217044084;
  const nominalWallMm = staticPass ? 13.49 : 11.5;
  const minimumAsManufacturedWallMm = staticPass ? 11.80375 : 10.0625;
  const effectiveNetWallMm = staticPass ? 8.80375 : 7.0625;
  return {
    ok: true,
    orchestratorVersion: 'hp-piping-class-orchestrator/v1',
    projectVersion: 'hp-piping-class-project/v2',
    projectState: 'CALCULATED_NOT_AUTHORIZED',
    projectIdentity: { projectId: 'HP-PROJ-001', classId: 'HP-CS-001', revision: 'A' },
    calculationIds: {
      basis: 'PIPE.B313.CH9.RESOLVE_BASIS',
      staticDirect: 'PIPE.B313.CH9.STRAIGHT_PRESSURE',
      staticGoverned: 'PIPE.B313.CH9.STRAIGHT_PRESSURE_FROM_BASIS',
      wallState: 'PIPE.B313.CH9.WALL_STATE',
      fatigue: 'PIPE.B313.CH9.FATIGUE_USER_REVIEW',
    },
    authority: {
      calculationMode: 'USER_CALCULATED_KD3', nativeCoreKd3Qualified: false, codeCompliance: false,
      canUseForDesignAuthority: false, engineeringAuthority: 'HP_PIPING_CLASS_REVIEW_ORCHESTRATION_ONLY',
    },
    summary: {
      totalProducts: 1, calculationSucceeded: 1, calculationBlocked: 0,
      staticReferencePassed: staticPass ? 1 : 0, staticReferenceFailed: staticPass ? 0 : 1,
      fatigueEvaluated: 1, fatigueNotSupplied: 0, fatigueWithinUnity: 1, fatigueExceedsUnity: 0,
    },
    warnings: [{ code: 'HP_PIPING_CLASS_REVIEW_ONLY', message: 'Review-only result.' }],
    advisories: [{ code: 'METHOD_IDENTITY_REVIEW', message: 'Method identity is review custody only.' }],
    products: [{
      productId: 'NPS4-S160', basisMode: 'DIRECT_ENGINEERING_INPUT', calculationOk: true,
      engineeringState: staticPass ? 'REVIEW_COMPLETE_NOT_AUTHORIZED' : 'STATIC_REFERENCE_FAIL',
      selectedFatigueWallBasis: 'END_OF_LIFE_EFFECTIVE', selectedFatigueWallMm: effectiveNetWallMm,
      assessment: { staticPass, fatigueEvaluated: true, fatigueUsageWithinUnity: true, cumulativeUsage: 0.05 },
      calculations: {
        static: { ok: true, outputs: {
          pressureDesignThicknessMm: 7.7103934983403475,
          requiredMinimumThicknessMm: 10.710393498340348,
          requiredNominalThicknessMm: 12.240449712388969,
          minimumAsManufacturedThicknessMm: minimumAsManufacturedWallMm,
          effectiveNetWallMm,
          pressureRatingMpa,
          pressureRatingMargin: pressureRatingMpa / 20,
          minimumWallMarginMm: minimumAsManufacturedWallMm - 10.710393498340348,
        } },
        wallState: { ok: true, outputs: {
          nominalWallMm, minimumAsManufacturedWallMm, beginOfLifeConservativeWallMm: minimumAsManufacturedWallMm,
          reservedServiceLossMm: 3, endOfLifeEffectiveWallMm: effectiveNetWallMm,
        } },
        fatigue: { ok: true, outputs: {
          cumulativeUsage: 0.05, usageLimit: 1, evidenceIssueCount: 0, independentCheckComplete: true,
          referenceStatus: 'EXTERNAL_KD3_CALCULATED_CHECKED_NOT_AUTHORIZED', usageWithinUnity: true,
          cycles: [{
            cycleId: 'C1', locationId: 'BORE_INNER_SURFACE', fromStateId: 'LOW', toStateId: 'HIGH',
            appliedCycles: 500, pressureRangeMpa: 18, coreSaltMpa: 63.29949581051363,
            userSaltMpa: 63.29949581051363, saltCrossCheckStatus: 'PASS', saltRelativeDifference: 0,
            equivalentAlternatingStressMpa: 70, permissibleCycles: 10000, zeroDamage: false, usage: 0.05,
            evidence: { status: 'EXTERNAL_KD3_CALCULATED_CHECKED_NOT_AUTHORIZED' },
          }],
        } },
      },
    }],
  };
}

test('review report reproduces NPS4 input basis, canonical review numbers and external KD custody without authority promotion', () => {
  const report = buildHpPipingClassEngineeringReviewReport(project(), result());
  assert.equal(report.schemaVersion, 'hp-piping-class-engineering-review-report/v1');
  assert.equal(report.reportPurpose, 'ENGINEERING_REVIEW_ONLY');
  assert.equal(report.authority.nativeCoreKd3Qualified, false);
  assert.equal(report.authority.codeCompliance, false);
  assert.equal(report.authority.canUseForDesignAuthority, false);
  assert.equal(report.productInputs[0].nominalSize, 'NPS 4');
  assert.equal(report.productInputs[0].calculationBasis.outsideDiameterMm, 114.3);
  assert.equal(report.productInputs[0].calculationBasis.allowableStressMpa, 138);
  assert.equal(report.productInputs[0].calculationBasis.nominalWallMm, 13.49);
  assert.equal(report.productInputs[0].calculationBasis.minusTolerancePct, 12.5);
  assert.equal(report.sourceContracts.calculationIds.staticDirect, 'PIPE.B313.CH9.STRAIGHT_PRESSURE');
  assert.equal(report.sourceContracts.calculationIds.fatigue, 'PIPE.B313.CH9.FATIGUE_USER_REVIEW');
  assert.equal(report.productResults[0].requiredNominalThicknessMm, 12.240449712388969);
  assert.equal(report.productResults[0].pressureRatingMpa, 23.086120852009273);
  assert.equal(report.productResults[0].selectedFatigueWallMm, 8.80375);
  assert.equal(report.productResults[0].cumulativeUsage, 0.05);
  assert.equal(report.cycleResults[0].coreSaltMpa, 63.29949581051363);
  assert.equal(report.cycleResults[0].equivalentAlternatingStressMpa, 70);
  assert.equal(report.cycleResults[0].permissibleCycles, 10000);
  assert.equal(report.externalKdCustody[0].calculationBasis.calculationRef, 'HP-FAT-EXT-001');
  assert.equal(report.externalKdCustody[0].calculationBasis.checkedBy, 'ENGINEER_B');
  assert.equal(report.reviewSummary.resultRoundTrip.ok, true);
});

test('report JSON round trip and embedded standalone HTML preserve the machine-readable report', () => {
  const report = buildHpPipingClassEngineeringReviewReport(project(), result());
  const verified = verifyHpPipingClassEngineeringReviewReportRoundTrip(report);
  assert.equal(verified.ok, true);
  assert.equal(verified.productCount, 1);
  assert.equal(verified.cycleCount, 1);
  assert.equal(verified.custodyRowCount, 1);
  const serialized = serializeHpPipingClassEngineeringReviewReportJson(report);
  assert.deepEqual(parseHpPipingClassEngineeringReviewReportJson(serialized), report);
  const html = serializeHpPipingClassEngineeringReviewReportHtml(report);
  for (const token of ['REVIEW ONLY · NO DESIGN AUTHORITY', '114.30000', '138.00000', '13.49000', '12.24045', '23.08612', '63.299496', '0.050000', 'PIPE.B313.CH9.STRAIGHT_PRESSURE', 'PIPE.B313.CH9.FATIGUE_USER_REVIEW', 'HP-FAT-EXT-001', 'ENGINEER_B']) assert.ok(html.includes(token), `missing HTML token ${token}`);
  const embedded = html.match(/<script type="application\/json" id="hp-engineering-review-report-data">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded), report);
});

test('static reference FAIL remains a reportable engineering result instead of becoming a reporting transaction failure', () => {
  const report = buildHpPipingClassEngineeringReviewReport(project(), result({ staticPass: false }));
  assert.equal(report.reviewSummary.staticReferenceFailed, 1);
  assert.equal(report.productResults[0].staticPass, false);
  assert.equal(report.productResults[0].reviewPriority, 'STATIC_FAIL');
  assert.equal(report.productResults[0].pressureRatingMpa, 18.20329217044084);
  assert.equal(verifyHpPipingClassEngineeringReviewReportRoundTrip(report).ok, true);
});

test('project/result identity mismatch blocks report creation', () => {
  const mismatched = result();
  mismatched.projectIdentity.revision = 'B';
  assert.throws(() => buildHpPipingClassEngineeringReviewReport(project(), mismatched), /revision does not match/);
});

test('project or result authority promotion blocks report creation', () => {
  const promotedProject = project();
  promotedProject.methodManifest.codeCompliance = true;
  assert.throws(() => buildHpPipingClassEngineeringReviewReport(promotedProject, result()), /codeCompliance must remain false/);
  const promotedResult = result();
  promotedResult.authority.canUseForDesignAuthority = true;
  assert.throws(() => buildHpPipingClassEngineeringReviewReport(project(), promotedResult), /canUseForDesignAuthority must remain false/);
});

test('report parser fails closed on authority or schema tampering', () => {
  const report = buildHpPipingClassEngineeringReviewReport(project(), result());
  const wrongSchema = JSON.parse(serializeHpPipingClassEngineeringReviewReportJson(report));
  wrongSchema.schemaVersion = 'other/v1';
  assert.throws(() => parseHpPipingClassEngineeringReviewReportJson(JSON.stringify(wrongSchema)), /Unsupported/);
  const promoted = JSON.parse(serializeHpPipingClassEngineeringReviewReportJson(report));
  promoted.authority.nativeCoreKd3Qualified = true;
  assert.throws(() => parseHpPipingClassEngineeringReviewReportJson(JSON.stringify(promoted)), /nativeCoreKd3Qualified must remain false/);
});
