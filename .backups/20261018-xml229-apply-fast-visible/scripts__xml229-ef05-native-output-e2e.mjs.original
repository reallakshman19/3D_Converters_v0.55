/**
 * Real repo public 41-branch EF-05 + zipped ASIM original JSON end-to-end.
 * Uses actual published masters, including auto-loaded 1595 Valve Weights.
 * No private Owner attachments, historical fixed digest, or manual Weight accept.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const xmlPath='Benchmarks/EF-05-PRO.TEST.xml';
const zipPath='Benchmarks/ASIM-1836_managed_stage-2.zip';
const lineListVariant=process.env.XML229_E2E_LINELIST_VARIANT||'legacy';
assert(['legacy','bc4-json'].includes(lineListVariant),
  'Only exact legacy/BC4 public fixture E2E variants are allowed');
const lineListPath=lineListVariant==='bc4-json'
  ?'tests/fixtures/xml229/BC4.LineList.json'
  :'docs/Masters/ImportedRawLineListLL.xlsx';
const artifactSuffix=lineListVariant==='bc4-json'?'-bc4':'';
const LOCAL_E2E_URL='http://127.0.0.1:4173/index.html';
const DEPLOYED_E2E_URL='https://reallakshman19.github.io/3D_Converters/index.html';
const siteUrl=process.env.XML229_E2E_BASE_URL||LOCAL_E2E_URL;
assert([LOCAL_E2E_URL,DEPLOYED_E2E_URL].includes(siteUrl),
  'E2E must target only the local isolated server or official published GitHub Pages');

const tmp=await mkdtemp(join(tmpdir(),'xml229-ef05-'));
const record={schema:'XML229.EF05.NativeOutputE2E.v1',
 siteOrigin:siteUrl===DEPLOYED_E2E_URL?'PUBLISHED_GITHUB_PAGES':'ISOLATED_LOCAL_SERVER',
 lineListVariant,
 head:process.env.EXACT_HEAD||null,source:'EF-05 public benchmark',
 passes:[],stages:{},failures:[],pageErrors:[],ok:false};
execFileSync('python3',['-m','zipfile','-e',zipPath,tmp]);
const jsonPath=join(tmp,'ASIM-1836_managed_stage-2.json');
const x=await readFile(xmlPath),j=await readFile(jsonPath);
record.source={xmlSha256:sha(x),jsonSha256:sha(j),
 xmlBytes:x.length,jsonBytes:j.length,
 branches:(x.toString('utf8').match(/<Branch>/g)||[]).length,
 xmlNodes:(x.toString('utf8').match(/<Node>/g)||[]).length};
assert.equal(record.source.branches,41);
assert.equal(record.source.xmlNodes,1654);
if(lineListVariant==='bc4-json'){
  const bc4Bytes=await readFile(lineListPath);
  assert.equal(sha(bc4Bytes),
    '53b322405795dc7a74c1154043c31bf9c8b2a1763f207cabf0c7f1888fd9c1bb');
  const bc4=JSON.parse(bc4Bytes.toString('utf8'));
  assert.equal(bc4.schema,'XML229.BC4.LineListRawJsonFixture.v1');
  assert.equal(bc4.sourceWorkbookSha256,
    '3e3b8494f9e70bffd92f5c13492c8c0421739c29a086d41f41306f0d386f240a');
  assert.equal(bc4.worksheet,'LineList');
  assert.equal(bc4.rowCount,385);
  assert.equal(bc4.rows.length,385);
  assert.equal(bc4.engineeringApproval,false);
  assert.equal(bc4.nativeCiiReleaseAuthorized,false);
  record.stages.lineListFixture={file:'BC4.LineList.json',rows:385,
    sha256:sha(bc4Bytes),historicalConfigProven:false,originalXlsxPreservedInRepository:false};
}
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({acceptDownloads:true});
  page.setDefaultTimeout(60000);
  page.on('pageerror',e=>record.pageErrors.push(String(e)));
  // The live GitHub Pages CDN can occasionally load the app shell before its
  // lazy workspace code. Retry only the blank startup, before any XML/JSON,
  // masters, Worker session or review decisions are created.
  const maxBootstrapAttempts=siteUrl===DEPLOYED_E2E_URL?3:1;
  record.stages.bootstrapAttempts=[];
  for(let attempt=1;attempt<=maxBootstrapAttempts;attempt++){
    try{
      const resp=await page.goto(siteUrl,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(resp.status(),200);
      await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:35000});
      await page.locator('[data-phase="source"]').waitFor({state:'visible',timeout:35000});
      record.stages.bootstrap={attempts:attempt,sourcePhasePresent:true,
        liveHosted:siteUrl===DEPLOYED_E2E_URL};
      break;
    }catch(error){
      const diagnostic=await page.evaluate(()=>({
        xmlTabCount:document.querySelectorAll('[data-tab="xml-cii-2019-standalone"]').length,
        sourcePhaseCount:document.querySelectorAll('[data-phase="source"]').length,
        workspaceSections:document.querySelectorAll('[data-phase]').length,
        appOverlayActive:document.querySelector('#app-loading-overlay')?.classList.contains('is-visible')??null,
        title:document.title,
      })).catch(()=>({domDiagnosticUnavailable:true}));
      record.stages.bootstrapAttempts.push({attempt,
        failure:String(error?.message||error).slice(0,240),...diagnostic});
      if(attempt===maxBootstrapAttempts)throw error;
    }
  }
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(xmlPath);
  // Source FileReader is async; the header can still say "Source: Not Loaded"
  // immediately after setInputFiles resolves.
  await page.waitForFunction(()=>/Branches:\s*41\/41/.test(
    document.querySelector('.xml-cii-header-status-row')?.textContent||''
  ),null,{timeout:60000});
  const actualBranches=await page.locator('.xml-cii-header-status-row').textContent();
  assert.match(actualBranches,/Branches:\s*41\/41/);
  record.passes.push('real 41/41 loaded');
  for(const [kind,file] of [
    ['lineList',lineListPath],
    ['pipingClass','docs/Masters/Piping_class_master.json'],
    ['materialMap','docs/Masters/PCF_MAT_MAP.TXT'],
  ]){
    await page.locator('[data-sub-tab="'+(kind==='lineList'?'linelist':kind)+'"]').click();
    await page.locator('input[data-master-file="'+kind+'"]').setInputFiles(file);
    await page.locator('[data-master-mapping-status="'+kind+'"]')
      .filter({hasText:'Mapping status: APPLIED'}).waitFor({timeout:60000});
  }
  await page.locator('[data-sub-tab="weight"]').click();
  record.stages.masters=await page.evaluate(async()=>{
    const {createXmlCiiAdaptedWorkflowState}=await import(
      new URL('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js',document.baseURI).href);
    const m=createXmlCiiAdaptedWorkflowState().masterContext;
    return {lineList:m.lineRows?.length,pipingClass:m.pipingClassRows?.length,
      materialMap:m.materialMapRows?.length,weight:m.weightMasterRows?.length,
      weightSource:m.sourceMetadata?.weight?.source,
      weightSourceType:m.sourceMetadata?.weight?.sourceType};
  });
  assert.equal(record.stages.masters.weight,1595);
  assert.equal(record.stages.masters.weightSourceType,'default');
  record.passes.push('real three-master applied import controls and default Valve autoload');

  await page.locator('[data-phase="json-trace"]').click();
  await page.locator('[data-field="staged-json-file"]').setInputFiles(jsonPath);
  await page.waitForFunction(()=>{
    const status=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return status.startsWith('LFJ source index COMMITTED')||
      status.startsWith('LFJ Worker FAILED');
  },null,{timeout:420000});
  record.stages.jsonIndex=await page.locator('[data-lfj-o1-status]').textContent();
  assert.match(record.stages.jsonIndex,/LFJ source index COMMITTED/,
    'real EF05 original JSON index did not commit');
  record.passes.push('real original JSON O1 index committed');

  await page.locator('[data-phase="preview"]').click();
  // createXmlCiiAdaptedWorkflowState() is a *new* state and intentionally
  // does not include already imported browser-memory class/map/line rows.
  // Verify those imports from the active Preview inventory instead.
  const masterInventory=await page.locator('#mc-preview-table-host').evaluate(el=>
    el.parentElement?.textContent||'');
  record.stages.activeMasterInventoryText=masterInventory.slice(0,1300);
  record.stages.activeMasterInventory=Object.fromEntries([
    ['lineList',/Line List:\s*(\d+) row\(s\)/],
    ['pipingClass',/Piping Class:\s*(\d+) row\(s\)/],
    ['materialMap',/Material Map:\s*(\d+) row\(s\)/],
    ['weight',/Valve Weights:\s*(\d+) row\(s\)/],
  ].map(([k,re])=>[k,Number(masterInventory.match(re)?.[1]||0)]));
  assert(record.stages.activeMasterInventory.lineList>0);
  if(lineListVariant==='bc4-json'){
    assert.equal(record.stages.activeMasterInventory.lineList,385);
    record.passes.push('BC4 original 385-row LineList JSON loaded into current live Preview');
  }
  assert.equal(record.stages.activeMasterInventory.pipingClass,10699);
  assert.equal(record.stages.activeMasterInventory.materialMap,383);
  assert.equal(record.stages.activeMasterInventory.weight,1595);
  record.passes.push('verified four-master active Preview inventory');

  // Original indexed JSON is *optional for XML-only*. Load it to prove that
  // the new explicit selector is effective despite an active O1 receipt.
  const previewBuild=page.locator('#mc-preview-table-host [data-mc-preview-build]').first();
  await previewBuild.click();
  await page.waitForFunction(()=>{
    const host=document.querySelector('#mc-preview-table-host');
    return host?.dataset.mcPreviewJsonSource==='P4_ENGINEERING_VERIFIED'||
      /Preview failed/.test(host?.textContent||'');
  },null,{timeout:420000});
  record.stages.preview=await page.locator('#mc-preview-table-host').evaluate(host=>{
    const r=host.__xmlCiiPreviewResult;
    return {status:host.dataset.mcPreviewJsonSource,
      basisId:host.dataset.mcPreviewBasisId,
      branchRows:r?.branchRows?.length||0,
      nodeRows:r?.nodeRows?.length||0,
      tables:host.querySelectorAll('table').length,
      sourceSha256:host.dataset.mcPreviewOriginalJsonSha256,
      error:(host.textContent||'').slice(-700)};
  });
  assert.equal(record.stages.preview.status,'P4_ENGINEERING_VERIFIED');
  assert.equal(record.stages.preview.sourceSha256,record.source.jsonSha256);
  assert.equal(record.stages.preview.branchRows,41);
  record.passes.push('real Preview Worker 41 source branches verified');
  await page.locator('[data-phase="weight-match"]').click();
  await page.locator('[data-p4-weight-status]').waitFor({timeout:60000});
  record.stages.weight={visibleRows:await page.locator('tr[data-p4-row]').count(),
    status:(await page.locator('[data-p4-weight-status]').textContent()).slice(0,1000)};
  assert(record.stages.weight.visibleRows>0);
  record.passes.push('actual Worker-backed Weight Match opened; no accepts added');

  // Full public 41-branch source / staged JSON / four-master GC-PW precheck:
  // all original physicals (including outside the focused Weight tab),
  // seven canonical facts per owner, all proposals and semantic family evidence.
  // No original XML, NodeName, occurrence IDs or master rows are exported.
  // Production panel owns its Worker: use the existing DOM's strictly
  // aggregate-only download instead of exporting private session handles.
  const [safetyDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:240000}),
    page.locator('[data-p4-full-source-safety]').click(),
  ]);
  assert.equal(safetyDownload.suggestedFilename(),
    'xml229-full-source-weight-safety-precheck.json');
  record.stages.fullSourceWeight=JSON.parse(
    await readFile(await safetyDownload.path(),'utf8'));
  assert.equal(record.stages.fullSourceWeight.readOnly,true);
  assert.equal(record.stages.fullSourceWeight.population.sevenFactsPerPhysical,true);
  assert.equal(record.stages.fullSourceWeight.population.physicalCount,423);
  assert.equal(record.stages.fullSourceWeight.population.factCount,2961);
  assert.equal(record.stages.fullSourceWeight.review.unresolved,423);
  assert.equal(record.stages.fullSourceWeight.review.unchanged,true);
  assert.equal(record.stages.fullSourceWeight.proposals.valveToFlangeRejected,92);
  assert.equal(record.stages.fullSourceWeight.proposals.sourceFamilyConflict,0);
  assert.equal(record.stages.fullSourceWeight.proposals.valveToFlangeQualified,0);
  assert.equal(record.stages.fullSourceWeight.review.acceptedMatch1,0);
  assert.equal(record.stages.fullSourceWeight.review.acceptedFinal,0);
  assert.equal(record.stages.fullSourceWeight.nativeCiiReleaseAuthorized,false);
  record.passes.push('public 41-branch full physical/fact/candidate family audit read-only; zero Final/native authority');

  // Real 41-branch P3: capture exact effective four-master config from
  // the SAME verified Worker lease through the explicit OWNER PRIVATE button.
  // The downloaded JSON is inspected in browser temp storage only; never
  // uploaded to CI artifacts, logged, or copied into ValidationRecords.
  const [custodyDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:180000}),
    page.locator('[data-p4-export-effective-basis]').click(),
  ]);
  assert.equal(custodyDownload.suggestedFilename(),
    'xml229-owner-effective-basis-custody_PRIVATE.json');
  const privateCustody=JSON.parse(await readFile(await custodyDownload.path(),'utf8'));
  const {canonicalJson}=await import('../contracts/gc-pw-v1/contract.mjs');
  const canonicalHash=x=>sha(Buffer.from(canonicalJson(x)));
  assert.equal(privateCustody.schema,'XML229.OwnerLocalEffectiveBasisCustody.v1');
  assert.equal(privateCustody.originalJsonSha256,record.source.jsonSha256);
  assert.equal(privateCustody.sourceTextSha256,
    sha(Buffer.from(x.toString('utf8').replace(String.fromCodePoint(0xfeff),''))));
  assert.equal(privateCustody.configSha256,canonicalHash(privateCustody.contents.config));
  assert.equal(privateCustody.overridesSha256,canonicalHash(privateCustody.contents.overrides));
  assert.equal(privateCustody.historicalDecisionUpdates,0);
  assert.equal(privateCustody.finalAcceptedAutomatically,false);
  assert.equal(privateCustody.nativeCiiReleaseAuthorized,false);
  const ownerMasterCensus={};
  const defs={lineList:['linelist','masterRows'],materialMap:['material','mapRows'],
    pipingClass:['pipingClass','masterRows'],weight:['weight','masterRows']};
  for(const [kind,[section,field]] of Object.entries(defs)){
    const m=privateCustody.contents.masters[kind],d=privateCustody.masterDigests[kind];
    assert.equal(canonicalHash(m.rows),d.sha256);
    assert.equal(canonicalHash(m.mapping),d.mappingSha256);
    assert.equal(canonicalHash(privateCustody.contents.config[section][field]),d.sha256);
    assert.equal(canonicalHash(privateCustody.contents.config[section].fieldMap||{}),
      d.mappingSha256);
    assert.equal(m.rows.length,d.rowCount);
    ownerMasterCensus[kind]=d.rowCount;
  }
  record.stages.ownerBasisCustody={
    schema:privateCustody.schema,masterCounts:ownerMasterCensus,
    exactVerifiedLease:true,sourceTextHashVerified:true,
    configCanonicalDigestVerified:true,fourMasterDigestsVerified:true,
    historicalDecisionUpdates:0,nativeCiiReleaseAuthorized:false,
    privateContentsLogged:false};
  record.passes.push('Owner-local four-master effective config export hashed in-memory; private rows not logged or uploaded');

  await page.locator('[data-phase="run"]').click();
  const chooser=page.locator('[data-action="xml229-output-participation"]');
  await chooser.waitFor({timeout:60000});
  assert.equal(await chooser.inputValue(),'governed');
  assert.equal(await page.locator('[data-action="run"]').isDisabled(),true);
  record.passes.push('O1 governed native CII correctly HELD');
  await chooser.selectOption('xml-only');
  await page.waitForFunction(()=>
    document.querySelector('[data-action="run"]')?.disabled===false,
    null,{timeout:60000});
  const [auditDL]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="export-output-readiness"]').click(),
  ]);
  const exported=JSON.parse(await readFile(await auditDL.path(),'utf8'));
  record.stages.route={participation:exported.manifest?.nativeOutputParticipation,
    xmlOnly:exported.raw?.xml229XmlOnlyOutput,
    blockingCount:exported.summary?.blockingCount,
    formatGate:exported.checklistRows?.find(r=>r.id==='branch-format-authority'),
    governedHold:exported.checklistRows?.find(r=>r.id==='xml229-original-json-engineering-authority'),
  };
  assert.equal(record.stages.route.participation,'explicit-xml-only');
  assert.equal(record.stages.route.xmlOnly,true);
  assert.equal(record.stages.route.blockingCount,0);
  assert.equal(record.stages.route.governedHold,undefined);
  record.passes.push('test explicitly selected current-source XML-only conversion; not an Owner engineering or governed native CII approval');

  await page.locator('[data-action="run"]').click();
  await page.waitForFunction(()=>{
    return !!document.querySelector('[data-rigid-review-skip]')||
      document.querySelector('.xml-cii-adapted-cii-download')?.disabled===false||
      [...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
        .some(tr=>tr.children[0]?.textContent==='run-result'&&
          tr.children[2]?.textContent?.trim()==='ready');
  },null,{timeout:300000});
  const skip=page.locator('[data-rigid-review-skip]');
  if(await skip.count())await skip.click();
  await page.waitForFunction(()=>{
    const download=document.querySelector('.xml-cii-adapted-cii-download');
    const row=[...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
      .find(tr=>tr.children[0]?.textContent==='run-result');
    return download?.disabled===false||row?.children[2]?.textContent?.trim()==='ready';
  },null,{timeout:300000});
  const enabled=await page.locator('.xml-cii-adapted-cii-download').isEnabled();
  record.stages.conversion={ciiEnabled:enabled,
    text:(await page.locator('[data-active-phase="run"]').innerText()).slice(0,3500)};
  assert.equal(enabled,true,'real EF05 XML-only native conversion did not produce CII');
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('.xml-cii-adapted-cii-download').click(),
  ]);
  const cii=await readFile(await download.path());
  assert(cii.length>0);
  record.stages.conversion={ciiEnabled:true,
    filename:download.suggestedFilename(),bytes:cii.length,
    sha256:sha(cii),lineCount:cii.toString('utf8').split(/\r?\n/).length};
  assert.match(download.suggestedFilename(),/\.cii$/i);
  // Validate the *downloaded browser artifact*, not an in-memory string
  // or a standalone native-engine fixture.
  await mkdir('ValidationRecords',{recursive:true});
  const ciiSyntaxPath='ValidationRecords/xml229-ef05-browser-downloaded-cii-syntax'+artifactSuffix+'.json';
  execFileSync('python3',[
    'converters/scripts/cii_syntax_check_2019.py',
    '--input',await download.path(),'--output',ciiSyntaxPath,
  ]);
  const syntax=JSON.parse(await readFile(ciiSyntaxPath,'utf8'));
  record.stages.conversion.syntax={
    ok:syntax.ok,errors:syntax.errors,warnings:syntax.warnings,
    elements:syntax.metrics?.elements,
  };
  assert.equal(syntax.ok,true,'Downloaded browser CII failed 2019 syntax check');
  assert.deepEqual(syntax.errors,[]);
  record.passes.push('real native CII result downloaded, nonempty and SHA-attested');

  await page.locator('[data-action="xml229-output-participation"]').selectOption('governed');
  await page.waitForFunction(()=>document.querySelector('[data-action="run"]')?.disabled===true,
    null,{timeout:60000});
  record.passes.push('switch to governed restores native O1 HOLD');
  assert.deepEqual(record.pageErrors,[]);
  record.ok=true;
}catch(error){
  record.failures.push(String(error?.stack||error).slice(0,2800));
}finally{
  await mkdir('ValidationRecords',{recursive:true});
  await writeFile('ValidationRecords/xml229-ef05-native-output-e2e'+artifactSuffix+'.json',JSON.stringify(record,null,2)+'\n');
  console.log('XML229_EF05_NATIVE_E2E '+JSON.stringify(record));
  await browser?.close();
  await rm(tmp,{recursive:true,force:true});
}
assert.equal(record.ok,true,record.failures.join('\n'));
