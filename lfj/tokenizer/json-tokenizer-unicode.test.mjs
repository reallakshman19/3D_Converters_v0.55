// R04 U02 independently authored UTF-8 / escaped surrogate RED corpus.
// A JSON string may legally contain U+FEFF *inside* its quoted content;
// TextDecoder default BOM stripping must not erase an original codepoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceSnapshotBuilder,openBlobSourceSnapshot}
  from '../source/source-snapshot.mjs';
import {createJsonByteCursor,scanQuotedJsonString} from './json-tokenizer.mjs';

function sourceBytes(bytes,chunkBytes=1) {
  const b=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'u02-unicode'});
  for(let offset=0;offset<bytes.length;offset+=chunkBytes)
    b.append(bytes.subarray(offset,offset+chunkBytes),offset);
  return b.finalize();
}
const enc=s=>new TextEncoder().encode(s);
const code=c=>e=>{assert.equal(e.code,c);return true;};
async function parsed(source,pageBytes=1){
  const cursor=createJsonByteCursor(source,{pageBytes});
  return scanQuotedJsonString(cursor);
}

test('U02 RED: raw U+FEFF belongs to JSON string data, not file-level BOM stripping',async()=>{
  const bom=String.fromCodePoint(0xfeff);
  for(const [input,expected] of [
    ['"'+bom+'alpha" ',bom+'alpha'],
    ['"A\\n'+bom+'tail"', 'A\n'+bom+'tail'],
  ]){
    const bytes=enc(input),source=sourceBytes(bytes,1);
    const token=await parsed(source,1);
    assert.equal(token.value,expected,
      'original UTF8 EF BB BF inside a quoted token must not disappear');
    assert.equal(token.endByteExclusive,bytes.length-(input.endsWith(' ')?1:0));
    source.close();
  }
});

test('U02 multibyte UTF8 across every page and source chunk retains byte span',async()=>{
  const input='"β💡文"';
  const bytes=enc(input);
  const source=sourceBytes(bytes,1);
  const token=await parsed(source,1);
  assert.equal(token.value,'β💡文');
  assert.deepEqual([token.startByte,token.endByteExclusive],[0,bytes.length]);
  source.close();
  const blob=await openBlobSourceSnapshot(new Blob([bytes]),{
    revision:'u02-async-blob',chunkBytes:1,
  });
  const asyncToken=await parsed(blob,1);
  assert.equal(asyncToken.value,'β💡文');
  assert.equal(asyncToken.endByteExclusive,bytes.length);
  blob.close();
});

test('U02 valid escaped supplementary pair and forbidden isolated surrogates',async()=>{
  const good=sourceBytes(enc(String.raw`"x\uD83D\uDCA1"`),1);
  assert.equal((await parsed(good,1)).value,'x💡');
  good.close();
  for(const bad of [
    String.raw`"x\uD83D"`,
    String.raw`"x\uDCA1"`,
    String.raw`"x\uD83D\u0041"`,
  ]){
    const source=sourceBytes(enc(bad),1);
    await assert.rejects(()=>parsed(source,1),code('INVALID_SURROGATE'));
    source.close();
  }
});

test('U02 invalid, overlong and truncated multibyte UTF8 rejects exact original bytes',async()=>{
  for(const bytes of [
    Uint8Array.of(34,0xf0,0x9f,0x92,34),
    Uint8Array.of(34,0xe0,0x80,0xaf,34),
    Uint8Array.of(34,0xff,34),
  ]){
    const source=sourceBytes(bytes,1);
    await assert.rejects(()=>parsed(source,1),code('INVALID_UTF8'));
    source.close();
  }
});
