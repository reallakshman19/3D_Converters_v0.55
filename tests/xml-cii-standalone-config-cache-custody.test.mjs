import assert from 'node:assert/strict';
import test from 'node:test';

import { updateWorkflowState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';

test('supportConfigJson changes synchronize the cached master config authority', () => {
  const state = {
    activePhaseId: 'source',
    supportConfigJson: JSON.stringify({ marker: 'old', supportMapping: { version: 2, marker: 'old-rule' } }),
    masterContext: {
      config: { marker: 'old', supportMapping: { version: 2, marker: 'old-rule' } },
      lineRows: [{ lineKey: 'L-100' }],
    },
  };
  const replacement = {
    marker: 'new',
    supportMapping: { version: 2, marker: 'new-rule' },
    pipingClass: { fieldMap: { class: 'SPEC' }, masterRows: [{ SPEC: 'P1' }] },
  };

  const next = updateWorkflowState(state, { supportConfigJson: JSON.stringify(replacement) });

  assert.equal(next.masterContext.config.marker, 'new');
  assert.equal(next.masterContext.config.supportMapping.marker, 'new-rule');
  assert.deepEqual(next.masterContext.config.pipingClass, replacement.pipingClass);
  assert.equal(next.masterContext.config.useDefaultPipingClassMaterialCodeMap, true);
  assert.deepEqual(next.masterContext.lineRows, [{ lineKey: 'L-100' }]);
  assert.equal(state.masterContext.config.marker, 'old');
});

test('non-config state updates do not replace the cached master config object', () => {
  const cachedConfig = { marker: 'stable' };
  const masterContext = { config: cachedConfig, lineRows: [] };
  const state = { activePhaseId: 'source', supportConfigJson: '{"marker":"stable"}', masterContext };

  const next = updateWorkflowState(state, { running: true });

  assert.equal(next.masterContext, masterContext);
  assert.equal(next.masterContext.config, cachedConfig);
});
