import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildSbcWorkspaceProjection,
  createSbcWorkspaceUiState,
  setSbcWorkspaceScope,
  setSbcWorkspaceType,
} from '../tabs/vibration-integrity-sbc-workspace-model.js';
import { renderSbcConnectionWorkspace } from '../tabs/vibration-integrity-sbc-workspace-view.js';
import { VIBRATION_INTEGRITY_UI_CONTRACT } from '../tabs/vibration-integrity-ui-contract.js';

const TYPE_IDS = ['TYPE_1', 'TYPE_2', 'TYPE_3', 'TYPE_4'];

function state(overrides = {}) {
  return {
    ...createSbcWorkspaceUiState(),
    sbcType3ScopeId: '',
    userEngineeringData: { rows: [] },
    ...overrides,
  };
}

test('workspace projection exposes the governed four-type vertical without authority promotion', () => {
  const projection = buildSbcWorkspaceProjection(state());
  assert.equal(projection.calculationId, 'VIB.SBC.SMALL_BORE');
  assert.equal(projection.assessmentUnitType, 'SBC_CONNECTION');
  assert.equal(projection.lifecycleState, 'RESERVED');
  assert.equal(projection.explicitTypeConfirmationRequired, true);
  assert.equal(projection.automaticClassificationAllowed, false);
  assert.deepEqual(projection.types.map((item) => item.typeId), TYPE_IDS);
  assert.equal(projection.authority.screeningAuthority, 'NOT_AUTHORIZED_FOR_FULL_VERTICAL');
  assert.equal(projection.authority.designAuthority, false);
});

test('every type remains non-executable and requires independent benchmark evidence', () => {
  const projection = buildSbcWorkspaceProjection(state());
  for (const type of projection.types) {
    assert.equal(type.lifecycleState, 'RESERVED');
    assert.equal(type.executionAllowed, false);
    assert.equal(type.numericalExecutionAllowed, false);
    assert.equal(type.automaticClassificationAllowed, false);
    assert.equal(type.independentBenchmarkRequired, true);
  }
});

test('main-line dependency rejects FIT-only authority', () => {
  const projection = buildSbcWorkspaceProjection(state());
  assert.equal(projection.mainLineRequirement.sourceContract, 'QUALIFIED_EI_MAIN_LINE_ASSESSMENT');
  assert.equal(projection.mainLineRequirement.fitOnlyAccepted, false);
  assert.equal(projection.mainLineRequirement.assessmentCompletenessRequired, true);
});

test('Type 3 remains visibly quarantined while other types do not inherit its curve blocker', () => {
  const projection = buildSbcWorkspaceProjection(state());
  const type3 = projection.types.find((item) => item.typeId === 'TYPE_3');
  assert.equal(type3.curveQuarantine, true);
  assert.equal(type3.blockedBy.includes('SBC_T3_CURVES_BLOCKED_SOURCE_DATA_CONFLICT'), true);
  for (const type of projection.types.filter((item) => item.typeId !== 'TYPE_3')) {
    assert.equal(type.curveQuarantine, false);
  }
});

test('type and connection scope selection remain explicit UI state', () => {
  const ui = state();
  assert.equal(setSbcWorkspaceScope(ui, 'LINE-10/CASE-A/SBC-01'), 'LINE-10/CASE-A/SBC-01');
  assert.equal(setSbcWorkspaceType(ui, 'type_2'), 'TYPE_2');
  const projection = buildSbcWorkspaceProjection(ui);
  assert.equal(projection.scopeId, 'LINE-10/CASE-A/SBC-01');
  assert.equal(projection.selectedType, 'TYPE_2');
  assert.equal(projection.explicitTypeConfirmationRequired, false);
  assert.equal(projection.types.find((item) => item.typeId === 'TYPE_2').selected, true);
});

test('workspace UI presents all types and only reveals Type-3 candidate controls after explicit selection', () => {
  const emptyHtml = renderSbcConnectionWorkspace(state());
  for (const typeId of TYPE_IDS) assert.match(emptyHtml, new RegExp(`data-vi-sbc-workspace-type="${typeId}"`, 'u'));
  assert.match(emptyHtml, /Explicit SBC type confirmation required/u);
  assert.match(emptyHtml, /FIT-only accepted[\s\S]*NO/u);
  assert.doesNotMatch(emptyHtml, /SBC Type-3 · facility candidate assessment/u);

  const type1Html = renderSbcConnectionWorkspace(state({ sbcWorkspaceType: 'TYPE_1' }));
  assert.match(type1Html, /TYPE 1 · qualification readiness/u);
  assert.match(type1Html, /Numerical execution blocked by qualification gates/u);
  assert.doesNotMatch(type1Html, /SBC Type-3 · facility candidate assessment/u);

  const type3Html = renderSbcConnectionWorkspace(state({ sbcWorkspaceType: 'TYPE_3' }));
  assert.match(type3Html, /TYPE-3 CURVE SOURCE CONFLICT/u);
  assert.match(type3Html, /SBC Type-3 · facility candidate assessment/u);
  assert.match(type3Html, /NOT SCREENING AUTHORITY/u);
});

test('SBC has a dedicated workspace tab and facility actions route to it', async () => {
  assert.equal(VIBRATION_INTEGRITY_UI_CONTRACT.workspaceTabs.some((tab) => tab.id === 'sbc'), true);
  const shell = await readFile(new URL('../tabs/vibration-integrity-user-data-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /state\.workspaceTab = 'sbc'/u);
  assert.match(shell, /setSbcWorkspaceType\(state, 'TYPE_3'\)/u);
  assert.match(shell, /renderSbcConnectionWorkspace/u);
  const userDataPage = shell.match(/function userDataPage[\s\S]*?function identificationPage/u)?.[0] ?? '';
  assert.doesNotMatch(userDataPage, /renderSbcType3UserInputPanel/u);
});
