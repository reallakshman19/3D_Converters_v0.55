import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const raw='[{"name":"é","children":[{"name":"X"}]},{"name":"é","children":[{"name":"Y"}]}]';
const expected=['','/0','/0/name','/0/children','/0/children/0',
  '/0/children/0/name','/1','/1/name','/1/children',
  '/1/children/0','/1/children/0/name'];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4183/lfj/runtime/original-idb-value-qualification.html',
    {waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.runOriginalIdbValue==='function');
  const found=await page.evaluate(value=>window.runOriginalIdbValue(value),raw);
  assert.equal(found.sha,createHash('sha256').update(raw).digest('hex'));
  assert.equal(found.completion,'SOURCE_INDEX_COMPLETE');
  assert.equal(found.receivedName0,'"é"');
  assert.equal(found.receivedName1,'"é"');
  assert.equal(found.distinctIds,true);
  assert.equal(found.rootText,raw);
  assert.equal(found.sourceCount,expected.length);
  assert.equal(found.eventCount,expected.length*2);
  assert.deepEqual(found.rows,expected);
  assert.equal(found.revokedPageCode,'STORE_ABORTED',
    'selected pages cannot remain authorized after committed source head is revoked');
  assert.equal(found.staleCode,'SOURCE_STALE');
  assert.equal(found.closedCode,'SESSION_CLOSED');
  assert.equal(found.rightsBasis,'SOURCE_FACTS_ONLY');
  assert.deepEqual(errors,[]);
  console.log('LFJ #1108 U02: actual Chromium original-source Worker + durable IndexedDB OPEN/SEAL direct read PASS');
}finally{await browser.close();}
