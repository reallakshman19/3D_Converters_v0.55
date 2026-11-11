/**
 * TAB3-O1-W04 / AIM v2.2.0: source-policy boundary diagnostic only.
 * Actual authored UI, native source+domain Workers, IndexedDB, two full CSVs.
 * Generated edge inputs are capacity oracles, NOT independent semantic goldens.
 * Does not alter, waive, or redefine any product or C05 acceptance policy.
 */
import assert from 'node:assert/strict';
import {open,readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';

const kind=process.env.O1_EDGE_KIND||'byte-in';
assert.ok(['byte-in','byte-out','count-in','count-out'].includes(kind));
const expectAdmit=kind.endsWith('-in');
const isByte=kind.startsWith('byte-');
const firstpass='Benchmarks/1885Sjson/Sjson.json';
const xmlFile='Benchmarks/1885Sjson/FirstpassXML';
const original=await readFile(firstpass,'utf8');
const fragment=original.trim().slice(1,-1);
const originalHash=createHash('sha256').update(original).digest('hex');
assert.equal(originalHash,'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
const target=isByte?(104857600+(kind==='byte-out'?1:0)):null;
const expectedCount=isByte?null:(kind==='count-in'?2000000:2000001);
const filePath='/tmp/lfj226-o1-W04-'+kind+'-'+process.pid+'.json';
const fh=await open(filePath,'w');
const sha=createHash('sha256');
let bytes=0;
async function append(s){
 const b=Buffer.from(s);
 await fh.write(b);
 sha.update(b);
 bytes+=b.length;
}
try{
 await append('[');
 await append(fragment);
 if(isByte){
  // 32KiB non-semantic string values: under R04 64KiB token budget.
  while(target-bytes-1>3){
   const n=Math.min(32768,target-bytes-1-3);
   await append(',"'+'x'.repeat(n)+'"');
  }
 }else{
  // Original fragment has 23,753 values without its array root; new array
  // retains one root, giving 23,754 real original values before padding.
  // Every appended scalar zero contributes exactly one original occurrence.
  const extra=expectedCount-23754;
  const group=',0'.repeat(8192);
  let remaining=extra;
  while(remaining>=8192){
   await append(group);
   remaining-=8192;
  }
  if(remaining)await append(',0'.repeat(remaining));
 }
 await append(']');
}finally{await fh.close();}
const sourceSha=sha.digest('hex');
if(isByte)assert.equal(bytes,target,'exact byte edge generator drift');
else assert.ok(bytes<=104857600,'count edge must be within Owner byte cap');
const record={schema:'LFJ226.O1.W04.PolicyEdge.v1',kind,generated:true,
 notSemanticGolden:true,ownerPolicy:{maxBytes:104857600,maxOccurrences:2000000,
 inRangeInclusive:true,noOwnerNumericFrameCeiling:true},expectedAdmit:expectAdmit,
 expectedCount,bytes,sourceSha256:sourceSha,originalSha256:originalHash,
 steps:[],downloads:[],observed:{},pass:false};
const browser=await chromium.launch({headless:true});
let page;
let downloads=0;
const timeout=390000;
function step(name,value){record.steps.push({name,atMs:Math.round(performance.now()),value});}
try{
 page=await browser.newPage({acceptDownloads:true});
 page.on('download',()=>downloads++);
 page.on('pageerror',e=>(record.pageErrors??=[]).push(String(e).slice(0,300)));
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(xmlFile);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-lfj-o1-enable]').check();
 // Over-byte refusal must also revoke a PREVIOUSLY AUTHORIZED user export.
 if(kind==='byte-out'){
  await page.locator('[data-field="staged-json-file"]').setInputFiles(firstpass);
  await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
   ?.textContent?.startsWith('LFJ source index COMMITTED'),null,{timeout:90000});
  await page.locator('[data-action="build-resolver-index"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
   ?.textContent?.startsWith('O1 matched trace source-path verified'),null,{timeout:90000});
  const [oldDownload]=await Promise.all([
   page.waitForEvent('download',{timeout:60000}),
   page.locator('[data-lfj-o1-action="export-node"]').click()
  ]);
  record.observed.priorAuthorizedCsvBytes=(await readFile(await oldDownload.path())).length;
  assert.ok(record.observed.priorAuthorizedCsvBytes>64,
   'previous source was entitled to download before oversized replacement');
 }
 await page.evaluate(()=>window.__lfj226Metrics.start());
 const started=performance.now();
 await page.locator('[data-field="staged-json-file"]').setInputFiles(filePath);
 await page.waitForFunction(()=>{
  const t=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return t.startsWith('LFJ Worker FAILED')||
    t.startsWith('LFJ source index COMMITTED');
 },null,{timeout});
 record.observed.intakeMs=Math.round(performance.now()-started);
 record.observed.intakeStatus=await page.locator('[data-lfj-o1-status]').textContent();
 const receipt=record.observed.intakeStatus;
 record.observed.committed=receipt.startsWith('LFJ source index COMMITTED');
 record.observed.refused=receipt.startsWith('LFJ Worker FAILED');
 record.observed.hashInReceipt=receipt.includes(sourceSha.slice(0,12));
 const countMatch=receipt.match(/COMMITTED:\s*(\d+)\s+original occurrences/);
 record.observed.committedCount=countMatch?Number(countMatch[1]):null;
 step('source',record.observed);
 if(record.observed.committed){
  await page.locator('[data-action="build-resolver-index"]').click();
  await page.waitForFunction(()=>{
   const t=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
   return t.startsWith('O1 matched trace source-path verified')||
    t.startsWith('O1 domain blocked')||t.startsWith('O1 Worker FAILED');
  },null,{timeout});
  record.observed.domainStatus=await page.locator('[data-lfj-o1-status]').textContent();
  record.observed.domainReady=record.observed.domainStatus.startsWith('O1 matched trace source-path verified');
  record.observed.domainMs=Math.round(performance.now()-started-record.observed.intakeMs);
  if(record.observed.domainReady){
   record.observed.panel=await page.locator('[data-lfj-o1-trace-status]').textContent();
   record.observed.visibleRows=await page.locator('[data-lfj-o1-table] tbody tr').count();
   for(const type of ['node','evidence']){
    const [dl]=await Promise.all([
     page.waitForEvent('download',{timeout:180000}),
     page.locator('[data-lfj-o1-action="export-'+type+'"]').click()
    ]);
    const csv=await readFile(await dl.path());
    const result={type,bytes:csv.length,sha256:createHash('sha256').update(csv).digest('hex'),
      bom:csv.subarray(0,3).toString('hex'),
      rows:csv.toString('utf8').split('\r\n').length-2};
    record.downloads.push(result);
   }
  }
 }
 if(!expectAdmit){
  record.observed.outputControls=await page.locator('[data-lfj-o1-action^="export-"]').count();
  if(record.observed.refused){
   const before=downloads;
   const legacy=page.locator('[data-action="download-node-wise-trace-csv"]');
   if(await legacy.count()){
    await legacy.click();
    record.observed.exportDenial=await page.locator('[data-lfj-o1-status]').textContent();
   }
   record.observed.unexpectedDownloads=downloads-before;
  }
 }else if(record.observed.domainReady){
  // Replacing a known exported source must revoke prior download rights.
  const before=downloads;
  await page.locator('[data-field="staged-json-file"]').setInputFiles({
   name:'W04-replaced-invalid.json',mimeType:'application/json',
   buffer:Buffer.from('[{"bad":}')
  });
  await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
   ?.textContent?.startsWith('LFJ Worker FAILED'),null,{timeout:60000});
  const stale=page.locator('[data-lfj-o1-action="export-node"]');
  const legacy=page.locator('[data-action="download-node-wise-trace-csv"]');
  if(await stale.count())await stale.click();
  else if(await legacy.count())await legacy.click();
  record.observed.replacedStatus=await page.locator('[data-lfj-o1-status]').textContent();
  record.observed.revokedNoDownload=(downloads===before);
 }
 record.observed.frame=await page.evaluate(()=>window.__lfj226Metrics.stop());
 record.observed.maxFrameGapMs=record.observed.frame.maxFrameGapMs;
 const fullCsv=record.downloads.length===2&&record.downloads.every(d=>d.rows>0&&
  d.bom==='efbbbf'&&d.bytes>64);
 const countCorrect=isByte?record.observed.committedCount!==null&&
  record.observed.committedCount<=2000000:
  record.observed.committedCount===expectedCount;
 if(expectAdmit){
  record.pass=!!(record.observed.committed&&record.observed.hashInReceipt&&
   countCorrect&&record.observed.domainReady&&fullCsv&&
   record.observed.visibleRows>0&&record.observed.visibleRows<=64&&
   record.observed.revokedNoDownload);
 }else{
  const typed=kind==='count-out'?'OCCURRENCE_LIMIT':'O1_SOURCE_BYTE_LIMIT';
  record.observed.expectedTypedFailure=typed;
  record.pass=!!(record.observed.refused&&receipt.includes(typed)&&
    !record.observed.committed&&record.downloads.length===0&&
    record.observed.outputControls===0&&record.observed.unexpectedDownloads===0);
 }
 record.observed.frameResponsiveDiagnostic=record.observed.frame?.frames>0&&
  record.observed.maxFrameGapMs<=200; // proposal ONLY; not Owner policy.
 if(!record.observed.frameResponsiveDiagnostic)record.pass=false;
 record.status=record.pass?'EXPECTED_OWNER_POLICY_OBSERVED':'BOUNDARY_NOT_PROVEN_OR_VIOLATED';
}catch(e){
 record.error=String(e).slice(0,1000);
 record.status='DIAGNOSTIC_FAILED';
 record.pass=false;
 try{record.observed.frame=await page?.evaluate(()=>window.__lfj226Metrics.stop());}catch{}
}finally{
 console.log('LFJ226_O1_W04_EDGE '+JSON.stringify(record));
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W04-'+kind+'.json',
  JSON.stringify(record,null,2)+'\n');
 await browser.close();
 await unlink(filePath).catch(()=>{});
 if(!record.pass)process.exitCode=1;
}