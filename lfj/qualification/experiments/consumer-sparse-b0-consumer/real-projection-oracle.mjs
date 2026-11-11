/** Native Chromium B0 consumer projections vs REAL legacy downstream trace oracle. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {buildStandaloneDtxrPositionGroups} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-resolution-ledger.js';
import {decorateJsonTraceMember} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {groupTraceEntriesSpatially} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-trace-spatial-index.js';
import {configuredJsonTraceFieldNames} from
  '../../../../tabs/xml-cii-2019-standalone/xml-cii-json-trace-fields.js';
import {resolveSourceSchema} from
  '../../../../converters/xml-cii2019-core/source-schema-adapter.js';

const filename=process.argv[process.argv.indexOf('--fixture')+1];
assert.ok(['Benchmarks/1885Sjson/Sjson.json',
  'Benchmarks/1885_NC/1885_NC.json'].includes(filename));
const mode=process.env.B0_CONFIG||'DEFAULT';
assert.ok(['DEFAULT','CUSTOM_CAPTURE'].includes(mode));
const config=mode==='CUSTOM_CAPTURE'?{
  captureFields:[
    {name:'SPREF',enabled:true},{name:'DTXR_PS',enabled:true},
    {name:'DTXR_POS',enabled:false},{name:'EXTRA_OWNER_FIELD',enabled:true}
  ],
  sourceSchema:{fields:{
    supportGroupRef:['CMPSUPREFN','SPREF'],
    componentRef:['COMPRE','ComponentRefNo']
  }}
}:{};
const original=await readFile(filename);
const parsed=JSON.parse(original.toString('utf8'));
assert.ok(Array.isArray(parsed)&&parsed.length>0,'authentic root-array requirement');
const hash=createHash('sha256').update(original).digest('hex');
let occurrences=0;
const stack=[parsed];
while(stack.length){
  const x=stack.pop();occurrences++;
  if(x&&typeof x==='object'){
    const kids=Array.isArray(x)?x:Object.values(x);
    for(let i=kids.length-1;i>=0;i--)stack.push(kids[i]);
  }
}
const count=v=>Array.isArray(v)?
  v.reduce((s,c)=>s+count(c),0):
  (v&&typeof v==='object'?1+count(Array.isArray(v.children)?v.children:[]):0);
const sourceObjects=count(parsed);
const groups=buildStandaloneDtxrPositionGroups(parsed,6,config);
const entries=groups.flatMap(g=>g.entries).sort((a,b)=>a.jsonSequence-b.jsonSequence);
const keys=['jsonNodeNo','jsonSequence','branchName','point','bore','type',
  'description','dtxrPs','labeled','name','componentRef','tags','cmpSupGap',
  'path','capturedFields','semanticFields'];
const normalized=m=>Object.fromEntries(keys.map(k=>[k,m[k]??(k==='point'?null:'')]));
const facts=entries.map(entry=>normalized(decorateJsonTraceMember(entry,config)));
const pageDigests=[];
for(let n=0;n<facts.length;n+=128)
  pageDigests.push(createHash('sha256')
    .update(JSON.stringify(facts.slice(n,n+128))).digest('hex'));
const domainSha256=createHash('sha256').update(pageDigests.join('\n')).digest('hex');
const consumerManifestDigest=createHash('sha256').update(JSON.stringify({
  schema:'LFJ.B0.ResolverProjection.v1',config,toleranceMm:6,
  enabledFields:configuredJsonTraceFieldNames(config),
  resolvedSchema:resolveSourceSchema(config)
})).digest('hex');
const indexes=new Set([0,1,127,128,255,256,facts.length-1]);
for(let i=1;i<facts.length;i++){
  const a=facts[i-1].path.match(/^\\$\\[(\\d+)\\]/)?.[1];
  const b=facts[i].path.match(/^\\$\\[(\\d+)\\]/)?.[1];
  if(a!==b){indexes.add(i-1);indexes.add(i);}
}
const sampleFacts=[...indexes].filter(i=>i>=0&&i<facts.length)
  .sort((a,b)=>a-b).map(i=>({index:i,expected:facts[i]}));
const oracle={
  bytes:original.length,sha256:hash,occurrenceCount:occurrences,
  factCount:facts.length,sourceObjects,groups:groups.length,domainSha256,
  consumerManifestDigest,sampleFacts
};
console.log('B0_CONSUMER_REAL_LEGACY_GOLDEN '+JSON.stringify({
  fixture:filename,mode,...oracle,
  samples:facts.filter((_,i)=>i===0||i===Math.floor(facts.length/2)||i===facts.length-1)
    .map(x=>({path:x.path,jsonNodeNo:x.jsonNodeNo,
      branchName:x.branchName,description:x.description,tags:x.tags,
      capturedFields:x.capturedFields}))
}));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror',e=>console.error('B0_PROJECTION_BROWSER_ERROR',e.message));
  await page.goto('http://127.0.0.1:4199/lfj/qualification/experiments/consumer-sparse-b0-consumer/projection-original.html');
  await page.waitForFunction(()=>window.__projectionReady);
  const result=await page.evaluate(input=>window.runResolverProjectionOriginal(input),
    {url:'/'+filename,oracle,config});
  assert.equal(result.verifiedFullDomainDigest,true);
  assert.equal(result.sourceOnly,true);
  assert.equal(result.engineeringReady,false);
  console.log('B0_CONSUMER_ORIGINAL_CHROMIUM_PASS '+JSON.stringify({
    fixture:filename,mode,...result,
    qualification:'CONSUMER_RECORDS_ONLY_NOT_ENGINEERING_BUILD_NOT_PRODUCTION'
  }));
}finally{await browser.close();}
