import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import {
  indexAttNativeHierarchy, pageAttChildren, walkAttSubtreeIds,
} from '../../tabs/model-converters/att-native-hierarchy-index.js';

const fixture = '\ufeffCADC_Attributes_File v1.0\r\nNEW Header Information\r\n Project:= PRIVATE\r\nEND\r\nNEW /A\r\n NAME:= /A\r\n TYPE:= SITE\r\n OWNER:= /*\r\nNEW /A-Z\r\n NAME:= /A-Z\r\n TYPE:= ZONE\r\n OWNER:= /A\r\nNEW /E\r\n NAME:= /E\r\n TYPE:= EQUI\r\n OWNER:= /A-Z\r\nNEW /E1\r\n NAME:= /E1\r\n TYPE:= SUBE\r\n OWNER:= /E\r\nNEW /O\r\n NAME:= /O\r\n TYPE:= SPINE\r\n OWNER:= /MISSING\r\nEND\r\n';
const tinyChunks = async function* () {
  const bytes = Buffer.from(fixture);
  for (let i = 0; i < bytes.length; i += 3) yield bytes.subarray(i, i + 3);
};
const ix = await indexAttNativeHierarchy(tinyChunks());
assert.equal(ix.counts.typed, 5);
assert.equal(ix.counts.metadata, 1);
assert.equal(ix.counts.sites, 1);
assert.equal(ix.counts.zones, 1);
assert.equal(ix.counts.unresolved, 1);
assert.deepEqual([...walkAttSubtreeIds(ix, '/A-Z')], ['/A-Z', '/E', '/E1']);
assert.equal(pageAttChildren(ix, '/A', 0, 1).total, 1);
assert.deepEqual(pageAttChildren(ix, '/A-Z', 0, 1).rows.map(r => r.type), ['EQUI']);
assert.throws(() => pageAttChildren(ix, '/BAD'), /Unknown/);
assert.throws(() => [...walkAttSubtreeIds(ix, '/BAD')], /Unknown/);

const large = ['NEW /SITE', 'NAME:= /SITE', 'TYPE:= SITE', 'OWNER:= /*'];
for (let i = 0; i < 1024; ++i) {
  large.push('NEW /SITE/Z' + i, 'NAME:= /SITE/Z' + i, 'TYPE:= ZONE', 'OWNER:= /SITE');
}
large.push('END');
const bulk = await indexAttNativeHierarchy(large.join('\n'));
assert.equal(bulk.counts.typed, 1025);
assert.equal(pageAttChildren(bulk, '/SITE', 0, 25).total, 1024);
assert.equal(pageAttChildren(bulk, '/SITE', 1000, 25).rows.length, 24);
assert.equal([...walkAttSubtreeIds(bulk, '/SITE')].length, 1025);

const damaged = [
  'NEW /C1', 'NAME:= /C1', 'TYPE:= ZONE', 'OWNER:= /C2',
  'NEW /C2', 'NAME:= /C2', 'TYPE:= ZONE', 'OWNER:= /C1',
  'NEW /D', 'NAME:= /D', 'TYPE:= ZONE', 'OWNER:= /*',
  'NEW /D', 'NAME:= /D', 'TYPE:= ZONE', 'OWNER:= /*',
  'NEW /D#2', 'NAME:= /D#2', 'TYPE:= ZONE', 'OWNER:= /*',
  'END',
].join('\n');
const unusual = await indexAttNativeHierarchy(damaged);
assert.equal(unusual.counts.typed, 5);
assert.equal(unusual.byId.size, 5, 'Duplicate synthetic ID must not overwrite a real NAME');
assert.equal(unusual.counts.duplicatedNames, 1);
assert.equal(unusual.counts.cycles, 1);
assert.equal([...walkAttSubtreeIds(unusual, '/C1')].length, 2);
assert.equal(unusual.roots.some(id => id === '/C1' || id === '/C2'), true);

console.log('synthetic ATT native hierarchy and pagination: PASS');

// The Owner's confidential large-file fixture must NOT be stored in GitHub.
// With an authorized local copy, use: node test-att-native-hierarchy-index.mjs PATH
if (process.argv[2]) {
  const actual = await indexAttNativeHierarchy(createReadStream(process.argv[2]));
  assert.equal(actual.counts.typed, 105601);
  assert.equal(actual.counts.metadata, 1);
  assert.equal(actual.counts.sites, 18);
  assert.equal(actual.counts.zones, 192);
  assert.equal(actual.counts.branches, 778);
  assert.equal(actual.counts.pipes, 377);
  assert.equal(actual.counts.unresolved, 1);
  assert.equal(actual.counts.duplicatedNames, 0);
  assert.equal(actual.byId.size, actual.counts.typed);
  assert.equal(
    [...walkAttSubtreeIds(actual, '/ASIM-1835-CU-CI')].includes('/ASIM-1835-CU-CI-FDNS'), true,
  );
  assert.equal(actual.byId.get('/ASIM-1835-CU-CI-FDNS').type, 'ZONE');
  console.log('authorized real AML ATT manifest: PASS', JSON.stringify(actual.counts));
}
