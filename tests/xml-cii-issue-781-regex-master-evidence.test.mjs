import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildRegexSuggestionPreflight,
  createDefaultRegexSuggestionProfile,
  resetRegexSuggestionCachesForTests,
} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js';
import {
  classifyRegexSmartTesterResult,
  regexSmartHasDatasetEvidence,
  regexSmartReceiptRequestBasis,
  resolveRegexSmartEvidence,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js';

const branchName = '/SDMI-1000-TI-16"-P0310080-61440-01/B3';
const lineFieldMap = { lineKey1: 'lineKey1', lineKey2: 'lineKey2' };
const classFieldMap = { pipingClass: 'pipingClass', convertedBore: 'convertedBore' };

function extractionConfig() {
  return {
    activeFormatIndex: 0,
    formats: [{
      tokenDelimiter: '-',
      lineKeyJoiner: '',
      lineKey: { regex: '', group: 1, tokenPosition: 5 },
      pipingClass: { regex: '', group: 1, tokenPosition: 6 },
      rating: { regex: '', group: 1, tokenPosition: '' },
      bore: { regex: '', group: 1, tokenPosition: 4 },
    }],
    ratingSequence: [],
  };
}

function resultRows() {
  const sample = { branchName, lineReference: branchName, sampleIndex: 1, source: 'Branch' };
  return {
    branchSamples: [sample],
    matchedRows: [{
      ...sample,
      lineKey: 'P0310080',
      pipingClass: '61440',
      rating: '',
      bore: '400',
      status: 'MATCHED',
    }],
    rejectedRows: [],
    diagnostics: [],
  };
}

function datasetBackedState() {
  return {
    regexTesterConfig: extractionConfig(),
    regexSuggestionProfile: createDefaultRegexSuggestionProfile(),
    regexTesterResult: resultRows(),
    masterContext: {
      lineRows: [],
      pipingClassRows: [],
      rowCounts: { lineList: 1, pipingClass: 1 },
      appliedMappingRevision: { lineList: 7, pipingClass: 9 },
      datasetRefs: {
        lineList: { datasetId: 'line-ds', rowCount: 1, fieldMap: lineFieldMap },
        pipingClass: { datasetId: 'class-ds', rowCount: 1, fieldMap: classFieldMap },
      },
      config: {
        linelist: { fieldMap: lineFieldMap },
        pipingClass: { fieldMap: classFieldMap },
      },
    },
  };
}

const authoritativeRows = {
  lineList: [{ lineKey1: 'P', lineKey2: '0310080', pipingClass: '61440' }],
  pipingClass: [{ pipingClass: '61440', convertedBore: 400 }],
};

function boundedProviders(calls = []) {
  const normalize = (value) => String(value ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return {
    search: async (masterKey, datasetId, query) => {
      calls.push(['search', masterKey, datasetId, query]);
      const needle = normalize(query);
      const indexes = authoritativeRows[masterKey]
        .map((row, index) => normalize(Object.values(row).join('')).includes(needle) ? index : -1)
        .filter((index) => index >= 0);
      return { indexes };
    },
    getRowsByIndexes: async (masterKey, datasetId, indexes) => {
      calls.push(['getRowsByIndexes', masterKey, datasetId, [...indexes]]);
      return { rows: indexes.map((index) => authoritativeRows[masterKey][index]).filter(Boolean) };
    },
  };
}

test('dataset-backed smart evidence is transient and upgrades existing scorer authority', async () => {
  resetRegexSuggestionCachesForTests();
  const state = datasetBackedState();
  const calls = [];
  const beforeBasis = regexSmartReceiptRequestBasis(state);

  assert.equal(regexSmartHasDatasetEvidence(state), true);
  assert.deepEqual(state.masterContext.lineRows, []);
  assert.deepEqual(state.masterContext.pipingClassRows, []);

  const heuristic = buildRegexSuggestionPreflight({
    branchSamples: state.regexTesterResult.branchSamples,
    extractionConfig: state.regexTesterConfig,
    masterContext: state.masterContext,
    currentResult: state.regexTesterResult,
    profile: state.regexSuggestionProfile,
  });
  assert.equal(heuristic.masterEvidence.mode, 'HEURISTIC_ONLY');

  const heuristicRows = classifyRegexSmartTesterResult(state.regexTesterResult, state.masterContext);
  assert.equal(heuristicRows.matchedRows[0].status, 'EXTRACTED');

  const bundle = await resolveRegexSmartEvidence(state, boundedProviders(calls));

  assert(calls.some(([kind, masterKey]) => kind === 'search' && masterKey === 'lineList'));
  assert(calls.some(([kind, masterKey]) => kind === 'search' && masterKey === 'pipingClass'));
  assert(calls.some(([kind, masterKey, datasetId, indexes]) => (
    kind === 'getRowsByIndexes'
    && masterKey === 'lineList'
    && datasetId === 'line-ds'
    && indexes.length === 1
  )));
  assert(calls.some(([kind, masterKey, datasetId, indexes]) => (
    kind === 'getRowsByIndexes'
    && masterKey === 'pipingClass'
    && datasetId === 'class-ds'
    && indexes.length === 1
  )));
  assert.equal(bundle.receipt.masterEvidence.mode, 'BOUNDED_MASTER_EVIDENCE');
  assert.notEqual(bundle.receipt.fingerprint, heuristic.fingerprint);
  assert.equal(bundle.regexTesterResult.matchedRows[0].status, 'MASTER_VALIDATED');
  assert.equal(bundle.regexTesterResult.matchedRows[0].semanticValidation.lineKnown, true);
  assert.equal(bundle.regexTesterResult.matchedRows[0].semanticValidation.classKnown, true);

  const lineSuggestion = bundle.receipt.suggestions.find((item) => item.role === 'lineKey');
  const classSuggestion = bundle.receipt.suggestions.find((item) => item.role === 'pipingClass');
  const boreSuggestion = bundle.receipt.suggestions.find((item) => item.role === 'bore');
  assert.ok(lineSuggestion);
  assert.ok(classSuggestion);
  assert.ok(boreSuggestion);
  assert.deepEqual(lineSuggestion.tokenPositions, [5]);
  assert.equal(lineSuggestion.authorityLevel, 'AUTHORIZED_MASTER');
  assert.equal(lineSuggestion.safe, true);
  assert.deepEqual(classSuggestion.tokenPositions, [6]);
  assert.equal(classSuggestion.authorityLevel, 'AUTHORIZED_MASTER');
  assert.equal(classSuggestion.safe, true);
  assert.deepEqual(boreSuggestion.tokenPositions, [4]);
  assert.equal(boreSuggestion.authorityLevel, 'EXPLICIT_SOURCE');
  assert.equal(boreSuggestion.evidenceMetrics.classBoreRate, 1);
  assert.equal(bundle.receipt.suggestions.some((item) => item.role === 'rating'), false, 'Rating must not be generated by smart inference');

  assert.deepEqual(state.masterContext.lineRows, []);
  assert.deepEqual(state.masterContext.pipingClassRows, []);
  assert.equal(regexSmartReceiptRequestBasis(state), beforeBasis);
});

test('receipt cache identity separates empty resident evidence from hydrated evidence', async () => {
  resetRegexSuggestionCachesForTests();
  const state = datasetBackedState();
  const heuristic = buildRegexSuggestionPreflight({
    branchSamples: state.regexTesterResult.branchSamples,
    extractionConfig: state.regexTesterConfig,
    masterContext: state.masterContext,
    currentResult: state.regexTesterResult,
    profile: state.regexSuggestionProfile,
  });
  const bundle = await resolveRegexSmartEvidence(state, boundedProviders());
  const hydratedAgain = buildRegexSuggestionPreflight({
    branchSamples: state.regexTesterResult.branchSamples,
    extractionConfig: state.regexTesterConfig,
    masterContext: bundle.masterContext,
    currentResult: state.regexTesterResult,
    profile: state.regexSuggestionProfile,
  });
  assert.equal(heuristic.masterEvidence.mode, 'HEURISTIC_ONLY');
  assert.equal(bundle.receipt.masterEvidence.mode, 'BOUNDED_MASTER_EVIDENCE');
  assert.equal(hydratedAgain.masterEvidence.mode, 'BOUNDED_MASTER_EVIDENCE');
  assert.notEqual(heuristic.fingerprint, hydratedAgain.fingerprint);
});

test('smart UI auto-loads dataset-backed evidence while keeping full master rows transient', async () => {
  const source = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', import.meta.url), 'utf8');
  assert.match(source, /resolveRegexSmartEvidence/);
  assert.match(source, /void autoAnalyzeDatasetEvidence\(stateRef, render\)/);
  assert.match(source, /Authoritative Line List \/ Piping Class evidence is loading automatically/);
  assert.match(source, /SAFE|safe token mappings/i);
  assert.match(source, /Rating remains manual/);
  assert.match(source, /disabled: evidencePending \|\| receipt\.metrics\.safeCount === 0/);
  assert.doesNotMatch(source, /masterContext\s*\.\s*lineRows\s*=/);
  assert.doesNotMatch(source, /masterContext\s*\.\s*pipingClassRows\s*=/);
});
