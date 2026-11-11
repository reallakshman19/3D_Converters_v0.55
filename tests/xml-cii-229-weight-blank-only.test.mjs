import assert from 'node:assert/strict';
import test from 'node:test';
import { selectXmlCiiBlankWeightSuggestion as choose } from '../converters/xml-cii2019-core/weight-blank-fill-policy.js';
const issue=()=>({key:'branch-1/RIGID/04',mapped:false,weight:null,candidates:[
  {selectedWeight:12.5,preferred:true},
  {selectedWeight:13,preferred:false},
]});
const input=(value='',accepted='false')=>({value,dataset:{wmAccepted:accepted}});
const check=(opts)=>choose({input:input(),issue:issue(),config:{},...opts});

test('true blank row selects highest-ranked positive safe suggestion',()=>{
 const selected=check();assert.equal(selected?.weight,12.5);
 assert.equal(selected?.candidate.preferred,true);
});
test('nonblank typed/manual Weight(kg) NEVER changes, including a value equal to the suggestion',()=>{
 for(const value of ['12.5','99','0','-1','1e0','  0  '])assert.equal(check({input:input(value)}),null,value);
});
test('mapped, accepted, source-valued and stale Match-1 rows never accept a bulk overwrite',()=>{
 for(const patch of [{mapped:true},{weight:7.5},{staleMatch1:{reason:'basis-changed'}}]){
  assert.equal(check({issue:{...issue(),...patch}}),null,JSON.stringify(patch));
 }
 assert.equal(check({input:input('','true')}),null);
});
test('any existing legacy, Match-1, Final or saved provenance entry protects the row, even if equal',()=>{
 for(const bucket of ['rigidWeightFinal','rigidWeightMatch1','rigidWeight','rigidWeightProposalMeta','rigidWeightMatch1Provenance']){
  for(const value of [12.5,22,{acceptanceMethod:'manual'}]){
    assert.equal(check({config:{overrides:{[bucket]:{[issue().key]:value}}}}),null,bucket+':'+String(value));
  }
 }
});
test('top invalid, rejected, zero-fallback or odd candidate is ignored, next eligible rank used',()=>{
 const possibilities=[
 {selectedWeight:0,preferred:true},{selectedWeight:4,zeroFallback:true},
 {selectedWeight:6,rejectedReason:'length out of tolerance'},
 {selectedWeight:9,oddEntry:true},
 {selectedWeight:11.7},
 {selectedWeight:15},
 ];
 assert.equal(check({issue:{...issue(),candidates:possibilities}})?.weight,11.7);
 assert.equal(check({issue:{...issue(),candidates:possibilities.slice(0,4)}}),null);
});
test('missing config, missing key or missing candidate cannot write',()=>{
 assert.equal(check({issue:{...issue(),key:''}}),null);
 assert.equal(check({issue:{...issue(),candidates:[]}}),null);
 assert.equal(check({input:null}),null);
 assert.equal(check({issue:null}),null);
});
test('blank whitespace only is allowed unless saved nonblank weight, including stale matching value',()=>{
 assert.equal(check({input:input('  ')})?.weight,12.5);
 assert.equal(check({config:{overrides:{rigidWeight:{[issue().key]:' 12.5 '}}}}),null);
});
