/** Independent Node fixture oracle + actual Chromium worker/IDB research. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const filename=process.argv[process.argv.indexOf('--fixture')+1];
const backend=process.env.B0_BACKEND||'ROW';
assert.ok(['ROW','PAGED'].includes(backend));
if(!['Benchmarks/1885Sjson/Sjson.json','Benchmarks/1885_NC/1885_NC.json'].includes(filename))
  throw new Error('ORIGINAL_TRACKED_FIXTURE_REQUIRED');
const original=await readFile(filename);
const sha256=createHash('sha256').update(original).digest('hex');
const value=JSON.parse(original.toString('utf8'));
const escape=k=>String(k).replaceAll('~','~0').replaceAll('/','~1');
let occurrenceCount=0,scalars=[];
const frames=[{value,path:''}];
while(frames.length){
  const item=frames.pop(),ordinal=occurrenceCount++;
  if(item.value===null||typeof item.value!=='object'){
    if(Buffer.byteLength(JSON.stringify(item.value))<=4096)
      scalars.push({ordinal,path:item.path,expected:item.value});
    continue;
  }
  const children=Array.isArray(item.value)
    ?item.value.map((x,i)=>[String(i),x])
    :Object.entries(item.value);
  for(let i=children.length-1;i>=0;i--){
    const [key,x]=children[i];
    frames.push({value:x,path:item.path+'/'+escape(key)});
  }
}
assert.ok(scalars.length>=3);
const scalarSamples=[scalars[0],scalars[Math.floor(scalars.length/2)],scalars.at(-1)];
const oracle={bytes:original.length,sha256,occurrenceCount,scalarSamples};
console.log('B0_INDEPENDENT_SOURCE_ORACLE '+JSON.stringify({
  filename,bytes:oracle.bytes,sha256:oracle.sha256,
  occurrences:occurrenceCount,samples:scalarSamples.map(x=>({ordinal:x.ordinal,path:x.path}))
}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror',e=>console.error('B0_BROWSER_PAGEERROR',e.message));
  await page.goto('http://127.0.0.1:4197/lfj/qualification/experiments/consumer-sparse-b0/original-worker-oracle.html');
  await page.waitForFunction(()=>window.__b0Ready===true);
  const result=await page.evaluate(input=>window.runCompactOriginalProbe(input),
    {url:'/'+filename,oracle,backend});
  assert.equal(result.schema,'LFJ.B0.SourceBrowserOracle.v1');
  assert.equal(result.occurrenceCount,oracle.occurrenceCount);
  assert.equal(result.sourceSha256,oracle.sha256);
  assert.ok(result.verified.every(s=>s.exact));
  assert.equal(result.appWired,false);
  const malformed=await page.evaluate(backend=>window.runCompactMalformedNegative(backend),backend);
  assert.equal(malformed.headPublished,false);
  assert.equal(malformed.rejected,true);
  console.log('B0_AUTHENTIC_BROWSER_RESEARCH_PASS '+JSON.stringify({
    filename,...result,backend,malformed,qualification:'SOURCE_ONLY_TEST_NOT_PRODUCTION'
  }));
}finally{await browser.close();}
