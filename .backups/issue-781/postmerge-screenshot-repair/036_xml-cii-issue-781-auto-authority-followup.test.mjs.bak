import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildRegexRoleSuggestions,
} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js';
import {
  applyRegexSuggestions,
  createDefaultRegexSuggestionProfile,
} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js';
import {
  resolveConfiguredMaterialCodeByMaterial,
} from '../converters/xml-cii2019-core/piping-class-material-code-resolver.js';
import {
  resolvePreviewMaterialCodeAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js';
import {
  resolvePreviewB313MaterialIdentity,
} from '../converters/xml-cii2019-core/b313-preview-wall-update.js';
import {
  suggestPreviewB313FallbackBasis,
} from '../converters/xml-cii2019-core/b313-preview-fallback-seed.js';
import {
  derivePreviewB313AutoBasisRow,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js';

const branch = '/SDMI-1000-TI-24"-P0310081-61440-01./B2';
const tokenRow = {
  source: branch,
  values: ['SDMI', '1000', 'TI', '24"', 'P0310081', '61440', '01.'],
};
const profile = createDefaultRegexSuggestionProfile();
const regexSuggestions = buildRegexRoleSuggestions({
  rows: [tokenRow],
  lineMasters: new Set(['P0310081']),
  classMasters: new Set(['61440']),
  classBoresByClass: new Map([['61440', new Set([600])]]),
  profile,
});
assert.deepEqual(regexSuggestions.map((item) => item.role).sort(), ['bore', 'lineKey', 'pipingClass']);
assert.equal(regexSuggestions.some((item) => item.role === 'rating'), false, 'Rating must be absent from smart inference');
assert.deepEqual(regexSuggestions.find((item) => item.role === 'bore')?.tokenPositions, [4]);
assert.deepEqual(regexSuggestions.find((item) => item.role === 'pipingClass')?.tokenPositions, [6]);
assert.deepEqual(regexSuggestions.find((item) => item.role === 'lineKey')?.tokenPositions, [5]);

const staleRegexConfig = {
  activeFormatIndex: 0,
  formats: [{
    lineKey: { tokenPosition: '1' },
    pipingClass: { tokenPosition: '2' },
    rating: { tokenPosition: '3' },
    bore: { tokenPosition: '6' },
  }],
};
const correctedRegex = applyRegexSuggestions(staleRegexConfig, {
  formatIndex: 0,
  suggestions: regexSuggestions,
}, { safeOnly: true, manualLocks: {} });
assert.equal(correctedRegex.formats[0].lineKey.tokenPosition, '5');
assert.equal(correctedRegex.formats[0].pipingClass.tokenPosition, '6');
assert.equal(correctedRegex.formats[0].bore.tokenPosition, '4');
assert.equal(correctedRegex.formats[0].rating.tokenPosition, '3', 'Suggestion application itself must not infer/overwrite Rating; UI auto-analysis performs stale unlocked Rating cleanup separately');

const materialMapConfig = {
  pipingClassMaterialCodeMap: {
    enabled: true,
    confidenceThreshold: 80,
    rows: [
      { pipingClass: '11261', materialCode: '106', materialCategory: 'CS', materialName: 'ASTM A106-B', rating: '150', confidence: 90, corrosion: 1 },
      { pipingClass: '61261', materialCode: '106', materialCategory: 'CS', materialName: 'ASTM A106-B', rating: '600', confidence: 90, corrosion: 1 },
      { pipingClass: '11441', materialCode: '106', materialCategory: 'CS Sour', materialName: 'ASTM A106-B', rating: '150', confidence: 90, corrosion: 3 },
    ],
  },
};
const configuredCs = resolveConfiguredMaterialCodeByMaterial({ material: 'CS', config: materialMapConfig });
assert.equal(configuredCs?.materialCode, '106');
assert.equal(configuredCs?.method, 'material-category-exact');
assert.equal(configuredCs?.matchedRowCount, 2);

const previewCs = resolvePreviewMaterialCodeAuthority({
  branchName: branch,
  lineKey: 'P0310081',
  processMaterial: 'CS',
  material: 'CS',
  materialSource: 'process-linelist-material',
  pipingClass: '61440',
}, materialMapConfig);
assert.equal(previewCs.materialCode, '106');
assert.equal(previewCs.materialCodeSource, 'process-material-config-map');
assert.equal(previewCs.materialCodeNeedsReview, false);
assert.equal(previewCs.materialCodeCandidates.length, 0, 'Generic 420 / 14541CS fuzzy candidate must not lead when Config 8 resolves CS');

const ambiguousMaterialConfig = {
  pipingClassMaterialCodeMap: {
    enabled: true,
    confidenceThreshold: 80,
    rows: [
      { pipingClass: '11261', materialCode: '106', materialCategory: 'CS', materialName: 'ASTM A106-B', confidence: 90 },
      { pipingClass: '99999', materialCode: '999', materialCategory: 'CS', materialName: 'Conflicting CS', confidence: 90 },
    ],
  },
};
assert.equal(resolveConfiguredMaterialCodeByMaterial({ material: 'CS', config: ambiguousMaterialConfig }), null, 'Ambiguous exact material category must fail closed');

const a106Identity = resolvePreviewB313MaterialIdentity({
  material: 'CS',
  materialSource: 'process-linelist-material',
});
assert.equal(a106Identity.ok, true);
assert.equal(a106Identity.material.materialId, 'CS-A106-B');
const a106Seed = suggestPreviewB313FallbackBasis({
  materialIdentity: a106Identity,
  designTemperatureC: 82,
});
assert.equal(a106Seed.ok, true);
assert.equal(a106Seed.seedTemperatureC, 120, 'T1 82 °C must select the nearest common S/E/W/Y point at or above T1');
assert.equal(a106Seed.selectionDirection, 'AT_OR_ABOVE_T1');
assert.equal(a106Seed.manufacturingRoute, 'SEAMLESS');
assert.equal(a106Seed.designAuthority, false);
assert.equal(a106Seed.stressUnit, 'MPa');
assert.ok(a106Seed.allowableStress > 0);
assert.ok(a106Seed.qualityFactorE > 0);
assert.ok(a106Seed.weldStrengthReductionW > 0);
assert.ok(a106Seed.coefficientY >= 0);
assert.ok(Object.values(a106Seed.factorSources).every(Boolean));

const autoBasis = derivePreviewB313AutoBasisRow({
  branchName: branch,
  lineKey: 'P0310081',
  material: 'CS',
  materialSource: 'process-linelist-material',
  t1: '82',
}, {});
assert.equal(autoBasis.materialId, 'CS-A106-B');
assert.equal(autoBasis.route, 'SEAMLESS');
assert.equal(autoBasis.statusCode, 'FALLBACK_SEED_READY');
assert.equal(autoBasis.fallback?.seedTemperatureC, 120);
assert.match(autoBasis.factorSummary, /CANDIDATE SEED @ 120 °C/);

const mirrorPairs = [
  ['tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js', 'docs/tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js'],
  ['tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js', 'docs/tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js'],
  ['converters/xml-cii2019-core/piping-class-material-code-resolver.js', 'docs/converters/xml-cii2019-core/piping-class-material-code-resolver.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js'],
  ['converters/xml-cii2019-core/b313-preview-fallback-seed.js', 'docs/converters/xml-cii2019-core/b313-preview-fallback-seed.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js'],
  ['tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js', 'docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js'],
];
for (const [runtime, docs] of mirrorPairs) {
  assert.equal(fs.readFileSync(new URL(`../${runtime}`, import.meta.url), 'utf8'), fs.readFileSync(new URL(`../${docs}`, import.meta.url), 'utf8'), `${runtime} mirror drift`);
}

const regexUi = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js', import.meta.url), 'utf8');
assert.match(regexUi, /void autoAnalyzeDatasetEvidence\(stateRef, render\)/);
assert.match(regexUi, /clearUnlockedRatingMapping/);
assert.match(regexUi, /Stale unlocked Rating mapping/);
assert.match(regexUi, /xml-cii-adapted-regex-smart-evidence\.js\?v=20260930-issue781-auto-authority-1/);
assert.match(regexUi, /Rating remains manual/);
assert.doesNotMatch(fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/xml-cii-regex-suggestion-candidates.js', import.meta.url), 'utf8'), /ratingCandidate|derivedRatingSuggestion|STANDARD_RATINGS/);

const phasePanel = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js', import.meta.url), 'utf8');
assert.match(phasePanel, /xml-cii-adapted-regex-smart-ui\.js\?v=20260930-issue781-auto-authority-1/);
assert.match(phasePanel, /xml-cii-adapted-preview-diagnostics-audit-v7\.js\?v=20260930-issue781-auto-authority-1/);

const b313Ui = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js', import.meta.url), 'utf8');
assert.match(b313Ui, /data-b313-factor-info-button/);
assert.match(b313Ui, /data-b313-auto-refresh/);
assert.match(b313Ui, /USER_ACCEPTED_PREVIEW_FALLBACK/);
assert.match(b313Ui, /no interpolation/i);

console.log('Issue 781 auto authority follow-up checks passed.');
