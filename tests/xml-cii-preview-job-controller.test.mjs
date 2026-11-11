import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createXmlCiiPreviewJobController} from
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-job-controller.js';
const BASIS={basisId:'a'.repeat(64)};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  return {promise,resolve,reject};};
const result=()=>({
  branchRows:[{branchName:'BR1'}],nodeRows:[],
  sourceOccurrences:{branches:[{sourceId:'A'}],nodes:[{sourceId:'A',nodeNumber:'-1'}]},
  coverage:{sourceBranchCount:1,originalNodeCount:1,engineeringBranchCount:1},
  engineeringAcceptance:'NOT_ASSESSED',fullFactPopulationAccepted:false,
});
const spec=(id='job-1',input={})=>({requestId:id,basis:BASIS,input});
const fixture=(overrides={})=>{
  const calls=[];
  const controller=createXmlCiiPreviewJobController({
    verifyBasis:async()=>true,
    execute:request=>{
      const d=deferred();const entry={...d,request,releases:0};
      calls.push(entry);
      return {promise:d.promise,release:()=>entry.releases++};
    },...overrides,
  });
  return {controller,calls};
};
test('queued -> running -> measured progress -> completed without asserting engineering acceptance',async()=>{
  const {controller,calls}=fixture();
  const snapshots=[];controller.subscribe(x=>snapshots.push(x));
  const job=controller.start(spec());
  assert.equal(controller.getSnapshot().state,'queued');
  await tick();
  assert.equal(controller.getSnapshot().state,'running');
  assert.equal(calls.length,1);
  calls[0].request.onProgress({requestId:'job-1',basisId:BASIS.basisId,
    completed:1,total:3,stage:'source-occurrences'});
  assert.equal(controller.getSnapshot().completed,1);
  calls[0].resolve(result());
  assert.equal((await job.promise).coverage.originalNodeCount,1);
  assert.deepEqual(snapshots.map(x=>x.state).filter((x,i,arr)=>i===0||x!==arr[i-1]),
    ['idle','queued','running','completed']);
  assert.equal(controller.getSnapshot().engineeringAccepted,false);
  assert.throws(()=>controller.retry(),{code:'RETRY_NOT_AVAILABLE'});
});
test('cancel queued job before worker starts; no call and no ghost completion',async()=>{
  const {controller,calls}=fixture();
  const job=controller.start(spec());
  assert.equal(controller.cancel(),true);
  await assert.rejects(job.promise,{code:'CANCELLED'});
  await tick();
  assert.equal(calls.length,0);
  assert.equal(controller.getSnapshot().state,'cancelled');
});
test('running cancellation releases worker, ignores stale success and preserves next basis',async()=>{
  const {controller,calls}=fixture();
  const first=controller.start(spec('job-1'));
  await tick();
  assert.equal(controller.cancel(),true);
  await assert.rejects(first.promise,{code:'CANCELLED'});
  assert.equal(calls[0].releases,1);
  const second=controller.start(spec('job-2'));
  await tick();
  calls[0].resolve(result()); // old Worker cannot overwrite new status/result
  await tick();
  assert.equal(controller.getSnapshot().requestId,'job-2');
  assert.equal(controller.getSnapshot().state,'running');
  calls[1].resolve(result());await second.promise;
  assert.equal(controller.getSnapshot().state,'completed');
});
test('duplicate click rejected; explicit supersede terminates old job and fences its progress',async()=>{
  const {controller,calls}=fixture();
  const first=controller.start(spec('A'));await tick();
  assert.throws(()=>controller.start(spec('B')),{code:'ACTIVE_JOB'});
  const next=controller.start(spec('B'),{supersede:true});
  await assert.rejects(first.promise,{code:'CANCELLED'});
  await tick();
  calls[0].request.onProgress({requestId:'A',basisId:BASIS.basisId,
    completed:3,total:3,stage:'stale'});
  assert.equal(controller.getSnapshot().completed,0);
  calls[1].resolve(result());await next.promise;
  assert.equal(controller.getSnapshot().requestId,'B');
  assert.throws(()=>controller.start(spec('A')),{code:'DUPLICATE_REQUEST_ID'});
});
test('explicit retry is bounded and only after classified failure; never automatic',async()=>{
  const {controller,calls}=fixture({maxRetries:1});
  const first=controller.start(spec());
  await tick();
  calls[0].reject(Object.assign(new Error('staged source unavailable'),{
    code:'STAGED_SOURCE_FAILED',stage:'staging'}));
  await assert.rejects(first.promise,{code:'STAGED_SOURCE_FAILED'});
  assert.equal(controller.getSnapshot().state,'failed');
  assert.equal(calls.length,1);
  const retry=controller.retry();
  await tick();
  assert.equal(calls[1].request.requestId,'job-1:retry1');
  assert.equal(controller.getSnapshot().attempt,1);
  calls[1].reject(new Error('second failure'));
  await assert.rejects(retry.promise,{code:'PREVIEW_JOB_FAILED'});
  assert.throws(()=>controller.retry(),{code:'RETRY_LIMIT'});
});
test('full basis attestation failure prevents any worker invocation',async()=>{
  const {controller,calls}=fixture({verifyBasis:async()=>false});
  const job=controller.start(spec());
  await assert.rejects(job.promise,{code:'BASIS_NOT_VERIFIED'});
  assert.equal(calls.length,0);
  assert.equal(controller.getSnapshot().state,'failed');
});
test('invalid progress or incomplete source population must never complete',async()=>{
  const {controller,calls}=fixture();
  const first=controller.start(spec('bad-progress'));await tick();
  calls[0].request.onProgress({requestId:'different',basisId:BASIS.basisId,
    completed:1,total:3,stage:'projection'});
  await assert.rejects(first.promise,{code:'STALE_OR_INVALID_PROGRESS'});
  const next=controller.start(spec('missing-node'));await tick();
  const invalid=result();invalid.sourceOccurrences.nodes=[];
  calls[1].resolve(invalid);
  await assert.rejects(next.promise,{code:'INCOMPLETE_OR_UNVERIFIED_RESULT'});
});
test('input payload cannot override job request identity; releasing on synchronous malformed event',async()=>{
  const d=deferred();
  let released=0;
  const execute=req=>{
    assert.equal(req.requestId,'real-id');
    assert.equal(req.basisId,BASIS.basisId);
    req.onProgress({requestId:'wrong',basisId:BASIS.basisId,completed:1,total:3,stage:'bad'});
    return {promise:d.promise,release:()=>{released++;}};
  };
  const controller=createXmlCiiPreviewJobController({execute,verifyBasis:async()=>true});
  const j=controller.start(spec('real-id',{requestId:'forged',basisId:'f'.repeat(64)}));
  await assert.rejects(j.promise,{code:'STALE_OR_INVALID_PROGRESS'});
  d.resolve(result());await tick();
  assert.equal(released,1);
});
test('listener exceptions never change job outcome; dispose cancels active job',async()=>{
  const {controller,calls}=fixture();
  let good=0;
  controller.subscribe(()=>{throw Error('observer failure')});
  controller.subscribe(()=>good++);
  const job=controller.start(spec());await tick();
  controller.dispose();
  await assert.rejects(job.promise,{code:'CANCELLED'});
  calls[0].resolve(result());await tick();
  assert.equal(controller.getSnapshot().state,'cancelled');
  assert.ok(good>=3);
  assert.throws(()=>controller.start(spec('new')),{code:'CONTROLLER_CLOSED'});
});
test('P2.2-B source/docs job controller are byte identical',async()=>{
  const file='xml-cii-adapted-preview-facts-job-controller.js';
  const a=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
  const b=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+file,import.meta.url),'utf8');
  assert.equal(a,b);
});
