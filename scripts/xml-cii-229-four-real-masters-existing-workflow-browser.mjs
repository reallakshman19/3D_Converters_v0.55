/**
 * XML229 production-route scale regression: actual repository XLSX Line List, 10699 Class JSON, material TXT and bundled Valve master → existing Preview/Weight.
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
  schema:'XML229.OriginalFourMasterRealAssetBrowser.v1',
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
    ['lineList','docs/Masters/ImportedRawLineListLL.xlsx'],
    ['pipingClass','docs/Masters/Piping_class_master.json'],
    ['materialMap','docs/Masters/PCF_MAT_MAP.TXT'],
  ];
  for(const [kind,filePath] of imports){
    await page.locator('[data-sub-tab="'+(kind==='lineList'?'linelist':kind)+'"]').click();
    await page.locator('input[data-master-file="'+kind+'"]').setInputFiles(filePath);
    await page.locator('[data-master-mapping-status="'+kind+'"]')
      .filter({hasText:'Mapping status: APPLIED'}).waitFor({timeout:45000});
  }
  record.stages.actualSourceImports=imports.map(([kind,filePath])=>({kind,filePath}));
  const masterBadges=await page.evaluate(()=>({
    text:document.body?.innerText?.slice(0,30000)||'',
  }));
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
  record.stages.masterImportSummary=masterBadges.text
    .split('\n').filter(x=>/Line List|Piping Class|Material Map|385|10699|383|1595|Master/.test(x)).slice(0,28);
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
  const inventory=await page.locator('#mc-preview-table-host').evaluate(
    el=>el.parentElement?.textContent||'');
  record.stages.previewInventoryText=inventory.slice(0,1200);
  record.stages.previewMasterInventory=Object.fromEntries([
    ['lineList',/Line List:\s*(\d+) row\(s\)/],
    ['pipingClass',/Piping Class:\s*(\d+) row\(s\)/],
    ['materialMap',/Material Map:\s*(\d+) row\(s\)/],
    ['weight',/Valve Weights:\s*(\d+) row\(s\)/],
  ].map(([key,re])=>[key,Number(inventory?.match(re)?.[1]??0)]));
  assert.deepEqual(record.stages.previewMasterInventory,{
    lineList:801,pipingClass:10699,materialMap:383,weight:1595,
  },'real loaded master counts do not match the repo test XLSX/JSON/TXT + bundled Weight assets');
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
  // Source-bound presentation now has exactly one Applied Weight mass column.
  // Explicit reviews still RPC to the protected GC-PW Worker.
  assert.equal(await page.locator('.mc-rigid-review-table-wrap').count(),1);
  assert.equal(await page.locator('tr[data-p4-row]').first().locator('td').count(),13);
  record.stages.historicalColumns=await page.locator('.mc-rigid-review-table th').allTextContents();
  assert.equal(record.stages.historicalColumns.some(x=>x.trim()==='Recorded Weight'),false);
  assert.deepEqual(record.stages.historicalColumns.map(x=>x.trim()),[
    'Status','Short name / Valve Hint','DTXR','Branch','Line Key','ComponentType','Bore','Rating','Node',
    'ComponentRefNo_Endpoint','Length','Nearest Suggestions','Applied Weight']);
  assert.equal(await page.locator('[data-p4-weight-build]').count(),0);


  // The Owner's exact false-stale trigger: merely OPENING the Regex stage
  // may auto-analyze masters and propose new extraction rules. Those
  // proposals must remain draft when a GC-PW InputBasis is already verified.
  await page.locator('[data-phase="regex"]').click();
  await page.waitForTimeout(1500);
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('tr[data-p4-row]').first().waitFor({timeout:30000});
  record.stages.afterRegexNavigation=
    await page.locator('[data-p4-weight-status]').textContent();
  assert.match(record.stages.afterRegexNavigation,/Existing verified Preview facts/);
  assert.doesNotMatch(record.stages.afterRegexNavigation,/stale/i);
  record.stages.afterRegexSameSession=true;
  // Navigate through an unrelated stage after the Worker has verified its
  // input. It must preserve the SAME review unless actual input bytes,
  // original JSON generation, scope or master authority changed.
  await page.locator('[data-phase="json-trace"]').click();
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('tr[data-p4-row]').first().waitFor({timeout:30000});
  const afterNavigation=await page.locator('[data-p4-weight-status]').textContent();
  record.stages.afterUnrelatedNavigation=afterNavigation;
  assert.match(afterNavigation,/Existing verified Preview facts/);
  assert.doesNotMatch(afterNavigation,/stale/i);

  // Current Weight review controls must be present, but an Applied Weight
  // change is still just a source-bound draft. Only a separately prepared
  // confirmation may authorize a Worker-held Match-1 or Final decision.
  assert.equal(await page.locator('[data-p4-accept-match1],[data-p4-accept-final],[data-p4-candidate]').count(),0);
  assert.equal(await page.locator('[data-p4-reason],[data-p4-review-match1],[data-p4-review-final],[data-p4-confirm-single]').count(),0);
  const editable=page.locator('tr[data-p4-row] [data-p4-applied-weight]').first();
  const draftOccurrence=await page.locator('tr[data-p4-row]').first().getAttribute('data-p4-occurrence');
  await editable.fill('35');
  assert.equal(await editable.inputValue(),'35');
  assert.equal(await page.locator('[data-p4-confirm-single]').count(),0,
    'entering a draft cannot prepare or accept a review');
  const reviewedOccurrence=null;
  record.stages.appliedWeightDraftOnly=true;
  // The existing Preview Build must reuse the same canonical GC-PW basis,
  // not silently open a different weight/final decision population.
  const firstBasis=actual.basisId;
  await page.locator('[data-phase="preview"]').click();
  // Exact Owner regression: navigating 4 Preview -> 6 Weight -> 4 Preview
  // must rehydrate the visible original engineering rows from the SAME live
  // Worker (never from an unauthenticated localStorage Preview cache).
  await page.locator('[data-mc-preview-verified-engineering]').waitFor({timeout:120000});
  const revisited=await page.locator('#mc-preview-table-host').evaluate(host=>({
    status:host.dataset.mcPreviewJsonSource,
    basisId:host.dataset.mcPreviewBasisId,
    cacheStatus:host.dataset.mcPreviewCacheStatus,
    tableCount:host.querySelectorAll('table').length,
    branchCount:host.__xmlCiiPreviewResult?.branchRows?.length||0,
    facts:host.__xmlCiiVerifiedEngineeringReceipt?.verifiedFactCount||0,
    note:host.querySelector('[data-mc-preview-verified-engineering]')?.textContent||'',
  }));
  record.stages.revisitedPreview=revisited;
  assert.equal(revisited.status,'P4_ENGINEERING_VERIFIED',
    'return to 4 Preview lost source-bound Worker engineering proof');
  assert.equal(revisited.basisId,firstBasis,
    'tab navigation replaced original Preview/GC-PW input basis');
  assert.equal(revisited.branchCount,actual.branchCount);
  assert.equal(revisited.facts,217);
  assert.ok(revisited.tableCount>0,'revisited Preview omitted its editable data table');
  assert.match(revisited.note,/Restored current source-bound engineering Preview/);
  assert.equal(revisited.cacheStatus,'UNCACHED',
    'revisited original Preview may never claim localStorage cache HIT');
  // Explicit rebuild on the unchanged basis must still retain Match-1/Final.
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
  assert.equal(await page.locator('tr[data-p4-row]').first().getAttribute('data-p4-occurrence'),draftOccurrence);
  assert.equal(await page.locator('tr[data-p4-row] [data-p4-applied-weight]').first().inputValue(),'35',
    'same source/master verified InputBasis must preserve unapproved draft weight');
  assert.equal(await page.locator('[data-p4-confirm-single]').count(),0);
  if(reviewedOccurrence){
    const retained=await page.evaluate(occurrence=>{
      const row=[...document.querySelectorAll('tr[data-p4-row]')]
        .find(tr=>tr.dataset.p4Occurrence===occurrence);
      return row?{
        match1:row.querySelector('[data-p4-applied-weight]')?.value,
        final:'40 kg (retained in Worker)',
      }:null;
    },reviewedOccurrence);
    record.stages.retainedDecisions=retained;
    assert.deepEqual(retained,{match1:'40',final:'40 kg (retained in Worker)'},
      'Repeated existing Preview Build discarded accepted Match-1/Final decisions');
  }
  // Exact original Match-1 bulk planner: proposal is not acceptance. If the
  // public fixture has qualified blanks, require an explicit second confirm.
  await page.locator('[data-p4-bulk-plan]').click();
  // The prior loaded-status also contains the word "qualified" in its
  // help text. Wait for the *new* plan result, not a stale pre-click label.
  await page.waitForFunction(()=>/Apply all suggestions ≥\d+%: complete\./.test(
    document.querySelector('[data-p4-weight-status]')?.textContent||''),null,{timeout:120000});
  record.stages.bulkPlanMessage=await page.locator('[data-p4-weight-status]').textContent();
  assert.match(record.stages.bulkPlanMessage,/Apply all suggestions ≥\d+%: complete\./);
  assert.equal(await page.locator('[data-p4-bulk-confirm]').count(),0);
  // Apply all now commits selected positive kg as protected Worker Final.
  record.stages.bulkAccepted='Worker Final';
  // Source-basis-pinned GC-PW provenance audit is inspectable even with
  // native Run HELD. The Firstpass public fixture has original source masses.
  const auditButton=page.locator('[data-p4-audit-decisions]');
  await auditButton.waitFor();
  const [auditDownload]=await Promise.all([
    page.waitForEvent('download'),auditButton.click(),
  ]);
  assert.equal(auditDownload.suggestedFilename(),'xml229-weight-decision-provenance.json');
  const audited=JSON.parse(await readFile(await auditDownload.path(),'utf8'));
  assert.equal(audited.schema,'XML229.WeightDecisionProvenanceAudit.v1');
  assert.equal(audited.basisId,firstBasis);
  assert.equal(audited.population.physicalCount,31);
  assert.equal(audited.population.factCount,217);
  assert.equal(audited.population.counts.source,30);
  assert.equal(audited.population.counts.match1,0);
  assert.equal(audited.population.counts.final,1,
    'Owner-selected positive Applied Weight writes one Worker Final directly');
  assert.equal(Object.values(audited.population.counts).reduce((a,b)=>a+b,0),31);
  assert.equal(audited.summary.nativeCiiReleaseAuthorized,false);
  assert.equal(audited.summary.provenanceComplete,true);
  assert.equal(audited.summary.auditedAcceptedDecisions,1);
  record.stages.weightProvenanceAudit={
    basisId:audited.basisId,summary:audited.summary,
    physicalCount:audited.population.physicalCount,
  };
  await page.locator('[data-phase="run"]').click();
  await page.waitForFunction(()=>{
    const section=document.querySelector('[data-active-phase="run"]');
    return [...(section?.querySelectorAll('tbody tr')||[])]
      .some(tr=>tr.children[0]?.textContent==='preview-audit'&&
        tr.children[1]?.textContent==='Original Preview engineering facts'&&
        tr.children[2]?.textContent==='ready');
  },null,{timeout:30000});
  assert.equal(await page.locator('.xml229-run-checklist-scroll').count(),1,
    'Output checklist must be readable with horizontal scroll');
  const minWidth=await page.locator('.xml229-run-checklist-scroll table')
    .evaluate(el=>el.style.minWidth);
  assert.equal(minWidth,'1200px');
  record.stages.runText=await page.locator('[data-active-phase="run"]').textContent();
  assert.match(record.stages.runText,/HELD|blocking|Native CII|Run remains/i);
  assert.match(record.stages.runText,/Original Preview engineering facts/);
  assert.doesNotMatch(record.stages.runText,/Preview has not been built yet\./);
  // The independent workflows genuinely have no result, but "missing" must
  // not falsely imply damaged masters or unverified GC-PW source provenance.
  record.stages.runIndependentStages=await page.locator('[data-active-phase="run"]').evaluate(root=>
    [...root.querySelectorAll('tbody tr')].filter(tr=>
      ['support-mapper','resolver-json','manual-restraints'].includes(tr.children[0]?.textContent))
      .map(tr=>({id:tr.children[0].textContent,status:tr.children[2].textContent,
        blocking:tr.children[4].textContent})));
  for(const item of record.stages.runIndependentStages){
    assert.notEqual(item.status,'missing','Original GC-PW UI should describe unbuilt independent stage as not-run');
    assert.equal(item.blocking,'false');
  }

  // #274: download the same canonical report that produced the visible
  // checklist, log and Run controls. This must work even with native Run HELD.
  const capture=page.locator('[data-action="export-output-readiness"]');
  await capture.waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),capture.click()]);
  assert.equal(download.suggestedFilename(),'xml-cii-output-run-readiness.json');
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  record.stages.runReadinessEvidence={
    schema:exported.schema,summary:exported.summary,raw:exported.raw,
    preview:exported.checklistRows.find(x=>x.id==='preview-audit'),
    weight:exported.checklistRows.find(x=>x.id==='weight-match'),
    release:exported.checklistRows.find(x=>x.id==='xml229-original-json-engineering-authority'),
  };
  assert.equal(exported.schema,'XML229.OutputRunReadinessEvidence.v1');
  assert.equal(exported.raw.xml229VerifiedEngineering,true);
  assert.equal(record.stages.runReadinessEvidence.preview?.status,'ready');
  assert.equal(record.stages.runReadinessEvidence.release?.status,'held');
  assert.equal(record.stages.runReadinessEvidence.release?.blocking,true);
  assert.equal(exported.summary.blockingCount,
    exported.checklistRows.filter(x=>x.blocking).length);
  assert.equal(exported.summary.warningCount,
    exported.checklistRows.filter(x=>!x.blocking&&x.status!=='ready').length);
  // Header badges must come from the SAME canonical report exported above,
  // even though the shell rendered its header before asynchronous GC-PW proof.
  const badges=await page.locator('.xml-cii-header-status-row').evaluate(bar=>
    [...bar.querySelectorAll('.xml-cii-standalone-badge')].map(x=>x.textContent.trim()));
  const headerErrors=exported.diagnostics.filter(x=>x.level==='error').length;
  const headerWarnings=exported.diagnostics.filter(x=>x.level==='warning').length;
  assert(badges.includes(headerErrors+' Errors'),
    'header error badge drifted from verified Output/Run report: '+badges);
  assert(badges.includes(headerWarnings+' Warnings'),
    'header warning badge drifted from verified Output/Run report: '+badges);
  record.stages.runHeaderBadges={badges,headerErrors,headerWarnings};
  // Fully accepted Worker Source/Final masses now permit an attempt to
  // generate and independently reconcile native CII. They do not pre-claim
  // an output artifact before the actual converter runs.
  const nativeBtn=page.locator('[data-action="xml229-native-run"]');
  const nativeRunEnabled=await nativeBtn.isEnabled();
  const nativeLabel=(await nativeBtn.textContent()).trim();
  assert(nativeRunEnabled||nativeLabel==='Running...',
    'Complete Final census must either enable native Run or have already auto-started it');
  record.stages.nativeRunAutoStarted=!nativeRunEnabled&&nativeLabel==='Running...';
  for(const item of record.stages.runIndependentStages){
    assert.equal(exported.checklistRows.find(x=>x.id===item.id)?.status,item.status,
      'rendered independent stage must equal exported canonical status');
  }
  assert.equal(await page.locator('[data-xml229-p4-run-advisory]').count(),0);
  // SAVE → full browser reload → same original input and masters rebuilt
  // → RESTORE. The real portable GC-PW service must preserve decisions, NOT
  // borrow any legacy localStorage or silently accept a stale snapshot.
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('tr[data-p4-row]').first().waitFor({timeout:30000});
  const sourceRow=page.locator('tr[data-p4-row]').first();
  const saveOccurrence=await sourceRow.getAttribute('data-p4-occurrence');
  await sourceRow.locator('[data-p4-applied-weight]').fill('35');
  // No separate review button is needed; backup captures the Owner-selected Final ledger.
  const [backupFile]=await Promise.all([
    page.waitForEvent('download'),page.locator('[data-p4-save-review]').click(),
  ]);
  assert.equal(backupFile.suggestedFilename(),'xml229-source-bound-gcpw-review.json');
  const backupPath=await backupFile.path();
  const backup=JSON.parse(await readFile(backupPath,'utf8'));
  assert.equal(backup.schema,'XML229.SourceBoundGC-PWReviewBackup.v1');
  assert.equal(backup.basisId,firstBasis);
  assert.equal(backup.counts.match1,0);
  assert.equal(backup.counts.final,1,'Owner-selected Applied Weight must persist as Final in portable backup');
  assert.equal(backup.counts.source,31-backup.counts.match1-backup.counts.final);
  assert.equal(backup.nativeCiiReleaseAuthorized,false);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="xml-cii-2019-standalone"]').click();
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(xmlPath);
  // Fresh upload of identical master bytes creates NEW dataset IDs and
  // applied revisions. That is a different GC-PW InputBasis, correctly
  // rejected by review restore. Rehydrate the ORIGINAL IndexedDB custody.
  await page.waitForFunction(()=>{
    const bar=document.querySelector('.xml-cii-header-status-row');
    return /Masters:\s*4\/4 loaded/.test(bar?.textContent||'');
  },null,{timeout:120000});
  record.stages.coldMasterStatus=await page.locator('.xml-cii-header-status-row').textContent();
  await page.locator('[data-phase="json-trace"]').click();
  await page.locator('[data-field="staged-json-file"]').setInputFiles(jsonPath);
  await page.waitForFunction(()=>(
    document.querySelector('[data-lfj-o1-status]')?.textContent||''
  ).startsWith('LFJ source index COMMITTED'),null,{timeout:240000});
  await page.locator('[data-phase="preview"]').click();
  await page.locator('#mc-preview-table-host [data-mc-preview-build]').first()
    .click();
  await page.waitForFunction(()=>(
    document.querySelector('#mc-preview-table-host')?.dataset
      .mcPreviewJsonSource==='P4_ENGINEERING_VERIFIED'),null,{timeout:240000});
  const restoredBasis=await page.locator('#mc-preview-table-host').evaluate(
    h=>h.dataset.mcPreviewBasisId);
  record.stages.restoreDigestAudit={old:backup.inputBasisDigests||null,
    newBasisId:restoredBasis};
  if(restoredBasis!==firstBasis){
    await page.locator('[data-phase="weight-match"]').click();
    await page.locator('tr[data-p4-row]').first().waitFor({timeout:30000});
    const [digestFile]=await Promise.all([
      page.waitForEvent('download'),page.locator('[data-p4-save-review]').click(),
    ]);
    const second=JSON.parse(await readFile(await digestFile.path(),'utf8'));
    const firstFields=backup.inputBasisDigests||{},newFields=second.inputBasisDigests||{};
    record.stages.restoreDigestAudit.new=newFields;
    record.stages.restoreDigestAudit.changed=Object.keys(firstFields).filter(
      k=>JSON.stringify(firstFields[k])!==JSON.stringify(newFields[k]));
  }
  assert.equal(restoredBasis,firstBasis,
    'same file/master rebuilt with DIFFERENT InputBasis fields: '+
      JSON.stringify(record.stages.restoreDigestAudit.changed||[]) +
      '; refusing review import');
  await page.locator('[data-phase="weight-match"]').click();
  // No silent two-minute timeout: surface an exact failure code if a storage
  // or generation rebind blocks the current verified Weight panel.
  await page.waitForFunction(()=>{
    const status=document.querySelector('[data-p4-weight-status]')?.textContent||'';
    return document.querySelector('tr[data-p4-row]')||
      /verification unavailable|source review verification unavailable|draft.*failed/i.test(status);
  },null,{timeout:120000});
  const reverifiedWeightStatus=await page.locator('[data-p4-weight-status]').textContent();
  record.stages.reverifiedWeightStatus=reverifiedWeightStatus;
  assert.ok(await page.locator('tr[data-p4-row]').count()>0,
    'reverified same-basis Weight table failed: '+reverifiedWeightStatus);
  // It must not auto-hydrate reviews merely because a private backup file
  // exists. Select an explicit file, after a new verified Worker has opened.
  const [fresh]=await Promise.all([
    page.waitForEvent('download'),page.locator('[data-p4-save-review]').click(),
  ]);
  const untouched=JSON.parse(await readFile(await fresh.path(),'utf8'));
  assert.equal(untouched.counts.match1,0,'browser reload silently accepted old review');
  record.stages.backupRestoreGuardInputs={
    saved:{basisId:backup.basisId,sourceId:backup.sourceId,
      sourceSha:backup.originalJsonSha256,physicalCount:backup.physicalCount,
      factCount:backup.factCount,counts:backup.counts,
      captureGenerationType:typeof backup.captureSourceGenerationId,
      captureGenerationPresent:Boolean(backup.captureSourceGenerationId),
      nativeRelease:backup.nativeCiiReleaseAuthorized,
      ledgerBasis:backup.reviewState?.basisId,
      ledgerSha:backup.reviewState?.contentSha256},
    rebuilt:{basisId:untouched.basisId,sourceId:untouched.sourceId,
      sourceSha:untouched.originalJsonSha256,physicalCount:untouched.physicalCount,
      factCount:untouched.factCount,counts:untouched.counts,
      captureGenerationType:typeof untouched.captureSourceGenerationId,
      captureGenerationPresent:Boolean(untouched.captureSourceGenerationId)},
  };

  const wrong=structuredClone(backup);
  wrong.originalJsonSha256='f'.repeat(64);
  await page.locator('input[data-p4-import-review]').setInputFiles({
    name:'wrong-review.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(wrong)),
  });
  await page.waitForFunction(()=>/Review restore HELD \[STALE_REVIEW_BACKUP\]/.test(
    document.querySelector('[data-p4-weight-status]')?.textContent||''
  ),null,{timeout:30000});
  await page.locator('input[data-p4-import-review]').setInputFiles(backupPath);
  await page.waitForFunction(()=>/Restored same-InputBasis GC-PW review|Review restore HELD/.test(
    document.querySelector('[data-p4-weight-status]')?.textContent||''
  ),null,{timeout:60000});
  const restoredStatus=await page.locator('[data-p4-weight-status]').textContent();
  record.stages.reviewImportStatus=restoredStatus;
  assert.match(restoredStatus,/Restored same-InputBasis GC-PW review/,
    'restored same-basis GC-PW review was refused: '+restoredStatus);
  assert.equal(await page.locator('[data-p4-accept-match1],[data-p4-accept-final]').count(),0);
  const [restoredExport]=await Promise.all([
    page.waitForEvent('download'),page.locator('[data-p4-save-review]').click(),
  ]);
  const afterRestore=JSON.parse(await readFile(await restoredExport.path(),'utf8'));
  assert.equal(afterRestore.counts.match1,0);
  assert.equal(afterRestore.counts.source,31-afterRestore.counts.match1-afterRestore.counts.final);
  assert.equal(afterRestore.counts.final,1,'restored Owner-selected Final value must survive Worker rebuild');
  assert.deepEqual(afterRestore.reviewState,backup.reviewState,
    'restored portable command ledger differs from original saved review');
  record.stages.explicitReviewReloadRestore={
    originalBasis:firstBasis,restoredBasis,
    before:backup.counts,after:afterRestore.counts,
    sameLedger:true,untrustedImportRejected:true,
  };
  await page.locator('[data-phase="run"]').click();
  await page.waitForFunction(()=>[
    ...document.querySelectorAll('[data-active-phase="run"] tbody tr'),
  ].some(tr=>tr.children[0]?.textContent==='weight-match'&&
    /0 Match-1 only/.test(tr.textContent)),null,{timeout:30000});
  const restoredNativeBtn=page.locator('[data-action="xml229-native-run"]');
  const restoredNativeEnabled=await restoredNativeBtn.isEnabled();
  const restoredNativeLabel=(await restoredNativeBtn.textContent()).trim();
  assert(restoredNativeEnabled||restoredNativeLabel==='Running...',
    'restored accepted Source/Final masses must enable or automatically start native reconciliation');
  record.stages.restoredNativeAutoStarted=!restoredNativeEnabled&&restoredNativeLabel==='Running...';
  // XML229: explicitly allow ordinary XML native preflight while excluding
  // optional JSON; reselect governed and prove its native O1 HOLD persists.
  const participation=page.locator('[data-action="xml229-output-participation"]');
  assert.equal(await participation.inputValue(),'governed',
    'loading original JSON must not silently opt into XML-only conversion');
  // The automatic governed candidate must settle before changing conversion
  // routes; a stale, in-flight Run must not leak into an XML-only test.
  await page.waitForFunction(()=>document.querySelector(
    '[data-action="xml229-output-participation"]')?.disabled===false,
    null,{timeout:120000});
  await participation.selectOption('xml-only');
  await page.waitForFunction(()=>(
    ![...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
      .some(tr=>tr.children[0]?.textContent==='xml229-original-json-engineering-authority') &&
    document.querySelector('[data-action="run"]')?.disabled===false
  ),null,{timeout:30000});
  const [xmlOnlyEvidence]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="export-output-readiness"]').click(),
  ]);
  const xmlOnlyReport=JSON.parse(await readFile(await xmlOnlyEvidence.path(),'utf8'));
  assert.equal(xmlOnlyReport.raw.xml229XmlOnlyOutput,true);
  assert.equal(xmlOnlyReport.manifest.nativeOutputParticipation,'explicit-xml-only');
  assert.equal(xmlOnlyReport.checklistRows.some(r=>
    r.id==='xml229-original-json-engineering-authority'&&r.blocking),false);
  // This public fixture uses legacy single-format configuration, for which
  // the configured-format checklist row is intentionally absent. When an
  // explicit multi-format authority is supplied it must remain READY.
  assert.equal(xmlOnlyReport.summary.sourceMode,'xml');
  const formatGate=xmlOnlyReport.checklistRows.find(r=>r.id==='branch-format-authority');
  if(formatGate)assert.equal(formatGate.status,'ready');
  assert(xmlOnlyReport.checklistRows.some(r=>r.id==='regex'));
  // No native conversion has occurred yet: geometry/Preview do not forge a .cii.
  assert.equal(xmlOnlyReport.raw.resultOk,false);
  record.stages.xmlOnlyExplicitOptIn={
    existingXmlFormatPolicyPreserved:true,jsonExcludedFromAuthority:true,
    nativePreflightButtonEnabled:true,
    ciiReleaseNotClaimed:true,
  };
  // Full native output execution, not just a mock or readiness/button check.
  await page.locator('[data-action="run"]').click();
  // Bound this witness: a visible enabled button does not by itself prove the
  // native job was invoked, and a readCompletion observer may repaint it.
  await page.waitForTimeout(10000);
  const runSnapshot=()=>page.evaluate(()=>{
    const body=document.querySelector('[data-active-phase="run"]');
    const rows=[...body?.querySelectorAll('tbody tr')||[]]
      .filter(tr=>['run-result','xml229-original-json-engineering-authority',
        'xml229-xml-only-output-participation'].includes(tr.children[0]?.textContent||''))
      .map(tr=>[...tr.children].map(td=>td.textContent?.trim().slice(0,220)));
    const runBtn=body?.querySelector('[data-action="run"]');
    return {runText:runBtn?.textContent,runDisabled:runBtn?.disabled,
      route:body?.querySelector('[data-action="xml229-output-participation"]')?.value,
      reviewOverlay:!!document.querySelector('[data-rigid-review-skip]'),
      ciiAvailable:body?.querySelector('.xml-cii-adapted-cii-download')?.disabled===false,
      rows,bodyTail:(body?.textContent||'').slice(-1700)};
  });
  record.stages.nativeClickTenSeconds=await runSnapshot();
  // The native runner has a separate rigid-weight popup. In this disposable
  // test, skip unreviewed suggestions; never invent an accepted Weight/Final.
  try{
    await page.waitForFunction(()=>{
      const popup=document.querySelector('[data-rigid-review-skip]');
      const download=document.querySelector('.xml-cii-adapted-cii-download');
      const row=[...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
        .find(x=>x.children[0]?.textContent==='run-result');
      return !!popup||download?.disabled===false||row?.children[2]?.textContent?.trim()==='ready';
    },null,{timeout:180000});
  }catch(err){
    record.stages.nativeClickTimeout=await runSnapshot();
    throw err;
  }
  const skip=page.locator('[data-rigid-review-skip]');
  if(await skip.count())await skip.click();
  await page.waitForFunction(()=>{
    const download=document.querySelector('.xml-cii-adapted-cii-download');
    const row=[...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
      .find(x=>x.children[0]?.textContent==='run-result');
    return download?.disabled===false||row?.children[2]?.textContent?.trim()==='ready';
  },null,{timeout:180000});
  const nativeEnabled=await page.locator('.xml-cii-adapted-cii-download').isEnabled();
  const actualRunText=await page.locator('[data-active-phase="run"]').innerText();
  record.stages.xmlOnlyNativeRun={
    downloadEnabled:nativeEnabled,
    resultText:actualRunText.slice(-4000),
  };
  if(nativeEnabled){
    const [ciiDownload]=await Promise.all([
      page.waitForEvent('download'),
      page.locator('.xml-cii-adapted-cii-download').click(),
    ]);
    const ciiBytes=await readFile(await ciiDownload.path());
    record.stages.xmlOnlyNativeRun.ciiFile=ciiDownload.suggestedFilename();
    record.stages.xmlOnlyNativeRun.bytes=ciiBytes.length;
    record.stages.xmlOnlyNativeRun.sha256=sha(ciiBytes);
    assert.match(ciiDownload.suggestedFilename(),/\\.cii$/i);
    assert(ciiBytes.length>0,'Native engine returned an empty CII artifact');
    record.stages.xmlOnlyExplicitOptIn.ciiReleaseNotClaimed=false;
  }else{
    // FirstpassXML deliberately includes a weighted component without a
    // matching native CII owner. Native output MUST be withheld instead of
    // turning an enabled XML-only route into an unowned weight artifact.
    assert.match(actualRunText,/CII_WEIGHT_OWNER_UNRESOLVED/,
      'Native converter neither generated CII nor identified the missing weight owner');
    assert.match(actualRunText,/CII withheld; enriched XML retained/);
    assert.equal(await page.locator('.xml-cii-adapted-cii-download').isDisabled(),true);
    record.stages.xmlOnlyNativeRun.ownerGuard='CII_WEIGHT_OWNER_UNRESOLVED';
    record.stages.xmlOnlyNativeRun.outputWithheld=true;
  }
  await page.locator('[data-action="xml229-output-participation"]').selectOption('governed');
  await page.waitForFunction(()=>(
    document.querySelector('[data-action="xml229-native-run"]')||
    document.querySelector('[data-action="run"]'))&&
    [...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
      .some(tr=>tr.children[0]?.textContent==='xml229-original-json-engineering-authority'),
    null,{timeout:30000});
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
  await writeFile('ValidationRecords/xml229-four-original-masters-existing-workflow.json',JSON.stringify(record,null,2)+'\n');
  console.log('XML229_FOUR_ORIGINAL_MASTERS_EXISTING_WORKFLOW '+JSON.stringify(record));
  await browser.close();
}
assert.ok(record.pass,record.failures.join('\n'));
