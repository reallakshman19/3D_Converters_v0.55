// R09 independent source-to-page oracle. RED before any R09 product implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../../index/source-occurrence-index.mjs';
import {transferBoundedSourcePages} from '../../transport/execution/bounded-source-transfer.mjs';
import {createWorkerLifecycleSession} from '../../transport/lifecycle/lifecycle-session.mjs';
import {selectCommittedOccurrences} from '../selection/exact-occurrence-selection.mjs';
import {createCommittedSelectionPager} from './committed-selection-pages.mjs';

const sourceText='[{"type":"BRANCH","name":"A","children":[{"type":"VALVE","name":"X"}]},{"type":"BRANCH","name":"B","children":[{"type":"VALVE","name":"Y"}]}]';
const expectedAll=['','/0','/0/type','/0/name','/0/children','/0/children/0','/0/children/0/type','/0/children/0/name',
  '/1','/1/type','/1/name','/1/children','/1/children/0','/1/children/0/type','/1/children/0/name'];
const expectedA=expectedAll.slice(1,8);
const sourceBasis=m=>({sourceRefId:m.sourceRefId,sourceSha256:m.sourceSha256,sourceRevision:m.sourceRevision});

async function sourceView(json=sourceText,paths=expectedAll) {
  const bytes=new TextEncoder().encode(json);
  const b=createSourceSnapshotBuilder({byteLength:bytes.length,revision:'R09-fixture'});
  b.append(bytes,0);const source=b.finalize();
  const jobId='R09-SOURCE-INDEX',sourceRefId='R09-STAGED';
  let worker;
  const s=createWorkerLifecycleSession({jobId,sourceRefId,sourceSha256:source.sha256,
    sourceRevision:source.revision,byteLength:source.byteLength,selectionDigest:'all',
    trustedWorkerCtor:Worker,
    createWorker:()=>{worker=new Worker(
      new URL('../../transport/lifecycle/lifecycle-worker-fixture.mjs',import.meta.url),
      {type:'module',workerData:{mode:'ready'}});return worker;}
  });
  const eventPages=[];
  assert.equal((await s.start()).kind,'ADMITTED');
  const tx=s.beginIndexTransaction({stagePage:async p=>{eventPages.push(...p);},commit:()=>{},
    abort:()=>{eventPages.length=0;}});
  const manifest=await streamJsonOccurrenceEvents(source,{sourceRefId,pageEvents:2,onEventPage:tx.onEventPage});
  const receipt=await transferBoundedSourcePages({worker,trustedWorkerCtor:Worker,snapshot:source,
    jobId,sourceRefId,pageBytes:32,onConsumed:()=>{}});
  const completion=tx.commit(manifest,receipt);
  const opens=eventPages.filter(x=>x.kind==='OPEN');
  assert.deepEqual(opens.map(x=>x.path),paths);
  let scanned=0;
  const view={manifest,completion,async *readOrdered(){scanned++;for(const row of opens)yield row;}};
  return {view,source,opens,get scanned(){return scanned;},async close(){await worker?.terminate();source.close();}};
}
// Test-only indexed adapter; not a product IndexedDB/OPFS implementation.
function memoryIndexedStore(){
  let staged=[],committed=null,aborted=0,readCalls=0,commitCalls=0,active=true;
  return {
    async stagePage(rows){if(!active)throw Error('storage closed');staged.push(...rows);},
    async commit(){if(!active)throw Error('storage closed');committed=staged.slice();commitCalls++;},
    async abort(){active=false;staged=[];committed=null;aborted++;},
    async readRange(start,maxRows,maxBytes){
      readCalls++;
      if(!committed)throw Error('uncommitted');
      let rows=[],bytes=0;
      for(let i=start;i<committed.length&&rows.length<maxRows;i++){
        const b=new TextEncoder().encode(JSON.stringify(committed[i])).length;
        if(bytes+b>maxBytes)break;
        rows.push(committed[i]);bytes+=b;
      }
      return rows;
    },
    get state(){return {staged:staged.length,committed:committed?.length??null,aborted,readCalls,commitCalls};}
  };
}
async function prepared({mode='EXPLICIT',json=sourceText,paths=expectedAll,store=memoryIndexedStore(),getCurrentBasis}={}){
 const f=await sourceView(json,paths),m=f.view.manifest;
 const basis=sourceBasis(m),scope='scope-'+mode,epoch='R09-JOB-v1';
 let live={...basis};
 const p=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:scope,
   jobEpoch:epoch,getCurrentBasis:getCurrentBasis??(()=>live)});
 const include=f.opens.find(x=>x.path==='/0').occurrenceId;
 const summary=await selectCommittedOccurrences(f.view,{
   mode,includes:mode==='EXPLICIT'?[include]:[],excludes:[],sourceBasis:basis,
   getCurrentBasis:()=>live
 },{pageRows:2,onSelectedPage:p.stageSelectedPage});
 const accepted=await p.commitSelection(summary);
 assert.equal(accepted.complete,true);
 const request=(cursor=null,maxRows=1,maxBytes=65536,overrides={})=>
   p.readPage({cursor,maxRows,maxBytes,sourceBasis:basis,selectionDigest:scope,jobEpoch:epoch,...overrides});
 return {f,store,p,basis,scope,epoch,accepted,request,
   setLive:b=>{live=b;},async close(){await f.close();}};
}
async function union(f,maxRows=1){
 let token=null,first=true,out=[],pages=0;
 do {
   const page=await f.request(token,maxRows);
   assert.ok(page.rows.length<=maxRows);
   out.push(...page.rows.map(r=>r.path));
   pages++;
   token=page.cursor;
   if(first){assert.equal(page.totalCount,f.accepted.selectedCount);first=false;}
 }while(token!==null);
 return {out,pages};
}
test('R09/U01 RED: actual source R03-R08 yields one-row bounded indexed pages, no clipping',async()=>{
 const f=await prepared();
 try{
   const result=await union(f,1);
   assert.deepEqual(result.out,expectedA);
   assert.equal(result.pages,expectedA.length);
   assert.equal(f.f.scanned,1,'never rerun whole R08 selection for next cursor');
   assert.equal(f.store.state.commitCalls,1);
   assert.equal(f.store.state.readCalls,expectedA.length);
 }finally{await f.close();}
});
test('R09/U02 RED: all and none complete, partial final page, identical independent union',async()=>{
 const f=await prepared({mode:'ALL'});
 const none=await prepared({mode:'NONE'});
 try{
   const all=await union(f,4),empty=await none.request(null,1);
   assert.deepEqual(all.out,expectedAll);
   assert.equal(all.pages,4);
   assert.deepEqual(empty.rows,[]);
   assert.equal(empty.cursor,null);
   assert.equal(empty.totalCount,0);
   assert.equal(empty.complete,true);
 }finally{await Promise.all([f.close(),none.close()]);}
});
test('R09/U03 RED: page size does not change source order and repeated-name identity',async()=>{
 const repeated=sourceText.replace('"name":"B"','"name":"A"').replace('"name":"Y"','"name":"X"');
 const a=await prepared({mode:'ALL',json:repeated}),b=await prepared({mode:'ALL',json:repeated});
 try{
   const one=await union(a,1),four=await union(b,4);
   assert.deepEqual(one.out,expectedAll);
   assert.deepEqual(four.out,expectedAll);
   assert.equal(a.f.scanned,1);
   assert.equal(b.f.scanned,1);
 }finally{await Promise.all([a.close(),b.close()]);}
});
test('R09/U04 RED: cursor never survives new source SHA, scope, epoch or tampering',async()=>{
 const f=await prepared();
 try{
   const first=await f.request(null,1);
   assert.ok(first.cursor);
   for(const override of [
     {sourceBasis:{...f.basis,sourceSha256:'changed'}},
     {selectionDigest:'other-selection'},
     {jobEpoch:'new-job'}, {cursor:first.cursor+'tamper'}
   ]) await assert.rejects(()=>f.request(first.cursor,1,65536,override),
       e=>['SOURCE_STALE','CURSOR_STALE','INVALID_CURSOR'].includes(e?.code));
   const second=await f.request(first.cursor,1);
   assert.deepEqual(second.rows.map(x=>x.path),[expectedA[1]]);
   await assert.rejects(()=>f.request(first.cursor,1),e=>e?.code==='INVALID_CURSOR');
   f.setLive({...f.basis,sourceRevision:f.basis.sourceRevision+'-new'});
   await assert.rejects(()=>f.request(second.cursor,1),e=>e?.code==='SOURCE_STALE');
 }finally{await f.close();}
});

test('R09/U04 semantic RED: late async staged write must be discarded AFTER abort',async()=>{
 const f=await sourceView();
 let staged=[],release,entered;
 const atWrite=new Promise(resolve=>{entered=resolve;});
 const store={
   stagePage:async rows=>{
     entered();
     await new Promise(resolve=>{release=resolve;});
     staged.push(...rows);
   },
   commit:async()=>{},abort:async()=>{staged=[];},
   readRange:async()=>[]
 };
 const basis=sourceBasis(f.view.manifest);
 const pager=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
 try{
   const pending=pager.stageSelectedPage([f.opens[1]]);
   await atWrite;
   await pager.abort();
   release();
   await assert.rejects(pending,e=>e?.code==='STAGE_NOT_ACTIVE');
   assert.deepEqual(staged,[],'late write after first abort cannot escape rollback');
 }finally{await f.close();}
});
test('R09/U04 semantic RED: late storage commit must re-abort provisional publication',async()=>{
 const f=await sourceView();
 let rows=[],visible=null,release,entered;
 const atCommit=new Promise(resolve=>{entered=resolve;});
 const store={
   stagePage:async p=>{rows.push(...p);},
   commit:async manifest=>{
     entered();
     await new Promise(resolve=>{release=resolve;});
     visible={manifest,rows:[...rows]};
   },
   abort:async()=>{rows=[];visible=null;},
   readRange:async()=>visible?.rows??[]
 };
 const basis=sourceBasis(f.view.manifest);
 const pager=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
 try{
   await pager.stageSelectedPage([f.opens[1]]);
   const promise=pager.commitSelection({
     schema:'LFJ.OccurrenceSelectionSummary.v1',complete:true,
     ...basis,selectedCount:1,scannedCount:f.opens.length,
     rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
   });
   await atCommit;
   await pager.abort();
   release();
   await assert.rejects(promise,e=>e?.code==='SELECTION_SUPERSEDED');
   assert.equal(visible,null,'commit resolves after cancellation: late manifest must be rolled back');
 }finally{await f.close();}
});
test('R09/U04 semantic RED: abort during indexed read may never return accepted page',async()=>{
 const f=await sourceView();
 let release,entered;
 const atRead=new Promise(resolve=>{entered=resolve;});
 let rows=[];
 const store={
   stagePage:async p=>{rows.push(...p);},
   commit:async()=>{},
   abort:async()=>{rows=[];},
   readRange:async(start,n)=>{
     const copy=rows.slice(start,start+n);
     entered();
     await new Promise(resolve=>{release=resolve;});
     return copy;
   }
 };
 const basis=sourceBasis(f.view.manifest);
 const pager=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
 try{
   await pager.stageSelectedPage([f.opens[1]]);
   await pager.commitSelection({
     schema:'LFJ.OccurrenceSelectionSummary.v1',complete:true,
     ...basis,selectedCount:1,scannedCount:f.opens.length,
     rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
   });
   const pending=pager.readPage({cursor:null,maxRows:1,maxBytes:65536,
     sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
   await atRead;await pager.abort();release();
   await assert.rejects(pending,e=>e?.code==='PAGE_SESSION_ABORTED');
 }finally{await f.close();}
});

test('R09/U01: backend exceeding requested row cap cannot leak extra source facts',async()=>{
 const store=memoryIndexedStore(),originalRead=store.readRange.bind(store);
 store.readRange=async(start,maxRows,maxBytes)=>originalRead(start,maxRows+1,maxBytes);
 const f=await prepared({store});
 try{
   await assert.rejects(()=>f.request(null,1),e=>e?.code==='PAGE_STORE_INVALID');
 }finally{await f.close();}
});
test('R09/U01: backend ignoring requested byte cap refuses oversized page',async()=>{
 const store=memoryIndexedStore(),originalRead=store.readRange.bind(store);
 store.readRange=async(start,maxRows)=>originalRead(start,maxRows,1048576);
 const f=await prepared({store});
 try{
   const bytes=new TextEncoder().encode(JSON.stringify(f.f.opens[1])).length;
   assert.ok(bytes>256,'actual source event must exceed the small requested byte bound');
   await assert.rejects(()=>f.request(null,1,256),e=>e?.code==='PAGE_STORE_OVERLIMIT');
 }finally{await f.close();}
});
test('R09/U02: invalid/incomplete R08 selection cannot commit partial selected pages',async()=>{
 const f=await sourceView(),basis=sourceBasis(f.view.manifest);
 const store=memoryIndexedStore();
 const pager=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
 try{
   await pager.stageSelectedPage([f.opens[1]]);
   await assert.rejects(()=>pager.commitSelection({
     schema:'LFJ.OccurrenceSelectionSummary.v1',complete:false,
     ...basis,selectedCount:1,scannedCount:f.opens.length,
     rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
   }),e=>e?.code==='SELECTION_INCOMPLETE');
   assert.equal(store.state.commitCalls,0,'provisional cannot publish');
   await pager.abort();
   assert.equal(store.state.committed,null);
 }finally{await f.close();}
});

test('R09/U04: real same-length R03 interior edit revokes old source cursor by SHA',async()=>{
 const f=await prepared();
 const changedText=sourceText.replace('"name":"B"','"name":"C"');
 const raw=new TextEncoder().encode(changedText);
 const b=createSourceSnapshotBuilder({byteLength:raw.length,revision:'R09-fixture'});
 b.append(raw,0);
 const changed=b.finalize();
 try{
   assert.equal(changed.byteLength,f.f.source.byteLength,'edit preserves source byte length');
   assert.notEqual(changed.sha256,f.basis.sourceSha256,'independent R03 SHA changes');
   const first=await f.request(null,1);
   assert.ok(first.cursor);
   await assert.rejects(()=>f.request(first.cursor,1,65536,{
     sourceBasis:{...f.basis,sourceSha256:changed.sha256,sourceRevision:changed.revision}
   }),e=>e?.code==='SOURCE_STALE');
 }finally{changed.close();await f.close();}
});

test('R09/U02 semantic RED: returned page rows are immutable even if indexed backend deserializes mutable objects',async()=>{
 const store=memoryIndexedStore(),reader=store.readRange.bind(store);
 store.readRange=async(...args)=>(await reader(...args)).map(r=>({...r}));
 const f=await prepared({store});
 try{
   const page=await f.request(null,1);
   assert.equal(Object.isFrozen(page.rows),true);
   assert.equal(Object.isFrozen(page.rows[0]),true,'rows must be frozen snapshots');
   assert.throws(()=>{page.rows[0].path='/tampered';},TypeError);
 }finally{await f.close();}
});
test('R09/U02 semantic RED: caller mutation after staging cannot alter indexed source row',async()=>{
 const f=await sourceView(),basis=sourceBasis(f.view.manifest);
 let received;
 const store={
   stagePage:async p=>{received=p;},
   commit:async()=>{},abort:async()=>{},readRange:async()=>[]
 };
 const p=createCommittedSelectionPager({store,sourceBasis:basis,selectionDigest:'A',jobEpoch:'E'});
 try{
   const mutable={...f.opens[1]};
   await p.stageSelectedPage([mutable]);
   mutable.path='/tampered';
   assert.equal(received[0].path,'/0','stage must take a defensive immutable snapshot');
   assert.equal(Object.isFrozen(received[0]),true);
 }finally{await p.abort();await f.close();}
});

test('R09/U02 semantic RED: genuine valid R05 occurrence IDs beyond 1024 characters must remain page-reachable',async()=>{
 // R05 explicitly permits long RFC6901 paths (up to 65,536 UTF-16 code units)
 // and source occurrence IDs (up to 67,584 code units). R09 may NOT clip at 1024.
 const longKey='k'.repeat(1100);
 const path='/0/'+longKey;
 const json='[{"'+longKey+'":"value"}]';
 const f=await prepared({mode:'ALL',json,paths:['','/0',path]});
 try{
   const records=await union(f,1);
   assert.deepEqual(records.out,['','/0',path]);
   assert.equal(records.pages,3);
   assert.ok(f.f.opens[2].occurrenceId.length>1024);
 }finally{await f.close();}
});

test('R09/U01 semantic RED: maxBytes must bound the entire serialized page, not rows alone',async()=>{
 const f=await prepared();
 try{
   const firstRow=f.f.opens[1];
   const onlyRowBytes=new TextEncoder().encode(JSON.stringify(firstRow)).byteLength;
   const cap=Math.max(256,onlyRowBytes+1);
   assert.ok(cap<65536);
   // The row fits this budget, but the complete page also carries source
   // basis, selection epoch, cursor, count, rights and version metadata.
   await assert.rejects(()=>f.request(null,1,cap),
     e=>e?.code==='PAGE_WIRE_OVERLIMIT');
 }finally{await f.close();}
});
