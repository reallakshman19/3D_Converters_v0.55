import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEngineeringCalculationDefinition,
  listEngineeringCalculations,
} from '../converters/engineering-calculations/index.js';
import {
  createEngineeringConsoleDraft,
  isEngineeringCalculationExecutable,
} from '../tabs/engineering-calculation-console-model.js';
import { renderInputForm } from '../tabs/engineering-calculation-console-sections.js';
import {
  engineeringConsoleJsonExampleText,
  getEngineeringConsoleJsonGuidance,
  isEngineeringConsoleAggregateField,
  usesGenericEngineeringConsoleInputSurface,
} from '../tabs/engineering-calculation-console-json-guidance.js';

function aggregateInputs(definition) {
  return (definition?.inputs ?? []).filter(isEngineeringConsoleAggregateField);
}

test('every executable generic-console aggregate input has trusted JSON guidance or a custom editor', () => {
  const missing = [];
  for (const definition of listEngineeringCalculations()) {
    if (!isEngineeringCalculationExecutable(definition)) continue;
    if (!usesGenericEngineeringConsoleInputSurface(definition)) continue;
    for (const field of aggregateInputs(definition)) {
      if (field.ui?.editor) continue;
      const guidance = getEngineeringConsoleJsonGuidance(definition, field);
      const example = engineeringConsoleJsonExampleText(definition, field);
      if (!guidance?.help || !example) missing.push(`${definition.id}.${field.key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('dedicated product workspaces are exempt from generic JSON-editor guidance coverage', () => {
  const aiv = getEngineeringCalculationDefinition('VIB.AIV.ACOUSTIC');
  assert.ok(aiv);
  assert.equal(usesGenericEngineeringConsoleInputSurface(aiv), false);
  assert(aggregateInputs(aiv).length > 0);
});

test('structured aggregate editors do not receive irrelevant JSON-editor instructions', () => {
  const definition = getEngineeringCalculationDefinition('PIPE.B313.THICKNESS');
  const draft = createEngineeringConsoleDraft(definition);
  const html = renderInputForm(definition, { draft, editorErrors: [] });
  assert.match(html, /data-object-property="basis"/);
  assert.doesNotMatch(html, /Enter a JSON object/);
  assert.doesNotMatch(html, /No calculator-specific example shape/);
});

test('material-design examples render as placeholders without becoming engineering defaults', () => {
  const definition = getEngineeringCalculationDefinition('PIPE.B313.MATERIAL_DESIGN');
  const draft = createEngineeringConsoleDraft(definition);
  assert.equal(draft.values.material, '');
  assert.equal(draft.values.factorOverrides, '');

  const html = renderInputForm(definition, { draft, editorErrors: [] });
  assert.match(html, /data-field="material"[^>]+placeholder="[^\"]*&quot;family&quot;: &quot;DSS&quot;/s);
  assert.match(html, /data-field="factorOverrides"[^>]+placeholder="[^\"]*&quot;S&quot;: 170/s);
  assert.match(html, /example values are not defaults and are not submitted/i);
  assert.equal(draft.values.material, '');
  assert.equal(draft.values.factorOverrides, '');
});

test('governed Chapter IX basis guidance exposes the required package shape without supplying master authority', () => {
  for (const id of ['PIPE.B313.CH9.RESOLVE_BASIS', 'PIPE.B313.CH9.STRAIGHT_PRESSURE_FROM_BASIS']) {
    const definition = getEngineeringCalculationDefinition(id);
    const field = definition.inputs.find((item) => item.key === 'basisPackage');
    const example = JSON.parse(engineeringConsoleJsonExampleText(definition, field));
    assert.equal(example.packageVersion, 'b313-ch9-basis-package/v1');
    assert.deepEqual(Object.keys(example.masters).sort(), [
      'manufacturingTolerance',
      'materialAllowable',
      'pipeDimension',
      'pipeProduct',
      'sources',
    ]);
    assert(Object.values(example.masters).every((rows) => Array.isArray(rows) && rows.length === 0));
    assert.match(getEngineeringConsoleJsonGuidance(definition, field).help, /not design authority/i);
  }
});

test('review and formal USER_CALCULATED_KD3 examples preserve their evidence-policy distinction', () => {
  const review = getEngineeringCalculationDefinition('PIPE.B313.CH9.FATIGUE_USER_REVIEW');
  const formal = getEngineeringCalculationDefinition('PIPE.B313.CH9.FATIGUE_USER_CALCULATED');

  for (const definition of [review, formal]) {
    for (const key of ['spectrum', 'states', 'transitions', 'externalResults']) {
      const field = definition.inputs.find((item) => item.key === key);
      assert.ok(field, `${definition.id}.${key}`);
      assert.doesNotThrow(() => JSON.parse(engineeringConsoleJsonExampleText(definition, field)));
    }
  }

  const reviewExternal = JSON.parse(engineeringConsoleJsonExampleText(
    review,
    review.inputs.find((item) => item.key === 'externalResults'),
  ));
  const formalExternal = JSON.parse(engineeringConsoleJsonExampleText(
    formal,
    formal.inputs.find((item) => item.key === 'externalResults'),
  ));

  assert.equal(reviewExternal[0].calculationBasis, undefined);
  assert.equal(formalExternal[0].calculationBasis.calculatedBy, 'ENGINEER_A');
  assert.equal(formalExternal[0].calculationBasis.checkedBy, 'ENGINEER_B');
  assert.notEqual(
    formalExternal[0].calculationBasis.calculatedBy,
    formalExternal[0].calculationBasis.checkedBy,
  );
});
