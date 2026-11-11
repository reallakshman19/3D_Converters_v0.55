// LFJ R02/U04 independent original occurrence identity and parent graph safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceOwners} from './source-ownership.mjs';
const row=(sourceId,id,parent,type,name,attributes={})=>({
  sourceId,occurrenceId:id,parentOccurrenceId:parent,type,name,attributes,
});
const code=c=>e=>{assert.equal(e.code,c);return true;};

test('U04 RED: same occurrence path in distinct sources is not a duplicate identity',()=>{
  const original=[
    row('SRC-A','$[0]',null,'SITE','/SITE-A',{}),
    row('SRC-B','$[0]',null,'SITE','/SITE-B',{}),
    row('SRC-A','$[0].children[0]','$[0]','VALVE','/C',{}),
    row('SRC-B','$[0].children[0]','$[0]','VALVE','/C',{}),
  ];
  const resolved=resolveSourceOwners(original);
  assert.deepEqual(resolved.map(x=>[x.sourceId,x.occurrenceId,x.ownerSite]),[
    ['SRC-A','$[0]','/SITE-A'],
    ['SRC-B','$[0]','/SITE-B'],
    ['SRC-A','$[0].children[0]','/SITE-A'],
    ['SRC-B','$[0].children[0]','/SITE-B'],
  ]);
});

test('U04 cycle/duplicate/missing or cross-source parent must reject',()=>{
  const a=row('P1','n1','n2','SITE','/S1'),b=row('P1','n2','n1','ZONE','/Z1');
  assert.throws(()=>resolveSourceOwners([a,b]),code('CYCLIC_PARENT'));
  assert.throws(()=>resolveSourceOwners([row('P1','n1',null,'ZONE','/Z1'),row('P1','n1',null,'ZONE','/Z2')]),
    code('DUPLICATE_OCCURRENCE'));
  assert.throws(()=>resolveSourceOwners([row('P1','n1','absent','ZONE','/Z1')]),
    code('MISSING_PARENT'));
  assert.throws(()=>resolveSourceOwners([row('P1','n1',null,'SITE','/S1'),
    row('P2','n2','n1','VALVE','C')]),code('CROSS_SOURCE_PARENT'));
});

test('U04 same-name sibling under distinct parent has independent lineage',()=>{
  const source=[
    row('S','zoneA',null,'ZONE','/A'),
    row('S','zoneB',null,'ZONE','/B'),
    row('S','childA','zoneA','VALVE','REPEATED'),
    row('S','childB','zoneB','VALVE','REPEATED'),
  ];
  Object.freeze(source);
  for(const r of source){Object.freeze(r.attributes);Object.freeze(r);}
  const facts=resolveSourceOwners(source);
  assert.equal(facts[2].ownerZone,'/A');
  assert.equal(facts[3].ownerZone,'/B');
  assert.equal(facts[2].ownerZoneSource,'zoneA');
  assert.equal(facts[3].ownerZoneSource,'zoneB');
  assert.equal(facts.length,4);
  assert.ok(Object.isFrozen(facts));
});
