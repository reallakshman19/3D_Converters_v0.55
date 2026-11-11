import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasXml229PreviewJsonSource} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml229-preview-json-source.mjs';
import {runPreviewButtonSession} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-facts-button-session.js';

test('absent JSON is optional, including explicit empty initial state',()=>{
  assert.equal(hasXml229PreviewJsonSource(),false);
  assert.equal(hasXml229PreviewJsonSource({stagedJsonFile:null,stagedJsonText:'',
    xml229StagedSourceReceipt:null,xml229StagedSourceStatus:''}),false);
});
test('File-only, legacy text, indexed, revoked and failed JSON are never treated as absent',()=>{
  for(const state of [{stagedJsonFile:new Blob(['{}'])},{stagedJsonText:'{}'},
    {xml229StagedSourceReceipt:{phase:'INDEX_COMMITTED'}},
    {xml229StagedSourceReceipt:{phase:'REVOKED'}},{xml229StagedSourceStatus:'FAILED'}])
    assert.equal(hasXml229PreviewJsonSource(state),true);
});
test('selected JSON with missing or stale custody still refuses rendering',async()=>{
  for(const original of [null,{receipt:{phase:'INDEX_COMMITTED'},blob:new Blob(['{}']),isCurrent:()=>false}]){
    const host={dataset:{mcPreviewSourceId:'xml'},innerHTML:'',querySelector:()=>null};
    let rendered=false;
    await runPreviewButtonSession({host,rootEl:{querySelector:()=>host},
      xmlText:'<PipeStressExport/>',config:{},options:{
        resolveOriginalWorkerPreviewSource:async()=>original,
      },renderResult:()=>{rendered=true;}});
    assert.equal(rendered,false);
    assert.match(host.innerHTML,/XML229_PREVIEW_ORIGINAL_SOURCE_STALE/);
  }
});
test('current original JSON still enters the verified engineering session, without local fallback',async()=>{
  const host={dataset:{mcPreviewSourceId:'xml'},innerHTML:'',querySelector:()=>null};
  let opened=0,rendered=0;
  // Explicit test port stops at session opening; no synthetic approval is issued.
  const original={blob:new Blob(['{}']),isCurrent:()=>true,
    receipt:{phase:'INDEX_COMMITTED',rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false}};
  await runPreviewButtonSession({host,rootEl:{querySelector:()=>host},
    xmlText:'<PipeStressExport/>',config:{},options:{
      resolveOriginalWorkerPreviewSource:async()=>original,
      openVerifiedEngineeringSession:async()=>{opened++;throw Object.assign(
        new Error('Explicit session test stop'),{code:'TEST_VERIFIED_SESSION_REACHED'});},
    },renderResult:()=>{rendered++;}});
  assert.equal(opened,1);assert.equal(rendered,0);
  assert.match(host.innerHTML,/TEST_VERIFIED_SESSION_REACHED/);
});
test('optional-JSON production and served mirrors have identical bytes',async()=>{
  for(const name of ['xml229-preview-json-source.mjs','xml-cii-adapted-preview-diagnostics-audit-v7.js',
    'xml-cii-adapted-preview-facts-button-session.js','xml-cii-adapted-preview-renderer-v7.js']){
    const path='tabs/xml-cii-2019-standalone/ui-adapted/'+name;
    assert.deepEqual(await readFile(path),await readFile('docs/'+path));
  }
});
