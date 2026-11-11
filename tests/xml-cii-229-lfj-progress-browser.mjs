import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep))throw Error('OUTSIDE');
  const buffer=await readFile(file);
  const mime=({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.xml':'application/xml'})[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});
  res.end(buffer);
 }catch(e){res.writeHead(404);res.end('not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({acceptDownloads:true});
 page.setDefaultTimeout(30000);
 const errors=[],downloads=[],workers=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('download',e=>downloads.push(e.suggestedFilename()));
 page.on('worker',w=>workers.push(w.url()));
 await page.goto(origin+'/tests/browser/lfj-226-o1-intake.html');
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="source"]').click();
 await page.locator('[data-field="source-file"]').setInputFiles('Benchmarks/1885Sjson/FirstpassXML');
 await page.locator('[data-phase="json-trace"]').click();
 const bar=page.locator('[data-lfj-o1-progress-bar]');
 const details=page.locator('[data-lfj-o1-progress-detail]');
 assert.equal(await bar.count(),1,'real O1 intake must mount progress strip');
 const snapshots=await page.evaluate(()=>{
  const root=document.querySelector('[data-lfj-o1-progress]');
  const all=[];
  const observe=()=>{
   const bar=root.querySelector('[data-lfj-o1-progress-bar]');
   const detail=root.querySelector('[data-lfj-o1-progress-detail]');
   const item={phase:root.dataset.phase,detail:detail.textContent,
     hasValue:bar.hasAttribute('value'),value:bar.value};
   if(!all.length||JSON.stringify(all.at(-1))!==JSON.stringify(item))all.push(item);
  };
  const watcher=new MutationObserver(observe);
  watcher.observe(root,{subtree:true,attributes:true,characterData:true,childList:true});
  observe();
  window.__lfj229Progress={all,disconnect:()=>watcher.disconnect()};
  return all;
 });
 assert(Array.isArray(snapshots));
 const source=page.locator('[data-field="staged-json-file"]');
 await source.setInputFiles('Benchmarks/1885Sjson/Sjson.json');
 await page.waitForFunction(()=>{
  const status=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return status.startsWith('LFJ source index COMMITTED')||status.startsWith('LFJ Worker FAILED');
 },null,{timeout:150000});
 const committed=await page.evaluate(()=>{
  const root=document.querySelector('[data-lfj-o1-progress]');
  const bar=root?.querySelector('[data-lfj-o1-progress-bar]');
  return {status:document.querySelector('[data-lfj-o1-status]')?.textContent||'',
   phase:root?.dataset.phase,value:bar?.value,hasValue:bar?.hasAttribute('value'),
   title:root?.querySelector('[data-lfj-o1-progress-title]')?.textContent,
   detail:root?.querySelector('[data-lfj-o1-progress-detail]')?.textContent,
   rights:root?.querySelector('[data-lfj-o1-progress-rights]')?.textContent,
   snapshots:window.__lfj229Progress.all.slice(0,150)};
 });
 assert(committed.status.startsWith('LFJ source index COMMITTED'),committed.status);
 assert.equal(committed.phase,'committed');
 assert.equal(committed.hasValue,true);
 assert.equal(committed.value,1);
 assert.match(committed.detail,/original occurrences committed/);
 assert.match(committed.rights,/separate authorized Build/);
 assert(!committed.detail.includes('%'));
 assert(committed.snapshots.some(s=>s.phase==='scanning'&&!s.hasValue),
  'real Worker provisional scan must be indeterminate, never fake percent');
 assert(committed.snapshots.some(s=>s.phase==='scanning'&&/staged/.test(s.detail)),
  'real Worker page ACK must populate staged page counter');
 assert(!committed.snapshots.some(s=>s.phase!=='committed'&&s.hasValue&&s.value===1),
  'no transient premature completion allowed');
 assert(workers.some(url=>url.includes('source-browser-worker.mjs')));
 assert.deepEqual(downloads,[]);
 // A subsequent malformed ORIGINAL file revokes previous commit, and cannot
 // display 100% just because the old receipt was successful.
 await source.setInputFiles({name:'broken-229.json',mimeType:'application/json',
   buffer:Buffer.from('[{"bad":}')});
 await page.waitForFunction(()=>{
  const status=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
  return status.startsWith('LFJ Worker FAILED');
 },null,{timeout:30000});
 const failed=await page.evaluate(()=>{
  const root=document.querySelector('[data-lfj-o1-progress]');
  const bar=root?.querySelector('[data-lfj-o1-progress-bar]');
  return {phase:root?.dataset.phase,detail:root?.querySelector('[data-lfj-o1-progress-detail]')?.textContent,
   hasValue:bar?.hasAttribute('value'),value:bar?.value,status:document.querySelector('[data-lfj-o1-status]')?.textContent};
 });
 assert.equal(failed.phase,'failed');
 assert.equal(failed.hasValue,true);assert.equal(failed.value,0);
 assert.match(failed.detail,/no source index or CSV rights/);
 assert.deepEqual(downloads,[]);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({schema:'XML229_LFJ_REAL_BROWSER_PROGRESS_V1',ok:true,
  committed:{...committed,snapshots:undefined},progressSamples:committed.snapshots.length,
  sawIndeterminate:committed.snapshots.some(s=>s.phase==='scanning'&&!s.hasValue),
  sawStaged:committed.snapshots.some(s=>s.phase==='scanning'&&/staged/.test(s.detail)),
  failed,workers:workers.length,errors},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
