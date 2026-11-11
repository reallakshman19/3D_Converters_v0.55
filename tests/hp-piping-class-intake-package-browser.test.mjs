import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runner = await readFile(new URL('../scripts/validate-hp-piping-class-intake-roundtrip-browser.mjs', import.meta.url), 'utf8');

test('runner requires the real routed HP workbench and intake enhancer', () => {
  assert.match(runner, /data-tab=\\?"engineering-calculations/);
  assert.match(runner, /data-engineering-subtab=\\?"hp-piping-class/);
  assert.match(runner, /data-hpwb-intake-package-editor/);
  assert.match(runner, /sourceGate/);
  assert.match(runner, /hp-piping-class-intake-package-enhancer\.js/);
});

test('runner admits the reference v1 package through the existing file-controller bridge', () => {
  assert.match(runner, /hp-piping-class-intake-package-v1\.example\.json/);
  assert.match(runner, /Class package applied\./);
  assert.match(runner, /format-converters\.hpPipingClass\.project\.v2/);
  assert.match(runner, /nativeCoreKd3Qualified, false/);
  assert.match(runner, /codeCompliance, false/);
  assert.match(runner, /canUseForDesignAuthority, false/);
});

test('runner proves export is the same v1 schema and authority fields are absent', () => {
  assert.match(runner, /Export editable package/);
  assert.match(runner, /hp-piping-class-intake-package\/v1/);
  assert.match(runner, /no package-owned engineering-input changes/);
  assert.match(runner, /hp-intake-package\.json/);
  assert.match(runner, /forbidden of \['calculationMode','nativeCoreKd3Qualified','codeCompliance','canUseForDesignAuthority'\]/);
});

test('runner forces method, stress, damage, fatigue and identity changes into the impact ledger', () => {
  assert.match(runner, /candidate\.method\.b313Edition = '2025'/);
  assert.match(runner, /candidate\.spectrum\.designLifeYears = 25/);
  assert.match(runner, /candidate\.tables\.products\.rows\[1\]\[4\] = 18\.27/);
  assert.match(runner, /candidate\.tables\.kd\[0\]\.rows\[0\]\[3\] = 75/);
  for (const phrase of ['method basis 1','stress basis 1','fatigue basis 1','damage basis 1','identity 1']) assert.ok(runner.includes(phrase));
});

test('runner falsifies stale comparison admission after workspace mutation', () => {
  assert.match(runner, /products\.1\.calculationBasis\.nominalWallMm/);
  assert.match(runner, /18\.25/);
  assert.match(runner, /INTAKE_PACKAGE_REVALIDATION_REQUIRED/);
  assert.match(runner, /stored\.metadata\.revision, 'A'/);
});

test('runner revalidates before admitting the modified package', () => {
  assert.match(runner, /metadata\?\.revision==='B'/);
  assert.match(runner, /stored\.methodManifest\.b313Edition, '2025'/);
  assert.match(runner, /stored\.transient\.spectrum\.designLifeYears, 25/);
  assert.match(runner, /stored\.products\[1\]\.calculationBasis\.nominalWallMm, 18\.27/);
  assert.match(runner, /equivalentAlternatingStressMpa, 75/);
});

test('runner checks canonical result return, mobile containment and runtime exceptions', () => {
  assert.match(runner, /data-hpwb-class-result-matrix/);
  assert.match(runner, /width: 375, height: 900/);
  assert.match(runner, /hpwb-intake-impact-table/);
  assert.match(runner, /Runtime\.exceptionThrown/);
  assert.match(runner, /intakeRoundTripFullAppQualified = true/);
});

test('receipt cannot claim FULL_APP before the routed journey completes', () => {
  assert.match(runner, /fullActiveWorkbenchNavigation: false/);
  assert.match(runner, /intakeRoundTripFullAppQualified: false/);
  assert.match(runner, /numericalAuthority: 'UNCHANGED'/);
});
