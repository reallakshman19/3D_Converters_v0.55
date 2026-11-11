/** #1147 B0-03 native Worker source-only query qualification; no app import. */
import {openPagedSourceQuery} from './paged-query.mjs';

const fail=(code,message)=>Object.assign(new Error(message),{code});
const size=x=>new TextEncoder().encode(JSON.stringify(x)).length;
const assert=(c,code,detail)=>{if(!c)throw fail(code,detail);};
const reason=e=>e?.code||e?.name||'UNKNOWN';
async function rejected(fn,expected){
  let code=null;
  try{await fn();}catch(e){code=reason(e);}
  assert(code===expected,'NEGATIVE_FAILURE',expected+' must reject, got '+code);
  return code;
}
async function queryOriginal({databaseName,generation,blob,oracle}){
  const start=performance.now();
  const source=()=>openPagedSourceQuery({
    databaseName,generation,blob,expectedSha256:oracle.sha256
  });
  let session=await source(),reads=0,outputPages=0;
  const totals=[],sampled=[];
  try{
    assert(session.sourceOnly===true&&session.engineeringReady===false,
      'RIGHTS','source-only query never grants engineering result authority');
    assert(session.sourceCount===oracle.occurrenceCount&&
      session.sourceSha256===oracle.sha256,
      'FULL_CENSUS','catalog HEAD differs from independent source');
    for(const scalar of oracle.scalarSamples){
      const r=await session.readOrdinal(scalar.ordinal);
      assert(r.ordinal===scalar.ordinal&&r.type!=='object'&&r.type!=='array',
        'SAMPLE_TYPE','sample ordinal must be a scalar');
      const bytes=await session.readOriginalRange(r.startByte,r.endByteExclusive);
      const decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
      assert(JSON.stringify(JSON.parse(decoded))===JSON.stringify(scalar.expected),
        'SPAN','original scalar byte span mismatch');
      let curr=r,path='',depth=0;
      while(curr.parent!==null){
        path='/'+String(curr.member).replaceAll('~','~0').replaceAll('/','~1')+path;
        curr=await session.readOrdinal(curr.parent);
        if(++depth>256)throw fail('DEPTH','parent loop');
      }
      assert(path===scalar.path,'SOURCE_PATH','original pointer mismatch '+path);
      sampled.push({ordinal:scalar.ordinal,path,bytes:bytes.length});
    }
    const sizes=oracle.occurrenceCount<30000?[1,5,100]:[64,256];
    for(const perPage of sizes){
      let cursor=0,seen=0,pageCount=0,ordinalSum=0;
      do{
        const response=await session.readPage({
          cursor,maxRows:perPage,maxBytes:65536
        });
        assert(response.sourceSha256===oracle.sha256&&
          response.generation===generation&&
          response.schema==='LFJ.B0.SourcePage.v1'&&
          response.totalCount===oracle.occurrenceCount&&
          response.cursor===cursor,'PAGE_ENVELOPE','untrusted page metadata');
        assert(size(response)<=65536,'PAGE_BUDGET','full response over wire cap');
        assert(response.rows.length>0&&response.rows.length<=perPage,
          'PAGE_ROWS','missing or clipped source page');
        for(const row of response.rows){
          assert(row.ordinal===seen&&row.startByte<row.endByteExclusive&&
            (seen===0||row.parent<row.ordinal)&&row.endByteExclusive<=oracle.bytes,
            'PAGE_SOURCE','original page union altered');
          seen++;ordinalSum+=row.ordinal;
        }
        assert(response.nextCursor===seen&&
          response.complete===(seen===oracle.occurrenceCount),
          'CURSOR','incorrect full-selection cursor');
        cursor=response.nextCursor;pageCount++;
        if(pageCount>oracle.occurrenceCount)
          throw fail('CURSOR_LOOP','catalog paging did not advance');
      }while(cursor<oracle.occurrenceCount);
      assert(seen===oracle.occurrenceCount&&
        ordinalSum===seen*(seen-1)/2,'FULL_UNION','missing/duplicate original occurrences');
      totals.push({rowsPerPage:perPage,selectedCount:seen,pages:pageCount});
      outputPages+=pageCount;reads+=seen;
    }
    const mid=Math.floor(oracle.occurrenceCount/2);
    const ranges=[[0,7],[mid,mid+31],[oracle.occurrenceCount-31,oracle.occurrenceCount]];
    const expected=ranges.flatMap(([start,end])=>
      Array.from({length:end-start},(_,i)=>start+i));
    let scoped=await openPagedSourceQuery({
      databaseName,generation,blob,expectedSha256:oracle.sha256,
      selection:{kind:'RANGES',ranges}
    });
    let selected=[],cursor=0;
    try{
      assert(scoped.selectedCount===expected.length,'SELECTION_COUNT','wrong range count');
      do{
        const response=await scoped.readPage({cursor,maxRows:5,maxBytes:2048});
        assert(size(response)<=2048&&response.nextCursor>cursor,
          'SELECTION_PAGE','bounded explicit scope did not advance');
        selected.push(...response.rows.map(r=>r.ordinal));
        cursor=response.nextCursor;
      }while(cursor<expected.length);
      assert(JSON.stringify(selected)===JSON.stringify(expected),
        'SELECTION_UNION','scope membership clipped/reordered/duplicated');
    }finally{scoped.close();}
    const none=await openPagedSourceQuery({
      databaseName,generation,blob,expectedSha256:oracle.sha256,
      selection:{kind:'NONE'}
    });
    try{
      const page=await none.readPage();
      assert(page.complete&&page.rows.length===0&&page.totalCount===0,
        'NONE_SELECTION','none must return a completed empty selection');
    }finally{none.close();}
    const neg={};
    neg.invalidScope=await rejected(()=>openPagedSourceQuery({
      databaseName,generation,blob,expectedSha256:oracle.sha256,
      selection:{kind:'RANGES',ranges:[[1,8],[7,10]]}
    }),'SELECTION_INVALID');
    neg.staleGeneration=await rejected(()=>openPagedSourceQuery({
      databaseName,generation:generation+'-wrong',blob,
      expectedSha256:oracle.sha256
    }),'SOURCE_NOT_COMMITTED');
    neg.changedSource=await rejected(()=>openPagedSourceQuery({
      databaseName,generation,
      blob:new Blob([blob.slice(0,blob.size-1),new Blob([' '])]),
      expectedSha256:oracle.sha256
    }),'SOURCE_HASH_MISMATCH');
    let wireError=null;
    try{
      const r=await session.readPage({cursor:0,maxRows:512,maxBytes:256});
      assert(size(r)<=256,'PAGE_WIRE_BUDGET','full envelope exceeds claimed bytes');
    }catch(e){wireError=reason(e);}
    assert(wireError===null||wireError==='SOURCE_ROW_TOO_LARGE',
      'PAGE_WIRE','invalid small full-envelope rejection');
    neg.wire=wireError||'FIT';
    session.close();
    neg.closed=await rejected(()=>session.readPage(),'SOURCE_CLOSED');
    // Reopen a committed HEAD with exact Blob and source SHA.
    session=await source();
    const reopening=await session.readOrdinal(oracle.scalarSamples[0].ordinal);
    assert(reopening.ordinal===oracle.scalarSamples[0].ordinal,
      'REOPEN','valid committed source cannot reopen with original Blob');
    return {schema:'LFJ.B0.QueryBrowserOracle.v1',
      originalBytes:oracle.bytes,sourceSha256:oracle.sha256,
      occurrences:oracle.occurrenceCount,totals,scopedCount:selected.length,
      sampled,negatives:neg,readOperations:reads,
      pages:outputPages,elapsedMs:performance.now()-start,
      sourceOnly:true,appWired:false};
  }finally{session?.close();}
}
let used=false;
self.addEventListener('message',async({data})=>{
  if(used){self.postMessage({type:'ERROR',code:'QUERY_WORKER_BUSY'});return;}
  used=true;
  try{
    if(data?.type!=='QUERY')throw fail('PROTOCOL','QUERY required');
    self.postMessage({type:'DONE',result:await queryOriginal(data)});
  }catch(e){
    self.postMessage({type:'ERROR',code:reason(e),message:String(e?.message||e)});
  }
});
