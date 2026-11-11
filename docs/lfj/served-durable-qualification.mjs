import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
const source=JSON.stringify([{type:'BRANCH',name:'Parent',children:[{name:'X'},{name:'X'}]}]);
const full=['','/0','/0/type','/0/name','/0/children','/0/children/0',
 '/0/children/0/name','/0/children/1','/0/children/1/name'];
const expected=full.slice(1);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>console.error('DEPLOY_BROWSER_PAGE_ERROR',e.message));
 await page.goto('http://127.0.0.1:4182/lfj/served-durable-qualification.html',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.runRealDeployedDurableChain==='function');
 const result=await page.evaluate(x=>window.runRealDeployedDurableChain(x),source);
 assert.equal(result.sha,createHash('sha256').update(source).digest('hex'));
 assert.equal(result.complete,'SOURCE_INDEX_COMPLETE');
 assert.equal(result.consumed,new TextEncoder().encode(source).byteLength);
 assert.equal(result.sourceCount,full.length);
 assert.equal(result.selectedCount,expected.length);
 assert.deepEqual(result.paths,expected);
 assert.deepEqual(result.persistedPaths,expected);
 assert.equal(result.requests,4);
 console.log('DEPLOY real served docs Worker → R06 → R07 IndexedDB durable → R08 → R09 → reopened persisted page union PASS');
}finally{await browser.close();}
