import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSbcConnectionAuthoringProjection,
  createSbcConnectionAuthoringStore,
  updateSbcConnectionAuthoringEvidenceRef,
  updateSbcConnectionAuthoringValue,
} from '../tabs/vibration-integrity-sbc-connection-model.js';
import { renderSbcConnectionAuthoringPanel } from '../tabs/vibration-integrity-sbc-connection-view.js';

function applyFields(store, scope, typeId, values, evidence = true) {
  let next = store;
  for (const [path, value] of Object.entries(values)) {
    next = updateSbcConnectionAuthoringValue(next, scope, typeId, path, value);
    if (evidence) {
      next = updateSbcConnectionAuthoringEvidenceRef(
        next, scope, typeId, path, `PROJECT-EVIDENCE:${scope}:${path}`,
      );
    }
  }
  return next;
}

const COMMON = Object.freeze({
  connectionId: 'SBC-C-001',
  'operatingScenario.scenarioId': 'NORMAL-001',
  'mainLineAssessment.assessmentId': 'EI-MAINLINE-001',
  'mainLineAssessment.sourceContract': 'QUALIFIED_EI_MAIN_LINE_ASSESSMENT',
  'geometry.minimumNominalDiameter': '1.5',
  'attachments.fittings': 'Weldolet',
  'attachments.valves': 'Valve-1',
  locationContext: 'Upper deck / project survey record',
});

const TYPE1 = Object.freeze({
  ...COMMON,
  'topology.topologyKind': 'CANTILEVER_SINGLE_PARENT',
  'topology.parentConnectionCount': '1',
  'topology.parentLineIds': 'ML-100',
  'geometry.overallBranchLength': '900',
});

const TYPE2 = Object.freeze({
  ...COMMON,
  connectionId: 'SBC-C-002',
  'topology.topologyKind': 'LOOP_BYPASS_SAME_MAIN_LINE',
  'topology.parentConnectionCount': '2',
  'topology.parentLineIds': 'ML-200, ML-200',
  'topology.returnsToSameMainLine': 'TRUE',
  'geometry.branchLegs': '450, 525',
});

const TYPE4 = Object.freeze({
  ...COMMON,
  connectionId: 'SBC-C-004',
  'topology.topologyKind': 'BRIDGE_DISTINCT_PARENT_LINES',
  'topology.parentConnectionCount': '2',
  'topology.parentLineIds': 'ML-400A, ML-400B',
  'topology.bridgesDistinctMainLines': 'TRUE',
  'geometry.endLegs': '600, 650',
  'geometry.bridgeSpan': '1250',
});

test('Type 1 can become structurally and project-evidence complete without gaining numerical authority', () => {
  const scope = 'LINE-100/CASE-NORMAL/SBC-C-001';
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', TYPE1);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');

  assert.equal(projection.status, 'STRUCTURE_AND_PROJECT_EVIDENCE_COMPLETE_NOT_QUALIFIED');
  assert.equal(projection.structuralValidation.structureComplete, true);
  assert.equal(projection.projectEvidenceComplete, true);
  assert.equal(projection.qualificationEstablished, false);
  assert.equal(projection.numericalExecutionAllowed, false);
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
  assert.equal(projection.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(projection.authority.designAuthority, false);
  assert.equal(projection.structuralInput.declaredSbcType, 'TYPE_1');
  assert.equal(projection.structuralInput.geometry.overallBranchLength, 900);
});

test('Type 1 structural completeness does not substitute for project evidence custody', () => {
  const scope = 'LINE-101/CASE-NORMAL/SBC-C-001';
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', TYPE1, false);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');

  assert.equal(projection.structuralValidation.structureComplete, true);
  assert.equal(projection.projectEvidenceComplete, false);
  assert.equal(projection.status, 'STRUCTURE_COMPLETE_PROJECT_EVIDENCE_INCOMPLETE');
  assert.equal(projection.missingEvidenceRefs.length, projection.fields.length);
});

test('FIT-only main-line input remains fail-closed even when every field and evidence ref is present', () => {
  const scope = 'LINE-102/CASE-NORMAL/SBC-C-001';
  const values = { ...TYPE1, 'mainLineAssessment.sourceContract': 'FIT_LOF_ONLY' };
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', values);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');

  assert.equal(projection.structuralValidation.structureComplete, false);
  assert.ok(projection.structuralValidation.problems.includes('SBC_MAIN_LINE_FIT_ONLY_NOT_ACCEPTED'));
  assert.ok(projection.structuralValidation.problems.includes('SBC_MAIN_LINE_SOURCE_CONTRACT_NOT_DECLARED'));
  assert.equal(projection.numericalExecutionAllowed, false);
});

test('Type 2 same-main-line topology is explicit and contradictory parent lines fail closed', () => {
  const scope = 'LINE-200/CASE-NORMAL/SBC-C-002';
  let store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_2', TYPE2);
  let projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_2');
  assert.equal(projection.structuralValidation.structureComplete, true);
  assert.deepEqual(projection.structuralInput.topology.parentLineIds, ['ML-200', 'ML-200']);
  assert.deepEqual(projection.structuralInput.geometry.branchLegs, [450, 525]);

  store = updateSbcConnectionAuthoringValue(
    store, scope, 'TYPE_2', 'topology.parentLineIds', 'ML-200, ML-201',
  );
  projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_2');
  assert.equal(projection.structuralValidation.structureComplete, false);
  assert.ok(projection.structuralValidation.problems.includes('PARENT_LINE_RELATIONSHIP_NOT_CONFIRMED'));
});

test('Type 4 distinct-main-line bridge can be authored without inferring any numerical rule', () => {
  const scope = 'LINE-400/CASE-NORMAL/SBC-C-004';
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_4', TYPE4);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_4');

  assert.equal(projection.status, 'STRUCTURE_AND_PROJECT_EVIDENCE_COMPLETE_NOT_QUALIFIED');
  assert.equal(projection.structuralValidation.structureComplete, true);
  assert.deepEqual(projection.structuralInput.topology.parentLineIds, ['ML-400A', 'ML-400B']);
  assert.deepEqual(projection.structuralInput.geometry.endLegs, [600, 650]);
  assert.equal(projection.structuralInput.geometry.bridgeSpan, 1250);
  assert.equal(projection.numericalExecutionAllowed, false);
});

test('invalid physical syntax is not injected into the structural input', () => {
  const scope = 'LINE-103/CASE-NORMAL/SBC-C-001';
  const values = { ...TYPE1, 'geometry.overallBranchLength': 'not-a-number' };
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', values);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');

  assert.equal(projection.status, 'INVALID_PROJECT_INPUT');
  assert.ok(projection.syntaxErrors.includes('geometry.overallBranchLength:POSITIVE_NUMBER_REQUIRED'));
  assert.equal(Object.hasOwn(projection.structuralInput.geometry, 'overallBranchLength'), false);
  assert.ok(projection.structuralValidation.missingFields.includes('geometry.overallBranchLength'));
});

test('missing fields remain missing; authoring never manufactures engineering defaults', () => {
  const scope = 'LINE-104/CASE-NORMAL/SBC-C-001';
  const store = applyFields(
    createSbcConnectionAuthoringStore(), scope, 'TYPE_1',
    Object.fromEntries(Object.entries(TYPE1).filter(([path]) => path !== 'attachments.valves')),
  );
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');

  assert.equal(projection.structuralValidation.structureComplete, false);
  assert.ok(projection.structuralValidation.missingFields.includes('attachments.valves'));
  assert.equal(projection.fields.find((field) => field.path === 'attachments.valves').rawValue, '');
});

test('existing SBC-UNIT semantic provenance is attached without promoting it to numerical authority', () => {
  const scope = 'LINE-105/CASE-NORMAL/SBC-C-001';
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', TYPE1);
  const projection = buildSbcConnectionAuthoringProjection(store, scope, 'TYPE_1');
  const length = projection.fields.find((field) => field.path === 'geometry.overallBranchLength');

  assert.equal(length.semanticTrace.traceId, 'SBC-UNIT-002');
  assert.equal(length.nativeUnit, 'mm');
  assert.equal(length.semanticTrace.engineeringQualificationEstablished, false);
  assert.equal(length.semanticTrace.numericalMethodUseAllowed, false);
  assert.equal(length.semanticTrace.engineeringDefaultAllowed, false);
});

test('Type 3 generic panel creates no second input authority', () => {
  const html = renderSbcConnectionAuthoringPanel({
    sbcWorkspaceScopeId: 'LINE-300/CASE-NORMAL/SBC-C-003',
    sbcConnectionAuthoringStore: createSbcConnectionAuthoringStore(),
  }, 'TYPE_3');

  assert.match(html, /NO SECOND INPUT AUTHORITY/u);
  assert.match(html, /existing Type-3 candidate panel/u);
  assert.doesNotMatch(html, /data-vi-sbc-connection-field=/u);
  assert.doesNotMatch(html, /data-vi-sbc-connection-evidence=/u);
});

test('Type 1 authoring UI exposes evidence custody and never enables execution', () => {
  const scope = 'LINE-106/CASE-NORMAL/SBC-C-001';
  const store = applyFields(createSbcConnectionAuthoringStore(), scope, 'TYPE_1', TYPE1);
  const html = renderSbcConnectionAuthoringPanel({
    sbcWorkspaceScopeId: scope,
    sbcConnectionAuthoringStore: store,
  }, 'TYPE_1');

  assert.match(html, /connection project evidence/u);
  assert.match(html, /SBC-UNIT-002/u);
  assert.match(html, /PROJECT INPUT/u);
  assert.match(html, /Numerical SBC execution unavailable/u);
  assert.match(html, /disabled/u);
  assert.doesNotMatch(html, /screening authority[^<]*authorized/iu);
});
