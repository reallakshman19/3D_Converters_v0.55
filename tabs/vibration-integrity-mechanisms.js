import { inspectAivFacilityScenarioPlanForAssessment } from '../converters/vibration/aiv/aiv-facility-scenario-plan.js';
import { mechanicalFacilityScopeId } from '../converters/vibration/mechanical/facility.js';
import { sbcFacilityScopeId } from '../converters/vibration/sbc/facility.js?v=20260815-sbc-pf05-cache-1';
import { evaluateEiMainLineAggregation } from '../converters/vibration/ei-mainline-aggregation.js';
import { resolveVibrationMechanismCapability } from '../converters/vibration/mechanisms/capability.js';
import { evaluateVibrationCoverageAndCompleteness } from '../converters/vibration/mechanisms/coverage.js';
import { createVibrationMechanismIdentificationBundle } from '../converters/vibration/mechanisms/identification-producer.js';
import {
  buildAivVibrationMechanismAssessmentSet,
  buildFitVibrationMechanismAssessmentSet,
  buildMechanicalVibrationMechanismAssessmentSet,
  buildSbcVibrationMechanismAssessmentSet,
  createVibrationMechanismAssessmentSet,
} from '../converters/vibration/mechanisms/index.js?v=20260818-aiv-integrity-1';
import { getCurrentAivScreeningSession } from './vibration-aiv-screening-session.js';

const VIBRATION_INTEGRITY_MECHANISM_CATALOGUE = [
  { id: 'fit', label: 'FIT', title: 'Flow-induced turbulence', sourceSection: 'EI AVIFF T2.2' },
  { id: 'mechanicalExcitation', label: 'Mechanical', title: 'Mechanical excitation', sourceSection: 'EI AVIFF T2.3' },
  { id: 'reciprocatingPulsation', label: 'Recip / PD', title: 'Pulsation from reciprocating / positive-displacement items', sourceSection: 'EI AVIFF T2.4' },
  { id: 'rotatingStall', label: 'Rotating stall', title: 'Pulsation from rotating stall', sourceSection: 'EI AVIFF T2.5' },
  { id: 'deadlegPulsation', label: 'Deadlegs', title: 'Flow-induced pulsation from deadlegs', sourceSection: 'EI AVIFF worked-example section' },
  { id: 'corrugationPulsation', label: 'Corrugations', title: 'Pulsation from corrugated pipes', sourceSection: 'EI Subsea AVIFF E4.3' },
  { id: 'slugFlow', label: 'Slug', title: 'Slug flow', sourceSection: 'EI AVIFF specialist assessment' },
  {
    id: 'aiv', label: 'AIV assess.',
    title: 'High-frequency acoustic-induced vibration · assessment-scope screening; line governing not qualified',
    sourceSection: 'EI AVIFF T2.7',
  },
  { id: 'valveTransients', label: 'Transients', title: 'Valve transients', sourceSection: 'EI AVIFF T2.8' },
  { id: 'cavitationFlashing', label: 'Cav / flash', title: 'Cavitation and flashing', sourceSection: 'EI AVIFF T2.9' },
  { id: 'thermowells', label: 'Thermowells', title: 'Thermowells', sourceSection: 'ASME PTC 19.3 TW-2016' },
  { id: 'smallBoreConnections', label: 'SBC', title: 'Small-bore connections', sourceSection: 'EI AVIFF T3' },
];

function catalogueMechanism(definition) {
  const capability = resolveVibrationMechanismCapability(definition.id);
  return Object.freeze({ ...definition, implementationState: capability.integrityImplementationState, capability });
}

export const VIBRATION_INTEGRITY_MECHANISMS = Object.freeze(
  VIBRATION_INTEGRITY_MECHANISM_CATALOGUE.map(catalogueMechanism),
);
const MECHANISM_BY_ID = new Map(VIBRATION_INTEGRITY_MECHANISMS.map((mechanism) => [mechanism.id, mechanism]));

function rowScope(row = {}) {
  return { line: row.line, caseId: row.caseId ?? null, canonicalId: row.canonicalId };
}

function contractAssessment(mechanism, contractSet) {
  const item = contractSet.items[0];
  return Object.freeze({
    mechanism, contractSet, itemId: item.itemId, assessmentState: item.assessmentState,
    calculated: Boolean(item.result?.calculated), lof: item.result?.governingLof ?? null,
    referenceBand: item.result?.referenceBand ?? null,
    qualificationState: item.qualification?.effective ?? null,
    implementationState: item.implementationState, resultState: item.resultState,
    facilityScopeId: item.applicability?.facilityScopeId ?? item.request?.facilityScopeId ?? null,
    readiness: item.readiness,
  });
}

function fitAssessment(row, mechanism, context) {
  const contractSet = buildFitVibrationMechanismAssessmentSet({
    row, fitDetail: context.fitDetail ?? null, resultState: context.resultState ?? null,
    benchmark: context.benchmark ?? null, workingCells: context.workingCells ?? null,
  });
  const assessment = contractAssessment(mechanism, contractSet);
  if (assessment.assessmentState !== 'CALCULATED') return assessment;
  return Object.freeze({ ...assessment, assessmentState: 'CALCULATED_SCREENING' });
}

function mechanicalAssessment(row, mechanism, context) {
  const scopeId = mechanicalFacilityScopeId(row);
  const sourceKeys = context.mechanicalSourceKeysByScope?.[scopeId] ?? [];
  const notApplicable = context.mechanicalNotApplicableByScope?.[scopeId] === true;
  const cachedCandidate = context.mechanicalCandidateResultsByScope?.[scopeId] ?? null;
  const inheritedCurrency = context.resultState === 'STALE_RESULT' ? 'STALE_RESULT' : null;
  const contractSet = buildMechanicalVibrationMechanismAssessmentSet({
    row, sourceKeys, notApplicable, cachedCandidate,
    resultState: context.mechanicalResultState ?? inheritedCurrency,
  });
  const assessment = contractAssessment(mechanism, contractSet);
  if (assessment.assessmentState !== 'CALCULATED') return assessment;
  return Object.freeze({ ...assessment, assessmentState: 'CALCULATED_SCREENING' });
}

function aivSessionContext(context) {
  const hasExplicitSession = Object.prototype.hasOwnProperty.call(context, 'aivScreeningSession');
  const session = hasExplicitSession ? context.aivScreeningSession : getCurrentAivScreeningSession();
  return {
    screeningResult: context.aivScreeningResult ?? session?.screeningResult ?? null,
    resultState: context.aivResultState ?? session?.resultState ?? 'UNRUN',
    executionContext: context.aivExecutionContext ?? session?.executionContext ?? null,
    scenarioExecutionPlan: context.aivScenarioExecutionPlan ?? session?.scenarioExecutionPlan ?? null,
  };
}

function emptyAivAssessment(row, mechanism, reason, resultState = 'UNRUN') {
  const contractSet = createVibrationMechanismAssessmentSet({
    mechanismId: 'aiv', scope: rowScope(row), items: [],
  });
  return Object.freeze({
    mechanism, contractSet, itemId: null, assessmentState: 'NOT_EVALUATED', calculated: false,
    lof: null, referenceBand: null, qualificationState: null,
    implementationState: 'IMPLEMENTED_SCREENING', resultState,
    resultScope: 'ASSESSMENT', governingEligible: false, facilityScopeId: null,
    readiness: Object.freeze({ missing: [], invalid: [], reasons: [reason] }),
  });
}

function aivAssessment(row, mechanism, context) {
  const sessionContext = aivSessionContext(context);
  if (!sessionContext.screeningResult) {
    return emptyAivAssessment(row, mechanism, 'AIV_CURRENT_ASSESSMENT_RESULT_NOT_AVAILABLE');
  }
  if (sessionContext.executionContext !== 'FACILITY_LINKED' || !sessionContext.scenarioExecutionPlan) {
    return emptyAivAssessment(row, mechanism, 'AIV_STANDALONE_NOT_FACILITY_EVIDENCE');
  }
  const scenarioCustody = inspectAivFacilityScenarioPlanForAssessment(
    sessionContext.scenarioExecutionPlan,
    row,
  );
  if (!scenarioCustody.ok) {
    return emptyAivAssessment(
      row,
      mechanism,
      scenarioCustody.status,
      scenarioCustody.status === 'AIV_FACILITY_SCENARIO_STALE' ? 'STALE_RESULT' : 'UNRUN',
    );
  }
  const contractSet = buildAivVibrationMechanismAssessmentSet({
    row, screeningResult: sessionContext.screeningResult, resultState: sessionContext.resultState,
  });
  if (contractSet.cardinality.count === 0) {
    return emptyAivAssessment(row, mechanism, 'AIV_CURRENT_ASSESSMENT_RESULT_NOT_AVAILABLE');
  }
  const item = contractSet.items[0];
  return Object.freeze({
    mechanism, contractSet, itemId: item.itemId, assessmentState: 'CALCULATED_SCREENING',
    calculated: true, lof: item.result.assessmentLof, referenceBand: null,
    qualificationState: item.qualification?.effective ?? null,
    implementationState: item.implementationState, resultState: item.resultState,
    resultScope: 'ASSESSMENT', governingEligible: false, facilityScopeId: null,
    readiness: item.readiness,
    evidence: Object.freeze({ ...item.evidence, facilityScenarioCustody: scenarioCustody }),
  });
}

function sbcAssessment(row, mechanism, context) {
  const scopeId = sbcFacilityScopeId(row);
  const precomputedCandidate = context.sbcCandidateResultsByScope?.[scopeId] ?? null;
  const inheritedCurrency = context.resultState === 'STALE_RESULT' ? 'STALE_RESULT' : null;
  const contractSet = buildSbcVibrationMechanismAssessmentSet({
    row, userRows: context.userEngineeringDataRows ?? [], governed: context.sbcGoverned ?? {},
    precomputedCandidate, resultState: context.sbcResultState ?? inheritedCurrency,
  });
  const assessment = contractAssessment(mechanism, contractSet);
  if (assessment.assessmentState !== 'CALCULATED') return assessment;
  return Object.freeze({ ...assessment, assessmentState: 'CALCULATED_CANDIDATE' });
}

function unavailableAssessment(row, mechanism) {
  const contractSet = createVibrationMechanismAssessmentSet({ mechanismId: mechanism.id, scope: rowScope(row), items: [] });
  return Object.freeze({
    mechanism, contractSet, itemId: null, assessmentState: 'NOT_IMPLEMENTED', calculated: false,
    lof: null, referenceBand: null, qualificationState: null, implementationState: 'NOT_IMPLEMENTED',
    resultState: 'UNRUN', facilityScopeId: null,
    readiness: Object.freeze({ missing: [], invalid: [], reasons: [] }),
  });
}

export function buildVibrationMechanismAssessment(row, mechanismId, context = {}) {
  const mechanism = MECHANISM_BY_ID.get(mechanismId);
  if (!mechanism) throw new Error(`Unknown vibration mechanism: ${mechanismId}`);
  if (mechanism.id === 'fit') return fitAssessment(row, mechanism, context);
  if (mechanism.id === 'mechanicalExcitation') return mechanicalAssessment(row, mechanism, context);
  if (mechanism.id === 'aiv') return aivAssessment(row, mechanism, context);
  if (mechanism.id === 'smallBoreConnections') return sbcAssessment(row, mechanism, context);
  return unavailableAssessment(row, mechanism);
}

function isScreeningAssessment(assessment) {
  return assessment.implementationState === 'IMPLEMENTED_SCREENING'
    && assessment.qualificationState === 'SCREENING'
    && assessment.governingEligible !== false;
}

function isCandidateAssessment(assessment) {
  return assessment.implementationState === 'IMPLEMENTED_CANDIDATE_USER_INPUT'
    || assessment.implementationState === 'IMPLEMENTED_CANDIDATE_MASTER'
    || assessment.qualificationState === 'CANDIDATE_USER_INPUT'
    || assessment.qualificationState === 'CANDIDATE_MASTER';
}

function governingAssessment(assessments, { currentOnly, accept }) {
  const candidates = assessments.filter((assessment) => (
    accept(assessment) && assessment.calculated && Number.isFinite(Number(assessment.lof))
      && (!currentOnly || assessment.resultState === 'CURRENT_RESULT')
  ));
  if (!candidates.length) return null;
  return candidates.reduce((governing, item) => (
    Number(item.lof) > Number(governing.lof) ? item : governing
  ));
}

function coverageAssessmentSets(assessments, bundle, supplementalSets = []) {
  if (!Array.isArray(supplementalSets)) throw new TypeError('coverageAssessmentSets must be an array when provided.');
  const expectedSet = new Set(bundle.expectedMechanismIds);
  const matrixSets = assessments.map((assessment) => assessment.contractSet)
    .filter((set) => set.cardinality.count > 0 && expectedSet.has(set.mechanismId));
  return [...matrixSets, ...supplementalSets];
}

function facilityCoverage(assessments, context) {
  if (context.coverage != null) throw new Error('CALLER_DEFINED_COVERAGE_CONFIG_FORBIDDEN');
  const identificationBundle = createVibrationMechanismIdentificationBundle({
    identifications: context.mechanismIdentifications ?? [],
  });
  const assessmentSets = coverageAssessmentSets(
    assessments, identificationBundle, context.coverageAssessmentSets ?? [],
  );
  const result = evaluateVibrationCoverageAndCompleteness({
    identifications: identificationBundle.identifications,
    knownMechanismIds: identificationBundle.expectedMechanismIds,
    assessmentSets,
  });
  return { identificationBundle, assessmentSets, ...result };
}

function identificationScopeMatchesRow(record, row) {
  return record?.scope?.line === row.line
    && (record?.scope?.caseId ?? null) === (row.caseId ?? null)
    && record?.scope?.canonicalId === row.canonicalId;
}

function scopedIdentificationsForRow(row, values) {
  if (!Array.isArray(values)) throw new TypeError('mechanismIdentifications must be an array when provided.');
  const mismatch = values.find((record) => !identificationScopeMatchesRow(record, row));
  if (mismatch) throw new Error(`MECHANISM_IDENTIFICATION_SCOPE_MISMATCH:${mismatch.mechanismId ?? 'UNKNOWN'}`);
  return values;
}

function coverageContextForRow(row, context) {
  if (context.mechanismIdentifications != null) {
    return { ...context, mechanismIdentifications: scopedIdentificationsForRow(row, context.mechanismIdentifications) };
  }
  if (row?.mechanismIdentifications == null) return context;
  return { ...context, mechanismIdentifications: scopedIdentificationsForRow(row, row.mechanismIdentifications) };
}

export function buildVibrationMechanismMatrixRow(row, context = {}) {
  const assessments = VIBRATION_INTEGRITY_MECHANISMS.map((mechanism) => (
    buildVibrationMechanismAssessment(row, mechanism.id, context)
  ));
  const screeningGoverning = governingAssessment(assessments, { currentOnly: true, accept: isScreeningAssessment });
  const candidateGoverning = governingAssessment(assessments, { currentOnly: true, accept: isCandidateAssessment });
  const retainedScreeningGoverning = governingAssessment(assessments, { currentOnly: false, accept: isScreeningAssessment });
  const retainedCandidateGoverning = governingAssessment(assessments, { currentOnly: false, accept: isCandidateAssessment });
  const coverageState = facilityCoverage(assessments, coverageContextForRow(row, context));
  const eiMainLineAggregation = evaluateEiMainLineAggregation({
    scope: rowScope(row), identifications: coverageState.identificationBundle.identifications,
    assessmentSets: coverageState.assessmentSets,
  });
  return Object.freeze({
    row, assessments: Object.freeze(assessments), screeningGoverning, candidateGoverning,
    retainedScreeningGoverning, retainedCandidateGoverning,
    implementedGoverning: screeningGoverning, retainedImplementedGoverning: retainedScreeningGoverning,
    mechanismIdentificationBundle: coverageState.identificationBundle,
    requiredAssessmentSet: coverageState.requiredAssessmentSet,
    mechanismCoverage: coverageState.coverage, assessmentCompleteness: coverageState.completeness,
    eiMainLineAggregation, fullScreeningGoverningEstablished: false,
  });
}
