// R04/U03 independent RED oracle: complete JSON grammar, raw spans and token-derived RootFacts.
// This test is committed BEFORE the scanJsonDocument implementation exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder,openBlobSourceSnapshot} from '../source/source-snapshot.mjs';
// R01 is a separate unmerged writer branch. R04 proves the wire facts, not cross-branch imports.
import {scanJsonDocument} from './json-tokenizer.mjs';

const utf8=text=>new TextEncoder().encode(text);
function source(text,chunk=1){
  const bytes=utf8(text),builder=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'r04-u03'});
  for(let i=0;i<bytes.length;i+=chunk)builder.append(bytes.subarray(i,i+chunk),i);
  return builder.finalize();
}
const refuse=code=>error=>{assert.equal(error?.code,code);return true;};

test('U03 nested grammar: exact EOF, bounded tokens and complete R01 RootFacts',async()=>{
  const json='{"hierarchy":[{"name":"A","children":[true,null,0,-0,1.5,-2e3]},{"name":"B","children":[]}],"units":{"length":"mm"},"status":false}';
  const snapshot=source(json,1),seen=[];
  const result=await scanJsonDocument(snapshot,{pageBytes:1,onToken:t=>seen.push(t)});
  assert.equal(result.endByteExclusive,utf8(json).length);
  assert.equal(result.complete,true);
  assert.equal(result.rootFacts.schemaVersion,'lfj-token-root-facts/v1');
  assert.equal(result.rootFacts.complete,true);
  assert.equal(result.rootFacts.duplicateRootKeys,false);
  assert.deepEqual(result.rootFacts.fields.hierarchy,{type:'array',count:2});
  assert.deepEqual(result.rootFacts.fields.units,{type:'object',fields:{length:{type:'string',value:'mm'}}});
  assert.equal(result.rootFacts.rootType,'object');
  assert.equal(result.rootFacts.fields.hierarchy.type,'array');
  assert.equal(result.tokenCount,seen.length);
  const num=seen.find(t=>t.type==='number'&&t.value==='-2e3');
  assert.deepEqual([num?.startByte,num?.endByteExclusive],[json.indexOf('-2e3'),json.indexOf('-2e3')+4]);
  assert.ok(seen.some(t=>t.type==='boolean'&&t.value===false));
  assert.ok(seen.some(t=>t.type==='null'));
  assert.ok(seen.every(t=>t.sourceRevision===snapshot.revision));
  snapshot.close();
});

test('U03 managed-profile RootFacts parity on immutable Blob source',async()=>{
  const original={schema:'inputxml-managed-stage/v1',profile:'AVEVA_JSON_FOR_3D_RVM_VIEWER',
    converter:'INPUTXML->STAGEDJSON',converterSchema:'inputxml-direct-managed-stage/v2-rich-topology',
    units:{length:'mm'},hierarchy:[{type:'BRANCH',name:'A',children:[]}],stats:{components:1}};
  const json=JSON.stringify(original); // independently authored test source only
  const blob=await openBlobSourceSnapshot(new Blob([utf8(json)]),{revision:'u03-blob',chunkBytes:2});
  const result=await scanJsonDocument(blob,{pageBytes:1});
  assert.deepEqual(result.rootFacts.fields.schema,{type:'string',value:'inputxml-managed-stage/v1'});
  assert.deepEqual(result.rootFacts.fields.profile,{type:'string',value:'AVEVA_JSON_FOR_3D_RVM_VIEWER'});
  assert.deepEqual(result.rootFacts.fields.converter,{type:'string',value:'INPUTXML->STAGEDJSON'});
  assert.deepEqual(result.rootFacts.fields.converterSchema,{type:'string',value:'inputxml-direct-managed-stage/v2-rich-topology'});
  assert.deepEqual(result.rootFacts.fields.units,{type:'object',fields:{length:{type:'string',value:'mm'}}});
  assert.equal(result.rootFacts.fields.hierarchy.count,1);
  blob.close();
});

test('U03 JSON-valid scalar roots are not implicitly staging roots',async()=>{
  for(const literal of ['true','null','-12.5E+2','"plain"']){
    const s=source(literal,1),r=await scanJsonDocument(s,{pageBytes:1});
    assert.equal(r.complete,true);assert.equal(r.endByteExclusive,utf8(literal).length);
    assert.equal(r.rootFacts.complete,true);
    assert.ok(!['object','array'].includes(r.rootFacts.rootType));
    s.close();
  }
});

test('U03 invalid number/literal/comma/colon/closure rejects with typed error',async()=>{
  const cases=[
    ['{"a":}', 'EXPECTED_VALUE'],['{"a" 1}','EXPECTED_COLON'],
    ['{"a":1,}','EXPECTED_KEY'],['{"a":1 "b":2}','EXPECTED_OBJECT_SEPARATOR'],
    ['{"a":1,,"b":2}','EXPECTED_KEY'],['[1,]','EXPECTED_VALUE'],
    ['[1 2]','EXPECTED_ARRAY_SEPARATOR'],['[,1]','EXPECTED_VALUE'],
    ['01','TRAILING_CONTENT'],['1.','INVALID_NUMBER'],['1e+','INVALID_NUMBER'],
    ['-.1','INVALID_NUMBER'],['+1','EXPECTED_VALUE'],['nul','INVALID_LITERAL'],
    ['False','EXPECTED_VALUE'],['{"a":true} trailing','TRAILING_CONTENT'],
    ['"unterminated','UNTERMINATED_STRING'],['{"a":[3}','EXPECTED_ARRAY_SEPARATOR'],
    ['{"a":1','EXPECTED_OBJECT_SEPARATOR'],
  ];
  for(const [raw,code] of cases){
    const s=source(raw,1);
    await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1}),refuse(code),raw);
    s.close();
  }
});

test('U03 duplicate textual keys, including escaped aliases, fail closed',async()=>{
  for(const raw of [
    '{"hierarchy":[],"hierarchy":[]}',
    '{"hierarchy":[],"hier\\u0061rchy":[]}',
    '{"units":{"length":"mm","length":"m"},"hierarchy":[1]}',
  ]){
    const s=source(raw,1);
    await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1}),refuse('DUPLICATE_JSON_KEY'),raw);
    s.close();
  }
});

test('U03 incomplete documents never expose completed facts; terminal whitespace is legal',async()=>{
  for(const raw of ['{','[','{"hierarchy":[1]','{"a":"b"','{"x":false ','[1,2 ']){
    const s=source(raw,1);
    await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1}),error=>{
      assert.ok(['EXPECTED_KEY','EXPECTED_VALUE','EXPECTED_OBJECT_SEPARATOR','EXPECTED_ARRAY_SEPARATOR','UNTERMINATED_STRING'].includes(error?.code),error?.code);
      return true;
    });
    s.close();
  }
  const s=source(' \n\t{"branches":[1,2]}\r\n ',1);
  const r=await scanJsonDocument(s,{pageBytes:1});
  assert.equal(r.rootFacts.fields.branches.count,2);
  assert.equal(r.endByteExclusive,utf8(' \n\t{"branches":[1,2]}\r\n ').length);
  s.close();
});

test('U03 embedded U+FEFF is data; leading file BOM is not silently discarded',async()=>{
  const inside=source('"'+String.fromCodePoint(0xFEFF)+'beta"',1);
  assert.equal((await scanJsonDocument(inside,{pageBytes:1})).rootFacts.rootType,'string');
  inside.close();
  const leading=source(String.fromCodePoint(0xFEFF)+'{"hierarchy":[]}',1);
  await assert.rejects(()=>scanJsonDocument(leading,{pageBytes:1}),refuse('EXPECTED_VALUE'));
  leading.close();
});
