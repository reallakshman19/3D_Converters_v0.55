// R02/U02 independently authored source inheritance truth table.
// No full source parse and no mutation of original staged descendants.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceOwners} from './source-ownership.mjs';
const row=(id,parent,type,name,attrs={},sourceId='P1')=>({
  sourceId,occurrenceId:id,parentOccurrenceId:parent,type,name,attributes:attrs,
});
const at=(rows,id)=>rows.find(r=>r.occurrenceId===id);

test('U02 SITE > ZONE > BRANCH > component inherits only nearest declared original owner',()=>{
  const original=[
    row('V','B','VALVE','/V',{}),
    row('B','Z','BRANCH','/B',{OWNER:'/BRANCH_OWNER'}),
    row('S',null,'SITE','/SITE-A',{}),
    row('Z','S','ZONE','/ZONE-1',{}),
  ];
  const result=resolveSourceOwners(original);
  const valve=at(result,'V');
  assert.equal(valve.ownerSite,'/SITE-A');
  assert.equal(valve.ownerSiteSource,'S');
  assert.equal(valve.ownerZone,'/ZONE-1');
  assert.equal(valve.ownerZoneSource,'Z');
  assert.equal(valve.branchOwner,'/BRANCH_OWNER');
  assert.equal(valve.branchOwnerSource,'B');
  assert.equal(valve.engineeringReady,false);
  assert.deepEqual(result.map(r=>r.occurrenceId),original.map(r=>r.occurrenceId),
    'original row order is not rewritten or sorted by owner/name');
});

test('U02 own owner overrides inherited only for local node and its descendants',()=>{
  const result=resolveSourceOwners([
    row('site',null,'SITE','/SITE-A',{}),
    row('zone','site','ZONE','/ZONE-A',{}),
    row('branch','zone','BRANCH','/B',{OWNER_ZONE:'/ZONE-B'}),
    row('valve','branch','VALVE','/V',{}),
    row('peer','zone','VALVE','/P',{}),
  ]);
  assert.equal(at(result,'site').ownerZone,null);
  assert.equal(at(result,'zone').ownerZone,'/ZONE-A');
  assert.equal(at(result,'branch').ownerZone,'/ZONE-B');
  assert.equal(at(result,'valve').ownerZone,'/ZONE-B');
  assert.equal(at(result,'peer').ownerZone,'/ZONE-A',
    'branch override must never change a sibling');
});

test('U02 unknown Site/Zone remains null, and other source has no inherited owner',()=>{
  const result=resolveSourceOwners([
    row('SRC1_ROOT',null,'BRANCH','/B',{OWNER:'/CONTRACT'},'SRC1'),
    row('SRC2_ROOT',null,'BRANCH','/B',{},'SRC2'),
    row('SRC1_VALVE','SRC1_ROOT','VALVE','/V',{},'SRC1'),
  ]);
  const valve=at(result,'SRC1_VALVE'),second=at(result,'SRC2_ROOT');
  assert.equal(valve.ownerSite,null);assert.equal(valve.ownerZone,null);
  assert.equal(valve.branchOwner,'/CONTRACT');
  assert.equal(second.branchOwner,null);
  assert.equal(second.ownerZone,null);
  assert.equal(result.length,3);
});
