import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildPreviewB313AutoBasisRows,
  derivePreviewB313AutoBasisRow,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js';

const a106Row = {
  material: 'ASTM A106-B',
  materialSource: 'piping-class-fallback',
  t1: '0',
};

const a106 = derivePreviewB313AutoBasisRow(a106Row, {});
assert.equal(a106.materialId, 'CS-A106-B');
assert.equal(a106.route, 'SEAMLESS');
assert.equal(a106.routeSource, 'A106 carbon-steel default');
assert.equal(a106.statusCode, 'FALLBACK_SEED_READY');
assert.equal(a106.statusLabel, 'FALLBACK SEED — REFRESH TO ACCEPT');
assert.equal(a106.fallback?.seedTemperatureC, 0);
assert.equal(a106.fallback?.designAuthority, false);
assert.match(a106.factorSummary, /CANDIDATE SEED @ 0 °C/);
assert.deepEqual(a106.tableContext, { materialId: 'CS-A106-B', temperatureC: 0 });

const a106BlankT1 = derivePreviewB313AutoBasisRow({
  ...a106Row,
  t1: '',
}, {});
assert.equal(a106BlankT1.statusCode, 'B313_PREVIEW_T1_REQUIRED');
assert.equal(a106BlankT1.statusLabel, 'T1 REQUIRED');
assert.equal(a106BlankT1.route, 'SEAMLESS');
assert.equal(a106BlankT1.routeSource, 'A106 carbon-steel default');
assert.equal(a106BlankT1.tableContext.temperatureC, undefined);
assert.match(a106BlankT1.factorSummary, /not evaluated until Preview T1 is resolved/);

const explicitRoute = derivePreviewB313AutoBasisRow(a106Row, {
  b313WallUpdate: {
    bases: {
      'MATID:CS-A106-B|T1=0': {
        materialId: 'CS-A106-B',
        designTemperature: '0',
        manufacturingRoute: 'ERW',
      },
    },
  },
});
assert.equal(explicitRoute.route, 'ERW');
assert.equal(explicitRoute.routeSource, 'controlled Preview basis');

const deduped = buildPreviewB313AutoBasisRows([a106Row, { ...a106Row }], {});
assert.equal(deduped.length, 1);

const runtimePath = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js', import.meta.url);
const docsPath = new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-b313-auto-basis.js', import.meta.url);
const diagnosticsPath = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js', import.meta.url);
const docsDiagnosticsPath = new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js', import.meta.url);

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const docsSource = fs.readFileSync(docsPath, 'utf8');
const diagnosticsSource = fs.readFileSync(diagnosticsPath, 'utf8');
const docsDiagnosticsSource = fs.readFileSync(docsDiagnosticsPath, 'utf8');

assert.equal(runtimeSource, docsSource, 'B31.3 auto-basis runtime/docs mirror must be byte-identical');
assert.equal(diagnosticsSource, docsDiagnosticsSource, 'Preview diagnostics runtime/docs mirror must be byte-identical');
assert.match(runtimeSource, /legacyEditor\.hidden = true/);
assert.match(runtimeSource, /legacyEditor\.style\.display = 'none'/);
assert.match(runtimeSource, /data-b313-auto-open-material/);
assert.match(runtimeSource, />▦<\/button>/);
assert.match(runtimeSource, /A106 carbon steel defaults to SEAMLESS/);
assert.match(runtimeSource, /Blank T1 is never treated as 0 °C/);
assert.match(runtimeSource, /data-b313-auto-field="\$\{field\}"/);
assert.match(runtimeSource, /fallbackInputCell\(model, 'S', 'allowableStress'/);
assert.match(runtimeSource, /fallbackInputCell\(model, 'E', 'qualityFactorE'/);
assert.match(runtimeSource, /fallbackInputCell\(model, 'W', 'weldStrengthReductionW'/);
assert.match(runtimeSource, /fallbackInputCell\(model, 'Y', 'coefficientY'/);
assert.match(runtimeSource, /data-b313-auto-field="stressUnit"/);
assert.match(runtimeSource, /data-b313-factor-info-button/);
assert.match(runtimeSource, /data-b313-auto-refresh/);
assert.match(runtimeSource, /USER_ACCEPTED_PREVIEW_FALLBACK/);
assert.match(runtimeSource, /no interpolation/i);
assert.match(diagnosticsSource, /installPreviewB313AutoBasisPanel/);

console.log('Issue 781 B31.3 automatic-basis/A106 route controlled-fallback checks passed.');
