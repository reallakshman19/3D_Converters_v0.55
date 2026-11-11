import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {installWeightBasisXmlDom} from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import {prepareXml229PrefinalRestraints} from '../tabs/xml-cii-2019-standalone/integration/xml229-prefinal-restraints.mjs';

installWeightBasisXmlDom(globalThis);

const root = '/DESCRIPTION-3"-C411';
const node = (id, type, x, extra = '') => `<Node><NodeNumber>${id}</NodeNumber><NodeName>PS${id}/DATUM</NodeName><ComponentType>${type}</ComponentType><Position>${x} 0 0</Position><OutsideDiameter>60.3</OutsideDiameter><WallThickness>3.2</WallThickness>${extra}</Node>`;
const explicit = '<Restraint source="original"><Type>+Y</Type><Stiffness>98765</Stiffness><Gap>2</Gap><Friction>0.3</Friction></Restraint>';
const XML = `<PipeStressExport><Pipe><Branch><Branchname>${root}/B1</Branchname>${node(10, 'PIPE', 0)}${node(20, 'PIPE', 100, explicit)}${node(40, 'ATTA', 200)}${node(50, 'ATTA', 300)}${node(60, 'PIPE', 400)}</Branch></Pipe></PipeStressExport>`;
const source = () => [{type: 'BRANCH', name: root, children: [
  {type: 'DTXR_POS', attributes: {POSI: '200 0 0'}, children: [
    {type: 'SUPPORT', attributes: {DTXR: 'GUIDE', CMPSUPGAP: '5.5', NAME: '/PS40/DATUM'}},
  ]},
  {type: 'DTXR_POS', attributes: {POSI: '300 0 0'}, children: [
    {type: 'SUPPORT', attributes: {DTXR: 'LINE STOP', CMPSUPGAP: '0', NAME: '/PS50/DATUM'}},
  ]},
]}];
const config = {defaultGap: 7, defaultFriction: 0.3, defaultStiffness: 123456,
  useJsonTraceStagedSource: false,
  dtxrPositionOffset: {enabled: true, xOffset: 0, yOffset: 0, zOffset: 0}};
const field = (node, tag) => node.getElementsByTagName(tag)[0]?.textContent ?? '';
const restraints = (document, id) => {
  const n = [...document.getElementsByTagName('Node')].find(n => field(n, 'NodeNumber') === String(id));
  return [...n.getElementsByTagName('Restraint')].map(r => ({
    type: field(r, 'Type'), gap: Number(field(r, 'Gap')),
    stiffness: Number(field(r, 'Stiffness')),
  }));
};
const prepare = (staged = source()) => prepareXml229PrefinalRestraints({
  xmlText: XML, stagedJsonText: JSON.stringify(staged), config: structuredClone(config),
});
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const script = fileURLToPath(new URL('../converters/scripts/xml_to_cii2019.py', import.meta.url));
const scriptsDir = fileURLToPath(new URL('../converters/scripts/', import.meta.url));

test('description-only GUIDE/LINESTOP retain explicit gap through pre-Final XML and actual CII', async () => {
  const staged = source();
  const prepared = await prepare(staged);
  assert.deepEqual(restraints(prepared.document, 20), [{type: '+Y', gap: 2, stiffness: 98765}]);
  assert.deepEqual(restraints(prepared.document, 40), [{type: 'GUI', gap: 5.5, stiffness: 123456}]);
  assert.deepEqual(restraints(prepared.document, 50), [{type: 'LIM', gap: 0, stiffness: 123456}]);

  const dir = await mkdtemp(join(tmpdir(), 'xml229-description-gap-'));
  try {
    const xmlFile = join(dir, 'enriched.xml');
    const ciiFile = join(dir, 'output.cii');
    const jsonFile = join(dir, 'staged.json');
    await Promise.all([
      writeFile(xmlFile, new XMLSerializer().serializeToString(prepared.document)),
      writeFile(jsonFile, JSON.stringify(staged)),
    ]);
    const verifyNativeSource = [
      'import json,sys',
      'sys.path.insert(0,sys.argv[1])',
      'from xml229_prefinal_restraint_source import source_entries',
      'from xml229_prefinal_restraints import kinds',
      'def require(ok, code):',
      '  if not ok: raise ValueError(code)',
      'entries=source_entries(json.load(open(sys.argv[2])), {}, "")',
      'actual=kinds(entries,require)',
      'assert actual["GUIDE"]["CMPSUPGAP"] == "5.5", actual',
      'assert actual["LINESTOP"]["CMPSUPGAP"] == "0", actual',
    ].join('\n');
    execFileSync(python, ['-c', verifyNativeSource, scriptsDir, jsonFile], {encoding: 'utf8'});
    execFileSync(python, [script, '--input', xmlFile, '--output', ciiFile], {encoding: 'utf8'});
    const cii = await readFile(ciiFile, 'utf8');
    const section = cii.split('#$ RESTRANT\n')[1]?.split('#$')[0];
    assert.ok(section, 'RESTRANT section missing from emitted CII');
    const lines = section.trim().split('\n');
    const records = new Map();
    for (let i = 0; i < lines.length; i += 4) {
      const row = lines[i].trim().split(/\s+/).map(Number);
      if (row[0]) records.set(row[0], row);
    }
    for (const [id, kind, gap] of [[20, 14, 2], [40, 8, 5.5], [50, 9, 0]]) {
      assert.equal(records.get(id)?.[1], kind, `native type at node ${id}`);
      assert.equal(records.get(id)?.[3], gap, `native gap at node ${id}`);
    }
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('authored CMPSUPGAP survives a legacy NODEGAP zero placeholder, but rejects real conflicting aliases', async () => {
  const staged = source();
  staged[0].children[0].children[0].attributes.NODEGAP = '0';
  let result = await prepare(staged);
  assert.deepEqual(restraints(result.document, 40), [{type: 'GUI', gap: 5.5, stiffness: 123456}]);
  staged[0].children[0].children[0].attributes.NODEGAP = '2';
  await assert.rejects(prepare(staged), {code: 'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
});

test('real 1885 REST datum wins over co-located shoe hardware gap, without losing GUIDE', async () => {
  const staged = source();
  staged[0].children[0].children.unshift(
    {type:'SUPPORT', attributes:{
      DTXR:'Pipe Rest XRT01', MDSSUPPTYPE:'PIPE-REST', NODEGAP:'0',
      NAME:'/PS-12171/DATUM', SUPPORT_KIND:'REST'}},
    {type:'SUPPORT', attributes:{
      DTXR:'PIPE SHOE FOR HORIZ LINES', MDSSUPPTYPE:'AT01', NODETYPE:'4',
      CMPSUPGAP:'10mm GAP', NODEGAP:'0', NAME:'/PS-12171.3', SUPPORT_KIND:'REST'}},
  );
  const prepared = await prepare(staged);
  const actual = restraints(prepared.document, 40);
  assert.ok(actual.some(r => r.gap === 0 && r.type === '+Y'),
    'REST datum gap zero must remain authoritative');
  assert.ok(actual.some(r => r.gap === 5.5 && r.type === 'GUI'),
    'independently sourced GUIDE must remain intact');
  assert.ok(!actual.some(r => r.gap === 10),
    'auxiliary shoe clearance must not become a REST gap');
});

test('conflicting description-only GUIDE gaps reject instead of silently selecting one', async () => {
  const staged = source();
  staged[0].children[0].children.push({
    type: 'SUPPORT', attributes: {DTXR: 'GUIDE', CMPSUPGAP: '9', NAME: '/PS40/DATUM'},
  });
  await assert.rejects(prepare(staged), {code: 'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
});

test('unrelated unclassified descriptor does not create a GUIDE or LINESTOP', async () => {
  const staged = source();
  staged[0].children[0].children[0].attributes.DTXR = 'UNCLASSIFIED SUPPORT';
  const result = await prepare(staged);
  assert.deepEqual(restraints(result.document, 40).map(row => row.type), ['+Y']);
});


test('old confidence: high LINE STOP meaning beats low GT code without inventing GUIDE', async () => {
  const staged = source();
  const attrs = staged[0].children[0].children[0].attributes;
  attrs.DTXR = 'LINE STOP ON BARE PIPE WITH WEAR PAD';
  attrs.MDSSUPPTYPE = 'GT575';
  attrs.SUPPORT_KIND = 'REST'; // stale lower-specificity mapper output
  attrs.SUPPORT_MAPPER_KIND = 'REST';
  attrs.CMPSUPGAP = '10';
  const result = await prepare(staged);
  assert.deepEqual(restraints(result.document, 40).map(({type, gap}) => [type, gap]), [['LIM', 10]]);
});

test('actual BM2 GT571/ST572 canonical REST evidence outranks abbreviated source code', async () => {
  const staged = source();
  for (const [entry, code] of [[staged[0].children[0].children[0], 'GT571'],
                               [staged[0].children[1].children[0], 'ST572']]) {
    entry.attributes = {
      NAME: '/PS40/DATUM', DTXR: '', MDSSUPPTYPE: code, SUPPORT_KIND: 'REST',
      SUPPORT_TYPE: 'REST', SUPPORT_MAPPER_KIND: 'REST', NODETYPE: '14', NODEGAP: '0',
    };
  }
  staged[0].children[1].children[0].attributes.NAME = '/PS50/DATUM';
  const result = await prepare(staged);
  assert.deepEqual(restraints(result.document, 40).map(r => r.type), ['+Y']);
  assert.deepEqual(restraints(result.document, 50).map(r => r.type), ['+Y']);
  assert.deepEqual(restraints(result.document, 40).map(r => r.gap), [0]);
  assert.deepEqual(restraints(result.document, 50).map(r => r.gap), [0]);
});

test('unambiguous NODEGAP zero does not get replaced by profile gap for GUIDE/LIM', async () => {
  const staged = source();
  for (const child of [staged[0].children[0].children[0], staged[0].children[1].children[0]]) {
    delete child.attributes.CMPSUPGAP;
    child.attributes.NODEGAP = '0';
  }
  const result = await prepare(staged);
  assert.deepEqual(restraints(result.document, 40).map(r => r.gap), [0]);
  assert.deepEqual(restraints(result.document, 50).map(r => r.gap), [0]);
});

test('two nonzero conflicting NODEGAP and CMPSUPGAP refuse a fabricated source gap', async () => {
  const staged = source();
  staged[0].children[0].children[0].attributes.NODEGAP = '2';
  await assert.rejects(prepare(staged), {code: 'PREFINAL_RESTRAINT_GAP_AMBIGUOUS'});
});


// Tab 7 / Tab 8 edits are runtime configuration, not changes to converter code.
const configDriven = (staged, edits = {}) => prepareXml229PrefinalRestraints({
  xmlText:XML,stagedJsonText:JSON.stringify(staged),
  config:{...structuredClone(config),...edits},
});

test('new Tab 7 REST keyword is honored at the same original node', async () => {
  const staged=source();
  staged[0].children[0].children[0].attributes.DTXR='CRADLE RETAINER STYLE-314';
  staged[0].children[0].children[0].attributes.NODETYPE='17';
  const baseline=await configDriven(staged);
  assert.equal(restraints(baseline.document,40).find(r=>r.type==='+Y')?.gap,7,
    'before Tab 7 edit only the ordinary ATTA default-gap REST is available');
  const mapper={rows:[
    {kind:'REST',aliases:['Cradle Retainer'],ciiKind:'REST_STYLE_CII_SUPPORT'},
    {kind:'GUIDE',aliases:['Guide'],ciiKind:'GUIDE_STYLE_CII_SUPPORT'},
    {kind:'LINESTOP',aliases:['Line Stop'],ciiKind:'LINESTOP_STYLE_CII_SUPPORT'},
    {kind:'ANCHOR',aliases:['Anchor'],ciiKind:'ANCHOR_STYLE_CII_SUPPORT'},
  ]};
  const altered=await configDriven(staged,{supportTypeMapper:mapper});
  assert.ok(restraints(altered.document,40).some(r=>r.type==='+Y'&&r.gap===5.5),
    'saved Tab 7 alias must transfer the actual 5.5mm source gap, not the fallback REST');
});

test('new Tab 8 smart regex plus TYPE mutation changes output without changing source', async () => {
  const staged=source();
  const a=staged[0].children[0].children[0].attributes;
  a.DTXR='ORBITAL GUARDRAIL QZ-443';
  a.NODETYPE='21';
  const configEdits={
    supportMapping:{version:2,rules:[{
      id:'user-orbital-guide',enabled:true,priority:2,source:'staged-json',
      field:'DTXR',pattern:'ORBITAL\\s+GUARDRAIL\\s+QZ-443',match:'regex',kind:'GUIDE',
    }]},
    inputXmlRestraintTypeMutation:{enabled:true,rows:[{label:'GUI custom',from:'21',to:'8'}]},
  };
  const updated=await configDriven(staged,configEdits);
  assert.ok(restraints(updated.document,40).some(r=>r.type==='GUI'&&r.gap===5.5));
  const invalid=await configDriven(staged,{
    ...configEdits,
    inputXmlRestraintTypeMutation:{enabled:true,rows:[{from:'21',to:'9'}]},
  }).then(()=>null,e=>e);
  assert.equal(invalid?.code,'PREFINAL_RESTRAINT_TYPE_KIND_CONFLICT',
    'misconfigured numeric mutation must fail rather than create a LINESTOP');
});

test('conflicting Tab 8 smart rules and explicit source semantics fail closed', async () => {
  const staged=source();
  const pair=[
    {id:'user-guide',enabled:true,priority:1,source:'all',
      field:'DTXR',pattern:'GUIDE',match:'equals',kind:'GUIDE'},
    {id:'user-rest',enabled:true,priority:1,source:'all',
      field:'DTXR',pattern:'GUIDE',match:'equals',kind:'REST'},
  ];
  await assert.rejects(configDriven(staged,{
    supportMapping:{version:2,rules:pair},
  }),{code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
  await assert.rejects(configDriven(staged,{
    supportMapping:{version:2,rules:[pair[1]]},
  }),{code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
  await assert.rejects(configDriven(staged,{
    supportMapping:{version:2,rules:[{...pair[0],pattern:'[' ,match:'regex'}]},
  }),{code:'PREFINAL_RESTRAINT_CONFIG_INVALID'});
});

test('new Tab 7 keyword cannot silently override explicit GUIDE to REST', async () => {
  const staged=source();
  const a=staged[0].children[0].children[0].attributes;
  a.DTXR='GUIDE CRADLE RETAINER';
  await assert.rejects(configDriven(staged,{
    supportTypeMapper:{rows:[
      {kind:'REST',aliases:['CRADLE RETAINER']},
      {kind:'GUIDE',aliases:['GUIDE']},
    ]},
  }),{code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
});

test('two edited tabs cannot silently disagree on the same source occurrence', async () => {
  const staged=source();
  staged[0].children[0].children[0].attributes.DTXR='ORBITAL GUARDRAIL';
  await assert.rejects(configDriven(staged,{
    supportTypeMapper:{rows:[
      {kind:'REST',aliases:['ORBITAL GUARDRAIL']},
      {kind:'GUIDE',aliases:['GUIDE']},
    ]},
    supportMapping:{version:2,rules:[{
      id:'user-orbital-guide',source:'staged-json',enabled:true,priority:2,
      field:'DTXR',pattern:'ORBITAL GUARDRAIL',match:'equals',kind:'GUIDE',
    }]},
  }),{code:'PREFINAL_RESTRAINT_KIND_AMBIGUOUS'});
});
