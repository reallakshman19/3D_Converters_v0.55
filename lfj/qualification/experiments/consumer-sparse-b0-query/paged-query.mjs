/**
 * #1147/B0 — Source-only READ port for the experimental packed catalog.
 *
 * Read-only against complete committed PAGE + ordinal DIRECTORY generations.
 * Original immutable Blob custody is reattested by streaming SHA-256.
 * Cursor references SELECTED ordinal position (not visual row limit).
 *
 * This module is NOT the production R08/R09 API or ENGINEERING_EXPORT authority.
 */
import {openBlobSourceSnapshot} from '../../../source/source-snapshot.mjs';

export class B0QueryError extends Error {
  constructor(code,detail){super(code+': '+detail);this.name='B0QueryError';this.code=code;}
}
const fail=(code,detail)=>{throw new B0QueryError(code,detail);};
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const ROOT='LFJ.B0.PagedOccurrenceResearch.v1';
const RANGE_MAX=4096, ROW_LIMIT=512, WIRE_MAX=1024*1024;
const valueSize=x=>new TextEncoder().encode(JSON.stringify(x)).length;
const request=(store,key)=>new Promise((resolve,reject)=>{
  const r=store.get(key);
  r.onsuccess=()=>resolve(r.result??null);
  r.onerror=()=>reject(r.error??new Error('IDB read error'));
});
async function openDb(name){
  return await new Promise((resolve,reject)=>{
    // IMPORTANT: no auto-create of missing source generation.
    const r=indexedDB.open(name);
    let upgraded=false;
    r.onupgradeneeded=()=>{upgraded=true;r.transaction.abort();};
    r.onsuccess=()=>upgraded?(r.result.close(),reject(new B0QueryError(
      'SOURCE_NOT_FOUND','source catalog database is absent'))):resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
function normalize(selection,size){
  if(!selection||selection.kind==='ALL')
    return {kind:'ALL',ranges:[[0,size]],total:size};
  if(selection.kind==='NONE')return {kind:'NONE',ranges:[],total:0};
  if(selection.kind!=='RANGES'||!Array.isArray(selection.ranges)||
     selection.ranges.length===0||selection.ranges.length>RANGE_MAX)
    fail('SELECTION_INVALID','explicit selection must contain 1..4096 ordered ranges');
  let previous=0,total=0;
  const ranges=selection.ranges.map((range,i)=>{
    if(!Array.isArray(range)||range.length!==2||!whole(range[0])||
       !whole(range[1])||range[0]>=range[1]||range[1]>size||
       (i>0&&range[0]<previous))
      fail('SELECTION_INVALID','source-ordinal ranges must be ordered and non-overlapping');
    previous=range[1];
    total+=range[1]-range[0];
    return Object.freeze([range[0],range[1]]);
  });
  return {kind:'RANGES',ranges,total};
}
function selectedOrdinal(selection,offset){
  if(!whole(offset)||offset>=selection.total)
    fail('CURSOR_INVALID','selected cursor beyond complete original selection');
  let consumed=0;
  for(const [start,end] of selection.ranges){
    const n=end-start;
    if(offset<consumed+n)return start+(offset-consumed);
    consumed+=n;
  }
  fail('SELECTION_CORRUPT','no source ordinal for selected cursor');
}
export async function openPagedSourceQuery({
  databaseName,generation,blob,expectedSha256,
  sourceRevisionLabel='B0-QUERY',selection={kind:'ALL'}
}={}){
  if(typeof databaseName!=='string'||!databaseName||
     typeof generation!=='string'||!generation||!(blob instanceof Blob)||
     !/^[a-f0-9]{64}$/.test(expectedSha256||''))
    fail('SOURCE_BINDING_INVALID','exact original Blob/sourceSHA/generation required');

  // No full 30MB buffer ever crosses main JS or Worker boundary.
  const snapshot=await openBlobSourceSnapshot(blob,{
    revision:sourceRevisionLabel,expectedSha256
  });
  let db,closed=false;
  try{
    db=await openDb(databaseName);
    const head=await request(db.transaction('heads','readonly').objectStore('heads'),'active');
    if(!head||head.schema!==ROOT||!head.complete||
       head.generation!==generation||head.sourceSha256!==expectedSha256||
       head.originalBytes!==blob.size||!whole(head.occurrenceCount)||
       !whole(head.pageCount)||head.directorySize!==4096)
      fail('SOURCE_NOT_COMMITTED','no matching exact durable source catalog HEAD');
    const selected=normalize(selection,head.occurrenceCount);
    // Cache only one original source PAGE and one directory bucket. A full
    // traversal issues O(pages+directory blocks), never O(source occurrences).
    let lastDirectory=-1,dir=null,lastPage=-1,page=null;
    const check=()=>{
      if(closed)fail('SOURCE_CLOSED','source query is closed');
    };
    // This query caches a pinned catalog generation for bounded reads.
    // Re-attest its *current active HEAD* at a consumer transaction boundary.
    // The original Blob SHA alone does not detect a concurrently superseded
    // catalog; a source-only result cannot be published from a lost lease.
    const headIdentity=JSON.stringify(head);
    async function assertActive(){
      check();
      const current=await request(db.transaction('heads','readonly')
        .objectStore('heads'),'active');
      if(!current||!current.complete||
         JSON.stringify(current)!==headIdentity)
        fail('SOURCE_SUPERSEDED',
          'original source catalog HEAD changed during consumer operation');
      return true;
    }
    async function byOrdinal(ordinal){
      check();
      if(!whole(ordinal)||ordinal>=head.occurrenceCount)
        fail('OCCURRENCE_INVALID','source ordinal outside complete HEAD');
      const bucket=Math.floor(ordinal/head.directorySize);
      if(lastDirectory!==bucket){
        dir=await request(db.transaction('directory','readonly')
          .objectStore('directory'),[generation,bucket]);
        if(!dir||dir.generation!==generation||dir.bucket!==bucket||
           dir.pageRefs?.length!==Math.min(4096,head.occurrenceCount-bucket*4096)||
           dir.rowRefs?.length!==dir.pageRefs.length)
          fail('DIRECTORY_CORRUPT','missing or invalid ordinal directory block');
        lastDirectory=bucket;
      }
      const idx=ordinal%4096;
      const pageNo=dir.pageRefs[idx]-1,slot=dir.rowRefs[idx];
      if(!whole(pageNo)||pageNo>=head.pageCount||!whole(slot)||slot>=384)
        fail('DIRECTORY_CORRUPT','invalid page ordinal/slot reference');
      if(lastPage!==pageNo){
        page=await request(db.transaction('pages','readonly')
          .objectStore('pages'),[generation,pageNo]);
        if(!page||page.generation!==generation||page.pageNo!==pageNo||
           !Array.isArray(page.rows)||page.rows.length<1||page.rows.length>384)
          fail('SOURCE_PAGE_CORRUPT','missing, wrong or unbounded source page');
        lastPage=pageNo;
      }
      const r=page.rows[slot];
      if(!r||r.ordinal!==ordinal||!whole(r.startByte)||!whole(r.endByteExclusive)||
         r.endByteExclusive<=r.startByte||r.endByteExclusive>blob.size||
         (ordinal===0&&r.parent!==null)||
         (ordinal>0&&(!whole(r.parent)||r.parent>=ordinal)))
        fail('SOURCE_PAGE_CORRUPT','ordinal/span/parent inconsistency');
      return Object.freeze({...r});
    }
    async function readPage({cursor=0,maxRows=100,maxBytes=65536}={}){
      check();
      if(!whole(cursor)||cursor>selected.total)
        fail('CURSOR_INVALID','cursor exceeds selected row count');
      if(!whole(maxRows)||maxRows<1||maxRows>ROW_LIMIT||
         !whole(maxBytes)||maxBytes<256||maxBytes>WIRE_MAX)
        fail('PAGE_LIMIT','maxRows 1..512, full-envelope maxBytes 256..1MiB');
      const rows=[];
      let encodedRows=0;
      const envelope=(cursorNext,prefix)=>({
        schema:'LFJ.B0.SourcePage.v1',sourceSha256:head.sourceSha256,
        generation,selectionKind:selected.kind,
        totalCount:selected.total,cursor,nextCursor:cursorNext,
        complete:cursorNext===selected.total,rows:prefix
      });
      let next=cursor;
      while(next<selected.total&&rows.length<maxRows){
        const row=await byOrdinal(selectedOrdinal(selected,next));
        // Charge each source record once. Prefix-fit includes the complete
        // response envelope and changing cursor, not just record payloads.
        const candidateBytes=valueSize(envelope(next+1,[]))+
          encodedRows+valueSize(row)+(rows.length?1:0);
        if(candidateBytes>maxBytes){
          if(rows.length===0)
            fail('SOURCE_ROW_TOO_LARGE','single source catalog row cannot fit envelope');
          break;
        }
        encodedRows+=valueSize(row)+(rows.length?1:0);
        rows.push(row);next++;
      }
      const output=envelope(next,rows);
      if(valueSize(output)>maxBytes||next===cursor&&cursor<selected.total)
        fail('PAGE_WIRE_BUDGET','failed to produce a progressing full-envelope page');
      return Object.freeze(output);
    }
    return Object.freeze({
      schema:'LFJ.B0.QuerySession.v1',sourceSha256:head.sourceSha256,
      sourceRevision:head.sourceRevision,generation,
      originalBytes:blob.size,sourceCount:head.occurrenceCount,
      selectionKind:selected.kind,selectedCount:selected.total,
      sourceOnly:true,engineeringReady:false,
      readOrdinal:byOrdinal,readPage,assertActive,
      async readOriginalRange(start,end){
        check();
        return snapshot.readRange(start,end,snapshot.revision);
      },
      close(){if(closed)return;closed=true;snapshot.close();db.close();}
    });
  }catch(e){
    snapshot.close();db?.close();
    throw e;
  }
}
