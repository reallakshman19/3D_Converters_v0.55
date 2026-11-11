/**
 * Governed XML229 native-weight consumption diagnostic.
 * Runs the ACTUAL native converter, then an independent parser over its
 * ACTUAL CII bytes. Release requires a current live Worker and 1:1 proof.
 */
import {readTextFile,enrichSupportConfigJson,workflowOptionsFromState,sourceNameFromState}
 from '../xml-cii-workflow-ui-adapter.js';
import {runXmlCii2019StandaloneEngineJob}
 from '../xml-cii-workflow-engine-client.js';
import {resolveXml229NativeCandidateSource} from './xml229-native-source-custody.mjs';
import {getXml229NativeJsonReattachment} from './xml229-native-json-reattach.mjs';
import {reconcileXml229ActualCiiAgainstFinal}
 from '../../../converters/xml-cii2019-core/xml229-native-cii-independent-reconciliation.mjs';
import {requireXml229NativeOwnerPreflight} from './xml229-native-owner-preflight.mjs';
import {diagnoseXml229NativeConverterFailure} from './xml229-native-converter-failure-diagnostic.mjs';

import {nativeEnrichedFields} from '../../../converters/xml-cii-2019-standalone/native-enriched-artifact.js';
import {verifyCiiEngineeringAgainstNativeXml}
 from './xml-cii-adapted-propagation-proof.mjs';
import {reportNativeRunPhase} from '../../../converters/xml-cii-2019-standalone/engine-progress.mjs';

async function currentEnrichedArtifact(native,packet,session,isCurrent){
 try {
  const intent=await session.readNativeFinalIntent();
  return isCurrent()&&intent?.intentSha256===packet.finalIntentSha256
   ?nativeEnrichedFields(native):{};
 } catch {return {};}
}

const fail=(code)=>{const error=new Error(code);error.code=code;throw error;};

export async function runXml229NativeCiiMassCandidate({state,session,isCurrent=()=>true,onProgress}={}){
 const progress=phase=>reportNativeRunPhase(onProgress,phase);
 if(state?.options?.generateTopoFix===true||state?.options?.useTopoFixForCii===true||state?.xml229TopoFixFreshReviewPending)
  fail('NATIVE_TOPOFIX_PREFINAL_REVIEW_REQUIRED');
 if(!state||typeof session?.readNativeFinalPacket!=='function'||
    typeof session?.readCompletion!=='function'||
    typeof isCurrent!=='function'||!isCurrent())
  fail('NATIVE_CANDIDATE_CURRENT_WORKER_REQUIRED');
 progress('READING_FINAL_MASSES');
 const before=await session.readCompletion();
 if(!isCurrent()||before?.verifiedPhysicalCount<1||
    before.counts?.unresolved!==0||before.counts?.match1!==0)
  fail('NATIVE_CANDIDATE_FINAL_POPULATION_UNREADY');
 const packet=await session.readNativeFinalPacket();
 if(!isCurrent()||packet.basisId!==before.basisId||
    packet.sourceGenerationId!==before.sourceGenerationId||
    packet.originalJsonSha256!==before.originalJsonSha256||
    packet.physicalCount!==before.verifiedPhysicalCount)
  fail('NATIVE_CANDIDATE_BASIS_OR_CENSUS_DRIFT');
 // Diagnose current source-bound instrument owners BEFORE invoking native
 // conversion. This never authorizes mass or weakens the Python binder.
 requireXml229NativeOwnerPreflight(packet);
 // Use the exact independently owned original XML, NOT the selected subset
 // or a cached Preview table. The Python native writer verifies the full SHA.
 progress('RESOLVING_SOURCE');
 const attachment=packet.reviewSourceKind==='XML_ONLY'?null:!state.stagedJsonFile&&!state.stagedJsonText&&
   typeof session.readNativeOriginalJsonForEngine==='function'
     ?await session.readNativeOriginalJsonForEngine({packet})
     :getXml229NativeJsonReattachment(session);
 const {sourceText,stagedJsonText}=await resolveXml229NativeCandidateSource({
   state,packet,readFile:readTextFile,attachment,
 });
 if(!isCurrent())fail('NATIVE_CANDIDATE_BASIS_STALE');
 const options={
  ...workflowOptionsFromState(state),
  ...(packet.reviewSourceKind==='XML_ONLY'?{useRestraintTypeBasedOnJson:false}:{}),
  outputMode:'cii-only',kgToNewton:true,
  analyzeTopology:false,generateTopoFix:false,useTopoFixForCii:false,
  topologyActionIds:[],
 };
 progress('BUILDING_CONFIGURATION');
 // Masters enrich source XML; they never control whether XML→CII is
 // attempted. Release still requires independent inspection of the actual
 // emitted CII and exact Final→RIGID mass ownership.
 let verifiedConfig;
 try { verifiedConfig=JSON.parse(await enrichSupportConfigJson(state,state.branchScope||null)); }
 catch { fail('NATIVE_VERIFIED_MASTER_CONFIG_INVALID'); }
 if(!verifiedConfig||typeof verifiedConfig!=='object'||Array.isArray(verifiedConfig))
  fail('NATIVE_VERIFIED_MASTER_CONFIG_INVALID');
 // Master absence or format conflicts must not stop CII serialization.
 // The native output is still HELD unless its actual engineering fields verify.
 verifiedConfig.requireVerifiedMasterCompleteness=false;
 const job={
  sourceKind:'xml',sourceName:sourceNameFromState(state),
  sourceText,stagedJsonText,
  supportConfigJson:JSON.stringify(verifiedConfig),
  options,xml229NativeFinalPacket:packet,
 };
 if(!isCurrent())fail('NATIVE_CANDIDATE_BASIS_STALE');
 const native=await runXmlCii2019StandaloneEngineJob(job,{onProgress});
 progress('ENGINE_RESULT');
 if(!isCurrent())fail('NATIVE_CANDIDATE_BASIS_STALE');
 if(native?.ok!==true||!native.ciiText||!native.xml229NativeMassDiagnostic){
  // Preserve the actual native basis guard instead of masking it behind a
  // generic converter failure. The user must finalize geometry upstream,
  // then accept weights against that new source basis.
  const diagnosis=diagnoseXml229NativeConverterFailure(native);
  throw Object.assign(new Error(diagnosis.code),{
    code:diagnosis.code,phase:native?.nativePythonFailure?.stage||native?.nativeFailurePhase,
    xml229NativeFailure:diagnosis,
    xml229EnrichedArtifact:await currentEnrichedArtifact(native,packet,session,isCurrent),
  });
 }
 progress('VERIFYING_CII');
 if(typeof native.enrichedText!=='string'||!native.enrichedText.trim())
  fail('NATIVE_VERIFIED_ENRICHED_XML_REQUIRED');
 // Inspect native CII bytes, independently of source-XML completeness and
 // the existing exact Final→RIGID mass reconciliation.
 let engineering;
 try { engineering=verifyCiiEngineeringAgainstNativeXml(native.enrichedText,native.ciiText); }
 catch(error) {
  const result=Object.assign(new Error('NATIVE_CII_ENGINEERING_UNVERIFIED'),{
   code:'NATIVE_CII_ENGINEERING_UNVERIFIED',causeCode:String(error?.message||error)});
  result.xml229EnrichedArtifact=await currentEnrichedArtifact(native,packet,session,isCurrent);
  throw result;
 }
 let independent;
 try { independent=await reconcileXml229ActualCiiAgainstFinal({
  originalXmlText:sourceText,packet,ciiText:native.ciiText,
  writerDiagnostic:native.xml229NativeMassDiagnostic,
 }); } catch(error) {
  error.xml229EnrichedArtifact=await currentEnrichedArtifact(native,packet,session,isCurrent);
  throw error;
 }
 progress('RECHECKING_FINAL');
 const after=await session.readNativeFinalIntent();
 const finished=await session.readCompletion();
 if(!isCurrent()||after?.intentSha256!==packet.finalIntentSha256||
    finished?.basisId!==before.basisId||
    finished?.sourceGenerationId!==before.sourceGenerationId||
    finished?.originalJsonSha256!==before.originalJsonSha256||
    finished?.verifiedPhysicalCount!==before.verifiedPhysicalCount||
    finished?.counts?.unresolved!==0||finished?.counts?.match1!==0||
    independent.massConsumptionVerified!==true||
    independent.strictOneToOneOwnerMatch!==true||
    engineering.status!=='VERIFIED'||
    independent.nativeCiiReleaseAuthorized!==true)
  fail('NATIVE_CANDIDATE_FINAL_CHANGED_OR_OUTPUT_UNVERIFIED');
 return Object.freeze({
  schema:'XML229.GovernedNativeCandidateResult.v1',
  ...(packet.reviewSourceKind==='XML_ONLY'?{reviewSourceKind:'XML_ONLY'}:{}),
  ...nativeEnrichedFields(native),
  status:independent.status,
  basisId:packet.basisId,sourceId:packet.sourceId,
  sourceGenerationId:packet.sourceGenerationId,
  originalJsonSha256:packet.originalJsonSha256,
  sourceXmlSha256:packet.sourceXmlSha256,
  finalizedGeometrySha256:packet.finalizedGeometry?.sha256||null,
  finalIntentSha256:packet.finalIntentSha256,
  physicalCount:independent.physicalCount,
  nativeRigidCount:independent.nativeRigidCount,
  actualCiiSha256:independent.actualCiiSha256,
  massConsumptionVerified:true,
  strictOneToOneOwnerMatch:true,
  engineeringCiiVerified:true,
  engineeringElementsVerified:engineering.elements,
  engineeringRestraintsVerified:engineering.restraints,
  nativeCiiReleaseAuthorized:true,
  // Keep bytes in memory; caller may publish only within the same current lease.
  ciiText:native.ciiText,
 });
}
