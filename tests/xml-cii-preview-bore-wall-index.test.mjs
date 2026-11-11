import assert from 'node:assert/strict';
import {
  buildExactClassWallIndex,
  buildStagedBranchWallEvidenceIndex,
  exactClassWallFromIndex,
  stagedBranchWallEvidenceFromIndex,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-wall-evidence.js';
import { applyPreviewBoreWallAuthority } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js';

const text = (value) => value == null ? '' : String(value).trim();
const norm = (value) => text(value).toUpperCase().replace(/\s+/g, '');
const canonicalBranch = (value) => norm(value).replace(/^=/, '').replace(/\/B\d+$/i, '');

function attr(attrs, keys) {
  for (const key of keys) {
    const found = Object.entries(attrs || {}).find(([name]) => norm(name) === norm(key));
    if (found && text(found[1])) return found[1];
  }
  return '';
}

function numericMm(value) {
  const hit = text(value).match(/\d+(?:\.\d+)?/);
  const out = hit ? Number(hit[0]) : NaN;
  return Number.isFinite(out) && out > 0 ? out : null;
}

function legacyStagedBore(attrs) {
  const values = ['ABORE', 'LBORE', 'HBOR', 'TBOR']
    .map((key) => numericMm(attr(attrs, [key]))).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function legacyWalk(value, branchName = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => legacyWalk(item, branchName, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  const attrs = value.attributes && typeof value.attributes === 'object' ? value.attributes : {};
  const type = text(value.type || attr(attrs, ['TYPE'])).toUpperCase();
  const owner = text(attr(attrs, ['OWNER']) || branchName);
  const currentBranch = type === 'BRANCH' ? text(value.name || attr(attrs, ['NAME']) || owner) : owner;
  out.push({ value, attrs, type, branchName: currentBranch });
  if (Array.isArray(value.children)) value.children.forEach((child) => legacyWalk(child, currentBranch, out));
  return out;
}

function legacyStagedEvidence(staged, branchName) {
  const root = canonicalBranch(branchName);
  return legacyWalk(staged).flatMap(({ value, attrs, type, branchName: owner }) => {
    if (!root || canonicalBranch(owner) !== root || type === 'BRANCH') return [];
    const dtxr = attr(attrs, ['DTXR_POS', 'DTXR', 'DESC', 'DESCRIPTION']) || value.name;
    if (!text(dtxr)) return [];
    return [{
      componentType: type,
      componentRefNo: attr(attrs, ['REF', 'NAME']),
      boreMm: legacyStagedBore(attrs),
      dtxr: text(dtxr),
      source: 'staged-json',
    }];
  });
}

const npsToDn = { '3': 80, '4': 100, '10': 250 };
function rowValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key] ?? row?._raw?.[key];
    if (text(value)) return value;
  }
  return '';
}
function legacyRowBore(row) {
  const converted = Number(rowValue(row, ['convertedBore', 'Converted Bore', 'DN', 'NB']));
  if (Number.isFinite(converted) && converted > 0) return converted;
  return Number(npsToDn[String(Number(rowValue(row, ['Size', 'NPS', 'Nominal Size'])))]) || null;
}
function legacyClassWall(rows, pipingClass, boreMm) {
  if (`${norm(pipingClass)}|${Number(boreMm)}` === '96620|250') return { wallThicknessMm: 15.09, schedule: '80', source: 'benchmark-correction', authority: 'P1110502 10-inch benchmark 2026-07-22' };
  const match = rows.find((row) => norm(rowValue(row, ['Piping Class', 'pipingClass', 'PIPING_CLASS'])) === norm(pipingClass) && legacyRowBore(row) === Number(boreMm));
  const wall = Number(rowValue(match, ['Wall thickness', 'Wall Thickness', 'wallThickness', 'THK', 'Thickness']));
  return match && Number.isFinite(wall) && wall > 0 ? { wallThicknessMm: wall, schedule: text(rowValue(match, ['SCH', 'Schedule', 'schedule'])), source: 'piping-class-master', matchedRow: match } : null;
}

const staged = [
  { type: 'BRANCH', name: '=LINE-A/B1', children: [
    { type: 'PIPE', name: 'A1', attributes: { OWNER: '=LINE-A/B1', ABORE: '100', DTXR_POS: 'SCH 40', REF: '=A1' } },
    { type: 'PIPE', name: 'A2', attributes: { OWNER: '=LINE-A/B2', ABORE: '100', DTXR_POS: 'WTH 9.5 MM', REF: '=A2' } },
  ] },
  { type: 'BRANCH', name: 'LINE-B/B1', children: [
    { type: 'VALV', name: 'B1', attributes: { OWNER: 'LINE-B/B1', ABORE: '80', DESC: 'SCH 80', REF: 'B1' } },
  ] },
];

let parseCount = 0;
const originalParse = JSON.parse;
JSON.parse = (...args) => { parseCount += 1; return originalParse(...args); };
const stagedIndex = buildStagedBranchWallEvidenceIndex(JSON.stringify(staged));
for (let i = 0; i < 100; i += 1) stagedBranchWallEvidenceFromIndex(stagedIndex, i % 2 ? 'LINE-A/B9' : 'LINE-B/B4');
JSON.parse = originalParse;
assert.equal(parseCount, 1, 'staged JSON must parse once for the shared index');
assert.deepEqual(stagedBranchWallEvidenceFromIndex(stagedIndex, 'LINE-A/B9'), legacyStagedEvidence(staged, 'LINE-A/B9'));
assert.deepEqual(stagedBranchWallEvidenceFromIndex(stagedIndex, '=LINE-B/B7'), legacyStagedEvidence(staged, '=LINE-B/B7'));
assert.deepEqual(stagedBranchWallEvidenceFromIndex(buildStagedBranchWallEvidenceIndex('{bad'), 'LINE-A'), []);

const masterRows = [
  { 'Piping Class': 'CLASSA', DN: 100, 'Wall Thickness': 6.1, SCH: '40' },
  { 'Piping Class': 'CLASSA', DN: 100, 'Wall Thickness': 8.8, SCH: '80' },
  { 'Piping Class': 'CLASSB', DN: 80, 'Wall Thickness': '' },
  { 'Piping Class': 'CLASSB', DN: 80, 'Wall Thickness': 7.7, SCH: '80' },
  { 'Piping Class': '96620', DN: 250, 'Wall Thickness': 99, SCH: 'XX' },
  { 'Piping Class': 'NPSCLASS', Size: 4, 'Wall Thickness': 5.5, SCH: 'STD' },
];
let masterReads = 0;
const observedRows = new Proxy(masterRows, { get(target, property, receiver) { if (/^\d+$/.test(String(property))) masterReads += 1; return Reflect.get(target, property, receiver); } });
const config = { weight: { npsToDn }, pipingClass: { masterRows: observedRows } };
const classIndex = buildExactClassWallIndex(config);
assert.ok(masterReads >= masterRows.length, 'index build must inspect the master once');
masterReads = 0;
for (let i = 0; i < 100; i += 1) exactClassWallFromIndex(classIndex, i % 2 ? 'CLASSA' : 'NPSCLASS', 100);
assert.equal(masterReads, 0, 'indexed lookups must not rescan master rows');
for (const [cls, bore] of [['CLASSA', 100], ['CLASSB', 80], ['96620', 250], ['NPSCLASS', 100], ['MISS', 100]]) {
  const actual = exactClassWallFromIndex(classIndex, cls, bore);
  const expected = legacyClassWall(masterRows, cls, bore);
  if (expected?.matchedRow) assert.equal(actual?.matchedRow, expected.matchedRow, `${cls} must preserve first-row identity`);
  assert.deepEqual(actual && { ...actual, matchedRow: undefined }, expected && { ...expected, matchedRow: undefined }, `${cls}/${bore} must preserve legacy wall result`);
}

function leaf(name, value) { return { nodeType: 1, localName: name, nodeName: name, textContent: String(value), childNodes: [] }; }
function element(name, fields = {}) {
  const childNodes = Object.entries(fields).map(([key, value]) => leaf(key, value));
  return { nodeType: 1, localName: name, nodeName: name, childNodes, textContent: '' };
}
function branch(name, nodeFields = {}) {
  const node = element('Node', nodeFields);
  return { nodeType: 1, localName: 'Branch', nodeName: 'Branch', childNodes: [leaf('Branchname', name), node], textContent: '' };
}
const branches = [
  branch('LINE-A/B1', { NodeNumber: 10, ComponentRefNo: '=A1', Endpoint: 2, ComponentType: 'PIPE', OutsideDiameter: 114.3 }),
  branch('LINE-C/B1', { NodeNumber: 20, ComponentRefNo: '=C1', Endpoint: 2, ComponentType: 'PIPE', OutsideDiameter: 88.9 }),
];
const document = { getElementsByTagName(name) { return name === 'Branch' ? branches : []; } };
const result = { branchRows: [
  { branchName: 'LINE-A/B1', sizeMm: 100, pipingClass: 'CLASSA' },
  { branchName: 'LINE-C/B1', sizeMm: 80, pipingClass: 'CLASSC' },
], nodeRows: [
  { branchName: 'LINE-A/B1', nodeNumber: '10', componentRefNo: 'A1', endpoint: '2', boreMm: 1 },
  { branchName: 'LINE-C/B1', nodeNumber: '20', componentRefNo: 'C1', endpoint: '2', boreMm: 1 },
] };
const integrationConfig = { weight: { npsToDn }, pipingClass: { masterRows: [...masterRows, { 'Piping Class': 'CLASSC', DN: 80, 'Wall Thickness': 7.2, SCH: '40' }] } };
const integrated = applyPreviewBoreWallAuthority({ stagedJsonText: JSON.stringify(staged), config: integrationConfig, result, sourceDocument: document });
assert.equal(integrated.branchRows[0].wallThickness, '9.5', 'direct staged wall must still outrank class wall');
assert.equal(integrated.branchRows[0].wallThicknessSource, 'dtxr-direct-wall');
assert.equal(integrated.branchRows[1].wallThickness, '7.2', 'exact class wall must remain fallback authority');
assert.equal(integrated.branchRows[1].wallThicknessSource, 'piping-class-master');
assert.equal(integrated.nodeRows[0].boreMm, 100, 'node bore correction must remain active');
assert.equal(integrated.nodeRows[1].boreMm, 80, 'node bore correction must remain active');

console.log('XML CII Preview Bore/Wall indexed preparation checks passed.');
