import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import { previewHpPipingClassIntakePackage } from './hp-piping-class-intake-package.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details });
}

function calculationIssues(calculation) {
  const issues = [];
  for (const row of calculation?.issues ?? []) {
    issues.push(issue(row.code || 'INTAKE_PACKAGE_CANONICAL_PROJECT_BLOCKED', row.message || 'Canonical project validation blocked.', {
      stage: 'CANONICAL_PROJECT', path: row.path ?? null,
    }));
  }
  for (const product of calculation?.products ?? []) {
    if (product?.calculationOk) continue;
    for (const [stage, trace] of Object.entries(product?.calculations ?? {})) {
      if (trace?.ok !== false) continue;
      issues.push(issue(
        trace.code || 'INTAKE_PACKAGE_CANONICAL_CALCULATION_BLOCKED',
        `${product.productId} ${stage} calculation blocked: ${trace.message || trace.reason || trace.state || 'unknown reason'}.`,
        { stage: `CANONICAL_${String(stage).toUpperCase()}`, productId: product.productId, engineeringState: product.engineeringState },
      ));
    }
  }
  if (!issues.length && calculation?.ok === false) {
    issues.push(issue(
      'INTAKE_PACKAGE_CANONICAL_CALCULATION_BLOCKED',
      `Canonical HP review calculation blocked in state ${calculation.projectState || 'UNKNOWN'}.`,
      { stage: 'CANONICAL_REVIEW', projectState: calculation.projectState ?? null },
    ));
  }
  return issues;
}

export function previewHpPipingClassIntakePackageForReview(source) {
  const composed = previewHpPipingClassIntakePackage(source);
  if (!composed.ok) return composed;
  let calculation;
  try {
    calculation = evaluateHpPipingClassProject(composed.project, { includeEvidence: false });
  } catch (error) {
    return {
      ...composed,
      ok: false,
      issues: [issue(
        'INTAKE_PACKAGE_CANONICAL_PREFLIGHT_EXCEPTION',
        `Canonical HP review preflight failed before workspace mutation: ${error.message}`,
        { stage: 'CANONICAL_REVIEW' },
      )],
      project: null,
      candidateProject: clone(composed.project),
      calculation: null,
    };
  }
  if (!calculation.ok) {
    return {
      ...composed,
      ok: false,
      issues: calculationIssues(calculation),
      project: null,
      candidateProject: clone(composed.project),
      calculation: clone(calculation),
      summary: {
        ...composed.summary,
        canonicalProjectState: calculation.projectState ?? null,
        calculationBlocked: calculation.summary?.calculationBlocked ?? null,
      },
    };
  }
  return {
    ...composed,
    calculation: clone(calculation),
    summary: Object.freeze({
      ...composed.summary,
      canonicalProjectState: calculation.projectState,
      calculationBlocked: calculation.summary?.calculationBlocked ?? 0,
      staticReferenceFailed: calculation.summary?.staticReferenceFailed ?? 0,
      fatigueEvaluated: calculation.summary?.fatigueEvaluated ?? 0,
      fatigueExceedsUnity: calculation.summary?.fatigueExceedsUnity ?? 0,
    }),
  };
}

export function applyHpPipingClassIntakePackageForReview(source) {
  const preview = previewHpPipingClassIntakePackageForReview(source);
  return preview.ok
    ? { ...preview, applied: true, project: clone(preview.project) }
    : { ...preview, applied: false, project: null };
}
