/**
 * XML229 P1B source-badge correction witness — original files.
 * Uses the real authored application and ORIGINAL repository Firstpass XML/JSON,
 * not the Owner's private 622,915-occurrence input. No product files modified.
 * A positive P1B result requires corrected badge, not fabricated source text.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const sha = data => createHash('sha256').update(data).digest('hex');
const base = 'http://127.0.0.1:4173/';
const xmlFile = 'Benchmarks/1885Sjson/FirstpassXML';
const jsonFile = 'Benchmarks/1885Sjson/Sjson.json';
const originalXml = await readFile(xmlFile);
const originalJson = await readFile(jsonFile);
assert.equal(sha(originalJson),
  '6b2c8b01ab0ba6ec8e9e7c42eb4a719668ffd2dc4dbe4790d27cf426a1f60288',
  'actual independent original JSON fixture must not drift');
const record = {
  schema: 'XML229.P1B.OriginalSourceBadgeBrowser.v1',
  exactHead: process.env.EXACT_HEAD || null,
  notLiveOwnerData: true,
  ownerOriginal622915NotReplayed: true,
  route: 'index.html',
  fixture: {
    sourceXml: { path:xmlFile, bytes:originalXml.length, sha256:sha(originalXml) },
    originalJson: { path:jsonFile, bytes:originalJson.length, sha256:sha(originalJson) },
  },
  observation: {}, domain: {}, synthetic28: {}, negative: {}, pageErrors: [],
  workers: [], failures: [], pass: false,
};
const started = performance.now();
const browser = await chromium.launch({ headless:true });
let page;
const maybe = async fn => { try {return await fn();}catch(e){return 'UNAVAILABLE: '+String(e).slice(0,180);} };
try {
  page = await browser.newPage({acceptDownloads:true});
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => record.pageErrors.push(String(error).slice(0,400)));
  page.on('worker', worker => record.workers.push(worker.url()));
  await page.addInitScript(() => {
    const m={last:0, frames:0, maxFrameGapMs:0};
    const tick=t=>{if(m.last) {m.frames++;m.maxFrameGapMs=Math.max(m.maxFrameGapMs,t-m.last);}
      m.last=t;requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
    window.__xml229P0Frames=m;
  });
  const response=await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.locator('[data-tab="xml-cii-2019-standalone"]').click({timeout:45000});
  await page.locator('[data-phase="source"]').click();
  await page.locator('[data-field="source-file"]').setInputFiles(xmlFile);
  await page.locator('[data-phase="json-trace"]').click();
  assert.equal(await page.locator('[data-lfj-o1-enable]').isChecked(), true,
    'actual ordinary single PSI116 route should default to independent Worker');
  record.observation.legacyBefore = await page.locator('span.xml-cii-phase-help')
    .filter({hasText:'Staged JSON:'}).first().textContent();
  await page.locator('[data-field="staged-json-file"]').setInputFiles(jsonFile);
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return text.startsWith('LFJ source index COMMITTED') || text.startsWith('LFJ Worker FAILED');
  },null,{timeout:240000});
  record.observation.sourceStatus = await page.locator('[data-lfj-o1-status]').textContent();
  record.observation.sourceProgress = await page.locator('[data-lfj-o1-progress]').evaluate(el=>({
    phase:el.dataset.phase,
    title:el.querySelector('[data-lfj-o1-progress-title]')?.textContent,
    detail:el.querySelector('[data-lfj-o1-progress-detail]')?.textContent,
  }));
  record.observation.legacyAfter = await page.locator('span.xml-cii-phase-help')
    .filter({hasText:'Staged JSON:'}).first().textContent();
  record.observation.sourceCommitted=record.observation.sourceStatus.startsWith('LFJ source index COMMITTED');
  record.observation.jsonShaCorrect=record.observation.sourceStatus.includes(sha(originalJson).slice(0,12));
  record.observation.sourceBadgePositive=
    record.observation.legacyAfter.includes('Indexed in Worker') &&
    record.observation.legacyAfter.includes('23,754 original occurrences') &&
    record.observation.legacyAfter.includes(sha(originalJson).slice(0,12));
  record.observation.originalWorkerUsed=
    record.workers.some(url=>url.includes('source-browser-worker.mjs'));
  record.observation.frame=await page.evaluate(()=>({...window.__xml229P0Frames}));
  assert.ok(record.observation.sourceCommitted, 'real original Worker did not commit: '+record.observation.sourceStatus);
  assert.ok(record.observation.jsonShaCorrect, 'real committed JSON SHA did not match original source');
  assert.ok(record.observation.originalWorkerUsed,'actual source-browser-worker did not execute');
  assert.ok(record.observation.sourceBadgePositive,
    'Worker committed but real staged JSON badge was not corrected: '+record.observation.legacyAfter);
  // Separate domain verification is a distinct stage: do not infer it from source commit.
  record.domain.waitingBeforeBuild=await maybe(()=>page.locator('[data-lfj-o1-trace-status]').first().textContent());
  await page.locator('[data-action="build-resolver-index"]').click();
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return text.startsWith('O1 matched trace source-path verified') ||
      text.startsWith('O1 domain blocked') || text.startsWith('O1 Worker FAILED');
  },null,{timeout:300000});
  record.domain.status=await page.locator('[data-lfj-o1-status]').textContent();
  record.domain.verified=record.domain.status.startsWith('O1 matched trace source-path verified');
  record.domain.exportButtonCount=await page.locator('[data-lfj-o1-action^="export-"]').count();
  record.domain.workerUsed=record.workers.some(url=>url.includes('lfj-o1-resolver-domain-worker.mjs'));
  if(!record.domain.verified) record.failures.push('domain trace did not reach original source-path verification: '+record.domain.status);
  else assert.equal(record.domain.exportButtonCount,2, 'domain receipt and CSV controls disagree');
  // Observe the REAL authored Run panel on this smaller original fixture.
  record.observation.phaseOptions = await page.locator('[data-phase]').evaluateAll(
    els => [...new Set(els.map(el=>el.dataset.phase))].filter(Boolean));
  if(record.observation.phaseOptions.includes('run')) {
    await page.locator('[data-phase="run"]').click();
    const refresh=page.locator('[data-action="refresh-output-run"]');
    if(await refresh.count()) await refresh.click();
    record.observation.runButtonDisabled=await maybe(()=>page.locator('[data-action="run"]').isDisabled());
    record.observation.runBlockingRows=await page.evaluate(()=>{
      const records=[];
      for(const table of document.querySelectorAll('table')) {
        const header=[...table.querySelectorAll('thead th')].map(e=>e.textContent.trim());
        const id=header.indexOf('ID'),blocking=header.indexOf('Blocking');
        if(id<0||blocking<0)continue;
        for(const tr of table.querySelectorAll('tbody tr')) {
          const cells=[...tr.querySelectorAll('td')].map(e=>e.textContent.trim());
          if(cells[blocking]!=='true')continue;
          records.push({id:cells[id],label:cells[header.indexOf('Label')],
            status:cells[header.indexOf('Status')],message:cells[header.indexOf('Message')]});
        }
      }
      return records;
    });
    record.observation.runPreflightText=await maybe(()=>page.locator('[data-action="run"]')
      .locator('xpath=../..').textContent());
    record.observation.runPreflightText=String(record.observation.runPreflightText).slice(0,800);
    assert.equal(record.observation.runButtonDisabled,
      record.observation.runBlockingRows.length>0,
      'real Run button state disagrees with visibly blocking Run rows for this fixture');
  }
  // The Run checklist was read above on its own panel. Return to the JSON
  // phase before selecting a different original File (no synthetic rerender).
  await page.locator('[data-phase="json-trace"]').click();
  // Original worker source replacement cannot inherit source-only or CSV rights.
  await page.locator('[data-field="staged-json-file"]').setInputFiles({
    name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('[{"broken":}'),
  });
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-lfj-o1-status]')?.textContent||'';
    return text.startsWith('LFJ Worker FAILED');
  },null,{timeout:30000});
  record.negative.status=await page.locator('[data-lfj-o1-status]').textContent();
  record.negative.badge=await page.locator('span.xml-cii-phase-help')
    .filter({hasText:'Staged JSON:'}).first().textContent();
  record.negative.csvControls=await page.locator('[data-lfj-o1-action^="export-"]').count();
  assert.ok(/rejected|failed|revoked/i.test(record.negative.badge),
    'invalid replacement did not revoke committed original source');
  assert.ok(!record.negative.badge.includes('Indexed in Worker'),
    'old source index was retained after invalid replacement');
  assert.equal(record.negative.csvControls,0,'old CSV controls survived invalid replacement');
  // A SEPARATE existing 28 synthetic-occurrence browser exercise captures
  // UNMATCHED -> unique effective token -> stale -> valid, not Owner 28 replay.
  const synthetic=await page.goto(base+'tests/browser/xml-cii-229-p1-p2-browser-witness.html',
    {waitUntil:'domcontentloaded'});
  assert.equal(synthetic?.status(),200);
  await page.waitForFunction(()=>globalThis.__XML229_BROWSER_DONE__===true,null,{timeout:60000});
  record.synthetic28=await page.evaluate(()=>globalThis.__XML229_BROWSER_RESULT__);
  assert.equal(record.synthetic28?.ok,true,'actual Run/Regex 28-occurrence browser fixture failed: '+record.synthetic28?.error);
  assert.equal(record.synthetic28.syntheticOccurrences,28);
  assert.equal(record.synthetic28.afterStaleRegex,'28 UNMATCHED');
  assert.equal(record.pageErrors.length,0,'unexpected original or 28-fixture page errors');
  record.pass=record.observation.sourceCommitted &&
    record.observation.sourceBadgePositive && record.domain.verified &&
    record.synthetic28.ok;
  record.disposition=record.pass
    ? 'P1B_SOURCE_BADGE_FIXED_ON_ORIGINAL_AUTHORED_ROUTE'
    : 'P1B_SOURCE_BADGE_REGRESSION_FAILED';
}catch(error){
  record.failures.push(String(error?.stack||error).slice(0,1800));
  record.disposition='P1B_SOURCE_BADGE_REGRESSION_FAILED';
}finally{
  record.durationMs=Math.round(performance.now()-started);
  await mkdir('ValidationRecords',{recursive:true});
  await writeFile('ValidationRecords/xml229-p1b-original-source-badge-browser.json',
    JSON.stringify(record,null,2)+'\n');
  console.log('XML229_P1B_ORIGINAL_SOURCE_BADGE_WITNESS '+JSON.stringify({
    schema:record.schema,head:record.exactHead,notOwnerData:true,fixture:record.fixture,
    observation:record.observation,domain:record.domain,synthetic28:record.synthetic28,
    negative:record.negative,
    errors:record.pageErrors,failures:record.failures,pass:record.pass,disposition:record.disposition
  }));
  await browser.close();
}
if(!record.pass)process.exitCode=1;
