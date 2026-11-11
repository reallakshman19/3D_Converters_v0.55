import { projectVibrationFacilityMechanismCurrentness } from '../converters/vibration/facility/mechanism-currentness.js';
import { getCurrentAivScreeningSession } from './vibration-aiv-screening-session.js';

function retainedStaleContext(state, aivScreeningSession) {
  return Object.freeze({
    resultState: state.resultState,
    userEngineeringDataRows: state.userEngineeringData?.rows ?? [],
    mechanicalSourceKeysByScope: state.mechanicalSourceKeysByScope ?? {},
    mechanicalNotApplicableByScope: state.mechanicalNotApplicableByScope ?? {},
    mechanicalCandidateResultsByScope: state.mechanicalCandidateResultsByScope ?? {},
    sbcCandidateResultsByScope: state.sbcFacilityCandidateResults ?? {},
    aivScreeningSession,
    aivResultState: 'STALE_RESULT',
    facilityMechanismCurrentness: null,
  });
}

export function buildVibrationIntegrityMatrixContext(state = {}, options = {}) {
  const aivScreeningSession = Object.prototype.hasOwnProperty.call(options, 'aivScreeningSession')
    ? options.aivScreeningSession
    : getCurrentAivScreeningSession();
  if (state.resultState === 'STALE_RESULT') {
    return retainedStaleContext(state, aivScreeningSession);
  }
  const workflow = state.envelope?.workflow;
  const currentness = projectVibrationFacilityMechanismCurrentness({
    resultState: state.resultState,
    runId: state.runSnapshot?.runId,
    datasetId: workflow?.result?.datasetId,
    scenarioSetKey: workflow?.result?.scenarioSetKey,
    operatingScenarios: workflow?.operatingScenarios ?? [],
    mechanicalCandidateResultsByScope: state.mechanicalCandidateResultsByScope ?? {},
    sbcCandidateResultsByScope: state.sbcFacilityCandidateResults ?? {},
    aivScreeningSession,
  });
  return Object.freeze({
    resultState: state.resultState,
    userEngineeringDataRows: state.userEngineeringData?.rows ?? [],
    mechanicalSourceKeysByScope: state.mechanicalSourceKeysByScope ?? {},
    mechanicalNotApplicableByScope: state.mechanicalNotApplicableByScope ?? {},
    mechanicalCandidateResultsByScope: currentness.mechanicalCandidateResultsByScope,
    sbcCandidateResultsByScope: currentness.sbcCandidateResultsByScope,
    aivScreeningSession: currentness.aivScreeningSession,
    facilityMechanismCurrentness: currentness,
  });
}
