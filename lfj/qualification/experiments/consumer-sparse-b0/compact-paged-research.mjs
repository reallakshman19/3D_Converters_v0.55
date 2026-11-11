/**
 * #1147 B0-02 — alternative PACKED-PAGE source catalog research.
 * Only experiment-owned modules. No production LFJ public port or rights.
 *
 * R03 verifies immutable bytes and SHA, R04 validates ALL JSON values.
 * One completed value = one compact in-page record, not one IndexedDB row.
 * Per-ordinal page/slot references are persisted in bounded typed-array
 * directory blocks for genuine random source-ordinal lookup.
 *
 * LIMITATION: This is intentionally not a crash/reopen/multi-writer product.
 * Failed generations leave unreachable staging pages; never activate them.
 */
import {openBlobSourceSnapshot} from '../../../source/source-snapshot.mjs';
import {scanJsonDocument} from '../../../tokenizer/json-tokenizer.mjs';

const SCHEMA='LFJ.B0.PagedOccurrenceResearch.v1';
const PAGE_ROWS=384, PAGE_BYTES=786432, DIR_ROWS=4096;
const MAX_VALUES=2000000;
const fail=(code,message)=>Object.assign(new Error(message),{code});
const valid=n=>Number.isSafeInteger(n)&&n>=0;
const transactionDone=tx=>new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error||fail('IDB_ABORT','transaction aborted'));
  tx.onerror=()=>reject(tx.error||fail('IDB_ERROR','transaction failed'));
});
async function openResearchDb(name){
  return await new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore('pages',{keyPath:['generation','pageNo']});
      db.createObjectStore('directory',{keyPath:['generation','bucket']});
      db.createObjectStore('heads');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function auditPages(db,generation,expected,originalLength){
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction('pages','readonly');
    const cursor=tx.objectStore('pages').openCursor(
      IDBKeyRange.bound([generation,0],[generation,Number.MAX_SAFE_INTEGER]));
    let page=0,count=0,error=null;
    cursor.onsuccess=()=>{
      const cur=cursor.result;
      if(!cur)return;
      const record=cur.value;
      if(record.pageNo!==page||!Array.isArray(record.rows)||record.rows.length<1||
         record.rows.length>PAGE_ROWS){
        error=fail('PAGE_CENSUS','packed page is missing or wrongly bounded');
        try{tx.abort();}catch{}return;
      }
      for(const row of record.rows){
        if(!valid(row.ordinal)||row.ordinal>=expected||
           !valid(row.startByte)||!valid(row.endByteExclusive)||
           row.endByteExclusive<=row.startByte||
           row.endByteExclusive>originalLength ||
           (row.parent!==null&&(!valid(row.parent)||row.parent>=row.ordinal))){
          error=fail('PAGE_CENSUS','invalid original ordinal/parent/span in packed page');
          try{tx.abort();}catch{}return;
        }
      }
      count+=record.rows.length;page++;cur.continue();
    };
    cursor.onerror=()=>{error=cursor.error;};
    tx.oncomplete=()=>count===expected?
      resolve({pages:page,occurrences:count}):
      reject(fail('PAGE_CENSUS','not every original source value was stored'));
    tx.onabort=()=>reject(error||fail('PAGE_CENSUS','page census aborted'));
    tx.onerror=()=>reject(error||tx.error);
  });
}

export async function runPagedCompactResearch({
  blob,expectedSha256,databaseName,generation,revision='B0',signal
}={}){
  if(!(blob instanceof Blob)||!databaseName||!generation)
    throw fail('INPUT_REQUIRED','original Blob/databaseName/generation required');

  const start=performance.now(),enc=new TextEncoder();
  let source=null,db=null,success=false;
  let recordCount=0,ordinal=0,pageNo=0,stageMs=0,pageBytes=0;
  let pagesWritten=0,shaMs=0,scanMs=0,auditMs=0,directoryMs=0,headMs=0;
  let frameStack=[],batch=[];
  // Directory is 6 bytes/value and grows geometrically under an explicit
  // resource limit (max 12MiB at MAX_VALUES, plus bounded scan page buffers).
  let pageRefs=new Uint32Array(4096),rowRefs=new Uint16Array(4096);
  const capacity=n=>{
    if(n>=MAX_VALUES)throw fail('OCCURRENCE_LIMIT','research directory exceeded fixed budget');
    if(n<pageRefs.length)return;
    const len=Math.min(MAX_VALUES,Math.max(n+1,pageRefs.length*2));
    const nextPages=new Uint32Array(len),nextRows=new Uint16Array(len);
    nextPages.set(pageRefs);nextRows.set(rowRefs);
    pageRefs=nextPages;rowRefs=nextRows;
  };
  const writePage=async()=>{
    if(!batch.length)return;
    const tx=db.transaction('pages','readwrite'),done=transactionDone(tx);
    const current=pageNo++;
    tx.objectStore('pages').add({generation,pageNo:current,rows:batch});
    const begin=performance.now();
    await done;
    stageMs+=performance.now()-begin;
    pagesWritten++;
    batch=[];pageBytes=0;
  };
  const save=async row=>{
    if(!valid(row.endByteExclusive)||row.endByteExclusive<=row.startByte)
      throw fail('INVALID_SPAN','unsealed JSON value cannot enter catalog');
    const bytes=enc.encode(JSON.stringify(row)).byteLength;
    if(bytes>PAGE_BYTES)throw fail('VALUE_OVERLIMIT','one catalog row exceeds page budget');
    if(batch.length&&(batch.length>=PAGE_ROWS||pageBytes+bytes>PAGE_BYTES))
      await writePage();
    capacity(row.ordinal);
    if(pageRefs[row.ordinal]!==0)throw fail('DUPLICATE_ORDINAL','value already committed to page');
    pageRefs[row.ordinal]=pageNo+1;
    rowRefs[row.ordinal]=batch.length;
    batch.push(row);
    pageBytes+=bytes;
    recordCount++;
  };
  const nextIdentity=(type,startByte)=>{
    const parent=frameStack.at(-1);
    let member=null;
    if(parent){
      if(parent.type==='object'){
        if(parent.key===null)throw fail('KEY_REQUIRED','composite member has no object key');
        member=parent.key;parent.key=null;
      }else member=parent.childIndex++;
    }else if(ordinal!==0)throw fail('ROOT_DUPLICATE','more than one root');
    return {ordinal:ordinal++,parent:parent?.row.ordinal??null,
      member,type,startByte,endByteExclusive:null};
  };

  try{
    source=await openBlobSourceSnapshot(blob,{revision,expectedSha256,signal});
    shaMs=performance.now()-start;
    db=await openResearchDb(databaseName);
    const beforeScan=performance.now();
    const result=await scanJsonDocument(source,{
      pageBytes:65536,signal,
      async onToken(token){
        if(token.type==='key'){
          const active=frameStack.at(-1);
          if(!active||active.type!=='object'||active.key!==null)
            throw fail('KEY_ORDER','object key outside accepting object');
          active.key=token.value;return;
        }
        if(token.type==='start-array'||token.type==='start-object'){
          const type=token.type==='start-array'?'array':'object';
          frameStack.push({type,row:nextIdentity(type,token.startByte),
            key:null,childIndex:0});
        }else if(token.type==='end-array'||token.type==='end-object'){
          const active=frameStack.pop();
          if(!active||active.type!==(token.type==='end-array'?'array':'object')||
             active.key!==null)
            throw fail('VALUE_NESTING','incorrect composite termination');
          active.row.endByteExclusive=token.endByteExclusive;
          await save(active.row);
        }else if(['string','number','boolean','null'].includes(token.type)){
          const row=nextIdentity(token.type,token.startByte);
          row.endByteExclusive=token.endByteExclusive;
          await save(row);
        }
      }
    });
    scanMs=performance.now()-beforeScan;
    if(!result.complete||result.endByteExclusive!==source.byteLength||
       frameStack.length!==0||ordinal!==recordCount)
      throw fail('SOURCE_INCOMPLETE','complete grammar and all occurrences required');
    await writePage();

    const beforeAudit=performance.now();
    const census=await auditPages(db,generation,ordinal,source.byteLength);
    for(let i=0;i<ordinal;i++)if(!pageRefs[i])
      throw fail('DIRECTORY_GAP','missing source ordinal in page directory');
    if(census.pages!==pagesWritten||census.occurrences!==ordinal)
      throw fail('PAGE_CENSUS','packed pages differ from full source');
    auditMs=performance.now()-beforeAudit;

    const beforeDirectory=performance.now();
    for(let startOrd=0,bucket=0;startOrd<ordinal;startOrd+=DIR_ROWS,bucket++){
      const last=Math.min(ordinal,startOrd+DIR_ROWS);
      const tx=db.transaction('directory','readwrite'),done=transactionDone(tx);
      tx.objectStore('directory').add({generation,bucket,
        pageRefs:pageRefs.slice(startOrd,last),
        rowRefs:rowRefs.slice(startOrd,last)});
      await done;
    }
    directoryMs=performance.now()-beforeDirectory;

    const beforeHead=performance.now();
    const tx=db.transaction('heads','readwrite'),done=transactionDone(tx);
    tx.objectStore('heads').put({
      schema:SCHEMA,complete:true,generation,
      sourceSha256:source.sha256,sourceRevision:source.revision,
      originalBytes:source.byteLength,occurrenceCount:ordinal,
      pageCount:pagesWritten,directorySize:DIR_ROWS
    },'active');
    await done;
    headMs=performance.now()-beforeHead;
    success=true;
    return {schema:SCHEMA,originalBytes:source.byteLength,
      sourceSha256:source.sha256,sourceRevision:source.revision,
      occurrenceCount:ordinal,pageCount:pagesWritten,
      storageWrites:pagesWritten+Math.ceil(ordinal/DIR_ROWS)+1,
      shaMs,scanMs,stageMs,auditMs,directoryMs,headMs,
      elapsedMs:performance.now()-start,
      sourceOnly:true,appWired:false,crashRecoveryQualified:false};
  }finally{
    source?.close();db?.close();
    if(!success){ /* Unpublished staged pages are quarantined; orphan GC not qualified. */ }
  }
}
