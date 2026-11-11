import { createHpPipingClassExternalResultShell } from './hp-piping-class-workbench-state.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function addAllHpPipingClassExternalResults(project, evidenceIndex) {
  const pkg = project?.fatigueEvidence?.[evidenceIndex];
  if (!pkg) return { added: 0, reason: 'EVIDENCE_PACKAGE_NOT_FOUND' };
  pkg.externalResults ??= [];
  const transitionCount = project?.transient?.transitions?.length ?? 0;
  let added = 0;
  for (let guard = 0; guard <= transitionCount; guard += 1) {
    const shell = createHpPipingClassExternalResultShell(project, evidenceIndex);
    if (!shell) break;
    pkg.externalResults.push(shell);
    added += 1;
  }
  return { added, reason: added ? null : 'NO_UNCOVERED_GOVERNED_CYCLES' };
}

export function copyFirstHpPipingClassKdBasisToAll(project, evidenceIndex) {
  const rows = project?.fatigueEvidence?.[evidenceIndex]?.externalResults;
  if (!Array.isArray(rows) || rows.length < 2) {
    return { copied: 0, reason: 'MULTIPLE_ROWS_REQUIRED' };
  }
  const source = rows[0]?.calculationBasis;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { copied: 0, reason: 'FIRST_ROW_BASIS_MISSING' };
  }
  for (let index = 1; index < rows.length; index += 1) rows[index].calculationBasis = clone(source);
  return { copied: rows.length - 1, reason: null };
}
