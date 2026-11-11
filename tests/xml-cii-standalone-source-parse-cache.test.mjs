import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSourceDocumentContext,
  resetSourceDocumentContextCache,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-source-derived-context.js';
import {
  resetXmlCiiPerfMetrics,
  snapshotXmlCiiPerfMetrics,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js';

class FakeDOMParser {
  static calls = [];
  parseFromString(sourceText, mediaType) {
    FakeDOMParser.calls.push([sourceText, mediaType]);
    return Object.freeze({ sourceText, mediaType, marker: `doc:${sourceText.length}:${FakeDOMParser.calls.length}` });
  }
}

function withFakeParser(fn) {
  const previousParser = globalThis.DOMParser;
  const previousPerf = globalThis.__XML_CII_PERF__;
  globalThis.DOMParser = FakeDOMParser;
  globalThis.__XML_CII_PERF__ = true;
  FakeDOMParser.calls = [];
  resetSourceDocumentContextCache();
  resetXmlCiiPerfMetrics();
  try { return fn(); }
  finally {
    resetSourceDocumentContextCache();
    resetXmlCiiPerfMetrics();
    FakeDOMParser.calls = [];
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
    if (previousPerf === undefined) delete globalThis.__XML_CII_PERF__;
    else globalThis.__XML_CII_PERF__ = previousPerf;
  }
}

test('two consumers of the same source parse once and share one derived document', () => withFakeParser(() => {
  const source = '<ROOT><Branch NAME="B1"/></ROOT>';
  const validity = getSourceDocumentContext(source);
  const preview = getSourceDocumentContext(source);
  assert.equal(validity, preview);
  assert.equal(FakeDOMParser.calls.length, 1);
  const metrics = snapshotXmlCiiPerfMetrics();
  assert.equal(metrics.sourceParseCount, 1);
  assert.equal(metrics.sourceParseCacheHitCount, 1);
  assert.ok(metrics.sourceParseMs >= 0);
}));

test('exact source change invalidates the prior document while same-source revisit hits cache', () => withFakeParser(() => {
  const first = getSourceDocumentContext('<ROOT id="A"/>');
  const same = getSourceDocumentContext('<ROOT id="A"/>');
  const changed = getSourceDocumentContext('<ROOT id="B"/>');
  assert.equal(first, same);
  assert.notEqual(changed, first);
  assert.equal(FakeDOMParser.calls.length, 2);
}));

test('empty source evicts cache so identical text reload parses again', () => withFakeParser(() => {
  const source = '<ROOT id="A"/>';
  const first = getSourceDocumentContext(source);
  const empty = getSourceDocumentContext('');
  const reloaded = getSourceDocumentContext(source);
  assert.equal(empty.document, null);
  assert.notEqual(reloaded, first);
  assert.equal(FakeDOMParser.calls.length, 2);
}));

test('parse failure is cached only for the exact failing source basis', () => {
  class ThrowingParser {
    static calls = 0;
    parseFromString() { ThrowingParser.calls += 1; throw new Error('synthetic parse failure'); }
  }
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = ThrowingParser;
  resetSourceDocumentContextCache();
  try {
    const first = getSourceDocumentContext('<BAD>');
    const second = getSourceDocumentContext('<BAD>');
    assert.equal(first, second);
    assert.equal(first.document, null);
    assert.match(first.error.message, /synthetic parse failure/);
    assert.equal(ThrowingParser.calls, 1);
  } finally {
    resetSourceDocumentContextCache();
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});
