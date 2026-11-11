import { computeXmlCiiWeightIssues } from './converters/xmltocii2019_helper/weight-match-renderer.js?v=20261001-single-weight-owners-1';
import { validateWeightSubsets } from '../../converters/xml-cii2019-core/weight-subset-validator.js';

function summaryOf(rows = []) {
  const issues = Array.isArray(rows) ? rows : [];
  return {
    rows: issues.length,
    flagged: issues.filter((row) => row.validatorIsFlagged).length,
    oddLength: issues.filter((row) => row.validatorIsOdd).length,
    suspectWeight: issues.filter((row) => row.validatorIsSuspect).length,
    noMatch: issues.filter((row) => row.validatorNoMatch).length,
  };
}

function publishDiagnostic(detail) {
  if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
  try {
    document.dispatchEvent(new CustomEvent('xml-cii-catalog-weight-validation-ready', {
      bubbles: true,
      detail,
    }));
  } catch {}
}

// Compatibility entrypoint retained for callers that still invoke the former
// standalone "post-run validator" gate. The old modal was not an independent
// engineering authority: it could validate a resolved weight against the same
// catalog family that produced the suggestion, could display an all-good state
// when no empirical estimate existed, and wrote edits back to legacy
// overrides.rigidWeight. Those behaviours are intentionally retired.
//
// Current authority is the standalone Weight Match + Final rigid review
// lifecycle. This function now emits catalog diagnostics only and immediately
// releases the caller; it never changes accepted weights and never opens UI.
export async function runXmlCiiStandalonePostRunValidation({
  xmlFile,
  resolveStagedJsonText,
  config,
  enrichXmlForCii2019,
  onClose,
  onNoIssues,
}) {
  const proceed = typeof onClose === 'function' ? onClose : () => {};
  const proceedDirect = typeof onNoIssues === 'function' ? onNoIssues : proceed;
  try {
    const result = await computeXmlCiiWeightIssues({
      xmlFile,
      resolveStagedJsonText,
      config,
      enrichXmlForCii2019,
    });
    if (!result || !Array.isArray(result.issues) || !result.issues.length) {
      publishDiagnostic({
        schema: 'xml-cii-catalog-weight-validation/v1',
        authority: 'DIAGNOSTIC_ONLY_NOT_WEIGHT_AUTHORITY',
        summary: summaryOf([]),
        rows: [],
      });
      proceedDirect();
      return;
    }

    const rows = validateWeightSubsets(result.issues, result.masterRows || [], result.config || config || {});
    publishDiagnostic({
      schema: 'xml-cii-catalog-weight-validation/v1',
      authority: 'DIAGNOSTIC_ONLY_NOT_WEIGHT_AUTHORITY',
      summary: summaryOf(rows),
      rows,
    });
    proceed();
  } catch (error) {
    console.warn('XML→CII standalone catalog weight diagnostic failed:', error);
    publishDiagnostic({
      schema: 'xml-cii-catalog-weight-validation/v1',
      authority: 'DIAGNOSTIC_ONLY_NOT_WEIGHT_AUTHORITY',
      summary: summaryOf([]),
      rows: [],
      error: String(error?.message || error),
    });
    proceedDirect();
  }
}
