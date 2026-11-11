// LFJ R02/U01 independently authored RED before pure owner resolver implementation.
// This is NOT a direct Resolver/Preview/Weight rewrite or whole-JSON index.
// Original legacy scope scanner misassigns /Z-CHILD to ancestor BRANCH (Git blob
// a29ed52cb907d91a6009c158d718c9800a0c8f44); expected parent owner is null.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceOwners} from './source-ownership.mjs';
const original=[
  {sourceId:'P1',occurrenceId:'P1:$[0]',parentOccurrenceId:null,
    type:'BRANCH',name:'/B1',attributes:{OWNER:'/STRUCTURE'}},
  {sourceId:'P1',occurrenceId:'P1:$[0].children[0]',parentOccurrenceId:'P1:$[0]',
    type:'VALVE',name:'/V1',attributes:{OWNER_ZONE:'/Z-CHILD'}},
];
const as=(rows,id)=>rows.find(x=>x.occurrenceId===id);
test('U01 RED: parent without local Site/Zone never adopts a descendant OWNER_ZONE',()=>{
  const untouched=structuredClone(original),rows=resolveSourceOwners(original);
  assert.equal(rows.length,2);
  assert.equal(as(rows,'P1:$[0]').ownerSite,null);
  assert.equal(as(rows,'P1:$[0]').ownerZone,null,
    'legacy regex incorrectly chooses descendant /Z-CHILD as parent scope');
  assert.equal(as(rows,'P1:$[0]').branchOwner,'/STRUCTURE',
    'BRANCH OWNER is not automatically a Site or Zone identifier');
  assert.equal(as(rows,'P1:$[0].children[0]').ownerZone,'/Z-CHILD');
  assert.deepEqual(original,untouched,'R02 never mutates actual source occurrence facts');
});

test('U01 two identical-name BRANCH parents have independent descendant scopes',()=>{
  const rows=[
    {sourceId:'P1',occurrenceId:'P1:$[0]',parentOccurrenceId:null,
      type:'BRANCH',name:'/SAME',attributes:{OWNER_ZONE:'/ZONE-A'}},
    {sourceId:'P1',occurrenceId:'P1:$[1]',parentOccurrenceId:null,
      type:'BRANCH',name:'/SAME',attributes:{OWNER_ZONE:'/ZONE-B'}},
    {sourceId:'P1',occurrenceId:'P1:$[0].children[0]',parentOccurrenceId:'P1:$[0]',
      type:'VALVE',name:'C',attributes:{}},
    {sourceId:'P1',occurrenceId:'P1:$[1].children[0]',parentOccurrenceId:'P1:$[1]',
      type:'VALVE',name:'C',attributes:{}},
  ];
  const result=resolveSourceOwners(rows);
  assert.equal(as(result,'P1:$[0].children[0]').ownerZone,'/ZONE-A');
  assert.equal(as(result,'P1:$[1].children[0]').ownerZone,'/ZONE-B');
  assert.notEqual(result[2].occurrenceId,result[3].occurrenceId);
});

test('U01 explicit child local owner differs from parent without contaminating parent',()=>{
  const a=[
    {sourceId:'P6',occurrenceId:'P6:$[0]',parentOccurrenceId:null,
      type:'ZONE',name:'/PARENT-ZONE',attributes:{}},
    {sourceId:'P6',occurrenceId:'P6:$[0].children[0]',parentOccurrenceId:'P6:$[0]',
      type:'BRANCH',name:'/B1',attributes:{OWNER_ZONE:'/CHILD-ZONE'}},
  ];
  const result=resolveSourceOwners(a);
  assert.equal(as(result,'P6:$[0]').ownerZone,'/PARENT-ZONE');
  assert.equal(as(result,'P6:$[0].children[0]').ownerZone,'/CHILD-ZONE');
});
