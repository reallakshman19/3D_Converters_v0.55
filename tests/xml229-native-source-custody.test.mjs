import './xml229-instrument-source-review.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {attachXml229NativeJson,getXml229NativeJsonReattachment}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-json-reattach.mjs';
import {resolveXml229NativeCandidateSource}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-source-custody.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const xml='<PipeStressExport><Branch/></PipeStressExport>';
const json='{"Source":["original"]}';
const packet={schema:'XML229.NativeFinalPhysicalPacket.v1',
 sourceXmlSha256:digest(xml),originalJsonSha256:digest(json)};
const loadFile=async file=>file.bytes;

test('Worker O1 packet can supply governed custody when browser has no raw JSON',async()=>{
 const resolved=await resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonText:'',stagedJsonFile:null,
   options:{useRestraintTypeBasedOnJson:false}},
  packet,readFile:loadFile,
 });
 assert.equal(resolved.sourceText,xml);
 assert.equal(resolved.stagedJsonText,'');
 assert.equal(packet.originalJsonSha256,digest(json));
 assert.equal(resolved.nativeCiiReleaseAuthorized,undefined);
});
test('default JSON-restraint participation refuses absent browser JSON rather than silently opting out',async()=>{
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,options:{useRestraintTypeBasedOnJson:true}},
  packet,readFile:loadFile,
 }),{code:'NATIVE_CANDIDATE_JSON_RESTRAINT_SOURCE_REQUIRED'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml},packet,readFile:loadFile,
 }),{code:'NATIVE_CANDIDATE_JSON_RESTRAINT_SOURCE_REQUIRED'});
});

test('matching staged browser source is optional but mismatched JSON cannot ride Worker receipt',async()=>{
 const exact=await resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonText:json},packet,readFile:loadFile});
 assert.equal(exact.stagedJsonText,json);
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonText:'{"Source":["other"]}'},
  packet,readFile:loadFile}),{code:'NATIVE_CANDIDATE_STAGED_JSON_SHA_DRIFT'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonFile:{bytes:'{"Source":["other"]}'}},
  packet,readFile:loadFile}),{code:'NATIVE_CANDIDATE_STAGED_JSON_SHA_DRIFT'});
});
test('XML input absent/stale or unreadable never reaches converter',async()=>{
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:'',stagedJsonText:''},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_SOURCE_XML_REQUIRED'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml+'\n'},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_SOURCE_XML_SHA_DRIFT'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,sourceFile:{bytes:''}},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_SOURCE_XML_FILE_UNREADABLE'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,sourceFile:{bytes:xml+'\n'}},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_SOURCE_XML_CONFLICT'});
});
test('conflicting browser file and text or unreadable JSON fail closed',async()=>{
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonText:json,
    stagedJsonFile:{bytes:'other'}},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_STAGED_JSON_CONFLICT'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml,stagedJsonFile:{bytes:''}},packet,readFile:loadFile}),
  {code:'NATIVE_CANDIDATE_STAGED_JSON_FILE_UNREADABLE'});
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml},packet:{...packet,originalJsonSha256:'wrong'},
  readFile:loadFile}),{code:'NATIVE_CANDIDATE_SOURCE_CUSTODY_REQUIRED'});
});
test('Owner explicitly reattaches exact original JSON to the same Worker for restraint-based native Run',async()=>{
 const sourceGenerationId='original-generation',basisId='b'.repeat(64);
 const session={closed:false,receipt:{basisId,sourceGenerationId,
  originalJsonSha256:digest(json)},
  readCompletion:async()=>({basisId,sourceGenerationId,
   originalJsonSha256:digest(json)})};
 const file={text:async()=>json,bytes:json};
 assert.equal(getXml229NativeJsonReattachment(session),null);
 const attachment=await attachXml229NativeJson({session,file});
 assert.equal(attachment.sha256,digest(json));
 assert.equal(getXml229NativeJsonReattachment(session),attachment);
 const present=await resolveXml229NativeCandidateSource({
  state:{sourceText:xml,options:{useRestraintTypeBasedOnJson:true}},
  packet:{...packet,sourceGenerationId,basisId},
  attachment,readFile:loadFile});
 assert.equal(present.stagedJsonText,json);
 assert.equal(present.sourceText,xml);
 const stale={...attachment,sourceGenerationId:'different'};
 await assert.rejects(resolveXml229NativeCandidateSource({
  state:{sourceText:xml},packet:{...packet,sourceGenerationId,basisId},
  attachment:stale,readFile:loadFile
 }),{code:'NATIVE_CANDIDATE_JSON_ATTACHMENT_STALE'});
 session.closed=true;
 assert.equal(getXml229NativeJsonReattachment(session),null);
});
test('wrong JSON never attaches and cannot silently authorize native output',async()=>{
 const basisId='b'.repeat(64),sourceGenerationId='gen';
 const session={closed:false,receipt:{basisId,sourceGenerationId,
  originalJsonSha256:digest(json)},
  readCompletion:async()=>({basisId,sourceGenerationId,
   originalJsonSha256:digest(json)})};
 await assert.rejects(attachXml229NativeJson({
  session,file:{text:async()=>'{"bad":true}',bytes:'{"bad":true}'},
 }),{code:'NATIVE_JSON_ATTACH_SHA_MISMATCH'});
 assert.equal(getXml229NativeJsonReattachment(session),null);
});

test('native candidate remains guarded by independent mass output and no staged-JSON shortcut',async()=>{
 const candidate=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-cii-candidate-run.mjs',import.meta.url),'utf8');
 assert.match(candidate,/session\.readNativeFinalPacket\(\)/);
 assert.match(candidate,/resolveXml229NativeCandidateSource/);
 assert.doesNotMatch(candidate,/stagedJsonText\\?\\{\\}:\\{useRestraintTypeBasedOnJson:false\\}/);
 assert.match(candidate,/reconcileXml229ActualCiiAgainstFinal/);
 assert.match(candidate,/nativeCiiReleaseAuthorized!==true/);
 assert.doesNotMatch(candidate,/NATIVE_CANDIDATE_ORIGINAL_SOURCE_REQUIRED/);
 for(const p of ['xml229-native-source-custody.mjs','xml229-native-json-reattach.mjs','xml229-native-cii-candidate-run.mjs']){
  const root=await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/'+p,import.meta.url),'utf8');
  const served=await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/'+p,import.meta.url),'utf8');
  assert.equal(root,served,p);
 }
});
