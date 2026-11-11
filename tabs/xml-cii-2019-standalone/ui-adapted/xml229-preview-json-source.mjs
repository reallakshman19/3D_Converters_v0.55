/** A missing JSON input is optional; selected or revoked input still needs custody checks. */
export function hasXml229PreviewJsonSource(state = {}) {
  return !!(state.stagedJsonFile || state.stagedJsonText ||
    state.xml229StagedSourceReceipt || state.xml229StagedSourceStatus);
}
