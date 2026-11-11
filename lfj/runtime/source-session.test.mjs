// LFJ #1108 / P01_SOURCE-U01: independent source-byte contract RED before public runtime implementation.
// Memory stores here are narrow TEST PORTS, never claimed as a browser IndexedDB qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {runCommittedSourceQuery} from '../ports/committed-worker-query.mjs';

const text='[{"name":"é","children":[{"name":"X"}]},{"name":"é","children":[{"name":"Y"}]}]';
const bytes=new TextEncoder().encode(text);
const sha=createHash('sha256').update(bytes).digest('hex');
const revision='LFJ-U01-ORIGINAL',sourceRefId='P01-SRC',jobId='P01-NATIVE-WORKER';
const sourceRevision=revision+':sha256:'+sha,selectionDigest='all-original-values';
const id=path=>JSON.stringify(['lfj-json-value/v1',sourceRefId,sourceRevision,path]);
const makeBasis=()=>({sourceRefId,sourceSha256:sha,sourceRevision,byteLength:bytes.length,selectionDigest,jobId});

function indexStore(){
  const events=[];let committed=false;
  return {
    async stagePage(rows){if(committed)throw Error('late test-only index write');events.push(...rows);},
    commit(summary){assert.equal(summary.eventCount,events.length);committed=true;},
    abort(){committed=false;events.length=0;},
    async *readOrdered(){if(!committed)throw Error('not committed');for(const e of events)if(e.kind==='OPEN')yield e;},
    async lookupCommittedPair(occurrenceId){
      if(!committed)throw Error('not committed');
      const pairs=events.filter(e=>e.occurrenceId===occurrenceId);
      return {open:pairs.find(e=>e.kind==='OPEN'),seal:pairs.find(e=>e.kind==='SEAL')};
    }
  };
}
function selectedStore(){
  const rows=[];let committed=false;
  return {
    async stagePage(batch){rows.push(...batch);},
    async commit(){committed=true;},
    async abort(){committed=false;rows.length=0;},
    async readRange(start,count,maxBytes){
      if(!committed)throw Error('not committed');
      const out=[];let size=0;
      for(const row of rows.slice(start)){
        const n=new TextEncoder().encode(JSON.stringify(row)).byteLength;
        if(out.length>=count||size+n>maxBytes)break;
        out.push(row);size+=n;
      }
      return out;
    }
  };
}
function inputs(live){
  return {
    blob:new Blob([bytes]),revision,expectedSha256:sha,sourceRefId,jobId,selectionDigest,
    selection:{mode:'ALL',includes:[],excludes:[]},
    trustedWorkerCtor:Worker,
    createWorker:()=>new Worker(new URL('../ports/source-node-worker.mjs',import.meta.url),{type:'module'}),
    indexStore:indexStore(),selectedStore:selectedStore(),
    getCurrentBasis:()=>({...live}),pageEvents:2
  };
}

test('U01 baseline: genuine R10 native Worker and full committed source index exist',async()=>{
  const original=await runCommittedSourceQuery(inputs(makeBasis()));
  try{
    assert.equal(original.completion.kind,'SOURCE_INDEX_COMPLETE');
    assert.equal(original.summary.complete,true);
    assert.equal(original.summary.occurrenceCount,11);
    assert.equal(original.summary.eventCount,22);
    assert.equal(original.selectionSummary.selectedCount,11);
    assert.equal(original.sourceBasis.sourceSha256,sha);
  }finally{await original.close();}
});

test('U01 semantic RED: public session retains original byte spans and rejects stale/closed reads',async()=>{
  // Intentionally absent on the pre-implementation head: no production fallback or generated golden.
  const {openSourceSession}=await import('./source-session.mjs');
  const live=makeBasis();
  const session=await openSourceSession(inputs(live));
  try{
    assert.equal(session.completion.kind,'SOURCE_INDEX_COMPLETE');
    const first=await session.readOccurrence({
      occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision,maxBytes:4096
    });
    assert.equal(new TextDecoder().decode(first.bytes),'"é"');
    assert.equal(first.path,'/0/name');
    const second=await session.readOccurrence({
      occurrenceId:id('/1/name'),expectedSourceRevision:sourceRevision,maxBytes:4096
    });
    assert.equal(new TextDecoder().decode(second.bytes),'"é"');
    assert.notEqual(first.occurrenceId,second.occurrenceId);
    const object=await session.readOccurrence({
      occurrenceId:id('/0'),expectedSourceRevision:sourceRevision,maxBytes:4096
    });
    assert.equal(new TextDecoder().decode(object.bytes),'{"name":"é","children":[{"name":"X"}]}');
    const root=await session.readOccurrence({
      occurrenceId:id(''),expectedSourceRevision:sourceRevision,maxBytes:4096
    });
    assert.deepEqual(Array.from(root.bytes),Array.from(bytes));
    await assert.rejects(()=>session.readOccurrence({
      occurrenceId:id('/0'),expectedSourceRevision:sourceRevision,maxBytes:5
    }),e=>e?.code==='RESOURCE_BOUND');
    live.selectionDigest='scope-was-changed';
    await assert.rejects(()=>session.readOccurrence({
      occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision,maxBytes:4096
    }),e=>e?.code==='SOURCE_STALE'||e?.code==='SELECTION_STALE');
  }finally{await session.close();}
  await assert.rejects(()=>session.readOccurrence({
    occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision,maxBytes:4096
  }),e=>e?.code==='SESSION_CLOSED');
});

test('U01 admission RED: dependency changes during Worker indexing revoke source session',async()=>{
  const live={...makeBasis(),dependencyRevision:'before-native-scan'};
  const options=inputs(live);
  const stage=options.indexStore.stagePage;
  options.indexStore.stagePage=async batch=>{
    live.dependencyRevision='during-native-scan';
    return stage(batch);
  };
  await assert.rejects(()=>import('./source-session.mjs').then(x=>x.openSourceSession(options)),
    e=>e?.code==='SOURCE_STALE');
});

test('U01 positive control: unchanged explicit dependency revision remains usable',async()=>{
  const live={...makeBasis(),dependencyRevision:'stable-dependency-v1'};
  const session=await (await import('./source-session.mjs')).openSourceSession(inputs(live));
  try{
    const value=await session.readOccurrence({
      occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision,maxBytes:4096
    });
    assert.equal(new TextDecoder().decode(value.bytes),'"é"');
  }finally{await session.close();}
});
