/** Release custody for explicitly configured branch formats.
 * Evaluates every selected occurrence, independently of Regex's interactive sample cap. */
import { extractBranchFieldsWithFormats } from '../../converters/xml-cii2019-core/branch-format-extraction.js';
import { deriveMappedLineKeyForBranch } from '../../converters/xml-cii2019-core/regex-line-key.js';

function text(value) { return String(value ?? '').trim(); }
function configured(config) {
  return Array.isArray(config?.regexTester?.formats) || Array.isArray(config?.formats);
}

// Diagnostics are opt-in for the Run checklist. The service's release-custody
// audit still returns its original failure shape, with the same fail-closed gate.
function formatDiagnosis(result) {
  const selected = result.status === 'AMBIGUOUS'
    ? result.candidates.filter(candidate => candidate.status === 'MATCHED')
    : result.candidates;
  return selected.map(candidate => result.status === 'AMBIGUOUS'
    ? { formatIndex: candidate.formatIndex, status: candidate.status,
      lineKey: candidate.lineKey, pipingClass: candidate.pipingClass,
      rating: candidate.rating, bore: candidate.bore }
    : { formatIndex: candidate.formatIndex, status: candidate.status,
      reasons: candidate.reasons, fieldMethods: candidate.fieldMethods });
}

/** branchOccurrences: occurrence rows with branchName and optional branchOccurrenceId. */
export function auditConfiguredBranchFormats(branchOccurrences = [], config = {}, previewRows = null, options = {}) {
  const required = configured(config);
  const source = Array.isArray(branchOccurrences) ? branchOccurrences : [];
  if (!required) return { required: false, checkedCount: 0, blocked: false, failures: [] };
  const failures = [];
  const expected = source.map((branch, index) => {
    const result = extractBranchFieldsWithFormats(branch.branchName, config);
    if (result.status !== 'MATCHED') {
      const failure = {
        branchName: branch.branchName, branchOccurrenceId: branch.branchOccurrenceId || '',
        occurrenceIndex: index, status: result.status, reason: 'FORMAT_UNRESOLVED',
      };
      // Show the first 20 examples only. Preserve full failure count and every
      // original occurrence while avoiding huge serializable diagnostic payloads.
      if (options?.includeCandidates === true && failures.length < 20) {
        failure.formatCandidates = formatDiagnosis(result);
        failure.configOrigin = result.origin;
      }
      failures.push(failure);
    }
    return result;
  });
  if (Array.isArray(previewRows)) {
    for (let index = 0; index < source.length; index += 1) {
      const branch = source[index], actual = previewRows[index], identity = expected[index];
      if (!actual || text(actual.branchName) !== text(branch.branchName)) {
        failures.push({ branchName: branch.branchName, occurrenceIndex: index,
          status: 'MISSING_PREVIEW_PROOF', reason: 'OCCURRENCE_MISMATCH' });
        continue;
      }
      if (identity.status !== 'MATCHED') continue;
      if (actual.extractionStatus !== 'MATCHED' || actual.branchIdentityConflict
        || !text(actual.lineKey) || !text(actual.pipingClass)) {
        failures.push({ branchName: branch.branchName, occurrenceIndex: index,
          status: actual.extractionStatus || 'MISSING_PREVIEW_PROOF',
          reason: actual.branchIdentityConflict || 'PREVIEW_AUTHORITY_BLOCKED' });
        continue;
      }
      const expectedLineKey = deriveMappedLineKeyForBranch(branch.branchName, config) || identity.lineKey;
      const authorizedClassOverride = actual.pipingClassMethod === 'override';
      if (text(actual.lineKey) !== text(expectedLineKey)
        || (!authorizedClassOverride
          && text(actual.pipingClass).toUpperCase() !== text(identity.pipingClass).toUpperCase())
        || actual.matchedFormatIndex !== identity.matchedFormatIndex) {
        failures.push({ branchName: branch.branchName, occurrenceIndex: index,
          status: 'PREVIEW_DIVERGENCE', reason: 'ENGINEERING_IDENTITY_MISMATCH' });
      }
    }
    if (previewRows.length !== source.length) failures.push({
      status: 'MISSING_PREVIEW_PROOF', reason: 'POPULATION_COUNT_MISMATCH',
      expectedCount: source.length, actualCount: previewRows.length,
    });
  }
  return { required: true, checkedCount: source.length,
    blocked: failures.length > 0, failures };
}
