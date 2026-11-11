import assert from 'node:assert/strict';
import test from 'node:test';

import { createVibrationIdentificationAuthoringTable } from '../tabs/vibration-integrity-identification-model.js';
import { renderVibrationIdentificationAuthoring } from '../tabs/vibration-integrity-identification-view.js';

function state() {
  return {
    mechanismIdentificationAuthoring: createVibrationIdentificationAuthoringTable(),
    workspace: {
      rows: [{ line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1' }],
    },
    envelope: {
      workflow: {
        dataset: {
          enrichment: [{
            line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1',
            property: 'T1_DEADLEG_PRESENT', value: true, status: 'VERIFIED',
            source: 'P&ID-100', sourceRevision: 'C', recordId: 'REC-1', reviewer: 'engineer-a',
          }],
        },
      },
    },
  };
}

test('identification workspace displays verified T1 suggestions as pending review only', () => {
  const html = renderVibrationIdentificationAuthoring(state());
  assert.match(html, /T1 mechanism suggestions/u);
  assert.match(html, /deadlegPulsation/u);
  assert.match(html, /T1_DEADLEG_PRESENT/u);
  assert.match(html, /PENDING ENGINEER REVIEW/u);
  assert.match(html, /Suggestions are not applicability evidence/u);
  assert.match(html, /Add identification row/u);
  assert.doesNotMatch(html, /data-vi-suggestion-apply/u);
});

test('suggestion display does not mutate the explicit identification authoring table', () => {
  const value = state();
  renderVibrationIdentificationAuthoring(value);
  assert.equal(value.mechanismIdentificationAuthoring.rows.length, 0);
});
