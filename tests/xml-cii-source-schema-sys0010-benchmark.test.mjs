import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  normalizeSupportIdentity,
  readSourcePosition,
  sourceRelationshipEvidence,
} from '../converters/xml-cii2019-core/source-schema-adapter.js';
import {
  buildStagedSupportIndex,
  xmlCiiRestraintEntriesFromSupportMatch,
} from '../converters/xml-cii2019-core/support-mapping.js';

const config = {
  coordinateTolerance: 1,
  useRestraintTypeBasedOnJson: true,
  sourceSchema: {
    enabled: true,
    profileId: 'SYS0010-SL1847103-QUALIFICATION',
    fieldConflictPolicy: 'REJECT',
    fields: {
      objectName: ['NAME'],
      objectType: ['TYPE'],
      directLink: ['MDSLINKREF'],
      supportGroupRef: ['CMPSUPREFN'],
      parentRef: ['OWNER'],
      previousRef: ['PREV-NAME'],
      componentRef: ['COMPRE'],
      supportType: ['MDSSUPPTYPE'],
      supportFunction: ['MDSSUPPFUNC'],
      supportGap: ['CMPSUPGAP'],
      dtxrPosition: ['DTXR_POS'],
      dtxrPs: ['DTXR_PS'],
      dtxr: ['DTXR'],
      position: ['POS'],
    },
    identity: {
      supportPrefixes: ['SL', 'PS'],
      hyphenPolicy: 'OPTIONAL',
      maxHierarchyDepth: 2,
      hierarchyMatch: 'EXACT_ONLY',
      matchBoundary: 'FULL_TOKEN',
    },
    relationships: {
      identityRoles: ['objectName'],
      groupRoles: ['supportGroupRef'],
      linkRoles: ['directLink'],
      expandIdentityToGroup: true,
      objectNameIsGroupAuthority: false,
      conflictPolicy: 'REJECT',
    },
    coordinates: {
      authority: 'CORROBORATION_ONLY',
      coordinateOnlyFallback: false,
    },
  },
  coordinateAlignment: {
    mode: 'MANUAL',
    manualOffsetMm: { x: 0, y: 0, z: 100000 },
    applyToFields: ['POS'],
    matchToleranceMm: 6,
  },
};

const exactRestFromReportedStagedJson = {
  name: 'SUPPORT SL-1847103 (REF)',
  type: 'SUPPORT',
  attributes: {
    NAME: '/SL-1847103.2.1',
    TYPE: 'ANCI',
    OWNER: '/SL-1847103.2/B1',
    'PREV-NAME': 'PS01264.1',
    POS: { x: 854513.44, y: 3934222.04, z: 6100 },
    POSI: 'E 854513.44mm N 3934222.04mm U 6100mm',
    COMPRE: '=1006649732/143989',
    CMPSUPREFN: 'SL-1847103 (REF)',
    CMPSUPTYPE: 'REST',
    MDSSUPPFUNC: 'PIPE-REST',
    MDSSUPPTYPE: 'PIPE-REST',
  },
};

// IMPORTANT: the original full StagedJson is not present in the repository.
// The two records below are qualification reconstruction only: they encode the
// reported DTXR_POS engineering evidence (GUIDE gap 10, LINESTOP gap 35) under
// the same explicit support group. Do not cite their NAME/MDSLINKREF values as
// recovered source records.
const reconstructedGuide = {
  name: 'RECONSTRUCTED GUIDE SL-1847103',
  type: 'SUPPORT',
  attributes: {
    NAME: '/SL-1847103.1.2',
    TYPE: 'ANCI',
    MDSLINKREF: '/SL-1847103.1.1',
    CMPSUPREFN: 'SL-1847103 (REF)',
    CMPSUPTYPE: 'PG-S-3',
    MDSSUPPFUNC: 'GT',
    MDSSUPPTYPE: 'GT500',
    CMPSUPGAP: 'GAP=10mm',
    POS: { x: 854513.44, y: 3934222.04, z: 6100 },
  },
};
const reconstructedLineStop = {
  name: 'RECONSTRUCTED LINESTOP SL-1847103',
  type: 'SUPPORT',
  attributes: {
    NAME: '/SL-1847103.1.3',
    TYPE: 'ANCI',
    MDSLINKREF: '/SL-1847103.1.1',
    CMPSUPREFN: 'SL-1847103 (REF)',
    CMPSUPTYPE: 'LS-S2-3',
    MDSSUPPFUNC: 'ST',
    MDSSUPPTYPE: 'ST501',
    CMPSUPGAP: 'GAP=35mm',
    POS: { x: 854513.44, y: 3934222.04, z: 6100 },
  },
};

function benchmarkNode(xml, nodeName) {
  const blocks = xml.match(/<Node>\s*[\s\S]*?<\/Node>/g) || [];
  const block = blocks.find((candidate) => candidate.includes(`<NodeName>${nodeName}</NodeName>`));
  assert.ok(block, `benchmark node ${nodeName} must exist`);
  const value = (tag) => block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`))?.[1]?.trim() || '';
  const pos = value('Position').split(/\s+/).map(Number);
  return {
    nodeNumber: Number(value('NodeNumber')),
    nodeName: value('NodeName'),
    componentType: value('ComponentType'),
    componentRefNo: value('ComponentRefNo'),
    position: { x: pos[0], y: pos[1], z: pos[2] },
  };
}

test('SYS-0010 real node and exact reported REST align at +100000 mm Z', () => {
  const xml = fs.readFileSync('Benchmarks/css/SYS-0010.xml', 'utf8');
  const node = benchmarkNode(xml, 'SL-1847103.2.1');
  assert.deepEqual(node, {
    nodeNumber: 140,
    nodeName: 'SL-1847103.2.1',
    componentType: 'ANCI',
    componentRefNo: '=1006649732/144940',
    position: { x: 854513.44, y: 3934222.04, z: 106100 },
  });

  assert.equal(normalizeSupportIdentity(exactRestFromReportedStagedJson.attributes.NAME, config), 'SL-1847103.2.1');
  const relationship = sourceRelationshipEvidence(exactRestFromReportedStagedJson, config);
  assert.equal(relationship.conflict, false);
  assert.deepEqual(relationship.roots, ['SL-1847103']);

  const stagedPosition = readSourcePosition(exactRestFromReportedStagedJson, config);
  assert.deepEqual(stagedPosition.rawPoint, { x: 854513.44, y: 3934222.04, z: 6100 });
  assert.deepEqual(stagedPosition.point, node.position);
});

test('benchmark-anchored reconstructed family resolves member-owned GUI=10 and LIM=35', () => {
  const staged = JSON.stringify({
    name: 'SL-1847103 qualification family',
    type: 'BRANCH',
    children: [exactRestFromReportedStagedJson, reconstructedGuide, reconstructedLineStop],
  });
  const diagnostics = [];
  const index = buildStagedSupportIndex(staged, config, diagnostics);
  const matches = index.byTag.get('SL-1847103.2.1') || [];
  assert.equal(matches.length, 3);

  const entries = matches.flatMap((match) => xmlCiiRestraintEntriesFromSupportMatch(match, null, config));
  const guide = entries.find((entry) => entry.type === 'GUI');
  const stop = entries.find((entry) => entry.type === 'LIM');
  assert.ok(guide, 'GUIDE restraint must be generated');
  assert.ok(stop, 'LINESTOP restraint must be generated');
  assert.equal(guide.gap, '10');
  assert.equal(guide.cmpSupGap, 'GAP=10mm');
  assert.equal(stop.gap, '35');
  assert.equal(stop.cmpSupGap, 'GAP=35mm');
});
