import test from 'node:test';
import assert from 'node:assert/strict';
import {readXml229NativeFinalObservation}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-native-final-observation.mjs';
const proof=(source=2, final=0, unresolved=0, match1=0)=>({
 schema:'XML229.P4.RunAdvisory.v1',
 verifiedPhysicalCount:source+final+unresolved+match1,
 counts:{source,final,match1,unresolved},
});
test('complete accepted Source/Final mass reads current Native Final Intent without creating output',async()=>{
 let reads=0;
 const result=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof(1,1),
  readNativeFinalIntent:async()=>{reads++;return {eligibleForEngineBinding:true};},
 });
 assert.equal(result.stale,false);
 assert.equal(reads,1);
 assert.equal(result.finalIntent.eligibleForEngineBinding,true);
 assert.equal(result.finalIntentReadError,null);
});
test('unresolved and Match-1 masses never request native Final intent',async()=>{
 for(const p of [proof(1,0,1),proof(1,0,0,1)]){
  const result=await readXml229NativeFinalObservation({
   readCompletion:async()=>p,
   readNativeFinalIntent:async()=>{throw Error('must not be requested');},
  });
  assert.equal(result.finalIntent,null);
  assert.equal(result.finalIntentReadError,null);
 }
});
test('Final read failure retains valid Weight proof, returns allowlisted code only',async()=>{
 const result=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof(1,1),
  readNativeFinalIntent:async()=>{
   throw Object.assign(new Error('private model path'),
    {code:'FINAL_INTENT_CHANGED_DURING_HASH'});
  },
 });
 assert.equal(result.completion.counts.final,1);
 assert.equal(result.finalIntentReadError.code,'FINAL_INTENT_CHANGED_DURING_HASH');
 assert.doesNotMatch(JSON.stringify(result),/private model path/);
});
test('ineligible Final API, empty response or missing method is visible, not NOT_QUERIED',async()=>{
 const missing=await readXml229NativeFinalObservation({readCompletion:async()=>proof()});
 assert.equal(missing.finalIntentReadError.code,'FINAL_INTENT_READ_UNAVAILABLE');
 const empty=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof(),readNativeFinalIntent:async()=>null});
 assert.equal(empty.finalIntentReadError.code,'FINAL_INTENT_EMPTY_RESPONSE');
});
test('source replacement after asynchronous reads drops the entire observation',async()=>{
 let current=true;
 const result=await readXml229NativeFinalObservation({
  readCompletion:async()=>proof(),
  readNativeFinalIntent:async()=>{current=false;return {eligibleForEngineBinding:true};},
 },()=>current);
 assert.equal(result.stale,true);
 assert.equal(result.completion,null);
 assert.equal(result.finalIntent,null);
});
test('invalid or contradictory mass census does not request Final intent',async()=>{
 const bad={...proof(),counts:{source:1,final:0,match1:0,unresolved:0}};
 const result=await readXml229NativeFinalObservation({
  readCompletion:async()=>bad,
  readNativeFinalIntent:async()=>{throw Error('must not run');},
 });
 assert.equal(result.finalIntent,null);
});
