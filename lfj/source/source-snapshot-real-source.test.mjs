// R03 independent real repository source-byte oracle. This is NOT an
// XML/CII/golden-output, whole-JSON lexer, or browser performance qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,stat,createReadStream} from 'node:fs';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {openBlobSourceSnapshot} from './source-snapshot.mjs';
const read=promisify(readFile),status=promisify(stat);
const file=fileURLToPath(new URL('../../Benchmarks/Managejson%20to%20Input%20XML/ATTRIBUTE_managed_stage.json',import.meta.url));
// Pinned independently reported actual fixture bytes, NOT an LFJ-generated golden.
const FIXTURE_BYTES=10539386;
const FIXTURE_SHA256='e465fa696c80516868349032af6cf1976d9a180c86ea2a7b9eab28c6436fa92a';

test('R03 actual 10.54MB repository source: independent stream SHA, exact Blob reads and no discarded spans',async()=>{
  const st=await status(file);
  assert.equal(st.size,FIXTURE_BYTES,'the repo-owned original input must be stable; never silently replace fixture');
  const digest=createHash('sha256');
  let streamed=0;
  for await(const chunk of createReadStream(file,{highWaterMark:65536})){
    digest.update(chunk);streamed+=chunk.byteLength;
  }
  assert.equal(streamed,st.size);
  const independentlyReadSha=digest.digest('hex');
  assert.equal(independentlyReadSha,FIXTURE_SHA256,
    'baseline expected digest was pinned independently of LFJ parser');
  const raw=await read(file);
  const t=Date.now();
  const snap=await openBlobSourceSnapshot(new Blob([raw]),{
    revision:'real-3d-attribute-managed-stage',expectedSha256:independentlyReadSha,
    chunkBytes:65536,
  });
  assert.equal(snap.byteLength,st.size);
  assert.equal(snap.sha256,independentlyReadSha);
  assert.equal(snap.backing,'immutable-blob');
  assert.deepEqual(await snap.readRange(0,128,snap.revision),Uint8Array.from(raw.subarray(0,128)));
  assert.deepEqual(await snap.readRange(raw.length-128,raw.length,snap.revision),
    Uint8Array.from(raw.subarray(raw.length-128)));
  // Independent aggregation over the LFJ paged source port must account for ALL bytes.
  const pageSha=createHash('sha256');let pageTotal=0,pageCount=0;
  for await(const page of snap.readChunks(snap.revision,131072)) {
    assert.ok(page.length<=131072);
    pageSha.update(page);pageTotal+=page.length;pageCount++;
  }
  assert.equal(pageTotal,st.size);
  assert.equal(pageSha.digest('hex'),independentlyReadSha);
  assert.ok(pageCount>1);
  snap.close();
  assert.ok(Number.isFinite(Date.now()-t));
});
