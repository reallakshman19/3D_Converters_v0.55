import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureVibrationRoadmapViewState,
  restoreVibrationRoadmapViewState,
  vibrationRoadmapFocusKey,
} from '../tabs/vibration-roadmap-view-state.js';

function element(dataset = {}) {
  return {
    dataset,
    disabled: false,
    isConnected: true,
    focusCalls: 0,
    focusOptions: [],
    focus(options) {
      this.focusCalls += 1;
      this.focusOptions.push(options ?? null);
    },
  };
}

function harness({ activeElement, candidates, scrollTop = 0, scrollLeft = 0, external = null } = {}) {
  const body = { isConnected: true };
  const documentElement = { isConnected: true };
  const scroll = { scrollTop, scrollLeft };
  const panel = {
    ownerDocument: null,
    contains(value) {
      return candidates.includes(value);
    },
    querySelector(selector) {
      return selector === '.vibration-roadmap-scroll' ? scroll : null;
    },
    querySelectorAll() {
      return candidates;
    },
  };
  const documentRef = {
    body,
    documentElement,
    activeElement: activeElement ?? body,
  };
  panel.ownerDocument = documentRef;
  return { panel, documentRef, scroll, body, documentElement, external };
}

test('VIB-UI-001 focus keys are semantic and stable across rail rebuilds', () => {
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapCollapse: '' })), 'collapse');
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapResize: '' })), 'resize');
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapAssessmentSelect: '' })), 'assessment-select');
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapLineSelect: '' })), 'line-select');
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapAction: 'save-project' })), 'action:save-project');
  assert.equal(
    vibrationRoadmapFocusKey(element({ vibrationWorkspaceId: 'IDENTIFICATION', vibrationWorkflowAction: 'AUTHOR_T1_IDENTIFICATION' })),
    'workspace:IDENTIFICATION:AUTHOR_T1_IDENTIFICATION',
  );
  assert.equal(vibrationRoadmapFocusKey(element({ calcId: 'VIB-FIT' })), 'calculation:VIB-FIT');
  assert.equal(vibrationRoadmapFocusKey(element({ roadmapNodeId: 'basic-measurement' })), 'node:basic-measurement');
});

test('VIB-UI-001 capture retains rail scroll and focused semantic key', () => {
  const focused = element({ roadmapAction: 'save-project' });
  const { panel, documentRef } = harness({ activeElement: focused, candidates: [focused], scrollTop: 287, scrollLeft: 9 });
  assert.deepEqual(
    captureVibrationRoadmapViewState(panel, documentRef),
    { scrollTop: 287, scrollLeft: 9, focusKey: 'action:save-project' },
  );
});

test('VIB-UI-001 restore returns scroll and focus when no external target acquired focus', () => {
  const target = element({ roadmapAction: 'save-project' });
  const { panel, documentRef, scroll, body } = harness({ candidates: [target] });
  documentRef.activeElement = body;
  const restored = restoreVibrationRoadmapViewState(
    panel,
    { scrollTop: 287, scrollLeft: 9, focusKey: 'action:save-project' },
    documentRef,
  );
  assert.equal(restored, true);
  assert.equal(scroll.scrollTop, 287);
  assert.equal(scroll.scrollLeft, 9);
  assert.equal(target.focusCalls, 1);
  assert.deepEqual(target.focusOptions[0], { preventScroll: true });
});

test('VIB-UI-001 restore never steals focus from a live external navigation target', () => {
  const target = element({ roadmapAction: 'save-project' });
  const external = element({});
  const { panel, documentRef, scroll } = harness({ candidates: [target], external });
  documentRef.activeElement = external;
  const restored = restoreVibrationRoadmapViewState(
    panel,
    { scrollTop: 311, scrollLeft: 0, focusKey: 'action:save-project' },
    documentRef,
  );
  assert.equal(restored, false);
  assert.equal(scroll.scrollTop, 311);
  assert.equal(target.focusCalls, 0);
});
