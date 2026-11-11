import { listEngineeringCalculations } from '../../engineering-calculations/index.js';
import { ENERGY_INSTITUTE_EIT_MODULES } from '../eit/module-registry.js';
import { VIBRATION_MECHANISM_IDS } from './registry.js';

export const VIBRATION_MECHANISM_CAPABILITY_SCHEMA = 'VibrationMechanismCapability.v1';

const MATRIX_INTEGRATION = Object.freeze({
  fit: Object.freeze({
    assessmentIntegrationState: 'INTEGRATED',
    integrityImplementationState: 'SCREENING',
  }),
  mechanicalExcitation: Object.freeze({
    assessmentIntegrationState: 'INTEGRATED',
    integrityImplementationState: 'SCREENING',
  }),
  aiv: Object.freeze({
    assessmentIntegrationState: 'INTEGRATED_ASSESSMENT_SCOPE',
    integrityImplementationState: 'SCREENING_ASSESSMENT_SCOPE',
  }),
  smallBoreConnections: Object.freeze({
    assessmentIntegrationState: 'INTEGRATED',
    integrityImplementationState: 'CANDIDATE_USER_INPUT',
  }),
});

const KNOWN_MECHANISMS = new Set(VIBRATION_MECHANISM_IDS);
const EIT_BY_MECHANISM = new Map(
  ENERGY_INSTITUTE_EIT_MODULES.map((entry) => [entry.mechanismId, entry]),
);
const CALCULATIONS = listEngineeringCalculations();
const CALCULATION_BY_ID = new Map(CALCULATIONS.map((definition) => [definition.id, definition]));
const AVAILABLE_CALCULATION_IDS = new Set(
  listEngineeringCalculations({ availableOnly: true }).map((definition) => definition.id),
);

function requiredKnownMechanismId(value) {
  const mechanismId = String(value ?? '').trim();
  if (!KNOWN_MECHANISMS.has(mechanismId)) {
    throw new Error(`UNKNOWN_VIBRATION_MECHANISM:${mechanismId || 'EMPTY'}`);
  }
  return mechanismId;
}

function calculationProjection(eitModule) {
  const calculationId = eitModule?.calculationId ?? null;
  const definition = calculationId ? CALCULATION_BY_ID.get(calculationId) ?? null : null;
  return Object.freeze({
    calculationId,
    calculationRegistered: Boolean(definition),
    calculationAvailable: Boolean(calculationId && AVAILABLE_CALCULATION_IDS.has(calculationId)),
    calculationState: definition?.authority?.calculationState ?? null,
    qualificationState: definition?.authority?.qualificationState ?? null,
    codeCompliance: definition ? Boolean(definition.authority?.codeCompliance) : false,
  });
}

function projectedImplementationState(integration, calculation) {
  if (integration) return integration.integrityImplementationState;
  if (calculation.calculationAvailable) return 'IMPLEMENTED_NOT_INTEGRATED';
  if (calculation.calculationRegistered) return 'REGISTERED_NOT_AVAILABLE';
  return 'NOT_IMPLEMENTED';
}

export function resolveVibrationMechanismCapability(value) {
  const mechanismId = requiredKnownMechanismId(value);
  const eitModule = EIT_BY_MECHANISM.get(mechanismId) ?? null;
  const integration = MATRIX_INTEGRATION[mechanismId] ?? null;
  const calculation = calculationProjection(eitModule);
  return Object.freeze({
    schema: VIBRATION_MECHANISM_CAPABILITY_SCHEMA,
    mechanismId,
    eitModuleCode: eitModule?.code ?? null,
    ...calculation,
    assessmentIntegrationState: integration?.assessmentIntegrationState
      ?? (calculation.calculationAvailable ? 'NOT_INTEGRATED' : 'NONE'),
    integrityImplementationState: projectedImplementationState(integration, calculation),
    governingEligibilitySource: 'RUNTIME_ASSESSMENT_ONLY',
  });
}

export function listVibrationMechanismCapabilities() {
  return Object.freeze(VIBRATION_MECHANISM_IDS.map(resolveVibrationMechanismCapability));
}
