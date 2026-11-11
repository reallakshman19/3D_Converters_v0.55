import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildInvocation } from '../converters/invocation-builder.js';
import { createDefaultWorkflowOptions } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import { workflowOptionsFromState } from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js';

const configUi = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-config-tabs.js', import.meta.url), 'utf8');
const writer = await readFile(new URL('../converters/scripts/xml_to_cii2019.py', import.meta.url), 'utf8');

assert.equal(createDefaultWorkflowOptions().kgToNewton, true, 'new/reset standalone state must default kg→N ON');
assert.equal(workflowOptionsFromState({ options: {} }).kgToNewton, true, 'missing option must resolve ON');
assert.equal(workflowOptionsFromState({ options: { kgToNewton: false } }).kgToNewton, false, 'explicit OFF must be preserved');

const defaultInvocation = buildInvocation('xml_to_cii', '/job/input.xml', 'input.xml', null, {}, '/job');
const onInvocation = buildInvocation('xml_to_cii', '/job/input.xml', 'input.xml', null, { kgToNewton: true }, '/job');
const offInvocation = buildInvocation('xml_to_cii', '/job/input.xml', 'input.xml', null, { kgToNewton: false }, '/job');

function scales(invocation) {
  return invocation.argv.flatMap((value,index)=>value==='--weight-scale'?[Number(invocation.argv[index+1])]:[]);
}
assert.deepEqual(scales(defaultInvocation), [10]);
assert.deepEqual(scales(onInvocation), [10]);
assert.deepEqual(scales(offInvocation), []);
assert.ok(Math.abs(9.492 * scales(onInvocation)[0] - 94.92) < 1e-9);

assert.match(writer, /_rigid_weight_for_edge\(edge\) \* weight_scale/);
assert.match(configUi, /kg → N weight conversion \(×10\)/);
assert.match(configUi, /Default ON/);
assert.match(configUi, /final writer boundary only/);
assert.match(configUi, /updateWorkflowOptions\(stateRef\.current,\{kgToNewton:/);

console.log('Issue #776 kg→N unit custody verified.');
