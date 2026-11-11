import { ENGINEERING_CALCULATION_CONTRACT_VERSION } from '../contracts.js';
import { composeEngineeringQualification } from '../qualification.js';
import { calculateInstallationBoltStrength } from '../bolts/installation-strength.js';

export const BOLT_INSTALLATION_STRENGTH_ENGINEERING_CALCULATION_ID = 'BOLT.STRENGTH.INSTALLATION_AXIAL_TORSION';

const AUTHORITY = Object.freeze({
  calculationState: 'IMPLEMENTED',
  qualificationState: 'IMPLEMENTED',
  codeCompliance: false,
});

const APPLICABILITY = Object.freeze({
  description: 'Reference installation-state axial plus thread-torsion von-Mises assessment.',
  limitations: Object.freeze([
    'Only thread torque is transmitted through the assessed bolt stress section.',
    'Bearing torque and total wrench torque are excluded from bolt-section torsion.',
    'Stress-section diameter and reference stress are explicit caller inputs.',
    'Thread-root stress concentration, bending, local notch effects and operating loads are not modeled.',
    'Residual torsion, relaxation, embedding and preload scatter are not modeled.',
    'Reference stress is not qualified here as a Code/design allowable.',
  ]),
});

const INPUTS = Object.freeze([
  { key: 'preload', label: 'Installation preload', type: 'number', required: true, quantity: 'force', canonicalUnit: 'N', min: 0 },
  { key: 'tensileStressArea', label: 'Tensile stress area', type: 'number', required: true, quantity: 'area', canonicalUnit: 'm2', minExclusive: 0 },
  { key: 'threadTorque', label: 'Thread torque', type: 'number', required: true, quantity: 'moment', canonicalUnit: 'N*m', min: 0 },
  { key: 'stressSectionDiameter', label: 'Stress-section diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'referenceStress', label: 'Reference stress', type: 'number', required: true, quantity: 'stress', canonicalUnit: 'Pa', minExclusive: 0 },
]);

const OUTPUTS = Object.freeze([
  { key: 'axialStress', label: 'Installation axial stress', type: 'number', quantity: 'stress', canonicalUnit: 'Pa' },
  { key: 'torsionalShearStress', label: 'Installation torsional shear stress', type: 'number', quantity: 'stress', canonicalUnit: 'Pa' },
  { key: 'vonMisesStress', label: 'Installation von-Mises stress', type: 'number', quantity: 'stress', canonicalUnit: 'Pa' },
  { key: 'utilization', label: 'Reference-stress utilization', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
  { key: 'withinReferenceStress', label: 'Within reference stress', type: 'boolean' },
]);

function qualification() {
  return composeEngineeringQualification({
    method: 'IMPLEMENTED',
    data: 'BENCHMARK_ONLY',
    designAuthority: false,
    reasons: [
      'INSTALLATION_AXIAL_THREAD_TORSION_REFERENCE_ONLY',
      'THREAD_TORQUE_PATH_ASSUMPTION',
      'EXPLICIT_STRESS_SECTION_AND_REFERENCE_STRESS_REQUIRED',
      'REAL_MATERIAL_MASTER_DATA_UNRESOLVED',
      'NOT_CODE_OR_DESIGN_AUTHORITY',
    ],
  });
}

function calculationInputs(input) {
  return {
    preloadN: input.preload,
    tensileStressAreaM2: input.tensileStressArea,
    threadTorqueNm: input.threadTorque,
    stressSectionDiameterM: input.stressSectionDiameter,
    referenceStressPa: input.referenceStress,
  };
}

function resultOutputs(result) {
  return {
    axialStress: result.axial.axialStressPa,
    torsionalShearStress: result.torsion.torsionalShearStressPa,
    vonMisesStress: result.combined.vonMisesStressPa,
    utilization: result.utilization.utilization,
    withinReferenceStress: result.utilization.withinReferenceStress,
  };
}

function calculate(input) {
  const result = calculateInstallationBoltStrength(calculationInputs(input));
  return {
    ok: true,
    outputs: resultOutputs(result),
    intermediates: {
      torquePath: result.torquePath,
      stressSection: {
        model: result.torsion.sectionModel,
        diameterM: result.torsion.stressSectionDiameterM,
      },
    },
    checks: [{
      id: 'INSTALLATION_VON_MISES_REFERENCE_STRESS',
      label: 'Installation von-Mises stress vs explicit reference stress',
      actual: result.combined.vonMisesStressPa,
      allowable: input.referenceStress,
      comparator: '<=',
      utilization: result.utilization.utilization,
      status: result.utilization.withinReferenceStress ? 'PASS' : 'FAIL',
      authority: 'BENCHMARK_ONLY',
      basis: 'EXPLICIT_CALLER_REFERENCE_STRESS',
      satisfied: result.utilization.withinReferenceStress,
      designAuthority: false,
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
      domainApi: 'bolts/installation-strength:calculateInstallationBoltStrength',
      transmittedTorqueComponent: 'THREAD_TORQUE_ONLY',
      materialReferenceStressQualified: false,
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
    id: BOLT_INSTALLATION_STRENGTH_ENGINEERING_CALCULATION_ID,
    family: 'FLANGE',
    name: 'Bolts — Installation Axial / Torsional Strength',
    shortName: 'Bolt Installation von Mises',
    methodRevision: 'bolt-installation-axial-thread-torsion-reference-v1',
    purpose: 'Combine installation preload stress and transmitted thread-torque torsion using a solid circular stress-section reference.',
    authority: AUTHORITY,
    applicability: APPLICABILITY,
    inputs: INPUTS,
    outputs: OUTPUTS,
    calculate,
  };
}

export function createBoltInstallationStrengthEngineeringCalculationDefinition() {
  return definition();
}

export const BOLT_INSTALLATION_STRENGTH_ENGINEERING_CALCULATION_DEFINITION = definition();
