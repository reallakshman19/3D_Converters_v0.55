import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { VIBRATION_AIV_ENGINEERING_CALCULATION_DEFINITION as aiv } from '../converters/engineering-calculations/adapters/vibration-aiv.js';
import { VIBRATION_FIT_ENGINEERING_CALCULATION_DEFINITION as fit } from '../converters/engineering-calculations/adapters/vibration-fit.js';
import { PENDING_ENGINEERING_CALCULATION_DEFINITIONS } from '../converters/engineering-calculations/pending-definitions.js';
import { composeEngineeringQualification } from '../converters/engineering-calculations/qualification.js';
import {
  canExecuteEngineeringCalculation,
  canResolveEngineeringCalculation,
  createEngineeringConsoleDraft,
  isEngineeringCalculationExecutable,
} from '../tabs/engineering-calculation-console-model.js';
import { renderEngineeringCalculationConsoleHtml } from '../tabs/engineering-calculation-console-view.js';

const controllerSource = fs.readFileSync(new URL('../tabs/engineering-calculations-tab.js', import.meta.url), 'utf8');
const blockedVibrationDefinitions = PENDING_ENGINEERING_CALCULATION_DEFINITIONS.filter((row) => row.family === 'VIB');
const definitions = [fit, aiv, ...blockedVibrationDefinitions].sort((left, right) => left.id.localeCompare(right.id));
const families = [{ id: 'VIB', label: 'Vibration & Dynamic Screening', count: definitions.length }];

function baseState(definition = fit) {
  return {
    selectedFamily: 'VIB', selectedId: definition.id, familyLanding: null,
    draft: createEngineeringConsoleDraft(definition), mode: 'single', qualificationMode: 'screening',
    activeView: isEngineeringCalculationExecutable(definition) ? 'results' : 'basis',
    editorErrors: [], validation: null, resolution: null, result: null,
    batchText: '[]', batchResult: null, batchError: null,
  };
}

function buttonTag(html, action) {
  const match = html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`, 'u'));
  assert(match, `missing ${action}`);
  return match[0];
}

test('FIT production lifecycle remains bounded SCREENING engineering authority', () => {
  assert.equal(isEngineeringCalculationExecutable(fit), true);
  assert.equal(canResolveEngineeringCalculation(fit), true);
  assert.equal(canExecuteEngineeringCalculation(fit, 'strict'), false);
  assert.equal(canExecuteEngineeringCalculation(fit, 'benchmark'), false);
  assert.equal(canExecuteEngineeringCalculation(fit, 'screening'), true);
  assert.equal(fit.ui.productSurface, 'VIBRATION_INTEGRITY_TABLE_WORKSPACE');
  assert.equal(fit.ui.lifecycleState, 'PRODUCTION');
  assert.equal(fit.authority.qualificationState, 'PRODUCTION_AUTHORIZED');
  assert.equal(fit.authority.engineeringAuthority, 'SCREENING');
  assert.equal(fit.authority.screeningAuthority, 'AUTHORIZED_BOUNDED');
  assert.equal(fit.authority.designAuthority, false);
  assert.equal(fit.authority.codeCompliance, false);

  const composed = composeEngineeringQualification({
    method: 'PRODUCTION_AUTHORIZED', data: 'SCREENING', designAuthority: true,
  });
  assert.equal(composed.effective, 'SCREENING');
  assert.equal(composed.designAuthority, false);
});

test('VIB family shows FIT production, AIV screening and four blocked mechanisms', () => {
  assert.equal(definitions.length, 6);
  assert.equal(blockedVibrationDefinitions.length, 4);
  const state = { ...baseState(), selectedId: null, familyLanding: 'VIB' };
  const html = renderEngineeringCalculationConsoleHtml({ definitions, families, definition: fit, state });
  assert.match(html, /Vibration &amp; Dynamic Screening/u);
  assert.match(html, /6 mechanisms · 4 blocked/u);
  assert.match(html, /Flow-Induced Vibration Screening/u);
  assert.match(html, />PRODUCTION</u);
  assert.match(html, /Programme #429/u);
  assert.match(html, /Screening authority: BOUNDED/u);
  assert.match(html, /Acoustic-Induced Vibration/u);
  assert.match(html, />SCREENING</u);
  assert.match(html, /2 mechanisms currently carry registered SCREENING authority/u);
  assert.equal((html.match(/>BLOCKED</gu) ?? []).length, 4);
  assert.match(html, /Open FIT workspace/u);
  assert.match(html, /Open AIV qualification workspace/u);
});

test('selecting FIT renders production bounded-screening table workspace', () => {
  const html = renderEngineeringCalculationConsoleHtml({
    definitions, families, definition: fit, state: baseState(fit),
  });
  assert.match(html, /TABLE WORKSPACE/u);
  assert.match(html, /PRODUCTION/u);
  assert.match(html, /BOUNDED SCREENING/u);
  assert.match(html, /data-fit-workspace-host/u);
  assert.doesNotMatch(html, /data-action="calculate"/u);
  assert.doesNotMatch(html, /data-action="add-current-batch"/u);
  assert.match(controllerSource, /await import\('\.\/vibration-integrity-tab\.js\?v=[^']+'\)/u);
  assert.match(controllerSource, /definition\.id !== FIT_CALCULATION_ID/u);
});

test('AIV remains a separate executable SCREENING qualification workspace', () => {
  assert.equal(isEngineeringCalculationExecutable(aiv), true);
  assert.equal(canExecuteEngineeringCalculation(aiv, 'screening'), true);
  assert.equal(aiv.authority.qualificationState, 'SCREENING');
  const html = renderEngineeringCalculationConsoleHtml({
    definitions, families, definition: aiv, state: baseState(aiv),
  });
  assert.match(html, /QUALIFICATION WORKSPACE/u);
  assert.match(html, /SCREENING/u);
  assert.match(html, /data-aiv-qualification-host/u);
});

test('remaining pending VIB calculators stay non-resolvable and non-executable', () => {
  assert.equal(blockedVibrationDefinitions.length, 4);
  for (const definition of blockedVibrationDefinitions) {
    assert.equal(isEngineeringCalculationExecutable(definition), false);
    assert.equal(canResolveEngineeringCalculation(definition), false);
    const state = baseState(definition);
    const html = renderEngineeringCalculationConsoleHtml({ definitions, families, definition, state });
    assert.match(html, /Execution blocked/u);
    assert.equal(buttonTag(html, 'validate').includes('disabled'), true);
    assert.equal(buttonTag(html, 'resolve').includes('disabled'), true);
    assert.equal(buttonTag(html, 'calculate').includes('disabled'), true);
  }
});
