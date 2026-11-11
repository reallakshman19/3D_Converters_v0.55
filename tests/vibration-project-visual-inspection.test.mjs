import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProjectVibrationVisualInspection } from '../converters/vibration/project/visual-inspection.js';

const SNAP = `sha256:${'c'.repeat(64)}`;
const scope = Object.freeze({ lineId: 'L-1', caseId: 'NORMAL', operatingCaseSnapshotId: 'OCS-1', operatingCaseSnapshotHash: SNAP });

function project() {
  return {
    schema: 'VibrationIntegrityProject.v1', project: { projectId: 'P-1' },
    subjects: { lines: [{ lineId: 'L-1' }] }, mechanismImports: [], currentResults: [], measurements: [],
    authority: {
      containerAuthority: 'PERSISTENCE_CONTAINER_ONLY', importedResultsAreCurrentEngineeringAuthority: false,
      screeningAuthorized: false, designAuthority: false, rootCauseAuthority: false,
      measurementEvidenceIsCurrentEngineeringAuthority: false,
    },
  };
}

function evidence(lineId = 'L-1', state = 'OBSERVED') {
  return {
    schema: 'VibrationVisualInspectionEvidencePackage.v1',
    records: [{
      inspectionId: 'VI-1', scope: { ...scope, lineId }, inspectedAt: '2026-08-19T10:00:00Z',
      inspector: { inspectorId: 'inspector-1' },
      subject: { subjectType: 'SMALL_BORE_CONNECTION', subjectId: 'SBC-1' },
      observations: [{ observationId: 'OBS-1', code: 'SMALL_BORE_RELATIVE_MOTION', state, note: state === 'OBSERVED' ? 'Relative motion observed.' : null }],
      evidenceRefs: [], source: { source: 'FIELD-WALKDOWN', sourceRevision: 'REV-A', recordId: 'VI-1' },
    }],
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('project projection reports exact-scope visual review state', () => {
  const value = evaluateProjectVibrationVisualInspection(project(), evidence());
  assert.equal(value.schema, 'VibrationProjectVisualInspectionProjection.v1');
  assert.equal(value.inspectionCount, 1);
  assert.equal(value.scopeCount, 1);
  assert.equal(value.results[0].state, 'OBSERVED_CONDITIONS_REQUIRE_REVIEW');
  assert.equal(value.countsByState.OBSERVED_CONDITIONS_REQUIRE_REVIEW, 1);
});

test('visual record cannot reference unknown project line', () => {
  expectCode(() => evaluateProjectVibrationVisualInspection(project(), evidence('L-X')), 'VIBRATION_VISUAL_DANGLING_PROJECT_LINE');
});

test('project projection does not mutate project or claim persistence/engineering authority', () => {
  const source = project();
  const before = JSON.stringify(source);
  const value = evaluateProjectVibrationVisualInspection(source, evidence('L-1', 'NOT_OBSERVED'));
  assert.equal(JSON.stringify(source), before);
  assert.equal(value.authority.persistsVisualInspectionState, false);
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(value.authority.rootCauseAuthority, false);
  assert.equal(value.authority.eiChecklistCoverage, 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE');
});
