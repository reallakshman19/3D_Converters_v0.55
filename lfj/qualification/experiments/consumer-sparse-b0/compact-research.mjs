/**
 * #1147 B0-02 opt-in RESEARCH prototype — not an LFJ production store.
 * No R05 transport, R07 HEAD, R09 selection, Resolver or docs replacement.
 * Full R04 grammar is still scanned; each JSON VALUE emits exactly one compact
 * terminal source-catalog row, with parent ordinal and source-byte span.
 * This prototype is intentionally single-generation/single-writer.
 */
import {openBlobSourceSnapshot} from '../../../source/source-snapshot.mjs';
import {scanJsonDocument} from '../../../tokenizer/json-tokenizer.mjs';

const SCHEMA='LFJ.B0.CompactOccurrenceResearch.v1';
const LIMIT_ROWS=384, LIMIT_BYTES=786432;
const types={string:'string',number:'number',boolean:'boolean',null:'null'};
const fail=(code,detail)=>Object.assign(new Error(detail),{code});
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const finish=tx=>new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||fail('IDB_ERROR','source staging failed'));
  tx.onabort=()=>reject(tx.error||fail('IDB_ABORT','source staging aborted'));
});
async function database(name){
  return await new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      db.createObjectStore('records',{keyPath:['generation','ordinal']});
      db.createObjectStore('heads');
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function audit(db,gen,expected,sourceBytes){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly');
    const req=tx.objectStore('records').openCursor(
      IDBKeyRange.bound([gen,0],[gen,Number.MAX_SAFE_INTEGER]));
    let count=0,root=0,invalid=null;
    req.onsuccess=()=>{
      const cur=req.result;
      if(!cur)return;
      const r=cur.value;
      if(r.ordinal!==count||!safe(r.startByte)||!safe(r.endByteExclusive)||
         r.endByteExclusive<=r.startByte||r.endByteExclusive>sourceBytes||
         (count===0&&(r.parent!==null||r.member!==null))||
         (count>0&&(!safe(r.parent)||r.parent>=r.ordinal))||
         (typeof r.member!=='string'&&!safe(r.member)&&r.member!==null)){
        invalid=fail('CATALOG_CORRUPT','invalid original ordinal, span or parent');
        try{tx.abort();}catch{}
        return;
      }
      if(r.parent===null)root++;
      count++;cur.continue();
    };
    req.onerror=()=>{invalid=req.error;};
    tx.oncomplete=()=>{
      if(invalid)reject(invalid);
      else if(count!==expected||root!==1)reject(fail('CATALOG_CENSUS','not every original JSON value was durably stored'));
      else resolve(count);
    };
    tx.onabort=()=>reject(invalid||fail('CATALOG_CENSUS','catalog census transaction aborted'));
    tx.onerror=()=>reject(invalid||tx.error);
  });
}
export async function runCompactResearch({blob,expectedSha256,databaseName,generation,revision='B0',signal}={}){
  if(!(blob instanceof Blob)||!databaseName||!generation)throw fail('INPUT_REQUIRED','original Blob, db and generation required');
  let db=null,source=null,complete=false,recordCount=0,flushCount=0,stagingMs=0;
  let shaMs=0,scannerMs=0,censusMs=0,headMs=0;
  let batch=[],batchBytes=0,ordinal=0,stack=[];
  const start=performance.now();
  const enc=new TextEncoder();
  async function flush(){
    if(!batch.length)return;
    const started=performance.now();
    const tx=db.transaction('records','readwrite');
    const done=finish(tx);
    const store=tx.objectStore('records');
    for(const row of batch)store.add({...row,generation});
    await done;
    flushCount++;
    stagingMs+=performance.now()-started;
    batch=[];batchBytes=0;
  }
  async function persist(row){
    // One payload per COMPLETED value, never full R05 OPEN/SEAL copies.
    const bytes=enc.encode(JSON.stringify(row)).byteLength;
    if(bytes>LIMIT_BYTES)throw fail('CATALOG_ROW_LIMIT','one compact value row exceeds test budget');
    if(batch.length&&(batch.length>=LIMIT_ROWS||batchBytes+bytes>LIMIT_BYTES))await flush();
    batch.push(row);batchBytes+=bytes;
  }
  function nextIdentity(tokenType,startByte){
    const parent=stack.at(-1);
    let member=null;
    if(parent){
      if(parent.type==='object'){
        if(parent.pendingKey===null)throw fail('CATALOG_OBJECT_KEY','missing property key');
        member=parent.pendingKey;parent.pendingKey=null;
      }else member=parent.nextIndex++;
    }else if(ordinal!==0)throw fail('CATALOG_ROOT','multiple roots');
    return {ordinal:ordinal++,parent:parent?.row.ordinal??null,member,
      type:tokenType,startByte,endByteExclusive:null};
  }
  try{
    source=await openBlobSourceSnapshot(blob,{revision,expectedSha256,signal});
    shaMs=performance.now()-start;
    db=await database(databaseName);
    const scanStart=performance.now();
    const scan=await scanJsonDocument(source,{
      pageBytes:65536,signal,
      async onToken(token){
        if(token.type==='key'){
          const parent=stack.at(-1);
          if(!parent||parent.type!=='object'||parent.pendingKey!==null)
            throw fail('CATALOG_KEY_ORDER','object key without matching object');
          parent.pendingKey=token.value;
          return;
        }
        if(token.type==='start-object'||token.type==='start-array'){
          const type=token.type==='start-object'?'object':'array';
          const row=nextIdentity(type,token.startByte);
          stack.push({type,row,pendingKey:null,nextIndex:0});
        }else if(token.type==='end-object'||token.type==='end-array'){
          const frame=stack.pop();
          if(!frame||frame.type!==(token.type==='end-object'?'object':'array')||
              frame.pendingKey!==null)throw fail('CATALOG_NESTING','incorrect composite close');
          frame.row.endByteExclusive=token.endByteExclusive;
          await persist(frame.row);recordCount++;
        }else if(Object.hasOwn(types,token.type)){
          const row=nextIdentity(types[token.type],token.startByte);
          row.endByteExclusive=token.endByteExclusive;
          await persist(row);recordCount++;
        }
        // Grammar, duplicate JSON keys, bytes/UTF8 and structural separators
        // remain completely validated by the existing R04 scanner.
      }
    });
    scannerMs=performance.now()-scanStart;
    if(!scan.complete||scan.endByteExclusive!==source.byteLength||
       stack.length||recordCount!==ordinal)
      throw fail('CATALOG_INCOMPLETE','original source catalog did not close');
    await flush();
    const censusStart=performance.now();
    const count=await audit(db,generation,ordinal,source.byteLength);
    censusMs=performance.now()-censusStart;
    const headStart=performance.now();
    const tx=db.transaction('heads','readwrite'),done=finish(tx);
    tx.objectStore('heads').put({
      schema:SCHEMA,complete:true,generation,
      sourceSha256:source.sha256,sourceRevision:source.revision,
      originalBytes:source.byteLength,occurrenceCount:count
    },'active');
    await done;
    headMs=performance.now()-headStart;
    complete=true;
    return {schema:SCHEMA,sourceSha256:source.sha256,sourceRevision:source.revision,
      originalBytes:source.byteLength,occurrenceCount:count,stageTransactions:flushCount,
      stageMs:stagingMs,shaMs,scannerMs,censusMs,headMs,
      elapsedMs:performance.now()-start,sourceOnly:true,
      appWired:false,crashRecoveryQualified:false};
  }finally{
    source?.close();
    db?.close();
    // A failed partial import leaves NO active HEAD and cannot be queried.
    // Crash-orphan reaping is NOT solved by this diagnostic prototype.
    if(!complete){ /* test-only orphan rows remain to measure rollback gap */ }
  }
}
