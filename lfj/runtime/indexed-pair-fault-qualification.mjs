import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  page.on('pageerror',e=>console.error('LFJ_PAIR_FAULT_PAGEERROR',e.message));
  await page.goto('http://127.0.0.1:4183/lfj/runtime/indexed-pair-fault-qualification.html',
    {waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.runPairFaultMatrix==='function');
  const found=await page.evaluate(()=>window.runPairFaultMatrix());
  assert.equal(found.mismatched,'PAIR_CORRUPT',
    'even occurrence event count cannot mask an unpaired SEAL');
  assert.equal(found.mismatchedSourceVisible,'STORE_NOT_COMMITTED',
    'source head must be rolled back when pair census fails');
  assert.equal(found.headAbortInjectionCalled,true,
    'negative test must abort actual IndexedDB head transaction');
  assert.equal(found.headAbort,'PAIR_COMMIT_ABORTED',
    'request success before transaction.complete must not grant ready');
  assert.equal(found.headAbortSourceVisible,'STORE_NOT_COMMITTED',
    'source first-head must be withdrawn when pair second-head aborts');
  assert.equal(found.headAbortPairVisible,'PAIR_ABORTED',
    'aborted pair port cannot return original source');
  assert.equal(found.pairedBeforeSourceAbort,true,
    'both source and pair heads must initially grant same generation');
  assert.equal(found.orphanPairRefused,'STORE_ABORTED',
    'pair head alone cannot authorize original source after original source head is aborted');
  assert.equal(found.reopenedPairValid,true,
    'source OPEN/SEAL pair must persist across fresh IndexedDB connection');
  assert.equal(found.corruptPair,'PAIR_CORRUPT',
    'persisted altered SEAL must fail closed, not fake original bytes');
  console.log('LFJ #1108 U02 browser negative matrix PASS: OPEN/SEAL completeness, atomic transaction abort, first-head rollback, reopen, corrupted SEAL');
}finally{await browser.close();}
