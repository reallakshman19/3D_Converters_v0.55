import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {executeXmlCiiPreviewLocally,PreviewLocalExecutionError} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-local-execution.js';
const BASIS='a'.repeat(64);
class MockWorker {
  constructor(send){this.send=send;this.handlers=new Map();this.terminated=false;}
  addEventListener(name,fn){this.handlers.set(name,fn);}
  removeEventListener(name,fn){if(this.handlers.get(name)===fn)this.handlers.delete(name);}
  postMessage(data){queueMicrotask(()=>this.send(data,this));}
  terminate(){this.terminated=true;}
  emit(name,data){this.handlers.get(name)?.({data});}
}
const input=(createWorker,onProgress=()=>{})=>executeXmlCiiPreviewLocally({
  requestId:'rq-001',basisId:BASIS,
  xmlText:'<PipeStressExport/>',config:{linelist:{masterRows:[]}},
  stagedJsonText:'',scope:{mode:'A',sourceId:'src'},createWorker,onProgress,
});
test('worker local result preserves full source population separate from legacy review-eligible nodes',async()=>{
  let worker;
  const seen=[];
  const job=input(()=>worker=new MockWorker((m,w)=>{
    w.emit('message',{protocol:m.protocol,requestId:m.requestId,basisId:m.basisId,
      state:'running',stage:'source-occurrences',completed:1,total:3});
    w.emit('message',{protocol:m.protocol,requestId:m.requestId,basisId:m.basisId,
      state:'completed',result:{
        branchRows:[{branchName:'BR1'}],nodeRows:[],
        sourceOccurrences:{branchCount:1,nodeCount:12,branches:[],nodes:[]},
        coverage:{sourceBranchCount:1,originalNodeCount:12,legacyReviewNodeCount:0},
        fullFactPopulationAccepted:false,engineeringAcceptance:'NOT_ASSESSED',
      }});
  }),e=>seen.push(e));
  const result=await job.promise;
  assert.equal(result.coverage.originalNodeCount,12);
  assert.equal(result.nodeRows.length,0);
  assert.equal(result.fullFactPopulationAccepted,false);
  assert.equal(seen[0].stage,'source-occurrences');
  assert.ok(worker.terminated);
});
test('reject wrong request/basis from worker, never silently accept stale result',async()=>{
  const make=()=>new MockWorker((m,w)=>w.emit('message',{
    protocol:m.protocol,requestId:'somebody-else',basisId:m.basisId,
    state:'completed',result:{branchRows:[],nodeRows:[],sourceOccurrences:{}}
  }));
  await assert.rejects(input(make).promise,{code:'CORRUPT_WORKER_RESPONSE'});
});
test('missing source census on nominal completed response fails closed',async()=>{
  const make=()=>new MockWorker((m,w)=>w.emit('message',{
    protocol:m.protocol,requestId:m.requestId,basisId:m.basisId,
    state:'completed',result:{branchRows:[],nodeRows:[],
      fullFactPopulationAccepted:true},
  }));
  await assert.rejects(input(make).promise,{code:'INCOMPLETE_WORKER_RESULT'});
});
test('worker-posted stage errors become classified exceptions and release worker',async()=>{
  let worker;
  const job=input(()=>worker=new MockWorker((m,w)=>w.emit('message',{
    protocol:m.protocol,requestId:m.requestId,basisId:m.basisId,state:'failed',
    error:{code:'INVALID_NODE_NUMBER',stage:'source-occurrences',message:'not integer'},
  })));
  await assert.rejects(job.promise,{code:'INVALID_NODE_NUMBER'});
  assert.equal(worker.terminated,true);
});
test('invalid progress, transfer failure, startup error and manual release all fail closed',async()=>{
  await assert.rejects(input(()=>new MockWorker((m,w)=>w.emit('message',{
    protocol:m.protocol,requestId:m.requestId,basisId:m.basisId,
    state:'running',stage:'compute',completed:999,total:3,
  }))).promise,{code:'INVALID_WORKER_PROGRESS'});
  class ThrowingWorker extends MockWorker {
    postMessage(){throw new Error('DataCloneError');}
  }
  await assert.rejects(input(()=>new ThrowingWorker(()=>{})).promise,{code:'WORKER_DISPATCH_FAILURE'});
  const boot=new MockWorker(()=>{});
  const pending=input(()=>boot);
  boot.emit('error',{message:'script not found'});
  await assert.rejects(pending.promise,{code:'WORKER_BOOT_FAILURE'});
  const release=input(()=>new MockWorker(()=>{}));release.release();
  await assert.rejects(release.promise,{code:'RELEASED'});
});
test('worker and local executor source/docs deployment mirrors are byte-identical',async()=>{
  for(const name of ['xml-cii-adapted-preview-facts-worker-entry.js',
    'xml-cii-adapted-preview-facts-local-execution.js']){
    const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
    const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+name,import.meta.url),'utf8');
    assert.equal(a,b,name+' differs in docs');
  }
});
