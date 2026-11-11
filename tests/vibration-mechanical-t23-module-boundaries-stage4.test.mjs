import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MODULES = [
  'converters/vibration/mechanical/t23-method.js',
  'converters/vibration/mechanical/facility.js',
  'converters/vibration/mechanisms/mechanical.js',
  'tabs/vibration-integrity-mechanical-controller.js',
  'tabs/vibration-integrity-mechanical-view.js',
];

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Mechanical T2.3 JavaScript modules remain below 300 physical lines', async () => {
  for (const path of MODULES) {
    const text = await source(path);
    assert.ok(text.split(/\r?\n/u).length < 300, `${path} exceeds the 300-line policy`);
  }
});

test('facility bridge reuses the controlled direct T2.3 evaluator instead of embedding a second baseline table', async () => {
  const facility = await source('converters/vibration/mechanical/facility.js');
  assert.match(facility, /evaluateMechanicalT23DirectBaseline/u);
  assert.doesNotMatch(facility, /RECIP_PD_COMPRESSOR_OR_PUMP[^\n]*0\.90/u);
  assert.doesNotMatch(facility, /CENTRIFUGAL_COMPRESSOR[^\n]*0\.20/u);
  assert.doesNotMatch(facility, /ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW[^\n]*0\.40/u);
});

test('bounded screening authority is direct-table-only and excluded branches remain unauthorized', async () => {
  const method = await source('converters/vibration/mechanical/t23-method.js');
  const text = (await Promise.all(MODULES.map(source))).join('\n');

  assert.match(method, /screeningAuthority:\s*['"]AUTHORIZED['"]/u);
  assert.match(method, /authorityScope:\s*['"]DIRECT_TABLE_T2_3_BASELINE_ONLY['"]/u);
  assert.match(method, /dynamicReductionAuthorized:\s*false/u);
  assert.match(method, /sharedSupportTransferAuthorized:\s*false/u);
  assert.match(method, /MECHANICAL_T23_DYNAMIC_REDUCTION_RULE/u);
  assert.match(method, /reducedLof:\s*0\.40/u);
  assert.match(method, /screeningAuthority:\s*['"]NOT_AUTHORIZED['"]/u);

  assert.doesNotMatch(text, /designAuthority:\s*true/u);
  assert.doesNotMatch(text, /masterDataAuthority:\s*true/u);
  assert.doesNotMatch(text, /dynamicReductionAuthorized:\s*true/u);
  assert.doesNotMatch(text, /sharedSupportTransferAuthorized:\s*true/u);
  assert.doesNotMatch(text, /publicationState:\s*['"]ACTIVE['"]/u);
  assert.doesNotMatch(text, /qualifiedReducedLof/u);
});

test('shared-support transfer remains a blocked rule requiring explicit adjacent-line LOF', async () => {
  const method = await source('converters/vibration/mechanical/t23-method.js');
  const facility = await source('converters/vibration/mechanical/facility.js');
  assert.match(method, /MECHANICAL_T23_SHARED_SUPPORT_RULE/u);
  assert.match(method, /MECHANICAL_T23_SHARED_SUPPORT_REQUIRES_ADJACENT_LOF/u);
  assert.match(method, /adjacentLofThreshold:\s*0\.50/u);
  assert.match(method, /implementationState:\s*['"]NOT_IMPLEMENTED_IN_DIRECT_BASELINE_SCREENING['"]/u);
  assert.match(facility, /directBaselineAvailable:\s*false/u);
});
