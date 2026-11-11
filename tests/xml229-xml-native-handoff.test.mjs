import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWeightReviewService,WEIGHT_SCHEMA} from '../converters/xml-cii2019-core/weight-facts-review-service.js';
import {readVerifiedIndividualWeightReview,commitVerifiedIndividualWeightReview} from '../converters/xml-cii2019-core/weight-facts-individual-review.js';
import {commitXml229NativeFinalIntent} from '../converters/xml-cii2019-core/weight-facts-native-consumption-intent.js';
import {projectXml229WeightDecisionProvenance} from '../tabs/xml-cii-2019-standalone/integration/xml229-weight-decision-provenance.mjs';
import {isXml229VerifiedReviewCompletionForInput} from '../tabs/xml-cii-2019-standalone/integration/xml229-live-preview-restoration.mjs';
import {isXml229VerifiedCompletionForInput} from '../tabs/xml-cii-2019-standalone/integration/xml229-verified-output-readiness.mjs';
import {resolveXml229NativeCandidateSource} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-source-custody.mjs';
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const xml='<PipeStressExport/>',sourceId='XML',basisId=hash('basis'),sha=hash(xml);
const occurrenceId=JSON.stringify([sourceId,0,0,'["FLAN","REF","2","NAME"]']);
const source={reviewSourceKind:'XML_ONLY',originalJsonSha256:null,sourceXmlSha256:sha,sourceGenerationId:'xml-only:sha256:'+sha};
function fixture(){
 const basis={schemaVersion:WEIGHT_SCHEMA,basisId,domainId:'xml-cii/2019',
  sourceRefs:[{sourceId,sha256:sha,mediaType:'application/xml'}],scope:[{sourceId,selectionRef:'full'}],
  selectionSha256:hash('selection'),stagedSourceSha256:null,masters:{},configSha256:hash('config'),overridesSha256:hash('overrides')};
 const review=createWeightReviewService({score:()=>[],digestReview:async v=>hash(JSON.stringify(v))});
 review.openBasis(basis,{facts:[{schemaVersion:WEIGHT_SCHEMA,domainId:'xml-cii/2019',basisId,sourceId,occurrenceId,
  subjectType:'physical-component',fieldId:'mass.kg',value:null,unit:'kg',authority:'unresolved',provenance:[],diagnostics:[]}]});
 const session={basis,review,openedFacts:1};
 const view=readVerifiedIndividualWeightReview(session,{sourceId,occurrenceId,stage:'Rigidmatch2'});
 commitVerifiedIndividualWeightReview(session,view,{action:'set-zero-mass',value:0,unit:'kg',zeroMassConfirmed:true,
  reason:'Owner-confirmed explicit zero kg: isolated synthetic test decision'});
 return session;
}
test('XML-only native intent commits actual confirmed zero and rejects fake XML/JSON identity',async()=>{
 const session=fixture(),intent=await commitXml229NativeFinalIntent(session,source);
 assert.equal(intent.eligibleForEngineBinding,true);assert.equal(intent.acceptedFinalCount,1);
 assert.equal(intent.reviewSourceKind,'XML_ONLY');assert.equal(intent.originalJsonSha256,null);
 assert.equal(intent.nativeCiiReleaseAuthorized,false);
 for(const patch of [{sourceXmlSha256:hash('other')},{sourceGenerationId:'fake'},{originalJsonSha256:hash('{}')}])
  await assert.rejects(commitXml229NativeFinalIntent(session,{...source,...patch}),{code:'SOURCE_BASIS_REQUIRED'});
});
test('zero provenance needs a real matching confirmed command; absent/tampered commands stay unverified',async()=>{
 const session=fixture(),reviewState=await session.review.exportReviewState({basisId});
 const completion={basisId,sourceId,verifiedPhysicalCount:1,verifiedFactCount:7,engineeringFactsVerified:true,
  ciiReleaseAuthorized:false,counts:{source:0,match1:0,final:1,unresolved:0}};
 const audit=v=>projectXml229WeightDecisionProvenance({reviewState:v,basisId,sourceId,completion});
 assert.equal(audit(reviewState).summary.confirmedZero,1);assert.equal(audit(reviewState).summary.provenanceComplete,true);
 for(const mutation of ['missing','unconfirmed']){
  const altered=structuredClone(reviewState),entry=altered.reviewStates.find(x=>x.stage==='Rigidmatch2');
  if(mutation==='missing')entry.commands={};
  else for(const event of Object.values(entry.commands)){
   const cmd=JSON.parse(event.payload);cmd.zeroMassConfirmed=false;event.payload=JSON.stringify(cmd);
  }
  assert.equal(audit(altered).summary.unverified,1);
 }
});
test('readiness requires async full XML attestation and rejects proof mutation or stale/attached input',async()=>{
 const receipt={...source,basisId,sourceId,physicalCount:1},input={sourceText:xml};
 const proof={...receipt,schema:'XML229.P4.RunAdvisory.v1',verifiedPhysicalCount:1,verifiedFactCount:7,
  engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false,
  counts:{source:0,match1:0,final:1,unresolved:0}};
 assert.equal(isXml229VerifiedCompletionForInput(input,receipt,proof),false);
 assert.equal(await isXml229VerifiedReviewCompletionForInput(input,receipt,proof),true);
 assert.equal(isXml229VerifiedCompletionForInput({...input,sourceText:xml+' '},receipt,proof),false);
 assert.equal(isXml229VerifiedCompletionForInput({...input,stagedJsonText:'{}'},receipt,proof),false);
 proof.counts.final=0;assert.equal(isXml229VerifiedCompletionForInput(input,receipt,proof),false);
});
test('XML-only native source requires exact XML and refuses a late JSON input',async()=>{
 const packet={...source},readFile=async f=>f.bytes;
 assert.equal((await resolveXml229NativeCandidateSource({state:{sourceText:xml},packet,readFile})).stagedJsonText,'');
 await assert.rejects(resolveXml229NativeCandidateSource({state:{sourceText:xml+' '},packet,readFile}),{code:'NATIVE_CANDIDATE_SOURCE_XML_SHA_DRIFT'});
 await assert.rejects(resolveXml229NativeCandidateSource({state:{sourceText:xml,stagedJsonText:'{}'},packet,readFile}),{code:'NATIVE_CANDIDATE_XML_ONLY_JSON_CONFLICT'});
});
