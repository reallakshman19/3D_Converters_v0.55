import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildVibrationRoadmapMechanismSummary,
  VIBRATION_ROADMAP_MECHANISM_SUMMARY_AUTHORITY,
} from '../tabs/vibration-roadmap-mechanism-summary.js';
import { renderVibrationRoadmapMechanismSummary } from '../tabs/vibration-roadmap-mechanism-summary-view.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDS = Object.freeze([
  'fit', 'mechanicalExcitation', 'reciprocatingPulsation', 'rotatingStall',
  'deadlegPulsation', 'corrugationPulsation', 'slugFlow', 'aiv', 'valveTransients',
  'cavitationFlashing', 'thermowells', 'smallBoreConnections',
]);

function assessment(id, overrides = {}) {
  return Object.freeze({
    mechanism: Object.freeze({ id, label: overrides.label ?? id, title: overrides.title ?? id }),
    implementationState: overrides.implementationState ?? 'NOT_IMPLEMENTED',
    assessmentState: overrides.assessmentState ?? 'NOT_IMPLEMENTED',
    calculated: overrides.calculated ?? false,
    lof: overrides.lof ?? null,
    qualificationState: overrides.qualificationState ?? null,
    resultState: overrides.resultState ?? 'UNRUN',
    resultScope: overrides.resultScope ?? null,
    governingEligible: overrides.governingEligible ?? null,
  });
}

function required(mechanismId, assessmentUnitType, status, reason) {
  return Object.freeze({ mechanismId, assessmentUnitType, status, reason });
}

function identification(mechanismId, assessmentUnitType) {
  return Object.freeze({ mechanismId, assessmentUnitType });
}

function matrix() {
  const assessments = IDS.map((id) => {
    if (id === 'fit') return assessment(id, {
      label: 'FIT', implementationState: 'IMPLEMENTED_SCREENING', assessmentState: 'CALCULATED',
      calculated: true, lof: 0.32, qualificationState: 'SCREENING', resultState: 'CURRENT_RESULT',
    });
    if (id === 'smallBoreConnections') return assessment(id, {
      label: 'SBC', implementationState: 'IMPLEMENTED_CANDIDATE_USER_INPUT',
      assessmentState: 'CALCULATED', calculated: true, lof: 0.7,
      qualificationState: 'CANDIDATE_USER_INPUT', resultState: 'CURRENT_RESULT',
    });
    if (id === 'cavitationFlashing') return assessment(id, { label: 'Cav / flash' });
    if (id === 'thermowells') return assessment(id, { label: 'Thermowells' });
    return assessment(id);
  });
  return Object.freeze({
    assessments: Object.freeze(assessments),
    mechanismCoverage: Object.freeze({
      schema: 'MechanismCoverage.v1',
      required: Object.freeze([
        required('fit', 'MAIN_LINE_SECTION', 'ASSESSMENT_COMPLETE', 'CURRENT_REQUIRED_AUTHORITY_EVIDENCE'),
        required('cavitationFlashing', 'MAIN_LINE_SECTION', 'ASSESSMENT_INCOMPLETE', 'NOT_IMPLEMENTED'),
        required('thermowells', 'INTRUSIVE_ELEMENT', 'ASSESSMENT_INCOMPLETE', 'NOT_IMPLEMENTED'),
        required('smallBoreConnections', 'SBC_CONNECTION', 'ASSESSMENT_INCOMPLETE', 'CANDIDATE_OR_UNQUALIFIED_RESULT'),
      ]),
      notApplicable: Object.freeze([
        identification('mechanicalExcitation', 'MAIN_LINE_SECTION'),
        identification('rotatingStall', 'MAIN_LINE_SECTION'),
        identification('deadlegPulsation', 'DEADLEG_BRANCH'),
        identification('corrugationPulsation', 'SPECIALIST_SYSTEM'),
        identification('valveTransients', 'TRANSIENT_EVENT_PATH'),
      ]),
      unresolved: Object.freeze([identification('reciprocatingPulsation', 'MAIN_LINE_SECTION')]),
      missingIdentificationMechanismIds: Object.freeze(['slugFlow', 'aiv']),
    }),
    assessmentCompleteness: Object.freeze({
      schema: 'AssessmentCompleteness.v1',
      state: 'INCOMPLETE', requiredCount: 4, completeCount: 1, incompleteCount: 3,
      notApplicableCount: 5, unresolvedIdentificationCount: 1, missingIdentificationCount: 2,
    }),
  });
}

function item(summary, mechanismId) {
  return summary.items.find((entry) => entry.mechanismId === mechanismId);
}

function selectedAssessment(summary) {
  return Object.freeze({
    schema: 'VibrationIntegrityRoadmapAssessmentContext.v1',
    rowKey: 'ROW-1',
    mechanismSummary: summary,
    lineCaseAssessmentStatus: Object.freeze({
      schema: 'VibrationLineCaseAssessmentStatus.v1',
      scope: Object.freeze({ line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' }),
      state: 'REQUIRED_ASSESSMENT_INCOMPLETE', nextActionCode: 'COMPLETE_REQUIRED_ASSESSMENTS',
      completeness: Object.freeze({ state: 'INCOMPLETE' }),
      screeningEvidence: Object.freeze({ state: 'CURRENT' }),
      authority: Object.freeze({
        purpose: 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY',
        determinesApplicability: false, determinesCompleteness: false,
      }),
    }),
    authority: Object.freeze({
      purpose: 'SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY',
      determinesApplicability: false, determinesCompleteness: false,
      createsCaseIdentity: false, persistenceAuthority: 'NONE',
    }),
  });
}

function panelProjection(summary) {
  return Object.freeze({
    schema: 'VibrationRoadmapProjection.v1',
    context: Object.freeze({ selectedAssessment: selectedAssessment(summary) }),
    phases: Object.freeze([]), authority: Object.freeze({ purpose: 'VISUAL_NAVIGATION_GUIDANCE_ONLY' }),
  });
}

test('12-mechanism summary preserves governed coverage and fail-closed unavailable states', () => {
  const summary = buildVibrationRoadmapMechanismSummary(matrix());
  assert.equal(summary.items.length, 12);
  assert.deepEqual(summary.counts, {
    total: 12, required: 4, complete: 1, incomplete: 3,
    notApplicable: 5, unresolved: 1, identificationMissing: 2,
  });
  assert.equal(item(summary, 'fit').state, 'ASSESSMENT_COMPLETE');
  assert.equal(item(summary, 'fit').lof, 0.32);
  assert.equal(item(summary, 'rotatingStall').state, 'NOT_APPLICABLE');
  assert.equal(item(summary, 'reciprocatingPulsation').state, 'IDENTIFICATION_UNRESOLVED');
  assert.equal(item(summary, 'slugFlow').state, 'IDENTIFICATION_MISSING');
  assert.equal(item(summary, 'smallBoreConnections').state, 'CANDIDATE_ONLY');
});

test('cavitation and thermowell stay visible as required unavailable work with governed source custody', () => {
  const summary = buildVibrationRoadmapMechanismSummary(matrix());
  const cavitation = item(summary, 'cavitationFlashing');
  const thermowell = item(summary, 'thermowells');
  assert.equal(cavitation.disposition, 'REQUIRED');
  assert.equal(cavitation.state, 'REQUIRED_NOT_IMPLEMENTED');
  assert.equal(cavitation.lof, null);
  assert.equal(cavitation.sourceStatus, 'RECONCILIATION_REQUIRED');
  assert.match(cavitation.sourceLabel, /T2\.9.*reconciliation required/);
  assert.equal(thermowell.disposition, 'REQUIRED');
  assert.equal(thermowell.state, 'REQUIRED_NOT_IMPLEMENTED');
  assert.equal(thermowell.lof, null);
  assert.equal(thermowell.sourceStatus, 'CONFLICTED');
  assert.match(thermowell.sourceLabel, /Source conflict:.*T4.*ASME PTC 19\.3 TW-2016/);
  assert.match(thermowell.sourceReason, /must not be silently combined/);
});

test('right-rail summary is advisory linking and never acts as an execution or authority gate', () => {
  const authority = VIBRATION_ROADMAP_MECHANISM_SUMMARY_AUTHORITY;
  assert.equal(authority.guidanceOnly, true);
  assert.equal(authority.determinesApplicability, false);
  assert.equal(authority.determinesCompleteness, false);
  assert.equal(authority.blocksExecution, false);
  assert.equal(authority.blocksNavigation, false);
  assert.equal(authority.blocksCalculation, false);
  assert.equal(authority.blocksPersistence, false);
  assert.equal(authority.authorityGate, false);
  assert.equal(authority.numericalAuthority, 'NONE');
  assert.equal(authority.aggregationAuthority, 'NONE');
  assert.equal(authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('right-rail rendering labels unavailable methods as guidance, not a UI blocker', () => {
  const summary = buildVibrationRoadmapMechanismSummary(matrix());
  const html = renderVibrationRoadmapMechanismSummary(summary);
  assert.match(html, /Mechanism guidance/);
  assert.match(html, /12-mechanism scope · guidance only/);
  assert.match(html, /Cav \/ flash/);
  assert.match(html, /T2\.9 · reconciliation required/);
  assert.match(html, /Thermowells/);
  assert.match(html, /Source conflict:/);
  assert.match(html, /Method unavailable/);
  assert.match(html, /Advisory\/linking only/);
  assert.match(html, /do not block execution, navigation, calculation, or persistence/);
  assert.match(html, /data-guidance-only="true"/);
  assert.doesNotMatch(html, /Source\/method blocked/);
  assert.doesNotMatch(html, /LOF 0 ·/);
  assert.doesNotMatch(html, /disabled/);
});

test('right panel includes mechanism guidance only beneath a governed selected exact scope', () => {
  const summary = buildVibrationRoadmapMechanismSummary(matrix());
  const html = renderVibrationRoadmapPanel(panelProjection(summary));
  assert.match(html, /Selected assessment/);
  assert.match(html, /Mechanism guidance/);
  const ungoverned = { ...selectedAssessment(summary), authority: undefined };
  const hidden = renderVibrationRoadmapPanel(Object.freeze({
    ...panelProjection(summary), context: Object.freeze({ selectedAssessment: ungoverned }),
  }));
  assert.doesNotMatch(hidden, /Mechanism guidance/);
});

test('bridge consumes matrix rather than static catalogue status', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tabs/vibration-integrity-roadmap-bridge.js'), 'utf8');
  assert.match(source, /buildVibrationMechanismMatrixRow/);
  assert.match(source, /mechanismSummary:\s*buildVibrationRoadmapMechanismSummary\(projection\.matrix\)/);
  assert.doesNotMatch(source, /determinesApplicability:\s*true/);
  assert.doesNotMatch(source, /determinesCompleteness:\s*true/);
});
