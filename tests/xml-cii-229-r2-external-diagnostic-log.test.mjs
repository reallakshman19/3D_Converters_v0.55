import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {physicalOccurrenceId} from '../contracts/gc-pw-v1/occurrence-bridge.mjs';
import {buildXml229ExternalDiagnosticLog}
 from '../tabs/xml-cii-2019-standalone/integration/xml229-r2-external-diagnostic-log.mjs';
import {publishXml229ReadOnlyLog}
 from '../scripts/xml229-r2-external-log-cli.mjs';

const b='a'.repeat(64),origin='b'.repeat(64),finalSha='c'.repeat(64);
const xmlHash='d'.repeat(64),ciiHash='e'.repeat(64);
const src='synthetic-original-source',gen='test-revision-1';
const id=(index,kind)=>physicalOccurrenceId({
  sourceId:src,branchOccurrenceIndex:0,nodeOrdinal:index,
  componentSignature:JSON.stringify([kind,'synthetic-ref-'+index,'2','']),
});
const originalPhysicalRows=[
  {sourceId:src,occurrenceId:id(1,'RIGID'),branchOccurrenceIndex:0,nodeOrdinal:1,
   componentSignature:JSON.stringify(['RIGID','synthetic-ref-1','2','']),
   sourceKg:null,match1Kg:35,finalKg:35,effectiveKg:35},
  {sourceId:src,occurrenceId:id(2,'VALV'),branchOccurrenceIndex:0,nodeOrdinal:2,
   componentSignature:JSON.stringify(['VALV','synthetic-ref-2','2','']),
   sourceKg:null,match1Kg:50,finalKg:50,effectiveKg:50},
];
const envelope=()=>({
  runId:'SYNTHETIC-TEST-NOT-OWNER-DATA',basisId:b,sourceId:src,
  originalJsonSha256:origin,sourceGenerationId:gen,
  originalPhysicalRows:structuredClone(originalPhysicalRows),
  finalIntent:{
    schema:'XML229.NativeFinalPhysicalIntent.v1',basisId:b,
    originalJsonSha256:origin,sourceGenerationId:gen,
    physicalCount:2,intentSha256:finalSha,nativeCiiReleaseAuthorized:false,
    eligibleForEngineBinding:true,
  },
  transferManifest:{
    schema:'XML229.R2.OriginalPhysicalEngineInputTransfer.v1',
    basisId:b,originalJsonSha256:origin,sourceGenerationId:gen,
    finalIntentSha256:finalSha,engineInputSha256:xmlHash,
    complete:true,originalPhysicalCount:2,verifiedEnginePhysicalCount:2,
    nativeCiiReleaseAuthorized:false,
    matches:[
      {originalOccurrenceId:id(1,'RIGID'),engineNodeOrdinal:1,engineWeightKg:35},
      {originalOccurrenceId:id(2,'VALV'),engineNodeOrdinal:2,engineWeightKg:50},
    ],
  },
  engineWitness:{
    schema:'XML229.NativeCiiEngineBoundary.v1',engineBoundaryVerified:true,
    engineInputSha256:xmlHash,ciiOutputSha256:ciiHash,
    nativeCiiReleaseAuthorized:false,
  },
  nativeSlotReceipt:{
    schema:'XML229.R2.NativeRigidSlotAudit.v1',basisId:b,
    finalIntentSha256:finalSha,engineInputSha256:xmlHash,ciiOutputSha256:ciiHash,
    rigidOnlyVerified:true,allPhysicalKindsVerified:false,
    nativeCiiReleaseAuthorized:false,
    rigidSlots:[{originalOccurrenceId:id(1,'RIGID'),
      rigidSlotOrdinal:0,approvedKg:35,ciiSlotMass:35}],
  },
});

test('complete synthetic external receipts log RIGID slot, hold VALV and never authorize release',async()=>{
 const {log,csv,json}=await buildXml229ExternalDiagnosticLog(envelope());
 assert.equal(log.schema,'XML229.R2.ExternalDiagnosticLog.v1');
 assert.equal(log.releaseStatus,'HOLD');
 assert.equal(log.nativeCiiReleaseAuthorized,false);
 assert.equal(log.physicalEngineConsumptionVerified,false);
 assert.equal(log.sourceCensusIndependentlyVerifiedByThisLog,false);
 assert.equal(log.expectedOriginalPhysicalCount,2);
 assert.equal(log.observedEnrichedCount,2);
 assert.equal(log.observedNativeSlotCount,1);
 assert.equal(log.heldCount,1);
 assert.deepEqual(log.rows.map(x=>x.status),[
  'OBSERVED_RIGID_SLOT_ONLY','HOLD_NATIVE_CII_SLOT_UNVERIFIABLE',
 ]);
 assert.equal(log.rows[0].nativeSlot,0);
 assert.equal(log.rows[1].nativeSlot,null);
 assert.equal(log.rows[1].ciiValue,null);
 assert.match(csv,/physicalOccurrenceId/);
 assert.match(csv,/HOLD_NATIVE_CII_SLOT_UNVERIFIABLE/);
 assert.deepEqual(JSON.parse(json).statuses,log.statuses);
 assert(!json.includes('PRIVATE_STAGED_JSON_RAW_BODY'));
});
test('missing Final, transfer or native engine emits explicit per-source HOLD not guessed CII',async()=>{
 const d=envelope();
 d.finalIntent=null;d.transferManifest=null;d.engineWitness=null;d.nativeSlotReceipt=null;
 const absent=await buildXml229ExternalDiagnosticLog(d);
 assert.deepEqual(absent.log.rows.map(x=>x.status),
   ['HOLD_FINAL_INTENT_MISSING','HOLD_FINAL_INTENT_MISSING']);
 assert.equal(absent.log.heldCount,2);
 d.finalIntent=envelope().finalIntent;
 const noMap=await buildXml229ExternalDiagnosticLog(d);
 assert.equal(noMap.log.rows[0].status,'HOLD_SOURCE_TO_ENGINE_UNVERIFIED');
 d.transferManifest=envelope().transferManifest;
 const noOutput=await buildXml229ExternalDiagnosticLog(d);
 assert.equal(noOutput.log.rows[0].status,'HOLD_ENGINE_OUTPUT_UNVERIFIED');
 d.engineWitness=envelope().engineWitness;
 const noSlot=await buildXml229ExternalDiagnosticLog(d);
 assert.equal(noSlot.log.rows[0].status,'HOLD_NATIVE_CII_SLOT_UNVERIFIABLE');
});
test('altered source, renamed original, duplicate, missing physical and competing SHA receipts refuse',async()=>{
 const wrong=envelope();wrong.transferManifest.finalIntentSha256='f'.repeat(64);
 await assert.rejects(buildXml229ExternalDiagnosticLog(wrong),e=>e.code==='CROSS_BASIS_TRANSFER_FINAL');
 const duplicate=envelope();duplicate.originalPhysicalRows[1].occurrenceId=duplicate.originalPhysicalRows[0].occurrenceId;
 await assert.rejects(buildXml229ExternalDiagnosticLog(duplicate),e=>e.code==='ORIGINAL_SCOPE_OR_IDENTITY_DRIFT'||e.code==='DUPLICATE_ORIGINAL_ID');
 const changed=envelope();changed.engineWitness.ciiOutputSha256='f'.repeat(64);
 await assert.rejects(buildXml229ExternalDiagnosticLog(changed),e=>e.code==='CROSS_BASIS_NATIVE_CII');
 const claimed=envelope();claimed.nativeSlotReceipt.nativeCiiReleaseAuthorized=true;
 await assert.rejects(buildXml229ExternalDiagnosticLog(claimed),e=>e.code==='FALSE_NATIVE_RELEASE_CLAIM');
 const renamed=envelope();renamed.originalPhysicalRows[0].sourceId='other';
 await assert.rejects(buildXml229ExternalDiagnosticLog(renamed),e=>e.code==='ORIGINAL_SCOPE_OR_IDENTITY_DRIFT');
 const missing=envelope();missing.transferManifest.matches.pop();
 await assert.rejects(buildXml229ExternalDiagnosticLog(missing),e=>e.code==='INCOMPLETE_TRANSFER');
 const wrongMass=envelope();wrongMass.nativeSlotReceipt.rigidSlots[0].approvedKg=40;
 await assert.rejects(buildXml229ExternalDiagnosticLog(wrongMass),e=>e.code==='NATIVE_SLOT_MASS_DRIFT');
});
test('source identity with repeated NodeNumber is by canonical original ordinal, not raw NodeNumber',async()=>{
 const d=envelope();
 d.originalPhysicalRows[0].nodeNumber=-1;
 d.originalPhysicalRows[1].nodeNumber=-1;
 const built=await buildXml229ExternalDiagnosticLog(d);
 assert.notEqual(built.log.rows[0].physicalOccurrenceId,built.log.rows[1].physicalOccurrenceId);
 assert.deepEqual(built.log.rows.map(r=>r.originalNodeOrdinal),[1,2]);
});
test('CLI writes deterministic JSON/CSV to disk with NO CII converter invocation',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'xml229-r2-offline-'));
 const inputPath=join(directory,'synthetic-receipts.json');
 const stem=join(directory,'evidence','read-only-r2');
 await writeFile(inputPath,JSON.stringify(envelope()));
 const result=await publishXml229ReadOnlyLog({inputPath,outStem:stem});
 assert.equal(result.status,'HOLD');
 assert.equal(result.rows,2);
 assert.equal(result.held,1);
 const a=JSON.parse(await readFile(result.jsonPath,'utf8'));
 const csv=await readFile(result.csvPath,'utf8');
 assert.equal(a.nativeCiiReleaseAuthorized,false);
 assert(csv.includes('OBSERVED_RIGID_SLOT_ONLY'));
});
test('served docs are byte-identical to independently extracted diagnostic modules',async()=>{
 const files=[
  'tabs/xml-cii-2019-standalone/xml-cii-native-output-consumption-evidence.js',
  'converters/xml-cii2019-core/weight-facts-native-consumption-intent.js',
  'tabs/xml-cii-2019-standalone/integration/xml229-r2-physical-transfer-manifest.mjs',
  'tabs/xml-cii-2019-standalone/integration/xml229-r2-external-diagnostic-log.mjs',
 ];
 for(const file of files){
  assert.deepEqual(await readFile(new URL('../'+file,import.meta.url)),
   await readFile(new URL('../docs/'+file,import.meta.url)));
 }
});
