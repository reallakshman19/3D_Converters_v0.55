// R02/U03 RED-first rights conflicts, distinguished from legitimate child override.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceOwners} from './source-ownership.mjs';
const row=(attrs,type='BRANCH',name='/B1')=>[{
  sourceId:'SRC',occurrenceId:'SRC:$[0]',parentOccurrenceId:null,
  type,name,attributes:attrs,
}];
const code=c=>e=>{assert.equal(e.code,c);return true;};

test('U03 conflicting own OWNER_ZONE and ZONE_ID never silently select a preferred alias',()=>{
  assert.throws(()=>resolveSourceOwners(row({OWNER_ZONE:'/ZONE-A',ZONE_ID:'/ZONE-B'})),
    code('OWNER_CONFLICT'));
  const ok=resolveSourceOwners(row({OWNER_ZONE:'/ZONE-A',ZONE_ID:'/ZONE-A'}));
  assert.equal(ok[0].ownerZone,'/ZONE-A');
  const onlyAlias=resolveSourceOwners(row({ZONE_ID:'/ZONE-C'}));
  assert.equal(onlyAlias[0].ownerZone,'/ZONE-C');
});

test('U03 own Site declarations and typed SITE/ZONE name conflicts fail closed',()=>{
  assert.throws(()=>resolveSourceOwners(row({OWNER_SITE:'/SITE-A',SITE:'/SITE-B'})),
    code('OWNER_CONFLICT'));
  assert.throws(()=>resolveSourceOwners(row({OWNER_ZONE:'/OTHER-ZONE'},'ZONE','/OWN-ZONE')),
    code('OWNER_CONFLICT'));
  assert.throws(()=>resolveSourceOwners(row({OWNER_SITE:'/OTHER-SITE'},'SITE','/OWN-SITE')),
    code('OWNER_CONFLICT'));
});

test('U03 same-value aliases are safe; OWNER is never interpreted as zone/site',()=>{
  const actual=resolveSourceOwners(row({
    OWNER:'/OWNER-PATH',OWNER_SITE:'/SITE-A',SITE:'/SITE-A',
    OWNER_ZONE:'/ZONE-A',ZONE_ID:'/ZONE-A',
  }))[0];
  assert.equal(actual.ownerSite,'/SITE-A');
  assert.equal(actual.ownerZone,'/ZONE-A');
  assert.equal(actual.branchOwner,'/OWNER-PATH');
});

test('U03 invalid own-field values cannot pass by inheriting a good parent field',()=>{
  const attrs=[{ZONE_ID:10},{OWNER_ZONE:''},{OWNER_SITE:false},{SITE:null}];
  for(const ownAttrs of attrs)
    assert.throws(()=>resolveSourceOwners(row(ownAttrs)),code('INVALID_OWNER_VALUE'));
});
