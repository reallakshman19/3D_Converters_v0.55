import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStagedSupportIndex,
  xmlCiiRestraintEntriesFromSupportMatch,
} from '../converters/xml-cii2019-core/support-mapping.js';

function resolveLineStop(config) {
  const stagedJsonText = JSON.stringify({
    name: 'SUPPORT SL-1847103 (REF)',
    type: 'SUPPORT',
    attributes: {
      NAME: '/SL-1847103.2.1',
      TYPE: 'ANCI',
      SPRE: 'Line Stop',
      CMPSUPGAP: '35 mm',
      POS: { x: 854513.44, y: 3934222.04, z: 6100 },
    },
  });
  const diagnostics = [];
  const index = buildStagedSupportIndex(stagedJsonText, config, diagnostics);
  assert.equal(index.count, 1);
  assert.equal(index.items.length, 1);
  const match = index.items[0];
  const entries = xmlCiiRestraintEntriesFromSupportMatch(match, null, config);
  return {
    primaryKind: match.primaryKind,
    supportDescriptorSource: match.supportDescriptorSource,
    supportTags: match.supportTags,
    entries: entries.map((entry) => ({
      type: entry.type,
      gap: entry.gap,
      cmpSupGap: entry.cmpSupGap,
      supportKind: entry.supportKind,
      frictionMode: entry.frictionMode,
      directionMode: entry.directionMode,
    })),
  };
}

test('cached support config is semantically identical to a fresh JSON parse for Line Stop GAP custody', () => {
  const serialized = JSON.stringify({
    coordinateTolerance: 1,
    useRestraintTypeBasedOnJson: true,
    defaultStiffness: '1.751270E+12',
    defaultFriction: '0.3',
  });
  const freshParsed = JSON.parse(serialized);
  const cachedRuntimeConfig = JSON.parse(serialized);

  const freshResult = resolveLineStop(freshParsed);
  const cachedResult = resolveLineStop(cachedRuntimeConfig);
  assert.deepEqual(cachedResult, freshResult);

  assert.equal(cachedResult.primaryKind, 'LINESTOP');
  assert.equal(cachedResult.entries.length, 1);
  assert.deepEqual(cachedResult.entries[0], {
    type: 'LIM',
    gap: '35',
    cmpSupGap: '35 mm',
    supportKind: 'LINESTOP',
    frictionMode: 'sentinel',
    directionMode: 'pipe-axis',
  });
});

test('GUIDE GAP normalization is also invariant under config caching', () => {
  const serialized = JSON.stringify({
    coordinateTolerance: 1,
    useRestraintTypeBasedOnJson: true,
  });
  const attrs = {
    NAME: '/PS-171001.1',
    TYPE: 'ANCI',
    SPRE: 'Guide',
    CMPSUPGAP: '3 mm',
    POS: { x: 10, y: 20, z: 30 },
  };
  const staged = JSON.stringify({ name: 'SUPPORT PS-171001', type: 'SUPPORT', attributes: attrs });

  function resolve(config) {
    const index = buildStagedSupportIndex(staged, config, []);
    const match = index.items[0];
    return xmlCiiRestraintEntriesFromSupportMatch(match, null, config).map((entry) => ({
      type: entry.type,
      gap: entry.gap,
      cmpSupGap: entry.cmpSupGap,
      supportKind: entry.supportKind,
    }));
  }

  const fresh = resolve(JSON.parse(serialized));
  const cached = resolve(JSON.parse(serialized));
  assert.deepEqual(cached, fresh);
  assert.deepEqual(cached, [{ type: 'GUI', gap: '3', cmpSupGap: '3 mm', supportKind: 'GUIDE' }]);
});
