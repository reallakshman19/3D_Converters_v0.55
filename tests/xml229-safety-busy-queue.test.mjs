import test from 'node:test';
import assert from 'node:assert/strict';
import {createXml229BulkApplyQueue}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-busy-apply-queue.mjs';

test('clicking safety precheck during an initial Worker render queues exactly one eventual audit',()=>{
 const worker={receipt:{basisId:'a'.repeat(64)}};let live=worker,clicked=0,notice='';
 const root={isConnected:true,querySelector:selector=>
  selector==='[data-p4-full-source-safety]'?{click:()=>{clicked++;}}:null};
 const queue=createXml229BulkApplyQueue(root,()=>live,message=>{notice=message;});
 const event={target:{closest:selector=>selector==='[data-p4-full-source-safety]'?{}:null}};
 assert.equal(queue.defer(event,worker,true),true);
 assert.equal(clicked,0);
 assert.match(notice,/queued/);
 queue.drain(worker);
 assert.equal(clicked,1);
 queue.drain(worker);
 assert.equal(clicked,1,'a single click must not duplicate audit downloads');
});
test('a replacement Worker cannot inherit an old queued audit',()=>{
 const worker={},other={};
 let live=worker,clicked=0;
 const root={isConnected:true,querySelector:()=>({click:()=>{clicked++;}})};
 const queue=createXml229BulkApplyQueue(root,()=>live,()=>{});
 const event={target:{closest:selector=>selector==='[data-p4-full-source-safety]'?{}:null}};
 assert.equal(queue.defer(event,worker,true),true);
 live=other;queue.drain(other);
 assert.equal(clicked,0,'a stale source cannot download current-worker evidence');
});
test('non-safety and non-Apply buttons are not replayed after an in-flight write',()=>{
 const worker={};let clicks=0;
 const root={isConnected:true,querySelector:()=>({click:()=>{clicks++;}})};
 const queue=createXml229BulkApplyQueue(root,()=>worker,()=>{});
 const event={target:{closest:()=>null}};
 assert.equal(queue.defer(event,worker,true),true);
 queue.drain(worker);
 assert.equal(clicks,0);
});
