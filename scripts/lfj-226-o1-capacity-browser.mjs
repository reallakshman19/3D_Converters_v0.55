/**
 * O1 W03 generated-capacity ONLY (never substitute shaped data for an
 * independent original XML semantic golden). Actual authored app, Chromium,
 * native Worker, full committed original source index and selected CSV path.
 * Every case runs alone in one matrix worker to isolate memory/cancellation.
 */
import {readFile,open,mkdir,writeFile,stat,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const sizeMiB=Number(process.env.O1_CAPACITY_MIB||30);
const shape=process.env.O1_CAPACITY_SHAPE||'repeated-firstpass';
assert.ok(['repeated-firstpass','byte-heavy'].includes(shape),'known capacity shape required');
assert.ok([30,60,100].includes(sizeMiB),'only authorized proposed capacity sizes');
const target=sizeMiB*1048576;
const original=await readFile('Benchmarks/1885Sjson/Sjson.json','utf8');
const originalSha=createHash('sha256').update(original).digest('hex');
const fragment=original.trim().slice(1,-1);
const filePath='/tmp/lfj226-o1-proposed-'+sizeMiB+'MiB.json';
const file=await open(filePath,'w');
const digest=createHash('sha256');let bytes=0,copies=0;
async function append(part){const b=Buffer.from(part);await file.write(b);digest.update(b);bytes+=b.byteLength;}
try{
 await append('[');
 if(shape==='byte-heavy'){
   // One real Firstpass semantic fragment plus nonsemantic 32KiB JSON scalar
   // padding. Original XML evidence remains the sole matching authority.
   // This deliberately tests BYTE CAPACITY below the 2M-occurrence fence.
   await append(fragment);copies=1;
   while(target-bytes-1>3){
     const n=Math.min(32768,target-bytes-1-3);
     await append(',"'+'x'.repeat(n)+'"');
   }
 }else{
   // Stress event cardinality independently of byte volume.
   while(bytes+Buffer.byteLength(fragment)+2<=target){
     if(copies)await append(',');
     await append(fragment);copies++;
   }
 }
 await append(']');
}finally{await file.close();}
const sourceSha256=digest.digest('hex');
const data={schema:'LFJ226.O1.CapacityEvidence.v1',status:'NOT_RUN',targetMiB:sizeMiB,
  generated:true,notSemanticGolden:true,shape,originalFixtureSha256:originalSha,
  originalXmlFile:'Benchmarks/1885Sjson/FirstpassXML',sourceSha256,bytes,copies,
  capacityPolicy:'OWNER D-AIM-2 Option A: bytes<=104857600 AND originals<=2000000; typed refusal beyond either. 200ms rAF is diagnostic only',
  memoryQualification:'CDP page/renderer heaps and sampled aggregate Chromium process RSS; not peak',
  estimatedOriginalOccurrences:shape==='repeated-firstpass'?1+copies*23753:null,
  expectedResult:shape==='repeated-firstpass'&&1+copies*23753>2000000?
    'REFUSE_OCCURRENCE_LIMIT':'TRACE_AND_EXPORT',
  steps:[],memory:{maxObservedPageHeapBytes:0,maxRendererHeapBytes:0,
    maxChromiumProcessRssKiB:0},pass:false};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true});
const cdp=await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
page.on('pageerror',error=>(data.pageErrors??=[]).push(String(error).slice(0,300)));
let lastStep=null;
async function sample(){
 try{
  const m=await cdp.send('Performance.getMetrics');
  const heap=m.metrics.find(x=>x.name==='JSHeapUsedSize')?.value||0;
  data.memory.maxRendererHeapBytes=Math.max(data.memory.maxRendererHeapBytes,heap);
 }catch{}
 try{const pageHeap=await page.evaluate(()=>performance.memory?.usedJSHeapSize||0);
  data.memory.maxObservedPageHeapBytes=Math.max(data.memory.maxObservedPageHeapBytes,pageHeap);
 }catch{}
 try{
  // RSS is a sampled *aggregate* of Chromium processes, not a true peak or
  // a single Worker heap. Each matrix job runs in its own hosted runner.
  const lines=execFileSync('ps',['-eo','rss=,comm='],
    {encoding:'utf8',timeout:1800}).trim().split('\n');
  let rss=0;
  for(const line of lines){
   const row=line.trim().match(/^(\d+)\s+(\S+)/);
   if(row&&/^(chrome|chromium|headless_shell|chrome-headless)/.test(row[2]))
    rss+=Number(row[1]);
  }
  data.memory.maxChromiumProcessRssKiB=
   Math.max(data.memory.maxChromiumProcessRssKiB,rss);
 }catch{}
}
const memoryTimer=setInterval(()=>{void sample();},750);
async function stage(name,action){
 const start=performance.now();const item={name,status:'RUNNING'};
 data.steps.push(item);lastStep=item;
 try{await page.evaluate(()=>window.__lfj226Metrics.start());}catch{}
 try{await action();item.status='PASS';}catch(e){
  item.status='FAIL';item.error=String(e).slice(0,400);
 }
 item.wallMs=Math.round(performance.now()-start);
 try{item.frame=await page.evaluate(()=>window.__lfj226Metrics.stop());}catch{}
 await sample();return item.status==='PASS';
}
try{
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',
   {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(data.originalXmlFile);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-lfj-o1-enable]').check();
 const intakeOK=await stage('native-original-byte-worker-committed-index',async()=>{
  await page.locator('[data-field="staged-json-file"]').setInputFiles(filePath);
  await page.waitForFunction(sha=>{
   const t=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
   return t.startsWith('LFJ Worker FAILED')||
     t.startsWith('LFJ source index COMMITTED')&&t.includes(sha.slice(0,12));
  },sourceSha256,{timeout:210000});
 });
 data.intakeStatus=await page.locator('[data-lfj-o1-status]').textContent();
 data.sourceCommitted=intakeOK&&data.intakeStatus.includes('COMMITTED')&&
   data.intakeStatus.includes(sourceSha256.slice(0,12));
 if(data.sourceCommitted){
  const matchOK=await stage('independent-xml-matched-worker-source-paths',async()=>{
   await page.locator('[data-action="build-resolver-index"]').click();
   await page.waitForFunction(()=>{
    const t=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return t.startsWith('O1 matched trace source-path verified')||
      t.startsWith('O1 domain blocked')||t.startsWith('O1 Worker FAILED');
   },null,{timeout:210000});
  });
  data.matchStatus=await page.locator('[data-lfj-o1-status]').textContent();
  data.domainReady=matchOK&&data.matchStatus.startsWith('O1 matched trace source-path verified');
  if(data.domainReady){
   const panel=await page.locator('[data-lfj-o1-trace-status]').textContent();
   data.panel=panel;
   data.visibleRows=await page.locator('[data-lfj-o1-table] tbody tr').count();
   for(const type of ['node','evidence']){
    const ok=await stage('complete-original-builder-'+type+'-csv',async()=>{
     const [download]=await Promise.all([
      page.waitForEvent('download',{timeout:150000}),
      page.locator('[data-lfj-o1-action="export-'+type+'"]').click()
     ]);
     const downloadBytes=await readFile(await download.path());
     data[type+'Csv']={bytes:downloadBytes.length,
      sha256:createHash('sha256').update(downloadBytes).digest('hex'),
      header:downloadBytes.subarray(0,3).toString('hex'),
      rows:downloadBytes.toString('utf8').split('\r\n').length-2};
    });
    if(!ok)break;
   }
  }
 }
 const maxGap=Math.max(0,...data.steps.map(x=>x.frame?.maxFrameGapMs||0));
 data.maxMeasuredFrameGapMs=maxGap;
 data.proposedFrameBudgetPassed=maxGap<=200;
 if(data.expectedResult==='REFUSE_OCCURRENCE_LIMIT'){
  data.typedRefusalObserved=!!(data.intakeStatus?.startsWith('LFJ Worker FAILED: OCCURRENCE_LIMIT'));
  data.refusedNoOutputControls=await page.locator('[data-lfj-o1-action^="export-"]').count()===0;
  data.pass=!!(data.typedRefusalObserved&&!data.sourceCommitted&&
    !data.domainReady&&!data.nodeCsv&&!data.evidenceCsv&&
    data.refusedNoOutputControls&&maxGap<=200);
  data.status=data.pass?'EXPECTED_OWNER_POLICY_REFUSAL':'POLICY_REFUSAL_NOT_PROVEN';
 }else{
  data.pass=!!(data.sourceCommitted&&data.domainReady&&data.nodeCsv?.rows>0&&
    data.evidenceCsv?.rows>0&&data.visibleRows<=64&&maxGap<=200);
  data.status=data.pass?'IN_RANGE_TRACE_AND_EXPORT_PROVEN':'CAPACITY_NOT_PROVEN';
 }
 console.log('LFJ226_GENERATED_CAPACITY '+JSON.stringify(data));
 if(!data.pass)process.exitCode=1;
}finally{
 clearInterval(memoryTimer);
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-capacity-'+sizeMiB+'MiB-'+shape+'.json',JSON.stringify(data,null,2)+'\n');
 await browser.close();await unlink(filePath).catch(()=>{});
}
