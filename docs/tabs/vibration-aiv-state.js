import { AIV_DEFAULT_ASSUMPTION_PROFILE } from '../converters/vibration/aiv/aiv-assumption-profile.js';
import { createAivEngineeringRevisionState } from './vibration-aiv-engineering-revision.js';
import { createEmptyAivInputTable } from './vibration-aiv-input-model.js';
import { createEmptyAivFlareNetworkWorkspace } from './vibration-aiv-flare-network-state.js';

export function createInitialAivQualificationState({
  facilityScenarioHandoff = null,
  facilityScenarioHandoffStatus = null,
  facilityScenarioHandoffErrorCode = null,
} = {}) {
  return {
    ...createAivEngineeringRevisionState(),
    files: { eit: null, topology: null, sources: null, assessments: null, relationships: null },
    eitImport: null,
    topologyInput: null,
    topology: null,
    tables: {
      sources: createEmptyAivInputTable('sources'),
      assessments: createEmptyAivInputTable('assessments'),
      relationships: createEmptyAivInputTable('relationships'),
    },
    flareNetwork: createEmptyAivFlareNetworkWorkspace(),
    flareNetworkActive: false,
    generatedInputSet: null,
    benchmark: { loaded: null },
    assumptionProfile: AIV_DEFAULT_ASSUMPTION_PROFILE,
    assumptionProfileModified: false,
    assumptionResolution: null,
    assumptionAcceptance: null,
    inventoryCompletenessAttestations: [],
    readinessEnvelope: null,
    resultSet: null,
    screeningResult: null,
    scenarioExecutionPlan: null,
    facilityScenarioHandoff,
    facilityScenarioHandoffStatus,
    facilityScenarioHandoffErrorCode,
    facilityLinkIntent: facilityScenarioHandoffStatus !== null,
    selectedRowKey: null,
    selectedCanvasKey: null,
    canvasActionError: null,
    busy: false,
    error: null,
    destroyed: false,
  };
}