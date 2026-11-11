/** W02 source-identity/commit negative test in REAL Chromium IndexedDB. */
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const out={schema:'LFJ226.O1.CommittedAuthorityNegatives.v1',checks:[]};
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/tests/browser/lfj-226-o1-intake.html',
   {waitUntil:'domcontentloaded'});
 const checks=await page.evaluate(async()=>{
  const {openIndexedPageRecordStore:open}=await import('/lfj/storage/browser/indexed-page-record-store.mjs');
  const uuid=crypto.randomUUID(),databaseName='lfj226-negative-'+uuid,namespace='owner-'+uuid;
  const basis={sourceRefId:'original-'+uuid,sourceSha256:'a'.repeat(64),sourceRevision:'rev-1'};
  const occurrenceId=JSON.stringify(['lfj-json-value/v1',basis.sourceRefId,basis.sourceRevision,'']);
  const openRow={schema:'LFJ.JSON.OccurrenceEvent.v1',...basis,kind:'OPEN',
    occurrenceId,ordinal:0,path:'',parentId:null,type:'object',startByte:0};
  const sealRow={schema:'LFJ.JSON.OccurrenceEvent.v1',...basis,kind:'SEAL',
    occurrenceId,ordinal:0,endByteExclusive:2};
  const manifest={schema:'LFJ.JSON.OccurrenceIndexSummary.v1',...basis,complete:true,
    byteLength:2,occurrenceCount:1,eventCount:2,rightsBasis:'SOURCE_FACTS_ONLY',
    engineeringReady:false};
  const checks=[];
  async function expectReject(name,fn,code){
    let failure=null;
    try{await fn();}catch(e){failure=e.code||e.message;}
    checks.push({name,pass:failure===code,expected:code,actual:failure});
  }
  const opts=(ns,gen,b=basis)=>({databaseName,namespace:ns,generation:gen,basis:b,kind:'source'});
  const store=await open(opts(namespace,'g1'));
  await expectReject('lookup-before-durable-head',
    ()=>store.lookupCommittedPair(occurrenceId),'PAGE_NOT_COMMITTED');
  await expectReject('reject-forged-page-sha',
    ()=>store.stagePage([{...openRow,sourceSha256:'b'.repeat(64)},sealRow]),'PAGE_STAGE_BASIS');
  await store.stagePage([openRow,sealRow]);
  await expectReject('reject-incomplete-commit',
    ()=>store.commit({...manifest,eventCount:3}),'PAGE_MANIFEST');
  await store.commit(manifest);
  const pair=await store.lookupCommittedPair(occurrenceId);
  checks.push({name:'exact-original-open-seal-pair',pass:pair.open.path===''&&
    pair.seal.endByteExclusive===2&&pair.open.occurrenceId===occurrenceId});
  const pages=[];
  for await(const page of store.readCommittedPages())pages.push(page);
  checks.push({name:'bounded-durable-page-read',pass:pages.length===1&&
    pages[0].rows.length===2&&pages[0].rows[0].kind==='OPEN'&&
    pages[0].rows[1].kind==='SEAL'});
  await expectReject('missing-selected-occurrence',
    ()=>store.lookupCommittedPair(occurrenceId+'other'),'PAGE_PAIR_MISSING');
  await store.abort();
  await expectReject('no-read-after-revocation',
    ()=>store.lookupCommittedPair(occurrenceId),'PAGE_STORE_CLOSED');
  store.close();
  const missing=await open(opts(namespace+'-pair','g1'));
  await missing.stagePage([openRow,{...sealRow,occurrenceId:occurrenceId+'wrong'}]);
  await missing.commit(manifest);
  await expectReject('reject-one-sided-committed-pair',
    ()=>missing.lookupCommittedPair(occurrenceId),'PAGE_PAIR_MISSING');
  missing.close();
  const a=await open(opts(namespace+'-cas','old'));
  const b=await open(opts(namespace+'-cas','new'));
  await a.stagePage([openRow,sealRow]);await b.stagePage([openRow,sealRow]);
  await a.commit(manifest);
  await expectReject('reject-superseded-head',
    ()=>b.commit(manifest),'PAGE_STORE_SUPERSEDED');
  const winner=await a.lookupCommittedPair(occurrenceId);
  checks.push({name:'head-winner-remains-readable',pass:winner.open.path===''});
  a.close();b.close();
  await new Promise(resolve=>{
    const request=indexedDB.deleteDatabase(databaseName);
    request.onsuccess=request.onerror=request.onblocked=()=>resolve();
  });
  return checks;
 });
 out.checks=checks;
 out.pass=checks.every(x=>x.pass);
 console.log('LFJ226_SOURCE_AUTHORITY_NEGATIVES '+JSON.stringify(out));
 assert.ok(out.pass,'real IDB source authority/cancel/selection negatives must pass');
}finally{
 await mkdir('ValidationRecords',{recursive:true});
 await writeFile('ValidationRecords/lfj-226-o1-authority-negatives.json',JSON.stringify(out,null,2)+'\n');
 await browser.close();
}
