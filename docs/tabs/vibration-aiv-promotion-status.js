export const AIV_CI_PANEL_EVIDENCE = Object.freeze({
  status: 'NOT_A_LIVE_CI_STATUS',
  basis: 'This static release panel does not infer current GitHub Actions health. Use current repository checks/workflow runs for live CI status; committed AIV release receipts remain the qualification evidence shown here.',
});

function importedAivLineCount(state) {
  const count = Number(state?.eitImport?.counts?.aivLines);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function importedEitEvidence(state) {
  const count = importedAivLineCount(state);
  const countText = count === null ? 'AIV records' : `${count} AIV line${count === 1 ? '' : 's'}`;
  return Object.freeze({
    status: 'IMPORTED_EIT_REVIEW_REQUIRED',
    basis: `Imported EI .eit contains ${countText}. Historical AIV values remain evidence only; review missing/derived fields, check readiness, then rerun VIB.AIV.ACOUSTIC for current assessment-level screening.`,
  });
}

export function describeAivProductPathEvidence(state = {}, controlledValidation = {}) {
  const benchmark = state.benchmark?.loaded ?? null;
  if (state.eitImport) return importedEitEvidence(state);
  if (benchmark && !benchmark.modified && !state.assumptionProfileModified) {
    const passed = controlledValidation.counts?.passed ?? '—';
    const checks = controlledValidation.counts?.checks ?? '—';
    return Object.freeze({
      status: controlledValidation.status ?? 'PASS',
      basis: `${passed}/${checks} committed checks pass for the exact controlled benchmark inputs.`,
    });
  }
  if (benchmark) {
    return Object.freeze({
      status: 'NOT_APPLICABLE_MODIFIED_INPUTS',
      basis: 'Controlled benchmark inputs or assumptions were modified; the committed benchmark parity receipt no longer applies. Check readiness and rerun screening for the edited inputs.',
    });
  }
  return Object.freeze({
    status: 'CONTROLLED_BENCHMARK_NOT_LOADED',
    basis: 'No controlled EI D.2.3 benchmark is loaded. Load the benchmark for exact parity evidence, or import working inputs and use readiness plus a registered screening rerun.',
  });
}
