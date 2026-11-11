// U04 completion-gate RED: resource limits must apply to numbers and keys,
// not only quoted string data; source closure with a buffered cursor must revoke
// a completed result. Independent source/byte tests, not synthetic 30MB SLO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {scanJsonDocument} from './json-tokenizer.mjs';
const bytes=x=>new TextEncoder().encode(x);
function make(text) {
 const data=bytes(text),builder=createSourceSnapshotBuilder({byteLength:data.length,revision:'U04-RED-resource-gate'});
 for(let i=0;i<data.length;i+=127)builder.append(data.subarray(i,i+127),i);
 return builder.finalize();
}
const refused=code=>e=>{assert.equal(e?.code,code,'fail closed with typed resource error');return true;};
test('U04 RED: giant numeric integer, fraction and exponent obey same original-token byte cap as strings',async()=>{
  const scalars=['1'.repeat(64),'0.'+'1'.repeat(64),'1e+'+'1'.repeat(64),'-'+'1'.repeat(64)];
  for(const num of scalars){
    const s=make('['+num+']');
    await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1,maxTokenBytes:8}),refused('TOKEN_LIMIT'),num.slice(0,8));
    s.close();
  }
});
test('U04 RED: duplicate-key set must have an explicit per-object key count budget',async()=>{
 const s=make('{"a":1,"b":2,"c":3,"d":4}');
 await assert.rejects(()=>scanJsonDocument(s,{maxObjectKeys:2,pageBytes:1}),refused('OBJECT_KEYS_LIMIT'));
 s.close();
});
test('U04 RED: per-object total decoded/source key bytes have a separate hard bound',async()=>{
 const s=make('{"longkeyA":1,"longkeyB":2,"longkeyC":3}');
 await assert.rejects(()=>scanJsonDocument(s,{maxObjectKeyBytes:16,pageBytes:1}),refused('OBJECT_KEY_BYTES_LIMIT'));
 s.close();
});
test('U04 RED: oversize object caps cannot bypass hard policy by supplied options',async()=>{
 for(const opts of [{maxObjectKeys:999999999},{maxObjectKeyBytes:1e12},{maxObjectKeys:0},{maxObjectKeyBytes:0}]){
   const s=make('{"a":1}');
   await assert.rejects(()=>scanJsonDocument(s,opts),refused('INVALID_RESOURCE_LIMIT'));
   s.close();
 }
});
test('U04 duplicate raw/escaped key detection remains fail closed under ordinary key budgets',async()=>{
 const s=make(String.raw`{"name":1,"n\u0061me":2}`);
 await assert.rejects(()=>scanJsonDocument(s,{pageBytes:1,maxObjectKeys:50,maxObjectKeyBytes:1024}),
   refused('DUPLICATE_JSON_KEY'));
 s.close();
});
test('U04 source close during cached source page cannot produce completed root facts',async()=>{
 const s=make('{"a":1}');
 let closed=false;
 await assert.rejects(()=>scanJsonDocument(s,{pageBytes:65536,onToken:token=>{
   if(!closed&&token.type==='end-object'){closed=true;s.close();}
 }}),refused('SOURCE_CLOSED'));
 assert.equal(closed,true);
});
