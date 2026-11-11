/**
 * STORE-GATE / V4.1: actual IndexedDB-backed source-event or selected-result
 * index. All visibility comes from a durable head pointer, atomically written
 * in one committed IDB readwrite transaction AFTER staged rows completed.
 *
 * NOTE: commit(manifest) is intentionally ASYNCHRONOUS. It is NOT compatible
 * with R07's synchronous beginIndexTransaction.commit and MUST NOT be wrapped
 * as a fake synchronous callback to claim SOURCE_INDEX_COMPLETE.
 */
export class IndexedStoreError extends Error {
  constructor(code,detail){super(code+': '+detail);this.name='IndexedStoreError';this.code=code;}
}
const fail=(code,detail)=>{throw new IndexedStoreError(code,detail)};
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
const equals=(a,b)=>a?.sourceRefId===b?.sourceRefId&&a?.sourceSha256===b?.sourceSha256&&a?.sourceRevision===b?.sourceRevision;
const encoded=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
const ROWS_LIMIT=4096,BYTES_LIMIT=1048576;

function openDb(dbName,api){
  return new Promise((resolve,reject)=>{
    let request;
    try{request=api.open(dbName,1);}catch{reject(new IndexedStoreError('STORE_UNAVAILABLE','IndexedDB open refused'));return;}
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('records'))
        db.createObjectStore('records',{keyPath:['namespace','generation','position']});
      if(!db.objectStoreNames.contains('heads'))
        db.createObjectStore('heads',{keyPath:'namespace'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new IndexedStoreError('STORE_UNAVAILABLE','IndexedDB open failed'));
    request.onblocked=()=>reject(new IndexedStoreError('STORE_BLOCKED','IndexedDB schema upgrade blocked'));
  });
}
function complete(tx,code='STORE_WRITE_FAILED'){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(new IndexedStoreError(code,'IndexedDB request transaction error'));
    tx.onabort=()=>reject(new IndexedStoreError(code,'IndexedDB transaction aborted before durable completion'));
  });
}
function one(db,store,key){
  return new Promise((resolve,reject)=>{
    let req;
    try{req=db.transaction(store,'readonly').objectStore(store).get(key);}
    catch{reject(new IndexedStoreError('STORE_READ_FAILED','IndexedDB record not readable'));return;}
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(new IndexedStoreError('STORE_READ_FAILED','IndexedDB get request failed'));
  });
}
/**
 * Explicit records are isolated by namespace + generation + ordinal.
 * Caller owns source/job/selection changes and must abort stale sessions.
 *
 * kind: "source" expects staged R05 OPEN/SEAL events and readOrdered();
 * kind: "selection" expects R08 selected OPEN facts and readRange().
 */
export async function openIndexedRecordStore({
  databaseName,namespace,generation,basis,kind,selectionDigest,jobEpoch,
  indexedDB:provided=globalThis.indexedDB,beforeHeadCommit
}={}){
  if(!provided||typeof provided.open!=='function')
    fail('STORE_UNAVAILABLE','native IndexedDB required: no memory/localStorage fallback');
  if(!valid(databaseName)||!valid(namespace)||!valid(generation)||
      !['source','selection'].includes(kind)||!valid(basis?.sourceRefId)||
      !valid(basis?.sourceSha256)||!valid(basis?.sourceRevision)||
      (beforeHeadCommit!==undefined&&typeof beforeHeadCommit!=='function'))
    fail('STORE_BASIS_REQUIRED','explicit original source, generation, kind and IndexedDB name required');
  if(kind==='selection'&&(!valid(selectionDigest)||!valid(jobEpoch)))
    fail('STORE_SELECTION_BASIS_REQUIRED','selected source pages require exact scope digest and job epoch');
  const db=await openDb(databaseName,provided);
  const previous=await one(db,'heads',namespace);
  const expectedHead=previous?.generation??null;
  let state='STAGING',position=0,busy=false,activeCommitTx=null;
  const ensureActive=()=>{
    if(state==='ABORTED')fail('STORE_ABORTED','session was aborted');
    if(state==='CLOSED')fail('STORE_CLOSED','database connection closed');
  };
  async function head(){
    ensureActive();
    const current=await one(db,'heads',namespace);
    if(!current||current.generation!==generation||current.kind!==kind||
       !equals(current.manifest,basis)||
       (kind==='selection'&&(current.manifest?.selectionDigest!==selectionDigest||
           current.manifest?.jobEpoch!==jobEpoch))||
       current.manifest?.complete!==true||
       current.manifest?.rightsBasis!=='SOURCE_FACTS_ONLY'||
       current.manifest?.engineeringReady!==false)
      fail('STORE_NOT_COMMITTED','committed head for exact original source generation required');
    return current;
  }
  async function stagePage(rows){
    ensureActive();
    if(state!=='STAGING'||busy)fail('STORE_STAGE_BUSY','one active bounded staged page per generation');
    if(!Array.isArray(rows)||rows.length<1||rows.length>ROWS_LIMIT)
      fail('STORE_STAGE_LIMIT','a nonempty bounded source event page is required');
    let size=0;
    for(const row of rows){
      if(!row||typeof row!=='object'||!equals(row,basis)||
         (kind==='source'?!['OPEN','SEAL'].includes(row.kind):row.kind!=='OPEN'))
        fail('STORE_STAGE_ROW','original source row must match explicit source basis');
      size+=encoded(row);
      if(size>BYTES_LIMIT)fail('STORE_STAGE_LIMIT','one source-event page exceeds serialized byte cap');
    }
    // Reserve the staging lease BEFORE the first asynchronous IDB lookup.
    // Otherwise simultaneous calls can both claim the same position range.
    busy=true;
    const first=position;
    try {
      const already=await one(db,'heads',namespace);
      if(already?.generation===generation)
        fail('STORE_ALREADY_COMMITTED','committed generation cannot be rewritten');
      const tx=db.transaction('records','readwrite');
      const done=complete(tx);
      const records=tx.objectStore('records');
      rows.forEach((row,i)=>records.put({namespace,generation,position:first+i,row}));
      await done; // requests alone are NOT a durable transaction result
      if(state!=='STAGING'){
        await rollback();
        fail('STORE_ABORTED','late stage cannot become visible after cancellation');
      }
      position+=rows.length;
    }catch(e){state='ABORTED';await rollback();throw e;}
    finally{busy=false;}
  }
  function validateManifest(manifest){
    if(!manifest||!equals(manifest,basis)||manifest.complete!==true||
       manifest.rightsBasis!=='SOURCE_FACTS_ONLY'||manifest.engineeringReady!==false)
      fail('STORE_MANIFEST_MISMATCH','complete source-only manifest and exact basis required');
    if(kind==='source'){
      if(manifest.schema!=='LFJ.JSON.OccurrenceIndexSummary.v1'||
         manifest.eventCount!==position||manifest.occurrenceCount*2!==position)
        fail('STORE_MANIFEST_MISMATCH','complete even OPEN/SEAL census required');
    }else if(manifest.schema!=='LFJ.CommittedSelectionPageManifest.v1'||
      manifest.selectedCount!==position||
      manifest.selectionDigest!==selectionDigest||manifest.jobEpoch!==jobEpoch)
      fail('STORE_MANIFEST_MISMATCH','complete selected page count required');
  }
  async function commit(manifest){
    ensureActive();
    if(state!=='STAGING'||busy)fail('STORE_COMMIT_BUSY','stage still active or terminal');
    validateManifest(manifest);
    state='COMMITTING';
    let mismatch=false;
    const tx=db.transaction('heads','readwrite');
    activeCommitTx=tx;
    const done=complete(tx,'STORE_COMMIT_ABORTED');
    const heads=tx.objectStore('heads');
    const check=heads.get(namespace);
    check.onsuccess=()=>{
      if((check.result?.generation??null)!==expectedHead){
        mismatch=true;tx.abort();return;
      }
      heads.put({namespace,generation,count:position,kind,manifest});
      try{beforeHeadCommit?.(tx);}catch{tx.abort();}
    };
    try{
      await done; // externally visible ONLY AFTER IDB transaction complete
      if(state==='ABORTED')fail('STORE_ABORTED','commit raced cancellation');
      state='COMMITTED';
      return Object.freeze({...manifest});
    }catch(e){
      state='ABORTED';
      await rollback();
      if(mismatch)fail('STORE_SUPERSEDED','another source generation committed first');
      throw e;
    }finally{activeCommitTx=null;}
  }
  async function rollback(){
    const tx=db.transaction(['records','heads'],'readwrite');
    const done=complete(tx,'STORE_ABORT_FAILED');
    const records=tx.objectStore('records');
    const bounds=globalThis.IDBKeyRange.bound([namespace,generation,0],
      [namespace,generation,Number.MAX_SAFE_INTEGER]);
    records.delete(bounds);
    const heads=tx.objectStore('heads');
    const request=heads.get(namespace);
    request.onsuccess=()=>{if(request.result?.generation===generation)heads.delete(namespace);};
    await done;
  }
  async function abort(){
    if(state==='CLOSED')return;
    state='ABORTED';
    // Abort the SAME still-open IDB head transaction. Queuing only a later
    // cleanup transaction would permit transient visibility to other readers.
    try{activeCommitTx?.abort();}catch{}
    await rollback(); // idempotent rollback; late stages also repeat cleanup
  }
  async function *readOrdered(){
    if(kind!=='source')fail('STORE_KIND','readOrdered requires source event index');
    const active=await head();
    for(let i=0;i<active.count;i++){
      const x=await one(db,'records',[namespace,generation,i]);
      if(!x||!equals(x.row,basis))fail('STORE_ROW_MISSING','committed source event absent');
      if(x.row.kind==='OPEN')yield x.row;
    }
  }
  async function readRange(start,maxRows,maxBytes){
    if(kind!=='selection')fail('STORE_KIND','indexed readRange requires selected store');
    if(!Number.isSafeInteger(start)||start<0||
       !Number.isSafeInteger(maxRows)||maxRows<1||maxRows>ROWS_LIMIT||
       !Number.isSafeInteger(maxBytes)||maxBytes<256||maxBytes>BYTES_LIMIT)
      fail('STORE_READ_LIMIT','finite range and byte budget required');
    const active=await head(),rows=[];let size=0;
    for(let i=start;i<active.count&&rows.length<maxRows;i++){
      const x=await one(db,'records',[namespace,generation,i]);
      if(!x||!equals(x.row,basis))fail('STORE_ROW_MISSING','committed selected row absent');
      const bytes=encoded(x.row);
      if(size+bytes>maxBytes)break;
      rows.push(x.row);size+=bytes;
    }
    return rows;
  }
  function close(){db.close();state='CLOSED';}
  // R07 V4.2 opt-in bridge calls commitDurably and awaits this genuine
  // IDB transaction.complete Promise before granting SOURCE_INDEX_COMPLETE.
  // The old synchronous R07 index callback must NEVER call commit() directly.
  return Object.freeze({stagePage,commit,commitDurably:commit,abort,readOrdered,readRange,close,
    note:'ASYNC_DURABLE_COMMIT_REQUIRES_R07_V42_HANDOFF'});
}
