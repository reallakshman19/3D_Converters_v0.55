/** Real Chrome UI/export check with an explicitly synthetic timeout receipt. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.XML229_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8080/');
 await page.evaluate(async()=>{
  const {renderXml229NativeRunDebug}=await import(
   '/tabs/xml-cii-2019-standalone/ui-adapted/xml229-native-run-debug.mjs');
  const {recordXml229CandidateAttempt:record}=await import(
   '/tabs/xml-cii-2019-standalone/ui-adapted/xml229-flow-trace-registry.mjs');
  // Explicitly synthetic lifecycle evidence, not a claimed converter failure.
  const ref={current:{}},session={closed:false};
  const host=document.createElement('div');document.body.appendChild(host);
  record(ref,session,{status:'IN_PROGRESS',phase:'MODEL_BUILD'});
  renderXml229NativeRunDebug(host,ref,session);
  window.__debugFail=()=>record(ref,session,{status:'FAILED',code:'STANDALONE_ENGINE_TIMEOUT'});
 });
 const panel=page.locator('[data-xml229-native-debug]');
 await panel.getByRole('status').filter({hasText:'MODEL_BUILD'}).waitFor();
 await page.evaluate(()=>window.__debugFail());
 const alert=panel.getByRole('alert');
 await alert.filter({hasText:'STANDALONE_ENGINE_TIMEOUT'}).waitFor();
 assert((await alert.textContent()).includes('No verified CII is available'));
 const downloadPromise=page.waitForEvent('download');
 await panel.getByRole('button',{name:'Download execution debug JSON'}).click();
 const download=await downloadPromise;
 const bytes=await readFile(await download.path());
 const receipt=JSON.parse(bytes);
 assert.equal(receipt.schema,'XML229.NativeExecutionDebug.v1');
 assert.equal(receipt.code,'STANDALONE_ENGINE_TIMEOUT');assert.equal(receipt.phase,'MODEL_BUILD');
 assert.equal(receipt.stages.length,1);assert.equal(receipt.nativeCiiReleaseAuthorized,false);
 assert.equal(receipt.ciiDownloadAuthorized,false);
 assert.equal(download.suggestedFilename(),'xml229-native-execution-debug.json');
 await mkdir('output/playwright',{recursive:true});
 const proof={basis:'SYNTHETIC_TIMEOUT_RECEIPT_REAL_CHROME_UI',
  alertVisible:await alert.isVisible(),debugDownloaded:true,bytes:bytes.length,
  releaseAuthorized:receipt.nativeCiiReleaseAuthorized};
 await writeFile('output/playwright/xml229-native-debug-ui.json',JSON.stringify(proof,null,2));
 console.log(JSON.stringify(proof));
}finally{await browser.close();}
