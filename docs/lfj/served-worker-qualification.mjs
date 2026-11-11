import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const json='[{"type":"BRANCH","name":"A/B~","children":[{"name":"CHILD"}]}]';
const expectedPaths=['','/0','/0/type','/0/name','/0/children','/0/children/0','/0/children/0/name'];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4182/lfj/served-worker-qualification.html',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.runServedDocsWorker==='function');
 const out=await page.evaluate(x=>window.runServedDocsWorker(x),json);
 assert.equal(out.result.kind,'SCAN_DONE');
 assert.equal(out.result.workerGlobal,true);
 assert.equal(out.result.summary.sourceSha256,createHash('sha256').update(new TextEncoder().encode(json)).digest('hex'));
 assert.equal(out.sha,out.result.summary.sourceSha256);
 assert.equal(out.result.summary.occurrenceCount,expectedPaths.length);
 assert.deepEqual(out.eventPaths,expectedPaths);
 assert.equal(out.result.summary.engineeringReady,false);
 console.log('DEPLOY-GATE test-served docs/ LFJ real Worker import closure and source-original SHA PASS');
}finally{await browser.close();}
