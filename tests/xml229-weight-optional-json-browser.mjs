/** Actual app imports and controls. Local test decisions are never Owner engineering acceptance. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const inputs=JSON.parse(await readFile('.local-test-tmp/owner-input-checks/manifest.json','utf8'));
const cases=[...inputs.map(input=>({path:input.path,name:input.name,branches:input.branches,kind:'XML_ONLY'})),
  {path:'Benchmarks/1885Sjson/FirstpassXML',name:'FirstpassXML-without-json',branches:5,kind:'XML_ONLY'},
  {path:'Benchmarks/1885Sjson/FirstpassXML',name:'FirstpassXML',branches:5,kind:'XML_WITH_JSON'}];
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{for(const input of cases.filter(x=>!process.env.XML229_WEIGHT_INPUT_FILTER||x.name.startsWith(process.env.XML229_WEIGHT_INPUT_FILTER))){
 const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>{if(r.url().includes('xml-cii')||r.url().includes('xml229'))
   errors.push(r.url()+' '+r.failure()?.errorText);});
 try{
  await page.goto('http://127.0.0.1:8080/index.html');
  await page.locator('[data-tab="xml-cii-2019-standalone"]').click();
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(input.path);
  await page.waitForFunction(n=>document.body.textContent.includes('Branches: '+n+'/'+n),input.branches);
  for(const [kind,file] of [['lineList','docs/Masters/ImportedRawLineListLL.xlsx'],
    ['pipingClass','docs/Masters/Piping_class_master.json'],['materialMap','docs/Masters/PCF_MAT_MAP.TXT']]){
    await page.locator('[data-sub-tab="'+(kind==='lineList'?'linelist':kind)+'"]').click();
    await page.locator('input[data-master-file="'+kind+'"]').setInputFiles(file);
    await page.locator('[data-master-mapping-status="'+kind+'"]')
      .filter({hasText:'Mapping status: APPLIED'}).waitFor();
  }
  if(input.kind==='XML_WITH_JSON'){
    await page.locator('[data-phase="json-trace"]').click();
    await page.locator('[data-field="staged-json-file"]').setInputFiles('Benchmarks/1885Sjson/Sjson.json');
    await page.waitForFunction(()=>document.querySelector('[data-lfj-o1-status]')?.textContent
      .startsWith('LFJ source index COMMITTED'),null,{timeout:240000});
  }
  await page.locator('[data-phase="preview"]').click();
  await page.locator('#mc-preview-table-host [data-mc-preview-build]').first().click();
  await page.waitForFunction(()=>/ENGINEERING_VERIFIED/.test(
    document.querySelector('#mc-preview-table-host')?.dataset.mcPreviewJsonSource||'')||
    document.querySelector('#mc-preview-table-host')?.textContent.includes('Preview failed'),null,{timeout:240000});
  const preview=await page.locator('#mc-preview-table-host').evaluate(h=>({
    kind:h.dataset.mcPreviewJsonSource,basis:h.dataset.mcPreviewBasisId,
    branches:h.__xmlCiiPreviewOriginalOccurrences?.branchCount,text:h.textContent.slice(0,600)}));
  assert.equal(preview.kind,input.kind==='XML_ONLY'?'XML_ONLY_ENGINEERING_VERIFIED':'P4_ENGINEERING_VERIFIED',preview.text);
  assert.equal(preview.branches,input.branches);
  await page.locator('[data-phase="weight-match"]').click();
  console.log(JSON.stringify({file:input.name,stage:'WEIGHT_OPENED'}));
  await page.waitForFunction(()=>document.querySelector('[data-p4-weight-root]')?.dataset.p4ReadReady==='true',null,{timeout:60000});
  assert.equal(await page.locator('[data-p4-bulk-plan]').count(),1);
  assert.equal(await page.locator('[data-p4-save-drafts]').count(),1);
  assert.equal(await page.locator('tr[data-p4-row]').first().locator('td').count(),13);
  await page.locator('[data-p4-bulk-plan]').click();
  await page.waitForFunction(()=>{
    const t=document.querySelector('[data-p4-weight-status]')?.textContent||'';
    return t.includes('Apply all suggestions')&&t.includes('complete.')||t.includes('Weight action unavailable');
  },null,{timeout:60000});
  const bulk=await page.locator('[data-p4-weight-status]').textContent();
  assert.match(bulk,/complete/);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-p4-save-drafts]').click();
  const download=await downloadPromise;
  const draft=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(draft.basisId,preview.basis);
  await page.locator('[data-phase="preview"]').click();
  await page.waitForFunction(()=>document.querySelector('#mc-preview-table-host')
    ?.__xmlCiiPreviewResult?.branchRows?.length>0,null,{timeout:30000});
  assert.equal(await page.locator('[data-mc-preview-restore-held]').count(),0);
  assert.equal(await page.locator('#mc-preview-table-host').getAttribute('data-mc-preview-basis-id'),preview.basis);
  const census=await page.locator('#mc-preview-table-host').evaluate(h=>h.__xmlCiiVerifiedEngineeringReceipt.counts);
  await page.locator('[data-phase="run"]').click();
  const dialog=page.locator('[data-xml229-run-unresolved-dialog]');
  if(process.env.XML229_ASSERT_RUN_ENTRY&&census.unresolved>0){
    if(await dialog.count())await dialog.getByRole('button',{name:'Keep unresolved / Cancel',exact:true}).click();
    assert.match(await page.locator('[data-xml229-native-debug]').innerText(),/Elapsed: 0.0 s/);
    await page.getByRole('button',{name:'Finalise and Run Conversion',exact:true}).click();
    await dialog.waitFor();
    assert.equal(await page.getByText('Rigid Weights Need Review',{exact:true}).count(),0);
  }
  if(census.unresolved>0){
  if(!await dialog.count())await page.getByRole('button',{name:'Review unresolved physicals (0 kg defaults)',exact:true}).click();
  await dialog.waitFor({timeout:30000});
  const popupBefore=await dialog.innerText();
  await dialog.getByRole('button',{name:'Apply All Source suggestions (Max)',exact:true}).click();
  assert.match(await dialog.innerText(),/No Final mass decision was recorded/);
  await dialog.getByRole('button',{name:'Keep unresolved / Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Review unresolved physicals (0 kg defaults)',exact:true}).click();
  await dialog.waitFor();
  const popupAfter=await dialog.innerText();
  assert.equal(popupAfter.match(/Final mass review[^\n]*/)?.[0],popupBefore.match(/Final mass review[^\n]*/)?.[0]);
  assert.equal(popupAfter.match(/Existing \d+ Final values/)?.[0],popupBefore.match(/Existing \d+ Final values/)?.[0]);
  await dialog.getByRole('button',{name:'Keep unresolved / Cancel',exact:true}).click();
  }else{assert.equal(census.unresolved,0);assert.equal(await dialog.count(),0);}
  if(input.kind==='XML_ONLY'){assert.equal(draft.originalJsonSha256,null);assert.equal(draft.reviewSourceKind,'XML_ONLY');}
  let nativeCheck=null;
  if(process.env.XML229_ASSERT_NATIVE_HANDOFF){
    // Explicit isolated test confirmation of remaining zero inputs. Not Owner mass acceptance.
    const ciiDownload=page.waitForEvent('download',{timeout:300000}).catch(()=>null);
    console.log(JSON.stringify({stage:'FINAL_NATIVE_HANDOFF',census}));
    if(census.unresolved>0){
      await page.getByRole('button',{name:'Review unresolved physicals (0 kg defaults)',exact:true}).click();
      await dialog.getByRole('button',{name:'Confirm these Final masses',exact:true}).click();
      console.log(JSON.stringify({stage:'FINAL_CONFIRM_CLICKED'}));
      await dialog.waitFor({state:'detached',timeout:120000});
    }else{
      const run=page.getByRole('button',{name:'Finalise and Run Conversion',exact:true});
      if(await run.isEnabled())await run.click();
    }
    await page.waitForFunction(()=>/Conversion (completed and verified|failed:)/.test(
      document.querySelector('[data-xml229-native-debug]')?.textContent||''),null,{timeout:300000});
    const status=await page.locator('[data-xml229-native-debug]').innerText();
    if(!status.includes('completed and verified')){ciiDownload.catch(()=>{});throw Error(status);}
    const cii=await ciiDownload;assert(cii,'native CII download event required');
    const bytes=await readFile(await cii.path());assert(bytes.length>1000);
    await cii.saveAs('output/playwright/'+input.name+'-xml-only-verified.cii');
    await page.locator('[data-phase="weight-match"]').click();
    const auditDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download verified decision provenance JSON',exact:true}).click();
    const audit=JSON.parse(await readFile(await (await auditDownload).path(),'utf8'));
    assert.equal(audit.summary.unverified,0);assert.equal(audit.summary.confirmedZero,census.unresolved);
    nativeCheck={status,ciiBytes:bytes.length,provenance:audit.summary};
    await page.locator('[data-phase="run"]').click();
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>
      b.textContent==='Download CII'&&!b.disabled),null,{timeout:30000});
  }
  if(process.env.XML229_ASSERT_RAW_TIMER){
    await page.locator('select[data-action="xml229-output-participation"]').selectOption('xml-only');
    await page.getByRole('button',{name:'Finalise and Run Conversion',exact:true}).click();
    const clock=page.locator('[data-xml229-native-debug]');
    await page.waitForFunction(()=>document.querySelector('[data-xml229-native-debug]')?.textContent.includes('Conversion is running'));
    const first=await clock.innerText();
    await page.waitForFunction(t=>document.querySelector('[data-xml229-native-debug]')?.textContent!==t,first);
    assert.equal(await page.getByText('Rigid Weights Need Review',{exact:true}).count(),0);
    await page.waitForFunction(()=>!document.querySelector('[data-xml229-native-debug]')?.textContent.includes('Conversion is running'),null,{timeout:120000});
    assert.match(await clock.innerText(),/Conversion (finished|failed).*Elapsed:/);
  }
  reports.push({file:input.name,ok:true,kind:input.kind,branches:preview.branches,basis:preview.basis,
    controls:'CURRENT_13_COLUMN_APPLY_ALL_SAVE_DRAFTS',popup:census.unresolved>0?'OPEN_MAX_CANCEL_REOPEN_NO_FINAL_CHANGE':'NOT_NEEDED_VERIFIED_ZERO_UNRESOLVED',census,bulk,nativeCheck,engineeringAcceptance:'NOT_ASSESSED'});
 }catch(error){reports.push({file:input.name,ok:false,kind:input.kind,error:String(error.stack),errors,
   roots:await page.evaluate(()=>[...document.querySelectorAll('[data-p4-weight-root]')].map(r=>({
     data:{...r.dataset},status:r.querySelector('[data-p4-weight-status]')?.textContent}))),
   text:await page.locator('body').innerText().then(t=>t.slice(-1600)).catch(()=>'' )});}
 finally{await page.close();}
 console.log(JSON.stringify(reports.at(-1)));
 await mkdir('output/playwright',{recursive:true});
 await writeFile('output/playwright/xml229-weight-optional-json'+(process.env.XML229_WEIGHT_INPUT_FILTER?'-filtered':'')+'.json',JSON.stringify({reports},null,2));
}}finally{await browser.close();}
if(reports.some(r=>!r.ok))process.exitCode=1;
