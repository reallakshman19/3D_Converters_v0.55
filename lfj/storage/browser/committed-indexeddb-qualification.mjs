import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const input=JSON.stringify([{type:'BRANCH',name:'Root',children:[{name:'same'},{name:'same'}]}]);
const expectedAll=['','/0','/0/type','/0/name','/0/children','/0/children/0',
  '/0/children/0/name','/0/children/1','/0/children/1/name'];
const expectedSelected=expectedAll.slice(1);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>console.error('IDB_COMPOSITE_BROWSER_ERROR',e.message));
 await page.goto('http://127.0.0.1:4181/lfj/storage/browser/committed-indexeddb-qualification.html',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.runDurableWorkerChain==='function');
 const found=await page.evaluate(x=>window.runDurableWorkerChain(x),input);
 assert.equal(found.sha,createHash('sha256').update(input).digest('hex'));
 assert.equal(found.originalBytes,new TextEncoder().encode(input).byteLength);
 assert.equal(found.completion,'SOURCE_INDEX_COMPLETE');
 assert.equal(found.persistedManifest,true);
 assert.equal(found.sourceCount,expectedAll.length);
 assert.equal(found.selectedCount,expectedSelected.length);
 assert.deepEqual(found.paths,expectedSelected);
 assert.deepEqual(found.pageRows,expectedSelected.map(()=>1));
 assert.deepEqual(found.reopenedSourcePaths,expectedAll);
 assert.deepEqual(found.resumedSelectedPaths,expectedSelected);
 assert.equal(found.staleScopeCode,'STORE_NOT_COMMITTED');
 console.log('STORE-GATE REAL CHROMIUM: same native Worker R06 consumed + R07 durable IndexedDB commit + R08 original scope + R09 paged cursor + restart indexed rows PASS');
}finally{await browser.close();}
