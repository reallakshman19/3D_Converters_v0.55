import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStandaloneEngineWorkerClient,STANDALONE_ENGINE_TIMEOUT_MS}
 from '../converters/xml-cii-2019-standalone/engine-worker-client.mjs';

// Explicit transport-only test double. Real Pyodide/browser proof is separate.
class TestWorker {
 listeners={}; requests=[]; terminated=false;
 addEventListener(kind,callback){(this.listeners[kind]??=[]).push(callback);}
 postMessage(request){this.requests.push(request);}
 emit(kind,data){for(const fn of this.listeners[kind]||[])fn({data});}
 reply(result={ok:true}){const {id}=this.requests.at(-1);this.emit('message',{kind:'XML_CII_RESULT',id,result});}
 terminate(){this.terminated=true;}
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(timeoutMs=1000){
 const workers=[];
 const client=createStandaloneEngineWorkerClient({timeoutMs,
  workerFactory:()=>{const w=new TestWorker();workers.push(w);return w;}});
 return {client,workers};
}

test('conversion uses one serialized Worker and retains complete native result',async()=>{
 const {client,workers}=fixture();
 try{
  const first=client.run({sourceName:'first'}),second=client.run({sourceName:'second'});
  await turn();assert.equal(workers.length,1);assert.equal(workers[0].requests.length,1);
  const result={ok:true,ciiText:'verified bytes',xml229NativeMassDiagnostic:{physicalCount:14}};
  workers[0].reply(result);assert.deepEqual(await first,result);
  await turn();assert.equal(workers[0].requests.length,2);
  workers[0].reply({ok:false,nativePythonFailure:{code:'NATIVE_RIGID_OWNER_UNSUPPORTED'}});
  assert.equal((await second).nativePythonFailure.code,'NATIVE_RIGID_OWNER_UNSUPPORTED');
 }finally{client.dispose();}
});

test('timeout terminates computation and a later job starts a fresh Worker',async()=>{
 const {client,workers}=fixture(30);
 await assert.rejects(client.run({}),{code:'STANDALONE_ENGINE_TIMEOUT'});
 assert.equal(workers[0].terminated,true);
 const next=client.run({});await turn();assert.equal(workers.length,2);
 workers[0].emit('error'); // delayed error from the terminated job must not kill the new one
 workers[1].reply();assert.equal((await next).ok,true);client.dispose();
 assert.equal(STANDALONE_ENGINE_TIMEOUT_MS,300000);
});

for(const event of ['error','messageerror'])test(event+' rejects active conversion without a UI fallback',async()=>{
 const {client,workers}=fixture();
 const promise=client.run({});await turn();
 workers[0].emit(event);
 await assert.rejects(promise,{code:event==='error'
  ?'STANDALONE_ENGINE_WORKER_FAILED':'STANDALONE_ENGINE_MESSAGE_INVALID'});
 assert.equal(workers[0].terminated,true);client.dispose();
});

test('wrong request IDs cannot settle another job; malformed replies reject',async()=>{
 const {client,workers}=fixture();
 const promise=client.run({});await turn();let settled=false;
 promise.then(()=>{settled=true;},()=>{settled=true;});
 workers[0].emit('message',{kind:'XML_CII_RESULT',id:999,result:{ok:true}});
 await turn();assert.equal(settled,false);
 workers[0].reply({});await assert.rejects(promise,{code:'STANDALONE_ENGINE_WORKER_FAILED'});
 client.dispose();
});

test('postMessage clone failure is bounded and terminates its Worker',async()=>{
 const w=new TestWorker();w.postMessage=()=>{throw new Error('explicit clone failure');};
 const client=createStandaloneEngineWorkerClient({workerFactory:()=>w});
 await assert.rejects(client.run({}),{code:'STANDALONE_ENGINE_MESSAGE_INVALID'});
 assert.equal(w.terminated,true);client.dispose();
});

test('an unavailable Worker fails closed and explicit runtime injection remains supported',async()=>{
 const client=createStandaloneEngineWorkerClient({workerFactory:()=>{throw new Error('unavailable');}});
 await assert.rejects(client.run({}),/unavailable/);client.dispose();
 const {runXmlCii2019StandaloneEngineJob:run}=await import(
  '../tabs/xml-cii-2019-standalone/xml-cii-workflow-engine-client.js');
 const job={sourceText:'exact original'};
 assert.equal(await run(job,{engineRunner:async value=>value}),job);
});

test('root and docs Worker entry, client, DOM result step and caller match',async()=>{
 for(const path of ['converters/xml-cii-2019-standalone/engine-worker.mjs',
  'converters/xml-cii-2019-standalone/engine-worker-client.mjs',
  'converters/xml-cii-2019-standalone/engine-sif-result.mjs',
  'tabs/xml-cii-2019-standalone/xml-cii-workflow-engine-client.js']){
  assert.deepEqual(await readFile(new URL('../'+path,import.meta.url)),
   await readFile(new URL('../docs/'+path,import.meta.url)));
 }
});
