import test from 'node:test';
import assert from 'node:assert/strict';
import {digestUtf8} from '../contracts/gc-pw-v1/contract.mjs';
import {resolveXml229ReviewSourceInput as resolveSource} from '../tabs/xml-cii-2019-standalone/integration/xml229-review-source-input.mjs';
import {openXml229WeightDraftWorkspace} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-p4-weight-draft-workspace.mjs';
import {readXml229LivePreviewForCurrentInput as restore} from '../tabs/xml-cii-2019-standalone/integration/xml229-live-preview-restoration.mjs';
const xml='<PipeStressExport><Pipe/></PipeStressExport>';
const sourceXmlSha256=await digestUtf8(xml);
const input={reviewSourceKind:'XML_ONLY',xmlText:xml,sourceXmlSha256};
test('XML-only review has a full XML identity and explicitly absent JSON, without an O1 receipt',async()=>{
 const r=await resolveSource(input);
 assert.equal(r.stagedSource,null);assert.equal(r.identity.sha256,null);
 assert.equal(r.identity.schema,'XML229.XmlOnlyReviewSource.v1');
 assert.equal(r.identity.generationId,'xml-only:sha256:'+sourceXmlSha256);
});
test('XML-only mode rejects stale XML and any attached JSON Blob/receipt',async()=>{
 for(const altered of [{xmlText:xml+' '},{originalStagedBlob:new Blob(['{}'])},
   {originalStagedSourceReceipt:{phase:'INDEX_COMMITTED'}}])
   await assert.rejects(resolveSource({...input,...altered}));
});
test('absent JSON cannot silently satisfy a selected JSON source',async()=>{
 await assert.rejects(resolveSource({xmlText:xml}),{code:'ORIGINAL_STAGED_BLOB_NOT_ATTESTED'});
});
test('JSON source still verifies actual original bytes and rejects substitution',async()=>{
 const blob=new Blob(['{}']),sha=await digestUtf8('{}');
 const receipt={schema:'XML229.OriginalStagedSourceReceipt.v1',phase:'INDEX_COMMITTED',
  rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,sha256:sha,
  sourceRevision:'o1:sha256:'+sha,generationId:'real-json-generation',sourceRefId:'json',
  occurrenceCount:1,pageCount:1,byteLength:blob.size};
 const req={xmlText:xml,originalStagedBlob:blob,originalStagedSourceReceipt:receipt};
 assert.equal((await resolveSource(req)).stagedSource,'{}');
 await assert.rejects(resolveSource({...req,originalStagedBlob:new Blob(['[]'])}),{code:'ORIGINAL_JSON_SHA256_DRIFT'});
});
const receipt={basisId:'c'.repeat(64),sourceId:'xml-source',reviewSourceKind:'XML_ONLY',
 originalJsonSha256:null,sourceXmlSha256,sourceGenerationId:'xml-only:sha256:'+sourceXmlSha256,physicalCount:1};
test('XML-only Applied Weight drafts save with exact XML SHA and reject a fake generation',()=>{
 const items=new Map(),storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)};
 const workspace=openXml229WeightDraftWorkspace(receipt,{storage,occurrenceIds:['p1']});
 workspace.drafts.set('p1',{value:'12.5',proposalId:'',reason:'Explicit test draft'});
 workspace.save();
 const saved=JSON.parse([...items.values()][0]);
 assert.equal(saved.sourceXmlSha256,sourceXmlSha256);assert.equal(saved.originalJsonSha256,null);
 assert.equal(saved.nativeCiiReleaseAuthorized,false);
 assert.throws(()=>openXml229WeightDraftWorkspace({...receipt,sourceGenerationId:'wrong'},{storage}));
});
test('XML-only Preview restoration verifies full current XML and rejects JSON arrival or replaced XML',async()=>{
 const proof={...receipt,schema:'XML229.P4.RunAdvisory.v1',verifiedPhysicalCount:1,verifiedFactCount:7,
   counts:{source:0,match1:0,final:0,unresolved:1},engineeringFactsVerified:true,
   previewStatus:'FULL_SOURCE_FACTS_VERIFIED',ciiReleaseAuthorized:false};
 const session={receipt,readCompletion:async()=>proof,readPreviewResult:async()=>({
   sourceOccurrences:{branchCount:1},branchRows:[{}],nodeRows:[]})};
 await restore({session,input:{sourceText:xml}});
 for(const patch of [{sourceText:xml+' '},{stagedJsonFile:new Blob(['{}'])}])
   await assert.rejects(restore({session,input:{sourceText:xml,...patch}}));
});
