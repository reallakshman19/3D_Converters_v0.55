import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngineeringMethodSource, engineeringMethodSourceLocator } from '../converters/vibration/source/method-source-record.js';
import { getVibrationEngineeringSource, listVibrationEngineeringSources, resolveVibrationRoadmapSourceBinding } from '../converters/vibration/source/registry.js';

test('typed locator keeps section and flowchart identities separate', () => {
  const source = createEngineeringMethodSource({ sourceId: 'S1', methodId: 'M1', publisher: 'P', publication: 'X', technicalModule: 'T2', sectionId: 'T2.4', flowchartId: 'T2-2', status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL' });
  assert.deepEqual(engineeringMethodSourceLocator(source), { technicalModule: 'T2', sectionId: 'T2.4', flowchartId: 'T2-2', equationId: null, tableId: null, figureId: null, printedPage: null, pdfPage: null });
});

test('bare ambiguous flowchart-like value cannot enter sectionId', () => {
  assert.throws(() => createEngineeringMethodSource({ sourceId: 'S1', methodId: 'M1', publisher: 'P', publication: 'X', technicalModule: 'T2', sectionId: 'T2-4', status: 'RECONCILIATION_REQUIRED', locatorBasis: 'REPOSITORY_LABEL' }), { code: 'ENGINEERING_METHOD_SOURCE_SECTION_INVALID' });
});

test('controlled source cannot be declared from repository-label custody', () => {
  assert.throws(() => createEngineeringMethodSource({ sourceId: 'S1', methodId: 'M1', publisher: 'P', publication: 'X', technicalModule: 'T1', status: 'CONTROLLED', locatorBasis: 'REPOSITORY_LABEL' }), { code: 'ENGINEERING_METHOD_SOURCE_CONTROLLED_BASIS_REQUIRED' });
});

test('EI technical modules T1 through T13 are distinct controlled source records', () => {
  const modules = Array.from({ length: 13 }, (_, i) => `T${i + 1}`);
  for (const module of modules) {
    const source = getVibrationEngineeringSource(`EI_AVIFF_2008:${module}`);
    assert.equal(source.technicalModule, module); assert.equal(source.status, 'CONTROLLED'); assert.equal(source.locatorBasis, 'CONTROLLED_SOURCE');
  }
  assert.ok(listVibrationEngineeringSources().length >= 13);
});

test('Mechanical T2.3 source is resolved to controlled Table T2-3 while unresolved mechanisms stay fail-closed', () => {
  const mechanical = resolveVibrationRoadmapSourceBinding({ mechanismId: 'mechanicalExcitation' });
  assert.equal(mechanical.status, 'RESOLVED');
  assert.equal(mechanical.sources[0].locatorBasis, 'CONTROLLED_SOURCE');
  assert.equal(mechanical.sources[0].sectionId, 'T2.3');
  assert.equal(mechanical.sources[0].tableId, 'T2-3');
  assert.equal(mechanical.sources[0].printedPage, 54);

  for (const mechanismId of ['fit', 'reciprocatingPulsation', 'aiv', 'valveTransients', 'cavitationFlashing']) {
    const binding = resolveVibrationRoadmapSourceBinding({ mechanismId });
    assert.equal(binding.status, 'RECONCILIATION_REQUIRED');
    assert.equal(binding.sources[0].locatorBasis, 'REPOSITORY_LABEL');
  }
});

test('thermowell binding exposes EI versus ASME source collision', () => {
  const binding = resolveVibrationRoadmapSourceBinding({ mechanismId: 'thermowells' });
  assert.equal(binding.status, 'CONFLICTED'); assert.equal(binding.sources.length, 2);
  assert.match(binding.displayLabel, /Source conflict:/); assert.match(binding.reason, /must not be silently combined/);
});
