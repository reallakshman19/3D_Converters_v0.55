import assert from 'node:assert/strict';
import test from 'node:test';

import { syncMasterDraftDom } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dom-sync.js';
import { resetXmlCiiPerfMetrics, snapshotXmlCiiPerfMetrics } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js';

function node(extra = {}) {
  return { textContent: '', dataset: {}, style: {}, disabled: false, value: '', ...extra };
}

function fakeContainer() {
  const status = node();
  const health = node();
  const apply = node();
  const discard = node();
  const writeBack = node();
  const lineKey = node({ dataset: { masterKey: 'lineList', masterFieldMap: 'lineKey' }, value: 'OLD' });

  return {
    nodes: { status, health, apply, discard, writeBack, lineKey },
    querySelector(selector) {
      if (selector === '[data-master-mapping-status="lineList"]') return status;
      if (selector === '[data-master-mapping-health="lineList"]') return health;
      if (selector === '[data-action="apply-master-mapping"][data-master-key="lineList"]') return apply;
      if (selector === '[data-action="discard-master-mapping"][data-master-key="lineList"]') return discard;
      if (selector === '.xml-cii-master-actions .xml-cii-phase-help') return writeBack;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-master-key="lineList"][data-master-field-map]') return [lineKey];
      return [];
    },
  };
}

test('draft-only sync updates mapping UI without touching applied authority', () => {
  const previousPerf = globalThis.__XML_CII_PERF__;
  globalThis.__XML_CII_PERF__ = true;
  resetXmlCiiPerfMetrics();
  try {
    const config = { linelist: { fieldMap: { lineKey: 'OLD' } } };
    const state = {
      importMastersWriteBackStatus: 'Draft staged. Applied calculation basis is unchanged.',
      masterContext: {
        config,
        lineRows: [{ lineKey: 'L-100' }],
        appliedMappingRevision: { lineList: 6 },
        mappingDrafts: {
          lineList: {
            fieldMap: { lineKey: 'NEW' },
            dirty: true,
            basisAppliedRevision: 6,
          },
        },
      },
    };
    const container = fakeContainer();
    const result = syncMasterDraftDom(container, state, config, 'lineList');

    assert.equal(result.updated, true);
    assert.equal(result.dirty, true);
    assert.equal(result.revision, 6);
    assert.deepEqual(result.fieldMap, { lineKey: 'NEW' });
    assert.equal(container.nodes.lineKey.value, 'NEW');
    assert.equal(container.nodes.apply.disabled, false);
    assert.equal(container.nodes.discard.disabled, false);
    assert.match(container.nodes.status.textContent, /MODIFIED — NOT APPLIED/);
    assert.match(container.nodes.status.textContent, /revision 6/);
    assert.match(container.nodes.writeBack.textContent, /basis is unchanged/);
    assert.deepEqual(config.linelist.fieldMap, { lineKey: 'OLD' });
    assert.equal(state.masterContext.appliedMappingRevision.lineList, 6);
    assert.equal(snapshotXmlCiiPerfMetrics().masterPartialDomUpdateCount, 1);
    assert.equal(snapshotXmlCiiPerfMetrics().workspaceFullRenderCount, 0);
  } finally {
    resetXmlCiiPerfMetrics();
    if (previousPerf === undefined) delete globalThis.__XML_CII_PERF__;
    else globalThis.__XML_CII_PERF__ = previousPerf;
  }
});
