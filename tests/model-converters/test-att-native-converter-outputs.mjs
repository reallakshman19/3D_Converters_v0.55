import assert from 'node:assert/strict';
import { run } from '../../tabs/model-converters/converters/rvmattr-to-xml.js';

function block(type, name, owner, attrs = {}) {
  return ['NEW '+name,'NAME:= '+name,'TYPE:= '+type,'OWNER:= '+owner,
    ...Object.entries(attrs).map(([k,v])=>k+':= '+v),'END'].join('\n');
}
const site = block('SITE','/SITE','/*');
const z1 = block('ZONE','/SITE/Z1','/SITE');
const z2 = block('ZONE','/SITE/Z2','/SITE');
const p1 = block('PIPE','/SITE/Z1/P1','/SITE/Z1');
const p2 = block('PIPE','/SITE/Z2/P2','/SITE/Z2');
const b1 = block('BRAN','/SITE/Z1/P1/B1','/SITE/Z1/P1',
  {HBOR:'100mm',TBOR:'100mm',HPOS:'0 0 0',TPOS:'100 0 0'});
const b2 = block('BRAN','/SITE/Z2/P2/B2','/SITE/Z2/P2',
  {HBOR:'100mm',TBOR:'100mm',HPOS:'500 0 0',TPOS:'600 0 0'});
const v1 = block('VALV','/SITE/Z1/P1/B1/V1','/SITE/Z1/P1/B1',
  {APOS:'0 0 0',LPOS:'100 0 0',ABORE:'100mm'});
const v2 = block('VALV','/SITE/Z2/P2/B2/V2','/SITE/Z2/P2/B2',
  {APOS:'500 0 0',LPOS:'600 0 0',ABORE:'100mm'});
const m1 = block('SUBE','/SITE/Z1/MEMBER_A','/SITE/Z1',
  {APOS:'0 0 0',LPOS:'70 0 0'});
const m2 = block('SUBE','/SITE/Z2/MEMBER_B','/SITE/Z2',
  {APOS:'500 0 0',LPOS:'570 0 0'});
const att=[site,z1,z2,p1,p2,b1,b2,v1,v2,m1,m2].join('\n');
const selected=await run({
  converterId:'rvmattr_to_xml',
  inputFiles:[{role:'secondary',name:'selected.att',text:att}],
  options:{
    rvmScope:{
      wildcard:'',selectedIds:['branch:/SITE/Z1/P1/B1'],
      nativeScope:{mode:'SELECTED',rules:[['/SITE/Z1',true]],
        selectedNativeCount:5,selectedPipingBranches:1},
    },
  },
});
assert.ok(selected.ok, 'converter must accept ATT-only selected scope');
const xml=selected.outputs.find(x=>x.name.endsWith('.xml'))?.text||'';
const json=selected.outputs.find(x=>x.name.endsWith('.json'))?.text||'';
const step=selected.outputs.find(x=>x.name.endsWith('.stp'))?.text||'';
assert.ok(xml.includes('/SITE/Z1/P1/B1'),'Selected branch must be present in XML');
assert.ok(!xml.includes('/SITE/Z2/P2/B2'),'Unselected branch leaked into XML');
const hierarchy=JSON.parse(json);
assert.deepEqual(hierarchy.map(x=>x.name),['/SITE/Z1/P1/B1']);
assert.ok(step.includes('MEMBER_A'),'Selected structural member absent');
assert.ok(!step.includes('MEMBER_B'),'Unselected zone member leaked into STEP');
const full=await run({
  converterId:'rvmattr_to_xml',
  inputFiles:[{role:'secondary',name:'full.att',text:att}],
  options:{rvmScope:{wildcard:'',selectedIds:[],nativeScope:{mode:'FULL'}}},
});
const all=JSON.parse(full.outputs.find(x=>x.name.endsWith('.json')).text);
assert.equal(all.length,2,'Full-file control must include both branches');
console.log('test-att-native-converter-outputs: PASS selected XML/JSON/STP no sibling zone leakage');
