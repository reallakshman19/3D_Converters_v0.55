import assert from 'node:assert/strict';
import { evaluateEngineeringDeltas, summarizeTopologyAudit } from './topology-delta-evaluator.js';
import { stableNodeKey } from './topology-delta-authority.js';

function row(overrides = {}) {
  return {
    branchName: '/B1', componentRefNo: '=100/1', endpoint: '1',
    nodeNumber: '10', componentType: 'PIPE', rigid: '1',
    position: '0 0 0', outsideDiameter: 60.3,
    boreMm: null, wallThickness: null, weight: 0, ...overrides,
  };
}

const sourcePipe = row();
const finalPipe = row({ boreMm: 50, wallThickness: 8.7376 });
const sourceRigid = row({
  componentRefNo: '=200/1', nodeNumber: '-1', componentType: 'FLAN', rigid: '',
});
const finalRigid = { ...sourceRigid, nodeNumber: '19', rigid: '2', boreMm: 50, wallThickness: 8.7376 };
const dropped = row({
  componentRefNo: '=300/1', nodeNumber: '180', componentType: 'BRAN', endpoint: '2',
});
const owner = row({
  branchName: '/B3', componentRefNo: '=400/1', nodeNumber: '140', componentType: 'RIGID', rigid: '2',
});
const finalOwner = { ...owner, boreMm: 50, wallThickness: 8.7376, weight: 42.25 };
const diagnostics = [{
  type: 'short-element-length-node-dropped', nodeNumber: '180',
  componentType: 'BRAN', componentRefNo: '=300/1', elementLengthMm: 4, thresholdMm: 6,
}];

const good = evaluateEngineeringDeltas({
  sourceNodes: [sourcePipe, sourceRigid, dropped, owner],
  finalNodes: [finalPipe, finalRigid, finalOwner],
  diagnostics,
  nominalDnFromOd: () => 50,
  wallByDn: new Map([[50, 8.7376]]),
  weightTargets: new Map([[stableNodeKey(owner), 42.25]]),
});
assert.equal(good.ok, true);
assert.equal(good.removed[0].reason, 'cleanup:short-element');
assert.equal(good.unexplained.length, 0);

const bad = evaluateEngineeringDeltas({
  sourceNodes: [sourcePipe],
  finalNodes: [{ ...finalPipe, position: '1 0 0' }],
  diagnostics: [],
  nominalDnFromOd: () => 50,
  wallByDn: { 50: 8.7376 },
  weightTargets: {},
});
assert.equal(bad.ok, false);
assert.equal(bad.unexplained[0].field, 'position');

const audit = summarizeTopologyAudit({
  rows: [
    { path: 'Path 1 - UXML topology', status: 'DISCONNECTED', reason: 'branch-start' },
    { path: 'Path 2 - final InputXML continuity', status: 'OK' },
    { path: 'Path 2 - final InputXML continuity', status: 'ORPHAN', reason: 'missing-outbound' },
  ],
  stats: { branches: 2 },
});
assert.equal(audit.topologyFindings.length, 1);
assert.equal(audit.continuityFailures.length, 1);
assert.deepEqual(audit.topologyReasonCounts, { 'branch-start': 1 });
console.log('topology-delta-evaluator: PASS');
