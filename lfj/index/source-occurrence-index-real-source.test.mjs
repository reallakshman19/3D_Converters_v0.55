// LFJ R05 original owner-repository full-population source oracle.
// TEST-ONLY independent Node JSON.parse is deliberately not in LFJ product.
// This is 10.54MB byte/occurrence validation, not a browser 30/90MB SLO
// or any actual engineering CII XML output acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openBlobSourceSnapshot} from '../source/source-snapshot.mjs';
import {inspectStructuredJsonRootFacts} from '../contracts/profiles/root-profile.mjs';
import {streamJsonOccurrenceEvents} from './source-occurrence-index.mjs';

const path=fileURLToPath(new URL('../../Benchmarks/Managejson%20to%20Input%20XML/ATTRIBUTE_managed_stage.json',import.meta.url));
const ORIGINAL_BYTES=10539386;
const ORIGINAL_SHA='e465fa696c80516868349032af6cf1976d9a180c86ea2a7b9eab28c6436fa92a';
function independentValueCensus(value){
  let count=0;const stack=[value];
  while(stack.length){
    const v=stack.pop();count++;
    if(v!==null&&typeof v==='object'){
      const children=Array.isArray(v)?v:Object.values(v);
      for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
    }
  }
  return count;
}
test('R05 real 10,539,386-byte original JSON: independent value census vs all bounded OPEN/SEAL', {
 skip:process.env.LFJ_R05_REAL_SOURCE!=='1',
 timeout:420000,
},async()=>{
 const raw=await readFile(path);
 assert.equal(raw.byteLength,ORIGINAL_BYTES,'never silently substitute original input');
 const sha=createHash('sha256').update(raw).digest('hex');
 assert.equal(sha,ORIGINAL_SHA,'original owner source SHA independently pinned');
 // Test-oracle only: independently parse exact original source bytes, walk
 // all arrays, objects and scalar values without any LFJ tokenizer data.
 const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));
 assert.ok(Array.isArray(parsed),'R04 pinned this exact fixture to a bare JSON array root');
 assert.equal(parsed.length,270);
 const independentCount=independentValueCensus(parsed);
 assert.ok(independentCount>270);
 const originalCount=independentCount;
 const snapshot=await openBlobSourceSnapshot(new Blob([raw]),{
   revision:'r05-original-attribute-managed-stage',expectedSha256:sha,chunkBytes:65536,
 });
 const started=Date.now(),before=process.memoryUsage().heapUsed;
 let events=0,opened=0,sealed=0,pages=0,rootOpened=0;
 try{
  const result=await streamJsonOccurrenceEvents(snapshot,{
   sourceRefId:'ORIGINAL-R05-REAL-1',pageEvents:2048,pageBytes:65536,
   onEventPage:async batch=>{
    assert.ok(Object.isFrozen(batch));
    assert.ok(batch.length>0&&batch.length<=2048);
    pages++;events+=batch.length;
    for(const e of batch){
      assert.equal(e.sourceSha256,sha);
      assert.equal(e.sourceRevision,snapshot.revision);
      if(e.kind==='OPEN'){
        opened++;if(e.path==='')rootOpened++;
      }else if(e.kind==='SEAL')sealed++;
      else assert.fail('unexpected R05 event kind');
    }
   }
  });
  assert.equal(result.complete,true);
  assert.equal(result.sourceSha256,sha);
  assert.equal(result.sourceRevision,snapshot.revision);
  assert.equal(result.byteLength,ORIGINAL_BYTES);
  assert.equal(result.endByteExclusive,ORIGINAL_BYTES);
  assert.equal(result.occurrenceCount,originalCount,
    'R05 may not omit nested/unselected original values');
  assert.equal(opened,originalCount);
  assert.equal(sealed,originalCount);
  assert.equal(result.eventCount,events);
  assert.equal(rootOpened,1);
  const profile=inspectStructuredJsonRootFacts(result.rootFacts);
  assert.equal(profile.rightsBasis,'STRUCTURAL_INSPECTION_ONLY');
  assert.equal(profile.capabilities.export,false);
  assert.equal(result.engineeringReady,false);
  assert.equal(result.rightsBasis,'SOURCE_FACTS_ONLY');
  console.log('LFJ_R05_REAL_SOURCE_MEASUREMENT '+JSON.stringify({
    originalSha256:sha,bytes:ORIGINAL_BYTES,rootCount:270,
    independentCount,opened,sealed,pages,events,
    elapsedMs:Date.now()-started,heapDeltaBytes:process.memoryUsage().heapUsed-before,
    quality:'NODE_TEST_ORACLE_NOT_BROWSER_RELEASE_SLO'
  }));
 }finally{snapshot.close();}
});
