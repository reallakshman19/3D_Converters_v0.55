import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {attestXml229IndexedJsonForNative}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-native-indexed-json-handoff.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const json='{"original":"indexed","restraint":"GUIDE"}';
const digest=x=>createHash('sha256').update(x).digest('hex');
const sourceReceipt=Object.freeze({
 schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
 rightsBasis:'SOURCE_FACTS_ONLY',sha256:digest(json),byteLength:new Blob([json]).size,
 generationId:'source-generation-1',
});
const workerReceipt=Object.freeze({basisId:'b'.repeat(64),
 originalJsonSha256:sourceReceipt.sha256,
 sourceGenerationId:sourceReceipt.generationId,sourceId:'EF-05'});
const packet=Object.freeze({schema:'XML229.NativeFinalPhysicalPacket.v1',
 basisId:workerReceipt.basisId,
 originalJsonSha256:sourceReceipt.sha256,
 sourceGenerationId:sourceReceipt.generationId,
 sourceId:workerReceipt.sourceId,sourceXmlSha256:'a'.repeat(64),
 finalIntentSha256:'f'.repeat(64),physicalCount:249,
 nativeCiiReleaseAuthorized:false});
const input=(override={})=>({originalBlob:new Blob([json]),
 sourceReceipt,workerReceipt,packet,
 confirmPacket:async()=>packet,isCurrent:()=>true,...override});
test('current verified native packet automatically hands same O1 indexed Blob to converter',async()=>{
 const attachment=await attestXml229IndexedJsonForNative(input());
 assert.equal(await attachment.file.text(),json);
 assert.equal(attachment.sha256,sourceReceipt.sha256);
 assert.equal(attachment.basisId,packet.basisId);
 assert.equal(attachment.sourceGenerationId,sourceReceipt.generationId);
 assert.equal(attachment.nativeCiiReleaseAuthorized,undefined,
   'source handoff alone is never CII approval');
});
test('unresolved/no Final packet cannot release original indexed JSON to engine',async()=>{
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  confirmPacket:async()=>{throw Object.assign(new Error('unresolved'),{code:'NATIVE_FINAL_MASS_CENSUS_UNREADY'});},
 })),{code:'NATIVE_FINAL_MASS_CENSUS_UNREADY'});
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  packet:{...packet,finalIntentSha256:''},
 })),{code:'NATIVE_INDEXED_JSON_ORIGINAL_CUSTODY_REQUIRED'});
});
test('current Final intent changes before engine input and is rejected',async()=>{
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  confirmPacket:async()=>({...packet,finalIntentSha256:'e'.repeat(64)}),
 })),{code:'NATIVE_INDEXED_JSON_FINAL_PACKET_CHANGED'});
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  confirmPacket:async()=>({...packet,physicalCount:248}),
 })),{code:'NATIVE_INDEXED_JSON_FINAL_PACKET_CHANGED'});
});
test('wrong original JSON and cross-basis or stale worker are rejected',async()=>{
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  originalBlob:new Blob([json.replace('GUIDE','FIXED')]),
  sourceReceipt:{...sourceReceipt,byteLength:new Blob([json.replace('GUIDE','FIXED')]).size},
 })),{code:'NATIVE_INDEXED_JSON_SHA_DRIFT'});
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  packet:{...packet,basisId:'c'.repeat(64)},
 })),{code:'NATIVE_INDEXED_JSON_PACKET_BASIS_DRIFT'});
 await assert.rejects(attestXml229IndexedJsonForNative(input({
  isCurrent:()=>false,
 })),{code:'NATIVE_INDEXED_JSON_ORIGINAL_CUSTODY_REQUIRED'});
});
test('Run uses existing Worker O1 automatically and keeps default JSON-restraints and independent CII gate',async()=>{
 const root='tabs/xml-cii-2019-standalone/';
 const client=await readFile(new URL('../'+root+
  'integration/xml229-original-blob-gcpw-client.mjs',import.meta.url),'utf8');
 const candidate=await readFile(new URL('../'+root+
  'ui-adapted/xml229-native-cii-candidate-run.mjs',import.meta.url),'utf8');
 const run=await readFile(new URL('../'+root+
  'ui-adapted/xml-cii-adapted-output-run.js',import.meta.url),'utf8');
 assert.match(client,/readNativeOriginalJsonForEngine/);
 assert.match(client,/confirmPacket:\(\)=>rpc\(\{kind:'read',what:'native-final-packet'/);
 assert.match(candidate,/session\.readNativeFinalPacket\(\)/);
 assert.match(candidate,/session\.readNativeOriginalJsonForEngine\(\{packet\}\)/);
 assert.match(candidate,/reconcileXml229ActualCiiAgainstFinal/);
 assert.match(candidate,/independent\.strictOneToOneOwnerMatch!==true/);
 assert.match(candidate,/packet\.reviewSourceKind==='XML_ONLY'\?\{useRestraintTypeBasedOnJson:false\}:\{\}/);
 assert.match(candidate,/\.\.\.workflowOptionsFromState\(state\)/);
 assert.doesNotMatch(run,/createXml229NativeJsonReattachControl/);
 for(const path of ['integration/xml229-native-indexed-json-handoff.mjs',
  'integration/xml229-original-blob-gcpw-client.mjs',
  'ui-adapted/xml229-native-cii-candidate-run.mjs',
  'ui-adapted/xml-cii-adapted-output-run.js']){
  assert.equal(
   await readFile(new URL('../'+root+path,import.meta.url),'utf8'),
   await readFile(new URL('../docs/'+root+path,import.meta.url),'utf8'),path);
 }
});
