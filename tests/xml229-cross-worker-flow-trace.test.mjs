import test from 'node:test';
import assert from 'node:assert/strict';
import {createXml229CrossWorkerFlowTrace as create}
 from '../contracts/xml229-flow-trace-v1/trace.mjs';
import {readFile} from 'node:fs/promises';
const make=()=>{let tick=0;return create({id:'TEST-FLOW',clock:()=>tick++,maxEvents:16});};
test('causal event chain retains actors, RPC number and minimum schema',()=>{
 const t=make();
 t.record({kind:'BUILD_REQUESTED',actor:'preview-ui'});
 t.record({kind:'CENSUS_REQUESTED',actor:'ui-controller'});
 t.record({kind:'CENSUS_VERIFIED',actor:'census-worker',
   counts:{physical:2,branches:1}});
 t.record({kind:'PREVIEW_CHILD_COMPLETED',actor:'gc-pw-worker'});
 t.record({kind:'FACTS_OPENED',actor:'gc-pw-worker',
   counts:{physical:2,facts:14}});
 t.record({kind:'RPC_REQUESTED',actor:'ui-controller',rpcSeq:1,step:'completion'});
 t.record({kind:'RPC_COMPLETED',actor:'ui-controller',rpcSeq:1,step:'completion',
   counts:{physical:2,facts:14,unresolved:2}});
 t.record({kind:'RUN_GATE_HELD',actor:'native-gate',
   code:'NATIVE_CONSUMPTION_UNVERIFIED'});
 const r=t.snapshot();
 assert.equal(r.events.length,8);
 assert.deepEqual(r.events.map(x=>x.seq),[1,2,3,4,5,6,7,8]);
 assert(r.findings.includes('ENGINEERING_MASS_UNRESOLVED'));
 assert(r.findings.includes('NATIVE_RELEASE_HOLD_EXPECTED'));
 assert.equal(r.nativeCiiReleaseAuthorized,false);
 assert.equal(r.events[5].rpcSeq,r.events[6].rpcSeq);
});
test('contract prevents leaking raw Worker, XML, master, original IDs and free messages',()=>{
 const t=make();
 t.record({kind:'RPC_COMPLETED',actor:'ui-controller',rpcSeq:2,
   step:'../PRIVATE-PATH',code:'source id private',
   counts:{physical:2,evilRawMaster:{value:8},sourceMass:0},
   message:'PRIVATE XML',sourceId:'PRIVATE OWNER',sha256:'PRIVATE HASH',
   occurrenceIds:['PRIVATE node'],raw:'PRIVATE blob'});
 const report=JSON.stringify(t.snapshot());
 for(const bad of ['PRIVATE','evilRawMaster','sourceId','sha256','occurrenceIds','raw','message'])
  assert(!report.includes(bad),bad);
 assert.equal(t.snapshot().events[0].step,undefined);
 assert.equal(t.snapshot().events[0].counts.physical,2);
});
test('bound storage drops old events and cannot imply release',()=>{
 const t=make();
 for(let i=0;i<22;i++)t.record({kind:'RPC_REQUESTED',actor:'ui-controller',rpcSeq:i+1});
 const r=t.snapshot();
 assert.equal(r.totalEvents,22);assert.equal(r.observedEvents,16);
 assert.equal(r.droppedEvents,6);
 assert(r.findings.includes('EARLY_EVENTS_DROPPED'));
 assert.equal(r.nativeCiiReleaseAuthorized,false);
 t.close();
 assert.equal(t.record({kind:'BUILD_REQUESTED',actor:'preview-ui'}),null);
});
test('fact divergence and typed faults are visible without raw exception strings',()=>{
 const t=make();
 t.record({kind:'FACTS_OPENED',actor:'gc-pw-worker',counts:{physical:3,facts:20}});
 t.record({kind:'RPC_FAILED',actor:'ui-controller',code:'WORKER_STALE',
   error:new Error('private XML source /tmp/X')});
 const r=t.snapshot();
 assert(r.findings.includes('PHYSICAL_FACT_POPULATION_DRIFT'));
 assert(r.findings.includes('FLOW_FAILURE_OBSERVED'));
 assert(!JSON.stringify(r).includes('/tmp/X'));
});
test('invalid producer/event type fails closed, rather than source-data log',()=>{
 const t=make();
 assert.throws(()=>t.record({kind:'UNKNOWN',actor:'gc-pw-worker'}));
 assert.throws(()=>t.record({kind:'GC_PW_READY',actor:'PRIVATE SOURCE'}));
});
test('served flow contract and registry source mirrors are byte-identical',async()=>{
 const paths=[
   'contracts/xml229-flow-trace-v1/trace.mjs',
   'tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs',
 ];
 for(const p of paths){
   const [src,served]=await Promise.all([
     readFile(new URL('../'+p,import.meta.url),'utf8'),
     readFile(new URL('../docs/'+p,import.meta.url),'utf8'),
   ]);
   assert.equal(src,served,p);
 }
});
