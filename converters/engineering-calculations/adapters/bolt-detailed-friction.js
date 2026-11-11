import { ENGINEERING_CALCULATION_CONTRACT_VERSION } from '../contracts.js';
import { composeEngineeringQualification } from '../qualification.js';
import { calculateDetailedFrictionTorque } from '../bolts/detailed-friction.js';

export const BOLT_DETAILED_FRICTION_ENGINEERING_CALCULATION_ID = 'BOLT.TORQUE.DETAILED_FRICTION';

const AUTHORITY = Object.freeze({
  calculationState: 'IMPLEMENTED',
  qualificationState: 'IMPLEMENTED',
  codeCompliance: false,
});

const APPLICABILITY = Object.freeze({
  description: 'Reference V-thread tightening torque calculation with explicit thread and bearing friction inputs.',
  limitations: Object.freeze([
    'Pitch diameter, lead, thread half-angle and bearing friction radius are explicit caller geometry.',
    'Thread and bearing friction coefficients are explicit caller inputs; no lubricant/coating master values are implied.',
    'Effective nut factor is a derived diagnostic only.',
    'Preload scatter, embedding, relaxation, prevailing torque and tool uncertainty are not modeled.',
    'NASA RP-1228 equation agreement is reference evidence, not ASME/PCC-1/VDI design authority.',
  ]),
});

const INPUTS = Object.freeze([
  { key: 'preload', label: 'Bolt preload', type: 'number', required: true, quantity: 'force', canonicalUnit: 'N', minExclusive: 0 },
  { key: 'nominalDiameter', label: 'Nominal bolt diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'pitchDiameter', label: 'Thread pitch diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'lead', label: 'Thread lead', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'threadHalfAngleDeg', label: 'Thread half-angle', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0, maxExclusive: 90 },
  { key: 'threadFrictionCoefficient', label: 'Thread friction coefficient', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0 },
  { key: 'bearingFrictionCoefficient', label: 'Bearing friction coefficient', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0 },
  { key: 'bearingFrictionRadius', label: 'Bearing friction radius', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
]);

const OUTPUTS = Object.freeze([
  { key: 'pitchTorque', label: 'Pitch torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'threadTorque', label: 'Thread torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'threadFrictionAndCouplingTorque', label: 'Thread friction / coupling torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'bearingTorque', label: 'Bearing torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'totalTorque', label: 'Total wrench torque', type: 'number', quantity: 'moment', canonicalUnit: 'N*m' },
  { key: 'effectiveNutFactor', label: 'Derived effective nut factor', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
  { key: 'threadDenominator', label: 'Thread friction / helix denominator', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
]);

function qualification() {
  return composeEngineeringQualification({
    method: 'IMPLEMENTED',
    data: 'BENCHMARK_ONLY',
    designAuthority: false,
    reasons: [
      'NASA_RP_1228_REFERENCE_EQUATION',
      'EXPLICIT_THREAD_AND_BEARING_FRICTION_REQUIRED',
      'REAL_FRICTION_MASTER_DATA_UNRESOLVED',
      'NOT_CODE_OR_DESIGN_AUTHORITY',
    ],
  });
}

function calculationInputs(input) {
  return {
    preloadN: input.preload,
    nominalDiameterM: input.nominalDiameter,
    pitchDiameterM: input.pitchDiameter,
    leadM: input.lead,
    threadHalfAngleDeg: input.threadHalfAngleDeg,
    threadFrictionCoefficient: input.threadFrictionCoefficient,
    bearingFrictionCoefficient: input.bearingFrictionCoefficient,
    bearingFrictionRadiusM: input.bearingFrictionRadius,
  };
}

function resultOutputs(result) {
  return {
    pitchTorque: result.pitchTorqueNm,
    threadTorque: result.threadTorqueNm,
    threadFrictionAndCouplingTorque: result.threadFrictionAndCouplingTorqueNm,
    bearingTorque: result.bearingTorqueNm,
    totalTorque: result.totalTorqueNm,
    effectiveNutFactor: result.effectiveNutFactor,
    threadDenominator: result.denominator,
  };
}

function calculate(input) {
  const result = calculateDetailedFrictionTorque(calculationInputs(input));
  return {
    ok: true,
    outputs: resultOutputs(result),
    intermediates: {
      geometry: result.geometry,
      friction: result.friction,
      torqueShares: result.shares,
    },
    checks: [],
    assessment: {
      outcome: 'NOT_ASSESSED',
      disposition: 'REFERENCE_TORQUE_RESOLVED',
      governingEligible: false,
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: qualification(),
    provenance: {
      domainApi: 'bolts/detailed-friction:calculateDetailedFrictionTorque',
      equationBasis: result.sourceBasis,
      frictionMasterDataQualified: false,
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
    id: BOLT_DETAILED_FRICTION_ENGINEERING_CALCULATION_ID,
    family: 'FLANGE',
    name: 'Bolts — Detailed Thread and Bearing Friction Torque',
    shortName: 'Bolt Detailed Friction Torque',
    methodRevision: 'bolt-detailed-v-thread-reference-v1',
    purpose: 'Resolve tightening torque from explicit preload, V-thread geometry, thread friction and bearing friction.',
    authority: AUTHORITY,
    applicability: APPLICABILITY,
    inputs: INPUTS,
    outputs: OUTPUTS,
    calculate,
  };
}

export function createBoltDetailedFrictionEngineeringCalculationDefinition() {
  return definition();
}

export const BOLT_DETAILED_FRICTION_ENGINEERING_CALCULATION_DEFINITION = definition();
