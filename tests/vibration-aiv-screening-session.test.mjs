import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIV_SCREENING_SESSION_SCHEMA,
  clearCurrentAivScreeningSession,
  getCurrentAivScreeningSession,
  publishCurrentAivScreeningSession,
} from '../tabs/vibration-aiv-screening-session.js';

function screeningResult(overrides = {}) {
  return {
    ok: true,
    calculationId: 'VIB.AIV.ACOUSTIC',
    outputs: { screeningResultScope: 'ASSESSMENT', assessmentResults: [] },
    assessment: {
      resultScope: 'ASSESSMENT_SCREENING',
      screeningAuthority: 'AUTHORIZED',
      lineCaseSummaryAuthoritativeForScreening: false,
      designAuthority: false,
      ...overrides,
    },
  };
}

test('AIV session stores only current assessment-scope screening evidence', () => {
  clearCurrentAivScreeningSession();
  const session = publishCurrentAivScreeningSession(screeningResult(), { inputRevision: 7 });
  assert.equal(session.schema, AIV_SCREENING_SESSION_SCHEMA);
  assert.equal(session.resultState, 'CURRENT_RESULT');
  assert.equal(session.inputRevision, 7);
  assert.equal(session.authority.lineCaseAggregationAuthority, false);
  assert.equal(session.authority.designAuthority, false);
  assert.equal(getCurrentAivScreeningSession(), session);
  clearCurrentAivScreeningSession();
  assert.equal(getCurrentAivScreeningSession(), null);
});

test('session bridge rejects any result that promotes line summary or design authority', () => {
  clearCurrentAivScreeningSession();
  assert.throws(
    () => publishCurrentAivScreeningSession(screeningResult({ lineCaseSummaryAuthoritativeForScreening: true })),
    /AIV_SCREENING_SESSION_AUTHORITY_INVALID/u,
  );
  assert.throws(
    () => publishCurrentAivScreeningSession(screeningResult({ designAuthority: true })),
    /AIV_SCREENING_SESSION_AUTHORITY_INVALID/u,
  );
  assert.equal(getCurrentAivScreeningSession(), null);
});
