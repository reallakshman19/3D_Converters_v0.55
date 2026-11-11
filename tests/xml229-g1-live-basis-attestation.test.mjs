import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPreviewBasis} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-basis.js';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {attestXml229G1LiveLease} from '../contracts/xml229-evidence-v1/live-basis-attestation.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const code=c=>e=>e?.code===c;
function corpus(){
 const sources=[{sourceId:'S1',mediaType:'application/xml',text:
   '<Plant><Branch><Node><NodeNumber>-1</NodeNumber></Node></Branch></Plant>'}];
 const masters=Object.fromEntries(
   ['lineList','pipingClass','materials','valveWeights'].map((key,i)=>
   [key,{datasetId:'data-'+key,revision:'R1',rows:[{id:i+1,kg:10+i}],
     mapping:{weight:'kg'}}]));
 return {domainId:'xml-cii/2019',sources,masters,
   selection:[{sourceId:'S1',selectionRef:'all'}],
   stagedSource:'{"original":[{"branch":0,"node":-1}]}',
   config:{policy:'one'},overrides:{}};
}
async function scenario(){
 const c=corpus(),basis=await createPreviewBasis({...c,sha256:digestUtf8});
 const sourceReceipt={schema:'XML229.OriginalStagedSourceReceipt.v1',
   sha256:basis.stagedSourceSha256,generationId:'GEN1',phase:'INDEX_COMMITTED'};
 const sessionReceipt={basisId:basis.basisId,sourceId:'S1',
   originalJsonSha256:sourceReceipt.sha256,sourceGenerationId:'GEN1',physicalCount:1};
 const completion={schema:'XML229.P4.RunAdvisory.v1',basisId:basis.basisId,sourceId:'S1',
   originalJsonSha256:sourceReceipt.sha256,sourceGenerationId:'GEN1',
   engineeringFactsVerified:true,previewStatus:'FULL_SOURCE_FACTS_VERIFIED',
   ciiReleaseAuthorized:false,verifiedPhysicalCount:1,verifiedFactCount:7,
   counts:{source:0,match1:0,final:0,unresolved:1}};
 const live={sources:{S1:c.sources[0].text},masters:c.masters,selection:c.selection,
   stagedSource:c.stagedSource,config:c.config,overrides:c.overrides};
 const readCurrentLease=()=>({basisId:basis.basisId,
   sourceId:'S1',sourceGenerationId:'GEN1',requestId:'REQUEST-1',closed:false});
 return {basis,sourceReceipt,sessionReceipt,completion,live,readCurrentLease,
   requestId:'REQUEST-1'};
}
test('GC-PW hashes actual source and master bytes; does not approve any weight or CII',async()=>{
 const result=await attestXml229G1LiveLease(await scenario());
 assert.equal(result.byteCustodyAttested,true);
 assert.equal(result.verifiedFactCount,7);
 assert.equal(result.counts.unresolved,1);
 assert.equal(result.reviewDecisionsAuthorized,false);
 assert.equal(result.nativeQualificationAuthorized,false);
 assert.equal(result.nativeCiiReleaseAuthorized,false);
});
test('changing same-length source text invalidates live byte custody',async()=>{
 const s=await scenario();s.live.sources.S1=s.live.sources.S1.replace('-1','-2');
 await assert.rejects(attestXml229G1LiveLease(s),code('CONTENT_DIGEST_MISMATCH'));
});
test('changing master row with same row count invalidates custody',async()=>{
 const s=await scenario();s.live.masters.lineList.rows[0].kg=999;
 await assert.rejects(attestXml229G1LiveLease(s),code('MASTER_CONTENT_DRIFT'));
});
test('changing master mapping invalidates custody',async()=>{
 const s=await scenario();s.live.masters.pipingClass.mapping.weight='lb';
 await assert.rejects(attestXml229G1LiveLease(s),code('MASTER_MAPPING_DRIFT'));
});
test('changing staged original JSON bytes invalidates custody',async()=>{
 const s=await scenario();s.live.stagedSource=s.live.stagedSource.replace('node','mode');
 await assert.rejects(attestXml229G1LiveLease(s),code('CONTENT_DIGEST_MISMATCH'));
});
test('changed generation or Worker InputBasis is refused',async()=>{
 const s=await scenario();s.completion.sourceGenerationId='OLD';
 await assert.rejects(attestXml229G1LiveLease(s),code('SOURCE_GENERATION_OR_SHA_DRIFT'));
 const t=await scenario();t.sessionReceipt.basisId='f'.repeat(64);
 await assert.rejects(attestXml229G1LiveLease(t),code('CROSS_BASIS_OR_SOURCE_PROOF'));
});
test('incomplete fact population or unsupported release claim is refused',async()=>{
 const s=await scenario();s.completion.verifiedFactCount=6;
 await assert.rejects(attestXml229G1LiveLease(s),code('PHYSICAL_FACT_OR_MASS_CENSUS_DRIFT'));
 const t=await scenario();t.completion.ciiReleaseAuthorized=true;
 await assert.rejects(attestXml229G1LiveLease(t),code('UNVERIFIED_ENGINEERING_COMPLETION'));
});
test('closed late Worker cannot publish proof following asynchronous hashing',async()=>{
 const s=await scenario();let calls=0;
 s.readCurrentLease=()=>({basisId:s.basis.basisId,sourceId:'S1',
   sourceGenerationId:'GEN1',requestId:'REQUEST-1',closed:++calls>1});
 await assert.rejects(attestXml229G1LiveLease(s),code('LEASE_SUPERSEDED_OR_CLOSED'));
 assert.equal(calls,2);
});
test('live Worker ownership port is mandatory',async()=>{
 const s=await scenario();delete s.readCurrentLease;
 await assert.rejects(attestXml229G1LiveLease(s),code('CURRENT_LEASE_PORT_REQUIRED'));
});
test('basis metadata tampering fails GC-PW SHA validation',async()=>{
 const s=await scenario();s.basis={...s.basis,configSha256:'e'.repeat(64)};
 await assert.rejects(attestXml229G1LiveLease(s),code('STALE_BASIS'));
});
test('selection and config drift are detected from actual live inputs',async()=>{
 const s=await scenario();s.live.selection[0].selectionRef='changed';
 await assert.rejects(attestXml229G1LiveLease(s),code('SELECTION_DRIFT'));
 const t=await scenario();t.live.config.policy='other';
 await assert.rejects(attestXml229G1LiveLease(t),code('CONFIG_DRIFT'));
});
test('receipt SHA must identify the same staged original JSON InputBasis',async()=>{
 const s=await scenario();s.sourceReceipt.sha256='d'.repeat(64);
 await assert.rejects(attestXml229G1LiveLease(s),code('STAGED_JSON_BASIS_DRIFT'));
});

test('missing or ambiguous closed flag cannot pass a current Worker lease',async()=>{
 const s=await scenario();
 s.readCurrentLease=()=>({basisId:s.basis.basisId,sourceId:'S1',
   sourceGenerationId:'GEN1',requestId:'REQUEST-1'});
 await assert.rejects(attestXml229G1LiveLease(s),code('LEASE_SUPERSEDED_OR_CLOSED'));
});
test('secondary completion release assertions are rejected, not forwarded',async()=>{
 for(const key of ['nativeCiiReleaseAuthorized','nativeQualificationAuthorized',
   'reviewDecisionsAuthorized']){
   const s=await scenario();s.completion[key]=true;
   await assert.rejects(attestXml229G1LiveLease(s),code('UNVERIFIED_ENGINEERING_COMPLETION'));
 }
});

test('same InputBasis/source still rejects a superseded request identity',async()=>{
 const s=await scenario();s.requestId='REQUEST-2';
 await assert.rejects(attestXml229G1LiveLease(s),code('LEASE_SUPERSEDED_OR_CLOSED'));
});
test('a missing current request identity is not a valid lease challenge',async()=>{
 const s=await scenario();delete s.requestId;
 await assert.rejects(attestXml229G1LiveLease(s),code('CURRENT_REQUEST_ID_REQUIRED'));
});
