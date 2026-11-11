/**
 * TAB3-O1-W07 / AIM v2.2.0: real default (unchecked) vs opted-in
 * original XML/JSON user path, root/docs, and combined in-range envelope.
 * This is a diagnostic. A green legacy foreground CSV is NOT worker acceptance.
 */
import assert from 'node:assert/strict';
import {readFile,open,mkdir,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';

const mode=process.env.W07_CASE||'default-root';
assert.ok(['default-root','default-docs','optin-root','optin-docs','combined-optin'].includes(mode));
// W07 baseline used unchecked=false. W09 repeats the identical authored
// five-case oracle with ordinary default Worker adoption required.
const adoptedDefault=process.env.W07_DEFAULT_ADOPTION==='1';
const explicitlyOpted=mode.startsWith('optin')||mode==='combined-optin';
const opted=explicitlyOpted||adoptedDefault;
const route=mode.endsWith('docs')?'docs/index.html':'index.html';
const xml='Benchmarks/1885Sjson/FirstpassXML';
const json='Benchmarks/1885Sjson/Sjson.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const original=await readFile(json);
assert.equal(sha(original),'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
const expected={node:{bytes:57945,hash:'0d8bb4482ed4a9d0d116faeac5e68ce564f07b6bba2dd73dfc3676b72ec2eddc'},evidence:{bytes:50399,hash:'653485ff968bf478fa0001488432bb210a9ce6e85a901e9cc19f368f53a24809'}};
const result={schema:'LFJ226.O1.W07.DefaultRoute.v1',case:mode,route,head:process.env.EXACT_HEAD||null,
  ownerBound:{bytes:104857600,occurrences:2000000},generated:mode==='combined-optin',
  generatedIsNotSemanticGolden:true,expectedWorker:opted,steps:[],downloads:[],workers:[],
  memory:{sampledChromiumAggregateRssKiB:0,sampledRendererJsHeapBytes:0,notTruePeak:true},
  outcome:'NOT_RUN',pass:false};
let file=json,generated=null,generatedSize=0,generatedOccurrences=null,generatedHash=null;
if(mode==='combined-optin'){
  file='/tmp/lfj226-o1-w07-combined-'+process.pid+'.json';
  generated=file;
  const fh=await open(file,'w');
  const hash=createHash('sha256');
  let bytes=0,pads=0;
  async function append(s){const b=Buffer.from(s);await fh.write(b);hash.update(b);bytes+=b.length;}
  try{
    const f=original.toString('utf8').trim().slice(1,-1);
    await append('[');await append(f);
    let left=1850000;
    while(left){const n=Math.min(8192,left);await append(',0'.repeat(n));left-=n;}
    while(104857600-bytes-1>=4){
      const n=Math.min(32768,104857600-bytes-1-3);
      await append(',"'+'x'.repeat(n)+'"');pads++;
    }
    await append(' '.repeat(104857600-bytes-1));
    await append(']');
  }finally{await fh.close();}
  generatedSize=bytes;generatedOccurrences=23754+1850000+pads;generatedHash=hash.digest('hex');
  assert.equal(generatedSize,104857600);
  assert.ok(generatedOccurrences<=2000000);
  result.generatedInput={bytes:generatedSize,originalOccurrences:generatedOccurrences,sha256:generatedHash,
    shape:'real Firstpass fragment + 1850000 scalar zeros + large string value padding'};
}
const browser=await chromium.launch({headless:true});
let page,cdp,ticker;
const started=performance.now();
async function sample(){
  try{
    const m=await cdp.send('Performance.getMetrics');
    result.memory.sampledRendererJsHeapBytes=Math.max(result.memory.sampledRendererJsHeapBytes,
      m.metrics.find(x=>x.name==='JSHeapUsedSize')?.value||0);
  }catch{}
  try{
    const rss=execFileSync('ps',['-eo','rss=,comm='],{encoding:'utf8',timeout:2000}).split('\n')
      .reduce((n,l)=>{const x=l.trim().match(/^(\d+)\s+(\S+)/);return x&&/^(chrome|chromium|headless_shell|chrome-headless)/.test(x[2])?n+Number(x[1]):n;},0);
    result.memory.sampledChromiumAggregateRssKiB=Math.max(result.memory.sampledChromiumAggregateRssKiB,rss);
  }catch{}
}
async function step(name,action){
  const x={name,startedMs:Math.round(performance.now()-started)};
  result.steps.push(x);
  try{await action();x.state='PASS';}catch(e){x.state='FAIL';x.error=String(e).slice(0,500);}
  x.endedMs=Math.round(performance.now()-started);
  await sample();
  return x.state==='PASS';
}
async function take(type,button){
  const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator(button).click()]);
  const b=await readFile(await d.path());
  const item={type,bytes:b.length,sha256:sha(b),bom:b.subarray(0,3).toString('hex'),
    rows:b.toString('utf8').split('\r\n').length-2};
  result.downloads.push(item);
  return item;
}
try{
  page=await browser.newPage({acceptDownloads:true});
  page.setDefaultTimeout(25000);
  page.on('worker',w=>result.workers.push(w.url()));
  page.on('pageerror',e=>(result.errors??=[]).push(String(e).slice(0,400)));
  await page.addInitScript(()=>{
    const m={running:true,frames:0,maxFrameGapMs:0,last:0};
    const tick=t=>{if(m.last&&m.running){m.frames++;m.maxFrameGapMs=Math.max(m.maxFrameGapMs,t-m.last);}
      m.last=t;requestAnimationFrame(tick);};
    requestAnimationFrame(tick);window.__w07Frames=m;
  });
  cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable').catch(()=>{});
  ticker=setInterval(()=>void sample(),2000);
  if(await step('real-root-or-generated-docs-nav',async()=>{
    const response=await page.goto('http://127.0.0.1:4173/'+route,{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:45000});
    await page.locator('[data-phase="source"]').waitFor({timeout:45000});
    await page.locator('[data-phase="source"]').click();
    await page.locator('[data-field="source-file"]').setInputFiles(xml);
    await page.locator('[data-phase="json-trace"]').click();
    await page.locator('[data-field="staged-json-file"]').waitFor();
    result.optInInitially=await page.locator('[data-lfj-o1-enable]').isChecked();
    assert.equal(result.optInInitially,adoptedDefault,'ordinary user Worker default matches expected adoption');
    if(explicitlyOpted)await page.locator('[data-lfj-o1-enable]').check();
  })){
    await step('authored-original-JSON-file-upload',async()=>{
      await page.locator('[data-field="staged-json-file"]').setInputFiles(file,{timeout:240000});
      if(opted){
        await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
          return s.startsWith('LFJ source index COMMITTED')||s.startsWith('LFJ Worker FAILED');},
          null,{timeout:240000});
      }else{
        await page.waitForTimeout(1700);
      }
      result.sourceStatus=await page.locator('[data-lfj-o1-status]').textContent();
      result.sawSourceWorker=result.workers.some(w=>w.includes('source-browser-worker.mjs'));
    });
    await step('real-user-Build-and-CSV',async()=>{
      await page.locator('[data-action="build-resolver-index"]').click({timeout:240000});
      if(opted){
        await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
          return s.startsWith('O1 matched trace source-path verified')||
            s.startsWith('O1 domain blocked')||s.startsWith('LFJ Worker FAILED');},
          null,{timeout:240000});
        result.domainStatus=await page.locator('[data-lfj-o1-status]').textContent();
        if(result.domainStatus.startsWith('O1 matched trace source-path verified')){
          await take('node','[data-lfj-o1-action="export-node"]');
          await take('evidence','[data-lfj-o1-action="export-evidence"]');
        }
      }else{
        await page.waitForTimeout(250);
        result.domainStatus=await page.locator('[data-lfj-o1-status]').textContent();
        for(const [type,selector] of [['node','[data-action="download-node-wise-trace-csv"]'],
          ['evidence','[data-action="download-evidence-tree-csv"]']]){
          try{await take(type,selector);}catch(e){result.downloadErrors??=[];result.downloadErrors.push(String(e).slice(0,250));}
        }
      }
    });
  }
  result.frame=await page.evaluate(()=>({...window.__w07Frames})).catch(()=>null);
  result.workerProof={
    source:result.workers.some(w=>w.includes('source-browser-worker.mjs')),
    domain:result.workers.some(w=>w.includes('lfj-o1-resolver-domain-worker.mjs')),
    committed:result.sourceStatus?.includes('COMMITTED')||false,
    matched:result.domainStatus?.startsWith('O1 matched trace source-path verified')||false
  };
  result.completeCsv=result.downloads.length===2&&result.downloads.every(d=>d.bytes>64&&d.bom==='efbbbf'&&d.rows>0);
  result.originalRegression=mode==='combined-optin'?null:result.completeCsv&&result.downloads.every(d=>
    d.bytes===expected[d.type].bytes&&d.sha256===expected[d.type].hash);
  result.meetsUserO1=!!(result.workerProof.source&&result.workerProof.domain&&
    result.workerProof.committed&&result.workerProof.matched&&result.completeCsv&&
    (mode==='combined-optin'||result.originalRegression));
  result.pass=result.meetsUserO1;
  result.outcome=result.pass?'USER_WORKER_TRACE_CONFIRMED':'USER_ROUTE_NOT_PROVEN_OR_FAILED';
}catch(e){result.outcome='TEST_OR_ROUTE_ERROR';result.error=String(e).slice(0,600);}
finally{
  clearInterval(ticker);
  await sample();
  result.durationMs=Math.round(performance.now()-started);
  await mkdir('ValidationRecords',{recursive:true});
  await writeFile('ValidationRecords/lfj-226-o1-W07-'+mode+'.json',JSON.stringify(result,null,2)+'\n');
  console.log('LFJ226_O1_W07 '+JSON.stringify(result));
  await browser.close().catch(()=>{});
  if(generated)await unlink(generated).catch(()=>{});
}
if(!result.pass)process.exitCode=1;
