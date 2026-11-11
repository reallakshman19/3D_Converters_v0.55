import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  advanceDependencyRevisionState,
  dependencyRevisionSnapshot,
  initializeDependencyRevisionState,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-dependency-revisions.js';

const TARGETS = [
  'xml-cii-adapted-config.js',
  'xml-cii-adapted-weight-match-v2.js',
  'xml-cii-adapted-bend-radius-toggle.js',
  'xml-cii-adapted-support-type-mapper.js',
];

async function targetSource(name) {
  return readFile(new URL(`../tabs/xml-cii-2019-standalone/ui-adapted/${name}`, import.meta.url), 'utf8');
}

function context(config = {}) {
  return {
    lineRows: [],
    pipingClassRows: [],
    materialMapRows: [],
    weightMasterRows: [],
    appliedMappingRevision: { lineList: 0, pipingClass: 0, materialMap: 0, weight: 0 },
    config,
  };
}

function initialized(config = {}) {
  const state = {
    sourceText: '',
    supportConfigJson: JSON.stringify(config),
    masterContext: context(config),
  };
  return { ...state, ...initializeDependencyRevisionState(state, config) };
}

function advance(previous, config) {
  const next = {
    ...previous,
    supportConfigJson: JSON.stringify(config),
    masterContext: { ...previous.masterContext, config },
  };
  return { ...next, ...advanceDependencyRevisionState(previous, next, config) };
}

test('all active C4b config-save modules route supportConfigJson through updateWorkflowState', async () => {
  for (const name of TARGETS) {
    const source = await targetSource(name);
    assert.match(source, /updateWorkflowState/, `${name} must import/use updateWorkflowState`);
    assert.match(
      source,
      /stateRef\.current\s*=\s*updateWorkflowState\(/,
      `${name} must commit state through updateWorkflowState`,
    );
    assert.doesNotMatch(
      source,
      /stateRef\.current\s*=\s*\{[\s\S]{0,240}?supportConfigJson\s*:/,
      `${name} must not directly spread-assign supportConfigJson`,
    );
  }
});

test('general config save advances support revision once and leaves branch revision fixed', () => {
  const previous = initialized({ linelist: { branchLineKeyMap: {} } });
  const next = advance(previous, {
    linelist: { branchLineKeyMap: {} },
    supportPositionMatch: { toleranceMm: 20 },
  });
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision + 1);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision);
});

test('semantic no-op config save does not advance dependency revisions', () => {
  const config = {
    linelist: { branchLineKeyMap: { B1: 'L-100' } },
    supportPositionMatch: { toleranceMm: 20 },
  };
  const previous = initialized(config);
  const reordered = {
    supportPositionMatch: { toleranceMm: 20 },
    linelist: { branchLineKeyMap: { B1: 'L-100' } },
  };
  const next = advance(previous, reordered);
  assert.deepEqual(dependencyRevisionSnapshot(next), dependencyRevisionSnapshot(previous));
});

test('Branch-to-Line map remains independently revisioned', () => {
  const previous = initialized({
    linelist: { branchLineKeyMap: {} },
    supportPositionMatch: { toleranceMm: 20 },
  });
  const next = advance(previous, {
    linelist: { branchLineKeyMap: { B1: 'L-100' } },
    supportPositionMatch: { toleranceMm: 20 },
  });
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision + 1);
});

test('master-row-only config changes remain excluded from general support revision', () => {
  const previous = initialized({
    linelist: { branchLineKeyMap: {}, masterRows: [{ line: 'L-100' }], fieldMap: { lineKey: 'LINE' } },
    weight: { masterRows: [{ key: 'V1', weight: 10 }], fieldMap: { weight: 'WT' } },
  });
  const next = advance(previous, {
    linelist: { branchLineKeyMap: {}, masterRows: [{ line: 'L-200' }], fieldMap: { lineKey: 'LINE_NO' } },
    weight: { masterRows: [{ key: 'V2', weight: 20 }], fieldMap: { weight: 'WEIGHT' } },
  });
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision);
});
