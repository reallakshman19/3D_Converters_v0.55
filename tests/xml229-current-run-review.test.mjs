import test from 'node:test';
import assert from 'node:assert/strict';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {handleXml229CurrentRunReview} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-current-run-review.mjs';
import {readXml229RunClock} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-run-clock.mjs';
import {captureXml229XmlOnlyApproval} from '../tabs/xml-cii-2019-standalone/integration/xml229-output-participation.mjs';
const xml='<PipeStressExport></PipeStressExport>',sha=await digestUtf8(xml);
function fixture(unresolved=1){
 const receipt={reviewSourceKind:'XML_ONLY',sourceXmlSha256:sha,originalJsonSha256:null,
   basisId:'a'.repeat(64),sourceId:'SOURCE',sourceGenerationId:'xml-only:sha256:'+sha,physicalCount:1};
 const proof={...receipt,schema:'XML229.P4.RunAdvisory.v1',verifiedPhysicalCount:1,verifiedFactCount:7,
   counts:{source:1-unresolved,match1:0,final:0,unresolved},engineeringFactsVerified:true,
   previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false};
 return {ref:{current:{sourceText:xml}},session:{receipt,readCompletion:async()=>proof}};
}
test('current unresolved review intercepts Run before legacy writes or conversion',async()=>{
 const {ref,session}=fixture();let opened=0;
 assert.equal(await handleXml229CurrentRunReview(ref,()=>{},
   {getReview:()=>session,openPopup:async()=>{opened++;}}),true);
 assert.equal(opened,1);assert.equal(ref.current.running,undefined);
});
test('complete XML-only review renders the guarded native eligibility path without legacy writes',async()=>{
 const {ref,session}=fixture(0);
 assert.equal(await handleXml229CurrentRunReview(ref,()=>{}, {getReview:()=>session}),true);
 assert.match(ref.current.xml229CurrentRunReviewStatus,/Checking current Run eligibility/);
});
test('failed session verification holds Run; explicit XML-only opt-out uses its existing route',async()=>{
 const {ref}=fixture();
 await handleXml229CurrentRunReview(ref,()=>{}, {getReview:()=>null,openSession:async()=>{throw Error('test stop');}});
 assert.match(ref.current.xml229CurrentRunReviewStatus,/HELD/);
 ref.current.xml229XmlOnlyApproval=captureXml229XmlOnlyApproval(ref.current);
 assert.equal(await handleXml229CurrentRunReview(ref,()=>{}),false);
});
test('elapsed timer advances only while running and freezes on completion',()=>{
 const ref={current:{running:false}};
 assert.equal(readXml229RunClock(ref,500).status,'IDLE');
 ref.current.running=true;assert.equal(readXml229RunClock(ref,1000).elapsedMs,0);
 assert.equal(readXml229RunClock(ref,2500).elapsedMs,1500);
 ref.current={running:false,result:{ok:true}};
 assert.equal(readXml229RunClock(ref,3000).elapsedMs,2000);
 assert.equal(readXml229RunClock(ref,9000).elapsedMs,2000);
 ref.current.running=true;assert.equal(readXml229RunClock(ref,10000).elapsedMs,0);
});
