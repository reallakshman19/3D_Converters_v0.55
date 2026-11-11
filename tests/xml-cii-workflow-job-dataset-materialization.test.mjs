import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichSupportConfigJson } from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js';
import { materializeXmlCiiDatasetBackedConfig } from '../tabs/xml-cii-2019-standalone/xml-cii-dataset-backed-config.js';

const rowsByKey = {
  lineList: [{ lineNo: 'L-101' }],
  pipingClass: [{ pipingClass: 'A1', bore: 80 }],
  materialMap: [{ material: 'CS', ciiCode: 'A106B' }],
  weight: [{ convertedBore: 80, rating: 300, weight: 9 }],
};

function datasetState() {
  return {
    supportConfigJson: JSON.stringify({
      linelist: { fieldMap: { lineNo: 'Line' } },
      pipingClass: { fieldMap: { pipingClass: 'Class' } },
      material: { fieldMap: { material: 'Material' } },
      weight: { fieldMap: { weight: 'Weight' }, masterRevision: 7, masterFingerprint: '1:fnv1a:test' },
      supportPositionMatch: { toleranceMm: 20 },
    }),
    masterContext: {
      lineRows: [], pipingClassRows: [], materialMapRows: [], weightMasterRows: [],
      datasetRefs: {
        lineList: { datasetId: 'line-ds', rowCount: 1, fieldMap: { lineNo: 'Line' } },
        pipingClass: { datasetId: 'class-ds', rowCount: 1, fieldMap: { pipingClass: 'Class' } },
        materialMap: { datasetId: 'material-ds', rowCount: 1, fieldMap: { material: 'Material' } },
        weight: { datasetId: 'weight-ds', rowCount: 1, fieldMap: { weight: 'Weight' }, masterFingerprint: '1:fnv1a:test' },
      },
      appliedMappingRevision: { lineList: 2, pipingClass: 3, materialMap: 4, weight: 7 },
    },
  };
}

const fakeMaterialize = async (masterKey, ref) => {
  assert.ok(ref.datasetId.endsWith('-ds'));
  return rowsByKey[masterKey].map((row) => ({ ...row }));
};

test('generic operation config transiently materializes every dataset-backed master', async () => {
  const state = datasetState();
  const base = JSON.parse(state.supportConfigJson);
  const config = await materializeXmlCiiDatasetBackedConfig(base, state, { materializeRows: fakeMaterialize });
  assert.deepEqual(config.linelist.masterRows, rowsByKey.lineList);
  assert.deepEqual(config.pipingClass.masterRows, rowsByKey.pipingClass);
  assert.deepEqual(config.material.mapRows, rowsByKey.materialMap);
  assert.deepEqual(config.weight.masterRows, rowsByKey.weight);
  assert.equal(config.weight.masterRevision, 7);
  assert.equal(config.weight.masterFingerprint, '1:fnv1a:test');
  assert.deepEqual(state.masterContext.weightMasterRows, []);
  assert.equal('masterRows' in JSON.parse(state.supportConfigJson).weight, false);
});

test('workflow job support config uses dataset rows when long-lived arrays are absent', async () => {
  const state = datasetState();
  const calls = [];
  const json = await enrichSupportConfigJson(state, null, {
    materializeRows: async (masterKey, ref) => {
      calls.push([masterKey, ref.datasetId]);
      return fakeMaterialize(masterKey, ref);
    },
  });
  const config = JSON.parse(json);
  assert.deepEqual(calls.map(([key]) => key).sort(), ['lineList', 'materialMap', 'pipingClass', 'weight']);
  assert.equal(config.linelist.masterRows[0].lineNo, 'L-101');
  assert.equal(config.pipingClass.masterRows[0].pipingClass, 'A1');
  assert.equal(config.material.mapRows[0].ciiCode, 'A106B');
  assert.equal(config.weight.masterRows[0].weight, 9);
  assert.equal(config.weight.masterRevision, 7);
  assert.equal(config.supportPositionMatch.toleranceMm, 20);
  assert.deepEqual(state.masterContext.lineRows, []);
  assert.deepEqual(state.masterContext.weightMasterRows, []);
});

test('dataset materialization mismatch fails closed instead of substituting legacy data', async () => {
  const state = datasetState();
  await assert.rejects(
    () => enrichSupportConfigJson(state, null, { materializeRows: async () => [] }),
    /materialization mismatch/,
  );
});


test('Tab 7 and Tab 8 saved edits survive workflow materialization with no source change', async () => {
  const sourceText = '<PipeStressExport><Pipe><Branch><Branchname>/SAME</Branchname></Branch></Pipe></PipeStressExport>';
  const stagedJsonText = '[{"type":"SUPPORT","attributes":{"DTXR":"ORBITAL GUARDRAIL"}}]';
  const makeState = (config) => ({
    sourceText, stagedJsonText, supportConfigJson: JSON.stringify(config),
    masterContext: {lineRows: [], pipingClassRows: [], materialMapRows: [], weightMasterRows: []},
  });
  const before = {
    supportTypeMapper: {rows: [{kind: 'REST', aliases: ['Pipe Rest']}]},
    supportMapping: {version: 2, rules: []},
    inputXmlRestraintTypeMutation: {enabled: true, rows: [{from: '21', to: '21'}]},
  };
  const after = structuredClone(before);
  after.supportTypeMapper.rows[0].aliases.push('CRADLE RETAINER');
  after.supportMapping.rules.push({
    id: 'user-orbital-guide', source: 'staged-json', enabled: true, priority: 1,
    field: 'DTXR', match: 'regex', pattern: 'ORBITAL\\s+GUARDRAIL', kind: 'GUIDE',
  });
  after.inputXmlRestraintTypeMutation.rows[0].to = '8';
  const first = JSON.parse(await enrichSupportConfigJson(makeState(before)));
  const second = JSON.parse(await enrichSupportConfigJson(makeState(after)));
  assert.deepEqual(first.supportMapping.rules, []);
  assert.equal(first.inputXmlRestraintTypeMutation.rows[0].to, '21');
  assert.equal(second.supportTypeMapper.rows[0].aliases.at(-1), 'CRADLE RETAINER');
  assert.equal(second.supportMapping.rules[0].kind, 'GUIDE');
  assert.equal(second.supportMapping.rules[0].pattern, after.supportMapping.rules[0].pattern);
  assert.equal(second.inputXmlRestraintTypeMutation.rows[0].to, '8');
  assert.notDeepEqual(first, second);
  console.log('XML229_SAVED_CONFIG_JOB_MUTATION ' + JSON.stringify({
    tab7: second.supportTypeMapper.rows[0].aliases.at(-1),
    tab8Regex: second.supportMapping.rules[0].pattern,
    nodeTypeMutation: second.inputXmlRestraintTypeMutation.rows[0].to,
    unchangedXmlSource: true, unchangedStagedJson: true,
    status: 'PASS',
  }));
});
