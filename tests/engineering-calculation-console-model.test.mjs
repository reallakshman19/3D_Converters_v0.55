import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildEngineeringAuditManifest,
  buildEngineeringConsoleRequest,
  buildEngineeringResultViewModel,
  createEngineeringConsoleDraft,
  engineeringConsoleViewForKey,
  engineeringResultLabel,
  invalidateEngineeringConsoleExecution,
  isEngineeringCalculationExecutable,
  parseEngineeringBatchEditor,
  parseEngineeringConsoleField,
  readEngineeringConsoleObjectDraft,
  selectInitialEngineeringDefinition,
  toggleEngineeringConsoleFamily,
  updateEngineeringConsoleObjectDraft,
} from '../tabs/engineering-calculation-console-model.js';
import { renderInputForm, renderResults } from '../tabs/engineering-calculation-console-sections.js';
import { renderEngineeringCalculationConsoleHtml } from '../tabs/engineering-calculation-console-view.js';

const definition = {
  contractVersion: 'engineering-calculation-contract/v1',
  id: 'TEST.CALC.ONE',
  family: 'TEST',
  name: 'Test Calculation',
  shortName: 'Test Calc',
  methodRevision: '1.0.0',
  purpose: 'Test the engineering calculation console.',
  authority: { qualificationState: 'IMPLEMENTED', codeCompliance: false },
  applicability: { description: 'Test applicability.', limitations: [] },
  inputs: [
    { key: 'p', label: 'Pressure', type: 'number', required: true, quantity: 'pressure', canonicalUnit: 'MPa' },
    { key: 'flag', type: 'boolean', engineeringDefault: false },
    { key: 'mode', type: 'enum', values: ['A', 'B'], engineeringDefault: 'A' },
    { key: 'obj', type: 'object' },
    { key: 'arr', label: 'Attestations', type: 'array' },
    { key: 'optional', type: 'number' },
  ],
  outputs: [
    { key: 'pressure', label: 'Calculated pressure', type: 'number', quantity: 'pressure', canonicalUnit: 'MPa' },
  ],
};

test('startup prefers focused B31.3 thickness instead of material-design workflow', () => {
  const material = { id: 'PIPE.B313.MATERIAL_DESIGN', authority: { qualificationState: 'IMPLEMENTED' } };
  const thickness = { id: 'PIPE.B313.THICKNESS', authority: { qualificationState: 'IMPLEMENTED' } };
  const other = { id: 'TEST.OTHER', authority: { qualificationState: 'IMPLEMENTED' } };
  assert.equal(selectInitialEngineeringDefinition([material, other, thickness]), thickness);
  assert.equal(selectInitialEngineeringDefinition([material, other, thickness], material), material);
});

test('draft uses declared defaults, JSON aggregate editing, and canonical units only', () => {
  const draft = createEngineeringConsoleDraft(definition, { p: 12, arr: [{ id: 'A1' }] });
  assert.equal(draft.values.p, 12);
  assert.equal(draft.values.flag, false);
  assert.equal(draft.values.mode, 'A');
  assert.equal(draft.units.p, 'MPa');
  assert.equal(draft.values.arr, '[\n  {\n    "id": "A1"\n  }\n]');
  assert.equal(draft.values.optional, '');
});

test('typed parser preserves zero/false, supports arrays, and rejects malformed aggregate shapes', () => {
  assert.deepEqual(parseEngineeringConsoleField({ key: 'n', type: 'number' }, 0), { included: true, value: 0 });
  assert.deepEqual(parseEngineeringConsoleField({ key: 'b', type: 'boolean' }, false), { included: true, value: false });
  assert.deepEqual(parseEngineeringConsoleField({ key: 'a', type: 'array' }, '[{"id":"A1"}]'), {
    included: true,
    value: [{ id: 'A1' }],
  });
  assert.throws(() => parseEngineeringConsoleField({ key: 'o', type: 'object' }, '{bad'), /JSON/);
  assert.throws(() => parseEngineeringConsoleField({ key: 'a', type: 'array' }, '{"id":"A1"}'), /JSON array/);
});

test('array fields render as JSON textarea controls rather than scalar text inputs', () => {
  const draft = createEngineeringConsoleDraft(definition, { p: 10, arr: [{ id: 'A1' }] });
  const html = renderInputForm(definition, { draft, editorErrors: [] });
  assert.match(html, /<textarea[^>]+data-field="arr"/);
  assert.match(html, /&quot;id&quot;: &quot;A1&quot;/);
});

test('structured mill-tolerance editor builds the domain object without requiring JSON syntax', () => {
  const toleranceDefinition = {
    ...definition,
    inputs: [{
      key: 'negativeMillTolerance',
      label: 'Negative mill tolerance',
      type: 'object',
      required: true,
      help: 'Choose percentage tolerance or an absolute length deduction.',
      ui: { editor: 'negative-mill-tolerance' },
    }],
  };
  const draft = createEngineeringConsoleDraft(toleranceDefinition);
  updateEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance', 'basis', 'percent');
  updateEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance', 'value', '12.5', { number: true });
  assert.deepEqual(readEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance'), { basis: 'percent', value: 12.5 });

  let html = renderInputForm(toleranceDefinition, { draft, editorErrors: [] });
  assert.match(html, /data-object-property="basis"/);
  assert.match(html, /data-object-property="value"/);
  assert.match(html, /data-object-unit-control disabled/);
  assert.doesNotMatch(html, /engineering-console-json-editor/);
  assert.match(html, /value="12\.5"/);
  assert.match(html, />%<\/option>/);

  updateEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance', 'basis', 'absolute');
  updateEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance', 'unit', 'mm');
  assert.deepEqual(readEngineeringConsoleObjectDraft(draft, 'negativeMillTolerance'), { basis: 'absolute', value: 12.5, unit: 'mm' });
  html = renderInputForm(toleranceDefinition, { draft, editorErrors: [] });
  assert.doesNotMatch(html, /data-object-unit-control disabled/);
  assert.match(html, /option value="mm" selected/);
});

test('form controls have explicit labels and validation descriptions', () => {
  const draft = createEngineeringConsoleDraft(definition, { p: 10 });
  const html = renderInputForm(definition, {
    draft,
    editorErrors: [{ field: 'p', message: 'Pressure is invalid' }],
  });
  assert.match(html, /<label for="engineering-console-p">Pressure \*<\/label>/);
  assert.match(html, /id="engineering-console-p"[^>]+aria-invalid="true"[^>]+aria-describedby="engineering-console-p-error"/);
  assert.match(html, /id="engineering-console-p-error"[^>]*>Pressure is invalid<\/div>/);
  assert.match(html, /<label class="engineering-console-checkbox" for="engineering-console-flag">/);
  assert.doesNotMatch(html, />Enabled<\/span>/);
});

test('request omits blank optional fields and enables sandbox explicitly', () => {
  const draft = createEngineeringConsoleDraft(definition, { p: 10, arr: [{ id: 'A1' }] });
  const built = buildEngineeringConsoleRequest(definition, draft, { executionMode: 'sandbox', qualificationMode: 'screening' });
  assert.equal(built.ok, true);
  assert.equal(built.request.inputs.p, 10);
  assert.deepEqual(built.request.inputs.arr, [{ id: 'A1' }]);
  assert.equal(Object.hasOwn(built.request.inputs, 'optional'), false);
  assert.equal(built.request.inputUnits.p, 'MPa');
  assert.equal(built.request.options.executionMode, 'sandbox');
  assert.equal(built.request.options.qualificationMode, 'screening');
});

test('blocked state and batch parsing fail closed', () => {
  assert.equal(isEngineeringCalculationExecutable(definition), true);
  assert.equal(isEngineeringCalculationExecutable({ id: 'VIB.FIV.X', authority: { qualificationState: 'BLOCKED' } }), false);
  assert.equal(parseEngineeringBatchEditor('[{"calculationId":"A.B.C"}]').batchRequest.requests.length, 1);
  assert.equal(parseEngineeringBatchEditor('{bad').ok, false);
});

test('family disclosure is non-destructive to calculator selection, draft, and result state', () => {
  const draft = { values: { p: 12.5 }, units: { p: 'MPa' } };
  const result = { ok: true };
  const state = { selectedFamily: 'TEST', selectedId: definition.id, draft, result };
  toggleEngineeringConsoleFamily(state, 'TEST');
  assert.equal(state.selectedFamily, null);
  assert.equal(state.selectedId, definition.id);
  assert.equal(state.draft, draft);
  assert.equal(state.result, result);
  toggleEngineeringConsoleFamily(state, 'OTHER');
  assert.equal(state.selectedFamily, 'OTHER');
  assert.equal(state.selectedId, definition.id);
});

test('tab keyboard navigation wraps and supports Home and End', () => {
  assert.equal(engineeringConsoleViewForKey('results', 'ArrowRight'), 'checks');
  assert.equal(engineeringConsoleViewForKey('results', 'ArrowLeft'), 'batch');
  assert.equal(engineeringConsoleViewForKey('checks', 'Home'), 'results');
  assert.equal(engineeringConsoleViewForKey('checks', 'End'), 'batch');
  assert.equal(engineeringConsoleViewForKey('checks', 'Enter'), null);
});

test('result label never equates successful execution with engineering PASS', () => {
  assert.equal(engineeringResultLabel({ ok: true, assessment: null }), 'NOT ASSESSED');
  assert.equal(engineeringResultLabel({ ok: true, assessment: { status: 'PASS' } }), 'PASS');
  assert.equal(engineeringResultLabel({ ok: true, checks: [{ satisfied: false }] }), 'FAIL');
  assert.equal(engineeringResultLabel({ ok: false, errors: [{ code: 'ENGINEERING_METHOD_BLOCKED' }] }), 'NOT AVAILABLE');
});

test('result view model separates execution, assessment, authority, checks, and output metadata', () => {
  const view = buildEngineeringResultViewModel(definition, {
    ok: true,
    outputs: { pressure: 12.5 },
    checks: [{ id: 'LIMIT', satisfied: false, utilization: 1.25, designAuthority: false }],
    assessment: { governingEligible: false, designAuthority: false, codeCompliance: false },
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
    execution: { executionId: 'exec-1' },
  });

  assert.equal(view.execution.status, 'COMPLETED');
  assert.equal(view.assessment.status, 'FAIL');
  assert.equal(view.authority.effective, 'BENCHMARK_ONLY');
  assert.equal(view.checks[0].status, 'FAIL');
  assert.equal(view.checks[0].authority, 'BENCHMARK_ONLY');
  assert.equal(view.outputs[0].label, 'Calculated pressure');
  assert.equal(view.outputs[0].unit, 'MPa');
});

test('audit manifest retains solver revision, authority, qualification, and canonical input transforms', () => {
  const result = {
    contractVersion: 'engineering-calculation-result/v1',
    ok: true,
    calculationId: definition.id,
    family: definition.family,
    methodRevision: definition.methodRevision,
    execution: { executionId: 'exec-1', timestamp: '2026-09-11T07:00:00Z', implementationRevision: 'abc123' },
    inputs: { p: 25 },
    resolvedInputs: {
      p: {
        key: 'p', value: 25, unit: 'bar', canonicalValue: 2.5, canonicalUnit: 'MPa',
        transformation: 'bar->MPa', source: { type: 'CALLER' }, overridden: false,
      },
    },
    outputs: { pressure: 2.5 },
    checks: [],
    assessment: null,
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false, recordId: 'QUAL-17' },
    provenance: { masterRevision: 'R4' },
    evidence: { source: 'fixture' },
    applicability: { applicable: true, limitations: [] },
    warnings: [], errors: [], intermediates: {},
  };
  const manifest = buildEngineeringAuditManifest(definition, result);
  assert.equal(manifest.schemaVersion, 'engineering-calculation-audit/v1');
  assert.equal(manifest.calculation.methodRevision, '1.0.0');
  assert.equal(manifest.calculation.solverRevision, 'abc123');
  assert.equal(manifest.qualificationRecordId, 'QUAL-17');
  assert.equal(manifest.canonicalInputs.p, 2.5);
  assert.equal(manifest.inputTransformations.p.inputUnit, 'bar');
  assert.equal(manifest.inputTransformations.p.canonicalUnit, 'MPa');
  assert.equal(manifest.inputTransformations.p.transformation, 'bar->MPa');
  assert.deepEqual(manifest.inputTransformations.p.source, { type: 'CALLER' });
  assert.deepEqual(manifest.provenance, { masterRevision: 'R4' });
});

test('results renderer exposes failed assessment separately from execution and renders units', () => {
  const html = renderResults(definition, {
    ok: true,
    outputs: { pressure: 12.5 },
    checks: [{ id: 'LIMIT', status: 'FAIL', utilization: 1.25, authority: 'BENCHMARK_ONLY' }],
    assessment: { status: 'FAIL', disposition: 'LIMIT_EXCEEDED', governingEligible: false, designAuthority: false, codeCompliance: false },
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
    execution: { executionId: 'exec-1' },
  }, null);

  assert.match(html, /Assessment failed/);
  assert.match(html, /<small>Execution<\/small><strong>COMPLETED<\/strong>/);
  assert.match(html, /Calculated pressure/);
  assert.match(html, /<td>MPa<\/td>/);
  assert.doesNotMatch(html, />CALCULATED</);
});

test('console view renders ARIA navigation, live status, and audit export availability', () => {
  const draft = createEngineeringConsoleDraft(definition, { p: 10 });
  const state = {
    selectedFamily: 'TEST',
    selectedId: definition.id,
    familyLanding: null,
    draft,
    mode: 'single',
    qualificationMode: 'strict',
    activeView: 'results',
    editorErrors: [],
    validation: null,
    resolution: null,
    result: {
      ok: true,
      outputs: { pressure: 12.5 },
      checks: [{ id: 'LIMIT', status: 'FAIL', authority: 'BENCHMARK_ONLY' }],
      assessment: { status: 'FAIL', governingEligible: false, designAuthority: false, codeCompliance: false },
      qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
      execution: { executionId: 'exec-1' },
    },
    batchText: '[]',
    batchResult: null,
    batchError: null,
  };
  const html = renderEngineeringCalculationConsoleHtml({
    definitions: [definition],
    families: [{ id: 'TEST', label: 'Test family', count: 1 }],
    definition,
    state,
  });
  assert.match(html, /role="tablist" aria-label="Calculation result views"/);
  assert.match(html, /role="tab" aria-selected="true" aria-controls="engineering-console-view-panel" tabindex="0">Results<\/button>/);
  assert.match(html, /role="tabpanel" aria-labelledby="engineering-console-tab-results" tabindex="0"/);
  assert.match(html, /data-family-id="TEST" aria-expanded="true" aria-controls="engineering-console-family-TEST-list"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true">Calculation completed\. Assessment FAIL\. Authority BENCHMARK_ONLY\.<\/div>/);
  assert.match(html, /data-action="export-audit"[^>]*>Export audit<\/button>/);
  assert.doesNotMatch(html, /data-action="export-audit" disabled/);
});

test('engineering console stylesheet exposes visible focus treatment and structured object layout', () => {
  const css = readFileSync(new URL('../tabs/engineering-calculations.css', import.meta.url), 'utf8');
  assert.match(css, /engineering-console-view-btn:focus-visible/);
  assert.match(css, /engineering-console-input:focus-visible/);
  assert.match(css, /outline:2px solid/);
  assert.match(css, /engineering-console-object-editor/);
});

test('input mutation invalidates stale single-calculation evidence', () => {
  const state = {
    validation: { ok: true }, resolution: { ok: true }, result: { ok: true }, batchResult: { ok: true },
  };
  invalidateEngineeringConsoleExecution(state);
  assert.equal(state.validation, null);
  assert.equal(state.resolution, null);
  assert.equal(state.result, null);
  assert.deepEqual(state.batchResult, { ok: true });
});
