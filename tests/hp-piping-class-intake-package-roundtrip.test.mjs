import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { previewHpPipingClassIntakePackageForReview } from '../tabs/hp-piping-class-intake-package-review.js';
import {
  buildHpPipingClassIntakePackageExport,
  compareHpPipingClassIntakeReplacement,
} from '../tabs/hp-piping-class-intake-package-roundtrip.js';

const example = JSON.parse(await readFile(new URL('../docs/hp-piping-class-intake-package-v1.example.json', import.meta.url), 'utf8'));
const enhancer = await readFile(new URL('../tabs/hp-piping-class-intake-package-enhancer.js', import.meta.url), 'utf8');

function importedProject() {
  const preview = previewHpPipingClassIntakePackageForReview(example);
  assert.equal(preview.ok, true);
  return structuredClone(preview.project);
}

test('v1 package-imported project exports and re-imports with package-owned engineering inputs unchanged', () => {
  const project = importedProject();
  const built = buildHpPipingClassIntakePackageExport(project);
  assert.equal(built.ok, true);
  assert.equal(built.roundTrip.ok, true);
  assert.equal(built.package.schemaVersion, 'hp-piping-class-intake-package/v1');
  assert.equal(built.reimport.ok, true);
  assert.equal(built.reimport.project.products.length, project.products.length);
  assert.equal(built.reimport.project.transient.states.length, project.transient.states.length);
  assert.equal(built.reimport.project.transient.transitions.length, project.transient.transitions.length);
  assert.equal(built.reimport.project.fatigueEvidence.length, project.fatigueEvidence.length);
  for (const forbidden of ['calculationMode','nativeCoreKd3Qualified','codeCompliance','canUseForDesignAuthority']) {
    assert.equal(built.serialized.includes(`"${forbidden}"`), false);
  }
  const impact = compareHpPipingClassIntakeReplacement(project, built.reimport.project);
  assert.equal(impact.changed, false);
  assert.equal(impact.summary.totalChanges, 0);
});

test('replacement impact separates stress, fatigue and damage basis changes deterministically', () => {
  const current = importedProject();
  const candidate = structuredClone(current);
  candidate.products[0].calculationBasis.nominalWallMm += 0.5;
  candidate.transient.states.find((row) => row.stateId === 'HIGH').pressureMpa += 1;
  candidate.transient.transitions[0].totalCycles += 250;
  candidate.fatigueEvidence[0].externalResults[0].equivalentAlternatingStressMpa += 5;
  const impact = compareHpPipingClassIntakeReplacement(current, candidate);
  assert.equal(impact.changed, true);
  assert.equal(impact.highImpact, true);
  assert.equal(impact.summary.STRESS_BASIS, 2);
  assert.equal(impact.summary.DAMAGE_BASIS, 1);
  assert.equal(impact.summary.FATIGUE_BASIS, 1);
  assert.deepEqual(impact.changes.map((row) => [row.domain, row.field, row.impact]), [
    ['PRODUCT','wall','STRESS_BASIS'],
    ['STATE','pressureMpa','STRESS_BASIS'],
    ['CYCLE','totalCycles','DAMAGE_BASIS'],
    ['KD','equivalentAlternatingStressMpa','FATIGUE_BASIS'],
  ]);
});

test('method editions, spectrum life and spectrum custody cannot hide from replacement preview', () => {
  const current = importedProject();
  const candidate = structuredClone(current);
  candidate.methodManifest.b313Edition = '2025';
  candidate.methodManifest.viii3Edition = '2026';
  candidate.transient.spectrum.designLifeYears = 25;
  candidate.transient.spectrum.checkedBy = 'Checker B';
  const impact = compareHpPipingClassIntakeReplacement(current, candidate);
  assert.equal(impact.highImpact, true);
  assert.equal(impact.summary.METHOD_BASIS, 2);
  assert.equal(impact.summary.DAMAGE_BASIS, 1);
  assert.equal(impact.summary.CUSTODY, 1);
  assert.deepEqual(impact.changes.map((row) => [row.field, row.impact]), [
    ['b313Edition','METHOD_BASIS'],
    ['viii3Edition','METHOD_BASIS'],
    ['designLifeYears','DAMAGE_BASIS'],
    ['checkedBy','CUSTODY'],
  ]);
});

test('stale external KD state-pair binding blocks editable export instead of being silently rebound', () => {
  const project = importedProject();
  const row = project.fatigueEvidence[0].externalResults[0];
  row.fromStateId = 'HIGH';
  row.toStateId = 'LOW';
  const built = buildHpPipingClassIntakePackageExport(project);
  assert.equal(built.ok, false);
  assert.ok(built.issues.some((item) => item.code === 'INTAKE_PACKAGE_EXPORT_KD_STATE_BINDING_MISMATCH'));

  const candidate = importedProject();
  const impact = compareHpPipingClassIntakeReplacement(project, candidate);
  assert.equal(impact.summary.FATIGUE_BASIS, 2);
  assert.deepEqual(impact.changes.filter((item) => item.domain === 'KD').map((item) => item.field), ['fromStateId','toStateId']);
});

test('added and removed rows are explicit structural replacement impacts', () => {
  const current = importedProject();
  const candidate = structuredClone(current);
  candidate.products.pop();
  candidate.transient.states.push({ spectrumId: candidate.transient.spectrum.spectrumId, stateId: 'MID', pressureMpa: 10, materialTemperatureC: 60, structuralTemperatureC: 60 });
  const impact = compareHpPipingClassIntakeReplacement(current, candidate);
  assert.equal(impact.summary.STRUCTURE, 2);
  assert.ok(impact.changes.some((row) => row.domain === 'PRODUCT' && row.after === 'REMOVED'));
  assert.ok(impact.changes.some((row) => row.domain === 'STATE' && row.after === 'ADDED'));
});

test('governed product export fails closed instead of emitting a lossy editable package', () => {
  const project = importedProject();
  project.products[0].calculationBasis = { mode: 'GOVERNED_BASIS_PACKAGE', basisPackage: { id: 'CONTROLLED' } };
  const built = buildHpPipingClassIntakePackageExport(project);
  assert.equal(built.ok, false);
  assert.ok(built.issues.some((row) => row.code === 'INTAKE_PACKAGE_EXPORT_GOVERNED_PRODUCT_UNSUPPORTED'));
  assert.ok(built.issues.some((row) => row.code === 'INTAKE_PACKAGE_EXPORT_FIELD_UNSUPPORTED'));
});

test('external KD calculation-basis custody and empty evidence shells fail closed on export', () => {
  const withBasis = importedProject();
  withBasis.fatigueEvidence[0].externalResults[0].calculationBasis = { calculationRef: 'EXT-001', checkedBy: 'CHECKER' };
  const blockedBasis = buildHpPipingClassIntakePackageExport(withBasis);
  assert.equal(blockedBasis.ok, false);
  assert.ok(blockedBasis.issues.some((row) => row.code === 'INTAKE_PACKAGE_EXPORT_KD_BASIS_UNSUPPORTED'));

  const empty = importedProject();
  empty.fatigueEvidence[0].externalResults = [];
  const blockedEmpty = buildHpPipingClassIntakePackageExport(empty);
  assert.equal(blockedEmpty.ok, false);
  assert.ok(blockedEmpty.issues.some((row) => row.code === 'INTAKE_PACKAGE_EXPORT_EMPTY_KD_PACKAGE_UNSUPPORTED'));
});

test('UI exposes editable export, deterministic impact preview and stale-validation blocker', () => {
  assert.match(enhancer, /Export editable package/);
  assert.match(enhancer, /Validate \+ compare/);
  assert.match(enhancer, /compareHpPipingClassIntakeReplacement/);
  assert.match(enhancer, /buildHpPipingClassIntakePackageExport/);
  assert.match(enhancer, /INTAKE_PACKAGE_REVALIDATION_REQUIRED/);
  assert.match(enhancer, /validatedCurrentSignature/);
  assert.match(enhancer, /Replacement impact/);
  assert.match(enhancer, /method basis/);
  assert.match(enhancer, /lossless only for the v1 representable surface/);
});
