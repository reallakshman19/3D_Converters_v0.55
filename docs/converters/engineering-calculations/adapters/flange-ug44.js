import { ENGINEERING_CALCULATION_CONTRACT_VERSION } from '../contracts.js';
import { composeEngineeringQualification } from '../qualification.js';
import { calculateUg44RatedFlange } from '../flange/ug44.js';

export const FLANGE_UG44_ENGINEERING_CALCULATION_ID = 'FLANGE.RATED_LOAD.UG44B';

const AUTHORITY = Object.freeze({
  calculationState: 'BENCHMARK_ONLY',
  qualificationState: 'BENCHMARK_ONLY',
  codeCompliance: false,
});

const APPLICABILITY = Object.freeze({
  description: 'Benchmark-only scalar assessment after loads have been resolved at the flange face.',
  limitations: Object.freeze([
    'Primary Code source qualification is pending; this result is not Code/design authority.',
    'Flange pressure-temperature rating and gasket reaction diameter are caller-provided; governed master-data lookup is not yet integrated.',
    'The adapter consumes resolved opening axial force and resultant in-plane bending moment; 3D load transformation remains a separate upstream step.',
  ]),
});

const INPUTS = Object.freeze([
  { key: 'ratedPressure', label: 'Rated pressure', type: 'number', required: true, quantity: 'pressure', canonicalUnit: 'Pa', minExclusive: 0 },
  { key: 'designPressure', label: 'Design pressure', type: 'number', required: true, quantity: 'pressure', canonicalUnit: 'Pa', min: 0 },
  { key: 'gasketReactionDiameter', label: 'Gasket reaction diameter', type: 'number', required: true, quantity: 'length', canonicalUnit: 'm', minExclusive: 0 },
  { key: 'momentFactor', label: 'Moment factor', type: 'number', required: true, quantity: 'dimensionless', canonicalUnit: null, min: 0 },
  { key: 'bendingMoment', label: 'Resolved bending moment', type: 'number', required: true, quantity: 'moment', canonicalUnit: 'N*m', min: 0 },
  { key: 'openingAxialForce', label: 'Opening axial force', type: 'number', required: true, quantity: 'force', canonicalUnit: 'N', min: 0 },
]);

const OUTPUTS = Object.freeze([
  { key: 'equationSatisfied', label: 'Reference equation satisfied', type: 'boolean' },
  { key: 'maximumPressure', label: 'Maximum pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'utilization', label: 'Reference utilization', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
  { key: 'margin', label: 'Pressure margin', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'bendingEquivalentPressure', label: 'Bending equivalent pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'axialEquivalentPressure', label: 'Axial equivalent pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'externalEquivalentPressure', label: 'External equivalent pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'availablePressure', label: 'Available pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
  { key: 'demandPressure', label: 'Demand pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'Pa' },
]);

function qualification() {
  return composeEngineeringQualification({
    method: 'BENCHMARK_ONLY',
    data: 'BENCHMARK_ONLY',
    designAuthority: false,
    reasons: [
      'PV_ELITE_C101_CROSS_SOLVER_BENCHMARK_ONLY',
      'PRIMARY_CODE_SOURCE_QUALIFICATION_PENDING',
      'FLANGE_MASTER_DATA_NOT_YET_GOVERNED',
      'NOT_DESIGN_AUTHORITY',
    ],
  });
}

function calculationInputs(input) {
  return {
    ratedPressurePa: input.ratedPressure,
    designPressurePa: input.designPressure,
    gasketReactionDiameterM: input.gasketReactionDiameter,
    momentFactor: input.momentFactor,
    bendingMomentNm: input.bendingMoment,
    openingAxialForceN: input.openingAxialForce,
  };
}

function resultOutputs(result) {
  return {
    equationSatisfied: result.pass,
    maximumPressure: result.maximumPressurePa,
    utilization: result.utilization,
    margin: result.marginPa,
    bendingEquivalentPressure: result.bendingPressurePa,
    axialEquivalentPressure: result.axialPressurePa,
    externalEquivalentPressure: result.externalEquivalentPressurePa,
    availablePressure: result.availablePressurePa,
    demandPressure: result.demandPressurePa,
  };
}

function calculate(input) {
  const result = calculateUg44RatedFlange(calculationInputs(input));
  return {
    ok: true,
    outputs: resultOutputs(result),
    intermediates: {
      uncappedMaximumPressure: result.uncappedMaximumPressurePa,
      availablePressure: result.availablePressurePa,
      demandPressure: result.demandPressurePa,
    },
    checks: [{
      id: 'UG44B_REFERENCE_RELATIONSHIP',
      label: 'UG-44(b) reference relationship',
      actual: result.demandPressurePa,
      allowable: result.availablePressurePa,
      comparator: '<=',
      utilization: result.utilization,
      status: result.pass ? 'PASS' : 'FAIL',
      authority: 'BENCHMARK_ONLY',
      basis: 'PV_ELITE_C101_ROUNDED_INPUT_CROSS_SOLVER',
      satisfied: result.pass,
      designAuthority: false,
    }],
    assessment: {
      status: result.pass ? 'PASS' : 'FAIL',
      outcome: result.pass ? 'PASS' : 'FAIL',
      disposition: result.pass ? 'REFERENCE_RELATIONSHIP_SATISFIED' : 'REFERENCE_RELATIONSHIP_EXCEEDED',
      governingEligible: false,
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: qualification(),
    provenance: {
      domainApi: 'flange/ug44:calculateUg44RatedFlange',
      validationBasis: 'PV_ELITE_C101_ROUNDED_INPUT_CROSS_SOLVER',
      primaryCodeSourceQualified: false,
      flangeMasterDataQualified: false,
    },
    evidence: { domainResult: result, authorityBoundary: 'BENCHMARK_ONLY_NOT_CODE_OR_DESIGN_AUTHORITY' },
  };
}

function definition() {
  return {
    contractVersion: ENGINEERING_CALCULATION_CONTRACT_VERSION,
    id: FLANGE_UG44_ENGINEERING_CALCULATION_ID,
    family: 'FLANGE',
    name: 'Rated Flange External Load Assessment — UG-44(b) Form',
    shortName: 'Rated Flange External Load',
    methodRevision: 'ug44b-form-benchmark-v1',
    purpose: 'Evaluate the rated-flange external-load relationship using resolved flange-face axial force and bending moment.',
    authority: AUTHORITY,
    applicability: APPLICABILITY,
    inputs: INPUTS,
    outputs: OUTPUTS,
    calculate,
  };
}

export function createFlangeUg44EngineeringCalculationDefinition() {
  return definition();
}

export const FLANGE_UG44_ENGINEERING_CALCULATION_DEFINITION = definition();
