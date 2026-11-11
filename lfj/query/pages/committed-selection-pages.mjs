/**
 * LFJ R09 — bounded, source-revision-fenced paging of a committed R08 selection.
 *
 * The injected store MUST provide indexed offset reads and atomic commit/abort.
 * It is NOT an in-memory full-source collector or a browser persistence backend.
 * R08 stages provisional pages once; repeated readPage calls NEVER redo R08/R05.
 * No Resolver/engineering/CII interpretation or export authority.
 */
export class SelectionPageError extends Error {
  constructor(code, detail) {
    super(code + ': ' + detail);
    this.name='SelectionPageError';
    this.code=code;
  }
}
const fail=(code,detail)=>{throw new SelectionPageError(code,detail);};
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=1024;
// R05 permits JSON pointer-bound occurrence identities up to 67,584 code units.
const validOccurrenceId=s=>typeof s==='string'&&s.length>0&&s.length<=67584;
const same=(a,b)=>a&&typeof a==='object'&&
  a.sourceRefId===b.sourceRefId&&a.sourceSha256===b.sourceSha256&&
  a.sourceRevision===b.sourceRevision;
const size=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
const LIMIT_ROWS=4096,LIMIT_BYTES=1048576;
function limits(rows,bytes){
  if(!Number.isSafeInteger(rows)||rows<1||rows>LIMIT_ROWS||
    !Number.isSafeInteger(bytes)||bytes<256||bytes>LIMIT_BYTES)
    fail('PAGE_LIMIT','rows 1..4096 and bytes 256..1048576 required');
}
function basisCheck(sourceBasis){
  if(!valid(sourceBasis?.sourceRefId)||!valid(sourceBasis?.sourceSha256)||
    !valid(sourceBasis?.sourceRevision))
    fail('SOURCE_BASIS_REQUIRED','original source identity and revision required');
}
export function createCommittedSelectionPager({
  store,sourceBasis,selectionDigest,jobEpoch,getCurrentBasis
}={}){
  basisCheck(sourceBasis);
  if(!valid(selectionDigest)||!valid(jobEpoch)||
     (getCurrentBasis!==undefined&&typeof getCurrentBasis!=='function'))
    fail('INVALID_PAGING_BASIS','selection digest and job epoch required');
  if(!store||['stagePage','commit','abort','readRange'].some(k=>typeof store[k]!=='function'))
    fail('PAGED_STORE_REQUIRED','indexed staging, atomic commit, rollback, readRange required');
  if(typeof globalThis.crypto?.randomUUID!=='function')
    fail('CURSOR_CRYPTO_UNAVAILABLE','unpredictable scoped cursor capability required');
  const basis=Object.freeze({...sourceBasis});
  const encoder=new TextEncoder();
  let state='STAGING',stagedCount=0,lastOrdinal=-1,busy=false,reading=false;
  let terminalManifest=null,nextCursor=null,nextOffset=0,lastPageOrdinal=-1,usedFirst=false;
  const current=()=>{
    if(getCurrentBasis===undefined)return;
    let candidate;
    try{candidate=getCurrentBasis();}catch{
      fail('SOURCE_STALE','live original source cannot be attested');
    }
    if(!same(candidate,basis))
      fail('SOURCE_STALE','original source was changed or superseded');
  };
  function checkRequested({sourceBasis:requested,selectionDigest:digest,jobEpoch:epoch}){
    basisCheck(requested);
    if(!same(requested,basis))fail('SOURCE_STALE','request is for a changed original source');
    if(digest!==selectionDigest||epoch!==jobEpoch)
      fail('CURSOR_STALE','scope or execution epoch differs from completed selection');
  }
  async function rollbackStore(){
    try{await store.abort();}catch{
      // Remain fail-closed. The external store still owes durable rollback;
      // this session will never publish or read an unproven committed result.
    }
  }
  async function abort(){
    state='ABORTED';
    terminalManifest=null;nextCursor=null;
    // Repeat rollback after a late stage/commit finishes. Idempotent rollback
    // is part of the injected store contract, not a one-shot UI cleanup.
    await rollbackStore();
  }
  async function stageSelectedPage(page){
    if(state!=='STAGING'||busy)fail('STAGE_NOT_ACTIVE','no concurrent or late selection staging');
    current();
    if(!Array.isArray(page)||page.length<1||page.length>LIMIT_ROWS)
      fail('STAGE_PAGE_INVALID','nonempty bounded selection page required');
    let previous=lastOrdinal,sum=0;
    for(const row of page){
      if(row?.kind!=='OPEN'||!same(row,basis)||
        !validOccurrenceId(row.occurrenceId)||
        !Number.isSafeInteger(row.ordinal)||row.ordinal<=previous)
        fail('STAGE_ROW_INVALID','original source ordered OPEN occurrence required');
      previous=row.ordinal;
      sum+=encoder.encode(JSON.stringify(row)).byteLength;
      if(sum>LIMIT_BYTES)fail('STAGE_PAGE_LIMIT','one provisional staged page exceeds byte cap');
    }
    busy=true;
    try{
      await store.stagePage(Object.freeze(page.map(row=>Object.freeze({...row}))));
      if(state!=='STAGING')fail('STAGE_NOT_ACTIVE','stage completed after cancellation');
      current();
      stagedCount+=page.length;lastOrdinal=previous;
    }catch(error){
      await abort();
      throw error;
    }finally{
      busy=false;
      if(state==='ABORTED')await rollbackStore();
    }
  }
  async function commitSelection(summary){
    if(state!=='STAGING'||busy)fail('SELECTION_NOT_READY','source selection still staging or terminal');
    current();
    if(summary?.schema!=='LFJ.OccurrenceSelectionSummary.v1'||
      summary.complete!==true||!same(summary,basis)||
      summary.rightsBasis!=='SOURCE_FACTS_ONLY'||
      summary.engineeringReady!==false||
      !Number.isSafeInteger(summary.scannedCount)||summary.scannedCount<0||
      summary.selectedCount!==stagedCount||stagedCount>summary.scannedCount)
      fail('SELECTION_INCOMPLETE','complete R08 source-only selection matching staged count required');
    state='COMMITTING';
    const candidate=Object.freeze({
      schema:'LFJ.CommittedSelectionPageManifest.v1',
      complete:true,...basis,selectionDigest,jobEpoch,
      selectedCount:stagedCount,scannedCount:summary.scannedCount,
      rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
    });
    try{
      await store.commit(candidate);
      if(state!=='COMMITTING')fail('SELECTION_SUPERSEDED','selection was aborted during storage commit');
      current();
      terminalManifest=candidate;state='COMMITTED';
      return candidate;
    }catch(error){
      await abort();throw error;
    }
  }
  async function readPage({
    cursor=null,maxRows=256,maxBytes=65536,
    sourceBasis:requested,selectionDigest:digest,jobEpoch:epoch
  }={}){
    if(state!=='COMMITTED'||!terminalManifest)
      fail('SELECTION_NOT_COMMITTED','R08 source-only selection must commit before page access');
    if(reading)fail('PAGE_READ_BUSY','one sequential pager reader per committed selection');
    checkRequested({sourceBasis:requested,selectionDigest:digest,jobEpoch:epoch});
    limits(maxRows,maxBytes);current();
    if(!usedFirst){
      if(cursor!==null)fail('INVALID_CURSOR','first page requires null cursor');
    }else if(typeof cursor!=='string'||!nextCursor||cursor!==nextCursor)
      fail('INVALID_CURSOR','cursor is expired, forged or from a different selection session');
    reading=true;
    try{
      const start=nextOffset,total=terminalManifest.selectedCount;
      let rows=[];
      if(start<total){
        rows=await store.readRange(start,maxRows,maxBytes);
        if(!Array.isArray(rows)||rows.length>maxRows||rows.length>total-start)
          fail('PAGE_STORE_INVALID','indexed store returned out-of-bounds page');
        // Empty ranges are distinguished below: an oversized first record
        // versus a physically missing committed row.
      }
      if(state!=='COMMITTED')
        fail('PAGE_SESSION_ABORTED','indexed page was read after cancellation');
      current();
      // Validate the whole bounded backend batch *before* deciding which
      // prefix to publish. A corrupted late row must not be hidden by
      // envelope-fitting: its source/epoch/ordinal basis remains authoritative.
      let rowBytes=0,previous=lastPageOrdinal;
      const widths=[];
      for(const row of rows){
        if(row?.kind!=='OPEN'||!same(row,basis)||
           !validOccurrenceId(row.occurrenceId)||!Number.isSafeInteger(row.ordinal)||
           row.ordinal<=previous)
          fail('PAGE_ROW_INVALID','paged source record is not complete, ordered or current');
        previous=row.ordinal;
        const width=size(row);
        rowBytes+=width;
        if(rowBytes>maxBytes)
          fail('PAGE_STORE_OVERLIMIT','backend exceeded requested serialized row byte cap');
        widths.push(width);
      }
      // The caller budgets the *entire* JSON wire envelope, not only records.
      // Compute a fixed empty-envelope size for both cursor modes once; each
      // row contributes its serialized bytes plus exactly one array comma.
      // This is O(bounded returned records), not repeated whole-page stringify.
      const candidateToken=globalThis.crypto.randomUUID();
      const envelope=(selected,token,complete)=>({
        schema:'LFJ.CommittedSelectionPage.v1',complete,
        rows:selected,cursor:token,totalCount:total,...basis,
        selectionDigest,jobEpoch,rightsBasis:'SOURCE_FACTS_ONLY',
        engineeringReady:false
      });
      const nonterminalOverhead=size(envelope([],candidateToken,false));
      const terminalOverhead=size(envelope([],null,true));
      let fitting=0,cumulative=0;
      for(let i=0;i<rows.length;i++){
        cumulative+=widths[i];
        const count=i+1,terminal=start+count===total;
        const envelopeBytes=(terminal?terminalOverhead:nonterminalOverhead)+
          cumulative+(count-1); // JSON commas between serialized row entries
        if(envelopeBytes<=maxBytes)fitting=count;
      }
      if(start<total&&fitting===0){
        // A row which cannot fit with the required source+cursor envelope
        // must fail with an explicit typed error; never emit an empty page
        // and consume a cursor, and never silently omit that occurrence.
        if(rows.length===0){
          // Distinguish a physically absent committed row from a row whose
          // own serialized bytes exhaust the caller's page budget.
          const probe=await store.readRange(start,1,LIMIT_BYTES);
          if(!Array.isArray(probe)||probe.length!==1)
            fail('PAGE_STORE_INCOMPLETE','committed store has no first row at offset');
        }
        fail('PAGE_WIRE_OVERLIMIT','single source record plus required page envelope exceeds byte cap');
      }
      if(start<total&&rows.length===0)
        fail('PAGE_STORE_INCOMPLETE','committed store has no page at expected indexed offset');
      const offset=start+fitting,complete=offset===total;
      const token=complete?null:candidateToken;
      const chosen=rows.slice(0,fitting);
      const output=Object.freeze(envelope(
        Object.freeze(chosen.map(row=>Object.freeze({...row}))),token,complete
      ));
      // Recheck exact actual serialized representation rather than trusting
      // even a mathematically equivalent estimate from an injected store.
      if(size(output)>maxBytes)
        fail('PAGE_WIRE_OVERLIMIT','serialized page envelope exceeds byte cap');
      // Advance only after the complete response and its budget are validated.
      nextOffset=offset;nextCursor=token;
      lastPageOrdinal=fitting?rows[fitting-1].ordinal:lastPageOrdinal;
      usedFirst=true;
      return output;
    }finally{reading=false;}
  }
  return Object.freeze({stageSelectedPage,commitSelection,readPage,abort,
    snapshot:()=>terminalManifest});
}
