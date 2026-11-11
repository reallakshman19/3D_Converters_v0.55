import assert from 'node:assert/strict';
import test from 'node:test';
import { extractBranchFieldsWithFormats as resolve } from '../converters/xml-cii2019-core/branch-format-extraction.js';
import {toggleRegexLineKeyColumn} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const dominant = '/ASIM-1885-3"-S8811000-91261M7-HC-01/B1';
const alternative = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2';
const formats = [
  { tokenDelimiter: '-', lineKey: { regex: '^/ASIM-1885-[0-9]+(?:"|-)-(S[0-9]+)' },
    pipingClass: { regex: '^/ASIM-1885-[0-9]+(?:"|-)-S[0-9]+-([A-Z0-9]+)' } },
  { tokenDelimiter: '-', lineKey: { regex: '^/ASIM-1885-PL-HOT-(S[0-9]+)' },
    pipingClass: { regex: '^/ASIM-1885-PL-HOT-S[0-9]+-([A-Z0-9]+)' } },
];

test('explicit dominant and alternative formats resolve with correct provenance', () => {
  const cfg = { regexTester: { formats } };
  const d = resolve(dominant, cfg);
  const a = resolve(alternative, cfg);
  assert.equal(d.status, 'MATCHED');
  assert.deepEqual([d.lineKey, d.pipingClass, d.matchedFormatIndex], ['S8811000', '91261M7', 0]);
  assert.equal(a.status, 'MATCHED');
  assert.deepEqual([a.lineKey, a.pipingClass, a.matchedFormatIndex], ['S8822000', '91261M7', 1]);
});

test('same-output complete formats record agreement in configured order', () => {
  const fmt = { lineKey: { regex: '^(LN[0-9]+)' }, pipingClass: { regex: '^(?:LN[0-9]+)-(PC[0-9]+)' } };
  const r = resolve('LN17-PC42', { formats: [fmt, structuredClone(fmt)] });
  assert.equal(r.status, 'MATCHED');
  assert.equal(r.matchedFormatIndex, 0);
  assert.deepEqual(r.agreeingFormatIndices, [0, 1]);
});

test('different complete identities are AMBIGUOUS without authoritative fields', () => {
  const r = resolve('LN17-PC42', { formats: [
    { lineKey: { regex: '(LN17)' }, pipingClass: { regex: '(PC42)' } },
    { lineKey: { regex: '(LN17)' }, pipingClass: { regex: '(PC4)' } },
  ] });
  assert.equal(r.status, 'AMBIGUOUS');
  assert.equal(r.matchedFormatIndex, null);
  assert.deepEqual([r.lineKey, r.pipingClass, r.rating, r.bore], ['', '', '', '']);
  assert.deepEqual(r.candidates.map(c => c.status), ['MATCHED', 'MATCHED']);
});

test('incomplete explicit formats return UNMATCHED without default-format synthesis', () => {
  const r = resolve('LN17-PC42', { formats: [] });
  assert.equal(r.status, 'UNMATCHED');
  assert.equal(r.candidates.length, 0);
  const lone = resolve('LN17-PC42', { formats: [{ lineKey: { regex: '(LN17)' } }] });
  assert.equal(lone.status, 'UNMATCHED');
  assert.equal(lone.candidates.length, 1);
});

test('explicit regex miss cannot be rescued by unrelated positional tokens', () => {
  const cfg = { formats: [{ tokenDelimiter: '-', lineKey: { regex: '(NOT_THE_FORMAT)', tokenPosition: '1' },
    pipingClass: { regex: '(PC42)', tokenPosition: '2' } }] };
  const r = resolve('LN17-PC42', cfg);
  assert.equal(r.status, 'UNMATCHED');
  assert.equal(r.candidates[0].reasons.lineKey, 'REGEX_NO_MATCH_OR_CAPTURE');
  cfg.formats[0].lineKey.fallbackOnRegexMiss = true;
  const optedIn = resolve('LN17-PC42', cfg);
  assert.equal(optedIn.status, 'MATCHED');
  assert.equal(optedIn.lineKey, 'LN17');
});

test('one legacy configuration remains one candidate with old token fallback semantics', () => {
  const legacy = {
    linelist: { branchNameRegex: '^(DOES_NOT_MATCH)', lineKeyTokenPositions: '1', tokenDelimiter: '-' },
    rating: { pipingClassTokenIndex: 2, tokenDelimiter: '-' },
  };
  const r = resolve('LN17-PC42', legacy);
  assert.equal(r.status, 'MATCHED');
  assert.equal(r.origin, 'legacy-single-format');
  assert.equal(r.candidates.length, 1);
  assert.deepEqual([r.lineKey, r.pipingClass, r.matchedFormatIndex], ['LN17', 'PC42', 0]);
});

test('rating and bore are optional; competing optional values stay blank', () => {
  const fmt = { lineKey: { regex: '(LN17)' }, pipingClass: { regex: '(PC42)' } };
  const result = resolve('LN17-PC42-B100', { formats: [
    { ...fmt, bore: { regex: 'B(100)' }, rating: {regex:'B(100)'} },
    { ...fmt, bore: { regex: 'B(10)' }, rating: {regex:'B(10)'} },
  ] });
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.lineKey, 'LN17');
  assert.equal(result.pipingClass, 'PC42');
  assert.equal(result.bore, '');
  assert.equal(result.rating, '');
});

test('ordered multi-column line key and concatenate text survive extractor', () => {
  const branch='/ASIM-1836-4"-P-8810049-31441C4-PP/B1';
  const format={
    tokenDelimiter:'-',lineKeyJoiner:'',
    lineKey:{extractMode:'TOKEN',tokenPosition:'4,5'},
    pipingClass:{extractMode:'TOKEN',tokenPosition:'6'},
    rating:{extractMode:'TOKEN',tokenPosition:''},
  };
  const compact=resolve(branch,{formats:[format]});
  assert.equal(compact.status,'MATCHED');
  assert.equal(compact.lineKey,'P8810049');
  assert.equal(compact.pipingClass,'31441C4');
  assert.equal(compact.candidates[0].reasons.rating,undefined);
  assert.equal(resolve(branch,{formats:[{...format,lineKeyJoiner:'-'}]}).lineKey,
    'P-8810049');
  assert.equal(resolve(branch,{formats:[{
    ...format,lineKey:{...format.lineKey,tokenPosition:'5,4'},
  }]}).lineKey,'8810049P','click order controls concatenation');
});

test('resolver never mutates supplied format configuration', () => {
  const cfg = { regexTester: { formats: structuredClone(formats) } };
  const snapshot = JSON.stringify(cfg);
  resolve(alternative, cfg);
  assert.equal(JSON.stringify(cfg), snapshot);
});

test('legacy support-config rating section is not mistaken for a standalone rating rule', () => {
  const config = {
    regexTester: { activeFormatIndex: 0 },
    linelist: { lineKeyTokenPositions: '4' },
    rating: { pipingClassTokenIndex: '5', pipingClassRegex: '^NO_SUCH_CLASS$' },
    weight: { boreTokenIndex: '3' },
  };
  const r = resolve('/ASIM-1885-3"-S8811000-91261M7-HC-01/B1', config);
  assert.equal(r.status, 'MATCHED');
  assert.equal(r.candidates.length, 1);
  assert.deepEqual([r.lineKey, r.pipingClass, r.matchedFormatIndex],
    ['S8811000', '91261M7', 0]);
});

test('legacy token positions strip branch delimiters but preserve regex source text', () => {
  const config = {
    linelist: { lineKeyTokenPositions: '1', branchNameRegex: '^/ASIM-(1885)' },
    rating: { pipingClassTokenIndex: 5 },
  };
  const result = resolve('/ASIM-1885-3"-S8811000-91261M7-HC-01/B1', config);
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.lineKey, '1885');
  assert.equal(result.pipingClass, '91261M7');
});


test('untouched Format-2 UI template is not an eligible competing engineering rule', () => {
  const configured = {
    lineKey: { regex: '(LN17)' },
    pipingClass: { regex: '(PC42)' },
  };
  const untouched = {
    tokenDelimiter: '-', lineKeyJoiner: '',
    lineKey: { regex: '', group: 1, tokenPosition: 3 },
    pipingClass: { regex: '', group: 1, tokenPosition: 4 },
    rating: { regex: '', group: 1, tokenPosition: 4 },
    bore: { regex: '', group: 1, tokenPosition: 2 },
  };
  const branch = 'ASIM-LN17-PC42-B51';
  const result = resolve(branch, { formats: [configured, untouched] });
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.matchedFormatIndex, 0);
  assert.equal(result.candidates[1].reasons.format, 'UNCONFIGURED_ALTERNATIVE');
  const active = resolve(branch, { formats: [configured, { ...untouched, enabled: true }] });
  assert.equal(active.status, 'AMBIGUOUS', 'explicitly enabled fallback must still be evaluated');
});

test('Regex click-to-map Line Key preserves selection order and toggles positions',()=>{
  const first=toggleRegexLineKeyColumn('',4);
  const second=toggleRegexLineKeyColumn(first,5);
  assert.equal(first,'4');
  assert.equal(second,'4,5');
  assert.equal(toggleRegexLineKeyColumn(second,4),'5');
  assert.equal(toggleRegexLineKeyColumn(second,3),'4,5,3');
  assert.equal(toggleRegexLineKeyColumn('5,4',3),'5,4,3');
  assert.equal(toggleRegexLineKeyColumn('4,5',5),'4');
});
