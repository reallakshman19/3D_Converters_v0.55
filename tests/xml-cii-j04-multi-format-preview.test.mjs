import assert from 'node:assert/strict';
import test from 'node:test';

import { runStandaloneRegexTester, resetRegexTesterCacheForTests } from '../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';
import { _derivePipingClassFromBranchName } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js';
import { deriveLineKeyFromBranchName } from '../converters/xml-cii2019-core/regex-line-key.js';
import { xmlCiiDryRunPreview } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js';
import { resolveBranchProcessData } from '../converters/xml-cii2019-core/branch-process-resolver.js';
import { buildPipingClassIndex } from '../converters/xml-cii2019-core/piping-class-resolver.js';

const dominantBranch = '/ASIM-1885-3"-S8811000-91261M7-HC-01/B1';
const alternativeBranch = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2';

const extractionConfig = {
  activeFormatIndex: 0,
  ratingSequence: [],
  formats: [
    {
      tokenDelimiter: '-',
      lineKeyJoiner: '',
      lineKey: { regex: '^/ASIM-1885-[0-9]+(?:")?-(S[0-9]+)', group: 1, tokenPosition: '' },
      pipingClass: { regex: '^/ASIM-1885-[0-9]+(?:")?-S[0-9]+-([A-Z0-9]+)', group: 1, tokenPosition: '' },
      rating: { regex: '', group: 1, tokenPosition: '' },
      bore: { regex: '^/ASIM-1885-([0-9]+)(?:")?', group: 1, tokenPosition: '' },
    },
    {
      tokenDelimiter: '-',
      lineKeyJoiner: '',
      lineKey: { regex: '^/ASIM-1885-PL-HOT-(S[0-9]+)', group: 1, tokenPosition: '' },
      pipingClass: { regex: '^/ASIM-1885-PL-HOT-S[0-9]+-([A-Z0-9]+)', group: 1, tokenPosition: '' },
      rating: { regex: '', group: 1, tokenPosition: '' },
      bore: { regex: '', group: 1, tokenPosition: '' },
    },
  ],
};

const sourceText = [
  '<Plant>',
  '<Branch><Branchname>' + dominantBranch + '</Branchname></Branch>',
  '<Branch><Branchname>' + alternativeBranch + '</Branchname></Branch>',
  '</Plant>',
].join('');

function withDeclaredBranches(fn) {
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString(xml, mediaType) {
      assert.equal(xml, sourceText);
      assert.equal(mediaType, 'application/xml');
      const branches = [dominantBranch, alternativeBranch].map((name) => ({
        getAttribute: () => '',
        children: [{ localName: 'Branchname', textContent: name }],
      }));
      return {
        querySelector: () => null,
        getElementsByTagNameNS: (_namespace, tag) => tag === 'Branch' ? branches : [],
        getElementsByTagName: (tag) => tag === 'Branch' ? branches : [],
      };
    }
  };
  resetRegexTesterCacheForTests();
  try { return fn(); }
  finally {
    resetRegexTesterCacheForTests();
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
}

function inspectBothFormats() {
  return withDeclaredBranches(() => {
    const result = runStandaloneRegexTester({
      sourceText,
      sourceKind: 'xml',
      extractionConfig,
      supportConfigJson: '{}',
    });
    return { result, config: JSON.parse(result.supportConfigJson) };
  });
}

test('U1 Regex controls: Format 1 and 2 independently match expected engineering roles', () => {
  const { result, config } = inspectBothFormats();
  assert.equal(result.matchedRows.length, 2);
  assert.equal(config.regexTester.formats.length, 2);
  const dominant = result.matchedRows.find(row => row.branchName === dominantBranch);
  const alternative = result.matchedRows.find(row => row.branchName === alternativeBranch);
  assert.deepEqual(
    [dominant?.matchedFormatIndex, dominant?.lineKey, dominant?.pipingClass],
    [0, 'S8811000', '91261M7'],
  );
  assert.deepEqual(
    [alternative?.matchedFormatIndex, alternative?.lineKey, alternative?.pipingClass],
    [1, 'S8822000', '91261M7'],
  );
});

test('U1 RED: Preview derives the Format-2 piping class instead of the shifted Line Key', () => {
  const { config } = inspectBothFormats();
  assert.equal(
    _derivePipingClassFromBranchName(alternativeBranch, config),
    '91261M7',
    'Format 2 piping class must not silently fall back to the legacy shifted token',
  );
});

test('U1 RED: Preview derives the Format-2 line key instead of HOT', () => {
  const { config } = inspectBothFormats();
  assert.equal(
    deriveLineKeyFromBranchName(alternativeBranch, config),
    'S8822000',
    'Format 2 line key must not fall back to the legacy HOT token',
  );
});


function withMinimalPreviewDocument(callback) {
  const previousParser = globalThis.DOMParser;
  const branchElement = (name) => ({
    localName: 'Branch', nodeType: 1,
    childNodes: [{ localName: 'Branchname', nodeType: 1, textContent: name, childNodes: [] }],
  });
  globalThis.DOMParser = class {
    parseFromString(xml, type) {
      assert.equal(type, 'application/xml');
      assert.equal(xml, sourceText);
      const branches = [dominantBranch, alternativeBranch].map(branchElement);
      return {
        getElementsByTagName(tag) {
          if (tag === 'Branch') return branches;
          return [];
        },
      };
    }
  };
  try { return callback(); }
  finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
}

function persistedFormatConfig() {
  return inspectBothFormats().config;
}

test('U3: actual Preview rows use Regex Format-2 authority for both engineering identity fields', () => {
  const config = persistedFormatConfig();
  const preview = withMinimalPreviewDocument(() => xmlCiiDryRunPreview(sourceText, config, ''));
  assert.equal(preview.branchRows.length, 2);
  const dominant = preview.branchRows.find(row => row.branchName === dominantBranch);
  const alternative = preview.branchRows.find(row => row.branchName === alternativeBranch);
  assert.deepEqual([dominant?.lineKey, dominant?.pipingClass, dominant?.matchedFormatIndex, dominant?.extractionStatus],
    ['S8811000', '91261M7', 0, 'MATCHED']);
  assert.deepEqual([alternative?.lineKey, alternative?.pipingClass, alternative?.matchedFormatIndex, alternative?.extractionStatus],
    ['S8822000', '91261M7', 1, 'MATCHED']);
});

test('U3: a conflicting exact Line List class cannot silently overwrite configured class', () => {
  const config = persistedFormatConfig();
  config.linelist.masterRows = [{ lineKey: 'S8822000', pipingClass: '61440' }];
  const preview = withMinimalPreviewDocument(() => xmlCiiDryRunPreview(sourceText, config, ''));
  const alternative = preview.branchRows.find(row => row.branchName === alternativeBranch);
  assert.equal(alternative?.extractionStatus, 'AMBIGUOUS');
  assert.equal(alternative?.branchIdentityConflict, 'EXACT_LINE_LIST_CLASS_CONFLICT');
  assert.equal(alternative?.pipingClass, '');
  assert.equal(alternative?.materialCode, '');
  assert.equal(alternative?.materialCodeNeedsReview, true);
});

test('U3: an explicitly mapped class column takes precedence over canonical row alias', () => {
  const config = persistedFormatConfig();
  config.linelist.fieldMap = { ...(config.linelist.fieldMap || {}), pipingClass: 'Approved Class Column' };
  config.linelist.masterRows = [{ lineKey: 'S8822000', pipingClass: '61440', 'Approved Class Column': '91261M7' }];
  const preview = withMinimalPreviewDocument(() => xmlCiiDryRunPreview(sourceText, config, ''));
  const alternative = preview.branchRows.find(row => row.branchName === alternativeBranch);
  assert.equal(alternative?.extractionStatus, 'MATCHED');
  assert.equal(alternative?.branchIdentityConflict, '');
  assert.equal(alternative?.pipingClass, '91261M7');
});

test('U3: ambiguous formats fail closed through Preview into process and material authority', () => {
  const config = persistedFormatConfig();
  config.regexTester.formats.push({
    tokenDelimiter: '-',
    lineKey: { regex: '(S8822000)', group: 1 },
    pipingClass: { regex: '(S8822000)', group: 1 },
  });
  const preview = withMinimalPreviewDocument(() => xmlCiiDryRunPreview(sourceText, config, ''));
  const alternative = preview.branchRows.find(row => row.branchName === alternativeBranch);
  assert.equal(alternative?.extractionStatus, 'AMBIGUOUS');
  assert.equal(alternative?.pipingClass, '');
  assert.equal(alternative?.rating, '');
  assert.equal(alternative?.materialCode, '');
  assert.equal(alternative?.wallThickness, '');
});

test('U3: process resolver accepts authoritative class rather than re-deriving from legacy tokens', () => {
  const result = resolveBranchProcessData({
    branchName: alternativeBranch,
    lineKey: 'S8822000',
    lineRow: { pipingClass: '61440' },
    boreMm: 80,
    componentType: 'PIPE',
    pipingClassIndex: buildPipingClassIndex([]),
    config: { rating: { pipingClassTokenIndex: 5 } },
    branchIdentity: { status: 'MATCHED', lineKey: 'S8822000', pipingClass: '91261M7', matchedFormatIndex: 1 },
  });
  assert.equal(result.requestedPipingClass, '91261M7');
  assert.equal(result.pipingClassSource, 'configured-branch-format');
});

test('U4: 4 Preview computes independent Format 1/2 review passes on identity conflict',()=>{
  const config=persistedFormatConfig();
  config.regexTester.formats[0]={
    tokenDelimiter:'-',
    lineKey:{regex:'(S8822000)',group:1},
    pipingClass:{regex:'(S8822000)',group:1},
  };
  const preview=withMinimalPreviewDocument(()=>xmlCiiDryRunPreview(sourceText,config,''));
  const actual=preview.branchRows.find(r=>r.branchName===alternativeBranch);
  assert.equal(actual.extractionStatus,'AMBIGUOUS');
  assert.equal(actual.materialCode,'','neither competing master is authoritative');
  assert.equal(preview.formatPreviewPasses.length,2);
  const pass1=preview.formatPreviewPasses[0].branchRows.find(r=>r.branchName===alternativeBranch);
  const pass2=preview.formatPreviewPasses[1].branchRows.find(r=>r.branchName===alternativeBranch);
  assert.deepEqual([pass1.extractionStatus,pass1.lineKey,pass1.pipingClass],
    ['MATCHED','S8822000','S8822000']);
  assert.deepEqual([pass2.extractionStatus,pass2.lineKey,pass2.pipingClass],
    ['MATCHED','S8822000','91261M7']);
  assert.equal(actual.pipingClass,'','conflicting passes cannot choose a class');
});
