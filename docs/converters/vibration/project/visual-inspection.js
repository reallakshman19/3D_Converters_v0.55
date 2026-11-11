import { assertVibrationIntegrityProject } from './schema.js';
import { createVibrationVisualInspectionEvidencePackage, createVibrationVisualInspectionError } from '../visual-inspection/contracts.js';
import { evaluateVibrationVisualInspectionScope } from '../visual-inspection/evaluate.js';

export const VIBRATION_PROJECT_VISUAL_INSPECTION_PROJECTION_SCHEMA = 'VibrationProjectVisualInspectionProjection.v1';
export const VIBRATION_PROJECT_VISUAL_INSPECTION_PROJECTION_AUTHORITY = Object.freeze({
  authority: 'PROJECT_VISUAL_INSPECTION_PROJECTION_ONLY',
  persistsVisualInspectionState: false,
  eiChecklistCoverage: 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function scopeKey(scope) {
  return JSON.stringify([scope.lineId, scope.caseId, scope.operatingCaseSnapshotId, scope.operatingCaseSnapshotHash]);
}

function uniqueScopes(records) {
  const values = new Map();
  for (const record of records) values.set(scopeKey(record.scope), record.scope);
  return [...values.values()].sort((a, b) => scopeKey(a).localeCompare(scopeKey(b)));
}

function stateCounts(results) {
  const counts = {};
  for (const result of results) counts[result.state] = (counts[result.state] ?? 0) + 1;
  return Object.freeze(counts);
}

export function evaluateProjectVibrationVisualInspection(project, evidence) {
  assertVibrationIntegrityProject(project);
  const pkg = createVibrationVisualInspectionEvidencePackage(evidence);
  const lineIds = new Set(project.subjects.lines.map((line) => String(line.lineId)));
  for (const record of pkg.records) {
    if (!lineIds.has(record.scope.lineId)) {
      throw createVibrationVisualInspectionError(
        'VIBRATION_VISUAL_DANGLING_PROJECT_LINE',
        'Visual inspection record references an unknown project line.',
        { inspectionId: record.inspectionId, lineId: record.scope.lineId },
      );
    }
  }
  const results = uniqueScopes(pkg.records).map((scope) => evaluateVibrationVisualInspectionScope({ scope, evidence: pkg }));
  return deepFreeze({
    schema: VIBRATION_PROJECT_VISUAL_INSPECTION_PROJECTION_SCHEMA,
    projectId: project.project?.projectId ?? project.project?.id ?? null,
    inspectionCount: pkg.records.length,
    scopeCount: results.length,
    countsByState: stateCounts(results),
    results,
    authority: VIBRATION_PROJECT_VISUAL_INSPECTION_PROJECTION_AUTHORITY,
  });
}
