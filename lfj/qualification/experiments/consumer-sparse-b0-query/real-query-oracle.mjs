/** B0-03 independent true-original fixture census and dual-Worker query oracle. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const filename=process.argv[process.argv.indexOf('--fixture')+1];
assert.ok(['Benchmarks/1885Sjson/Sjson.json',
  'Benchmarks/1885_NC/1885_NC.json'].includes(filename),
  'original tracked benchmark required');
const bytes=await readFile(filename);
const sha256=createHash('sha256').update(bytes).digest('hex');
const json=JSON.parse(bytes.toString('utf8'));
const pathPart=s=>String(s).replaceAll('~','~0').replaceAll('/','~1');
let occurrenceCount=0;
const scalarSamples=[];
const stack=[{value:json,path:''}];
while(stack.length){
  const item=stack.pop(),ordinal=occurrenceCount++;
  const v=item.value;
  if(v===null||typeof v!=='object'){
    if(Buffer.byteLength(JSON.stringify(v))<=4096)
      scalarSamples.push({ordinal,path:item.path,expected:v});
    continue;
  }
  const children=Array.isArray(v)?
    v.map((x,i)=>[i,x]):Object.entries(v);
  for(let i=children.length-1;i>=0;i--){
    const [key,child]=children[i];
    stack.push({value:child,path:item.path+'/'+pathPart(key)});
  }
}
assert.ok(scalarSamples.length>=3);
const oracle={bytes:bytes.length,sha256,occurrenceCount,scalarSamples:[
  scalarSamples[0],
  scalarSamples[Math.floor(scalarSamples.length/2)],
  scalarSamples.at(-1)
]};
console.log('B0_INDEPENDENT_ORIGINAL_QUERY_CENSUS '+JSON.stringify({
  fixture:filename,bytes:oracle.bytes,sha256,
  sourceOccurrences:occurrenceCount,samples:oracle.scalarSamples.map(s=>({
    ordinal:s.ordinal,path:s.path
  }))
}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror',e=>console.error('B0_PAGE_ERROR',e.message));
  await page.goto('http://127.0.0.1:4198/lfj/qualification/experiments/consumer-sparse-b0-query/query-original.html');
  await page.waitForFunction(()=>window.__b0QueryReady===true);
  const result=await page.evaluate(input=>window.runB0QueryOriginal(input),
    {url:'/'+filename,oracle});
  assert.equal(result.schema,'LFJ.B0.SourceAndQueryHarness.v1');
  assert.equal(result.sourceCatalog.occurrenceCount,occurrenceCount);
  assert.equal(result.query.occurrences,occurrenceCount);
  assert.deepEqual(result.query.totals.map(t=>t.selectedCount),
    result.query.totals.map(()=>occurrenceCount));
  assert.equal(result.query.scopedCount,69);
  assert.equal(result.query.sourceOnly,true);
  assert.equal(result.engineeringReady,false);
  console.log('B0_AUTHENTIC_SOURCE_QUERY_CHROMIUM_PASS '+
    JSON.stringify({fixture:filename,...result,qualification:
      'SOURCE_ONLY_NOT_PRODUCTION_NOT_ENGINEERING_READY'}));
}finally{await browser.close();}
