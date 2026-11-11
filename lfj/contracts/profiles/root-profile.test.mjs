// R01 independently authored source/profile oracle — fixtures are illustrative, not owner-real 30 MB/90 MB goldens.
// RED baseline: with LFJ_R01_LEGACY_RED=1 this file exercises the EXISTING application normalizer.
// GREEN candidate: normally exercises the new separate root/profile contract; no integration app gets modified.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Before R01 code is introduced, exercise the real existing consumer implementation.
// Re-run it later with LFJ_R01_LEGACY_RED=1; only an absent candidate triggers fallback.
let legacy = process.env.LFJ_R01_LEGACY_RED === '1';
let candidate;
if (!legacy) {
  try { candidate = await import('./root-profile.mjs'); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !String(error.message).includes('root-profile.mjs')) throw error;
    legacy = true;
  }
}
if (legacy) candidate = await import('../../../contracts/stagedjson-contract.js');

const inspect = legacy
  ? (root) => {
      const result = candidate.normalizeStagedJson(root);
      return {
        profileId: 'staged-generic/v1',
        rootKind: Array.isArray(root) ? 'array' : root?.hierarchy ? 'hierarchy' : root?.objects ? 'objects' : 'typed-single',
        rootPath: Array.isArray(root) ? '$' : root?.hierarchy ? '$.hierarchy' : root?.objects ? '$.objects' : '$',
        capabilities: { read: true, index: true, view: true, edit: false, export: false },
        occurrenceHint: result.branches.length,
      };
    }
  : candidate.inspectStructuredJsonRoot;

const n = (id) => ({ type: 'BRANCH', name: id, children: [], attributes: { OWNER_ZONE: 'Z1' } });
const a = [n('/B1'), n('/B2')];
const markup = {
  schema: 'inputxml-managed-stage/v1',
  profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
  converter: 'INPUTXML->STAGEDJSON',
  converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
  units: { length: 'mm' },
  hierarchy: a,
  stats: { components: 2, children: 2 },
  sourceHeader: { original: 'BM_CII_INPUT.XML' },
};

const typedCode = (fn) => {
  try { fn(); return 'DID_NOT_REJECT'; }
  catch (error) { return error.code || 'UNTYPED_FAILURE'; }
};

test('U01 bare AVEVA array is structurally readable without inventing a named envelope', () => {
  const info = inspect(a);
  assert.equal(info.rootKind, 'array');
  assert.equal(info.rootPath, '$');
  assert.equal(info.capabilities.read, true);
});

for (const key of ['hierarchy', 'objects', 'branches']) {
  test(`U01 explicit envelope ${key} is recognized with its original accessor`, () => {
    const root = { [key]: a, source: 'source-preserved' };
    const info = inspect(root);
    assert.equal(info.rootKind, key);
    assert.equal(info.rootPath, `$.${key}`);
  });
}

test('U01 typed-single BRANCH root is distinct from an array envelope', () => {
  const info = inspect(n('/B0'));
  assert.equal(info.rootKind, 'typed-single');
  assert.equal(info.rootPath, '$');
});

test('U02 known markup producer profile remains distinct from shape-only staging', () => {
  const info = inspect(markup);
  assert.equal(info.profileId, 'managed-stage-markup-rich/v2');
  assert.equal(info.rootKind, 'hierarchy');
  assert.equal(info.capabilities.view, true);
  assert.equal(info.capabilities.export, false, 'R19 must independently qualify export authority');
});

for (const [label, mutate, code] of [
  ['profile', (x) => { x.profile = 'OTHER_VIEWER'; }, 'UNSUPPORTED_PROFILE'],
  ['converter', (x) => { x.converter = 'INPUTXML->GLB'; }, 'CONVERTER_MISMATCH'],
  ['converterSchema', (x) => { x.converterSchema = 'inputxml-basic-glb/v1'; }, 'CONVERTER_MISMATCH'],
  ['units', (x) => { x.units.length = 'm'; }, 'UNITS_MISMATCH'],
]) {
  test(`U02 markup rich topology refuses incompatible ${label}`, () => {
    const bad = structuredClone(markup);
    mutate(bad);
    assert.equal(typedCode(() => inspect(bad)), code);
  });
}

test('U03 two different root array paths are ambiguous, not first-match accepted', () => {
  assert.equal(typedCode(() => inspect({ hierarchy: [n('H')], objects: [n('O')] })), 'AMBIGUOUS_ROOT');
});

test('U03 a declared future schema is never accepted merely because a root key matches', () => {
  assert.equal(typedCode(() => inspect({ schema: 'inputxml-managed-stage/v4', objects: a })), 'UNSUPPORTED_SCHEMA');
});

test('U03 unknown object/scalar/null must fail rather than return an empty branch list', () => {
  for (const root of [{ someUnknown: [n('X')] }, 42, '[]', null]) {
    assert.equal(typedCode(() => inspect(root)), 'UNSUPPORTED_ROOT');
  }
});

test('U03 inherited collection is not an actual source envelope property', () => {
  const forged = Object.create({ hierarchy: a });
  assert.equal(typedCode(() => inspect(forged)), 'UNSUPPORTED_ROOT');
});

test('U02 inherited markup profile does not impersonate a declared source profile', () => {
  const source = Object.assign(Object.create({ profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER' }), {
    schema: 'inputxml-managed-stage/v1',
    converter: 'INPUTXML->STAGEDJSON',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    hierarchy: a,
  });
  assert.equal(inspect(source).profileId, 'staged-generic/v1');
});

test('U02 inherited converter cannot satisfy a strict declared markup profile', () => {
  const source = Object.assign(Object.create({ converter: 'INPUTXML->STAGEDJSON' }), {
    schema: 'inputxml-managed-stage/v1',
    profile: 'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    converterSchema: 'inputxml-direct-managed-stage/v2-rich-topology',
    units: { length: 'mm' },
    hierarchy: a,
  });
  assert.equal(typedCode(() => inspect(source)), 'CONVERTER_MISMATCH');
});

test('U03 no source envelope key, unknown field, record or occurrence is rewritten', () => {
  const root = { hierarchy: a, unknownProducerField: { x: ['unchanged'] }, flags: [true, false] };
  const before = JSON.stringify(root);
  const info = inspect(root);
  assert.equal(info.rootKind, 'hierarchy');
  assert.equal(JSON.stringify(root), before);
  assert.deepEqual(root.unknownProducerField, { x: ['unchanged'] });
  assert.equal(root.hierarchy[0].name, '/B1');
});

test('U04 shape-compatible staging may be read/viewed but not implicitly engineered/exported', () => {
  for (const root of [a, { objects: a }, { branches: a }, { hierarchy: a }]) {
    const caps = inspect(root).capabilities;
    assert.equal(caps.read, true);
    assert.equal(caps.index, true);
    assert.equal(caps.view, true);
    assert.equal(caps.edit, false);
    assert.equal(caps.export, false);
  }
});

test('U04 strict markup profile remains export-ineligible without an independent R19 result', () => {
  const caps = inspect(markup).capabilities;
  assert.equal(caps.edit, false);
  assert.equal(caps.export, false);
});
