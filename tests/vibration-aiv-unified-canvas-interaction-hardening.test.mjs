import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { remapAivUnifiedCanvasSourceSelection } from '../tabs/vibration-aiv-unified-canvas-controller.js';
import {
  aivUnifiedCanvasRvBranchPosition,
  isAivUnifiedCanvasRvBranchTarget,
} from '../tabs/vibration-aiv-unified-canvas-workflow.js';
import { aivUiFocusKey } from '../tabs/vibration-aiv-ui-context.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('network engineering fields have stable focus keys across rerenders', () => {
  assert.equal(aivUiFocusKey({ dataset: { aivEngineeringFieldKey: 'network:RV-101:sourceInput.massFlow.value' } }),
    'engineering:network:RV-101:sourceInput.massFlow.value');
  assert.equal(aivUiFocusKey({ dataset: { aivTableCell: 'sources', aivEditRow: '2', aivEditColumn: '4' } }),
    'table:sources:2:4');
});

test('Source operating-case edit remaps selection to the new case-qualified key', () => {
  const selection = Object.freeze({ selectionKey: 'SOURCE:RV-101:CASE-A' });
  const network = {
    nodes: [{ canonicalId: 'RV-101', kind: 'SOURCE', sourceInput: { caseId: 'CASE-B' } }],
  };
  const target = { dataset: { aivNetworkNodeId: 'RV-101', aivNetworkNodePath: 'sourceInput.caseId' } };
  assert.deepEqual(remapAivUnifiedCanvasSourceSelection(selection, network, target), {
    selectionKey: 'SOURCE:RV-101:CASE-B',
  });
  assert.equal(remapAivUnifiedCanvasSourceSelection(selection, network, { dataset: { aivNetworkNodeId: 'OTHER' } }), selection);
});

test('Quick RV placement is target-relative and avoids an occupied first candidate', () => {
  const target = { canonicalId: 'J-HDR', kind: 'JUNCTION', presentation: { x: 500, y: 220 } };
  const network = {
    nodes: [target, { canonicalId: 'EXISTING', presentation: { x: 320, y: 220 } }],
  };
  assert.deepEqual(aivUnifiedCanvasRvBranchPosition(network, target), { x: 320, y: 310 });
  assert.equal(isAivUnifiedCanvasRvBranchTarget({ kind: 'JUNCTION' }), true);
  assert.equal(isAivUnifiedCanvasRvBranchTarget({ kind: 'CONNECTION' }), true);
  assert.equal(isAivUnifiedCanvasRvBranchTarget({ kind: 'ASSESSMENT' }), false);
});

test('unified interaction source preserves physical-pipe targeting and local error/context UX', async () => {
  const [controller, editor, view, authorView, qualification, uiContext] = await Promise.all([
    read('tabs/vibration-aiv-unified-canvas-controller.js'),
    read('tabs/vibration-aiv-unified-canvas-editor-controller.js'),
    read('tabs/vibration-aiv-unified-canvas-view.js'),
    read('tabs/vibration-aiv-unified-canvas-author-view.js'),
    read('tabs/vibration-aiv-qualification-tab.js'),
    read('tabs/vibration-aiv-ui-context.js'),
  ]);
  assert.equal(controller.includes("closest?.('[data-aiv-path-segment-id]')"), true);
  assert.equal(controller.includes('mode === AIV_CANVAS_MODE.RELATIONSHIPS'), true);
  assert.equal(controller.includes('remapAivUnifiedCanvasSourceSelection'), true);
  assert.equal(editor.includes('.filter(isAivUnifiedCanvasRvBranchTarget)'), true);
  assert.equal(view.includes('data-aiv-canvas-action-error="true"'), true);
  assert.equal(view.includes('data-aiv-scroll-key="aiv-canvas-inspector"'), true);
  assert.equal(view.includes("item.applicabilityDisposition === 'NOT_APPLICABLE' ? ' is-inactive'"), true);
  assert.equal(authorView.includes('data-aiv-disclosure-key="aiv-network-bulk-graph-edit"'), true);
  assert.equal(qualification.includes('state.canvasActionError = message'), true);
  assert.equal(qualification.includes('state.selectedCanvasKey = selection?.selectionKey ?? null'), true);
  assert.equal(uiContext.includes('[data-aiv-engineering-field-key]'), true);
});

test('interaction hardening does not introduce numerical or geometry-to-distance authority', async () => {
  const sources = await Promise.all([
    read('tabs/vibration-aiv-unified-canvas-controller.js'),
    read('tabs/vibration-aiv-unified-canvas-editor-controller.js'),
    read('tabs/vibration-aiv-unified-canvas-workflow.js'),
    read('tabs/vibration-aiv-unified-canvas-view.js'),
    read('tabs/vibration-aiv-ui-context.js'),
  ]);
  for (const source of sources) {
    assert.equal(source.includes('Math.log10('), false);
    assert.equal(source.includes('svgPixelsAuthoritativeForDistance: true'), false);
    assert.equal(source.includes('physicalDistance = dx'), false);
    assert.equal(source.includes('physicalDistance = dy'), false);
  }
});
