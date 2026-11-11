import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runXml229IndependentEngineeringPreview} from
 '../tabs/xml-cii-2019-standalone/integration/xml229-independent-engineering-preview-client.mjs';
const P='XML229.P4.IndependentEngineeringPreview.v1';
const SHA='a'.repeat(64),BASIS='b'.repeat(64);
class WorkerStub{
 constructor(){this.listeners=new Map();this.terminated=false;this.sent=[];}
 addEventListener(kind,fn){
   const list=this.listeners.get(kind)||[];list.push(fn);this.listeners.set(kind,list);
 }
 postMessage(m){this.sent.push(m);this.onSend?.(m);}
 emit(data){for(const fn of this.listeners.get('message')||[])fn({data});}
 error(){for(const fn of this.listeners.get('error')||[])fn({message:'PRIVATE'});}
 terminate(){this.terminated=true;}
}
function inputs(worker,more={}){
 return {requestId:'CURRENT',sourceId:'S1',sourceGenerationId:'GEN1',
  basisId:BASIS,originalJsonSha256:SHA,
  xmlText:'<Root><Branch/></Root>',originalStagedBlob:new Blob(['{"source":1}']),
  config:{linelist:{masterRows:[{id:1}]}},deadlineMs:3000,
  workerFactory:()=>worker,...more};
}
function reply(m,more={}){
 return {protocol:P,requestId:m.requestId,sourceId:m.sourceId,basisId:m.basisId,
  originalJsonSha256:m.originalJsonSha256,
  sourceGenerationId:m.sourceGenerationId,
  state:'completed',result:{branchRows:[{branchName:'A'}],nodeRows:[]},...more};
}
const check=expected=>e=>(assert.equal(e?.code,expected),true);
test('independent Preview returns source-bound rows, never review acceptance',async()=>{
 const w=new WorkerStub();
 w.onSend=m=>queueMicrotask(()=>w.emit(reply(m)));
 const r=await runXml229IndependentEngineeringPreview(inputs(w));
 assert.deepEqual(r.branchRows,[{branchName:'A'}]);
 assert.deepEqual(r.nodeRows,[]);
 assert.equal(w.sent.length,1);
 assert.equal(w.sent[0].kind,'start');
 assert.equal(w.sent[0].originalStagedBlob.size,12);
 assert.equal(w.sent[0].config.linelist.masterRows.length,1);
 assert(!('nativeCiiReleaseAuthorized' in r));
 assert.equal(w.terminated,true);
});
test('wrong basis or source generation refuses completion and terminates',async()=>{
 for(const patch of [{basisId:'c'.repeat(64)},{sourceGenerationId:'OTHER'},
   {originalJsonSha256:'d'.repeat(64)},{sourceId:'OTHER'}]){
   const w=new WorkerStub();
   w.onSend=m=>queueMicrotask(()=>w.emit(reply(m,patch)));
   await assert.rejects(runXml229IndependentEngineeringPreview(inputs(w)),
     check('PREVIEW_WORKER_BASIS_DRIFT'));
   assert.equal(w.terminated,true);
 }
});
test('wrong request cannot impersonate current Preview',async()=>{
 const w=new WorkerStub();
 w.onSend=m=>queueMicrotask(()=>{
   w.emit(reply(m,{requestId:'OLD'}));
   w.emit(reply(m));
 });
 const r=await runXml229IndependentEngineeringPreview(inputs(w));
 assert.equal(r.branchRows.length,1);
 assert.equal(w.terminated,true);
});
test('Preview worker failure is typed without leaking private messages',async()=>{
 const w=new WorkerStub();
 w.onSend=m=>queueMicrotask(()=>w.emit(reply(m,{state:'failed',
   error:{code:'PRIVATE_XML_CONTENT',message:'secret path'}})));
 await assert.rejects(runXml229IndependentEngineeringPreview(inputs(w)),
   check('PREVIEW_WORKER_FAILED'));
 assert.equal(w.terminated,true);
});
test('cancel in-flight Preview aborts child promptly without accepting late result',async()=>{
 const w=new WorkerStub(),controller=new AbortController();
 const pending=runXml229IndependentEngineeringPreview(inputs(w,{signal:controller.signal}));
 controller.abort();
 await assert.rejects(pending,check('CANCELLED'));
 assert.equal(w.terminated,true);
 if(w.sent.length)w.emit(reply(w.sent[0]));
});
test('never responding Preview worker times out and is terminated',async()=>{
 const w=new WorkerStub();
 await assert.rejects(runXml229IndependentEngineeringPreview(
   inputs(w,{deadlineMs:15})),check('PREVIEW_WORKER_DEADLINE'));
 assert.equal(w.terminated,true);
});
test('invalid Blob, completed-branch payload, crash and serialization error fail closed',async()=>{
 const bad=inputs(new WorkerStub(),{originalStagedBlob:new Blob([])});
 await assert.rejects(runXml229IndependentEngineeringPreview(bad),
   check('PREVIEW_WORKER_INPUT_INVALID'));
 const w=new WorkerStub();
 w.onSend=m=>queueMicrotask(()=>w.emit(reply(m,{result:{branchRows:[]}})));
 await assert.rejects(runXml229IndependentEngineeringPreview(inputs(w)),
   check('PREVIEW_RESULT_INVALID'));
 const crashed=new WorkerStub();
 crashed.onSend=()=>queueMicrotask(()=>crashed.error());
 await assert.rejects(runXml229IndependentEngineeringPreview(inputs(crashed)),
   check('PREVIEW_WORKER_CRASH'));
});
test('actual Worker source invokes independent Preview, not the legacy inline dryrun',async()=>{
 const file=new URL('../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-worker.mjs',import.meta.url);
 const src=await readFile(file,'utf8');
 assert.match(src,/await runXml229IndependentEngineeringPreview\(/);
 assert.match(src,/previewAbortController\?\.abort\(\)/);
 assert.doesNotMatch(src,/const computed=xmlCiiDryRunPreview\(/);
 assert.match(src,/const session=await opened\.awaitReady\(\)/);
});
test('all three new Worker boundaries match served docs byte for byte',async()=>{
 for(const name of ['xml229-independent-engineering-preview-client.mjs',
   'xml229-independent-engineering-preview-worker.mjs',
   'xml229-original-blob-gcpw-worker.mjs']){
   const base='tabs/xml-cii-2019-standalone/integration/'+name;
   const raw=await readFile(new URL('../'+base,import.meta.url),'utf8');
   const docs=await readFile(new URL('../docs/'+base,import.meta.url),'utf8');
   assert.equal(raw,docs,name);
 }
});
