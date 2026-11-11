import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnergyInstituteEitDocument } from '../converters/vibration/eit/parse.js';
import { buildVibrationIntegrityProjectFromEit } from '../converters/vibration/project/from-eit.js';
import { parseVibrationIntegrityProject, serializeVibrationIntegrityProject } from '../converters/vibration/project/serialize.js';
import { buildVibrationRoadmapStateFromProject } from '../converters/vibration/project/roadmap.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';

function importedFixture() {
  return parseEnergyInstituteEitDocument({
    options: { version: 5, title: 'Worked Example', project: 3010 },
    lines: [
      { rid: '4', modules: 'fit,fip,sbc,mex', fit: '0.02', fit_data: '[{"span":"8.32"}]', fip: '1.00', fip_data: '[{"lof":1}]', sbc: '0.66', sbc_data: '[{"lof":0.66}]', mex: '0.40', mex_data: '[{"lof":0.4}]' },
      { rid: '12', modules: 'fit,tra', fit: '3.12', fit_data: '[{"span":"18.61"}]', tra: '0.06', tra_data: '[{"lof":0.06}]', caf_data: '[{"itag":"FCV1002"}]' },
    ], pipes: [], streams: [], mats: [],
  }, { sourceName: 'worked.eit' });
}

function node(projection, mechanismId) {
  return projection.phases.flatMap((phase) => phase.nodes).find((item) => item.mechanismId === mechanismId);
}

test('EIT creates a persistence-only project without promoting imported results', () => {
  const project = buildVibrationIntegrityProjectFromEit(importedFixture());
  assert.equal(project.schema, 'VibrationIntegrityProject.v1');
  assert.equal(project.project.projectId, 'eit-project:3010');
  assert.equal(project.authority.importedResultsAreCurrentEngineeringAuthority, false);
  assert.equal(project.currentResults.length, 0);
  assert.equal(project.mechanismImports.length, 7);
});

test('undeclared CAF detail survives into project mechanism imports', () => {
  const project = buildVibrationIntegrityProjectFromEit(importedFixture());
  const caf = project.mechanismImports.find((item) => item.eitModuleCode === 'caf');
  assert.ok(caf);
  assert.equal(caf.payload.declaredInModules, false);
  assert.equal(caf.payload.dataPresent, true);
});

test('project serialize/import is deterministic and semantic round-trip', () => {
  const original = buildVibrationIntegrityProjectFromEit(importedFixture());
  const text = serializeVibrationIntegrityProject(original);
  const restored = parseVibrationIntegrityProject(text);
  assert.equal(serializeVibrationIntegrityProject(restored), text);
  assert.deepEqual(restored, original);
});

test('duplicate EIT rid fails closed instead of inventing subject identity', () => {
  const imported = importedFixture();
  const mutable = JSON.parse(JSON.stringify(imported));
  mutable.lines[1].rid = mutable.lines[0].rid;
  assert.throws(() => buildVibrationIntegrityProjectFromEit(mutable), /identity is not unique/);
});

test('project produces line-scoped roadmap state without engineering promotion', () => {
  const project = buildVibrationIntegrityProjectFromEit(importedFixture());
  const lineId = project.subjects.lines[1].lineId;
  const state = buildVibrationRoadmapStateFromProject(project, { lineId });
  const projection = buildVibrationRoadmapProjection(state);
  assert.equal(state.context.eitRid, '12');
  assert.equal(node(projection, 'fit').status, 'IMPORTED');
  assert.equal(node(projection, 'cavitationFlashing').status, 'IMPORTED');
  assert.equal(node(projection, 'aiv').status, 'AVAILABLE');
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
});

test('project file cannot forge engineering or screening authority', () => {
  const project = JSON.parse(serializeVibrationIntegrityProject(buildVibrationIntegrityProjectFromEit(importedFixture())));
  project.authority.screeningAuthorized = true;
  assert.throws(() => parseVibrationIntegrityProject(JSON.stringify(project)), /cannot grant engineering, screening, or design authority/);
});

test('V1 project rejects unqualified current-result payloads on load', () => {
  const project = JSON.parse(serializeVibrationIntegrityProject(buildVibrationIntegrityProjectFromEit(importedFixture())));
  project.currentResults.push({ result: 'unqualified' });
  assert.throws(() => parseVibrationIntegrityProject(JSON.stringify(project)), /does not yet accept current-result authority records/);
});
