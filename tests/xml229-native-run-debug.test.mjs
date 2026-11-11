import test from 'node:test';
import assert from 'node:assert/strict';
import {createStandaloneEngineWorkerClient} from '../converters/xml-cii-2019-standalone/engine-worker-client.mjs';
import {nativeRunPhase,reportNativeRunPhase} from '../converters/xml-cii-2019-standalone/engine-progress.mjs';
import {recordXml229CandidateAttempt,getXml229CandidateAttempt}
 from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs';
import {buildXml229RunHoldAudit}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-run-hold-audit.mjs';

// Explicit transport-only Worker double; no converter results or masses mocked.
class TransportWorker {
 listeners={};request=null;terminated=false;
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 postMessage(request){this.request=request;}
 send(data){for(const fn of this.listeners.message||[])fn({data});}
 terminate(){this.terminated=true;}
}
test('timeout preserves last valid stage; ignores private text, wrong job and duplicate progress',async()=>{
 const worker=new TransportWorker(),seen=[];
 const client=createStandaloneEngineWorkerClient({workerFactory:()=>worker,timeoutMs:40});
 const result=client.run({}, {onProgress:phase=>seen.push(phase)});
 const rejected=assert.rejects(result,{code:'STANDALONE_ENGINE_TIMEOUT',phase:'MODEL_PARSE'});
 await new Promise(resolve=>setImmediate(resolve));
 const id=worker.request.id;
 for(const [job,phase] of [[id,'MODEL_PARSE'],[id,'MODEL_PARSE'],[id+1,'OUTPUT_WRITE'],
  [id,'PRIVATE_SOURCE_FILENAME'],[id,'/private/owner.xml']])
  worker.send({kind:'XML_CII_PROGRESS',id:job,phase});
 await rejected;
 assert.deepEqual(seen,['ENGINE_QUEUED','MODEL_PARSE']);
 assert.equal(worker.terminated,true);client.dispose();
});
test('debug callback failures cannot reject or authorize an actual transport result',async()=>{
 const worker=new TransportWorker();
 const client=createStandaloneEngineWorkerClient({workerFactory:()=>worker});
 const result=client.run({}, {onProgress:()=>{throw Error('diagnostic failure');}});
 await new Promise(resolve=>setImmediate(resolve));
 worker.send({kind:'XML_CII_PROGRESS',id:worker.request.id,phase:'SCRIPT_LOAD'});
 worker.send({kind:'XML_CII_RESULT',id:worker.request.id,result:{ok:false,error:'ENGINE_FAILED'}});
 assert.equal((await result).ok,false);client.dispose();
});
test('failed attempt retains bounded isolated stage history; retry resets it',()=>{
 const ref={current:{}},session={closed:false};
 recordXml229CandidateAttempt(ref,session,{status:'IN_PROGRESS',phase:'READING_FINAL_MASSES'});
 for(let i=0;i<40;i++)recordXml229CandidateAttempt(ref,session,
  {status:'IN_PROGRESS',phase:i%2?'MODEL_PARSE':'MODEL_BUILD'});
 recordXml229CandidateAttempt(ref,session,{status:'FAILED',code:'STANDALONE_ENGINE_TIMEOUT'});
 const first=getXml229CandidateAttempt(ref,session);
 assert.equal(first.phase,'MODEL_PARSE');assert.equal(first.stages.length,32);
 assert(first.elapsedMs>=0);first.stages[0].phase='FORGED';
 assert.notEqual(getXml229CandidateAttempt(ref,session).stages[0].phase,'FORGED');
 recordXml229CandidateAttempt(ref,session,{status:'IN_PROGRESS'});
 assert.deepEqual(getXml229CandidateAttempt(ref,session).stages,[]);
 assert.equal(getXml229CandidateAttempt(ref,{closed:false}),null);
});
test('in-progress candidate is the first unverified boundary, while all release flags remain false',()=>{
 const sha='a'.repeat(64),basis='b'.repeat(64),sourceId='TEST';
 const input={sourceKind:'xml',sourceText:'<Plant/>',options:{},modeASourceId:sourceId,
  xml229StagedSourceReceipt:{schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
   sha256:sha,generationId:'G1'}};
 const sessionReceipt={basisId:basis,sourceId,originalJsonSha256:sha,sourceGenerationId:'G1',physicalCount:1};
 const completion={schema:'XML229.P4.RunAdvisory.v1',...sessionReceipt,
  verifiedPhysicalCount:1,verifiedFactCount:7,counts:{source:0,match1:0,final:1,unresolved:0},
  engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false};
 const finalIntent={schema:'XML229.NativeFinalPhysicalIntent.v1',...sessionReceipt,
  verifiedFactCount:7,sourceAcceptedCount:0,acceptedFinalCount:1,match1OnlyCount:0,
  unresolvedCount:0,intentSha256:'c'.repeat(64),eligibleForEngineBinding:true};
 const audit=buildXml229RunHoldAudit({input,sessionReceipt,completion,finalIntent,sessionState:'LIVE',
  report:{checklistRows:[{id:'xml229-original-json-engineering-authority',blocking:true}]},
  candidate:{status:'IN_PROGRESS',phase:'MODEL_PARSE',elapsedMs:72000,
   stages:[{phase:'MODEL_PARSE',elapsedMs:1000},{phase:'PRIVATE_FILE',elapsedMs:2000}]}});
 assert.equal(audit.firstUnverifiedBoundary,'worker-r2-and-native-candidate');
 assert.equal(audit.nativeCandidate.stages.length,1);
 assert.equal(audit.nativeCiiReleaseAuthorized,false);assert.equal(audit.ciiDownloadAuthorized,false);
 assert(!JSON.stringify(audit).includes('PRIVATE_FILE'));
});
test('only allowlisted progress is visible',()=>{
 assert.equal(nativeRunPhase('SOURCE PRIVATE'),null);
 let calls=0;reportNativeRunPhase(()=>calls++,'PRIVATE_SOURCE');assert.equal(calls,0);
});
