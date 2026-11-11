import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIV_FACILITY_SCENARIO_EXECUTION_AUTHORITY,
} from '../converters/vibration/aiv/aiv-facility-scenario-plan.js';
import { mechanicalFacilityScopeId } from '../converters/vibration/mechanical/facility.js';
import { sbcFacilityScopeId } from '../converters/vibration/sbc/facility.js';
import { SBC_TYPE3_BLOCKERS } from '../converters/vibration/sbc/type3-user-data.js';
import {
  createVibrationMechanismAssessmentItem,
  createVibrationMechanismAssessmentSet,
} from '../converters/vibration/mechanisms/contracts.js';
import { VIBRATION_MECHANISM_IDS } from '../converters/vibration/mechanisms/registry.js';
import {
  VIBRATION_INTEGRITY_MECHANISMS,
  buildVibrationMechanismAssessment,
  buildVibrationMechanismMatrixRow,
} from '../tabs/vibration-integrity-mechanisms.js';

function row() {
  return {
    line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1',
    standardLof: 0.34, governingReferenceLof: 0.34,
    referenceBand: 'LOF_0_3_TO_LT_0_5', qualificationState: 'SCREENING',
    scenarioSetKey: 'VFSK1:matrix-current',
    scenarioExecutionBasis: {
      datasetId: 'plant-a', scenarioId: 'OS-L100-NORMAL',
      scenarioSnapshotHash: 'sha256:assessment-current', line: 'L-100', caseId: 'NORMAL',
    },
  };
}

function scope(target = row()) {
  return { line: target.line, caseId: target.caseId, canonicalId: target.canonicalId };
}

function identification(mechanismId, assessmentUnitType, target = row()) {
  return {
    mechanismId, scope: scope(target), assessmentUnitType, disposition: 'REQUIRED',
    evidence: { sourceId: `T1-EXPLICIT-${mechanismId}` }, reason: 'Independent facility coverage fixture',
  };
}

function screeningAssessmentSet(mechanismId, childKey, target = row()) {
  const item = createVibrationMechanismAssessmentItem({
    mechanismId, scope: scope(target), childKey,
    implementationState: 'IMPLEMENTED_SCREENING', assessmentState: 'CALCULATED',
    resultState: 'CURRENT_RESULT', readiness: {}, result: { calculated: true },
    qualification: { effective: 'SCREENING' }, evidence: { fixture: true },
  });
  return createVibrationMechanismAssessmentSet({ mechanismId, scope: scope(target), items: [item] });
}

function userRow(scopeId, blockerId, value) {
  return {
    mechanismId: 'smallBoreConnections', blockerId, scopeId, recordKey: 'TYPE3',
    xValue: '', xUnit: '', yValue: '', yUnit: '', value: String(value), unit: '1',
    sourceReference: 'Independent facility test input', notes: '',
  };
}

function sbcRows(targetRow = row()) {
  const scopeId = sbcFacilityScopeId(targetRow);
  return [
    userRow(scopeId, SBC_TYPE3_BLOCKERS.mainlineLof, 1),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.mainlineMultiplier, 1.42),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.firstHasMass, 'TRUE'),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.firstMassGeometryLof, 0.4),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.figureT31, 0.2),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.firstMinimumSpanLof, 0.7),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.firstLocationLof, 1),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.figureT33, 0.6),
    userRow(scopeId, SBC_TYPE3_BLOCKERS.figureT34, 0.2),
  ];
}

function sbcCandidate(targetRow = row(), lof = 0.7) {
  const scopeId = sbcFacilityScopeId(targetRow);
  return Object.freeze({
    ok: true,
    status: 'CALCULATED_MASTER_ASSISTED_CANDIDATE',
    methodId: 'VIB.SBC.T3.TYPE3.MASTER_ASSISTED_CANDIDATE',
    scopeId,
    lof,
    firstSpan: Object.freeze({ c: 0.68, d: 0.2, e: 0.7, locationLof: 1, modifier: 0.7 }),
    subsequentSpans: Object.freeze({ f: 0.6, g: 0.2, modifier: 0.6 }),
    overallModifier: 0.7,
    mainline: Object.freeze({ lof: 1, multiplier: 1.42, adjustedLof: 1.42 }),
    authority: Object.freeze({
      engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED',
      designAuthority: false, masterDataAuthority: false,
    }),
  });
}

function mechanicalScreening(targetRow = row(), lof = 0.4, scopeId = mechanicalFacilityScopeId(targetRow)) {
  return Object.freeze({
    schema: 'MechanicalFacilityScreeningResult.v1', status: 'CALCULATED_SCREENING',
    scope: Object.freeze({
      schema: 'MechanicalFacilityScope.v1', scopeId,
      line: targetRow.line, caseId: targetRow.caseId, canonicalId: targetRow.canonicalId,
    }),
    sourceKeys: Object.freeze(['ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW']),
    governingLof: lof,
    governingSourceKey: 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW',
    rows: Object.freeze([{ sourceKey: 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW', baselineLof: lof }]),
    provenance: Object.freeze({ source: { sectionId: 'T2.3', tableId: 'T2-3', printedPage: 54 } }),
    methodId: 'VIB.MECHANICAL.T2_3.BASELINE', methodRevision: 'ei-aviff2-t2-3-direct-baseline-v1',
    authority: Object.freeze({
      engineeringAuthority: 'SCREENING', screeningAuthority: 'AUTHORIZED',
      authorityScope: 'DIRECT_TABLE_T2_3_BASELINE_ONLY', dynamicReductionAuthorized: false,
      sharedSupportTransferAuthorized: false, designAuthority: false,
    }),
  });
}

function mechanicalContext(targetRow = row(), screening = mechanicalScreening(targetRow)) {
  const scopeId = mechanicalFacilityScopeId(targetRow);
  return {
    mechanicalSourceKeysByScope: { [scopeId]: ['ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW'] },
    mechanicalCandidateResultsByScope: { [scopeId]: screening },
  };
}

function aivScreeningResult(target = row(), lof = 0.42) {
  return {
    ok: true,
    calculationId: 'VIB.AIV.ACOUSTIC',
    outputs: {
      screeningResultScope: 'ASSESSMENT',
      assessmentResults: [{
        schema: 'AivAssessmentResult.v1', resultScope: 'ASSESSMENT',
        calculationId: 'VIB.AIV.ACOUSTIC', status: 'SCREENING_CALCULATED',
        assessmentCanonicalId: target.canonicalId, assessmentType: 'WELDED_DISCONTINUITY',
        line: target.line, caseId: target.caseId,
        contributingSourceCanonicalIds: ['RV-101'], lof,
        authority: {
          calculationState: 'IMPLEMENTED', qualificationState: 'SCREENING',
          engineeringAuthority: 'SCREENING', productionEquationAuthorized: true,
          screeningAuthority: 'AUTHORIZED', designAuthority: false,
        },
      }],
      lineCaseSummaries: [{
        schema: 'AivLineCaseSummary.v1', line: target.line, caseId: target.caseId,
        lof: 0.91, aggregationBasis: 'CONFIGURED_LINE_SCOPE_REFERENCE', authoritativeForScreening: false,
      }],
    },
    assessment: {
      resultScope: 'ASSESSMENT_SCREENING', screeningAuthority: 'AUTHORIZED',
      lineCaseSummaryAuthoritativeForScreening: false, designAuthority: false,
    },
  };
}

function aivScenarioPlan(
  target = row(),
  assessmentSnapshotHash = target.scenarioExecutionBasis.scenarioSnapshotHash,
  facilityScenarioSetKey = target.scenarioSetKey,
) {
  return {
    schema: 'AivFacilityScenarioExecutionPlan.v1',
    datasetId: target.scenarioExecutionBasis.datasetId,
    facilityRunId: 'FIT-RUN-TEST-1',
    facilityScenarioSetKey,
    relationshipExecutions: [{
      rowKey: JSON.stringify(['RV-101', target.canonicalId, target.caseId]),
      sourceCanonicalId: 'RV-101', assessmentCanonicalId: target.canonicalId,
      caseId: target.caseId, sourceLine: 'L-SOURCE', assessmentLine: target.line,
      sourceScenarioExecutionBasis: {
        datasetId: target.scenarioExecutionBasis.datasetId, scenarioId: 'OS-SOURCE-NORMAL',
        scenarioSnapshotHash: 'sha256:source-current', line: 'L-SOURCE', caseId: target.caseId,
      },
      assessmentScenarioExecutionBasis: {
        datasetId: target.scenarioExecutionBasis.datasetId, scenarioId: target.scenarioExecutionBasis.scenarioId,
        scenarioSnapshotHash: assessmentSnapshotHash, line: target.line, caseId: target.caseId,
      },
    }],
    cardinality: 1,
    authority: AIV_FACILITY_SCENARIO_EXECUTION_AUTHORITY,
  };
}

function linkedAivContext(
  target = row(),
  lof = 0.42,
  assessmentSnapshotHash,
  facilityScenarioSetKey,
) {
  return {
    aivScreeningResult: aivScreeningResult(target, lof),
    aivResultState: 'CURRENT_RESULT',
    aivExecutionContext: 'FACILITY_LINKED',
    aivScenarioExecutionPlan: aivScenarioPlan(target, assessmentSnapshotHash, facilityScenarioSetKey),
  };
}

test('catalogue preserves Mechanical screening while integrating AIV at assessment scope only', () => {
  assert.deepEqual(VIBRATION_INTEGRITY_MECHANISMS.map((mechanism) => mechanism.id), VIBRATION_MECHANISM_IDS);
  const fit = VIBRATION_INTEGRITY_MECHANISMS.find((item) => item.id === 'fit');
  const mechanical = VIBRATION_INTEGRITY_MECHANISMS.find((item) => item.id === 'mechanicalExcitation');
  const aiv = VIBRATION_INTEGRITY_MECHANISMS.find((item) => item.id === 'aiv');
  const sbc = VIBRATION_INTEGRITY_MECHANISMS.find((item) => item.id === 'smallBoreConnections');
  assert.equal(fit.implementationState, 'SCREENING');
  assert.equal(mechanical.implementationState, 'SCREENING');
  assert.equal(mechanical.capability.assessmentIntegrationState, 'INTEGRATED');
  assert.equal(aiv.implementationState, 'SCREENING_ASSESSMENT_SCOPE');
  assert.equal(aiv.capability.assessmentIntegrationState, 'INTEGRATED_ASSESSMENT_SCOPE');
  assert.equal(aiv.capability.governingEligibilitySource, 'RUNTIME_ASSESSMENT_ONLY');
  assert.equal(sbc.implementationState, 'CANDIDATE_USER_INPUT');
});

test('FIT and Mechanical remain screening while missing AIV evidence fails closed at assessment scope', () => {
  const target = row();
  const fit = buildVibrationMechanismAssessment(target, 'fit', { resultState: 'CURRENT_RESULT' });
  const mechanical = buildVibrationMechanismAssessment(target, 'mechanicalExcitation');
  const aiv = buildVibrationMechanismAssessment(target, 'aiv', { aivScreeningSession: null });
  const sbc = buildVibrationMechanismAssessment(target, 'smallBoreConnections');
  assert.equal(fit.assessmentState, 'CALCULATED_SCREENING');
  assert.equal(mechanical.implementationState, 'IMPLEMENTED_SCREENING');
  assert.equal(mechanical.assessmentState, 'APPLICABILITY_UNKNOWN');
  assert.equal(aiv.assessmentState, 'NOT_EVALUATED');
  assert.equal(aiv.implementationState, 'IMPLEMENTED_SCREENING');
  assert.equal(aiv.mechanism.implementationState, 'SCREENING_ASSESSMENT_SCOPE');
  assert.equal(aiv.governingEligible, false);
  assert.deepEqual(aiv.contractSet.cardinality, { count: 0, kind: 'ZERO' });
  assert.equal(sbc.implementationState, 'IMPLEMENTED_CANDIDATE_USER_INPUT');
});

test('matrix is INCOMPLETE by default against the full governed mechanism universe', () => {
  const matrix = buildVibrationMechanismMatrixRow(row(), { resultState: 'CURRENT_RESULT', aivScreeningSession: null });
  assert.equal(matrix.assessmentCompleteness.state, 'INCOMPLETE');
  assert.ok(matrix.assessmentCompleteness.reasons.includes('IDENTIFICATION_EVIDENCE_MISSING'));
  assert.deepEqual(matrix.mechanismIdentificationBundle.expectedMechanismIds, VIBRATION_MECHANISM_IDS);
  assert.equal(matrix.fullScreeningGoverningEstablished, false);
});

test('caller-defined partial coverage universe is rejected by production orchestration', () => {
  assert.throws(() => buildVibrationMechanismMatrixRow(row(), {
    coverage: { expectedMechanismIds: ['fit'], identifications: [identification('fit', 'MAIN_LINE_SECTION')] },
  }), /CALLER_DEFINED_COVERAGE_CONFIG_FORBIDDEN/u);
});

test('current exact facility-linked AIV assessment evidence satisfies AIV coverage but cannot govern the line', () => {
  const target = row();
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', ...linkedAivContext(target, 0.42),
    mechanismIdentifications: [identification('aiv', 'AIV_SOURCE_ASSESSMENT_PAIR', target)],
  });
  const aiv = matrix.assessments.find((item) => item.mechanism.id === 'aiv');
  assert.equal(aiv.assessmentState, 'CALCULATED_SCREENING');
  assert.equal(aiv.resultScope, 'ASSESSMENT');
  assert.equal(aiv.lof, 0.42);
  assert.equal(aiv.qualificationState, 'SCREENING');
  assert.equal(aiv.governingEligible, false);
  assert.equal(aiv.contractSet.items[0].result.governingLof, null);
  assert.equal(aiv.evidence.facilityScenarioCustody.status, 'AIV_FACILITY_SCENARIO_CURRENT');
  assert.equal(matrix.mechanismCoverage.required[0].status, 'ASSESSMENT_COMPLETE');
  assert.equal(matrix.screeningGoverning.mechanism.id, 'fit');
  assert.equal(matrix.screeningGoverning.lof, 0.34);
  assert.equal(matrix.fullScreeningGoverningEstablished, false);
});

test('standalone AIV result cannot satisfy facility mechanism coverage', () => {
  const target = row();
  const aiv = buildVibrationMechanismAssessment(target, 'aiv', {
    aivScreeningResult: aivScreeningResult(target), aivResultState: 'CURRENT_RESULT',
  });
  assert.equal(aiv.assessmentState, 'NOT_EVALUATED');
  assert.equal(aiv.calculated, false);
  assert.deepEqual(aiv.readiness.reasons, ['AIV_STANDALONE_NOT_FACILITY_EVIDENCE']);
});

test('stale facility-linked AIV assessment snapshot cannot satisfy current facility coverage', () => {
  const target = row();
  const aiv = buildVibrationMechanismAssessment(target, 'aiv', {
    ...linkedAivContext(target, 0.42, 'sha256:assessment-old'),
  });
  assert.equal(aiv.assessmentState, 'NOT_EVALUATED');
  assert.equal(aiv.resultState, 'STALE_RESULT');
  assert.deepEqual(aiv.readiness.reasons, ['AIV_FACILITY_SCENARIO_STALE']);
});

test('source-line scenario-set drift invalidates AIV even when assessment snapshot is unchanged', () => {
  const target = row();
  const aiv = buildVibrationMechanismAssessment(target, 'aiv', {
    ...linkedAivContext(
      target,
      0.42,
      target.scenarioExecutionBasis.scenarioSnapshotHash,
      'VFSK1:matrix-old-source-state',
    ),
  });
  assert.equal(aiv.assessmentState, 'NOT_EVALUATED');
  assert.equal(aiv.resultState, 'STALE_RESULT');
  assert.deepEqual(aiv.readiness.reasons, ['AIV_FACILITY_SCENARIO_STALE']);
});

test('external qualified AIV coverage evidence remains supported without static AIV line authority', () => {
  const target = row();
  const aivSet = screeningAssessmentSet('aiv', 'source-assessment-pair-1', target);
  const matrix = buildVibrationMechanismMatrixRow(target, {
    aivScreeningSession: null,
    mechanismIdentifications: [identification('aiv', 'AIV_SOURCE_ASSESSMENT_PAIR', target)],
    coverageAssessmentSets: [aivSet],
  });
  const aiv = matrix.assessments.find((item) => item.mechanism.id === 'aiv');
  assert.equal(aiv.assessmentState, 'NOT_EVALUATED');
  assert.equal(aiv.governingEligible, false);
  assert.equal(matrix.mechanismCoverage.required[0].status, 'ASSESSMENT_COMPLETE');
  assert.equal(matrix.fullScreeningGoverningEstablished, false);
});

test('Mechanical screening satisfies its required coverage contract when exact T1 evidence is present', () => {
  const target = row();
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', ...mechanicalContext(target), aivScreeningSession: null,
    mechanismIdentifications: [identification('mechanicalExcitation', 'MAIN_LINE_SECTION', target)],
  });
  assert.equal(matrix.assessmentCompleteness.state, 'INCOMPLETE');
  assert.equal(matrix.mechanismCoverage.required[0].status, 'ASSESSMENT_COMPLETE');
});

test('qualified Mechanical direct baseline participates in screening governing, not candidate governing', () => {
  const target = row();
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', ...mechanicalContext(target), aivScreeningSession: null,
  });
  const mechanical = matrix.assessments.find((item) => item.mechanism.id === 'mechanicalExcitation');
  assert.equal(mechanical.calculated, true);
  assert.equal(mechanical.assessmentState, 'CALCULATED_SCREENING');
  assert.equal(mechanical.lof, 0.4);
  assert.equal(mechanical.qualificationState, 'SCREENING');
  assert.equal(mechanical.contractSet.items[0].qualification.screeningAuthority, 'AUTHORIZED');
  assert.equal(matrix.screeningGoverning.mechanism.id, 'mechanicalExcitation');
  assert.equal(matrix.screeningGoverning.lof, 0.4);
  assert.equal(matrix.candidateGoverning, null);
});

test('AIV assessment cannot replace a higher qualified Mechanical screening result', () => {
  const target = row();
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', ...mechanicalContext(target), ...linkedAivContext(target, 0.95),
  });
  const aiv = matrix.assessments.find((item) => item.mechanism.id === 'aiv');
  assert.equal(aiv.lof, 0.95);
  assert.equal(aiv.governingEligible, false);
  assert.equal(matrix.screeningGoverning.mechanism.id, 'mechanicalExcitation');
  assert.equal(matrix.screeningGoverning.lof, 0.4);
});

test('precomputed SBC candidate can govern candidate tier but cannot replace Mechanical screening', () => {
  const target = row();
  const scopeId = sbcFacilityScopeId(target);
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT',
    sbcCandidateResultsByScope: { [scopeId]: sbcCandidate(target) },
    ...mechanicalContext(target), aivScreeningSession: null,
  });
  assert.equal(matrix.screeningGoverning.mechanism.id, 'mechanicalExcitation');
  assert.equal(matrix.screeningGoverning.lof, 0.4);
  assert.equal(matrix.candidateGoverning.mechanism.id, 'smallBoreConnections');
  assert.equal(matrix.candidateGoverning.lof, 0.7);
  assert.equal(matrix.fullScreeningGoverningEstablished, false);
});

test('wrong-scope Mechanical cache fails closed and cannot create screening governing', () => {
  const target = row();
  const scopeId = mechanicalFacilityScopeId(target);
  const wrong = mechanicalScreening(target, 0.9, 'MECHANICAL-FACILITY/OTHER/NORMAL/CAN-9');
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', aivScreeningSession: null,
    mechanicalSourceKeysByScope: { [scopeId]: ['ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW'] },
    mechanicalCandidateResultsByScope: { [scopeId]: wrong },
  });
  const mechanical = matrix.assessments.find((item) => item.mechanism.id === 'mechanicalExcitation');
  assert.equal(mechanical.calculated, false);
  assert.equal(mechanical.assessmentState, 'APPLICABLE_INCOMPLETE');
  assert.deepEqual(mechanical.readiness.invalid, ['FACILITY_SCOPE_MISMATCH']);
  assert.equal(matrix.candidateGoverning, null);
  assert.equal(matrix.screeningGoverning.mechanism.id, 'fit');
});

test('stale facility state excludes current FIT/Mechanical governing while retaining Mechanical screening evidence', () => {
  const target = row();
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'STALE_RESULT', ...mechanicalContext(target), aivScreeningSession: null,
  });
  assert.equal(matrix.screeningGoverning, null);
  assert.equal(matrix.candidateGoverning, null);
  assert.equal(matrix.implementedGoverning, null);
  assert.equal(matrix.retainedScreeningGoverning.mechanism.id, 'mechanicalExcitation');
  assert.equal(matrix.retainedScreeningGoverning.lof, 0.4);
  assert.equal(matrix.retainedScreeningGoverning.resultState, 'STALE_RESULT');
  assert.equal(matrix.retainedCandidateGoverning, null);
});

test('raw SBC rows remain projection-only and require explicit evaluation before a candidate can govern', () => {
  const target = row();
  const rows = sbcRows(target).filter((item) => item.blockerId !== SBC_TYPE3_BLOCKERS.figureT34);
  const matrix = buildVibrationMechanismMatrixRow(target, {
    resultState: 'CURRENT_RESULT', userEngineeringDataRows: rows, aivScreeningSession: null,
  });
  const sbc = matrix.assessments.find((item) => item.mechanism.id === 'smallBoreConnections');
  assert.equal(sbc.calculated, false);
  assert.equal(sbc.assessmentState, 'APPLICABLE_INCOMPLETE');
  assert.deepEqual(sbc.readiness.missing, []);
  assert.ok(sbc.readiness.reasons.includes('SBC_TYPE3_EXPLICIT_EVALUATION_REQUIRED'));
  assert.equal(sbc.evidence.projectionOnly, true);
  assert.equal(matrix.candidateGoverning, null);
  assert.equal(matrix.screeningGoverning.mechanism.id, 'fit');
});

test('unknown mechanisms fail closed', () => {
  assert.throws(() => buildVibrationMechanismAssessment(row(), 'not-a-mechanism'), /Unknown vibration mechanism/u);
});