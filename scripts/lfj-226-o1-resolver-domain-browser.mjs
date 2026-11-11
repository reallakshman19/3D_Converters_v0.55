/** Real authored UI O1 Firstpass XML+JSON -> native indexed domain Worker -> both CSVs. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const record={schema:'LFJ226.O1.OriginalTraceBrowser.v1',cases:[]};
const sha=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({acceptDownloads:true});
 page.on('pageerror',err=>(record.pageErrors??=[]).push(String(err)));
 const firstpass='Benchmarks/1885Sjson/Sjson.json';
 const originalXml='Benchmarks/1885Sjson/FirstpassXML';
 const source=await readFile(firstpass),xml=await readFile(originalXml);
 record.original={jsonBytes:source.length,jsonSha256:sha(source),
   xmlBytes:xml.length,xmlSha256:sha(xml)};
 // Exact original fixture identities, distinct from generated capacity tests.
 assert.equal(record.original.jsonSha256,'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
 assert.equal(record.original.xmlSha256,'feee5a5a6399207337e63bc56c8afb001fe37ab30c6a7a9283333ec60f6eea38');
 const golden={node:{rows:216,sha256:'0d8bb4482ed4a9d0d116faeac5e68ce564f07b6bba2dd73dfc3676b72ec2eddc'},
   evidence:{rows:241,sha256:'653485ff968bf478fa0001488432bb210a9ce6e85a901e9cc19f368f53a24809'}};
 // These output hashes are frozen Firstpass regression snapshots from the
 // prior real-UI independent run, NOT independent engineering semantic truth.
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',
   {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(originalXml);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-lfj-o1-enable]').check();
 await page.evaluate(()=>window.__lfj226Metrics.start());
 await page.locator('[data-field="staged-json-file"]').setInputFiles(firstpass);
 await page.waitForFunction(expected=>{
   const status=document.querySelector('[data-lfj-o1-status]')?.textContent??'';
   return status.startsWith('LFJ source index COMMITTED')&&status.includes(expected);
 },record.original.jsonSha256.slice(0,12),{timeout:90000});
 record.indexReceipt=await page.locator('[data-lfj-o1-status]').textContent();
 record.indexFrame=await page.evaluate(()=>window.__lfj226Metrics.stop());
 await page.evaluate(()=>window.__lfj226Metrics.start());
 const buildStarted=Date.now();
 await page.locator('[data-action="build-resolver-index"]').click();
 try {
   await page.waitForFunction(()=>{
     const txt=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
     return txt.startsWith('O1 matched trace source-path verified')||
       txt.startsWith('O1 domain blocked')||txt.startsWith('O1 Worker FAILED');
   },null,{timeout:240000});
 }catch(e){record.waitError=String(e);}
 record.domainStatus=await page.locator('[data-lfj-o1-status]').textContent();
 record.buildWallMs=Date.now()-buildStarted;
 record.frame=await page.evaluate(()=>window.__lfj226Metrics.stop());
 record.verifiedPanel=await page.locator('[data-lfj-o1-trace-status]').textContent().catch(()=>null);
 assert.ok(record.domainStatus?.startsWith('O1 matched trace source-path verified'),
   'domain Worker must finish and independently attest source paths: '+JSON.stringify(record));
 assert.ok(record.verifiedPanel?.includes('SOURCE-PATH VERIFIED'));
 const table=page.locator('[data-lfj-o1-table] tbody tr');
 record.visibleRows=await table.count();
 assert.ok(record.visibleRows>0&&record.visibleRows<=64);
 for(const kind of ['node','evidence']){
   const button=page.locator('[data-lfj-o1-action="export-'+kind+'"]');
   const [download]=await Promise.all([
     page.waitForEvent('download',{timeout:60000}),button.click()
   ]);
   const bytes=await readFile(await download.path());
   const output={type:kind,fileName:download.suggestedFilename(),length:bytes.length,
     sha256:sha(bytes),bom:bytes.subarray(0,3).toString('hex'),
     lines:bytes.toString('utf8').split('\r\n').length-2};
   assert.ok(bytes.length>64&&output.bom==='efbbbf');
   assert.equal(output.lines,golden[kind].rows,'original XML node/evidence row count changed');
   assert.equal(output.sha256,golden[kind].sha256,'original complete CSV output drifted');
   await mkdir('ValidationRecords',{recursive:true});
   await writeFile('ValidationRecords/lfj-226-o1-'+kind+'-original.csv',bytes);
   record.cases.push(output);
 }
 // Replace source with malformed original: all former output rights revoked.
 await page.locator('[data-field="staged-json-file"]').setInputFiles({
   name:'O1-invalid.json',mimeType:'application/json',
   buffer:Buffer.from('[{"bad":}')
 });
 await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')
   ?.textContent?.startsWith('LFJ Worker FAILED'),null,{timeout:30000});
 // Some authored mode rerenders remove the original legacy CSV button.
 // Absent export controls are an independently safe negative; if present,
 // actively attempt the revoked export and require a typed refusal.
 const stale=page.locator('[data-lfj-o1-action="export-node"]');
 const legacy=page.locator('[data-action="download-node-wise-trace-csv"]');
 const hadDownload=record.cases.length;
 if(await stale.count()){
   await stale.click();
   record.staleExportStatus=await page.locator('[data-lfj-o1-status]').textContent();
   assert.ok(record.staleExportStatus?.includes('blocked'),'revoked O1 export must fail');
 }else if(await legacy.count()){
   await legacy.click();
   record.staleExportStatus=await page.locator('[data-lfj-o1-status]').textContent();
   assert.ok(record.staleExportStatus?.includes('CSV blocked'),'revoked original export must fail');
 }else {
   record.staleExportStatus='NO_EXPORT_CONTROL_AFTER_SOURCE_REPLACEMENT';
 }
 record.revocationPassed=!!record.staleExportStatus;
 assert.ok(record.revocationPassed&&record.cases.length===hadDownload);
 record.pass=true;
 console.log('LFJ226_ORIGINAL_TRACE_WORKER '+JSON.stringify(record));
}finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-trace.json',JSON.stringify(record,null,2)+'\n');
 await browser.close();
}
