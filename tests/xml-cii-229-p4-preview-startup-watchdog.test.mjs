import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openXml229WorkerHeldOriginalWeightReview}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs';

const CENSUS='XML229.P4.OriginalWeightCensus.v1';
const PROTOCOL='XML229.P4.WorkerHeldOriginalJsonGC-PW.v1';
class FakeWorker {
 constructor({answerCensus=false,reportStage=false}={}){
  this.answerCensus=answerCensus;this.reportStage=reportStage;
  this.events=new Map();this.terminated=false;this.sent=[];
 }
 addEventListener(type,callback){
  const list=this.events.get(type)||[];list.push(callback);this.events.set(type,list);
 }
 postMessage(message){
  this.sent.push(message);
  if(this.answerCensus){
   queueMicrotask(()=>this.emit('message',{protocol:CENSUS,requestId:message.requestId,
    state:'completed',counts:{physical:1,original:2},
    independentSourceOccurrences:[],independentPhysicalOccurrences:[]}));
  }else if(this.reportStage&&message.kind==='start'){
   queueMicrotask(()=>this.emit('message',{protocol:PROTOCOL,
    requestId:message.requestId,state:'progress',
    stage:'engineering-preview-using-actual-json'}));
  }
 }
 emit(type,data){
  for(const callback of this.events.get(type)||[]){
   callback(type==='message'?{data}:{message:data});
  }
 }
 terminate(){this.terminated=true;}
}
const input=({census,weight,signal,...options})=>({
 xmlText:'<Root><Branch><Node/></Branch></Root>',sourceId:'OWNER-XML',
 masters:{lineList:{rows:[]}},selection:[{sourceId:'OWNER-XML',selectionRef:'all'}],
 config:{},originalStagedBlob:{},originalStagedSourceReceipt:{},requestId:'bounded-preview-test',
 isCurrent:()=>true,
 censusWorkerFactory:()=>census,weightWorkerFactory:()=>weight,
 censusTimeoutMs:90,phaseTimeoutMs:35,startupTimeoutMs:180,
 ...(signal?{signal}:{}),...options,
});
const code=(expected)=>error=>{assert.equal(error?.code,expected,error?.stack);return true;};

test('silent original census Worker has a bounded deadline and terminates',async()=>{
 const census=new FakeWorker(),weight=new FakeWorker();
 await assert.rejects(()=>openXml229WorkerHeldOriginalWeightReview(
  input({census,weight,censusTimeoutMs:25})),code('ORIGINAL_CENSUS_TIMEOUT'));
 assert.equal(census.terminated,true);assert.equal(weight.sent.length,0);
});

test('stuck actual-JSON enrichment returns fail-closed stalled error and terminates Worker',async()=>{
 const census=new FakeWorker({answerCensus:true});
 const weight=new FakeWorker({reportStage:true});
 await assert.rejects(()=>openXml229WorkerHeldOriginalWeightReview(
  input({census,weight,phaseTimeoutMs:30,startupTimeoutMs:120})),
  error=>{
   assert.equal(error?.code,'ENGINEERING_PREVIEW_WORKER_STALLED',error?.stack);
   assert.match(error.message,/engineering-preview-using-actual-json/);
   assert.match(error.message,/Source remains HELD/);
   return true;
  });
 assert.equal(census.terminated,true);
 assert.equal(weight.terminated,true);
});

test('Preview Cancel aborts a Worker blocked before ready, without waiting for stage deadline',async()=>{
 const census=new FakeWorker({answerCensus:true});
 const weight=new FakeWorker();
 const controller=new AbortController();
 const pending=openXml229WorkerHeldOriginalWeightReview(input({
  census,weight,signal:controller.signal,phaseTimeoutMs:5000,startupTimeoutMs:10000,
 }));
 queueMicrotask(()=>controller.abort());
 await assert.rejects(()=>pending,code('CANCELLED'));
 assert.equal(census.terminated,true);
 assert.equal(weight.terminated,weight.sent.length>0);
});

test('engineering cancellation, timeout and served source remain one identical implementation',async()=>{
 for(const path of [
  'tabs/xml-cii-2019-standalone/integration/xml229-original-blob-gcpw-client.mjs',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-p4-verified-weight-panel.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js',
  'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-diagnostics-audit-v7.js',
 ]){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(source,served,path+' is not mirrored into served docs');
 }
 const preview=await readFile(new URL(
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js',
  import.meta.url),'utf8');
 assert.match(preview,/session\.abortController\.abort\(\)/);
 assert.match(preview,/signal:session\.abortController\.signal/);
});
