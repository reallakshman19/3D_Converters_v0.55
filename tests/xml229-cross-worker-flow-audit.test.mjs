import test from 'node:test';
import assert from 'node:assert/strict';
import {auditXml229CrossWorkerFlowTrace as audit}
 from '../contracts/xml229-flow-trace-v1/audit.mjs';
import {createXml229CrossWorkerFlowTrace as create}
 from '../contracts/xml229-flow-trace-v1/trace.mjs';
import {readFile} from 'node:fs/promises';
const make=()=>create({id:'FLOW-INDEPENDENT-TEST',clock:()=>1});
const step=(t,kind,actor='ui-controller',extra={})=>
 t.record({kind,actor,...extra});
const chain=()=>{
 const t=make();
 step(t,'BUILD_REQUESTED','preview-ui');
 step(t,'CENSUS_REQUESTED');
 step(t,'CENSUS_VERIFIED','census-worker',{counts:{physical:2}});
 step(t,'GC_PW_WORKER_REQUESTED');
 step(t,'GC_PW_WORKER_STARTED','gc-pw-worker');
 step(t,'PREVIEW_CHILD_REQUESTED','gc-pw-worker');
 step(t,'PREVIEW_CHILD_COMPLETED','gc-pw-worker');
 step(t,'FACTS_OPENED','gc-pw-worker',{counts:{physical:2,facts:14}});
 step(t,'GC_PW_READY','gc-pw-worker',{counts:{physical:2,facts:14}});
 step(t,'RPC_REQUESTED','ui-controller',{rpcSeq:1,step:'completion'});
 step(t,'RPC_COMPLETED','ui-controller',{rpcSeq:1,
   counts:{physical:2,facts:14,unresolved:2}});
 step(t,'OUTPUT_READ_REQUESTED','output-ui');
 step(t,'RPC_REQUESTED','ui-controller',{rpcSeq:2,step:'completion'});
 step(t,'RPC_COMPLETED','ui-controller',{rpcSeq:2});
 step(t,'OUTPUT_READ_VERIFIED','output-ui',{counts:{physical:2,facts:14,unresolved:2}});
 step(t,'RUN_GATE_HELD','native-gate',{code:'NATIVE_CONSUMPTION_UNVERIFIED'});
 return t.snapshot();
};
test('independent audit distinguishes correctly held native gate from broken flow',()=>{
 const result=audit(chain());
 assert.equal(result.status,'EXPECTED_RELEASE_HOLD');
 assert(result.issues.includes('ENGINEERING_MASS_UNRESOLVED'));
 assert(result.issues.includes('NATIVE_RELEASE_HOLD_EXPECTED'));
 assert.equal(result.nativeCiiReleaseAuthorized,false);
 assert.equal(result.firstGap,null);
 assert.equal(result.summary.hasPreviewChild,true);
});
test('the first missing child Worker handoff is precisely identified',()=>{
 const s=structuredClone(chain());
 s.events=s.events.filter(e=>e.kind!=='PREVIEW_CHILD_REQUESTED');
 s.totalEvents=s.events.length;
 const result=audit(s);
 assert.equal(result.status,'BROKEN_FLOW');
 assert.equal(result.firstGap.code,'PREVIEW_CHILD_RETURN_WITHOUT_DISPATCH');
});
test('corrupt physical fact census and orphan reply are independently detected',()=>{
 const s=structuredClone(chain());
 const facts=s.events.find(e=>e.kind==='FACTS_OPENED');
 facts.counts.facts=13;
 assert.equal(audit(s).firstGap.code,'PHYSICAL_FACT_SEVEN_TO_ONE_DRIFT');
 const q=structuredClone(chain());
 q.events=q.events.filter(e=>e.kind!=='RPC_REQUESTED');
 q.totalEvents=q.events.length;
 assert.equal(audit(q).firstGap.code,'RPC_RESPONSE_WITHOUT_REQUEST');
});
test('no owner strings, rogue properties or asserted release may enter a valid audit',()=>{
 const s=structuredClone(chain());s.events[3].rawPrivateMaster='secret';
 assert.equal(audit(s).status,'INVALID');
 delete s.events[3].rawPrivateMaster;
 s.nativeCiiReleaseAuthorized=true;
 const result=audit(s);
 assert.equal(result.status,'INVALID');
 assert(!JSON.stringify(result).includes('secret'));
});
test('source and served audit byte parity',async()=>{
 const p='contracts/xml229-flow-trace-v1/audit.mjs';
 const [source,served]=await Promise.all([
  readFile(new URL('../'+p,import.meta.url),'utf8'),
  readFile(new URL('../docs/'+p,import.meta.url),'utf8'),
 ]);
 assert.equal(source,served);
});
