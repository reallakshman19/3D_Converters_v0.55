export const VIBRATION_WORKSPACE_NAVIGATION_AUTHORITY = Object.freeze({
  purpose: 'RIGHT_RAIL_WORKSPACE_NAVIGATION_ONLY',
  nextActionSource: 'VibrationLineCaseAssessmentStatus.v1',
  determinesNextAction: false,
  determinesApplicability: false,
  determinesCompleteness: false,
  createsCaseIdentity: false,
  persistenceAuthority: 'NONE',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
});

const IDENTIFICATION_ACTIONS = new Set([
  'RESTORE_IDENTIFICATION_RESOLUTION',
  'AUTHOR_T1_IDENTIFICATION',
  'COMPLETE_T1_IDENTIFICATION_EVIDENCE',
  'CORRECT_T1_IDENTIFICATION_EVIDENCE',
  'AUTHOR_MISSING_MECHANISM_IDENTIFICATIONS',
  'RESOLVE_T1_IDENTIFICATION_DISPOSITIONS',
  'REVIEW_NOT_APPLICABLE_EVIDENCE',
]);

const SCREENING_ACTIONS = new Set([
  'COMPLETE_REQUIRED_ASSESSMENTS',
  'REVIEW_ASSESSMENT_GAPS',
  'REVIEW_COMPLETE_ASSESSMENT_EVIDENCE',
]);

export function resolveVibrationCaseActionWorkspace(nextActionCode) {
  const actionCode = String(nextActionCode ?? '').trim();
  if (IDENTIFICATION_ACTIONS.has(actionCode)) {
    return Object.freeze({ actionCode, workspaceId: 'identification' });
  }
  if (SCREENING_ACTIONS.has(actionCode)) {
    return Object.freeze({ actionCode, workspaceId: 'screening' });
  }
  return null;
}
