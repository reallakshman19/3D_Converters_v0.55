import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/mnt/data/xmlcii_c6b/tabs/xml-cii-2019-standalone/ui-adapted';
let moduleId = 0;

function stripImports(source) {
  const out = [];
  let skip = false;
  for (const line of source.split('\n')) {
    const trimmed = line.trimStart();
    if (!skip && trimmed.startsWith('import ')) {
      skip = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skip) {
      if (line.trimEnd().endsWith(';')) skip = false;
      continue;
    }
    if (trimmed.startsWith('export * from ')) continue;
    out.push(line);
  }
  return out.join('\n');
}

async function loadWithStubs(filename, stubs) {
  const key = `__c6b_stubs_${moduleId++}`;
  globalThis[key] = stubs;
  const names = Object.keys(stubs).join(', ');
  const body = `const { ${names} } = globalThis[${JSON.stringify(key)}];\n${stripImports(fs.readFileSync(filename, 'utf8'))}`;
  const url = `data:text/javascript;base64,${Buffer.from(body).toString('base64')}#${moduleId}`;
  return import(url);
}

class FakeElement {
  constructor(name, text = '', children = []) {
    this.nodeType = 1;
    this.localName = name;
    this.nodeName = name;
    this._text = text;
    this.childNodes = children;
    for (const child of children) child.parentNode = this;
  }
  get textContent() { return this.childNodes.length ? this.childNodes.map((c) => c.textContent).join('') : this._text; }
  cloneNode(deep = false) { return new FakeElement(this.localName, this._text, deep ? this.childNodes.map((c) => c.cloneNode(true)) : []); }
  removeChild(child) { this.childNodes = this.childNodes.filter((item) => item !== child); child.parentNode = null; return child; }
}

class FakeDocument {
  constructor(children = []) { this.nodeType = 9; this.childNodes = children; for (const child of children) child.parentNode = this; }
  cloneNode(deep = false) { return new FakeDocument(deep ? this.childNodes.map((c) => c.cloneNode(true)) : []); }
  getElementsByTagName(name) {
    const out = [];
    const visit = (node) => { for (const child of node.childNodes || []) { if (child.localName === name) out.push(child); visit(child); } };
    visit(this);
    return out;
  }
}

function el(name, text = '', children = []) { return new FakeElement(name, text, children); }
function childText(node, name) { return (node.childNodes || []).find((c) => c.localName === name)?.textContent || ''; }
function makeSourceDocument() {
  const gasket = el('Node', '', [el('ComponentType', 'GASK'), el('ElementLengthMm', '2'), el('BoreMm', '50')]);
  const pipe = el('Node', '', [el('ComponentType', 'PIPE'), el('NodeNumber', '10'), el('Position', '0 0 0'), el('BoreMm', '100')]);
  return new FakeDocument([el('Root', '', [el('Branch', '', [el('Branchname', 'B1'), gasket, pipe])])]);
}

function coreStubs() {
  return {
    deriveLineKeyFromBranchName: () => 'L1', tokenAtPosition: () => '',
    computeLineNoKey: () => '', normalizeLineListRow: (row) => row,
    xmlCiiWeightReviewNodeOverrideKey: () => 'K', isXmlCiiWeightReviewNode: () => false,
    xmlCiiNumberText: (v) => String(v ?? '').trim() && Number.isFinite(Number(v)) ? Number(v) : null,
    rankXmlCiiWeightCandidates: () => ({ nodeHint: null, candidates: [], rejectedCandidates: [], best: null }),
    formatValveHint: () => '', buildPipingClassIndex: () => ({}),
    resolveBranchProcessData: () => ({ rating: '150', pipingClass: 'A1', pipingClassMatchMethod: 'exact', pipingClassConfidence: 1, pipingClassScore: 1, pipingClassRowScore: 1, pipingClassRowReasons: [], pipingClassNeedsReview: false, pipingClassCandidates: [], material: 'CS', materialSource: 'xml-material-map', materialCode: 'MAT1', wallThicknessMm: 5, wallThicknessSource: 'piping-class-master', wallThicknessKey: 'PC:A1|DN:100', corrosionAllowanceMm: 1, corrosionSource: 'piping-class-master', corrosionKey: 'PC:A1', materialCodeKey: 'PC:A1' }),
    buildStagedDtxrIndex: () => ({}), resolveXmlCiiNodeDtxr: () => null,
    resolveLineListDensity: () => ({ value: '', source: 'none' }), resolveXmlCiiWallThicknessFromDtxr: () => null,
    previewOverrideProvenance: (_o, _b, _k, fallback) => fallback,
  };
}

function makeParser(raw, counter) {
  return class { parseFromString() { counter.count += 1; return raw.cloneNode(true); } };
}

const text = (value) => value == null ? '' : String(value).trim();
const xmlText = (node, name) => text(childText(node, name));

test('C6b static routing uses one raw source document across all full Preview authorities', () => {
  const wrapper = fs.readFileSync(path.join(ROOT, 'xml-cii-adapted-preview-dryrun.js'), 'utf8');
  const core = fs.readFileSync(path.join(ROOT, 'xml-cii-adapted-preview-dryrun-core.js'), 'utf8');
  const wall = fs.readFileSync(path.join(ROOT, 'xml-cii-adapted-preview-bore-wall-authority.js'), 'utf8');
  const rating = fs.readFileSync(path.join(ROOT, 'xml-cii-adapted-preview-rating-authority.js'), 'utf8');
  assert.match(wrapper, /getSourceDocumentContext\(xmlText\)\.document/);
  assert.match(wrapper, /buildStrictLineAuthorityCorePreview\([\s\S]*\{ sourceDocument \}/);
  assert.match(wrapper, /applyPreviewBoreWallAuthority\([\s\S]*sourceDocument/);
  assert.match(wrapper, /applyPreviewRatingAuthority\([\s\S]*sourceDocument/);
  assert.match(core, /sourceDocument\.cloneNode\(true\)/);
  assert.match(wall, /sourceDocumentOrParse\(xmlText, sourceDocument\)/);
  assert.match(rating, /ratingSourceDocument\(xmlText, sourceDocument\)/);
});

test('exact-source context parses once and reuses the document', async () => {
  const counter = { count: 0 };
  globalThis.DOMParser = makeParser(makeSourceDocument(), counter);
  const mod = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-source-derived-context.js'), { perfAddMs: () => {}, perfCount: () => {}, perfNow: () => 0 });
  mod.resetSourceDocumentContextCache();
  const first = mod.getSourceDocumentContext('<A/>');
  const second = mod.getSourceDocumentContext('<A/>');
  assert.equal(counter.count, 1);
  assert.equal(first.document, second.document);
  mod.getSourceDocumentContext('<B/>');
  assert.equal(counter.count, 2);
});

test('top-level full Preview performs one full-source parse and forwards the same raw DOM', async () => {
  const raw = makeSourceDocument();
  const counter = { count: 0 };
  globalThis.DOMParser = makeParser(raw, counter);
  const contextMod = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-source-derived-context.js'), { perfAddMs: () => {}, perfCount: () => {}, perfNow: () => 0 });
  contextMod.resetSourceDocumentContextCache();
  let coreDoc, wallDoc, ratingDoc;
  const wrapper = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-preview-dryrun.js'), {
    buildCorePreview: (_x, _c, _s, runtime) => { coreDoc = runtime.sourceDocument; return { branchRows: [], nodeRows: [] }; },
    applyPreviewBoreWallAuthority: ({ result, sourceDocument }) => { wallDoc = sourceDocument; return result; },
    applyPreviewMaterialCodeAuthority: ({ result }) => result,
    applyPreviewRatingAuthority: ({ result, sourceDocument }) => { ratingDoc = sourceDocument; return result; },
    rerankPreviewNodeRows: (rows) => rows,
    buildIncrementalPreview: ({ fullBuild }) => ({ result: fullBuild() }),
    getSourceDocumentContext: contextMod.getSourceDocumentContext,
  });
  wrapper.xmlCiiDryRunPreview('<Root/>', {}, '');
  assert.equal(counter.count, 1);
  assert.equal(coreDoc, wallDoc);
  assert.equal(coreDoc, ratingDoc);
});

test('strict-line fragment rebuild does not inherit the full-source document', async () => {
  globalThis.XMLSerializer = class { serializeToString() { return '<Branch/>'; } };
  const wrapper = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-preview-dryrun.js'), {
    buildCorePreview: () => ({ branchRows: [], nodeRows: [] }), applyPreviewBoreWallAuthority: ({ result }) => result,
    applyPreviewMaterialCodeAuthority: ({ result }) => result, applyPreviewRatingAuthority: ({ result }) => result,
    rerankPreviewNodeRows: (rows) => rows, buildIncrementalPreview: ({ fullBuild }) => ({ result: fullBuild() }),
    getSourceDocumentContext: () => ({ document: null }),
  });
  const raw = makeSourceDocument();
  const calls = [];
  const build = (...args) => { calls.push(args); return calls.length === 1 ? { branchRows: [{ branchName: 'B1', lineKeyMethod: 'similar-linekey' }], nodeRows: [] } : { branchRows: [{ branchName: 'B1', lineKeyMethod: 'none' }], nodeRows: [] }; };
  wrapper.buildStrictLineAuthorityCorePreview('FULL', {}, '', { sourceDocument: raw, buildCorePreview: build, branchFragments: (_x, doc) => { assert.equal(doc, raw); return [{ xmlText: 'FRAGMENT' }]; } });
  assert.equal(calls[0][3].sourceDocument, raw);
  assert.equal(calls[1][3], undefined);
});

test('core source-document path is deep-equivalent to fallback parsing and leaves raw DOM untouched', async () => {
  const raw = makeSourceDocument();
  const counter = { count: 0 };
  globalThis.DOMParser = makeParser(raw, counter);
  const core = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-preview-dryrun-core.js'), coreStubs());
  const config = {};
  const baseline = core.xmlCiiDryRunPreview('SOURCE', config, '');
  assert.equal(counter.count, 1);
  counter.count = 0;
  const optimized = core.xmlCiiDryRunPreview('SOURCE', config, '', { sourceDocument: raw });
  assert.deepEqual(optimized, baseline);
  assert.equal(counter.count, 0);
  assert.equal(raw.getElementsByTagName('Node').length, 2);
  assert.equal(optimized.branchRows[0].sizeMm, 100);
});

test('Bore/Wall and Rating authorities are deep-equivalent with raw DOM handoff', async () => {
  const raw = makeSourceDocument();
  const counter = { count: 0 };
  globalThis.DOMParser = makeParser(raw, counter);
  const wall = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-preview-bore-wall-authority.js'), {
    collectStagedBranchWallEvidence: () => [], collectXmlBranchWallEvidence: () => [], childText, children: (n, name) => (n.childNodes || []).filter((c) => c.localName === name), findExactClassWall: () => null,
    nodeBoreMm: (n) => Number(childText(n, 'BoreMm')) || null, resolveBranchNominalBore: (_n, b) => b, text,
    resolveXmlCiiWallThicknessWithEvidence: () => null,
  });
  const initial = { branchRows: [{ branchName: 'B1', sizeMm: 100, size: '100mm' }], nodeRows: [] };
  const wallBaseline = wall.applyPreviewBoreWallAuthority({ xmlText: 'SOURCE', config: {}, stagedJsonText: '', result: initial });
  counter.count = 0;
  const wallOptimized = wall.applyPreviewBoreWallAuthority({ xmlText: 'SOURCE', config: {}, stagedJsonText: '', result: initial, sourceDocument: raw });
  assert.deepEqual(wallOptimized, wallBaseline);
  assert.equal(counter.count, 0);

  const rating = await loadWithStubs(path.join(ROOT, 'xml-cii-adapted-preview-rating-authority.js'), {
    findBestPipingClassRow: () => null, buildPipingClassIndex: () => ({}), deriveXmlCiiPipingClassFromBranchName: () => '', buildStagedDtxrIndex: () => ({}), resolveXmlCiiNodeDtxr: () => null,
    rankXmlCiiWeightCandidates: () => ({ nodeHint: null, candidates: [], rejectedCandidates: [], best: null }), formatValveHint: () => '', resolveXmlCiiAutomaticRating: () => ({ rating: '150' }),
    resolveXmlCiiRatingAuthority: () => ({ rating: '150', source: 'stub', resolvedSource: 'stub', dtxrRating: '', dtxrRatings: [], dtxrEvidence: [], dtxrConflict: false }), isPreviewDtxrRatingOverride: () => false,
    _ratingKeys: () => [], _rowText: () => '', _toText: text, _xmlChildrenByName: (n, name) => (n.childNodes || []).filter((c) => c.localName === name), _xmlText: xmlText,
  });
  counter.count = 0;
  const ratingBaseline = rating.applyPreviewRatingAuthority({ xmlText: 'SOURCE', config: {}, stagedJsonText: '', result: wallBaseline });
  assert.equal(counter.count, 1);
  counter.count = 0;
  const ratingOptimized = rating.applyPreviewRatingAuthority({ xmlText: 'SOURCE', config: {}, stagedJsonText: '', result: wallBaseline, sourceDocument: raw });
  assert.deepEqual(ratingOptimized, ratingBaseline);
  assert.equal(counter.count, 0);
});
