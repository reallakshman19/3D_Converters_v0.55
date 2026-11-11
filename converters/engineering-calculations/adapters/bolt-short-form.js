import { ENGINEERING_CALCULATION_CONTRACT_VERSION } from '../contracts.js';
import { composeEngineeringQualification } from '../qualification.js';
import { calculateShortFormBoltAssembly } from '../bolts/short-form.js';

export const BOLT_SHORT_FORM_ENGINEERING_CALCULATION_ID = 'BOLT.PRELOAD_TORQUE.SHORT_FORM';

const AUTHORITY = Object.freeze({
  calculationState: 'IMPLEMENTED',
  qualificationState: 'IMPLEMENTED',
  codeCompliance: false,
});

const APPLICABILITY = Object.freeze({
  description: 'Reference preload and short-form nut-factor torque calculation with explicit caller inputs.',
  limitations: Object.freeze([
    'Preload fraction and nut factors are explicit inputs; no universal assembly values are supplied.',
    'Reference stress is caller-provided and is not qualified here as a Code/design allowable.',
    'Installation torsional stress is not evaluated by this short-form calculator.',
    'Real material, thread, lubricant and coating master-data authority remains unresolved.',
  ]),
});

const INPUTS = Object.freeze([
  { key: 'tensileStressArea', label: 'Tensile stress area', type: 'number', required: true, quantity: 'area', canonicalUnit: 'm2', minExclusive: 0 },
  { key: 'referenceStress', label: 'Reference stress', type: 'number', required: true, quantity: 'stress', canonicalUnit: 'Pa', minExclusive: 0 },
  { key: 'preloadFraction', label: 'Target preload fraction', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, minExclusive: 0, max: 1 },
  { key: 'nominalDiameter', label: 'Nominal bolt diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'nutFactorMin', label: 'Minimum nut factor K', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, minExclusive: 0 },
  { key: 'nutFactor', label: 'Nominal nut factor K', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, minExclusive: 0 },
  { key: 'nutFactorMax', label: 'Maximum nut factor K', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, minExclusive: 0 },
]);

const OUTPUTS = Object.freeze([
  { key: 'targetPreload', label: 'Target preload', type: 'number', quantity: 'force', canonicalUnit: 'N' },
  { key: 'targetReferenceStress', label: 'Target axial stress', type: 'number', quantity: 'stress', canonicalUnit: 'Pa' },
  { key: 'torqueMin', label: 'Minimum torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'torqueNominal', label: 'Nominal torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'torqueMax', label: 'Maximum torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'tensileStress', label: 'Bolt tensile stress', type: 'number', quantity: 'stress', canonicalUnit: 'Pa' },
  { key: 'utilization', label: 'Reference-stress utilization', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
  { key: 'withinReferenceStress', label: 'Within reference stress', type: 'boolean' },
]);

function qualification() {
  return composeEngineeringQualification({
    method: 'IMPLEMENTED',
    data: 'BENCHMARK_ONLY',
    designAuthority: false,
    reasons: [
      'REFERENCE_KERNEL_ONLY',
      'EXPLICIT_PRELOAD_FRACTION_AND_NUT_FACTOR_REQUIRED',
      'REAL_BOLT_AND_FRICTION_MASTER_DATA_UNRESOLVED',
      'NOT_CODE_OR_DESIGN_AUTHORITY',
    ],
  });
}

function calculationInputs(input) {
  return {
    tensileStressAreaM2: input.tensileStressArea,
    referenceStressPa: input.referenceStress,
    preloadFraction: input.preloadFraction,
    nominalDiameterM: input.nominalDiameter,
    nutFactorMin: input.nutFactorMin,
    nutFactor: input.nutFactor,
    nutFactorMax: input.nutFactorMax,
  };
}

function resultOutputs(result) {
  return {
    targetPreload: result.preload.targetPreloadN,
    targetReferenceStress: result.preload.targetReferenceStressPa,
    torqueMin: result.torque.torqueMinNm,
    torqueNominal: result.torque.torqueNominalNm,
    torqueMax: result.torque.torqueMaxNm,
    tensileStress: result.stress.tensileStressPa,
    utilization: result.utilization.utilization,
    withinReferenceStress: result.utilization.withinReferenceStress,
  };
}

function calculate(input) {
  const result = calculateShortFormBoltAssembly(calculationInputs(input));
  return {
    ok: true,
    outputs: resultOutputs(result),
    intermediates: {
      nutFactors: result.torque.nutFactors,
      preloadFraction: input.preloadFraction,
    },
    checks: [{
      id: 'EXPLICIT_REFERENCE_STRESS',
      label: 'Explicit reference stress',
      actual: result.stress.tensileStressPa,
      allowable: input.referenceStress,
      comparator: '<=',
      satisfied: result.utilization.withinReferenceStress,
      utilization: result.utilization.utilization,
      status: result.utilization.withinReferenceStress ? 'PASS' : 'FAIL',
      authority: 'BENCHMARK_ONLY',
      designAuthority: false,
      basis: 'EXPLICIT_CALLER_REFERENCE_STRESS',
    }],
    assessment: {
      status: result.utilization.withinReferenceStress ? 'PASS' : 'FAIL',
      outcome: result.utilization.withinReferenceStress ? 'PASS' : 'FAIL',
      disposition: result.utilization.withinReferenceStress
        ? 'REFERENCE_STRESS_NOT_EXCEEDED'
        : 'REFERENCE_STRESS_EXCEEDED',
      governingEligible: false,
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: qualification(),
    provenance: {
      domainApi: 'bolts/short-form:calculateShortFormBoltAssembly',
      preloadBasis: 'EXPLICIT_CALLER_REFERENCE_STRESS_AND_FRACTION',
      torqueBasis: 'T_EQUALS_KFD_EXPLICIT_K_RANGE',
      realMasterDataQualified: false,
    },
    evidence: {
      domainResult: result,
      authorityBoundary: 'IMPLEMENTED_REFERENCE_KERNEL_NOT_CODE_OR_DESIGN_AUTHORITY',
    },
  };
}

function definition() {
  return {
    contractVersion: ENGINEERING_CALCULATION_CONTRACT_VERSION,
    id: BOLT_SHORT_FORM_ENGINEERING_CALCULATION_ID,
    family: 'FLANGE',
    name: 'Bolts — Preload and Short-Form Torque',
    shortName: 'Bolt Preload / KFd Torque',
    methodRevision: 'bolt-short-form-reference-v1',
    purpose: 'Resolve explicit target preload and a nut-factor torque range using T = K F d.',
    authority: AUTHORITY,
    applicability: APPLICABILITY,
    inputs: INPUTS,
    outputs: OUTPUTS,
    calculate,
  };
}

export function createBoltShortFormEngineeringCalculationDefinition() {
  return definition();
}

export const BOLT_SHORT_FORM_ENGINEERING_CALCULATION_DEFINITION = definition();
