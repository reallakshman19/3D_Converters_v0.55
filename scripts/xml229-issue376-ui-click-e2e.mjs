/** User-facing XML-only UI path; no master, Preview, JSON or Final approval.
 * This test downloads actual native CII; release governance remains separate. */
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function selectXmlOnlyAndRun(page){
 await page.locator('[data-phase="run"]').click();
 const chooser=page.locator('[data-action="xml229-output-participation"]');
 await chooser.waitFor({timeout:60000});
 assert.equal(await chooser.inputValue(),'governed');
 await chooser.selectOption('xml-only');
 await page.waitForFunction(()=>{
   return document.querySelector('[data-action="run"]')?.disabled===false;
 },null,{timeout:60000});
 await page.locator('[data-action="run"]').click();
 await page.waitForFunction(()=>{
   return !!document.querySelector('[data-rigid-review-skip]')||
     document.querySelector('.xml-cii-adapted-cii-download')?.disabled===false||
     [...document.querySelectorAll('[data-active-phase="run"] tbody tr')]
       .some(row=>row.children[0]?.textContent==='run-result'&&
         row.children[2]?.textContent?.trim()==='ready');
 },null,{timeout:300000});
 if(await page.locator('[data-rigid-review-skip]').count())
   await page.locator('[data-rigid-review-skip]').click();
 await page.waitForFunction(()=>document.querySelector(
   '.xml-cii-adapted-cii-download')?.disabled===false,null,{timeout:300000});
}
async function independent2019Syntax(download){
 const dir=await mkdtemp(join(tmpdir(),'xml229-ui-issue376-'));
 try{
  const path=join(dir,'out.cii'),result=join(dir,'syntax.json');
  const cii=await readFile(await download.path());
  await writeFile(path,cii);
  execFileSync('python3',['converters/scripts/cii_syntax_check_2019.py',
    '--input',path,'--output',result],{timeout:30000});
  const data=JSON.parse(await readFile(result,'utf8'));
  assert.equal(data.ok,true,JSON.stringify(data.errors));
  assert.deepEqual(data.errors,[]);
  assert(data.metrics.elements>0);
  return {ciiBytes:cii.length,ciiSha256:hash(cii),
    syntaxOk:true,elements:data.metrics.elements};
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function proveXml229Issue376UiDownload(browser,url,sourcePath,record){
 const page=await browser.newPage({acceptDownloads:true});
 page.setDefaultTimeout(60000);
 const started=Date.now();
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.locator('[data-tab="xml-cii-2019-standalone"]').click();
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(sourcePath);
  await page.waitForFunction(()=>{
    const header=document.querySelector('.xml-cii-header-status-row')?.textContent||'';
    return header.includes('Branches:')&&header.includes('41/41');
  },null,{timeout:60000});
  await selectXmlOnlyAndRun(page);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('.xml-cii-adapted-cii-download').click(),
  ]);
  const syntax=await independent2019Syntax(download);
  record.stages.issue376UiXmlOnly={
   ...syntax,filename:download.suggestedFilename(),
   sourceKind:'PUBLIC_EF05_XML',masterImports:0,
   stagedJsonSelected:false,governedFinalReleaseAuthorized:false,
   elapsedMs:Date.now()-started,
  };
  record.passes.push('issue 376 actual source-only UI click/download CII syntax accepted');
  console.log('XML229_ISSUE376_REAL_UI_DOWNLOAD',
    JSON.stringify(record.stages.issue376UiXmlOnly));
 }finally{await page.close();}
}
