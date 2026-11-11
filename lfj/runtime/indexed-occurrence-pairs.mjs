/**
 * LFJ #1108/U02 — browser IndexedDB source-only OPEN/SEAL lookup sidecar.
 *
 * Separate from STORE-GATE-owned indexed-record-store.mjs; the sidecar is
 * an explicit qualified port, not a substitute for its original R07 store.
 * Package-level ready is granted only after BOTH real IDB heads commit.
 * Two databases are NOT a single atomic transaction: incomplete cross-DB
 * generations fail closed on a future reopen and require bounded cleanup.
 */
export class IndexedOccurrencePairError extends Error {
  constructor(code,detail){super(code+': '+detail);this.name='IndexedOccurrencePairError';this.code=code;}
}
const fail=(code,detail)=>{throw new IndexedOccurrencePairError(code,detail);};
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
const equal=(a,b)=>a?.sourceRefId===b?.sourceRefId&&
  a?.sourceSha256===b?.sourceSha256&&a?.sourceRevision===b?.sourceRevision;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const maxRows=4096,maxBytes=1048576;
const size=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;

function transactionDone(tx,code='PAIR_IDB_TRANSACTION_FAILED'){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(new IndexedOccurrencePairError(code,'IndexedDB transaction error'));
    tx.onabort=()=>reject(new IndexedOccurrencePairError(code,'IndexedDB transaction aborted'));
  });
}
function get(db,store,key){
  return new Promise((resolve,reject)=>{
    let req;
    try{req=db.transaction(store,'readonly').objectStore(store).get(key);}
    catch{reject(new IndexedOccurrencePairError('PAIR_READ_FAILED','IDB get unavailable'));return;}
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(new IndexedOccurrencePairError('PAIR_READ_FAILED','IDB record lookup failed'));
  });
}
function openDb(name,api){
  return new Promise((resolve,reject)=>{
    let req;
    try{req=api.open(name,1);}
    catch{reject(new IndexedOccurrencePairError('PAIR_IDB_UNAVAILABLE','native IndexedDB open required'));return;}
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('events'))
        db.createObjectStore('events',{
          keyPath:['namespace','generation','occurrenceId','kind']
        });
      if(!db.objectStoreNames.contains('heads'))
        db.createObjectStore('heads',{keyPath:'namespace'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(new IndexedOccurrencePairError('PAIR_IDB_UNAVAILABLE','IndexedDB open failed'));
    req.onblocked=()=>reject(new IndexedOccurrencePairError('PAIR_IDB_BLOCKED','IDB upgrade blocked'));
  });
}
function verifyPair(open,seal,basis){
  if(!open||!seal||open.kind!=='OPEN'||seal.kind!=='SEAL'||
    open.occurrenceId!==seal.occurrenceId||
    open.ordinal!==seal.ordinal||!count(open.ordinal)||
    !count(open.startByte)||!count(seal.endByteExclusive)||
    seal.endByteExclusive<=open.startByte||
    open.schema!=='LFJ.JSON.OccurrenceEvent.v1'||
    seal.schema!=='LFJ.JSON.OccurrenceEvent.v1'||
    !equal(open,basis)||!equal(seal,basis)||
    JSON.stringify(['lfj-json-value/v1',basis.sourceRefId,basis.sourceRevision,open.path])!==open.occurrenceId)
    fail('PAIR_CORRUPT','one exact original OPEN and SEAL with identical source basis required');
}
async function census(db,namespace,generation,basis){
  // Full commit audit is a streaming IDB cursor, never a JS Map of the index.
  // It verifies every paired identity, not merely an even global event count.
  return new Promise((resolve,reject)=>{
    let tx,req,pending=null,pairs=0,events=0;
    const rejectOnce=error=>{
      try{tx?.abort();}catch{}
      reject(error);
    };
    try{
      tx=db.transaction('events','readonly');
      const lower=[namespace,generation,'',''];
      const upper=[namespace,generation,'\uffff','\uffff'];
      req=tx.objectStore('events').openCursor(globalThis.IDBKeyRange.bound(lower,upper));
      tx.oncomplete=()=>{
        if(pending!==null)reject(new IndexedOccurrencePairError('PAIR_CORRUPT','unsealed final source occurrence'));
        else resolve({pairs,events});
      };
      tx.onerror=()=>reject(new IndexedOccurrencePairError('PAIR_IDB_READ_FAILED','event census transaction error'));
      tx.onabort=()=>reject(new IndexedOccurrencePairError('PAIR_IDB_READ_FAILED','event census aborted'));
      req.onsuccess=()=>{
        const cursor=req.result;
        if(!cursor)return;
        try{
          const row=cursor.value?.row;
          if(!row||!equal(row,basis)||typeof row.occurrenceId!=='string')
            fail('PAIR_CORRUPT','source row unavailable or wrong basis');
          events++;
          if(row.kind==='OPEN'){
            if(pending!==null)fail('PAIR_CORRUPT','missing SEAL for prior original occurrence');
            pending=row;
          }else if(row.kind==='SEAL'){
            verifyPair(pending,row,basis);
            pending=null;
            pairs++;
          }else fail('PAIR_CORRUPT','unknown original event kind');
          cursor.continue();
        }catch(error){rejectOnce(error);}
      };
      req.onerror=()=>reject(new IndexedOccurrencePairError('PAIR_IDB_READ_FAILED','event cursor failed'));
    }catch(error){rejectOnce(error);}
  });
}

/** Genuine dedicated durable lookup port, with no page-level JS accumulation. */
export async function openIndexedOccurrencePairStore({
  databaseName,namespace,generation,basis,
  indexedDB:provided=globalThis.indexedDB,beforeHeadCommit
}={}){
  if(!provided||typeof provided.open!=='function')
    fail('PAIR_IDB_UNAVAILABLE','no foreground/localStorage/in-memory fallback');
  if(!valid(databaseName)||!valid(namespace)||!valid(generation)||
    !valid(basis?.sourceRefId)||!valid(basis?.sourceSha256)||
    !valid(basis?.sourceRevision)||
    (beforeHeadCommit!==undefined&&typeof beforeHeadCommit!=='function'))
    fail('PAIR_BASIS_REQUIRED','original source identity and IDB generation required');
  const db=await openDb(databaseName,provided);
  const previous=await get(db,'heads',namespace);
  const expectedHead=previous?.generation??null;
  let state='STAGING',staged=0,busy=false,commitTx=null;
  const active=()=>{
    if(state==='ABORTED')fail('PAIR_ABORTED','stale/cancelled source generation');
    if(state==='CLOSED')fail('PAIR_CLOSED','IndexedDB connection closed');
  };
  async function head(){
    active();
    const row=await get(db,'heads',namespace);
    if(!row||row.generation!==generation||
      !equal(row.manifest,basis)||row.manifest.complete!==true||
      row.manifest.rightsBasis!=='SOURCE_FACTS_ONLY'||
      row.manifest.engineeringReady!==false)
      fail('PAIR_NOT_COMMITTED','complete original source generation not visible');
    return row;
  }
  async function rollback(){
    const tx=db.transaction(['events','heads'],'readwrite');
    const done=transactionDone(tx,'PAIR_ABORT_FAILED');
    const events=tx.objectStore('events');
    events.delete(globalThis.IDBKeyRange.bound(
      [namespace,generation,'',''],[namespace,generation,'\uffff','\uffff']));
    const heads=tx.objectStore('heads');
    const req=heads.get(namespace);
    req.onsuccess=()=>{if(req.result?.generation===generation)heads.delete(namespace);};
    await done;
  }
  async function stagePage(rows){
    active();
    if(state!=='STAGING'||busy)fail('PAIR_STAGE_BUSY','single bounded staging writer required');
    if(!Array.isArray(rows)||rows.length<1||rows.length>maxRows)
      fail('PAIR_STAGE_LIMIT','nonempty bounded source events required');
    let total=0;
    for(const row of rows){
      if(!row||!equal(row,basis)||!['OPEN','SEAL'].includes(row.kind)||
        typeof row.occurrenceId!=='string'||row.occurrenceId.length>67584||
        !count(row.ordinal))
        fail('PAIR_STAGE_ROW','attested exact source OPEN/SEAL event required');
      total+=size(row);
      if(total>maxBytes)fail('PAIR_STAGE_LIMIT','source-event batch exceeds 1MiB');
    }
    busy=true;
    try{
      const old=await get(db,'heads',namespace);
      if(old?.generation===generation)fail('PAIR_ALREADY_COMMITTED','cannot rewrite committed source');
      const tx=db.transaction('events','readwrite');
      const done=transactionDone(tx);
      const records=tx.objectStore('events');
      for(const row of rows)records.add({namespace,generation,occurrenceId:row.occurrenceId,
        kind:row.kind,row});
      await done;
      if(state!=='STAGING'){await rollback();fail('PAIR_ABORTED','late source stage revoked');}
      staged+=rows.length;
    }catch(e){state='ABORTED';await rollback();throw e;}
    finally{busy=false;}
  }
  async function commitDurably(manifest){
    active();
    if(state!=='STAGING'||busy||manifest?.schema!=='LFJ.JSON.OccurrenceIndexSummary.v1'||
      manifest.complete!==true||!equal(manifest,basis)||
      manifest.rightsBasis!=='SOURCE_FACTS_ONLY'||manifest.engineeringReady!==false||
      !count(manifest.eventCount)||manifest.eventCount!==staged||
      !count(manifest.occurrenceCount)||manifest.eventCount!==manifest.occurrenceCount*2)
      fail('PAIR_MANIFEST_MISMATCH','complete exact source census/commit required');
    state='VERIFYING';
    try{
      const verified=await census(db,namespace,generation,basis);
      if(verified.events!==staged||verified.pairs!==manifest.occurrenceCount)
        fail('PAIR_CORRUPT','original source occurrence census does not pair exactly');
      if(state!=='VERIFYING')fail('PAIR_ABORTED','commit verification revoked');
      state='COMMITTING';
      const tx=db.transaction('heads','readwrite');
      commitTx=tx;
      const done=transactionDone(tx,'PAIR_COMMIT_ABORTED');
      const heads=tx.objectStore('heads'),request=heads.get(namespace);
      request.onsuccess=()=>{
        if((request.result?.generation??null)!==expectedHead){tx.abort();return;}
        heads.put({namespace,generation,count:staged,manifest});
        // This hook exists for a *real IDB* failure injection: request
        // enqueue is not the transaction.complete durability frontier.
        try{beforeHeadCommit?.(tx);}catch{tx.abort();}
      };
      await done;
      if(state!=='COMMITTING')fail('PAIR_ABORTED','cancel raced durable source commit');
      state='COMMITTED';
      return Object.freeze({...manifest});
    }catch(error){state='ABORTED';await rollback();throw error;}
    finally{commitTx=null;}
  }
  async function lookupCommittedPair(occurrenceId){
    await head();
    if(typeof occurrenceId!=='string'||occurrenceId.length<1||occurrenceId.length>67584)
      fail('INVALID_OCCURRENCE','exact original source ID required');
    const open=await get(db,'events',[namespace,generation,occurrenceId,'OPEN']);
    const seal=await get(db,'events',[namespace,generation,occurrenceId,'SEAL']);
    verifyPair(open?.row,seal?.row,basis);
    await head(); // prevents borrowing an old generation after await
    return {open:open.row,seal:seal.row};
  }
  async function abort(){
    if(state==='CLOSED')return;
    state='ABORTED';
    try{commitTx?.abort();}catch{}
    await rollback();
  }
  function close(){db.close();state='CLOSED';}
  return Object.freeze({stagePage,commitDurably,lookupCommittedPair,abort,close});
}

/**
 * Coordinate original STORE-GATE's real source head with sidecar pair head.
 * R07 awaits the composed commitDurably before SOURCE_INDEX_COMPLETE; after
 * first-head success a failed second head rolls back the first (best effort).
 * Cross-database power-loss atomicity is not asserted; an orphaned first head
 * is not a package SourceSession ready state and must never be reused alone.
 */
export function createPairedIndexStore({indexStore,pairPort}={}){
  if(!indexStore||typeof indexStore.commitDurably!=='function'||
    typeof indexStore.stagePage!=='function'||typeof indexStore.readOrdered!=='function'||
    typeof indexStore.abort!=='function'||!pairPort||
    ['stagePage','commitDurably','lookupCommittedPair','abort'].some(k=>typeof pairPort[k]!=='function'))
    fail('PAIR_PORT_REQUIRED','genuine durable source store and committed pair port required');
  // A second database is not an authority on its own: validate the original
  // durable R07 source HEAD around the pair lookup. readOrdered() performs a
  // keyed source-head read, then reads only the first OPEN row; we never
  // enumerate a full source index or build a whole-file map for each value.
  async function attestOriginalHead(){
    const iterator=indexStore.readOrdered()[Symbol.asyncIterator]();
    try{
      const first=await iterator.next();
      if(first.done)fail('PAIR_SOURCE_UNCOMMITTED',
        'JSON source must have a committed root OPEN in the original R07 index');
    }finally{await iterator.return?.();}
  }
  return Object.freeze({
    async stagePage(rows){
      try{
        await indexStore.stagePage(rows);
        await pairPort.stagePage(rows);
      }catch(error){
        await Promise.allSettled([indexStore.abort(),pairPort.abort()]);
        throw error;
      }
    },
    commit(){fail('PAIR_DURABLE_REQUIRED','R07 must await both transaction.complete receipts');},
    async commitDurably(manifest){
      await indexStore.commitDurably(manifest);
      try{return await pairPort.commitDurably(manifest);}
      catch(error){await Promise.allSettled([indexStore.abort(),pairPort.abort()]);throw error;}
    },
    async abort(){await Promise.allSettled([indexStore.abort(),pairPort.abort()]);},
    readOrdered:()=>indexStore.readOrdered(),
    async lookupCommittedPair(id){
      await attestOriginalHead();
      const pair=await pairPort.lookupCommittedPair(id);
      await attestOriginalHead(); // revocation may race awaited sidecar reads
      return pair;
    }
  });
}
