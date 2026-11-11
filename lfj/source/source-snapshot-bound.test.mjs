// Independent R03 security/performance boundary: a caller cannot opt out of bounded source reads.
// This synthetic input is NOT a populated real-file benchmark or memory qualification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSourceSnapshotBuilder } from './source-snapshot.mjs';

test('U02 a caller-supplied maxSpanBytes cannot turn bounded paging into full-source copying', () => {
  const n = 1024 * 1024 + 1;
  const bytes = new Uint8Array(n);
  bytes.fill(37);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const b = createSourceSnapshotBuilder({ byteLength:n, expectedSha256:hash, revision:'bound-test' });
  b.append(bytes.subarray(0,1024*1024),0);
  b.append(bytes.subarray(1024*1024),1024*1024);
  const snap = b.finalize();
  assert.throws(() => snap.readRange(0,n,snap.revision,2*1024*1024), e => e?.code==='RANGE_LIMIT');
  assert.deepEqual(snap.readRange(0,3,snap.revision), bytes.subarray(0,3));
  snap.close();
});

test('U01 oversized caller-configured ingestion chunk must not bypass 1MiB hard bound', () => {
  assert.throws(
    () => createSourceSnapshotBuilder({ byteLength:0, revision:'forged-large-chunk', maxChunkBytes:2*1024*1024 }),
    error => error?.code==='CHUNK_LIMIT'
  );
});
