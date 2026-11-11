import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDependencyRevisionState,
  dependencyRevisionKey,
  dependencyRevisionSnapshot,
  initializeDependencyRevisionState,
  supportConfigSignature,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-dependency-revisions.js';

function context(overrides = {}) {
  return {
    lineRows: [], pipingClassRows: [], materialMapRows: [], weightMasterRows: [],
    appliedMappingRevision: { lineList: 0, pipingClass: 0, materialMap: 0, weight: 0 },
    mappingDrafts: {}, config: { linelist: { branchLineKeyMap: {} } },
    ...overrides,
  };
}

function state(overrides = {}) {
  const base = { sourceText: '', supportConfigJson: '{"linelist":{"branchLineKeyMap":{}}}', masterContext: context() };
  const next = { ...base, ...overrides };
  return { ...next, ...initializeDependencyRevisionState(next, next.masterContext?.config || {}) };
}

test('initial revisions exclude independently versioned master and branch-map domains', () => {
  const s = state();
  assert.deepEqual(dependencyRevisionSnapshot(s), {
    sourceModelRevision: 0,
    lineListAppliedRevision: 0,
    pipingClassAppliedRevision: 0,
    materialAppliedRevision: 0,
    weightAppliedRevision: 0,
    supportConfigRevision: 0,
    branchLineMapRevision: 0,
  });
});

test('draft-only master mapping changes do not bump any dependency revision', () => {
  const previous = state();
  const next = {
    ...previous,
    masterContext: {
      ...previous.masterContext,
      mappingDrafts: { lineList: { fieldMap: { lineKey: 'LINE' }, dirty: true, basisAppliedRevision: 0 } },
    },
  };
  Object.assign(next, advanceDependencyRevisionState(previous, next, next.masterContext.config));
  assert.deepEqual(dependencyRevisionSnapshot(next), dependencyRevisionSnapshot(previous));
});

test('source edit bumps only sourceModelRevision', () => {
  const previous = state();
  const next = { ...previous, sourceText: '<ROOT />' };
  Object.assign(next, advanceDependencyRevisionState(previous, next, next.masterContext.config));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.sourceModelRevision, before.sourceModelRevision + 1);
  for (const key of Object.keys(before).filter((key) => key !== 'sourceModelRevision')) assert.equal(after[key], before[key]);
});

test('branch map change bumps only branchLineMapRevision', () => {
  const previous = state();
  const parsed = { linelist: { branchLineKeyMap: { B1: 'L-100' } } };
  const next = { ...previous, supportConfigJson: '{"linelist":{"branchLineKeyMap":{"B1":"L-100"}}}' };
  Object.assign(next, advanceDependencyRevisionState(previous, next, parsed));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision + 1);
  assert.equal(after.lineListAppliedRevision, before.lineListAppliedRevision);
  assert.equal(after.weightAppliedRevision, before.weightAppliedRevision);
});

test('unrelated support config change does not bump branchLineMapRevision', () => {
  const previous = state();
  const parsed = { linelist: { branchLineKeyMap: {} }, supportPositionMatch: { toleranceMm: 20 } };
  const next = { ...previous, supportConfigJson: JSON.stringify(parsed) };
  Object.assign(next, advanceDependencyRevisionState(previous, next, parsed));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision + 1);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision);
});

test('weight authority change bumps weight only and leaves source/line/branch dependency key unchanged', () => {
  const previous = state();
  const nextWeightRows = [{ key: 'V1', weight: 10 }];
  const next = {
    ...previous,
    masterContext: {
      ...previous.masterContext,
      weightMasterRows: nextWeightRows,
      appliedMappingRevision: { ...previous.masterContext.appliedMappingRevision, weight: 1 },
    },
  };
  Object.assign(next, advanceDependencyRevisionState(previous, next, next.masterContext.config));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.weightAppliedRevision, before.weightAppliedRevision + 1);
  assert.equal(after.lineListAppliedRevision, before.lineListAppliedRevision);
  const p1LikeKeys = ['sourceModelRevision', 'lineListAppliedRevision', 'branchLineMapRevision'];
  assert.equal(dependencyRevisionKey(next, p1LikeKeys), dependencyRevisionKey(previous, p1LikeKeys));
});


test('master rows and field maps are excluded from support-config signature', () => {
  const base = {
    linelist: { masterRows: [{ line: 'L1' }], fieldMap: { lineKey: 'LINE' }, branchLineKeyMap: { B1: 'L1' } },
    pipingClass: { masterRows: [{ class: 'P1' }], fieldMap: { class: 'CLASS' } },
    material: { mapRows: [{ material: 'CS' }], fieldMap: { material: 'MATERIAL' } },
    weight: { masterRows: [{ key: 'V1', weight: 10 }], fieldMap: { weight: 'WEIGHT' } },
    supportPositionMatch: { toleranceMm: 20 },
  };
  const changedIndependent = {
    ...base,
    linelist: { masterRows: [{ line: 'L2' }], fieldMap: { lineKey: 'NEW' }, branchLineKeyMap: { B2: 'L2' } },
    weight: { masterRows: [{ key: 'V9', weight: 90 }], fieldMap: { weight: 'NEW_WEIGHT' } },
  };
  assert.equal(supportConfigSignature(base), supportConfigSignature(changedIndependent));
  assert.notEqual(
    supportConfigSignature(base),
    supportConfigSignature({ ...base, supportPositionMatch: { toleranceMm: 25 } }),
  );
});

test('embedded Weight Master config update bumps weight revision without support-config revision', () => {
  const previousConfig = { linelist: { branchLineKeyMap: {} }, weight: { masterRows: [], fieldMap: {} } };
  const previousBase = {
    sourceText: '',
    supportConfigJson: JSON.stringify(previousConfig),
    masterContext: context({ config: previousConfig }),
  };
  const previous = { ...previousBase, ...initializeDependencyRevisionState(previousBase, previousConfig) };
  const nextWeightRows = [{ key: 'V1', weight: 10 }];
  const parsed = { ...previousConfig, weight: { masterRows: nextWeightRows, fieldMap: { weight: 'WEIGHT' } } };
  const next = {
    ...previous,
    supportConfigJson: JSON.stringify(parsed),
    masterContext: {
      ...previous.masterContext,
      config: parsed,
      weightMasterRows: nextWeightRows,
      appliedMappingRevision: { ...previous.masterContext.appliedMappingRevision, weight: 1 },
    },
  };
  Object.assign(next, advanceDependencyRevisionState(previous, next, parsed));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.weightAppliedRevision, before.weightAppliedRevision + 1);
  assert.equal(after.supportConfigRevision, before.supportConfigRevision);
  assert.equal(after.branchLineMapRevision, before.branchLineMapRevision);
});

test('line-list Apply bumps lineListAppliedRevision while unrelated master revisions stay fixed', () => {
  const previous = state();
  const next = {
    ...previous,
    masterContext: {
      ...previous.masterContext,
      lineRows: [{ lineKey: 'L-100' }],
      appliedMappingRevision: { ...previous.masterContext.appliedMappingRevision, lineList: 1 },
    },
  };
  Object.assign(next, advanceDependencyRevisionState(previous, next, next.masterContext.config));
  const before = dependencyRevisionSnapshot(previous);
  const after = dependencyRevisionSnapshot(next);
  assert.equal(after.lineListAppliedRevision, before.lineListAppliedRevision + 1);
  assert.equal(after.pipingClassAppliedRevision, before.pipingClassAppliedRevision);
  assert.equal(after.materialAppliedRevision, before.materialAppliedRevision);
  assert.equal(after.weightAppliedRevision, before.weightAppliedRevision);
});


test('Tab 7 aliases, Tab 8 smart regex and TYPE mutation each bump the native config basis', () => {
  const parsed = {linelist: {branchLineKeyMap: {}},
    supportTypeMapper: {rows: [{kind: 'REST', aliases: ['Pipe Rest']}]},
    supportMapping: {version: 2, rules: []},
    inputXmlRestraintTypeMutation: {enabled: true, rows: [{from: '21', to: '21'}]}};
  let prev = state({
    sourceText: '<PipeStressExport/>',
    masterContext: context({config: parsed}),
    supportConfigJson: JSON.stringify(parsed),
  });
  const variations = [
    current => {current.supportTypeMapper.rows[0].aliases.push('CRADLE RETAINER');},
    current => {current.supportMapping.rules.push({
      id:'user-orbital-guide',enabled:true,source:'staged-json',priority:1,
      field:'DTXR',pattern:'ORBITAL\\s+GUARDRAIL',match:'regex',kind:'GUIDE',
    });},
    current => {current.inputXmlRestraintTypeMutation.rows[0].to = '8';},
  ];
  for (const [index, edit] of variations.entries()) {
    const nextConfig=structuredClone(JSON.parse(prev.supportConfigJson));
    edit(nextConfig);
    const next={...prev,supportConfigJson:JSON.stringify(nextConfig),
      masterContext:{...prev.masterContext,config:nextConfig}};
    Object.assign(next,advanceDependencyRevisionState(prev,next,nextConfig));
    const previous=dependencyRevisionSnapshot(prev),updated=dependencyRevisionSnapshot(next);
    assert.equal(updated.supportConfigRevision,previous.supportConfigRevision+1,
      'editing Tab 7/8 must invalidate previously verified config basis: variation '+index);
    assert.equal(updated.sourceModelRevision,previous.sourceModelRevision,
      'the underlying XML source must remain identical');
    assert.equal(updated.branchLineMapRevision,previous.branchLineMapRevision);
    assert.notEqual(supportConfigSignature(JSON.parse(prev.supportConfigJson)),
      supportConfigSignature(nextConfig));
    prev=next;
  }
  console.log('XML229_CONFIG_BASIS_MUTATION ' + JSON.stringify({
    sourceUnchanged:true,changedConfigRevisions:variations.length,status:'PASS',
  }));
});
