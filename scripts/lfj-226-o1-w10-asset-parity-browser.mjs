/**
 * TAB3-O1-W10, AIM 3DC-XML-CII v2.2.0.
 * True default-user root vs tracked docs vs GENERATED docs Chromium asset
 * graph. Explicitly NO Pages/deployed proof. Independent original SHA/CSV
 * oracle, plus real UI byte+count refusal and frame responsiveness witness.
 */
import assert from 'node:assert/strict';
import {readFile,open,truncate,unlink,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
const variant=process.env.W10_ROUTE||'root-raw';
assert.ok(['root-raw','docs-raw','docs-built'].includes(variant));
const route=variant==='root-raw'?'index.html':'docs/index.html';
const originalXml='Benchmarks/1885Sjson/FirstpassXML';
const originalJson='Benchmarks/1885Sjson/Sjson.json';
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected={json:'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288',
  node:{bytes:57945,sha256:'0d8bb4482ed4a9d0d116faeac5e68ce564f07b6bba2dd73dfc3676b72ec2eddc',rows:216},
  evidence:{bytes:50399,sha256:'653485ff968bf478fa0001488432bb210a9ce6e85a901e9cc19f368f53a24809',rows:241}};
assert.equal(hash(await readFile(originalJson)),expected.json,'authentic original Firstpass hash');
const record={schema:'LFJ226.O1.W10.ActualRouteAssetParity.v1',variant,route,
  exactHead:process.env.EXACT_HEAD||null,notLivePages:true,steps:[],requests:[],
  workers:[],downloads:[],failedRuntimeResponses:[],pageErrors:[],pass:false};
const browser=await chromium.launch({headless:true});
let page,byteFile,countFile;
record.downloadEvents=0;
const start=performance.now();
function note(phase,detail){record.steps.push({phase,atMs:Math.round(performance.now()-start),detail});}
async function prepareEdges(){
 byteFile='/tmp/lfj226-w10-byte-'+process.pid+'.json';
 countFile='/tmp/lfj226-w10-count-'+process.pid+'.json';
 // Admission must reject original bytes without parsing or foreground read.
 const fh=await open(byteFile,'w');await fh.close();
 await truncate(byteFile,104857601);
 const cf=await open(countFile,'w');
 try{
  await cf.write('[');
  let remaining=2000001;
  while(remaining>0){const n=Math.min(16000,remaining);
   await cf.write('0,'.repeat(n));remaining-=n;}
  // Replace trailing comma with valid last scalar and closing bracket.
  const size=(await cf.stat()).size;
  await cf.write(']',size-1);
  await cf.truncate(size);
 }finally{await cf.close();}
 record.edgeSource={byteOutBytes:104857601,countOutValues:2000001,
   countOutBytes:(await readFile(countFile)).length};
 assert.ok(record.edgeSource.countOutBytes<104857600);
}
async function committed(){
 await page.waitForFunction(()=>{
  const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return s.startsWith('LFJ source index COMMITTED')||s.startsWith('LFJ Worker FAILED');
 },null,{timeout:390000});
 return await page.locator('[data-lfj-o1-status]').textContent();
}
async function build(){
 await page.locator('[data-action="build-resolver-index"]').click();
 await page.waitForFunction(()=>{
  const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return s.startsWith('O1 matched trace source-path verified')||
    s.startsWith('O1 domain blocked')||s.startsWith('LFJ Worker FAILED');
 },null,{timeout:390000});
 return await page.locator('[data-lfj-o1-status]').textContent();
}
async function exportCsv(type){
 const [d]=await Promise.all([page.waitForEvent('download',{timeout:180000}),
   page.locator('[data-lfj-o1-action="export-'+type+'"]').click()]);
 const bytes=await readFile(await d.path());
 const meta={type,bytes:bytes.length,sha256:hash(bytes),
   rows:bytes.toString('utf8').split('\r\n').length-2,
   bom:bytes.subarray(0,3).toString('hex')};
 record.downloads.push(meta);
 assert.deepEqual({...meta},{type,...expected[type],bom:'efbbbf'},'complete independent original CSV');
}
async function refuse(file,code,label){
 await page.locator('[data-field="staged-json-file"]').setInputFiles(file,{timeout:390000});
 const status=await committed();
 assert.ok(status.startsWith('LFJ Worker FAILED')&&status.includes(code),
  label+' visible typed refusal required: '+status);
 assert.equal(await page.locator('[data-lfj-o1-action^="export-"]').count(),0,
  label+' must remove prior CSV export controls');
 const previous=record.downloadEvents;
 await page.locator('[data-action="download-node-wise-trace-csv"]').click().catch(()=>{});
 await page.waitForTimeout(350);
 assert.equal(record.downloadEvents,previous,'no stale browser download after refusal');
 record.steps.push({phase:label,code,status,zeroControls:true,
   atMs:Math.round(performance.now()-start)});
}
try{
 page=await browser.newPage({acceptDownloads:true});
 page.setDefaultTimeout(30000);
 page.on('worker',w=>record.workers.push(w.url()));
 page.on('download',()=>record.downloadEvents++);
 page.on('pageerror',e=>record.pageErrors.push(String(e).slice(0,350)));
 page.on('response',r=>{
  const url=r.url();
  if(url.startsWith('http://127.0.0.1:4173/')&&
      /\/(tabs|lfj|core)\//.test(url)){
   record.requests.push({url:url.replace('http://127.0.0.1:4173',''),status:r.status()});
   if(r.status()>=400)record.failedRuntimeResponses.push({url,status:r.status()});
  }
 });
 await page.addInitScript(()=>{
  const x={last:0,maxFrameGapMs:0,frames:0,clicks:0};
  const tick=t=>{if(x.last){x.frames++;x.maxFrameGapMs=Math.max(x.maxFrameGapMs,t-x.last);}
   x.last=t;requestAnimationFrame(tick);};
  requestAnimationFrame(tick);window.__w10=x;
 });
 const response=await page.goto('http://127.0.0.1:4173/'+route,{waitUntil:'domcontentloaded'});
 assert.equal(response?.status(),200);
 await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:45000});
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(originalXml);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-field="staged-json-file"]').waitFor();
 const checked=await page.locator('[data-lfj-o1-enable]').isChecked();
 assert.equal(checked,true,'fresh ordinary user must use Worker without opting in');
 note('default-checkbox',checked);
 await page.locator('[data-field="staged-json-file"]').setInputFiles(originalJson);
 const sourceStatus=await committed();
 assert.ok(sourceStatus.startsWith('LFJ source index COMMITTED')&&
   sourceStatus.includes(expected.json.slice(0,12)),'authentic committed original SHA');
 note('original-index',sourceStatus);
 const domainStatus=await build();
 assert.ok(domainStatus.startsWith('O1 matched trace source-path verified'),
  'authentic original path authority: '+domainStatus);
 note('original-domain',domainStatus);
 await exportCsv('node');await exportCsv('evidence');
 assert.ok(record.workers.some(s=>s.includes('source-browser-worker.mjs')));
 assert.ok(record.workers.some(s=>s.includes('lfj-o1-resolver-domain-worker.mjs')));
 assert.equal(record.failedRuntimeResponses.length,0,'no missing loaded runtime assets');
 await prepareEdges();
 await refuse(byteFile,'O1_SOURCE_BYTE_LIMIT','byte-out-revokes-old-CSV');
 // Reload authentic original before second refusal to expose a second stale-rights path.
 await page.locator('[data-field="staged-json-file"]').setInputFiles(originalJson);
 assert.ok((await committed()).startsWith('LFJ source index COMMITTED'));
 assert.ok((await build()).startsWith('O1 matched trace source-path verified'));
 assert.equal(await page.locator('[data-lfj-o1-action^="export-"]').count(),2);
 await refuse(countFile,'OCCURRENCE_LIMIT','count-out-revokes-old-CSV');
 record.frame=await page.evaluate(()=>({...window.__w10}));
 record.pass=record.frame.frames>0&&record.pageErrors.length===0;
 record.result=record.pass?'SUPPORTED_ENTRY_FULL_O1_AND_REFUSALS':'NOT_PROVEN';
}catch(e){
 record.error=String(e.stack||e).slice(0,1700);
 record.result='SUPPORTED_ENTRY_RED_OR_NOT_PROVEN';
}finally{
 try{record.frame??=await page?.evaluate(()=>({...window.__w10}));}catch{}
 record.durationMs=Math.round(performance.now()-start);
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W10-'+variant+'.json',JSON.stringify(record,null,2)+'\n');
 console.log('LFJ226_O1_W10 '+JSON.stringify(record));
 await browser.close().catch(()=>{});
 if(byteFile)await unlink(byteFile).catch(()=>{});
 if(countFile)await unlink(countFile).catch(()=>{});
 if(!record.pass)process.exitCode=1;
}