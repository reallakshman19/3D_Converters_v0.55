import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const out={schema:'LFJ226.O1.MainWorkerIntake.v1',cases:[]};
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>{(out.pageErrors??=[]).push(String(e));});
await page.addInitScript(()=>{
   const d=window.__lfj226Diag={events:[],counts:{put:0,transactions:0},started:performance.now()};
   const record=(kind,more={})=>{
     const row={ms:Math.round(performance.now()),kind,...more};
     if(d.events.length<1600)d.events.push(row);
   };
   const NativeWorker=window.Worker;
   window.Worker=class ObservedWorker extends NativeWorker {
     constructor(url,options){
       super(url,options);record('WORKER_CREATE',{url:String(url)});
       this.addEventListener('message',event=>{
         const m=event.data;
         if(!m||typeof m!=='object')return;
         if(m.kind==='PROVISIONAL_PAGE')record('WORKER_PROVISIONAL_PAGE',
           {sequence:m.sequence,rowCount:m.rows?.length,jobId:m.jobId,
            sourceSha256:m.rows?.[0]?.sourceSha256});
         else record('WORKER_MESSAGE',{kind:m.kind,sequence:m.sequence,
           code:m.code,jobId:m.jobId,count:m.summary?.occurrenceCount,
           sha256:m.summary?.sourceSha256});
       });
       this.addEventListener('error',e=>record('WORKER_ERROR',{message:e.message}));
     }
     postMessage(message,...args){
       if(message?.kind==='SCAN')record('SCAN_DISPATCH',
         {jobId:message.jobId,sourceRefId:message.sourceRefId,
          bytes:message.blob?.size,pageEvents:message.pageEvents});
       else if(message?.kind==='PAGE_ACK')record('PAGE_ACK',
         {jobId:message.jobId,sequence:message.sequence});
       else record('WORKER_SEND',{kind:message?.kind,jobId:message?.jobId});
       return super.postMessage(message,...args);
     }
     terminate(){record('WORKER_TERMINATE');return super.terminate();}
   };
   const txn=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(...args){
     const tx=txn.apply(this,args);
     d.counts.transactions++;
     const started=performance.now();
     tx.addEventListener('complete',()=>record('IDB_TX_COMPLETE',
       {stores:String(args[0]),durationMs:Math.round(performance.now()-started)}));
     tx.addEventListener('abort',()=>record('IDB_TX_ABORT',
       {stores:String(args[0]),durationMs:Math.round(performance.now()-started)}));
     tx.addEventListener('error',()=>record('IDB_TX_ERROR',{stores:String(args[0])}));
     return tx;
   };
   const put=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(...args){
     d.counts.put++;
     if(d.counts.put%10000===0)record('IDB_PUT_COUNT',{count:d.counts.put});
     return put.apply(this,args);
   };
   const deletion=IDBFactory.prototype.deleteDatabase;
   IDBFactory.prototype.deleteDatabase=function(name){
     record('IDB_DELETE_REQUEST',{name});const request=deletion.call(this,name);
     request.addEventListener('success',()=>record('IDB_DELETE_SUCCESS',{name}));
     request.addEventListener('blocked',()=>record('IDB_DELETE_BLOCKED',{name}));
     request.addEventListener('error',()=>record('IDB_DELETE_ERROR',{name}));
     return request;
   };
   document.addEventListener('change',e=>{
     const f=e.target?.files?.[0];
     if(f)record('FILE_CONTROL_CHANGE',{field:e.target?.dataset?.field,
       modeA:e.target?.dataset?.modeAStagedJsonAll,filename:f.name,bytes:f.size});
   },true);
   const watch=new MutationObserver(()=>{
     const status=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
     if(status!==d.lastStatus){
       d.lastStatus=status;
       if(status)record('STATUS',{text:status});
     }
   });
   watch.observe(document,{childList:true,subtree:true,characterData:true});
   window.__lfj226DiagSnapshot=()=>({
     counts:{...d.counts},events:[...d.events],
     status:document.querySelector('[data-lfj-o1-status]')?.textContent||'',
     controlPresent:!!document.querySelector('[data-field="staged-json-file"]'),
     mode:document.querySelector('[data-field="source-kind"]')?.value||null
   });
 });
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__lfj226Mounted===true);
 await page.locator('[data-phase="json-trace"]').click();
 await page.locator('[data-lfj-o1-enable]').check();
 const field=page.locator('[data-field="staged-json-file"]');
 const sources=[
   {name:'FIRSTPASS',path:'Benchmarks/1885Sjson/Sjson.json'},
   {name:'NC_SOURCE_NEGATIVE',path:'Benchmarks/1885_NC/1885_NC.json'}
 ];
 for(const input of sources){
   const original=await readFile(input.path);
   const sha=createHash('sha256').update(original).digest('hex');
   const start=Date.now();
   const beforeEvents=await page.evaluate(()=>window.__lfj226DiagSnapshot().events.length);
   await page.evaluate(()=>window.__lfj226Metrics.start());
   let failure=null;
   try{
     await field.setInputFiles(input.path);
     await page.waitForFunction(expected=>{
       const status=document.querySelector('[data-lfj-o1-status]')?.textContent??'';
       return (status.startsWith('LFJ source index COMMITTED')&&status.includes(expected))||
         status.startsWith('LFJ Worker FAILED');
     },sha.slice(0,12),{timeout:150000});
   }catch(e){failure=String(e);}
   const status=await page.locator('[data-lfj-o1-status]').textContent().catch(()=>null);
   const frames=await page.evaluate(()=>window.__lfj226Metrics.stop());
   const snapshot=await page.evaluate(()=>window.__lfj226DiagSnapshot());
   const events=snapshot.events.slice(beforeEvents);
   const row={name:input.name,sizeBytes:original.length,sha256:sha,
     elapsedMs:Date.now()-start,maxFrameGapMs:frames.maxFrameGapMs,frames:frames.frames,
     status,failure,controlPresent:snapshot.controlPresent,mode:snapshot.mode,
     counts:snapshot.counts,events,
     stageSummary:Object.fromEntries([...new Set(events.map(e=>e.kind))].map(kind=>
       [kind,events.filter(e=>e.kind===kind).length]))};
   row.pass=!failure&&status?.includes('COMMITTED')&&
     status?.includes(sha.slice(0,12))&&status?.includes('Trace/CSV NOT authorized');
   out.cases.push(row);
   console.log('LFJ226_DIAGNOSTIC_CASE '+JSON.stringify({
     name:row.name,pass:row.pass,elapsedMs:row.elapsedMs,maxFrameGapMs:row.maxFrameGapMs,
     status:row.status,failure:row.failure,stageSummary:row.stageSummary,
     lastEvents:events.slice(-10)}));
   if(!row.pass)break;
 }
 if(out.cases.every(c=>c.pass)){
 const start=Date.now();
 await field.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('[{"bad":}')});
 await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')?.textContent?.includes('FAILED'),null,{timeout:20000});
 out.malformed={elapsedMs:Date.now()-start,status:await page.locator('[data-lfj-o1-status]').textContent()};
 assert.ok(out.malformed.status.includes('no trace/export rights'));
 }
 console.log('LFJ226_REAL_UI_WORKER_INDEX '+JSON.stringify({caseResults:out.cases.map(c=>({name:c.name,pass:c.pass,status:c.status,failure:c.failure})),malformed:out.malformed}));
 assert.ok(out.cases.length===2&&out.cases.every(c=>c.pass),'Both authentic worker scans must commit; diagnose stage from artifact');
}finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-intake.json',JSON.stringify(out,null,2)+'\n');
 await browser.close();
}
