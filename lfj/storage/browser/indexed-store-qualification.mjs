import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('pageerror',e=>{console.error('BROWSER_PAGE_ERROR',e.message)});
  await page.goto('http://127.0.0.1:4181/lfj/storage/browser/indexed-store-qualification.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.runRealIndexedDBTests==='function',{timeout:15000});
  const result=await page.evaluate(()=>window.runRealIndexedDBTests());
  assert.equal(result.sourceCount,11);
  assert.equal(result.abortPreservedPrevious,true);
  assert.deepEqual(result.pageOrdinals,[90,91,92,93,94,95,96]);
  assert.equal(result.recoveredPage,true);
  assert.equal(result.abortBeforeCompleteInvisible,true);
  assert.equal(result.cancelDuringCommitInvisible,true);
  assert.equal(result.noStorageExplicit,true);
  console.log('STORE-GATE actual IndexedDB source/selection indexed persistence + abort-before-complete: PASS');
}finally{await browser.close();}
