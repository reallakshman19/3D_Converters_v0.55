// Independent LFJ R05/U03 golden: UTF-8 spans, exact own-attribute object references.
// Expectations are hand-frozen, not computed from LFJ index/token output.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';
import {resolveSourceOwners} from '../adapters/ownership/source-ownership.mjs';

const input = String.raw`{"hierarchy":[{"type":"BRANCH","name":"β💡","children":[{"type":"PIPE","name":"~/x","attributes":{"OWNER_ZONE":"CHILD"}}],"attributes":{"OWNER_ZONE":"ROOT"}}],"note":"a\\\"},]"}`;
const EXPECTED = Object.freeze({
  root: [0, 180],
  branch: [14, 160],
  child: [59, 123],
  name: [38, 46],
  childAttrs: [100, 122],
  branchAttrs: [138, 159],
});
const utf8 = value => new TextEncoder().encode(value);

function makeSnapshot(text) {
  const bytes = utf8(text);
  const builder = createSourceSnapshotBuilder({
    byteLength: bytes.length, revision: 'u03-independent-byte-golden',
  });
  // Split UTF-8 sequences and source delimiters across R03 chunks.
  for (let n = 0; n < bytes.length; n += 3)
    builder.append(bytes.subarray(n, n + 3), n);
  return builder.finalize();
}
async function events(source) {
  const pages = [];
  const summary = await streamJsonOccurrenceEvents(source, {
    sourceRefId: 'PL01', pageBytes: 65536, sourceReadPageBytes:1, pageEvents: 2,
    onEventPage: async page => pages.push(page),
  });
  return { all: pages.flat(), summary };
}
function at(all, kind, path) {
  const opened = all.find(e => e.kind === 'OPEN' && e.path === path);
  assert.ok(opened, 'missing independently specified source occurrence: ' + path);
  if (kind === 'OPEN') return opened;
  const sealed = all.find(e => e.kind === 'SEAL' && e.occurrenceId === opened.occurrenceId);
  assert.ok(sealed, 'unsealed source occurrence: ' + path);
  return sealed;
}
function verifySpan(all, path, expected) {
  const open = at(all, 'OPEN', path), seal = at(all, 'SEAL', path);
  assert.deepEqual([open.startByte, seal.endByteExclusive], expected, path);
  return { open, seal };
}
test('U03 RED: exact independent original-byte spans of nested UTF-8 JSON values', async () => {
  const source = makeSnapshot(input);
  try {
    assert.equal(source.byteLength, 180, 'independent byte length');
    const {all, summary} = await events(source);
    assert.equal(summary.complete, true);
    verifySpan(all, '', EXPECTED.root);
    const branch = verifySpan(all, '/hierarchy/0', EXPECTED.branch);
    const child = verifySpan(all, '/hierarchy/0/children/0', EXPECTED.child);
    verifySpan(all, '/hierarchy/0/name', EXPECTED.name);
    verifySpan(all, '/hierarchy/0/children/0/attributes', EXPECTED.childAttrs);
    verifySpan(all, '/hierarchy/0/attributes', EXPECTED.branchAttrs);
    assert.equal(child.open.parentId, at(all, 'OPEN', '/hierarchy/0/children').occurrenceId);
    assert.equal(branch.open.parentId, at(all, 'OPEN', '/hierarchy').occurrenceId);
    const note = verifySpan(all, '/note', [169, 179]);
    assert.equal(note.open.parentId, at(all, 'OPEN', '').occurrenceId);
  } finally { source.close(); }
});

test('U03 RED: attributes belong ONLY to their exact parent, never an embedded descendant', async () => {
  const source = makeSnapshot(input);
  try {
    const {all} = await events(source);
    const branch = at(all, 'OPEN', '/hierarchy/0');
    const child = at(all, 'OPEN', '/hierarchy/0/children/0');
    const ownBranch = at(all, 'SEAL', '/hierarchy/0/attributes');
    const ownChild = at(all, 'SEAL', '/hierarchy/0/children/0/attributes');
    // This explicit source-local reference does not itself grant engineering rights.
    assert.deepEqual(ownBranch.ownAttributes, {
      ownerOccurrenceId: branch.occurrenceId,
      startByte: 138, endByteExclusive: 159,
    });
    assert.deepEqual(ownChild.ownAttributes, {
      ownerOccurrenceId: child.occurrenceId,
      startByte: 100, endByteExclusive: 122,
    });
    assert.equal(at(all, 'SEAL', '/hierarchy/0/children').ownAttributes, undefined);
    const originalBytes = utf8(input);
    const own = seal => {
      const ref = seal.ownAttributes;
      return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(
        originalBytes.subarray(ref.startByte, ref.endByteExclusive)));
    };
    const resolved = resolveSourceOwners([
      {sourceId:'PL01', occurrenceId:branch.occurrenceId, parentOccurrenceId:null,
       type:'BRANCH', name:'β💡', attributes:own(ownBranch)},
      {sourceId:'PL01', occurrenceId:child.occurrenceId, parentOccurrenceId:branch.occurrenceId,
       type:'PIPE', name:'~/x', attributes:own(ownChild)},
    ]);
    assert.equal(resolved[0].ownerZone, 'ROOT');
    assert.equal(resolved[0].ownerZoneSource, branch.occurrenceId);
    assert.equal(resolved[1].ownerZone, 'CHILD');
    assert.equal(resolved[1].ownerZoneSource, child.occurrenceId);
    assert.equal(resolved[0].engineeringReady, false);
  } finally { source.close(); }
});
