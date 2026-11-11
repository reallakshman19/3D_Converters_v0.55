/**
 * TAB3-O1-R9-W15: joint Owner Option-A upper-corner qualification.
 * SYNTHETIC GENERATED 100MiB + exactly 2m original values, containing the
 * AUTHENTIC Firstpass semantic prefix (separate protected CSV oracle).
 * Actual default standalone root / checked-in raw docs Chromium Worker flow.
 * Does not assert all JSON shapes or a numeric Owner frame-gap SLA.
 */
import assert from 'node:assert/strict';
import {open,readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';

const variant=process.env.W15_ROUTE||'root-raw';
assert.ok(['root-raw','docs-raw'].includes(variant));
const route=variant==='root-raw'?'index.html':'docs/index.html';
const head=process.env.EXACT_HEAD||'UNSET';
const rootFile='Benchmarks/1885Sjson/Sjson.json';
const xmlFile='Benchmarks/1885Sjson/FirstpassXML';
const originalSha='6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288';
const protectedCsv={
  node:{rows:216,bytes:57945,sha256:'0d8bb4482ed4a9d0d116faeac5e68ce564f07b6bba2dd73dfc3676b72ec2eddc'},
  evidence:{rows:241,bytes:50399,sha256:'653485ff968bf478fa0001488432bb210a9ce6e85a901e9cc19f368f53a24809'}
};
const TARGET_BYTES=104857600,TARGET_OCC=2000000,PADS=4000;
const sha=x=>createHash('sha256').update(x).digest('hex');
// Independent whole-document occurrence census. The source Worker does NOT
// supply this count; this is Node's built-in JSON parser + separate walk.
function occurrences(doc){
 let n=0,stack=[doc];
 while(stack.length){
  const v=stack.pop();n++;
  if(v!==null&&typeof v==='object'){
   const values=Array.isArray(v)?v:Object.values(v);
   for(const child of values){
    if(child!==null&&typeof child==='object')stack.push(child);
    else n++;
   }
  }
 }
 return n;
}
const ptrEscape=s=>s.replace(/~/g,'~0').replace(/\//g,'~1');
function samplePointers(doc,limit=32){
 const result=[],stack=[{v:doc,p:''}];
 while(stack.length&&result.length<limit){
  const {v,p}=stack.pop();
  if(v===null||typeof v!=='object'){result.push({path:p,value:v});continue;}
  const entries=Array.isArray(v)?v.map((z,i)=>[String(i),z]):Object.entries(v);
  // Stable original order; prefer real nested leaf addresses.
  for(let i=entries.length-1;i>=0&&stack.length<512;i--){
   const [key,z]=entries[i];stack.push({v:z,p:p+'/'+ptrEscape(key)});
  }
 }
 return result;
}
function atPointer(doc,path){
 if(!path)return doc;
 return path.slice(1).split('/').reduce((v,seg)=>{
  const key=seg.replace(/~1/g,'/').replace(/~0/g,'~');
  return v?.[key];
 },doc);
}
const filePath='/tmp/lfj226-o1-W15-joint-'+variant+'-'+process.pid+'.json';
const rec={schema:'LFJ226.O1.W15.JointInclusive.v1',
  target:{bytes:TARGET_BYTES,occurrences:TARGET_OCC},
  route,variant,exactHead:head,generated:true,authenticEmbeddedPrefix:true,
  semanticOracle:'PROTECTED_ORIGINAL_FIRSTPASS_CSV_AND_POINTER_SAMPLE',
  notAnAuthentic100MiBGolden:true,notProofOfEveryAdmittedShape:true,
  ownerNumericFrameSla:false,steps:[],workerUrls:[],failedAssets:[],
  pageErrors:[],downloads:[],downloadEvents:0,pass:false};
let browser,page,created=false;
try{
 const raw=await readFile(rootFile);
 assert.equal(sha(raw),originalSha,'original Firstpass protected SHA');
 const source=raw.toString('utf8');
 const seed=JSON.parse(source);
 assert.ok(Array.isArray(seed)&&seed.length>0,'original Firstpass root array');
 const originalValues=occurrences(seed);
 assert.equal(originalValues,23754,'original full occurrence count');
 const fragment=source.trim().slice(1,-1);
 const zeroCount=TARGET_OCC-originalValues-PADS;
 assert.ok(zeroCount>0);
 // Root array replaces the original root, so originalValues already accounts
 // for it; each padding JSON string and each trailing zero adds one value.
 const minBytes=Buffer.byteLength('['+fragment+']')+2*zeroCount+3*PADS;
 const paddingBytes=TARGET_BYTES-minBytes;
 assert.ok(paddingBytes>0&&paddingBytes<=PADS*32000);
 const padSize=Math.floor(paddingBytes/PADS);
 const padRemainder=paddingBytes%PADS;
 const fh=await open(filePath,'w');
 const digest=createHash('sha256');
 let written=0;
 async function append(s){
  const bytes=Buffer.from(s,'utf8');
  const {bytesWritten}=await fh.write(bytes);
  assert.equal(bytesWritten,bytes.length,'short test input write');
  written+=bytes.length;digest.update(bytes);
 }
 try{
  await append('[');await append(fragment);
  let left=zeroCount;
  while(left){const n=Math.min(8192,left);await append(',0'.repeat(n));left-=n;}
  for(let i=0;i<PADS;i++){
   const n=padSize+(i<padRemainder?1:0);
   await append(',"'+'x'.repeat(n)+'"');
  }
  await append(']');
 }finally{await fh.close();}
 assert.equal(written,TARGET_BYTES,'exact original file byte fence');
 const generatedSha=digest.digest('hex');
 // External preflight: parse and independently recount the ENTIRE 100MiB
 // valid file, not just assume the generator's arithmetic.
 {
  const parsed=JSON.parse(await readFile(filePath,'utf8'));
  assert.equal(occurrences(parsed),TARGET_OCC,'external JSON occurrence census');
  assert.equal(parsed.length,seed.length+zeroCount+PADS,'full array cardinality');
  assert.deepEqual(parsed.slice(0,seed.length),seed,'embedded original identity');
  const pointers=samplePointers(seed);
  assert.ok(pointers.length>=16);
  for(const item of pointers)assert.deepEqual(atPointer(parsed,item.path),item.value,
    'unchanged original RFC6901 pointer '+item.path);
  rec.externalOracle={parser:'Node JSON.parse + independent complete tree walk',
   byteLength:written,originalOccurrences:TARGET_OCC,
   sha256:sha(await readFile(filePath)),originalPrefixSha256:originalSha,
   originalPrefixRootItems:seed.length,originalPrefixOccurrences:originalValues,
   numericPaddingOccurrences:zeroCount,stringPaddingOccurrences:PADS,
   independentOriginalPointers:pointers.slice(0,24)};
  assert.equal(rec.externalOracle.sha256,generatedSha);
 }
 rec.sourceSha256=generatedSha;
 rec.steps.push({phase:'external-byte-count-sha-pointer-oracle',pass:true});
 created=true;
 browser=await chromium.launch({headless:true});
 page=await browser.newPage({acceptDownloads:true});
 page.setDefaultTimeout(30000);
 page.on('worker',w=>rec.workerUrls.push(w.url()));
 page.on('download',()=>rec.downloadEvents++);
 page.on('pageerror',e=>rec.pageErrors.push(String(e).slice(0,350)));
 page.on('response',r=>{
  if(r.url().startsWith('http://127.0.0.1:4173/')&&
   /\/(tabs|lfj)\//.test(r.url())&&r.status()>=400)
   rec.failedAssets.push({url:r.url(),status:r.status()});
 });
 await page.addInitScript(()=>{
  const stats={last:0,frames:0,maxFrameGapMs:0,heartbeats:0,lastHeartbeat:0,
   maxHeartbeatGapMs:0};
  const tick=t=>{if(stats.last){
   stats.frames++;stats.maxFrameGapMs=Math.max(stats.maxFrameGapMs,t-stats.last);}
   stats.last=t;requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  setInterval(()=>{const now=performance.now();
   if(stats.lastHeartbeat)stats.maxHeartbeatGapMs=
    Math.max(stats.maxHeartbeatGapMs,now-stats.lastHeartbeat);
   stats.lastHeartbeat=now;stats.heartbeats++;},100);
  window.__o1w15=stats;
 });
 const response=await page.goto('http://127.0.0.1:4173/'+route,{waitUntil:'domcontentloaded'});
 assert.equal(response?.status(),200);
 await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:45000});
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(xmlFile);
 await page.locator('[data-phase="json-trace"]').click();
 assert.equal(await page.locator('[data-lfj-o1-enable]').isChecked(),true,
  'ordinary user route must enable native O1 Worker by default');
 const started=performance.now();
 await page.locator('[data-field="staged-json-file"]').setInputFiles(filePath,{timeout:270000});
 await page.waitForFunction(()=>{
  const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return s.startsWith('LFJ source index COMMITTED')||s.startsWith('LFJ Worker FAILED');
 },null,{timeout:270000});
 rec.sourceMs=Math.round(performance.now()-started);
 rec.sourceStatus=await page.locator('[data-lfj-o1-status]').textContent();
 rec.steps.push({phase:'original-source-worker-and-index',elapsedMs:rec.sourceMs,status:rec.sourceStatus});
 assert.ok(rec.sourceStatus.includes('COMMITTED: 2000000 original occurrences'),
  'native Worker must commit complete two-million original occurrences');
 assert.ok(rec.sourceStatus.includes(generatedSha.slice(0,12)),
  'native Worker original source digest must match independent bytes');
 const domainAt=performance.now();
 await page.locator('[data-action="build-resolver-index"]').click();
 await page.waitForFunction(()=>{
  const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return s.startsWith('O1 matched trace source-path verified')||
   s.startsWith('O1 domain blocked')||s.startsWith('O1 Worker FAILED');
 },null,{timeout:270000});
 rec.domainMs=Math.round(performance.now()-domainAt);
 rec.domainStatus=await page.locator('[data-lfj-o1-status]').textContent();
 rec.steps.push({phase:'independent-XML-domain-worker',elapsedMs:rec.domainMs,status:rec.domainStatus});
 assert.ok(rec.domainStatus.startsWith('O1 matched trace source-path verified'),
  'independent XML-domain must match original source paths');
 rec.tableRows=await page.locator('[data-lfj-o1-table] tbody tr').count();
 assert.ok(rec.tableRows>0&&rec.tableRows<=64,'bounded actual rendered trace page');
 for(const type of ['node','evidence']){
  const [download]=await Promise.all([
   page.waitForEvent('download',{timeout:210000}),
   page.locator('[data-lfj-o1-action="export-'+type+'"]').click()
  ]);
  const bytes=await readFile(await download.path());
  const got={type,rows:bytes.toString('utf8').split('\r\n').length-2,
   bytes:bytes.length,sha256:sha(bytes),bom:bytes.subarray(0,3).toString('hex')};
  rec.downloads.push(got);
  assert.deepEqual(got,{type,...protectedCsv[type],bom:'efbbbf'},
   'protected source-matched complete original '+type+' CSV');
 }
 assert.ok(rec.workerUrls.some(u=>u.includes('source-browser-worker.mjs')),
  'native original source/index Worker required');
 assert.ok(rec.workerUrls.some(u=>u.includes('lfj-o1-resolver-domain-worker.mjs')),
  'separate native XML-domain Worker required');
 assert.equal(rec.failedAssets.length,0,'no missing active module asset');
 assert.equal(rec.pageErrors.length,0,'no browser page error');
 const before=rec.downloadEvents;
 await page.locator('[data-field="staged-json-file"]').setInputFiles({
  name:'W15-stale-invalid.json',mimeType:'application/json',buffer:Buffer.from('[{"invalid":}')
 });
 await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
  ?.textContent?.startsWith('LFJ Worker FAILED'),null,{timeout:60000});
 rec.replacementStatus=await page.locator('[data-lfj-o1-status]').textContent();
 rec.staleExportControls=await page.locator('[data-lfj-o1-action^="export-"]').count();
 assert.equal(rec.staleExportControls,0,'replaced source must revoke old CSV');
 await page.locator('[data-action="download-node-wise-trace-csv"]').click().catch(()=>{});
 await page.waitForTimeout(400);
 assert.equal(rec.downloadEvents,before,'no stale downloaded CSV after invalid replacement');
 rec.frame=await page.evaluate(()=>({...window.__o1w15}));
 assert.ok(rec.frame.frames>100&&rec.frame.heartbeats>100,
  'actual browser UI remained scheduled throughout the long operation');
 rec.frameDiagnosticOnly=true;
 rec.pass=true;
 rec.result='JOINT_100MIB_2000000_SOURCE_DOMAIN_CSV_AND_REVOCATION_PROVEN';
}catch(e){
 rec.error=String(e.stack||e).slice(0,2200);
 rec.result='JOINT_BOUNDARY_NOT_PROVEN_OR_FAILED';
 try{rec.frame=await page?.evaluate(()=>({...window.__o1w15}));}catch{}
}finally{
 try{if(page&&!rec.frame)rec.frame=await page.evaluate(()=>({...window.__o1w15}));}catch{}
 rec.expectedCsv=protectedCsv;
 rec.completedAt=new Date().toISOString();
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W15-'+variant+'.json',JSON.stringify(rec,null,2)+'\n');
 console.log('LFJ226_O1_W15 '+JSON.stringify(rec));
 await browser?.close().catch(()=>{});
 if(created)await unlink(filePath).catch(()=>{});
 if(!rec.pass)process.exitCode=1;
}
