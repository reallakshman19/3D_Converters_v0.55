// R01 TOKEN-ROOT-FACTS RED oracle. The token/fact input is a shallow descriptor,
// not a parsed JSON object and not an R04 implementation or engineering grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStructuredJsonRoot,inspectStructuredJsonRootFacts,
  TOKEN_ROOT_FACTS_SCHEMA } from './root-profile.mjs';

const s=value=>({type:'string',value});
const arr=count=>({type:'array',count});
const obj=fields=>({type:'object',fields});
const f=(fields,extra={})=>({schemaVersion:'lfj-token-root-facts/v1',rootType:'object',
  fields,complete:true,duplicateRootKeys:false,...extra});
const markup={
  schema:s('inputxml-managed-stage/v1'),
  profile:s('AVEVA_JSON_FOR_3D_RVM_VIEWER'),
  converter:s('INPUTXML->STAGEDJSON'),
  converterSchema:s('inputxml-direct-managed-stage/v2-rich-topology'),
  units:obj({length:s('mm')}),
  hierarchy:arr(2),
};
const node={type:'BRANCH',name:'/A',children:[]};
function code(fn){try{fn();return 'NOT_REJECTED';}catch(e){return e.code||'UNTYPED';}}
function parity(parsed,shallow){
  const actual=inspectStructuredJsonRootFacts(shallow);
  const expected=inspectStructuredJsonRoot(parsed);
  assert.deepEqual(actual,expected,'AST-free token descriptor must yield identical R01 authority');
  assert.equal(actual.rightsBasis,'STRUCTURAL_INSPECTION_ONLY');
  assert.equal(actual.capabilities.edit,false);assert.equal(actual.capabilities.export,false);
}

test('R01 RootFacts schema is explicitly versioned and consumed without fake arrays',()=>{
  assert.equal(TOKEN_ROOT_FACTS_SCHEMA,'lfj-token-root-facts/v1');
  for(const [name,parsed] of [
    ['hierarchy',{hierarchy:[node,node]}],
    ['objects',{objects:[node,node]}],
    ['branches',{branches:[node]}],
    ['typed-single',{type:'BRANCH',children:[]}],
  ]){
    const fields=name==='typed-single'?{type:s('BRANCH'),children:arr(0)}:{[name]:arr(parsed[name].length)};
    parity(parsed,f(fields));
    assert.equal(Array.isArray(fields[name]?.value),false,
      'token-based shape is count-only, not fake array');
  }
  parity([node,node],{schemaVersion:'lfj-token-root-facts/v1',rootType:'array',
    rootCount:2,complete:true,duplicateRootKeys:false});
});

test('R01 strict rich-topology metadata yields same structural profile without hierarchy materialization',()=>{
  const parsed={schema:'inputxml-managed-stage/v1',
    profile:'AVEVA_JSON_FOR_3D_RVM_VIEWER',converter:'INPUTXML->STAGEDJSON',
    converterSchema:'inputxml-direct-managed-stage/v2-rich-topology',
    units:{length:'mm'},hierarchy:[node,node]};
  parity(parsed,f(markup));
  assert.equal(inspectStructuredJsonRootFacts(f(markup)).profileId,'managed-stage-markup-rich/v2');
});

test('R01 unknown schema, wrong units or empty strict hierarchy fail closed',()=>{
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({...markup,
    schema:s('inputxml-managed-stage/v999')}))),'UNSUPPORTED_SCHEMA');
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({...markup,
    units:obj({length:s('m')})}))),'UNITS_MISMATCH');
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({...markup,
    hierarchy:arr(0)}))),'EMPTY_RICH_HIERARCHY');
});

test('R01 token scanner must attest completed root and no duplicate raw root keys',()=>{
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({hierarchy:arr(1)},{complete:false}))),
    'INCOMPLETE_ROOT_FACTS');
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({hierarchy:arr(1)},{duplicateRootKeys:true}))),
    'DUPLICATE_ROOT_KEY');
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({hierarchy:arr(1)},{duplicateRootKeys:undefined}))),
    'INVALID_ROOT_FACTS');
});

test('R01 contradictory or malformed own root envelopes are never silently bypassed',()=>{
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({
    hierarchy:{type:'string',value:'not-array'},objects:arr(1)}))),'INVALID_ROOT_ENVELOPE');
  assert.equal(code(()=>inspectStructuredJsonRootFacts(f({hierarchy:arr(1),objects:arr(1)}))),
    'AMBIGUOUS_ROOT');
  assert.equal(code(()=>inspectStructuredJsonRoot({hierarchy:'wrong',objects:[node]})),
    'INVALID_ROOT_ENVELOPE');
  assert.equal(code(()=>inspectStructuredJsonRoot({hierarchy:[node],objects:[node]})),
    'AMBIGUOUS_ROOT');
});

test('R01 refuses malformed array counts, forged fields and untyped scalar metadata',()=>{
  for(const bad of [
    f({objects:arr(-1)}),
    f({objects:{type:'array',count:0.5}}),
    f({objects:arr(2),profile:{type:'number',value:123}}),
    f({objects:arr(1)},{rootType:'unknown'}),
    f({objects:arr(1)},{schemaVersion:'lfj-root-facts/v999'}),
    f({objects:arr(1)},{complete:undefined}),
  ])assert.notEqual(code(()=>inspectStructuredJsonRootFacts(bad)),'NOT_REJECTED');
});
