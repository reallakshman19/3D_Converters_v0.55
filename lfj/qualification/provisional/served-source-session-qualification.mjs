// #1105/P01 U03: independent actual docs/ HTTP served public LFJ session contract.
// Test lives outside docs/ because DEPLOY #1097 exclusively owns docs/lfj/**.
// Source snippets are independently checked with Node crypto, not a copied
// deployment manifest or source-tree fallback.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const raw='[{"name":"é","children":[{"name":"X"}]},{"name":"é","children":[{"name":"Y"}]}]';
const expected=['','/0','/0/name','/0/children','/0/children/0',
  '/0/children/0/name','/1','/1/name','/1/children',
  '/1/children/0','/1/children/0/name'];
const sha=createHash('sha256').update(raw).digest('hex');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4184/lfj/served-durable-qualification.html',
    {waitUntil:'load'});
  const result=await page.evaluate(async({raw,sha})=>{
    // Require actual DEPLOY-GATE-staged public module URLs, not modules
    // loaded from the source-tree HTTP server or a data/javascript URL.
    const [{openSourceSession},
      {openIndexedOccurrencePairStore,createPairedIndexStore},
      {openIndexedRecordStore}]=await Promise.all([
        import('/lfj/runtime/source-session.mjs'),
        import('/lfj/runtime/indexed-occurrence-pairs.mjs'),
        import('/lfj/storage/browser/indexed-record-store.mjs')
      ]);
    const data=new TextEncoder().encode(raw);
    const independentBrowserSha=Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256',data)),
      b=>b.toString(16).padStart(2,'0')).join('');
    const revision='U03-DEPLOY-REV',sourceRefId='U03-ORIGINAL',
      sourceRevision=revision+':sha256:'+sha,jobId='U03-NATIVE',
      selectionDigest='U03-ALL';
    const basis={sourceRefId,sourceRevision,sourceSha256:sha};
    const databaseName='lfj-u03-'+crypto.randomUUID();
    const source=await openIndexedRecordStore({databaseName,
      namespace:'source',generation:jobId,basis,kind:'source'});
    const selected=await openIndexedRecordStore({databaseName,
      namespace:'selected',generation:jobId,basis,kind:'selection',
      selectionDigest,jobEpoch:jobId});
    const pairs=await openIndexedOccurrencePairStore({
      databaseName:databaseName+'-pairs',
      namespace:'source',generation:jobId,basis
    });
    const committed=createPairedIndexStore({indexStore:source,pairPort:pairs});
    const current={...basis,byteLength:data.byteLength,selectionDigest,jobId,
      dependencyRevision:'U03-DEPENDENCY'};
    const id=path=>JSON.stringify(['lfj-json-value/v1',
      sourceRefId,sourceRevision,path]);
    let session;
    try{
      session=await openSourceSession({blob:new Blob([data]),revision,
        expectedSha256:sha,sourceRefId,jobId,selectionDigest,
        selection:{mode:'ALL',includes:[],excludes:[]},
        trustedWorkerCtor:Worker,
        createWorker:()=>new Worker(new URL('/lfj/ports/source-browser-worker.mjs',
          location.origin),{type:'module'}),
        indexStore:committed,selectedStore:selected,
        getCurrentBasis:()=>({...current}),pageEvents:2
      });
      const value=await session.readOccurrence({
        occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision,
        maxBytes:2048
      });
      const other=await session.readOccurrence({
        occurrenceId:id('/1/name'),expectedSourceRevision:sourceRevision,
        maxBytes:2048
      });
      const root=await session.readOccurrence({
        occurrenceId:id(''),expectedSourceRevision:sourceRevision,maxBytes:2048
      });
      let cursor=null,rows=[];
      do{
        const page=await session.readPage({cursor,maxRows:3,maxBytes:65536});
        rows.push(...page.rows.map(x=>x.path));cursor=page.cursor;
      }while(cursor!==null);
      await session.close();
      let closedCode=null;
      try{await session.readOccurrence({
        occurrenceId:id('/0/name'),expectedSourceRevision:sourceRevision
      });}catch(e){closedCode=e?.code;}
      return {independentBrowserSha,workerConsumedBytes:session.receipt.workerConsumedBytes,
        root:new TextDecoder().decode(root.bytes),first:new TextDecoder().decode(value.bytes),
        second:new TextDecoder().decode(other.bytes),
        distinct:value.occurrenceId!==other.occurrenceId,
        count:session.summary.occurrenceCount,events:session.summary.eventCount,
        completion:session.completion.kind,rows,closedCode,
        rightsBasis:session.pageManifest.rightsBasis,
        engineeringReady:session.pageManifest.engineeringReady
      };
    }finally{
      try{await session?.close();}catch{}
      try{source.close();selected.close();pairs.close();}catch{}
      indexedDB.deleteDatabase(databaseName);
      indexedDB.deleteDatabase(databaseName+'-pairs');
    }
  },{raw,sha});
  assert.equal(result.independentBrowserSha,sha);
  assert.equal(result.workerConsumedBytes,Buffer.byteLength(raw));
  assert.equal(result.root,raw);
  assert.equal(result.first,'"é"');
  assert.equal(result.second,'"é"');
  assert.equal(result.distinct,true);
  assert.equal(result.count,expected.length);
  assert.equal(result.events,expected.length*2);
  assert.deepEqual(result.rows,expected);
  assert.equal(result.completion,'SOURCE_INDEX_COMPLETE');
  assert.equal(result.closedCode,'SESSION_CLOSED');
  assert.equal(result.rightsBasis,'SOURCE_FACTS_ONLY');
  assert.equal(result.engineeringReady,false);
  assert.deepEqual(errors,[]);
  console.log('LFJ #1108 U03 real docs-origin public SourceSession + native Worker + dual durable IndexedDB + source bytes PASS');
}finally{await browser.close();}
