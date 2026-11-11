import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeSupportIdentity,
  readSourceField,
  readSourcePosition,
  sourceFieldEvidence,
  sourceRelationshipEvidence,
  sourceSupportIdentities,
  validateSourceSchemaConfig,
} from '../converters/xml-cii2019-core/source-schema-adapter.js';

function profile(overrides = {}) {
  return {
    sourceSchema: {
      enabled: true,
      profileId: 'AUTHORITY-GUARD-TEST',
      fieldConflictPolicy: 'REJECT',
      fields: {
        objectName: ['OBJECT_ID'],
        supportGroupRef: ['GROUP_ID'],
        directLink: ['LINK_ID'],
        position: ['XYZ'],
        ...overrides.fields,
      },
      identity: {
        supportPrefixes: ['SL'],
        hyphenPolicy: 'REQUIRED',
        maxHierarchyDepth: 2,
        hierarchyMatch: 'EXACT_ONLY',
        matchBoundary: 'FULL_TOKEN',
        ...overrides.identity,
      },
      relationships: {
        identityRoles: ['objectName'],
        groupRoles: ['supportGroupRef'],
        linkRoles: ['directLink'],
        expandIdentityToGroup: true,
        objectNameIsGroupAuthority: false,
        conflictPolicy: 'REJECT',
        ...overrides.relationships,
      },
      coordinates: {
        authority: 'CORROBORATION_ONLY',
        coordinateOnlyFallback: false,
        ...overrides.coordinates,
      },
    },
  };
}

test('omitted explicit-profile field does not fall back to legacy alias', () => {
  const config = profile({ fields: { directLink: undefined } });
  delete config.sourceSchema.fields.directLink;
  const value = {
    attributes: {
      OBJECT_ID: '/SL-100.1',
      GROUP_ID: 'SL-100 (REF)',
      MDSLINKREF: '/SL-999.1',
    },
  };
  assert.equal(readSourceField(value, 'directLink', config), '');
  const relation = sourceRelationshipEvidence(value, config);
  assert.equal(relation.conflict, false);
  assert.deepEqual(relation.roots, ['SL-100']);
});

test('object name is identity but not group authority', () => {
  const config = profile();
  const value = {
    attributes: {
      OBJECT_ID: '/SL-100.1.2',
      GROUP_ID: 'SL-100 (REF)',
      LINK_ID: '/SL-100.1.1',
    },
  };
  assert.deepEqual(sourceSupportIdentities(value, config), ['SL-100.1.2']);
  assert.deepEqual(sourceRelationshipEvidence(value, config).roots, ['SL-100']);
});

test('identity cannot exceed configured depth or token boundary', () => {
  const config = profile();
  assert.equal(normalizeSupportIdentity('/SL-100.1.2', config), 'SL-100.1.2');
  assert.equal(normalizeSupportIdentity('/SL-100.1.2.3', config), '');
  assert.equal(normalizeSupportIdentity('XSL-100.1', config), '');
  assert.equal(normalizeSupportIdentity('SL100.1', config), '');
});

test('relationship root conflict rejects all group authority', () => {
  const config = profile();
  const relation = sourceRelationshipEvidence({
    attributes: {
      OBJECT_ID: '/SL-100.1',
      GROUP_ID: 'SL-100 (REF)',
      LINK_ID: '/SL-200.1',
    },
  }, config);
  assert.equal(relation.conflict, true);
  assert.equal(relation.rejected, true);
  assert.deepEqual(relation.roots, []);
});

test('object-valued position aliases are compared structurally and conflicting coordinates fail closed', () => {
  const config = profile({ fields: { position: ['POS', 'POSI'] } });
  const value = {
    attributes: {
      POS: { x: 100, y: 200, z: 300 },
      POSI: { x: 100, y: 200, z: 400 },
    },
  };
  const evidence = sourceFieldEvidence(value, 'position', config);
  assert.equal(evidence.conflict, true);
  assert.equal(evidence.distinctValues.length, 2);
  assert.equal(readSourcePosition(value, config), null);
});

test('equivalent object-valued aliases with different property order do not create a false conflict', () => {
  const config = profile({ fields: { position: ['POS', 'POSI'] } });
  const value = {
    attributes: {
      POS: { x: 100, y: 200, z: 300 },
      POSI: { z: 300, x: 100, y: 200 },
    },
  };
  const evidence = sourceFieldEvidence(value, 'position', config);
  assert.equal(evidence.conflict, false);
  assert.deepEqual(readSourcePosition(value, config)?.rawPoint, { x: 100, y: 200, z: 300 });
});

test('invalid explicit grammar fails qualification rather than widening defaults', () => {
  const config = profile();
  delete config.sourceSchema.identity.maxHierarchyDepth;
  const result = validateSourceSchemaConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('maxHierarchyDepth')));
});
