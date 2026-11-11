import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildAivCanvasProjectionCoverage } from '../tabs/vibration-aiv-canvas-projection-coverage.js';
import {
  renderAivCanvasInventoryEvidenceHtml,
  renderAivCanvasProjectionCoverageHtml,
} from '../tabs/vibration-aiv-canvas-evidence-view.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function table(header, rows) { return { header, rows }; }

test('projection coverage reports incomplete engineering identities without creating placeholders', () => {
  const coverage = buildAivCanvasProjectionCoverage({
    tables: {
      sources: table(['Source Canonical ID', 'Operating Case'], [['RV-1', 'CASE-A'], ['', 'CASE-A']]),
      assessments: table(['Assessment Canonical ID'], [['WO-1'], ['']]),
      relationships: table(
        ['Source Canonical ID', 'Assessment Canonical ID', 'Operating Case'],
        [['RV-1', 'WO-1', 'CASE-A'], ['RV-1', '', 'CASE-A']],
      ),
    },
  });
  assert.equal(coverage.omittedTotal, 3);
  assert.deepEqual(coverage.omittedRows, { sources: 1, assessments: 1, relationships: 1 });
  assert.deepEqual(coverage.omittedRowIndices.sources, [1]);
  assert.equal(coverage.placeholderEngineeringNodesCreated, false);
  assert.match(renderAivCanvasProjectionCoverageHtml({ projectionCoverage: coverage }), /Canvas does not represent 3 incomplete engineering row/u);
});

test('canvas inventory evidence distinguishes current verification from attestation custody and never promotes authority', () => {
  const current = {
    inputRevision: 4,
    screeningState: { token: 1, inputRevision: 4 },
    destroyed: false,
    screeningResult: { evidence: { domainResult: { lineCaseAssessmentInventoryCompleteness: 'VERIFIED_COMPLETE' } } },
    inventoryCompletenessAttestations: [
      { engineeringInputRevision: 4 },
      { engineeringInputRevision: 3 },
    ],
  };
  const html = renderAivCanvasInventoryEvidenceHtml(current);
  assert.match(html, /VERIFIED_COMPLETE/u);
  assert.match(html, /Current-revision attestations: 1/u);
  assert.match(html, /line\/case screening authority remains NOT_AUTHORIZED/u);
  const stale = { ...current, inputRevision: 5 };
  assert.match(renderAivCanvasInventoryEvidenceHtml(stale), /NOT_CURRENT · RUN SCREENING/u);
});

test('detailed inspector and canvas export are source-pinned to current lineage checks', async () => {
  const [inspector, exportController, packageState, view, projection] = await Promise.all([
    read('tabs/vibration-aiv-unified-canvas-inspector.js'),
    read('tabs/vibration-aiv-canvas-export-controller.js'),
    read('tabs/vibration-aiv-screening-package-state.js'),
    read('tabs/vibration-aiv-unified-canvas-view.js'),
    read('tabs/vibration-aiv-unified-canvas-projection.js'),
  ]);
  assert.equal(inspector.includes("isAivLineageCurrent(state, 'screening')"), true);
  assert.equal(inspector.includes('data-aiv-canvas-stale-detail="true"'), true);
  assert.equal(inspector.includes('STALE · RERUN SCREENING'), true);
  assert.equal(exportController.includes('isAivCurrentScreeningPackageState'), true);
  assert.equal(packageState.includes("isAivLineageCurrent(state, 'screening')"), true);
  assert.equal(view.includes('renderAivCanvasProjectionCoverageHtml(value)'), true);
  assert.equal(view.includes('renderAivCanvasInventoryEvidenceHtml(state)'), true);
  assert.equal(projection.includes('projectionCoverage: buildAivCanvasProjectionCoverage(input)'), true);
});

test('canvas evidence hardening preserves presentation-only and no-design-authority boundaries', async () => {
  const [projection, exportWrapper, coverage] = await Promise.all([
    read('tabs/vibration-aiv-unified-canvas-projection.js'),
    read('converters/vibration/aiv/aiv-canvas-export.js'),
    read('tabs/vibration-aiv-canvas-projection-coverage.js'),
  ]);
  assert.equal(projection.includes('presentationOnly: true'), true);
  assert.equal(projection.includes('svgPixelsAuthoritativeForDistance: false'), true);
  assert.equal(projection.includes('designAuthority: false'), true);
  assert.equal(exportWrapper.includes("engineeringAuthoritySource: 'engineeringScreeningPackage'"), true);
  assert.equal(coverage.includes('placeholderEngineeringNodesCreated: false'), true);
  for (const source of [projection, exportWrapper, coverage]) {
    assert.equal(source.includes('Math.log10('), false);
    assert.equal(source.includes('designAuthority: true'), false);
  }
});
