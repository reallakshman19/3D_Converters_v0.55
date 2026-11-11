import assert from 'node:assert/strict';
import test from 'node:test';

import { createAivFlareNetwork } from '../converters/vibration/aiv/aiv-flare-network.js';
import { generateAivInputTablesFromFlareNetwork } from '../converters/vibration/aiv/aiv-flare-network-table-generator.js';
import { addAivFlareNetworkSegment } from '../converters/vibration/aiv/aiv-flare-network-mutations.js';
import { deleteAivUnifiedNetworkSelection } from '../tabs/vibration-aiv-unified-canvas-author.js';
import {
  createAivUnifiedCanvasBlankNetwork,
  createAivUnifiedCanvasRvBranch,
} from '../tabs/vibration-aiv-unified-canvas-workflow.js';

function routingNode(canonicalId, line = 'FLARE-HDR') {
  return { canonicalId, kind: 'JUNCTION', line, presentation: { x: 400, y: 200 } };
}

function withNode(network, node) {
  return createAivFlareNetwork({ ...network, nodes: [...network.nodes, node] });
}

test('disconnected active Source remains explicit unresolved relationship evidence', () => {
  const network = createAivFlareNetwork({
    networkId: 'FLARE-DISCONNECTED', revision: '1', source: 'TEST', sourceRevision: '1',
    nodes: [
      {
        canonicalId: 'RV-001', kind: 'SOURCE', line: 'L-1', presentation: { x: 100, y: 100 },
        sourceInput: { caseId: 'CASE-A', sourceDeviceType: 'RELIEF_VALVE' },
      },
      {
        canonicalId: 'WO-001', kind: 'ASSESSMENT', line: 'L-1', presentation: { x: 700, y: 100 },
        assessmentInput: { assessmentType: 'WELDED_TEE' },
      },
    ],
    segments: [],
  });
  const generated = generateAivInputTablesFromFlareNetwork(network);
  assert.equal(generated.tables.relationships.rows.length, 1);
  const row = generated.tables.relationships.rows[0];
  assert.equal(row[0], 'RV-001');
  assert.equal(row[1], 'WO-001');
  assert.equal(row[8], 'UNRESOLVED');
  assert.equal(row[12], 'AUTO_PATH_DISCONNECTED');
  assert.equal(generated.pathEvidence[0].status, 'DISCONNECTED');
  assert.equal(generated.policy.disconnectedSourceRelationshipsRetained, true);
});

test('deleting a selected leaf RV removes exactly its Source and one branch segment', () => {
  let network = createAivUnifiedCanvasBlankNetwork({ networkId: 'FLARE-DELETE' });
  network = withNode(network, routingNode('J-HDR'));
  network = createAivUnifiedCanvasRvBranch(network, {
    canonicalId: 'RV-101', caseId: 'CASE-A', segmentId: 'RV-101-BR',
    targetNodeId: 'J-HDR', length: 8, unit: 'm',
  });
  const next = deleteAivUnifiedNetworkSelection(network, 'SOURCE:RV-101:CASE-A');
  assert.equal(next.nodes.some((node) => node.canonicalId === 'RV-101'), false);
  assert.equal(next.nodes.some((node) => node.canonicalId === 'J-HDR'), true);
  assert.equal(next.segments.length, 0);
});

test('Source deletion refuses to cascade when more than one physical segment is attached', () => {
  let network = createAivUnifiedCanvasBlankNetwork({ networkId: 'FLARE-GUARD' });
  network = withNode(network, routingNode('J-1'));
  network = withNode(network, routingNode('J-2'));
  network = createAivUnifiedCanvasRvBranch(network, {
    canonicalId: 'RV-201', caseId: 'CASE-A', segmentId: 'RV-201-BR',
    targetNodeId: 'J-1', length: 8, unit: 'm',
  });
  network = addAivFlareNetworkSegment(network, {
    segmentId: 'RV-201-SECOND', fromNodeId: 'RV-201', toNodeId: 'J-2',
    physicalLength: { value: 4, unit: 'm' },
  });
  assert.throws(
    () => deleteAivUnifiedNetworkSelection(network, 'SOURCE:RV-201:CASE-A'),
    /while connected segments exist/u,
  );
});

test('Quick RV branch rejects Assessment/Boundary targets and inherits routing-node line', () => {
  let network = createAivUnifiedCanvasBlankNetwork({ networkId: 'FLARE-TARGET' });
  network = withNode(network, routingNode('J-HDR', 'L-HDR'));
  network = withNode(network, {
    canonicalId: 'WO-9', kind: 'ASSESSMENT', line: 'L-HDR', presentation: { x: 700, y: 200 },
    assessmentInput: { assessmentType: 'WELDED_TEE' },
  });
  assert.throws(
    () => createAivUnifiedCanvasRvBranch(network, {
      canonicalId: 'RV-BAD', caseId: 'CASE-A', targetNodeId: 'WO-9', length: 2,
    }),
    /must be a JUNCTION or CONNECTION/u,
  );
  const next = createAivUnifiedCanvasRvBranch(network, {
    canonicalId: 'RV-GOOD', caseId: 'CASE-A', segmentId: 'RV-GOOD-BR',
    targetNodeId: 'J-HDR', length: 3, unit: 'm', line: '',
  });
  assert.equal(next.nodes.find((node) => node.canonicalId === 'RV-GOOD').line, 'L-HDR');
  assert.equal(next.segments.find((segment) => segment.segmentId === 'RV-GOOD-BR').line, 'L-HDR');
});
