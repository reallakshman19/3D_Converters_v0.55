// R04 U01 independent RED fixtures: a byte reader + JSON escaped-string grammar.
// The R03 source is exact bytes. U02 UTF8 sequences, U03 document grammar,
// U04 global resource/cancel stress remain separate unaccepted units.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder} from '../source/source-snapshot.mjs';
import {createJsonByteCursor,scanQuotedJsonString} from './json-tokenizer.mjs';

function source(text,chunkSize=1) {
  const bytes=new TextEncoder().encode(text);
  const b=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'R04-U01-red'});
  for(let i=0;i<bytes.length;i+=chunkSize)
    b.append(bytes.subarray(i,i+chunkSize),i);
  return {snapshot:b.finalize(),bytes};
}
const rejectCode=code=>e=>{assert.equal(e?.code,code);return true;};

test('U01 independently authored escapes survive every one-byte source/read boundary',async()=>{
  const raw=String.raw`"prefix\\slash\"quote\/solidus\u0041\n"`;
  const {snapshot,bytes}=source(raw,1);
  const cursor=createJsonByteCursor(snapshot,{pageBytes:1});
  const token=await scanQuotedJsonString(cursor);
  assert.deepEqual({type:token.type,start:token.startByte,end:token.endByteExclusive,
      decoded:token.value},
    {type:'string',start:0,end:bytes.length,decoded:'prefix\\slash"quote/solidusA\n'});
  assert.equal(cursor.position,bytes.length);
  assert.equal(await cursor.peek(),null);
  snapshot.close();
});

test('U01 token includes only its original quoted range and leaves the cursor at next punctuation',async()=>{
  const raw=String.raw`"a\"b" , true`;
  const {snapshot,bytes}=source(raw,2);
  const cursor=createJsonByteCursor(snapshot,{pageBytes:3});
  const token=await scanQuotedJsonString(cursor);
  const terminalOffset=new TextEncoder().encode(String.raw`"a\"b"`).length;
  assert.equal(token.startByte,0);
  assert.equal(token.endByteExclusive,terminalOffset);
  assert.equal(token.value,'a"b');
  assert.equal(await cursor.peek(),32); // whitespace after closing quote, not swallowed
  assert.equal(bytes[terminalOffset],32);
  snapshot.close();
});

test('U01 escape grammar rejects bad escapes, raw controls and unterminated strings',async()=>{
  for(const [raw,code] of [
    [String.raw`"a\q"`,'INVALID_ESCAPE'],
    ['"a\nb"','UNESCAPED_CONTROL'],
    ['"not closed','UNTERMINATED_STRING'],
    ['no quote','EXPECTED_QUOTE'],
    [String.raw`"bad\u12Z4"`,'INVALID_UNICODE_ESCAPE'],
  ]){
    const {snapshot}=source(raw,1);
    const cursor=createJsonByteCursor(snapshot,{pageBytes:1});
    await assert.rejects(()=>scanQuotedJsonString(cursor),rejectCode(code));
    snapshot.close();
  }
});

test('U01 source token span budget cannot be bypassed by thousands of escaped chars',async()=>{
  const {snapshot}=source('"1234567890"',2);
  const cursor=createJsonByteCursor(snapshot,{pageBytes:2});
  await assert.rejects(()=>scanQuotedJsonString(cursor,{maxTokenBytes:8}),
    rejectCode('TOKEN_LIMIT'));
  snapshot.close();
});
