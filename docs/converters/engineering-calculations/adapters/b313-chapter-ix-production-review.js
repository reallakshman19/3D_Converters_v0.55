import {
  ENGINEERING_CALCULATION_CONTRACT_VERSION,
  createEngineeringCalculationError,
} from '../contracts.js';
import { composeEngineeringQualification } from '../qualification.js';
import { calculateChapterIxStraightPressure } from '../../b313-chapter-ix/straight-pipe.js';
import { calculateChapterIxWallState } from '../../b313-chapter-ix/wall-state.js';
import { evaluateChapterIxUserCalculatedFatigueSpectrum } from '../../b313-chapter-ix/user-calculated-fatigue.js';

export const B313_CHAPTER_IX_PRODUCTION_REVIEW_IDS = Object.freeze({
  straightPressure: 'PIPE.B313.CH9.STRAIGHT_PRESSURE_REVIEW',
  wallState: 'PIPE.B313.CH9.WALL_STATE_REVIEW',
  userFatigue: 'PIPE.B313.CH9.FATIGUE_USER_REVIEW',
});

const REVIEW_REASONS = Object.freeze([
  'PRODUCTION_ENGINEERING_REVIEW_EXECUTION',
  'CALLER_SUPPLIED_ENGINEERING_INPUTS',
  'QUALIFICATION_AND_EVIDENCE_CUSTODY_REMAIN_ADVISORY',
  'NO_CODE_COMPLIANCE_OR_DESIGN_AUTHORITY',
]);

function qualification() {
  return composeEngineeringQualification({
    method: 'IMPLEMENTED',
    data: 'DRAFT',
    designAuthority: false,
    reasons: REVIEW_REASONS,
  });
}

function reviewProvenance(domainApi, extra = {}) {
  return {
    domainApi,
    engineeringAuthority: 'PRODUCTION_ENGINEERING_REVIEW_ONLY',
    codeCompliance: false,
    canUseForDesignAuthority: false,
    ...extra,
  };
}

function domainFailure(result, fallbackMessage, domainApi) {
  return {
    ok: false,
    errors: [createEngineeringCalculationError(
      result.code || 'CALCULATION_FAILED',
      result.message || fallbackMessage,
      { domainDetails: result.details ?? {} },
      result.details?.field ?? null,
    )],
    qualification: qualification(),
    provenance: reviewProvenance(domainApi),
    evidence: { domainResult: result },
  };
}

function advisoryWarning(message) {
  return {
    code: 'PRODUCTION_REVIEW_NOT_DESIGN_AUTHORITY',
    message,
  };
}

function straightPressureOutputs(result) {
  return {
    pressureDesignThicknessMm: result.pressureDesignThicknessMm,
    requiredMinimumThicknessMm: result.requiredMinimumThicknessMm,
    requiredNominalThicknessMm: result.requiredNominalThicknessMm,
    ...(result.minimumAsManufacturedThicknessMm !== undefined ? {
      minimumAsManufacturedThicknessMm: result.minimumAsManufacturedThicknessMm,
      effectiveNetWallMm: result.effectiveNetWallMm,
      pressureRatingMpa: result.pressureRatingMpa,
      pressureRatingMargin: result.pressureRatingMargin,
      minimumWallMarginMm: result.minimumWallMarginMm,
      staticPass: result.staticPass,
    } : {}),
  };
}

function straightPressureChecks(result) {
  if (result.minimumAsManufacturedThicknessMm === undefined) return [];
  return [
    {
      id: 'B313.CH9.REVIEW.MINIMUM_WALL',
      label: 'Minimum manufactured wall vs required minimum wall',
      actual: result.minimumAsManufacturedThicknessMm,
      allowable: result.requiredMinimumThicknessMm,
      comparator: '>=',
      status: result.minimumAsManufacturedThicknessMm >= result.requiredMinimumThicknessMm ? 'PASS' : 'FAIL',
      authority: 'ENGINEERING_REVIEW_ONLY',
    },
    {
      id: 'B313.CH9.REVIEW.PRESSURE_RATING',
      label: 'Calculated pressure rating vs design pressure',
      actual: result.pressureRatingMpa,
      allowable: null,
      comparator: '>= design pressure',
      utilization: 1 / result.pressureRatingMargin,
      status: result.pressureRatingMargin >= 1 ? 'PASS' : 'FAIL',
      authority: 'ENGINEERING_REVIEW_ONLY',
    },
  ];
}

function calculateStraightPressureReview(input) {
  const result = calculateChapterIxStraightPressure({
    outsideDiameterMm: input.outsideDiameter,
    designPressureMpa: input.designPressure,
    allowableStressMpa: input.allowableStress,
    internalAllowanceMm: input.internalAllowance,
    externalAllowanceMm: input.externalAllowance,
    minusTolerancePct: input.minusTolerancePct,
    ...(input.providedNominalThickness !== undefined
      ? { providedNominalThicknessMm: input.providedNominalThickness }
      : {}),
  });
  if (!result.ok) {
    return domainFailure(result, 'Chapter IX straight-pipe engineering review failed.', 'calculateChapterIxStraightPressure');
  }
  const disposition = result.staticPass === undefined
    ? 'CALCULATED_REVIEW'
    : result.staticPass ? 'ENGINEERING_REVIEW_PASS' : 'ENGINEERING_REVIEW_FAIL';
  return {
    ok: true,
    outputs: straightPressureOutputs(result),
    intermediates: {
      toleranceFactor: result.toleranceFactor,
      formulation: result.formulation,
    },
    checks: straightPressureChecks(result),
    assessment: result.staticPass === undefined ? {
      status: disposition,
      outcome: 'NOT_ASSESSED',
      disposition,
      pass: null,
      authority: 'ENGINEERING_REVIEW_ONLY',
    } : {
      status: disposition,
      outcome: result.staticPass ? 'PASS' : 'FAIL',
      disposition,
      pass: result.staticPass,
      authority: 'ENGINEERING_REVIEW_ONLY',
    },
    qualification: qualification(),
    warnings: [advisoryWarning(
      'Calculation is available for production engineering review from explicit inputs. Source qualification, evidence custody, Code compliance, and design authority are separate and are not established by this result.',
    )],
    applicability: {
      applicable: true,
      limitations: [
        'Uniform straight pipe under internal pressure only.',
        'No routed-system, thermal/displacement, KD fatigue, component, FEA, or HCF qualification.',
      ],
    },
    provenance: reviewProvenance('calculateChapterIxStraightPressure', {
      calculationMode: 'PRODUCTION_ENGINEERING_REVIEW',
      formulation: result.formulation,
    }),
    evidence: { domainResult: result },
  };
}

function wallStateOutputs(result) {
  return {
    nominalWallMm: result.nominalWallMm,
    minimumAsManufacturedWallMm: result.minimumAsManufacturedWallMm,
    beginOfLifeConservativeWallMm: result.beginOfLifeConservativeWallMm,
    reservedServiceLossMm: result.reservedServiceLossMm,
    endOfLifeEffectiveWallMm: result.endOfLifeEffectiveWallMm,
    ...(result.measuredCurrentWallMm !== undefined ? {
      measuredCurrentWallMm: result.measuredCurrentWallMm,
      futureServiceLossMm: result.futureServiceLossMm,
      projectedEndOfLifeWallMm: result.projectedEndOfLifeWallMm,
    } : {}),
  };
}

function calculateWallStateReview(input) {
  const result = calculateChapterIxWallState({
    nominalWallMm: input.nominalWall,
    minusTolerancePct: input.minusTolerancePct,
    internalServiceAllowanceMm: input.internalServiceAllowance,
    externalServiceAllowanceMm: input.externalServiceAllowance,
    ...(input.measuredCurrentWall !== undefined ? { measuredCurrentWallMm: input.measuredCurrentWall } : {}),
    ...(input.futureInternalLoss !== undefined ? { futureInternalLossMm: input.futureInternalLoss } : {}),
    ...(input.futureExternalLoss !== undefined ? { futureExternalLossMm: input.futureExternalLoss } : {}),
  });
  if (!result.ok) {
    return domainFailure(result, 'Chapter IX wall-state engineering review failed.', 'calculateChapterIxWallState');
  }
  return {
    ok: true,
    outputs: wallStateOutputs(result),
    intermediates: {
      toleranceFactor: result.toleranceFactor,
      wallStateContract: result.wallStateContract,
    },
    checks: [],
    assessment: {
      status: 'CALCULATED_REVIEW',
      outcome: 'NOT_ASSESSED',
      disposition: 'CALCULATED_REVIEW',
      pass: null,
      authority: 'ENGINEERING_REVIEW_ONLY',
    },
    qualification: qualification(),
    warnings: [advisoryWarning(
      'Wall-state arithmetic is available for production engineering review. Manufacturing/corrosion source custody and design authority remain advisory metadata outside this calculation.',
    )],
    applicability: {
      applicable: true,
      limitations: [
        'Arithmetic wall-state custody only.',
        'No localized corrosion, statistical inspection, erosion model, or remaining-life rate calculation.',
      ],
    },
    provenance: reviewProvenance('calculateChapterIxWallState', {
      calculationMode: 'PRODUCTION_ENGINEERING_REVIEW',
    }),
    evidence: { domainResult: result },
  };
}

function fatigueCycleOutput(row) {
  return {
    cycleId: row.cycleId,
    locationId: row.locationId,
    category: row.category,
    fromStateId: row.fromStateId,
    toStateId: row.toStateId,
    appliedCycles: row.appliedCycles,
    pressureRangeMpa: row.pressureRangeMpa,
    coreSaltMpa: row.coreCycleStress.alternatingStressIntensityMpa,
    userSaltMpa: row.saltCrossCheck.userAlternatingStressIntensityMpa,
    saltCrossCheckStatus: row.saltCrossCheck.status,
    saltRelativeDifference: row.saltCrossCheck.relativeDifference,
    equivalentAlternatingStressMpa: row.equivalentAlternatingStressMpa,
    permissibleCycles: row.permissibleCycles,
    zeroDamage: row.zeroDamage,
    usage: row.usage,
    authorities: row.authorities,
    evidence: row.evidence,
    calculationBasis: row.calculationBasis,
    associatedMeanStressMpa: row.associatedMeanStressMpa,
    beta: row.beta,
    saPrimeMpa: row.saPrimeMpa,
  };
}

function fatigueChecks(result) {
  const rows = result.cycles.map((row) => ({
    id: `B313.CH9.REVIEW.USER_KD3.${row.cycleId}.SALT`,
    label: `${row.cycleId} optional user Salt cross-check`,
    actual: row.saltCrossCheck.userAlternatingStressIntensityMpa,
    allowable: row.saltCrossCheck.coreAlternatingStressIntensityMpa,
    comparator: row.saltCrossCheck.status === 'NOT_PROVIDED' ? 'NOT_PROVIDED' : 'RELATIVE_MATCH',
    status: row.saltCrossCheck.status === 'MISMATCH' ? 'FAIL'
      : row.saltCrossCheck.status === 'MATCH' ? 'PASS' : 'NOT_EVALUATED',
    authority: 'REPOSITORY_QA_CROSSCHECK_ONLY',
  }));
  rows.push({
    id: 'B313.CH9.REVIEW.USER_KD3.CUMULATIVE_USAGE',
    label: 'Cumulative Miner usage for supplied external N',
    actual: result.damage.cumulativeUsage,
    allowable: result.damage.usageLimit,
    comparator: '<=',
    status: result.damage.usageWithinUnity ? 'PASS' : 'FAIL',
    authority: 'CORE_DERIVED_REVIEW_ONLY',
  });
  return rows;
}

function calculateUserFatigueReview(input) {
  const result = evaluateChapterIxUserCalculatedFatigueSpectrum({
    outsideDiameterMm: input.outsideDiameter,
    effectiveWallMm: input.effectiveWall,
    spectrum: input.spectrum,
    states: input.states,
    transitions: input.transitions,
    externalResults: input.externalResults,
    evidencePolicy: 'ADVISORY',
  });
  if (!result.ok) {
    return domainFailure(result, 'USER_CALCULATED_KD3 production engineering review failed.', 'evaluateChapterIxUserCalculatedFatigueSpectrum');
  }
  const cycles = result.cycles.map(fatigueCycleOutput);
  const warnings = [advisoryWarning(
    'Seq and permissible cycles N are user/external inputs. CORE reproduces pressure-cycle Salt and Miner usage for engineering review only; native KD320, Code compliance, and design authority are not established.',
  )];
  if (result.evidenceIssueCount > 0) {
    warnings.push({
      code: 'EXTERNAL_KD3_EVIDENCE_ADVISORY',
      message: `${result.evidenceIssueCount} external KD-3 provenance/checker item(s) are incomplete. Calculation is retained for engineering review; evidence completion is deferred.`,
    });
  }
  const disposition = result.damage.usageWithinUnity
    ? 'ENGINEERING_REVIEW_WITHIN_UNITY'
    : 'ENGINEERING_REVIEW_EXCEEDS_UNITY';
  return {
    ok: true,
    outputs: {
      calculationMode: result.calculationMode,
      calculationState: result.calculationState,
      independentCheckComplete: result.independentCheckComplete,
      evidenceIssueCount: result.evidenceIssueCount,
      cumulativeUsage: result.damage.cumulativeUsage,
      usageLimit: result.damage.usageLimit,
      usageWithinUnity: result.damage.usageWithinUnity,
      referenceStatus: result.referenceStatus,
      cycles,
    },
    intermediates: {
      cycleCount: result.cycles.length,
      formulation: result.formulation,
      transientFormulation: result.transient.formulation,
      damageFormulation: result.damage.formulation,
      evidencePolicy: result.evidencePolicy,
      evidenceIssues: result.evidenceIssues,
    },
    checks: fatigueChecks(result),
    assessment: {
      status: disposition,
      outcome: result.damage.usageWithinUnity ? 'PASS' : 'FAIL',
      disposition,
      pass: result.damage.usageWithinUnity,
      authority: 'EXTERNAL_KD3_ENGINEERING_REVIEW_ONLY',
    },
    qualification: qualification(),
    warnings,
    applicability: {
      applicable: true,
      limitations: [
        'Straight-pipe pressure-cycle Salt reproduction only.',
        'Equivalent alternating stress Seq and permissible cycles N remain user/external inputs.',
        'Repository Salt comparison tolerance is QA-only and is not an ASME acceptance tolerance.',
        'No native KD320 mean-stress correction is executed.',
        'No routed-system, local discontinuity, component FEA, or non-pressure stress-state qualification is established.',
      ],
    },
    provenance: reviewProvenance('evaluateChapterIxUserCalculatedFatigueSpectrum', {
      calculationMode: result.calculationMode,
      calculationState: result.calculationState,
      evidencePolicy: result.evidencePolicy,
      independentCheckComplete: result.independentCheckComplete,
    }),
    evidence: { domainResult: result },
  };
}

export const B313_CHAPTER_IX_STRAIGHT_PRESSURE_REVIEW_ENGINEERING_CALCULATION_DEFINITION = Object.freeze({
  contractVersion: ENGINEERING_CALCULATION_CONTRACT_VERSION,
  id: B313_CHAPTER_IX_PRODUCTION_REVIEW_IDS.straightPressure,
  family: 'PIPE',
  name: 'B31.3 Chapter IX Straight-Pipe Pressure — Engineering Review',
  shortName: 'Ch IX Straight Pressure Review',
  methodRevision: 'production-engineering-review-v1',
  purpose: 'Run the bounded straight-pipe pressure calculation in the production console from explicit engineering inputs while keeping source qualification and design authority advisory/separate.',
  authority: { calculationState: 'IMPLEMENTED', qualificationState: 'IMPLEMENTED', codeCompliance: false },
  applicability: {
    description: 'Production engineering-review execution for uniform straight pipe under internal pressure.',
    limitations: ['No Code/design authority.', 'No fatigue, component, routed-system, or FEA qualification.'],
  },
  ui: { productSurface: 'ENGINEERING_CALCULATIONS', authorityLabel: 'Engineering review' },
  inputs: [
    { key: 'outsideDiameter', label: 'Design outside diameter D', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
    { key: 'designPressure', label: 'Design pressure P', type: 'number', required: true, quantity: 'pressure', canonicalUnit: 'MPa', pressureReference: 'gauge', minExclusive: 0 },
    { key: 'allowableStress', label: 'Allowable stress S', type: 'number', required: true, quantity: 'stress', canonicalUnit: 'MPa', minExclusive: 0 },
    { key: 'internalAllowance', label: 'Internal allowance ci', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', min: 0 },
    { key: 'externalAllowance', label: 'External allowance co', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', min: 0 },
    { key: 'minusTolerancePct', label: 'Minus manufacturing tolerance', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0 },
    { key: 'providedNominalThickness', label: 'Provided nominal wall', type: 'number', quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
  ],
  outputs: [
    { key: 'pressureDesignThicknessMm', label: 'Pressure-design thickness', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
    { key: 'requiredMinimumThicknessMm', label: 'Required minimum thickness', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
    { key: 'requiredNominalThicknessMm', label: 'Required nominal thickness', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
    { key: 'pressureRatingMpa', label: 'Calculated pressure rating', type: 'number', quantity: 'pressure', canonicalUnit: 'MPa' },
    { key: 'staticPass', label: 'Static engineering-review result', type: 'boolean' },
  ],
  calculate: calculateStraightPressureReview,
});

export const B313_CHAPTER_IX_WALL_STATE_REVIEW_ENGINEERING_CALCULATION_DEFINITION = Object.freeze({
  contractVersion: ENGINEERING_CALCULATION_CONTRACT_VERSION,
  id: B313_CHAPTER_IX_PRODUCTION_REVIEW_IDS.wallState,
  family: 'PIPE',
  name: 'B31.3 Chapter IX Wall State — Engineering Review',
  shortName: 'Ch IX Wall State Review',
  methodRevision: 'production-engineering-review-v1',
  purpose: 'Expose explicit nominal/minimum/EOL/projected-EOL wall arithmetic in the production console without using evidence custody as an execution gate.',
  authority: { calculationState: 'IMPLEMENTED', qualificationState: 'IMPLEMENTED', codeCompliance: false },
  applicability: {
    description: 'Production engineering-review wall-state arithmetic from explicit inputs.',
    limitations: ['No Code/design authority.', 'No localized-corrosion or inspection-statistics model.'],
  },
  ui: { productSurface: 'ENGINEERING_CALCULATIONS', authorityLabel: 'Engineering review' },
  inputs: [
    { key: 'nominalWall', label: 'Nominal wall', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
    { key: 'minusTolerancePct', label: 'Minus manufacturing tolerance', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0 },
    { key: 'internalServiceAllowance', label: 'Internal reserved service loss', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', min: 0 },
    { key: 'externalServiceAllowance', label: 'External reserved service loss', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', min: 0 },
    { key: 'measuredCurrentWall', label: 'Measured current wall', type: 'number', quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
    { key: 'futureInternalLoss', label: 'Future internal loss', type: 'number', quantity: 'length', canonicalUnit: 'mm', min: 0 },
    { key: 'futureExternalLoss', label: 'Future external loss', type: 'number', quantity: 'length', canonicalUnit: 'mm', min: 0 },
  ],
  outputs: [
    { key: 'minimumAsManufacturedWallMm', label: 'Minimum as-manufactured wall', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
    { key: 'endOfLifeEffectiveWallMm', label: 'End-of-life effective wall', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
    { key: 'projectedEndOfLifeWallMm', label: 'Projected end-of-life wall', type: 'number', quantity: 'length', canonicalUnit: 'mm' },
  ],
  calculate: calculateWallStateReview,
});

export const B313_CHAPTER_IX_USER_FATIGUE_REVIEW_ENGINEERING_CALCULATION_DEFINITION = Object.freeze({
  contractVersion: ENGINEERING_CALCULATION_CONTRACT_VERSION,
  id: B313_CHAPTER_IX_PRODUCTION_REVIEW_IDS.userFatigue,
  family: 'PIPE',
  name: 'B31.3 Chapter IX Fatigue — User Seq/N Engineering Review',
  shortName: 'Ch IX User Seq/N Review',
  methodRevision: 'production-engineering-review-v1',
  purpose: 'Use externally supplied Seq/N immediately in production engineering review while CORE calculates pressure-cycle Salt and Miner usage; provenance/checker completion is advisory and may be completed later.',
  authority: { calculationState: 'IMPLEMENTED', qualificationState: 'IMPLEMENTED', codeCompliance: false },
  applicability: {
    description: 'Production engineering-review intake for straight-pipe pressure cycles with user/external Seq and N.',
    limitations: ['Native CORE KD320 is not executed.', 'No Code/design authority.', 'External Seq/N remain user/external responsibility.'],
  },
  ui: {
    productSurface: 'ENGINEERING_CALCULATIONS',
    calculationMode: 'USER_CALCULATED_KD3',
    authorityLabel: 'Engineering review · evidence advisory',
  },
  inputs: [
    { key: 'outsideDiameter', label: 'Outside diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
    { key: 'effectiveWall', label: 'Effective wall', type: 'number', required: true, quantity: 'length', canonicalUnit: 'mm', minExclusive: 0 },
    { key: 'spectrum', label: 'Transient spectrum', type: 'object', required: true },
    { key: 'states', label: 'Operating states', type: 'table', required: true },
    { key: 'transitions', label: 'Cycle transitions', type: 'table', required: true },
    { key: 'externalResults', label: 'User/external Seq and N results', type: 'table', required: true },
  ],
  outputs: [
    { key: 'calculationMode', label: 'Calculation mode', type: 'string' },
    { key: 'calculationState', label: 'Calculation state', type: 'string' },
    { key: 'independentCheckComplete', label: 'Independent check complete', type: 'boolean' },
    { key: 'evidenceIssueCount', label: 'Advisory evidence items', type: 'integer' },
    { key: 'cumulativeUsage', label: 'Cumulative Miner usage', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
    { key: 'usageLimit', label: 'Usage limit', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
    { key: 'usageWithinUnity', label: 'Usage within unity', type: 'boolean' },
    { key: 'cycles', label: 'Cycle result table', type: 'table' },
  ],
  calculate: calculateUserFatigueReview,
});

export const B313_CHAPTER_IX_PRODUCTION_REVIEW_ENGINEERING_CALCULATION_DEFINITIONS = Object.freeze([
  B313_CHAPTER_IX_STRAIGHT_PRESSURE_REVIEW_ENGINEERING_CALCULATION_DEFINITION,
  B313_CHAPTER_IX_WALL_STATE_REVIEW_ENGINEERING_CALCULATION_DEFINITION,
  B313_CHAPTER_IX_USER_FATIGUE_REVIEW_ENGINEERING_CALCULATION_DEFINITION,
]);
