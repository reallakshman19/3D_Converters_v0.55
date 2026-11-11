/**
 * XML229/P3B.3 ORIGINAL authored application 4 Preview positive.
 * This is not Owner's private 622,915-occurrence case.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const xmlPath='Benchmarks/1885Sjson/FirstpassXML';
const jsonPath='Benchmarks/1885Sjson/Sjson.json';
const x=await readFile(xmlPath),j=await readFile(jsonPath);
const sha=b=>createHash('sha256').update(b).digest('hex');
const record={
  schema:'XML229.P3B3.OriginalAuthored4Preview.v1',
  head:process.env.EXACT_HEAD||null,
  jsonSha:sha(j),xmlSha:sha(x),
  originalJsonBytes:j.byteLength,notPrivateOwnerCase:true,
  stages:{},failures:[],errors:[],workerUrls:[],pass:false,
};
assert.equal(record.jsonSha,'6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({acceptDownloads:true});
  page.setDefaultTimeout(45000);
  page.on('pageerror',e=>record.errors.push(String(e)));
  page.on('worker',w=>record.workerUrls.push(w.url()));
  const response=await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.locator('[data-tab="xml-cii-2019-standalone"]').click();
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(xmlPath);
  // Verify the current four-master production custody, not just one
  // temporary Piping Class dataset from the prior Preview-only route.
  const inputs=[
    ['lineList','LineKey,Rating\n/ASIM-1836-8-P8810021-31441C4-PP,300\n'],
    ['pipingClass','PipingClass,Material\n31441C4,ASTM A106-B\n'],
    ['materialMap','Material,Code\nASTM A106-B,A106B\n'],
    ['weight','Rating,Bore,Length,RF/RTJ KG\n300,150,112,35\n'],
  ];
  for(const [kind,csv] of inputs){
    await page.locator('[data-sub-tab="'+(kind==='lineList'?'linelist':kind)+'"]').click();
    await page.locator('input[data-master-file="'+kind+'"]').setInputFiles({
      name:'xml229-p3b3-'+kind+'.csv',mimeType:'text/csv',
      buffer:Buffer.from(csv),
    });
    await page.locator('[data-master-mapping-status="'+kind+'"]')
      .filter({hasText:'Mapping status: APPLIED'}).waitFor({timeout:45000});
  }
  await page.locator('[data-phase="json-trace"]').click();
  await page.locator('[data-field="staged-json-file"]').setInputFiles(jsonPath);
  await page.waitForFunction(()=>{
    const s=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return s.startsWith('LFJ source index COMMITTED')||s.startsWith('LFJ Worker FAILED');
  },null,{timeout:240000});
  record.stages.indexStatus=await page.locator('[data-lfj-o1-status]').textContent();
  assert.match(record.stages.indexStatus,/LFJ source index COMMITTED/);
  assert.match(record.stages.indexStatus,/23,?754/);
  await page.locator('[data-phase="preview"]').click();
  const evidence=page.locator('[data-mc-preview-cache-evidence]');
  await evidence.waitFor({timeout:30000});
  record.stages.beforeStatus=await evidence.evaluate(el=>el.parentElement?.dataset.mcPreviewCacheStatus||'');
  record.stages.beforeText=await evidence.textContent();
  record.stages.beforeTables=await page.locator('#mc-preview-table-host table').count();
  assert.equal(record.stages.beforeStatus,'JSON_WORKER_READY');
  assert.equal(record.stages.beforeTables,0);
  assert.ok(record.stages.beforeText.includes(record.jsonSha));
  const button=page.locator('#mc-preview-table-host [data-mc-preview-build]').first();
  await button.waitFor({timeout:30000});
  await button.click();
  await page.waitForFunction(()=>{
    const host=document.querySelector('#mc-preview-table-host');
    return host?.dataset.mcPreviewJsonSource==='P4_ENGINEERING_VERIFIED'||
       /Preview failed/.test(host?.textContent||'');
  },null,{timeout:240000});
  const actual=await page.evaluate(()=>{
    const h=document.querySelector('#mc-preview-table-host'),r=h?.__xmlCiiPreviewResult;
    return {
      proof:h?.dataset.mcPreviewJsonSource,
      sourceSha:h?.dataset.mcPreviewOriginalJsonSha256,
      basisId:h?.dataset.mcPreviewBasisId,
      cacheStatus:h?.dataset.mcPreviewCacheStatus,
      tableCount:h?.querySelectorAll('table').length||0,
      branchCount:r?.branchRows?.length||0,
      nodeCount:r?.nodeRows?.length||0,
      branches:r?.branchRows?.map(v=>v.branchName)||[],
      firstBranchFields:r?.branchRows?.[0]
        ? Object.fromEntries(Object.entries(r.branchRows[0])
          .filter(([k,v])=>/dtxr|bore|wall|rating|material|source|branch|density/i.test(k)&&
            (typeof v==='string'||typeof v==='number'||typeof v==='boolean'))
          .slice(0,35)) : {},
      firstBranchKeys:Object.keys(r?.branchRows?.[0]||{}).slice(0,80),
      originalSourceBranches:h?.__xmlCiiPreviewOriginalOccurrences?.branches?.length||0,
      errorText:(h?.textContent||'').slice(0,1000),
    };
  });
  record.stages.after=actual;
  assert.equal(actual.proof,'P4_ENGINEERING_VERIFIED','actual Preview did not reach canonical verified engineering Worker');
  assert.equal(actual.sourceSha,record.jsonSha);
  assert.match(actual.basisId,/^[a-f0-9]{64}$/);
  assert.equal(actual.branchCount,5);
  assert.equal(actual.originalSourceBranches,5);
  assert.ok(actual.tableCount>0);
  // Independent fixed Firstpass engineering/source oracle: this original
  // 6-inch Schedule 80 flange is 150 mm nominal bore and 10.97 mm B36.10 wall.
  // An empty JSON or stale Preview could render 5 rows, but cannot satisfy
  // the source-ref, DTXR schedule, bore and wall evidence together.
  assert.equal(actual.firstBranchFields.dtxrWallComponentRefNo,'=1006649732/51234');
  assert.equal(actual.firstBranchFields.dtxrWallEvidenceSource,'staged-json');
  assert.equal(actual.firstBranchFields.dtxrWallSchedule,'80');
  assert.equal(actual.firstBranchFields.dtxrWallEvidenceBoreMm,150);
  assert.equal(Number(actual.firstBranchFields.dtxrWallThickness),10.97);
  assert.equal(Number(actual.firstBranchFields.wallThickness),10.97);
  assert.equal(actual.firstBranchFields.dtxrWallDtxr,'WELDING NECK FLANGE Sch 80 900#');
  assert.equal(actual.cacheStatus,'UNCACHED','do not publish unsafe JSON cache HIT');
  assert.ok(record.workerUrls.some(url=>url.includes('xml229-original-blob-gcpw-worker.mjs')));
  record.stages.workerScriptSeen=true;
  const transportNegatives=await page.evaluate(async({sourceBytes,sourceSha})=>{
    const {executeXml229OriginalPreview}=await import(
      '/tabs/xml-cii-2019-standalone/integration/xml229-preview-original-blob-execution.mjs');
    const bogus=new Blob([new Uint8Array(sourceBytes).fill(32)],{type:'application/json'});
    const sourceRevision='bad-gen:sha256:'+sourceSha;
    const receipt={
      schema:'XML229.OriginalStagedSourceReceipt.v1',
      sourceRefId:'p3b3-bogus',sourceRevision,generationId:'bad-gen',
      sha256:sourceSha,byteLength:sourceBytes,
      occurrenceCount:1,pageCount:1,phase:'INDEX_COMMITTED',
      rightsBasis:'SOURCE_FACTS_ONLY',engineeringReady:false,
    };
    const make=()=>executeXml229OriginalPreview({
      requestId:crypto.randomUUID(),basisId:'a'.repeat(64),
      xmlText:'<Root><Branch><Branchname>TEST</Branchname></Branch></Root>',
      config:{},scope:{mode:'A',sourceId:'test-xml',selection:null},
      originalSourceSession:{blob:bogus,receipt,isCurrent:()=>true},
    });
    let badSha='NO_REJECTION';
    try{await make().promise;}catch(e){badSha=String(e?.code||e?.message||e);}
    let cancelled='NO_REJECTION';
    const job=make();
    job.release();
    try{await job.promise;}catch(e){cancelled=String(e?.code||e?.message||e);}
    return {badSha,cancelled};
  },{sourceBytes:j.byteLength,sourceSha:record.jsonSha});
  record.stages.transportNegatives=transportNegatives;
  assert.equal(transportNegatives.badSha,'XML229_PREVIEW_SOURCE_SHA_MISMATCH',
    'forged original Blob must never reach engineering computation');
  assert.equal(transportNegatives.cancelled,'XML229_PREVIEW_WORKER_RELEASED',
    'released job must reject without publishing a late Preview result');

  // Real replacement must revoke old Worker File custody / CSV rights.
  await page.locator('[data-phase="json-trace"]').click();
  await page.locator('[data-field="staged-json-file"]').setInputFiles({
    name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('[{"broken":}')
  });
  await page.waitForFunction(()=>(
    document.querySelector('[data-lfj-o1-status]')?.textContent||''
  ).startsWith('LFJ Worker FAILED'),null,{timeout:60000});
  await page.locator('[data-phase="preview"]').click();
  await evidence.waitFor({timeout:30000});
  record.stages.invalidReplacement=await evidence.evaluate(el=>
    el.parentElement?.dataset.mcPreviewCacheStatus||'');
  record.stages.invalidTables=await page.locator('#mc-preview-table-host table').count();
  assert.equal(record.stages.invalidReplacement,'JSON_SOURCE_PENDING');
  assert.equal(record.stages.invalidTables,0);
  assert.equal(record.errors.length,0);
  record.pass=true;
}catch(e){record.failures.push(String(e?.stack||e).slice(0,2800));}
finally{
  await mkdir('ValidationRecords',{recursive:true});
  await writeFile('ValidationRecords/xml229-p3b3-authored-preview.json',JSON.stringify(record,null,2)+'\n');
  console.log('XML229_P3B3_AUTHORED_PREVIEW '+JSON.stringify(record));
  await browser.close();
}
assert.ok(record.pass,record.failures.join('\n'));
