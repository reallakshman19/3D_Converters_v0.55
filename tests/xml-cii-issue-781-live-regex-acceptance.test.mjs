import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './xml229-explicit-format-enable.test.mjs';

import {
  applyRegexSuggestions,
  buildRegexSuggestionPreflight,
  clearUnlockedRegexRoleClaims,
  createDefaultRegexSuggestionProfile,
} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js';

const fixture = process.env.XML_CII_41_BRANCH_FIXTURE || new URL('../Benchmarks/EF-05-PRO.TEST.xml', import.meta.url);
const xml = readFileSync(fixture, 'utf8');
const branchSamples = [...xml.matchAll(/<Branchname>([^<]+)<\/Branchname>/g)]
  .map((match) => ({ branchName: match[1] }));

function screenshotConfig() {
  return {
    activeFormatIndex: 0,
    formats: [{
      tokenDelimiter: '-',
      lineKey: { tokenPosition: '3', regex: '', group: 1 },
      pipingClass: { tokenPosition: '4', regex: '', group: 1 },
      rating: { tokenPosition: '', regex: '', group: 1 },
      bore: { tokenPosition: '3', regex: '', group: 1 },
    }],
  };
}

function realBranchReceipt(config) {
  return buildRegexSuggestionPreflight({
    branchSamples,
    extractionConfig: config,
    masterContext: {
      lineRows: [{ lineKey1: 'P', lineKey2: '8810021' }],
      pipingClassRows: [{ pipingClass: '31441C4' }],
      config: {
        linelist: { fieldMap: { lineKey1: 'lineKey1', lineKey2: 'lineKey2' } },
        pipingClass: { fieldMap: { pipingClass: 'pipingClass' } },
      },
    },
    currentResult: { matchedRows: [], rejectedRows: [] },
    profile: createDefaultRegexSuggestionProfile(),
  });
}

test('all 41 source branches reproduce and resolve the locked Bore / unlocked Line Key collision', () => {
  assert.equal(branchSamples.length, 41);
  assert.equal(branchSamples[0].branchName, '/ASIM-1836-8"-P8810021-31441C4-PP/B4');
  const config = screenshotConfig();
  const receipt = realBranchReceipt(config);
  const bore = receipt.suggestions.find((item) => item.role === 'bore');
  assert.equal(receipt.masterEvidence.mode, 'MASTER_BACKED');
  assert.equal(receipt.metrics.formatCount, 2);
  assert.deepEqual(bore?.tokenPositions, [3]);
  assert.equal(bore?.authorityLevel, 'EXPLICIT_SOURCE');
  assert.equal(bore?.confidence, 0.95);
  assert.equal(bore?.safe, true);
  const locks = { bore: true, pipingClass: true };
  const repaired = applyRegexSuggestions(config, receipt, { safeOnly: true, manualLocks: locks });
  assert.equal(repaired.formats[0].lineKey.tokenPosition, '', 'stale unlocked Line Key must be removed');
  assert.equal(repaired.formats[0].bore.tokenPosition, '3', 'locked Bore ownership must survive');
  assert.equal(repaired.formats[0].pipingClass.tokenPosition, '4', 'locked Piping Class must survive');
  assert.equal(repaired.formats[0].rating.tokenPosition, '', 'Rating remains manual');
  assert.equal(config.formats[0].lineKey.tokenPosition, '3', 'input config remains immutable');
});

test('a BLOCKED preflight cannot apply any mapping on the real 41-branch source', () => {
  const config = screenshotConfig();
  config.formats[0].rating.tokenPosition = '3';
  const baseProfile = createDefaultRegexSuggestionProfile();
  const receipt = buildRegexSuggestionPreflight({
    branchSamples,
    extractionConfig: config,
    masterContext: {
      lineRows: [{ lineKey1: 'P', lineKey2: '8810021' }],
      pipingClassRows: [{ pipingClass: '31441C4' }],
      config: {
        linelist: { fieldMap: { lineKey1: 'lineKey1', lineKey2: 'lineKey2' } },
        pipingClass: { fieldMap: { pipingClass: 'pipingClass' } },
      },
    },
    profile: { ...baseProfile, formatPolicy: { ...baseProfile.formatPolicy, maximumFormats: 1 } },
  });
  assert.equal(receipt.metrics.sampleCount, 41);
  assert.equal(receipt.metrics.formatCount, 2);
  assert.equal(receipt.status, 'BLOCKED');
  assert.ok(receipt.metrics.safeCount > 0, 'guard must work even when safe suggestions are present');
  assert.equal(receipt.blockers[0]?.code, 'FORMAT_COUNT_EXCEEDS_PROFILE');
  const proposed = applyRegexSuggestions(config, receipt, {
    safeOnly: true,
    manualLocks: { bore: true, pipingClass: true },
  });
  assert.deepEqual(proposed, config, 'BLOCKED receipt cannot clear stale Line Key or Rating');
  assert.notStrictEqual(proposed, config, 'apply still returns an isolated config clone');
});

test('locked roles are protected and a non-safe receipt cannot clear another role', () => {
  const config = screenshotConfig();
  const receipt = realBranchReceipt(config);
  const protectedConfig = applyRegexSuggestions(config, receipt, {
    safeOnly: true,
    manualLocks: { bore: true, lineKey: true, pipingClass: true },
  });
  assert.equal(protectedConfig.formats[0].lineKey.tokenPosition, '3');
  const unsafe = { formatIndex: 0, suggestions: [{ role: 'bore', tokenPositions: [3], safe: false, conflict: false }] };
  const unchanged = applyRegexSuggestions(config, unsafe, { safeOnly: true, manualLocks: { bore: true } });
  assert.deepEqual(unchanged, config);
});

test('master-backed composite Line Key overlapping Bore is review-only and preserves a locked Line Key', () => {
  const config = {
    activeFormatIndex: 0,
    formats: [{
      tokenDelimiter: '-',
      lineKey: { tokenPosition: '', regex: '', group: 1 },
      pipingClass: { tokenPosition: '', regex: '', group: 1 },
      rating: { tokenPosition: '', regex: '', group: 1 },
      bore: { tokenPosition: '', regex: '', group: 1 },
    }],
  };
  const receipt = buildRegexSuggestionPreflight({
    branchSamples: [{ branchName: '/ASIM-B1234-8"-C123/B1' }],
    extractionConfig: config,
    masterContext: {
      lineRows: [{ lineKey1: 'B1234', lineKey2: '8' }],
      pipingClassRows: [{ pipingClass: 'C123' }],
      config: {
        linelist: { fieldMap: { lineKey1: 'lineKey1', lineKey2: 'lineKey2' } },
        pipingClass: { fieldMap: { pipingClass: 'pipingClass' } },
      },
    },
    profile: createDefaultRegexSuggestionProfile(),
  });
  const line = receipt.suggestions.find((item) => item.role === 'lineKey');
  const bore = receipt.suggestions.find((item) => item.role === 'bore');
  assert.deepEqual(line?.tokenPositions, [2, 3]);
  assert.deepEqual(bore?.tokenPositions, [3]);
  assert.equal(line?.authorityLevel, 'AUTHORIZED_MASTER');
  assert.equal(bore?.authorityLevel, 'EXPLICIT_SOURCE');
  assert.equal(line?.safe, true);
  assert.equal(bore?.safe, true);
  assert.equal(line?.conflict, true);
  assert.equal(bore?.conflict, true);
  assert.equal(receipt.status, 'REVIEW_REQUIRED');
  const proposed = applyRegexSuggestions(config, receipt, { safeOnly: true, manualLocks: {} });
  assert.equal(proposed.formats[0].lineKey.tokenPosition, '', 'conflicting Line Key must await review');
  assert.equal(proposed.formats[0].bore.tokenPosition, '', 'conflicting Bore must await review');
  const lockedConfig = structuredClone(config);
  lockedConfig.formats[0].lineKey.tokenPosition = '2,3';
  const locked = applyRegexSuggestions(lockedConfig, receipt, { safeOnly: true, manualLocks: { lineKey: true } });
  assert.equal(locked.formats[0].lineKey.tokenPosition, '2,3', 'locked master Line Key remains intact');
  assert.equal(locked.formats[0].bore.tokenPosition, '', 'Bore is not inferred across a conflict');
  const competingConfig = structuredClone(lockedConfig);
  competingConfig.formats[0].bore.tokenPosition = '3';
  const competing = applyRegexSuggestions(competingConfig, receipt, { safeOnly: true, manualLocks: { bore: true } });
  assert.equal(competing.formats[0].lineKey.tokenPosition, '2,3', 'master-backed composite Line Key awaits review, even beside locked Bore');
  assert.equal(competing.formats[0].bore.tokenPosition, '3', 'locked Bore remains intact during review');
});

test('a manual token click immediately clears other unlocked claims, including stale Rating', () => {
  const config = screenshotConfig();
  config.formats[0].rating.tokenPosition = '3';
  const cleared = clearUnlockedRegexRoleClaims(config, 'bore', [3], { bore: true, pipingClass: true });
  assert.equal(cleared.formats[0].lineKey.tokenPosition, '');
  assert.equal(cleared.formats[0].rating.tokenPosition, '');
  assert.equal(cleared.formats[0].bore.tokenPosition, '3');
  const locked = clearUnlockedRegexRoleClaims(config, 'bore', [3], { bore: true, lineKey: true, rating: true });
  assert.equal(locked.formats[0].lineKey.tokenPosition, '3');
  assert.equal(locked.formats[0].rating.tokenPosition, '3');
});

test('the visible confidence badge has a handler on the active runtime module', () => {
  const source = readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', import.meta.url), 'utf8');
  assert.match(source, /badge\.addEventListener\('click', \(\) => \{ void applyOne\(/);
  assert.match(source, /async function applyOne\(/);
});
