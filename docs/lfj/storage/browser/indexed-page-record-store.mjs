/**
 * O1/W02: bounded PAGE-granular, genuine IndexedDB committed source index.
 * One page write per R05 PAGE_ACK, not one IndexedDB put per OPEN/SEAL fact.
 * The existing R07/R10 Worker, tokenizer and source-fact shapes are unchanged.
 * Source-only committed head is NOT XML match or engineering/export authority.
 */
import {IndexedStoreError} from './indexed-record-store.mjs';

const error=(code,message)=>new IndexedStoreError(code,message);
const requireValue=(ok,code,message)=>{if(!ok)throw error(code,message);};
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
const basisEquals=(a,b)=>a?.sourceRefId===b?.sourceRefId&&
  a?.sourceSha256===b?.sourceSha256&&a?.sourceRevision===b?.sourceRevision;
const MAX_ROWS=4096,MAX_BYTES=1048576;
const sizeOf=o=>new TextEncoder().encode(JSON.stringify(o)).byteLength;
function result(request,code){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result??null);
    request.onerror=()=>reject(error(code,'IndexedDB request failed'));
  });
}
function finished(tx,code){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(error(code,'IndexedDB transaction aborted'));
    tx.onerror=()=>reject(error(code,'IndexedDB transaction failed'));
  });
}
async function read(db,store,key){
  return result(db.transaction(store,'readonly').objectStore(store).get(key),'PAGE_READ_FAILED');
}
function open(databaseName,api){
  return new Promise((resolve,reject)=>{
    const req=api.open(databaseName,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      db.createObjectStore('pages',{keyPath:['namespace','generation','page']});
      db.createObjectStore('heads',{keyPath:'namespace'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(error('PAGE_STORE_UNAVAILABLE','cannot open native IndexedDB'));
    req.onblocked=()=>reject(error('PAGE_STORE_BLOCKED','database upgrade is blocked'));
  });
}
/** Existing source-only R05 contract, with bounded per-page storage and pair reads. */
export async function openIndexedPageRecordStore({
  databaseName,namespace,generation,basis,kind='source',selectionDigest,jobEpoch,
  indexedDB:api=globalThis.indexedDB
}={}){
  requireValue(api&&typeof api.open==='function','PAGE_STORE_UNAVAILABLE','native IndexedDB required');
  requireValue(valid(databaseName)&&valid(namespace)&&valid(generation)&&
    valid(basis?.sourceRefId)&&valid(basis?.sourceSha256)&&valid(basis?.sourceRevision)&&
    ['source','selection'].includes(kind),'PAGE_STORE_BASIS','exact source basis and generation required');
  if(kind==='selection')requireValue(valid(selectionDigest)&&valid(jobEpoch),
    'PAGE_STORE_SELECTION','selection and epoch required');
  const db=await open(databaseName,api);
  const initial=await read(db,'heads',namespace);
  const expectedHead=initial?.generation??null;
  let phase='STAGING',page=0,count=0,active=null;
  const lengths=[];
  const guard=()=>requireValue(phase!=='ABORTED'&&phase!=='CLOSED',
    'PAGE_STORE_CLOSED','aborted or closed store');
  const committed=async()=>{
    guard();
    const h=await read(db,'heads',namespace);
    requireValue(h?.generation===generation&&h.kind===kind&&
      h.manifest?.complete===true&&h.manifest?.rightsBasis==='SOURCE_FACTS_ONLY'&&
      h.manifest?.engineeringReady===false&&basisEquals(h.manifest,basis)&&
      (kind==='source'||h.manifest.selectionDigest===selectionDigest&&h.manifest.jobEpoch===jobEpoch),
      'PAGE_NOT_COMMITTED','exact original source committed head required');
    return h;
  };
  async function stagePage(rows){
    guard();
    requireValue(phase==='STAGING'&&!active,'PAGE_STAGE_BUSY','one outstanding page write allowed');
    requireValue(Array.isArray(rows)&&rows.length>0&&rows.length<=MAX_ROWS,
      'PAGE_STAGE_LIMIT','invalid page count');
    let byteLength=2;
    for(const row of rows){
      requireValue(basisEquals(row,basis)&&
        (kind==='source'?['OPEN','SEAL'].includes(row.kind):row.kind==='OPEN'),
        'PAGE_STAGE_BASIS','wrong original source or event kind');
      byteLength+=sizeOf(row)+1;
    }
    requireValue(byteLength<=MAX_BYTES,'PAGE_STAGE_LIMIT','serialized page exceeds 1 MiB');
    active=true;
    const tx=db.transaction('pages','readwrite');const done=finished(tx,'PAGE_STAGE_FAILED');
    tx.objectStore('pages').put({namespace,generation,page,start:count,rows});
    try{
      await done;
      requireValue(phase==='STAGING','PAGE_ABORTED','late staged page was revoked');
      lengths.push(rows.length);count+=rows.length;page++;
    }catch(e){phase='ABORTED';await rollback();throw e;}
    finally{active=null;}
  }
  async function commit(manifest){
    guard();requireValue(phase==='STAGING'&&!active,'PAGE_COMMIT_BUSY','page pending');
    requireValue(manifest?.complete===true&&basisEquals(manifest,basis)&&
      manifest.rightsBasis==='SOURCE_FACTS_ONLY'&&manifest.engineeringReady===false,
      'PAGE_MANIFEST','exact complete source-only manifest required');
    if(kind==='source')requireValue(manifest.schema==='LFJ.JSON.OccurrenceIndexSummary.v1'&&
      manifest.eventCount===count&&manifest.occurrenceCount*2===count,
      'PAGE_MANIFEST','incomplete OPEN/SEAL source census');
    else requireValue(manifest.schema==='LFJ.CommittedSelectionPageManifest.v1'&&
      manifest.selectedCount===count&&manifest.selectionDigest===selectionDigest&&
      manifest.jobEpoch===jobEpoch,'PAGE_MANIFEST','wrong selected page manifest');
    phase='COMMITTING';
    const tx=db.transaction('heads','readwrite');active=tx;
    const done=finished(tx,'PAGE_COMMIT_FAILED');
    const heads=tx.objectStore('heads'),check=heads.get(namespace);
    let stale=false;
    check.onsuccess=()=>{
      if((check.result?.generation??null)!==expectedHead){stale=true;tx.abort();return;}
      heads.put({namespace,generation,kind,count,pageCount:page,manifest});
    };
    try{
      await done;
      requireValue(phase!=='ABORTED','PAGE_ABORTED','commit canceled');
      phase='COMMITTED';return Object.freeze({...manifest});
    }catch(e){phase='ABORTED';await rollback();
      if(stale)throw error('PAGE_STORE_SUPERSEDED','committed head moved');
      throw e;
    }finally{active=null;}
  }
  async function rollback(){
    if(phase==='CLOSED')return;
    const tx=db.transaction(['pages','heads'],'readwrite');const done=finished(tx,'PAGE_ABORT_FAILED');
    const p=tx.objectStore('pages');
    p.delete(globalThis.IDBKeyRange.bound([namespace,generation,0],
      [namespace,generation,Number.MAX_SAFE_INTEGER]));
    const h=tx.objectStore('heads'),q=h.get(namespace);
    q.onsuccess=()=>{if(q.result?.generation===generation)h.delete(namespace);};
    await done;
  }
  async function abort(){
    if(phase==='CLOSED')return;
    phase='ABORTED';
    try{active?.abort?.();}catch{}
    await rollback();
  }
  async function *readOrdered(){
    requireValue(kind==='source','PAGE_KIND','source index required');
    const h=await committed();
    for(let i=0;i<h.pageCount;i++){
      const p=await read(db,'pages',[namespace,generation,i]);
      requireValue(p?.page===i&&p.start>=0&&Array.isArray(p.rows)&&p.rows.length,
        'PAGE_ROW_MISSING','missing committed source page');
      for(const row of p.rows){
        requireValue(basisEquals(row,basis),'PAGE_SOURCE_STALE','wrong committed source row');
        if(row.kind==='OPEN')yield row;
      }
    }
  }
  async function *readCommittedPages(){
    requireValue(kind==='source','PAGE_KIND','source index required');
    const h=await committed();
    for(let i=0;i<h.pageCount;i++){
      const p=await read(db,'pages',[namespace,generation,i]);
      requireValue(p?.page===i&&p.start>=0&&Array.isArray(p.rows)&&
        p.rows.length>0&&p.rows.length<=MAX_ROWS,
        'PAGE_ROW_MISSING','missing bounded committed source page');
      for(const row of p.rows)
        requireValue(basisEquals(row,basis)&&['OPEN','SEAL'].includes(row.kind),
          'PAGE_SOURCE_STALE','source page contains foreign or invalid event');
      await committed();
      yield Object.freeze({page:i,rows:p.rows});
    }
    await committed();
  }
  async function lookupCommittedPair(occurrenceId){
    requireValue(kind==='source'&&typeof occurrenceId==='string'&&occurrenceId.length>0&&
      occurrenceId.length<=67584,'PAGE_PAIR_INPUT','exact original occurrence required');
    const h=await committed();let foundOpen=null,foundSeal=null;
    // Each read materializes <= 1 MiB; no whole-index map or provisional reads.
    for(let i=0;i<h.pageCount;i++){
      const p=await read(db,'pages',[namespace,generation,i]);
      requireValue(p?.page===i&&Array.isArray(p.rows),'PAGE_ROW_MISSING','missing source page');
      for(const row of p.rows){
        if(row.occurrenceId!==occurrenceId)continue;
        requireValue(basisEquals(row,basis),'PAGE_SOURCE_STALE','wrong source pair basis');
        if(row.kind==='OPEN'){requireValue(!foundOpen,'PAGE_PAIR_DUPLICATE','duplicate OPEN');foundOpen=row;}
        else if(row.kind==='SEAL'){requireValue(!foundSeal,'PAGE_PAIR_DUPLICATE','duplicate SEAL');foundSeal=row;}
      }
      if(foundOpen&&foundSeal)break;
    }
    requireValue(foundOpen&&foundSeal&&foundOpen.ordinal===foundSeal.ordinal,
      'PAGE_PAIR_MISSING','both committed OPEN and SEAL events required');
    await committed(); // re-attest durable head after separately awaited page reads
    return Object.freeze({open:foundOpen,seal:foundSeal});
  }
  async function readRange(start,maxRows,maxBytes){
    requireValue(kind==='selection','PAGE_KIND','selected-result index required');
    requireValue(Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(maxRows)&&
      maxRows>0&&maxRows<=MAX_ROWS&&Number.isSafeInteger(maxBytes)&&maxBytes>=256&&
      maxBytes<=MAX_BYTES,'PAGE_READ_LIMIT','bounded page request required');
    const h=await committed(),rows=[];let size=0;
    for(let i=0;i<h.pageCount&&rows.length<maxRows;i++){
      const p=await read(db,'pages',[namespace,generation,i]);
      requireValue(p?.page===i&&Array.isArray(p.rows),'PAGE_ROW_MISSING','missing selection page');
      if(p.start+p.rows.length<=start)continue;
      for(let j=Math.max(0,start-p.start);j<p.rows.length&&rows.length<maxRows;j++){
        const row=p.rows[j];requireValue(basisEquals(row,basis),
          'PAGE_SOURCE_STALE','wrong source selected row');
        const bytes=sizeOf(row);if(size+bytes>maxBytes)return rows;
        rows.push(row);size+=bytes;
      }
    }
    await committed();return rows;
  }
  function close(){if(phase==='CLOSED')return;db.close();phase='CLOSED';}
  return Object.freeze({stagePage,commit,commitDurably:commit,abort,
    readOrdered,readCommittedPages,lookupCommittedPair,readRange,close,
    note:'O1 native IDB one transaction/write per bounded original event page'});
}
