import assert from 'node:assert/strict';
import { createHash as nodeCreateHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createHash as browserCreateHash } from '../core/browser-node-crypto.js';

const RELEASE_KEY = '20260902-vib-pages-crypto-1';

function digest(createHash, parts) {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
}

test('browser SHA-256 shim matches Node for empty, ASCII, Unicode and multi-update inputs', () => {
  const vectors = [
    [''],
    ['abc'],
    ['vibration', '-', 'integrity'],
    ['⚙️ vibration integrity'],
    ['x'.repeat(1024), 'y'.repeat(257)],
  ];
  for (const parts of vectors) {
    assert.equal(digest(browserCreateHash, parts), digest(nodeCreateHash, parts));
  }
});

test('browser crypto shim fails closed outside the narrow SHA-256/hex contract', () => {
  assert.throws(() => browserCreateHash('sha1'), /only supports SHA-256/);
  assert.throws(() => browserCreateHash('sha256').update('abc').digest('base64'), /only supports hex/);
});

test('standalone import map resolves node:crypto before the versioned app entry point', () => {
  const index = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  assert.match(index, new RegExp(`node:crypto.*browser-node-crypto\\.js\\?v=${RELEASE_KEY}`));
  assert.match(index, new RegExp(`main-rhbg-fitguard\\.js\\?v=${RELEASE_KEY}`));
  assert.ok(index.indexOf('type="importmap"') < index.indexOf('type="module"'));
});
