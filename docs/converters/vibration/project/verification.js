import { createEmptyVibrationMeasurementEvidencePackage } from './measurement.js';
import { assertVibrationIntegrityProject } from './schema.js';
import { evaluateVibrationVerification } from '../verification/evaluate.js';
import {
  createVibrationMeasurementDisposition,
  createVibrationVerificationError,
  createVibrationVerificationRequirement,
} from '../verification/contracts.js';

export const VIBRATION_PROJECT_VERIFICATION_PROJECTION_SCHEMA = 'VibrationProjectVerificationProjection.v1';
export const VIBRATION_PROJECT_VERIFICATION_PROJECTION_AUTHORITY = Object.freeze({
  authority: 'PROJECT_VERIFICATION_PROJECTION_ONLY',
  persistsVerificationState: false,
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

function normalizedArray(value, field) {
  if (!Array.isArray(value)) {
    throw createVibrationVerificationError('VIBRATION_VERIFICATION_ARRAY_REQUIRED', `${field} must be an array.`, { field });
  }
  return value;
}

function uniqueBy(rows, field, code) {
  const values = rows.map((row) => row[field]);
  if (new Set(values).size !== values.length) {
    throw createVibrationVerificationError(code, `${field} values must be unique.`, { field });
  }
}

function dispositionIndex(dispositions, requirementIds) {
  const byRequirement = new Map();
  for (const disposition of dispositions) {
    if (!requirementIds.has(disposition.requirementId)) {
      throw createVibrationVerificationError(
        'VIBRATION_VERIFICATION_ORPHAN_DISPOSITION',
        'Disposition references a verification requirement outside this project evaluation.',
        { requirementId: disposition.requirementId },
      );
    }
    if (byRequirement.has(disposition.requirementId)) {
      throw createVibrationVerificationError(
        'VIBRATION_VERIFICATION_MULTIPLE_CURRENT_DISPOSITIONS',
        'Project verification projection accepts at most one current disposition per requirement.',
        { requirementId: disposition.requirementId },
      );
    }
    byRequirement.set(disposition.requirementId, disposition);
  }
  return byRequirement;
}

function countStates(results) {
  const counts = {};
  for (const result of results) counts[result.state] = (counts[result.state] ?? 0) + 1;
  return Object.freeze(counts);
}

export function evaluateProjectVibrationVerification(project, input = {}) {
  assertVibrationIntegrityProject(project);
  const requirements = normalizedArray(input.requirements ?? [], 'requirements')
    .map(createVibrationVerificationRequirement);
  const dispositions = normalizedArray(input.dispositions ?? [], 'dispositions')
    .map(createVibrationMeasurementDisposition);
  uniqueBy(requirements, 'requirementId', 'VIBRATION_VERIFICATION_DUPLICATE_REQUIREMENT_ID');
  uniqueBy(dispositions, 'dispositionId', 'VIBRATION_VERIFICATION_DUPLICATE_DISPOSITION_ID');

  const lineIds = new Set(project.subjects.lines.map((line) => String(line.lineId)));
  for (const requirement of requirements) {
    if (!lineIds.has(requirement.scope.lineId)) {
      throw createVibrationVerificationError(
        'VIBRATION_VERIFICATION_DANGLING_PROJECT_LINE',
        'Verification requirement references an unknown project line.',
        { requirementId: requirement.requirementId, lineId: requirement.scope.lineId },
      );
    }
  }

  const requirementIds = new Set(requirements.map((item) => item.requirementId));
  const byRequirement = dispositionIndex(dispositions, requirementIds);
  const measurementEvidence = project.measurementEvidence ?? createEmptyVibrationMeasurementEvidencePackage();
  const results = requirements.map((requirement) => evaluateVibrationVerification({
    requirement,
    measurementEvidence,
    disposition: byRequirement.get(requirement.requirementId) ?? null,
  }));

  return deepFreeze({
    schema: VIBRATION_PROJECT_VERIFICATION_PROJECTION_SCHEMA,
    projectId: project.project?.projectId ?? project.project?.id ?? null,
    requirementCount: requirements.length,
    countsByState: countStates(results),
    results,
    authority: VIBRATION_PROJECT_VERIFICATION_PROJECTION_AUTHORITY,
  });
}
