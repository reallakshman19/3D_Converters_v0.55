import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeSupportIdentity,
  readSourceField,
  readSourcePosition,
  sourceAuthorityPolicy,
  sourceRelationshipEvidence,
  sourceSchemaEnabled,
  sourceSupportIdentities,
  sourceTopologyIdentities,
  validateSourceSchemaConfig,
} from '../converters/xml-cii2019-core/source-schema-adapter.js';
import {
  buildStagedSupportIndex,
  xmlCiiRestraintEntriesFromSupportMatch,
} from '../converters/xml-cii2019-core/support-mapping.js';
import {
  buildStagedDtxrIndex,
  buildStagedDtxrPositionIndex,
  xmlCiiCalibrateDtxrPositionIndex,
} from '../converters/xml-cii2019-core/dtxr-resolver-core.js';

const config = {
  coordinateTolerance: 1,
  useRestraintTypeBasedOnJson: true,
  sourceSchema: {
    enabled: true,
    profileId: 'TEST_MDS_STRICT_V1',
    fieldConflictPolicy: 'REJECT',
    fields: {
      objectName: ['OBJ_NAME'],
      objectType: ['OBJ_TYPE'],
      directLink: ['LINK_TO'],
      supportGroupRef: ['SUPPORT_GROUP'],
      parentRef: ['PARENT'],
      previousRef: ['PREVIOUS'],
      componentRef: ['REF_NO'],
      supportType: ['SUPPORT_CODE'],
      supportFunction: ['SUPPORT_FUNCTION'],
      supportGap: ['CLEARANCE'],
      dtxr: ['DESCRIPTION_TEXT'],
      position: ['XYZ'],
    },
    identity: {
      supportPrefixes: ['PS', 'SL'],
      hyphenPolicy: 'OPTIONAL',
      maxHierarchyDepth: 2,
      hierarchyMatch: 'EXACT_ONLY',
      matchBoundary: 'FULL_TOKEN',
    },
    relationships: {
      identityRoles: ['objectName', 'supportTag'],
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
    applyToFields: ['XYZ'],
    matchToleranceMm: 6,
  },
};

const coordinate = { x: 854513.44, y: 3934222.04, z: 6100 };
const staged = JSON.stringify({
  name: 'SUPPORT SL-1847103 (REF)',
  type: 'BRANCH',
  attributes: { PARENT: '/ASIM/BRANCH' },
  children: [
    {
      name: 'REST',
      type: 'SUPPORT',
      attributes: {
        OBJ_NAME: '/SL-1847103.2.1',
        OBJ_TYPE: 'ANCI',
        SUPPORT_GROUP: 'SL-1847103 (REF)',
        LINK_TO: '/SL-1847103.1.1',
        SUPPORT_CODE: 'PIPE-REST',
        SUPPORT_FUNCTION: 'PIPE-REST',
        DESCRIPTION_TEXT: 'REST',
        REF_NO: '=1006649732/143989',
        XYZ: coordinate,
      },
    },
    {
      name: 'GUIDE',
      type: 'SUPPORT',
      attributes: {
        OBJ_NAME: '/SL-1847103.1.2',
        OBJ_TYPE: 'ANCI',
        SUPPORT_GROUP: 'SL-1847103 (REF)',
        LINK_TO: '/SL-1847103.1.1',
        SUPPORT_CODE: 'GT500',
        SUPPORT_FUNCTION: 'GT',
        DESCRIPTION_TEXT: 'GUIDE',
        CLEARANCE: 'GAP=10mm',
        XYZ: coordinate,
      },
    },
    {
      name: 'LINESTOP',
      type: 'SUPPORT',
      attributes: {
        OBJ_NAME: '/SL-1847103.1.3',
        OBJ_TYPE: 'ANCI',
        SUPPORT_GROUP: 'SL-1847103 (REF)',
        LINK_TO: '/SL-1847103.1.1',
        SUPPORT_CODE: 'ST501',
        SUPPORT_FUNCTION: 'ST',
        DESCRIPTION_TEXT: 'LINE STOP',
        CLEARANCE: 'GAP=35mm',
        XYZ: coordinate,
      },
    },
  ],
});

test('new source-schema authority is opt-in and incomplete explicit grammar is rejected', () => {
  assert.equal(sourceSchemaEnabled({}), false);
  assert.equal(normalizeSupportIdentity('PS03568.2', {}), '');
  const invalid = validateSourceSchemaConfig({ sourceSchema: { enabled: true, identity: { supportPrefixes: ['SL'] } } });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((message) => message.includes('hyphenPolicy')));
});

test('configured identity grammar accepts only explicitly-authorized forms and exact hierarchy', () => {
  assert.equal(normalizeSupportIdentity('/SL-1847103.2.1', config), 'SL-1847103.2.1');
  assert.equal(normalizeSupportIdentity('PS03568.2', config), 'PS-03568.2');
  assert.equal(normalizeSupportIdentity('XSL-1847103.2.1', config), '');
  assert.equal(normalizeSupportIdentity('/SL-1847103.2.1.9', config), '');
  const identities = sourceSupportIdentities({ attributes: { OBJ_NAME: '/SL-1847103.2.1' } }, config);
  assert.deepEqual(identities, ['SL-1847103.2.1']);
});

test('configured source position applies manual Z offset only through the configured field', () => {
  const resolved = readSourcePosition({ attributes: { XYZ: coordinate } }, config);
  assert.deepEqual(resolved.rawPoint, coordinate);
  assert.deepEqual(resolved.point, { ...coordinate, z: 106100 });
  assert.equal(resolved.field, 'XYZ');
  assert.equal(resolved.alignment.matchToleranceMm, 6);
});

test('explicit support group/link expands an exact identity only when profile authorizes expansion', () => {
  const diagnostics = [];
  const index = buildStagedSupportIndex(staged, config, diagnostics);
  assert.equal(index.count, 3);

  const byExactName = index.byTag.get('SL-1847103.2.1') || [];
  assert.equal(byExactName.length, 3);
  assert.deepEqual(new Set(byExactName.map((item) => item.primaryKind)), new Set(['REST', 'GUIDE', 'LINESTOP']));

  const coordKey = [854513.44, 3934222.04, 106100].map((value) => Math.round(value / 6)).join('|');
  const byCoordinate = index.byCoord.get(coordKey) || [];
  assert.equal(byCoordinate.length, 3);

  const guide = byExactName.find((item) => item.primaryKind === 'GUIDE');
  const stop = byExactName.find((item) => item.primaryKind === 'LINESTOP');
  const guideEntry = xmlCiiRestraintEntriesFromSupportMatch(guide, null, config)[0];
  const stopEntry = xmlCiiRestraintEntriesFromSupportMatch(stop, null, config)[0];
  assert.equal(guideEntry.type, 'GUI');
  assert.equal(guideEntry.gap, '10');
  assert.equal(guideEntry.cmpSupGap, 'GAP=10mm');
  assert.equal(stopEntry.type, 'LIM');
  assert.equal(stopEntry.gap, '35');
  assert.equal(stopEntry.cmpSupGap, 'GAP=35mm');
});

test('same exact identity does not expand if expandIdentityToGroup is disabled', () => {
  const strict = structuredClone(config);
  strict.sourceSchema.relationships.expandIdentityToGroup = false;
  const index = buildStagedSupportIndex(staged, strict, []);
  const hits = index.byTag.get('SL-1847103.2.1') || [];
  assert.equal(hits.length, 1);
  assert.equal(hits[0].primaryKind, 'REST');
});

test('conflicting supportGroupRef and directLink roots are rejected instead of bridged', () => {
  const value = {
    attributes: {
      OBJ_NAME: '/SL-1847103.2.1',
      SUPPORT_GROUP: 'SL-1847103 (REF)',
      LINK_TO: '/SL-999999.1.1',
    },
  };
  const relationship = sourceRelationshipEvidence(value, config);
  assert.equal(relationship.conflict, true);
  assert.equal(relationship.rejected, true);
  assert.deepEqual(relationship.roots, []);
});

test('conflicting aliases fail closed instead of depending on JSON property order', () => {
  const conflicted = structuredClone(config);
  conflicted.sourceSchema.fields.supportType = ['SUPPORT_CODE', 'ALT_SUPPORT_CODE'];
  const value = { attributes: { ALT_SUPPORT_CODE: 'ST501', SUPPORT_CODE: 'GT500' } };
  assert.equal(readSourceField(value, 'supportType', conflicted), '');
});

test('DTXR indexes use same strict field adapter and keep member-owned gaps plural', () => {
  const index = buildStagedDtxrIndex(staged, config);
  const relationHits = index.byPsTag.get('SL-1847103.2.1') || [];
  assert.equal(relationHits.length, 3);
  assert.ok(relationHits.some((item) => item.cmpSupGap === 'GAP=35mm'));

  const positionIndex = buildStagedDtxrPositionIndex(staged, config);
  assert.equal(positionIndex.count, 3);
  assert.ok(positionIndex.entries.every((entry) => entry.point.z === 106100));
  assert.ok(positionIndex.entries.some((entry) => entry.cmpSupGap === 'GAP=35mm'));
});

test('support identity excludes topology while topology remains separately traceable', () => {
  const value = {
    attributes: {
      OBJ_NAME: '/SL-1844032.1.3',
      SUPPORT_GROUP: 'SL-1844032 (REF)',
      LINK_TO: '/SL-1844032.1.1',
      PREVIOUS: 'PS01716.3',
      PARENT: '/SL-999999.1',
    },
  };
  const identities = sourceSupportIdentities(value, config);
  assert.deepEqual(identities, ['SL-1844032.1.3']);

  const topology = sourceTopologyIdentities(value, config);
  assert.ok(topology.includes('PS-01716.3'));
  assert.ok(topology.includes('SL-999999.1'));
});

test('coordinate-only authority is disabled by default in explicit profile', () => {
  const policy = sourceAuthorityPolicy(config);
  assert.equal(policy.coordinateAuthority, 'CORROBORATION_ONLY');
  assert.equal(policy.coordinateOnlyFallback, false);
});

test('one physical support family cannot satisfy three-sample AUTO calibration', () => {
  const autoConfig = structuredClone(config);
  autoConfig.coordinateAlignment = {
    mode: 'AUTO',
    applyToFields: ['XYZ'],
    matchToleranceMm: 6,
    calibrationToleranceMm: 1,
    minimumCalibrationSamples: 3,
    scope: 'GLOBAL',
  };
  const positionIndex = buildStagedDtxrPositionIndex(staged, autoConfig);
  const document = {
    getElementsByTagName(name) {
      if (name !== 'Node') return [];
      return [{
        NodeNumber: '140',
        NodeName: 'SL-1847103.2.1',
        ComponentRefNo: '=1006649732/144940',
        Position: '854513.44 3934222.04 106100',
      }];
    },
  };
  const calibrated = xmlCiiCalibrateDtxrPositionIndex(positionIndex, document, autoConfig);
  assert.equal(calibrated.inferredOffset, undefined);
  assert.equal(calibrated.calibrationRejected, 'INSUFFICIENT_INDEPENDENT_SUPPORT_GROUPS');
});
