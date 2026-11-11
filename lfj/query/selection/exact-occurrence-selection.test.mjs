// R08/U01 independent real R03->R05->R07 committed source oracle, RED before product.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createSourceSnapshotBuilder} from '../../source/source-snapshot.mjs';
import {streamJsonOccurrenceEvents} from '../../index/source-occurrence-index.mjs';
import {transferBoundedSourcePages} from '../../transport/execution/bounded-source-transfer.mjs';
import {createWorkerLifecycleSession} from '../../transport/lifecycle/lifecycle-session.mjs';
import {selectCommittedOccurrences} from './exact-occurrence-selection.mjs';

const original='[{"type":"BRANCH","name":"A","children":[{"type":"VALVE","name":"X"}]},{"type":"BRANCH","name":"B","children":[{"type":"VALVE","name":"Y"}]}]';
const goldenA=['/0','/0/type','/0/name','/0/children','/0/children/0','/0/children/0/type','/0/children/0/name'];
const goldenAll=['',...goldenA,'/1','/1/type','/1/name','/1/children','/1/children/0','/1/children/0/type','/1/children/0/name'];

async function committedFixture(sourceText=original,expectedPaths=goldenAll){
  const raw=new TextEncoder().encode(sourceText);
  const b=createSourceSnapshotBuilder({byteLength:raw.length,revision:'R08-real-source'});
  b.append(raw,0);
  const source=b.finalize();
  const jobId='R08-JOB-1',sourceRefId='R08-FILE';
  let worker;
  const session=createWorkerLifecycleSession({
    jobId,sourceRefId,sourceSha256:source.sha256,sourceRevision:source.revision,
    byteLength:source.byteLength,selectionDigest:'all',
    trustedWorkerCtor:Worker,
    createWorker:()=>{worker=new Worker(new URL('../../transport/lifecycle/lifecycle-worker-fixture.mjs',import.meta.url),{type:'module',workerData:{mode:'ready'}});return worker;}
  });
  const rows=[];
  assert.equal((await session.start()).kind,'ADMITTED');
  const tx=session.beginIndexTransaction({
    stagePage:async p=>{rows.push(...p);},
    commit:()=>{},
    abort:()=>{rows.length=0;}
  });
  const summary=await streamJsonOccurrenceEvents(source,{sourceRefId,onEventPage:tx.onEventPage,pageEvents:2});
  const receipt=await transferBoundedSourcePages({
    worker,trustedWorkerCtor:Worker,snapshot:source,jobId,sourceRefId,pageBytes:32,onConsumed:()=>{}
  });
  const completion=tx.commit(summary,receipt);
  assert.equal(completion.kind,'SOURCE_INDEX_COMPLETE');
  assert.equal(completion.engineeringReady,false);
  const opens=rows.filter(row=>row.kind==='OPEN');
  assert.deepEqual(opens.map(row=>row.path),expectedPaths,'independent original-source pointer census');
  const view={
    manifest:summary,completion,
    async *readOrdered(){for(const row of opens)yield row;}
  };
  return {view,opens,async close(){await worker?.terminate();source.close();}};
}
async function select(view,query,pageRows=2){
  const staged=[];
  const sourceBasis={sourceRefId:view.manifest.sourceRefId,sourceSha256:view.manifest.sourceSha256,sourceRevision:view.manifest.sourceRevision};
  const result=await selectCommittedOccurrences(view,{...query,sourceBasis},{
    pageRows,
    onSelectedPage:async p=>staged.push(...p)
  });
  return {result,paths:staged.map(row=>row.path),staged};
}
test('R08/U01: actual committed R05/R07 source selecting BRANCH A returns all and only A descendants',async()=>{
  const f=await committedFixture();
  try{
    const branch=f.opens.find(e=>e.path==='/0');
    const a=await select(f.view,{mode:'EXPLICIT',includes:[branch.occurrenceId],excludes:[]},1);
    assert.deepEqual(a.paths,goldenA);
    assert.equal(a.result.complete,true);
    assert.equal(a.result.selectedCount,goldenA.length);
    assert.equal(a.result.scannedCount,goldenAll.length);
    assert.equal(a.result.engineeringReady,false);
    assert.equal(a.result.rightsBasis,'SOURCE_FACTS_ONLY');
  }finally{await f.close();}
});
test('R08/U01: ALL selects complete original source; NONE selects nothing without inventing a new source',async()=>{
  const f=await committedFixture();
  try{
    const all=await select(f.view,{mode:'ALL',includes:[],excludes:[]},3);
    const none=await select(f.view,{mode:'NONE',includes:[],excludes:[]},1);
    assert.deepEqual(all.paths,goldenAll);
    assert.deepEqual(none.paths,[]);
    assert.equal(none.result.scannedCount,goldenAll.length);
    assert.equal(none.result.selectedCount,0);
    assert.equal(all.result.sourceSha256,f.view.manifest.sourceSha256);
  }finally{await f.close();}
});
test('R08/U02: parent include + child exclude wins even over attempted nested re-inclusion',async()=>{
  const f=await committedFixture();
  try{
    const id=p=>f.opens.find(row=>row.path===p).occurrenceId;
    const x=await select(f.view,{mode:'EXPLICIT',
      includes:[id('/0'),id('/0/children/0/name')],
      excludes:[id('/0/children/0')]},2);
    assert.deepEqual(x.paths,['/0','/0/type','/0/name','/0/children']);
    assert.equal(x.result.complete,true);
  }finally{await f.close();}
});
test('R08/U03: repeated source node labels cannot merge distinct occurrence identities',async()=>{
  const sameNames=original.replace('"name":"B"','"name":"A"').replace('"name":"Y"','"name":"X"');
  assert.equal((sameNames.match(/"name":"A"/g)||[]).length,2);
  const f=await committedFixture(sameNames);
  try{
    const a=f.opens.find(row=>row.path==='/0/name');
    const b=f.opens.find(row=>row.path==='/1/name');
    assert.notEqual(a.occurrenceId,b.occurrenceId);
    const chosen=await select(f.view,{mode:'EXPLICIT',includes:[a.occurrenceId],excludes:[]},1);
    assert.deepEqual(chosen.paths,['/0/name']);
    assert.ok(!chosen.staged.some(row=>row.occurrenceId===b.occurrenceId));
  }finally{await f.close();}
});
test('R08/U04 semantic RED: query must refuse mismatch to verified current source revision',async()=>{
  const f=await committedFixture();
  try{
    const edited=original.replace('"name":"B"','"name":"C"');
    const changedBytes=new TextEncoder().encode(edited);
    const b=createSourceSnapshotBuilder({byteLength:changedBytes.length,revision:'R08-real-source'});
    b.append(changedBytes,0);const changed=b.finalize();
    assert.equal(changed.byteLength,f.view.manifest.byteLength,'same-size interior source edit');
    assert.notEqual(changed.sha256,f.view.manifest.sourceSha256,'genuine R03 SHA must differ');
    const sourceBasis={sourceRefId:f.view.manifest.sourceRefId,
      sourceSha256:changed.sha256,sourceRevision:changed.revision};
    let staged=0;
    await assert.rejects(()=>selectCommittedOccurrences(f.view,{
      mode:'ALL',includes:[],excludes:[],sourceBasis
    },{onSelectedPage:async page=>{staged+=page.length;}}),
    e=>e?.code==='SOURCE_STALE');
    assert.equal(staged,0,'stale query must fail before provisional publication');
    changed.close();
  }finally{await f.close();}
});
test('R08/U04 semantic RED: unbound query is not allowed to assume last committed source is current',async()=>{
  const f=await committedFixture();
  try{
    await assert.rejects(()=>selectCommittedOccurrences(f.view,{
      mode:'ALL',includes:[],excludes:[]
    },{onSelectedPage:async()=>{}}),e=>e?.code==='SOURCE_BASIS_REQUIRED');
  }finally{await f.close();}
});
test('R08/U04 semantic RED: live source changed while async staging must reject final completion',async()=>{
  const f=await committedFixture();
  try{
    const sourceBasis={sourceRefId:f.view.manifest.sourceRefId,
      sourceSha256:f.view.manifest.sourceSha256,sourceRevision:f.view.manifest.sourceRevision};
    let live={...sourceBasis},staged=0;
    await assert.rejects(()=>selectCommittedOccurrences(f.view,{
      mode:'ALL',includes:[],excludes:[],sourceBasis,getCurrentBasis:()=>live
    },{pageRows:1,onSelectedPage:async page=>{
      staged+=page.length;
      live={...sourceBasis,sourceRevision:sourceBasis.sourceRevision+'-NEW'};
    }}),e=>e?.code==='SOURCE_STALE');
    assert.ok(staged>0,'the test must actually race a pending output callback');
  }finally{await f.close();}
});

test('R08/U03: RFC6901 escaped slash and tilde path is selected by original occurrence ID',async()=>{
  const special=original.replace('"name":"Y"}]}]','"name":"Y"}],"tag~/raw":"literal"}]');
  assert.notEqual(special,original,'fixture must contain a real changed key');
  const path='/1/tag~0~1raw';
  const f=await committedFixture(special,[...goldenAll,path]);
  try{
    const id=f.opens.find(e=>e.path===path).occurrenceId;
    const selected=await select(f.view,{mode:'EXPLICIT',includes:[id],excludes:[]},1);
    assert.deepEqual(selected.paths,[path]);
    assert.equal(selected.result.selectedCount,1);
  }finally{await f.close();}
});
test('R08/U04: incomplete committed reader cannot return a complete selection',async()=>{
  const f=await committedFixture();
  try{
    const truncated={...f.view,async *readOrdered(){
      for(const row of f.opens.slice(0,-1))yield row;
    }};
    const sourceBasis={sourceRefId:f.view.manifest.sourceRefId,
      sourceSha256:f.view.manifest.sourceSha256,sourceRevision:f.view.manifest.sourceRevision};
    let provisional=0;
    await assert.rejects(()=>selectCommittedOccurrences(truncated,{
      mode:'ALL',includes:[],excludes:[],sourceBasis
    },{pageRows:1,onSelectedPage:async p=>{provisional+=p.length;}}),
    e=>e?.code==='INDEX_INCOMPLETE');
    assert.ok(provisional>0,'pages are provisional and cannot establish completion');
  }finally{await f.close();}
});
test('R08/U04: noncommitted lifecycle cannot masquerade as accepted source-facts view',async()=>{
  const f=await committedFixture();
  try{
    const uncommitted={...f.view,completion:{...f.view.completion,
      kind:'ADMITTED',sourceIndexReady:false,complete:false}};
    const sourceBasis={sourceRefId:f.view.manifest.sourceRefId,
      sourceSha256:f.view.manifest.sourceSha256,sourceRevision:f.view.manifest.sourceRevision};
    await assert.rejects(()=>selectCommittedOccurrences(uncommitted,{
      mode:'ALL',includes:[],excludes:[],sourceBasis
    },{onSelectedPage:async()=>{}}),e=>e?.code==='INDEX_NOT_COMMITTED');
  }finally{await f.close();}
});
