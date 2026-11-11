/**
 * XML229 regression: genuine bundled 1595 Weight master → existing Preview/GC-PW, no manual Weight import.
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
  schema:'XML229.P263.BundledWeightExistingWorkflow.v1',
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
  // Four genuine application import controls, NOT synthetic P4 resolveInputs.
  const imports=[
    ['lineList','LineKey,Rating\n/ASIM-1836-8-P8810021-31441C4-PP,300\n'],
    ['pipingClass','PipingClass,Material\n31441C4,ASTM A106-B\n'],
    ['materialMap','Material,Code\nASTM A106-B,A106B\n'],
  ];
  for(const [kind,csv] of imports){
    await page.locator('[data-sub-tab="'+(kind==='lineList'?'linelist':kind)+'"]').click();
    await page.locator('input[data-master-file="'+kind+'"]').setInputFiles({
      name:'xml229-p263-'+kind+'.csv',mimeType:'text/csv',
      buffer:Buffer.from(csv),
    });
    await page.locator('[data-master-mapping-status="'+kind+'"]')
      .filter({hasText:'Mapping status: APPLIED'}).waitFor({timeout:45000});
  }
  await page.locator('[data-sub-tab="weight"]').click();
  const weightReadback=await page.evaluate(async()=>{
    const {createXmlCiiAdaptedWorkflowState}=await import(
      '/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js');
    const context=createXmlCiiAdaptedWorkflowState().masterContext;
    return {sourceType:context.sourceMetadata.weight.sourceType,
      source:context.sourceMetadata.weight.source,
      count:context.weightMasterRows.length};
  });
  record.stages.defaultWeight=weightReadback;
  assert.deepEqual(weightReadback,{
    sourceType:'default',source:'Embedded default',count:1595,
  },'test must use genuine bundled master, not a manually imported file');
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
  assert.equal(actual.proof,'P4_ENGINEERING_VERIFIED','actual Preview did not reach source-attested P4 engineering Worker');
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
  assert.equal(await page.locator('[data-p4-preview-build]').count(),0);
  assert.equal(await page.locator('[data-p4-weight-build]').count(),0);
  record.stages.workerScriptSeen=true;
  // Cross the ACTUAL Weight Match stage, not the isolated /test.html UI.
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('[data-p4-weight-root]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-p4-weight-build]').count(),0);
  await page.locator('tr[data-p4-row]').first().waitFor({timeout:120000});
  record.stages.weightRows=await page.locator('tr[data-p4-row]').count();
  assert.ok(record.stages.weightRows>0);
  record.stages.weightText=await page.locator('[data-p4-weight-status]').textContent();
  assert.match(record.stages.weightText,/Existing verified Preview facts/);
  // The simplified production UI deliberately does not expose engineering
  // acceptance controls. Applied Weight remains a testable session draft.
  assert.equal(await page.locator('[data-p4-accept-match1],[data-p4-accept-final],[data-p4-reason],[data-p4-candidate]').count(),0);
  const applied=page.locator('tr[data-p4-row] [data-p4-applied-weight]').first();
  await applied.fill('35');
  assert.equal(await applied.inputValue(),'35');
  const reviewedOccurrence=null; // No Match-1/Final approvals by UI navigation.
  record.stages.appliedWeightDraftOnly=true;
  // The existing Preview Build must reuse the same canonical GC-PW basis,
  // not silently open a different weight/final decision population.
  const firstBasis=actual.basisId;
  await page.locator('[data-phase="preview"]').click();
  await page.locator('#mc-preview-table-host [data-mc-preview-build]').first().click();
  await page.waitForFunction(()=>{
    const host=document.querySelector('#mc-preview-table-host');
    return host?.dataset.mcPreviewJsonSource==='P4_ENGINEERING_VERIFIED'||
      /Preview failed/.test(host?.textContent||'');
  },null,{timeout:240000});
  record.stages.repeatBasis=await page.locator('#mc-preview-table-host').evaluate(el=>el.dataset.mcPreviewBasisId);
  assert.equal(record.stages.repeatBasis,firstBasis,'same source/master Build replaced the reviewed InputBasis');
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('tr[data-p4-row]').first().waitFor({timeout:120000});
  if(reviewedOccurrence){
    const retained=await page.evaluate(occurrence=>{
      const row=[...document.querySelectorAll('tr[data-p4-row]')]
        .find(tr=>tr.dataset.p4Occurrence===occurrence);
      return row?{
        match1:row.querySelector('[data-p4-match1-mass]')?.textContent.trim(),
        final:row.querySelector('[data-p4-final-mass]')?.textContent.trim(),
      }:null;
    },reviewedOccurrence);
    record.stages.retainedDecisions=retained;
    assert.deepEqual(retained,{match1:'35 kg',final:'40 kg'},
      'Repeated existing Preview Build discarded accepted Match-1/Final decisions');
  }
  await page.locator('[data-phase="run"]').click();
  await page.waitForFunction(()=>{
    const section=document.querySelector('[data-active-phase="run"]');
    return [...(section?.querySelectorAll('tbody tr')||[])]
      .some(tr=>tr.children[0]?.textContent==='preview-audit'&&
        tr.children[1]?.textContent==='Original Preview engineering facts'&&
        tr.children[2]?.textContent==='ready');
  },null,{timeout:30000});
  record.stages.runText=await page.locator('[data-active-phase="run"]').textContent();
  assert.match(record.stages.runText,/HELD|blocking|Native CII|Run remains/i);
  assert.match(record.stages.runText,/Original Preview engineering facts/);
  assert.doesNotMatch(record.stages.runText,/Preview has not been built yet\./);
  assert.equal(await page.locator('[data-xml229-p4-run-advisory]').count(),0);
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
  await writeFile('ValidationRecords/xml229-bundled-weight-existing-workflow.json',JSON.stringify(record,null,2)+'\n');
  console.log('XML229_BUNDLED_WEIGHT_EXISTING_WORKFLOW '+JSON.stringify(record));
  await browser.close();
}
assert.ok(record.pass,record.failures.join('\n'));
