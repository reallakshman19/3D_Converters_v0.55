import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_SCOPE_ID,
  buildJsonHierarchyScopeIndex,
  jsonHierarchyScopeOptions,
  materializeJsonHierarchyScope,
} from '../tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js';

const branch = (name, site, marker) => ({
  name,
  type: 'BRANCH',
  attributes: { OWNER_SITE: site, POS: { x: marker, y: 0, z: 0 } },
  children: [{ type: 'ATTA', name: 'PS-' + marker, attributes: { DTXR: 'REST-' + marker } }],
});

test('root branch array indexes first-seen OWNER_SITE scopes without raw payload retention', () => {
  const source = JSON.stringify([
    branch('/A/B1', '/SITE-A', 1),
    branch('/A/B2', '/SITE-A', 2),
    branch('/B/B1', '/SITE-B', 3),
  ]);
  const index = buildJsonHierarchyScopeIndex(source);
  assert.equal(index.indexable, true);
  assert.equal(index.strategy, 'root-array');
  assert.equal(index.itemCount, 3);
  assert.equal(index.defaultScopeId, '/SITE-A');
  assert.deepEqual(index.scopes.map(({ id, itemCount }) => ({ id, itemCount })), [
    { id: '/SITE-A', itemCount: 2 },
    { id: '/SITE-B', itemCount: 1 },
  ]);
  assert.equal(JSON.stringify(index).includes('REST-1'), false);
});

test('selected scope parses only its indexed top-level items', () => {
  const source = JSON.stringify([
    branch('/A/B1', '/SITE-A', 1),
    branch('/B/B1', '/SITE-B', 3),
  ]);
  const index = buildJsonHierarchyScopeIndex(source);
  const selected = materializeJsonHierarchyScope(source, index, '/SITE-B');
  assert.equal(selected.itemCount, 1);
  assert.equal(selected.value.length, 1);
  assert.equal(selected.value[0].name, '/B/B1');
});

test('root object children array recognizes explicit ZONE containers', () => {
  const source = JSON.stringify({
    type: 'PROJECT',
    children: [
      { type: 'ZONE', name: 'ZONE-A', children: [branch('/A/B1', '/SITE-A', 1)] },
      { type: 'ZONE', name: 'ZONE-B', children: [branch('/B/B1', '/SITE-B', 2)] },
    ],
  });
  const index = buildJsonHierarchyScopeIndex(source);
  assert.equal(index.strategy, 'root-children-array');
  assert.deepEqual(index.scopes.map((scope) => scope.id), ['ZONE-A', 'ZONE-B']);
  assert.equal(materializeJsonHierarchyScope(source, index, 'ZONE-A').value[0].name, 'ZONE-A');
});

test('unsupported shape stays explicit and falls back to all-source JSON', () => {
  const source = JSON.stringify({ type: 'PROJECT', payload: { value: 1 } });
  const index = buildJsonHierarchyScopeIndex(source);
  assert.equal(index.indexable, false);
  assert.equal(index.defaultScopeId, ALL_SCOPE_ID);
  assert.deepEqual(materializeJsonHierarchyScope(source, index, ''), {
    scopeId: ALL_SCOPE_ID,
    value: JSON.parse(source),
    itemCount: 0,
  });
});

test('scope options keep explicit All scopes after bounded scopes', () => {
  const source = JSON.stringify([branch('/A/B1', '/SITE-A', 1)]);
  const options = jsonHierarchyScopeOptions(buildJsonHierarchyScopeIndex(source));
  assert.deepEqual(options.map((item) => item.id), ['/SITE-A', ALL_SCOPE_ID]);
});
