import test from 'node:test';
import assert from 'node:assert/strict';
import { createXmlCiiAdaptedWorkflowState, updateWorkflowState, updateWorkflowOptions } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import { createXmlCiiModeAStateRef } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-state.js';

const result = { enrichedText: '<old-geometry/>', ciiText: 'old-output' };
function completed() {
  return updateWorkflowState(createXmlCiiAdaptedWorkflowState(), { sourceText: '<source/>', result });
}
test('source, staged, scope, weight and Run options invalidate superseded output', () => {
  const state = completed();
  for (const patch of [{ sourceText: '<new-source/>' }, { stagedJsonText: '{"POS":[1,2,3]}' },
    { branchSelection: { selectedBranchNames: ['/B2'] } },
    { supportConfigJson: '{"overrides":{"rigidWeightFinal":{"/B1::20":17.75}}}' }]) {
    assert.equal(updateWorkflowState(state, patch).result, null);
  }
  assert.equal(updateWorkflowOptions(state, { kgToNewton: false }).result, null);
});
test('navigation and newly supplied conversion results remain available', () => {
  const state = completed();
  assert.equal(updateWorkflowState(state, { activePhaseId: 'weight-match' }).result, result);
  const newResult = { enrichedText: '<new-geometry/>' };
  assert.equal(updateWorkflowState(state, { sourceText: '<new-source/>', result: newResult }).result, newResult);
});
test('Mode A forwards result invalidation after direct replacement', () => {
  const base = { current: completed() };
  const ref = createXmlCiiModeAStateRef(base);
  const previous = ref.current;
  ref.current = { ...previous, stagedJsonText: '{"changed":true}' };
  assert.equal(base.current.result, null);
});

test('shared Run options invalidate every source output, so Mode B cannot reuse a stale source result', async () => {
  const { modeAExecutionRows } = await import('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-propagation.js');
  const state = completed();
  const sources = ['A', 'B'].map(id => ({ sourceId: id, sourceText: `<${id}/>`, supportConfigJson: '{}', workflow: { result } }));
  const base = { current: { ...state, sourceText: '<A/>', sourceBatch: { activeSourceId: 'A', sources } } };
  const ref = createXmlCiiModeAStateRef(base);
  ref.current = updateWorkflowOptions(ref.current, { kgToNewton: false });
  assert.deepEqual(modeAExecutionRows(ref).map(entry => entry.state.result), [null, null]);
});
