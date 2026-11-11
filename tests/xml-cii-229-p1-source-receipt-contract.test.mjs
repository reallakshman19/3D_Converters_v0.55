import test from 'node:test';
import assert from 'node:assert/strict';
import {
  XML229_STAGED_SOURCE_SCHEMA,
  XML229_MAX_ORIGINAL_JSON_BYTES,
  XML229_MAX_ORIGINAL_OCCURRENCES,
  createXml229StagedSourceIntent,
  advanceXml229StagedSourceReceipt,
  isCurrentXml229StagedSourceReceipt,
} from '../tabs/xml-cii-2019-standalone/integration/xml229-staged-source-receipt.mjs';

const sha = '6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288';
const context = {
  generationId:'generation-firstpass-01',
  sourceRefId:'lfj226-firstpass-01',
  sourceRevision:'revision-firstpass-01',
  byteLength:733806,
};
const summary = {
  schema:'LFJ.JSON.OccurrenceIndexSummary.v1',
  complete:true,
  rightsBasis:'SOURCE_FACTS_ONLY',
  engineeringReady:false,
  sourceRefId:context.sourceRefId,
  sourceRevision:context.sourceRevision+':sha256:'+sha,
  sourceSha256:sha,
  byteLength:context.byteLength,
  occurrenceCount:23754,
  eventCount:47508,
};
const move=(receipt,kind,details={})=>
  advanceXml229StagedSourceReceipt(receipt,{kind,...details});
const pending=()=>move(move(createXml229StagedSourceIntent(context),'INDEX_START'),
  'COMMIT_PENDING');
const commit=(pendingSource,overrides={})=>move(pendingSource,'INDEX_COMMITTED',{
  durableCommitConfirmed:true,committedPageCount:47,summary:{...summary},...overrides
});
const expectRejected=(f,code)=>assert.throws(f,err=>err?.code===code);

test('P1 source intent is immutable, serializable and contains no Blob or approval',()=>{
  const source=createXml229StagedSourceIntent(context);
  assert.equal(source.schema,XML229_STAGED_SOURCE_SCHEMA);
  assert.equal(source.phase,'SELECTED');
  assert.equal(source.sha256,null);
  assert.equal(source.occurrenceCount,null);
  assert.equal(source.engineeringReady,false);
  assert.equal(source.rightsBasis,'SOURCE_FACTS_ONLY');
  assert.ok(Object.isFrozen(source));
  const serialized=JSON.stringify(source);
  assert.equal(serialized.includes('stagedJsonText'),false);
  assert.equal(serialized.includes('fileContents'),false);
  assert.equal(serialized.includes('blob'),false);
  assert.equal(isCurrentXml229StagedSourceReceipt(source,{...context,sha256:sha}),false);
});

test('P1 correct original source progresses only after durable verified commit',()=>{
  let source=createXml229StagedSourceIntent(context);
  source=move(source,'INDEX_START');
  assert.equal(source.phase,'INDEXING');
  source=move(source,'COMMIT_PENDING');
  assert.equal(source.phase,'COMMIT_PENDING');
  const verified=commit(source);
  assert.equal(verified.phase,'INDEX_COMMITTED');
  assert.equal(verified.sha256,sha);
  assert.equal(verified.sourceRevision,summary.sourceRevision);
  assert.equal(verified.occurrenceCount,23754);
  assert.equal(verified.pageCount,47);
  assert.equal(verified.engineeringReady,false);
  assert.ok(isCurrentXml229StagedSourceReceipt(verified,{...context,sourceRevision:summary.sourceRevision,sha256:sha}));
  assert.equal(isCurrentXml229StagedSourceReceipt(verified,{...context,sourceRevision:summary.sourceRevision,sha256:sha,
    generationId:'another-generation'}),false);
  assert.equal(isCurrentXml229StagedSourceReceipt(verified,{...context,sha256:sha,
    sourceRevision:'another-revision'}),false);
  assert.equal(isCurrentXml229StagedSourceReceipt(verified,{...context,sourceRevision:summary.sourceRevision,sha256:sha,
    byteLength:733807}),false);
});

test('P1 partial scan or caller claim without store.commit cannot promote receipt',()=>{
  const source=createXml229StagedSourceIntent(context);
  expectRejected(()=>move(source,'INDEX_COMMITTED',{
    durableCommitConfirmed:true,committedPageCount:47,summary}), 'XML229_SOURCE_TRANSITION_INVALID');
  expectRejected(()=>move(move(source,'INDEX_START'),'INDEX_COMMITTED',{
    durableCommitConfirmed:true,committedPageCount:47,summary}), 'XML229_SOURCE_TRANSITION_INVALID');
  expectRejected(()=>commit(pending(),{durableCommitConfirmed:false}),
    'XML229_SOURCE_DURABLE_COMMIT_REQUIRED');
  expectRejected(()=>commit(pending(),{committedPageCount:0}), 'XML229_SOURCE_COMMIT_INVALID');
});

test('P1 mixed/wrong original source summary fails closed for every authority field',()=>{
  const wrong=[
    {sourceRefId:'another-source'},
    {sourceRevision:'another-revision'},
    {sourceSha256:'A'.repeat(64)},
    {sourceSha256:'short'},
    {byteLength:733807},
    {rightsBasis:'ENGINEERING_READY'},
    {engineeringReady:true},
    {complete:false},
    {schema:'wrong'},
    {eventCount:47507},
    {occurrenceCount:-1},
    {occurrenceCount:XML229_MAX_ORIGINAL_OCCURRENCES+1},
  ];
  for (const override of wrong) {
    expectRejected(()=>commit(pending(),{summary:{...summary,...override}}),
      'XML229_SOURCE_COMMIT_INVALID');
  }
});

test('P1 revoked old generation can never revive with delayed Worker result',()=>{
  const selected=createXml229StagedSourceIntent(context);
  const current=move(move(selected,'INDEX_START'),'COMMIT_PENDING');
  const revoked=move(current,'REVOKE');
  assert.equal(revoked.phase,'REVOKED');
  assert.equal(isCurrentXml229StagedSourceReceipt(revoked,{...context,sourceRevision:summary.sourceRevision,sha256:sha}),false);
  expectRejected(()=>commit(revoked),'XML229_SOURCE_TRANSITION_INVALID');
  assert.equal(move(revoked,'REVOKE'),revoked);
  const newer=commit(pending());
  assert.equal(isCurrentXml229StagedSourceReceipt(newer,{...context,
    generationId:'not-current',sourceRevision:summary.sourceRevision,sha256:sha}),false);
});

test('P1 Owner 100MiB and 2M inclusive bounds enforced on source-only receipts',()=>{
  expectRejected(()=>createXml229StagedSourceIntent({...context,byteLength:0}),
    'XML229_SOURCE_MISSING');
  expectRejected(()=>createXml229StagedSourceIntent({...context,
    byteLength:XML229_MAX_ORIGINAL_JSON_BYTES+1}),'O1_SOURCE_BYTE_LIMIT');
  const atLimit=createXml229StagedSourceIntent({...context,
    byteLength:XML229_MAX_ORIGINAL_JSON_BYTES});
  assert.equal(atLimit.byteLength,104857600);
  const upper=commit(pending(),{summary:{
    ...summary,occurrenceCount:XML229_MAX_ORIGINAL_OCCURRENCES,
    eventCount:XML229_MAX_ORIGINAL_OCCURRENCES*2}});
  assert.equal(upper.occurrenceCount,2000000);
  expectRejected(()=>commit(pending(),{summary:{
    ...summary,occurrenceCount:2000001,eventCount:4000002}}),
  'XML229_SOURCE_COMMIT_INVALID');
});

test('P1 failed receipt removes SHA/commit rights and cannot be recommitted',()=>{
  const verified=commit(pending());
  const failed=move(verified,'FAIL',{reason:'SOURCE_PATH_MISSING'});
  assert.equal(failed.phase,'FAILED');
  assert.equal(failed.sha256,null);
  assert.equal(failed.pageCount,null);
  assert.equal(failed.occurrenceCount,null);
  assert.equal(isCurrentXml229StagedSourceReceipt(failed,{...context,sourceRevision:summary.sourceRevision,sha256:sha}),false);
  expectRejected(()=>commit(failed),'XML229_SOURCE_TRANSITION_INVALID');
});

test('P1 no arbitrary source event, missing source IDs or byte strings are accepted',()=>{
  for(const field of ['generationId','sourceRefId','sourceRevision']) {
    expectRejected(()=>createXml229StagedSourceIntent({...context,[field]:''}),
      'XML229_SOURCE_ID_INVALID');
  }
  expectRejected(()=>createXml229StagedSourceIntent({...context,byteLength:'733806'}),
    'XML229_SOURCE_MISSING');
  expectRejected(()=>move(pending(),'DOMAIN_READY'), 'XML229_SOURCE_EVENT_UNSUPPORTED');
});

test('P1 a different valid SHA cannot be mislabeled as this current original File',()=>{
  // A pure receipt sees a trusted Worker digest, not original JSON bytes.
  // A syntactically valid but different SHA is not intrinsically malformed;
  // source consumers MUST bind full SHA to the independently expected File.
  const anotherSha='a'.repeat(64);
  const different=commit(pending(),{summary:{...summary,sourceSha256:anotherSha,
    sourceRevision:context.sourceRevision+':sha256:'+anotherSha}});
  assert.equal(different.sha256,anotherSha);
  assert.equal(isCurrentXml229StagedSourceReceipt(different,{...context,sourceRevision:summary.sourceRevision,sha256:sha}),false);
  assert.equal(isCurrentXml229StagedSourceReceipt(different,{
    ...context,sourceRefId:'another-source',sourceRevision:different.sourceRevision,sha256:anotherSha}),false);
});
