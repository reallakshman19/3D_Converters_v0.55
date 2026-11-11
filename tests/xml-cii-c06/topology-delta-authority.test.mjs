import assert from 'node:assert/strict';
import {
  isCanonicalCollapsedSourceHelper,
  isSplitRigidTransition,
  matchShortDropProvenance,
  normalizeRef,
  parsePosition,
  stableNodeKey,
} from './topology-delta-authority.js';

function row(overrides = {}) {
  return {
    branchName: '/B1',
    componentRefNo: '=100/1',
    endpoint: '1',
    nodeNumber: '-1',
    componentType: 'FLAN',
    rigid: '',
    position: '0 0 0',
    ...overrides,
  };
}

assert.equal(normalizeRef(' =100/1 '), '100/1');
assert.deepEqual(parsePosition('1.5 -2 3E1'), [1.5, -2, 30]);
assert.equal(stableNodeKey(row()), '/B1::100/1::1');

assert.equal(
  isSplitRigidTransition(row(), row({ nodeNumber: '45', rigid: '2' })),
  true,
);
assert.equal(
  isSplitRigidTransition(row({ componentType: 'PIPE' }), row({ nodeNumber: '45', rigid: '2' })),
  false,
);

const positive = row({ nodeNumber: '180', componentType: 'BRAN', componentRefNo: '=167' });
const negativeA = row({ componentRefNo: '=48', endpoint: '1' });
const negativeB1 = row({ componentRefNo: '=109', componentType: 'INST', endpoint: '1' });
const negativeB2 = row({ componentRefNo: '=109', componentType: 'INST', endpoint: '2' });
const diagnostics = [
  { type: 'short-element-length-node-dropped', nodeNumber: '180', componentType: 'BRAN', componentRefNo: '=167', elementLengthMm: 4, thresholdMm: 6 },
  { type: 'short-element-length-node-dropped', nodeNumber: '131', componentType: 'FLAN', componentRefNo: '=48', elementLengthMm: 3.2, thresholdMm: 6 },
  { type: 'short-element-length-node-dropped', nodeNumber: '201', componentType: 'INST', componentRefNo: '=109', elementLengthMm: 4, thresholdMm: 6 },
  { type: 'short-element-length-node-dropped', nodeNumber: '202', componentType: 'INST', componentRefNo: '=109', elementLengthMm: 4, thresholdMm: 6 },
];
const matches = matchShortDropProvenance(
  [positive, negativeA, negativeB1, negativeB2],
  diagnostics,
);
assert.equal(matches.get(stableNodeKey(positive))?.scope, 'exact-node');
assert.equal(matches.get(stableNodeKey(negativeA))?.scope, 'component-ref-group');
assert.equal(matches.get(stableNodeKey(negativeB1))?.diagnostic.nodeNumber, '201');
assert.equal(matches.get(stableNodeKey(negativeB2))?.diagnostic.nodeNumber, '202');

const mismatch = matchShortDropProvenance(
  [negativeB1, negativeB2],
  diagnostics.filter((item) => normalizeRef(item.componentRefNo) === '109').slice(0, 1),
);
assert.equal(mismatch.size, 0);

const helper = row({ position: '10 20 30', componentRefNo: '=200/1' });
const junctionA = row({ branchName: '/B1', nodeNumber: '360', componentType: 'BRAN', componentRefNo: '=300/1', position: '10 20 30' });
const junctionB = row({ branchName: '/B2', nodeNumber: '360', componentType: 'BRAN', componentRefNo: '=300/2', position: '10 20 30' });
assert.equal(isCanonicalCollapsedSourceHelper(helper, [helper, junctionA, junctionB]), true);
assert.equal(isCanonicalCollapsedSourceHelper(helper, [helper, junctionA]), false);

console.log('topology-delta-authority: PASS');
