import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEnergyInstituteEitDocument } from '../converters/vibration/eit/parse.js';
import { buildVibrationIntegrityProjectFromEit } from '../converters/vibration/project/from-eit.js';
import { attachVibrationMeasurementEvidence } from '../converters/vibration/project/measurement.js';
import { buildVibrationRoadmapStateFromProject } from '../converters/vibration/project/roadmap.js';
import { buildVibrationRoadmapProjection } from '../converters/vibration/roadmap/projection.js';
import {
  VIBRATION_ROADMAP_DEFAULT_WIDTH,
  VIBRATION_ROADMAP_MAX_WIDTH,
  VIBRATION_ROADMAP_MIN_WIDTH,
  clampVibrationRoadmapWidth,
} from '../tabs/vibration-roadmap-controller.js';
import { renderVibrationRoadmapPanel } from '../tabs/vibration-roadmap-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const controllerSource = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-controller.js'), 'utf8');
const RAW = `sha256:${'1'.repeat(64)}`;
const PRODUCT = `sha256:${'2'.repeat(64)}`;
const SNAPSHOT = `sha256:${'3'.repeat(64)}`;

function baseProject() {
  const imported = parseEnergyInstituteEitDocument({
    options: { version: 5, title: 'Roadmap Measurement', project: 7001 },
    lines: [
      { rid: 'L1', modules: 'fit', fit: '0.1', fit_data: '[]' },
      { rid: 'L2', modules: 'fit', fit: '0.2', fit_data: '[]' },
    ],
    pipes: [], streams: [], mats: [],
  });
  return buildVibrationIntegrityProjectFromEit(imported);
}

function measurementPackage(lineId, { withProduct = false } = {}) {
  const sessionId = 'MS-L1';
  return {
    schema: 'VibrationMeasurementEvidencePackage.v1',
    sessions: [{
      schema: 'VibrationMeasurementSession.v1',
      sessionId,
      scope: {
        lineId, caseId: 'NORMAL', operatingCaseSnapshotId: 'OCS-1',
        operatingCaseSnapshotHash: SNAPSHOT,
      },
      acquisition: {
        startedAt: '2026-08-18T09:00:00Z',
        instrumentConfiguration: {
          configurationId: 'DAQ-CFG-1', acquisitionSystemId: 'DAQ-1',
          source: 'FIELD-PACK', sourceRevision: 'REV-A',
        },
      },
      channels: [{
        channelId: 'CH-1', quantity: 'ACCELERATION', unit: 'm/s2',
        sensor: { sensorId: 'S-1', sensorType: 'ACCELEROMETER', model: 'M1', serialNumber: 'SN1' },
        location: { subjectType: 'LINE_ELEMENT', subjectId: 'E1' },
        orientation: { referenceFrame: 'PIPE_LOCAL', direction: 'VERTICAL' },
        calibration: {
          calibrationId: 'CAL-1', certificateId: 'CERT-1', source: 'CAL-LAB',
          sourceRevision: '2026-07', validAtAcquisition: true,
        },
        sampling: { sampleRateHz: 2048, durationS: 10 },
        rawData: { artifactId: 'raw.csv', sha256: RAW, format: 'CSV', immutable: true },
      }],
      source: { source: 'FIELD-PACK', sourceRevision: 'REV-A', recordId: sessionId },
      authority: {
        authority: 'FIELD_MEASUREMENT_EVIDENCE_ONLY', screeningAuthority: 'NOT_AUTHORIZED',
        designAuthority: false, rootCauseAuthority: false,
      },
    }],
    products: withProduct ? [{
      schema: 'VibrationSignalProduct.v1',
      productId: 'SP-1', sessionId, channelIds: ['CH-1'], productType: 'FFT',
      inputRawDataHashes: [RAW],
      processing: {
        processingRecipeId: 'FFT-RECIPE', version: '1',
        source: 'SIGNAL-PACK', sourceRevision: 'REV-A',
      },
      artifact: { artifactId: 'fft.json', sha256: PRODUCT, format: 'JSON' },
      authority: {
        authority: 'DERIVED_SIGNAL_EVIDENCE_ONLY', screeningAuthority: 'NOT_AUTHORIZED',
        designAuthority: false, rootCauseAuthority: false,
      },
    }] : [],
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY', screeningAuthorized: false,
      designAuthority: false, rootCauseAuthority: false,
    },
  };
}

function node(projection, id) {
  return projection.phases.flatMap((phase) => phase.nodes).find((item) => item.id === id);
}

function measuredProject({ withProduct = false } = {}) {
  const project = baseProject();
  return attachVibrationMeasurementEvidence(
    project,
    measurementPackage(project.subjects.lines[0].lineId, { withProduct }),
  );
}

test('VIB-ROADMAP-MEAS-001 selected-line session drives Basic Measurement DATA only', () => {
  const project = measuredProject();
  const state = buildVibrationRoadmapStateFromProject(project, { lineId: project.subjects.lines[0].lineId });
  const projection = buildVibrationRoadmapProjection(state);
  assert.equal(node(projection, 'basic-measurement').status, 'DATA');
  assert.match(node(projection, 'basic-measurement').detail, /1 measurement session/i);
  assert.equal(node(projection, 'specialist-measurement').status, 'AVAILABLE');
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
});

test('VIB-ROADMAP-MEAS-002 derived product drives Specialist Measurement DATA without RCA promotion', () => {
  const project = measuredProject({ withProduct: true });
  const state = buildVibrationRoadmapStateFromProject(project, { lineId: project.subjects.lines[0].lineId });
  const projection = buildVibrationRoadmapProjection(state);
  assert.equal(node(projection, 'specialist-measurement').status, 'DATA');
  assert.match(node(projection, 'specialist-measurement').detail, /1 derived signal product/i);
  assert.notEqual(node(projection, 'specialist-measurement').status, 'CURRENT_RESULT');
  assert.equal(projection.authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('VIB-ROADMAP-MEAS-003 measurement evidence is selected-line scoped', () => {
  const project = measuredProject({ withProduct: true });
  const state = buildVibrationRoadmapStateFromProject(project, { lineId: project.subjects.lines[1].lineId });
  const projection = buildVibrationRoadmapProjection(state);
  assert.equal(node(projection, 'basic-measurement').status, 'AVAILABLE');
  assert.equal(node(projection, 'specialist-measurement').status, 'AVAILABLE');
});

test('VIB-ROADMAP-MEAS-004 controller keeps external state separate from derived project evidence', () => {
  assert.match(controllerSource, /explicitMechanismStates/);
  assert.match(controllerSource, /mechanismStates:\s*explicitMechanismStates/);
  assert.doesNotMatch(
    controllerSource,
    /buildVibrationRoadmapStateFromProject[\s\S]{0,240}mechanismStates:\s*displayState\.mechanismStates/,
  );
});

test('VIB-ROADMAP-MEAS-005 specialist measurement is presented under VERIFY', () => {
  const projection = buildVibrationRoadmapProjection();
  const verify = projection.phases.find((phase) => phase.id === 'VERIFY');
  assert.ok(verify.nodes.some((item) => item.id === 'basic-measurement'));
  assert.ok(verify.nodes.some((item) => item.id === 'specialist-measurement'));
});

test('VIB-ROADMAP-UI-001 width clamp has deterministic desktop limits', () => {
  assert.equal(clampVibrationRoadmapWidth(undefined), VIBRATION_ROADMAP_DEFAULT_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(1), VIBRATION_ROADMAP_MIN_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(9999), VIBRATION_ROADMAP_MAX_WIDTH);
  assert.equal(clampVibrationRoadmapWidth(420), 420);
});

test('VIB-ROADMAP-UI-002 expanded rail exposes an accessible left-edge resize separator', () => {
  const html = renderVibrationRoadmapPanel(buildVibrationRoadmapProjection(), { width: 420 });
  assert.match(html, /data-roadmap-width="420"/);
  assert.match(html, /data-roadmap-resize/);
  assert.match(html, /role="separator"/);
  assert.match(html, /aria-orientation="vertical"/);
});

test('VIB-ROADMAP-UI-003 collapsed rail is a right-side compact tab without resize handle', () => {
  const html = renderVibrationRoadmapPanel(buildVibrationRoadmapProjection(), { collapsed: true, width: 420 });
  assert.match(html, /vibration-roadmap-panel is-collapsed/);
  assert.doesNotMatch(html, /data-roadmap-resize/);
  assert.match(html, /Expand vibration roadmap/);
});

test('VIB-ROADMAP-UI-004 stylesheet uses adjustable width and right-pinned collapsed behavior', () => {
  const css = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-panel.css'), 'utf8');
  assert.match(css, /--vibration-roadmap-width/);
  assert.match(css, /data-roadmap-resize|vibration-roadmap-resize/);
  assert.match(css, /cursor:(?:col-resize|ew-resize)/);
  assert.match(css, /is-collapsed[^}]*justify-self:end/);
});
