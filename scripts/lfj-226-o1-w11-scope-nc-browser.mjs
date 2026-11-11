/**
 * TAB3-O1-W11 — real default single-PSI116 scope-admission discriminator.
 * Test original browser workflow, no synthetic scope or NC semantic golden.
 * Source-indexed Worker path must never be made main-thread stagedJsonText.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {buildJsonHierarchyScopeIndex} from '../tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js';

const mode=process.env.W11_CASE||'root';
assert.ok(['root','docs-raw'].includes(mode));
const route=mode==='root'?'index.html':'docs/index.html';
const json='Benchmarks/1885Sjson/Sjson.json';
const xml='Benchmarks/1885Sjson/FirstpassXML';
const sha=b=>createHash('sha256').update(b).digest('hex');
const data=await readFile(json);
assert.equal(sha(data),'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
const index=buildJsonHierarchyScopeIndex(data.toString('utf8')); // Node test oracle only; never foreground app
const ncXml=await readFile('Benchmarks/1885_NC/1885_NC.topology.input.xml');
const record={schema:'LFJ226.O1.W11.ScopeAndNcDiscriminator.v1',head:process.env.EXACT_HEAD||null,
 mode,route,originalSha:sha(data),scopeSource:{indexable:index.indexable,
  itemCount:index.itemCount,scopeCount:index.scopes?.length,
  ids:index.scopes?.slice(0,8).map(s=>s.id),explicitNonAll:index.scopes?.filter(s=>s.id!=='__ALL__').length},
 nc:{originalTopologyInputXmlBytes:ncXml.length,
  validSourceKindMatchedXml:'NOT_PROVEN',matchedCsvGolden:'NOT_PROVEN'},
 userScopePositive:'NOT_PROVEN',workers:[],downloadEvents:0,
 downloads:[],pageErrors:[],steps:[],pass:false};
const browser=await chromium.launch({headless:true});let page;
try{
 page=await browser.newPage({acceptDownloads:true});
 page.on('worker',w=>record.workers.push(w.url()));
 page.on('download',()=>record.downloadEvents++);
 page.on('pageerror',e=>record.pageErrors.push(String(e)));
 const response=await page.goto('http://127.0.0.1:4173/'+route,{waitUntil:'domcontentloaded'});
 assert.equal(response?.status(),200);
 await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:45000});
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles(xml);
 await page.locator('[data-phase="json-trace"]').click();
 const scope=page.locator('[data-field="resolver-hierarchy-scope"]');
 record.scopeBefore={count:await scope.count(),disabled:await scope.isDisabled(),
   options:await scope.locator('option').allTextContents()};
 await page.locator('[data-field="staged-json-file"]').setInputFiles(json);
 await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
   return s.startsWith('LFJ source index COMMITTED')||s.startsWith('LFJ Worker FAILED');},null,{timeout:180000});
 const committed=await page.locator('[data-lfj-o1-status]').textContent();
 assert.ok(committed.includes(record.originalSha.slice(0,12)),'real original SHA in committed Worker');
 await page.locator('[data-action="build-resolver-index"]').click();
 await page.waitForFunction(()=>{const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
   return s.startsWith('O1 matched trace source-path verified')||s.startsWith('O1 domain blocked');},null,{timeout:180000});
 const matched=await page.locator('[data-lfj-o1-status]').textContent();
 assert.ok(matched.startsWith('O1 matched trace source-path verified'));
 record.scopeAfter={count:await scope.count(),disabled:await scope.isDisabled(),
   options:await scope.locator('option').allTextContents(),selected:await scope.inputValue()};
 record.originalCsvControls=await page.locator('[data-lfj-o1-action^="export-"]').count();
 assert.equal(record.originalCsvControls,2);
 assert.ok(record.workers.some(w=>w.includes('source-browser-worker.mjs'))&&
   record.workers.some(w=>w.includes('lfj-o1-resolver-domain-worker.mjs')));
 await page.waitForFunction(()=>{
   const el=document.querySelector('[data-field="resolver-hierarchy-scope"]');
   return el&&!el.disabled&&[...el.options].some(o=>o.value==='/ASIM-1885-CU-PI');
 },null,{timeout:60000});
 record.scopeAfter={count:await scope.count(),disabled:await scope.isDisabled(),
   options:await scope.locator('option').allTextContents(),selected:await scope.inputValue()};
 assert.equal(record.scopeAfter.disabled,false);
 await scope.selectOption('/ASIM-1885-CU-PI');
 record.postScopeExportControls=await page.locator('[data-lfj-o1-action^="export-"]').count();
 assert.equal(record.postScopeExportControls,0,'scope change revokes previous outputs');
 await page.locator('[data-action="build-resolver-index"]').click();
 await page.waitForFunction(()=>{
   const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
   return s.startsWith('O1 matched trace source-path verified')||s.startsWith('O1 domain blocked');
 },null,{timeout:180000});
 const scopedStatus=await page.locator('[data-lfj-o1-status]').textContent();
 assert.ok(scopedStatus.startsWith('O1 matched trace source-path verified'),scopedStatus);
 const expected=[['node','0d8bb4482ed4a9d0d116faeac5e68ce564f07b6bba2dd73dfc3676b72ec2eddc',216],
   ['evidence','653485ff968bf478fa0001488432bb210a9ce6e85a901e9cc19f368f53a24809',241]];
 record.scopedCsv=[];
 for(const [type,expectedHash,rows] of expected){
  const pending=page.waitForEvent('download',{timeout:30000});
  await page.locator('[data-lfj-o1-action="export-'+type+'"]').click();
  const download=await pending,bytes=await readFile(await download.path());
  assert.equal(sha(bytes),expectedHash,'scoped original '+type+' CSV SHA');
  record.scopedCsv.push({type,rows,bytes:bytes.length,sha256:sha(bytes)});
 }
 await scope.selectOption('__ALL__');
 record.postScopeResetExports=await page.locator('[data-lfj-o1-action^="export-"]').count();
 assert.equal(record.postScopeResetExports,0,'scope reset immediately revokes selected exports');
 record.userScopePositive='ORIGINAL_SCOPE_CSV_SHA_VERIFIED';
 record.pass=record.pageErrors.length===0;
 record.steps.push({kind:'original-source',status:committed},
  {kind:'original-domain',status:matched},{kind:'selected-scope',status:scopedStatus},
  {kind:'scope-revocation',exports:record.postScopeResetExports});
 record.nc.positiveOracleAvailable=ncXml.length>0;
 record.nc.note='CAESARII InputXML source kind; no compatible PSI116 matched NC oracle';
}catch(e){record.error=String(e.stack||e).slice(0,1100)}
finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-W11-'+mode+'.json',JSON.stringify(record,null,2)+'\n');
 console.log('LFJ226_O1_W11 '+JSON.stringify(record));
 await browser.close();
}
if(!record.pass)process.exitCode=1;
