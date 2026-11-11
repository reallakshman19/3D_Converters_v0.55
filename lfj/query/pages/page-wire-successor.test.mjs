// #1120 / W1 independent R09 RED: rows fit the store budget, but a full
// page envelope does not. The correct reader must return an ordered prefix
// with an unconsumed cursor, not repeatedly throw PAGE_WIRE_OVERLIMIT.
// This is a deterministic contract fixture, in addition to the real 733KB
// Chromium failure. It never substitutes for original-source performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommittedSelectionPager}
  from './committed-selection-pages.mjs';

const size=x=>Buffer.byteLength(JSON.stringify(x));
const sourceBasis={sourceRefId:'R09-WIRE',
  sourceSha256:'9'.repeat(64),sourceRevision:'WIRE-V1'};
const digest='ALL-EXPLICIT',epoch='RED-WIRE-SESSION';

test('R09 full wire-budget preserves complete ordinal union by selecting a fitting prefix',async()=>{
  const rows=Array.from({length:4},(_,i)=>({
    schema:'LFJ.JSON.OccurrenceEvent.v1',kind:'OPEN',...sourceBasis,
    occurrenceId:JSON.stringify(['lfj-json-value/v1',
      sourceBasis.sourceRefId,sourceBasis.sourceRevision,'/'+i]),
    path:'/'+i,parentId:null,type:'number',startByte:i*2,ordinal:i
  }));
  let persistentRows=[],committed=false;
  const store={
    async stagePage(page){persistentRows.push(...page);},
    async commit(){committed=true;},
    async abort(){committed=false;},
    async readRange(start,maxRows,maxBytes){
      assert.equal(committed,true);
      let used=0,result=[];
      for(const row of persistentRows.slice(start,start+maxRows)){
        const n=size(row);
        if(used+n>maxBytes)break;
        result.push(row);used+=n;
      }
      return result;
    }
  };
  const pager=createCommittedSelectionPager({
    store,sourceBasis,selectionDigest:digest,jobEpoch:epoch,
    getCurrentBasis:()=>({...sourceBasis})
  });
  await pager.stageSelectedPage(rows);
  await pager.commitSelection({
    schema:'LFJ.OccurrenceSelectionSummary.v1',...sourceBasis,
    complete:true,scannedCount:rows.length,selectedCount:rows.length,
    rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
  });
  function envelope(pageRows){
    return {schema:'LFJ.CommittedSelectionPage.v1',complete:false,
      rows:pageRows,cursor:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      totalCount:rows.length,...sourceBasis,selectionDigest:digest,
      jobEpoch:epoch,rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false};
  }
  const expectedOneSize=size(envelope([rows[0]]));
  const firstTwoRaw=size(rows[0])+size(rows[1]);
  const twoEnvelopeSize=size(envelope([rows[0],rows[1]]));
  const budget=Math.max(expectedOneSize,firstTwoRaw)+1;
  assert.ok(budget>=256&&budget<=1048576);
  assert.ok(twoEnvelopeSize>budget,
    'RED must cross exact row-budget versus response-envelope frontier');
  const firstUnderlying=await store.readRange(0,4,budget);
  assert.ok(firstUnderlying.length>=2,
    'backend legitimately returns 2 rows under row-only byte accounting');
  let cursor=null,previous=-1,all=[],iterations=0;
  do{
    const page=await pager.readPage({
      cursor,sourceBasis,selectionDigest:digest,jobEpoch:epoch,
      maxRows:4,maxBytes:budget
    });
    assert.ok(size(page)<=budget,'full wire envelope must fit caller byte cap');
    assert.ok(page.rows.length>=1,'no empty nonterminal page');
    for(const row of page.rows){
      assert.ok(row.ordinal>previous,'no replay or out-of-order row');
      previous=row.ordinal;all.push(row.occurrenceId);
    }
    cursor=page.cursor;iterations++;
    assert.ok(iterations<=rows.length,'bounded sequential progress');
  }while(cursor!==null);
  assert.deepEqual(all,rows.map(row=>row.occurrenceId));
  assert.ok(iterations>1,'frontier must require cursor continuation');
});

test('R09 unfit first record preserves legacy PAGE_WIRE_OVERLIMIT and first cursor',async()=>{
  const row={
    schema:'LFJ.JSON.OccurrenceEvent.v1',kind:'OPEN',...sourceBasis,
    occurrenceId:JSON.stringify(['lfj-json-value/v1',
      sourceBasis.sourceRefId,sourceBasis.sourceRevision,'/0']),
    path:'/0',parentId:null,type:'string',startByte:0,ordinal:0
  };
  const store={
    async stagePage(){},
    async commit(){},
    async abort(){},
    async readRange(_start,maxRows,maxBytes){
      assert.ok(maxRows>=1);
      return size(row)<=maxBytes?[row]:[];
    }
  };
  const pager=createCommittedSelectionPager({
    store,sourceBasis,selectionDigest:digest,jobEpoch:epoch,
    getCurrentBasis:()=>({...sourceBasis})
  });
  await pager.stageSelectedPage([row]);
  await pager.commitSelection({
    schema:'LFJ.OccurrenceSelectionSummary.v1',...sourceBasis,
    complete:true,scannedCount:1,selectedCount:1,
    rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false
  });
  await assert.rejects(pager.readPage({
    cursor:null,sourceBasis,selectionDigest:digest,jobEpoch:epoch,
    maxRows:1,maxBytes:256
  }),error=>error?.code==='PAGE_WIRE_OVERLIMIT',
  'one record plus complete envelope cannot be silently clipped');
  const valid=await pager.readPage({
    cursor:null,sourceBasis,selectionDigest:digest,jobEpoch:epoch,
    maxRows:1,maxBytes:4096
  });
  assert.equal(valid.complete,true);
  assert.equal(valid.cursor,null);
  assert.deepEqual(valid.rows.map(r=>r.occurrenceId),[row.occurrenceId]);
});
