// LFJ R03 precommitted independent byte oracle; NOT a 30/90 MB performance golden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSourceSnapshotBuilder, SourceSnapshotError } from './source-snapshot.mjs';

const utf8 = (s) => new TextEncoder().encode(s);
const digest = (b) => createHash('sha256').update(b).digest('hex');
const code = (fn) => { try { fn(); return 'NO_ERROR'; } catch (error) { return error.code || 'UNTYPED'; } };
const take = (data, expectedSha256, revision = 'source-1') => {
  const builder = createSourceSnapshotBuilder({ byteLength: data.length, expectedSha256, revision, maxChunkBytes: 32 });
  for (let i = 0; i < data.length; i += 7) builder.append(data.subarray(i, i + 7), i);
  return builder.finalize();
};

test('U01 exact bytes and independent SHA256 vector', () => {
  for (const txt of ['', 'abc', 'alpha–β💡\r\n']) {
    const bytes = utf8(txt);
    const snapshot = take(bytes, digest(bytes));
    assert.equal(snapshot.byteLength, bytes.length);
    assert.equal(snapshot.sha256, digest(bytes));
    assert.deepEqual(snapshot.readRange(0, bytes.length, snapshot.revision), bytes);
    snapshot.close();
  }
  assert.equal(take(utf8('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad').sha256, digest(utf8('abc')));
});

test('U02 UTF8 byte offset and copies do not mutate source', () => {
  const data = utf8('A💡B');
  assert.equal(data.length, 6);
  assert.equal('A💡B'.length, 4);
  const builder = createSourceSnapshotBuilder({ byteLength: data.length, revision: 'unicode' });
  builder.append(data, 0);
  data[0] = 0;
  const snapshot = builder.finalize();
  assert.deepEqual(snapshot.readRange(1, 5, snapshot.revision), utf8('💡'));
  const view = snapshot.readRange(0, 1, snapshot.revision);
  view[0] = 0;
  assert.equal(snapshot.readRange(0, 1, snapshot.revision)[0], 65);
  assert.equal(code(() => snapshot.readRange(0, 7, snapshot.revision)), 'RANGE_INVALID');
});

test('U03 same-length interior mutation creates different revision and rejects stale read', () => {
  const original = 'P'.repeat(220) + 'A' + 'S'.repeat(220);
  const modified = original.slice(0, 220) + 'B' + original.slice(221);
  const a = take(utf8(original), digest(utf8(original)), 'source-v1');
  const b = take(utf8(modified), digest(utf8(modified)), 'source-v1');
  assert.notEqual(a.sha256, b.sha256);
  assert.notEqual(a.revision, b.revision);
  assert.equal(code(() => b.readRange(0, 2, a.revision)), 'STALE_REVISION');
});

test('U04 out-of-order, duplicate, omitted, excess bytes and hash mismatch fail closed', () => {
  const b = createSourceSnapshotBuilder({ byteLength: 3, revision: 'test' });
  assert.equal(code(() => b.append(utf8('a'), 1)), 'CHUNK_SEQUENCE');
  b.append(utf8('ab'), 0);
  assert.equal(code(() => b.append(utf8('a'), 0)), 'CHUNK_SEQUENCE');
  assert.equal(code(() => b.finalize()), 'INCOMPLETE_SOURCE');
  b.append(utf8('c'), 2);
  const snapshot = b.finalize();
  assert.equal(snapshot.byteLength, 3);
  assert.equal(code(() => b.append(utf8('!'), 3)), 'SNAPSHOT_FINALIZED');
  snapshot.close();
  assert.equal(code(() => snapshot.readRange(0, 1, snapshot.revision)), 'SOURCE_CLOSED');
  const wrong = createSourceSnapshotBuilder({ byteLength: 3, expectedSha256: '0'.repeat(64), revision: 'mismatch' });
  wrong.append(utf8('abc'), 0);
  assert.equal(code(() => wrong.finalize()), 'SOURCE_HASH_MISMATCH');
  const overflow = createSourceSnapshotBuilder({ byteLength: 2, revision: 'overflow' });
  assert.equal(code(() => overflow.append(utf8('abc'), 0)), 'SOURCE_OVERFLOW');
  assert.ok(SourceSnapshotError.prototype instanceof Error);
});
