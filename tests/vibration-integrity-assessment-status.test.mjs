import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY,
  buildVibrationLineCaseAssessmentStatus,
} from '../tabs/vibration-integrity-assessment-status.js';

const scope = Object.freeze({ line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' });

function completeness(overrides = {}) {
  return {
    schema: 'AssessmentCompleteness.v1',
    state: 'INCOMPLETE',
    requiredCount: 0,
    completeCount: 0,
    incompleteCount: 0,
    notApplicableCount: 0,
    unresolvedIdentificationCount: 0,
    missingIdentificationCount: 12,
    missingIdentificationMechanismIds: ['fit'],
    missingRequiredAssessmentIds: [],
    reasons: ['IDENTIFICATION_EVIDENCE_MISSING'],
    coverageId: 'coverage-1',
    ...overrides,
  };
}

function matrix(overrides = {}) {
  return {
    assessmentCompleteness: completeness(),
    screeningGoverning: null,
    retainedScreeningGoverning: null,
    candidateGoverning: null,
    retainedCandidateGoverning: null,
    ...overrides,
  };
}

function row(status, errors = []) {
  return {
    ...scope,
    mechanismIdentificationEvidenceStatus: status,
    mechanismIdentificationEvidenceErrors: errors,
  };
}

function assessment(id, lof, resultState = 'CURRENT_RESULT', qualificationState = 'SCREENING') {
  return {
    mechanism: { id, label: id.toUpperCase() },
    lof,
    resultState,
    qualificationState,
  };
}

test('missing, incomplete and invalid T1 authoring remain distinct workflow states', () => {
  const missing = buildVibrationLineCaseAssessmentStatus({ row: row('MISSING'), matrix: matrix() });
  const incomplete = buildVibrationLineCaseAssessmentStatus({
    row: row('INCOMPLETE', ['T1-ID-0001:SOURCEID_REQUIRED']), matrix: matrix(),
  });
  const invalid = buildVibrationLineCaseAssessmentStatus({
    row: row('INVALID', ['T1-ID-0001:UNKNOWN_DISPOSITION']), matrix: matrix(),
  });

  assert.equal(missing.state, 'IDENTIFICATION_MISSING');
  assert.equal(missing.nextActionCode, 'AUTHOR_T1_IDENTIFICATION');
  assert.equal(incomplete.state, 'IDENTIFICATION_INCOMPLETE');
  assert.equal(incomplete.identificationEvidence.errors.length, 1);
  assert.equal(invalid.state, 'IDENTIFICATION_INVALID');
  assert.equal(invalid.nextActionCode, 'CORRECT_T1_IDENTIFICATION_EVIDENCE');
});

test('ready authored evidence with missing mechanism dispositions stays identification-incomplete', () => {
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        missingIdentificationCount: 2,
        missingIdentificationMechanismIds: ['rotatingStall', 'thermowells'],
        reasons: [
          'MISSING_MECHANISM_IDENTIFICATION:rotatingStall',
          'MISSING_MECHANISM_IDENTIFICATION:thermowells',
        ],
      }),
    }),
  });

  assert.equal(status.state, 'IDENTIFICATION_COVERAGE_INCOMPLETE');
  assert.equal(status.nextActionCode, 'AUTHOR_MISSING_MECHANISM_IDENTIFICATIONS');
  assert.deepEqual(status.completeness.missingIdentificationMechanismIds, ['rotatingStall', 'thermowells']);
});

test('ready evidence with unresolved governed dispositions remains IDENTIFICATION_UNRESOLVED', () => {
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        missingIdentificationCount: 0,
        missingIdentificationMechanismIds: [],
        unresolvedIdentificationCount: 1,
        reasons: ['UNRESOLVED_MECHANISM_IDENTIFICATION'],
      }),
    }),
  });

  assert.equal(status.state, 'IDENTIFICATION_UNRESOLVED');
  assert.equal(status.nextActionCode, 'RESOLVE_T1_IDENTIFICATION_DISPOSITIONS');
});

test('ready identification plus incomplete required coverage maps to required-assessment work', () => {
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        requiredCount: 3,
        completeCount: 1,
        incompleteCount: 2,
        missingIdentificationCount: 0,
        missingIdentificationMechanismIds: [],
        missingRequiredAssessmentIds: ['assessment-a', 'assessment-b'],
        reasons: ['fit:STALE_RESULT', 'mechanicalExcitation:NOT_EVALUATED'],
      }),
    }),
  });

  assert.equal(status.state, 'REQUIRED_ASSESSMENT_INCOMPLETE');
  assert.equal(status.nextActionCode, 'COMPLETE_REQUIRED_ASSESSMENTS');
  assert.deepEqual(status.completeness.missingRequiredAssessmentIds, ['assessment-a', 'assessment-b']);
});

test('AssessmentCompleteness COMPLETE is consumed as completeness-only status, not acceptance authority', () => {
  const current = assessment('fit', 0.42);
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        state: 'COMPLETE',
        requiredCount: 1,
        completeCount: 1,
        incompleteCount: 0,
        missingIdentificationCount: 0,
        missingIdentificationMechanismIds: [],
        reasons: [],
      }),
      screeningGoverning: current,
      retainedScreeningGoverning: current,
    }),
  });

  assert.equal(status.state, 'ASSESSMENT_COMPLETE');
  assert.equal(status.completeness.state, 'COMPLETE');
  assert.equal(status.screeningEvidence.state, 'CURRENT');
  assert.equal(status.screeningEvidence.current.lof, 0.42);
  assert.equal(status.authority.engineeringAuthority, 'NONE');
  assert.equal(status.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(status.authority.designAuthority, false);
  assert.equal(status.authority.safetyAuthority, false);
});

test('evidenced not-applicable is consumed from AssessmentCompleteness without inference', () => {
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        state: 'NOT_APPLICABLE',
        notApplicableCount: 12,
        missingIdentificationCount: 0,
        missingIdentificationMechanismIds: [],
        reasons: [],
      }),
    }),
  });

  assert.equal(status.state, 'NOT_APPLICABLE');
  assert.equal(status.nextActionCode, 'REVIEW_NOT_APPLICABLE_EVIDENCE');
  assert.equal(status.authority.determinesApplicability, false);
});

test('stale retained screening evidence remains visibly non-current', () => {
  const retained = assessment('fit', 0.7, 'STALE_RESULT');
  const status = buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: matrix({
      assessmentCompleteness: completeness({
        requiredCount: 1,
        incompleteCount: 1,
        missingIdentificationCount: 0,
        missingIdentificationMechanismIds: [],
        reasons: ['fit:STALE_RESULT'],
      }),
      retainedScreeningGoverning: retained,
    }),
  });

  assert.equal(status.screeningEvidence.state, 'STALE_RETAINED');
  assert.equal(status.screeningEvidence.current, null);
  assert.equal(status.screeningEvidence.retained.resultState, 'STALE_RESULT');
});

test('missing resolver state and malformed completeness fail closed', () => {
  const unavailable = buildVibrationLineCaseAssessmentStatus({ row: scope, matrix: matrix() });
  assert.equal(unavailable.state, 'IDENTIFICATION_STATUS_UNAVAILABLE');
  assert.equal(unavailable.nextActionCode, 'RESTORE_IDENTIFICATION_RESOLUTION');

  assert.throws(() => buildVibrationLineCaseAssessmentStatus({
    row: row('READY'),
    matrix: { assessmentCompleteness: { schema: 'Wrong.v1', state: 'COMPLETE' } },
  }), /AssessmentCompleteness\.v1/);
});

test('status authority is projection-only and cannot become a parallel engineering authority', () => {
  assert.equal(VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY.determinesCompleteness, false);
  assert.equal(VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY.createsIdentificationEvidence, false);
  assert.equal(VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY.numericalAuthority, 'NONE');
  assert.equal(VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY.codeCompliance, false);
});
